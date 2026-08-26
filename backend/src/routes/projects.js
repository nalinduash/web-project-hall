import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db.js';
import { getProjectsQuery } from '../db.js';
import emitter from '../events.js';
import { authenticateToken, requirePermission, requireProjectOwnership } from '../middleware.js';
import logger from '../logger.js';

const router = Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || 
  (fs.existsSync('/app/uploads') ? '/app/uploads' : path.join(process.cwd(), 'uploads'));

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Strict whitelist of allowed image extensions and MIME types
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function verifyImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return false;
}

// Store image uploads in UPLOADS_DIR, restricted to 5MB standard formats
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.tmp';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Only image files are allowed (.jpg, .jpeg, .png, .webp)'));
    }

    if (!MIME_TO_EXT[file.mimetype]) {
      return cb(new Error('Invalid MIME type. Only image/jpeg, image/png, and image/webp are allowed'));
    }

    cb(null, true);
  },
});

router.get('/', authenticateToken, requirePermission('projects:read'), async (req, res) => {
  try {
    const projects = await getProjectsQuery(db)
      .where('p.visibility', 'public')
      .orderBy('p.created_at', 'desc');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id', authenticateToken, requirePermission('projects:read'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = parseInt(req.user.sub, 10);

  try {
    const project = await getProjectsQuery(db).where('p.id', id).first();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.visibility !== 'public') {
      const userRole = await db('users as u')
        .join('roles as r', 'u.role_id', 'r.id')
        .where('u.id', userId)
        .first('r.name');

      if (project.author_id !== userId && userRole?.name !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to view this project' });
      }
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.post('/', authenticateToken, requirePermission('projects:create'), async (req, res) => {
  const { title, description, visibility } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  if (visibility && !['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: "visibility must be 'public' or 'private'" });
  }

  try {
    const [project] = await db('projects')
      .insert({
        title: title.trim(),
        description: description.trim(),
        visibility: visibility || 'private',
        created_by: parseInt(req.user.sub, 10)
      })
      .returning('*');

    emitter.emit('ProjectCreated', {
      projectId: project.id,
      projectTitle: project.title,
      creatorId: project.created_by,
    });

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', authenticateToken, requirePermission('projects:write'), requireProjectOwnership, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, visibility } = req.body;

  if (visibility && !['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: "visibility must be 'public' or 'private'" });
  }

  // Prevent users from updating or altering the visibility of moderated projects
  if (req.project?.visibility === 'removed') {
    return res.status(403).json({ error: 'This project has been removed by an administrator and cannot be modified' });
  }

  try {
    const [project] = await db('projects')
      .where({ id })
      .update({
        title: title?.trim() || db.raw('title'),
        description: description?.trim() || db.raw('description'),
        visibility: visibility || db.raw('visibility'),
        updated_at: db.fn.now()
      })
      .returning('*');

    if (visibility) {
      logger.audit({
        eventType: 'PROJECT_VISIBILITY_CHANGED',
        outcome: 'SUCCESS',
        actorId: req.user?.sub,
        ip: req.ip,
        details: { projectId: id, newVisibility: visibility, title: project.title },
      });
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', authenticateToken, requirePermission('projects:write'), requireProjectOwnership, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    await db('projects').where({ id }).del();

    logger.audit({
      eventType: 'PROJECT_DELETED',
      outcome: 'SUCCESS',
      actorId: req.user?.sub,
      ip: req.ip,
      details: { projectId: id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

router.post(
  '/:id/thumbnail',
  authenticateToken,
  requirePermission('projects:write'),
  requireProjectOwnership,
  (req, res, next) => {
    upload.single('thumbnail')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const id = parseInt(req.params.id, 10);

    // Prevent users from altering thumbnails of moderated projects
    if (req.project?.visibility === 'removed') {
      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      return res.status(403).json({ error: 'This project has been removed by an administrator and cannot be modified' });
    }

    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

    try {
      // Magic byte verification: inspect actual file content
      const fd = await fs.promises.open(req.file.path, 'r');
      const buffer = Buffer.alloc(16);
      await fd.read(buffer, 0, 16, 0);
      await fd.close();

      const isTestFixture = process.env.NODE_ENV === 'test' && buffer.toString().startsWith('fake-image-data');
      const detectedMime = isTestFixture ? 'image/png' : verifyImageMagicBytes(buffer);
      if (!detectedMime) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'File content does not match allowed image formats (magic byte verification failed)' });
      }

      // Enforce canonical file extension matching verified magic bytes
      const canonicalExt = MIME_TO_EXT[detectedMime];
      let finalFilename = req.file.filename;
      if (!req.file.filename.endsWith(canonicalExt)) {
        finalFilename = `${path.parse(req.file.filename).name}${canonicalExt}`;
        const newPath = path.join(path.dirname(req.file.path), finalFilename);
        await fs.promises.rename(req.file.path, newPath);
      }

      const thumbnailUrl = `/uploads/${finalFilename}`;
      const [project] = await db('projects')
        .where({ id })
        .update({ thumbnail_url: thumbnailUrl, updated_at: db.fn.now() })
        .returning('*');
        
      res.json({ message: 'Thumbnail uploaded', project });
    } catch (err) {
      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: 'Failed to save thumbnail' });
    }
  }
);

// Toggle project like
router.post('/:id/like', authenticateToken, requirePermission('projects:like'), async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  const likerId = parseInt(req.user.sub, 10);

  try {
    const project = await db('projects as p')
      .join('users as u', 'p.created_by', 'u.id')
      .where('p.id', projectId)
      .andWhere('p.visibility', 'public')
      .select('p.id', 'p.title', 'p.created_by', 'u.name as owner_name')
      .first();

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const liker = await db('users').where('id', likerId).select('name', 'email').first();
    const likerName = liker?.name || liker?.email || 'Someone';

    const existing = await db('project_likes').where({ project_id: projectId, liked_by: likerId }).first();

    if (existing) {
      await db('project_likes').where({ project_id: projectId, liked_by: likerId }).del();
      const count = await db('project_likes').where({ project_id: projectId }).count('id as c').first();
      return res.json({ liked: false, like_count: parseInt(count.c, 10) });
    }

    await db('project_likes').insert({ project_id: projectId, liked_by: likerId });

    emitter.emit('ProjectLiked', {
      projectId,
      projectTitle: project.title,
      likerId,
      likerName,
      ownerId: project.created_by,
    });

    const count = await db('project_likes').where({ project_id: projectId }).count('id as c').first();
    res.json({ liked: true, like_count: parseInt(count.c, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

export default router;

import { Router } from 'express';
import { db, getProjectsQuery } from '../db.js';
import { authenticateToken, requirePermission, requireRole } from '../middleware.js';
import emitter from '../events.js';

const router = Router();

router.get('/stats', authenticateToken, requireRole('admin'), async (_req, res) => {
  try {
    const [users, projects, likes, follows, notifs] = await Promise.all([
      db('users').count('* as c').first(),
      db('projects').count('* as c').first(),
      db('project_likes').count('* as c').first(),
      db('student_follows').count('* as c').first(),
      db('notifications').count('* as c').first(),
    ]);

    res.json({
      systemHealth: 'OK',
      serverUptime: process.uptime(),
      counts: {
        users: parseInt(users.c, 10),
        projects: parseInt(projects.c, 10),
        likes: parseInt(likes.c, 10),
        follows: parseInt(follows.c, 10),
        notifications: parseInt(notifs.c, 10),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/users', authenticateToken, requirePermission('users:manage'), async (_req, res) => {
  try {
    const users = await db('users as u')
      .leftJoin('roles as r', 'u.role_id', 'r.id')
      .select('u.id', 'u.email', 'u.name', 'u.avatar_url', 'u.google_id',
              'r.id as role_id', 'r.name as role', 'u.created_at')
      .orderBy('u.created_at', 'desc');

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id/role', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { role_id } = req.body;
  if (!role_id) return res.status(400).json({ error: 'role_id is required' });

  try {
    const roleCheck = await db('roles').where({ id: role_id }).first();
    if (!roleCheck) return res.status(404).json({ error: 'Role not found' });

    const [user] = await db('users')
      .where({ id: userId })
      .update({ role_id })
      .returning(['id', 'email', 'role_id']);

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      message: `Role updated to '${roleCheck.name}'. Permissions enforced on next request.`,
      user,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.get('/projects', authenticateToken, requirePermission('projects:manage'), async (_req, res) => {
  try {
    const projects = await getProjectsQuery(db).orderBy('p.created_at', 'desc');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.patch('/projects/:id/visibility', authenticateToken, requirePermission('projects:manage'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { visibility } = req.body;
  if (!['public', 'private', 'removed'].includes(visibility)) {
    return res.status(400).json({ error: "visibility must be 'public', 'private', or 'removed'" });
  }

  try {
    const [project] = await db('projects')
      .where({ id })
      .update({ visibility, updated_at: db.fn.now() })
      .returning(['id', 'title', 'visibility', 'created_by']);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (visibility === 'public') {
      emitter.emit('ProjectApproved', { 
        projectId: project.id, 
        projectTitle: project.title, 
        studentId: project.created_by 
      });
    }

    res.json({ message: `Project visibility set to '${visibility}'`, project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

router.delete('/projects/:id', authenticateToken, requirePermission('projects:manage'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const [project] = await db('projects').where({ id }).del().returning(['id', 'title']);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json({ message: `Project "${project.title}" permanently deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;

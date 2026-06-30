import jwt from 'jsonwebtoken';
import keys from './keys.js';
import { db } from './db.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, keys.publicKey, { algorithms: ['RS256'] }, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Invalid access token' });
    }

    req.user = user;
    next();
  });
};

export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    try {
      const dbCheck = await db('users as u')
        .join('role_permissions as rp', 'u.role_id', 'rp.role_id')
        .join('permissions as p', 'rp.permission_id', 'p.id')
        .where('u.id', parseInt(req.user.sub, 10))
        .andWhere('p.name', permissionName)
        .first(db.raw('1 as exists'));

      if (!dbCheck) {
        return res.status(403).json({ error: `Forbidden: Missing required permission '${permissionName}'` });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error checking permissions' });
    }
  };
};

export const requireRole = (roleName) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    try {
      const role = await db('users as u')
        .join('roles as r', 'u.role_id', 'r.id')
        .where('u.id', parseInt(req.user.sub, 10))
        .select('r.name')
        .first();

      if (!role || role.name !== roleName) {
        return res.status(403).json({ error: `Forbidden: Requires role '${roleName}'` });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error checking role' });
    }
  };
};

export const requireProjectOwnership = async (req, res, next) => {
  const projectId = parseInt(req.params.id, 10);
  const userId = parseInt(req.user.sub, 10);

  try {
    const own = await db('projects')
      .where({ id: projectId, created_by: userId })
      .first('id');

    if (!own) return res.status(403).json({ error: 'Project not found or you do not own it' });
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify project ownership' });
  }
};

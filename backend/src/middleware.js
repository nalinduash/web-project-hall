import jwt from 'jsonwebtoken';
import keys from './keys.js';
import { db } from './db.js';
import logger from './logger.js';

// In-memory blocklist for explicitly revoked active access tokens
export const tokenBlocklist = new Set();

export const revokeAccessToken = (token) => {
  if (token) {
    tokenBlocklist.add(token);
  }
};

export const authenticateToken = (req, res, next) => {
  let token = req.cookies?.access_token;
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) {
    logger.audit({
      eventType: 'AUTH_TOKEN_MISSING',
      outcome: 'REJECTED',
      ip: req.ip,
      details: { path: req.originalUrl, method: req.method },
    });
    return res.status(401).json({ error: 'Access token required' });
  }

  if (tokenBlocklist.has(token)) {
    logger.audit({
      eventType: 'AUTH_TOKEN_REVOKED',
      outcome: 'REJECTED',
      ip: req.ip,
      details: { path: req.originalUrl, method: req.method },
    });
    return res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
  }

  jwt.verify(token, keys.publicKey, { algorithms: ['RS256'] }, async (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        logger.audit({
          eventType: 'AUTH_TOKEN_EXPIRED',
          outcome: 'REJECTED',
          ip: req.ip,
          details: { path: req.originalUrl, method: req.method },
        });
        return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
      }
      logger.audit({
        eventType: 'AUTH_TOKEN_INVALID',
        outcome: 'REJECTED',
        ip: req.ip,
        details: { path: req.originalUrl, method: req.method, error: err.message },
      });
      return res.status(403).json({ error: 'Invalid access token' });
    }

    // Verify token_version against current user record in database
    if (user && user.sub) {
      try {
        const userInDb = await db('users').where({ id: parseInt(user.sub, 10) }).first('token_version');
        if (!userInDb || (user.token_version !== undefined && userInDb.token_version !== user.token_version)) {
          logger.audit({
            eventType: 'AUTH_TOKEN_REVOKED',
            outcome: 'REJECTED',
            actorId: user.sub,
            ip: req.ip,
            details: { path: req.originalUrl, method: req.method },
          });
          return res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
        }
      } catch (dbErr) {
        return res.status(500).json({ error: 'Internal error validating token session' });
      }
    }

    req.user = user;
    next();
  });
};

export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.sub) {
      logger.audit({
        eventType: 'AUTHORIZATION_UNAUTHENTICATED',
        outcome: 'REJECTED',
        ip: req.ip,
        details: { path: req.originalUrl, method: req.method },
      });
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
        logger.audit({
          eventType: 'AUTHORIZATION_FORBIDDEN',
          outcome: 'REJECTED',
          actorId: req.user?.sub,
          ip: req.ip,
          details: { requiredPermission: permissionName, path: req.originalUrl, method: req.method },
        });
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
      logger.audit({
        eventType: 'AUTHORIZATION_UNAUTHENTICATED',
        outcome: 'REJECTED',
        ip: req.ip,
        details: { path: req.originalUrl, method: req.method },
      });
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    try {
      const role = await db('users as u')
        .join('roles as r', 'u.role_id', 'r.id')
        .where('u.id', parseInt(req.user.sub, 10))
        .select('r.name')
        .first();

      if (!role || role.name !== roleName) {
        logger.audit({
          eventType: 'AUTHORIZATION_FORBIDDEN',
          outcome: 'REJECTED',
          actorId: req.user?.sub,
          ip: req.ip,
          details: { requiredRole: roleName, path: req.originalUrl, method: req.method },
        });
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
      .first(['id', 'created_by', 'visibility']);

    if (!own) {
      logger.audit({
        eventType: 'PROJECT_ACCESS_DENIED',
        outcome: 'REJECTED',
        actorId: req.user?.sub,
        ip: req.ip,
        details: { projectId, path: req.originalUrl, method: req.method },
      });
      return res.status(403).json({ error: 'Project not found or you do not own it' });
    }
    
    req.project = own;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify project ownership' });
  }
};

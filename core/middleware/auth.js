const jwt = require('jsonwebtoken');
const config = require('../config');
const database = require('../database');

// Simple 30s in-memory cache for user/role/permission lookups
const _cache = { users: new Map(), roles: new Map(), perms: new Map(), TTL: 30000 };
function cached(map, key, fn) {
  const e = map.get(key);
  if (e && Date.now() - e.t < _cache.TTL) return e.v;
  const v = fn();
  map.set(key, { v, t: Date.now() });
  return v;
}
function clearAuthCache() { _cache.users.clear(); _cache.roles.clear(); _cache.perms.clear(); }

function authMiddleware(req, res, next) {
  let token = req.headers.authorization?.replace('Bearer ', '')
    || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = cached(_cache.users, decoded.id, () =>
      database.getOne('SELECT id, username, email, full_name, role_id, branch_id, is_active, must_change_password FROM users WHERE id = ?', [decoded.id])
    );
    if (!user || !user.is_active) {
      _cache.users.delete(decoded.id);
      return res.status(401).json({ success: false, error: 'Invalid or inactive user' });
    }

    if (user.must_change_password && config.security.forceAdminPasswordChange
        && !req.path.endsWith('/change-password') && !req.path.endsWith('/logout')) {
      return res.status(403).json({ success: false, error: 'Password change required', code: 'MUST_CHANGE_PASSWORD' });
    }

    const role = cached(_cache.roles, user.role_id, () =>
      database.getOne('SELECT name, display_name FROM roles WHERE id = ?', [user.role_id])
    );
    req.user = { ...user, role: role?.name || 'staff', role_display: role?.display_name || 'Staff' };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  let token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = cached(_cache.users, decoded.id, () =>
      database.getOne('SELECT id, username, email, full_name, role_id, branch_id FROM users WHERE id = ? AND is_active = 1', [decoded.id])
    );
    if (user) {
      const role = cached(_cache.roles, user.role_id, () =>
        database.getOne('SELECT name FROM roles WHERE id = ?', [user.role_id])
      );
      req.user = { ...user, role: role?.name || 'staff' };
    }
  } catch (_) {}
  next();
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (req.user.role === 'admin') return next();

    const userPerms = cached(_cache.perms, req.user.role_id, () =>
      database.getAll(`
        SELECT p.key FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = ?
      `, [req.user.role_id]).map(r => r.key)
    );

    const hasAll = permissions.every(p => userPerms.includes(p));
    if (!hasAll) return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    next();
  };
}

module.exports = { authMiddleware, optionalAuth, requirePermission, clearAuthCache };

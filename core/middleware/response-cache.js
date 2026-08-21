/**
 * Simple in-memory response cache for read-heavy GET endpoints (dashboards etc.).
 * - Keyed by URL + user role (so role-specific views stay separate)
 * - Short TTL by default (15s)
 * - Zero invalidation complexity: entries expire, no manual bust needed for stats
 * - Only applied to GET; skips if client sends `cache-control: no-cache`
 * - Does not cache error responses
 */
const _store = new Map();

function makeKey(req) {
  const role = req.user?.role_id || req.user?.role || 'anon';
  return `${role}|${req.originalUrl || req.url}`;
}

function prune(now) {
  if (_store.size < 200) return;
  for (const [k, v] of _store) {
    if (v.expiresAt < now) _store.delete(k);
  }
}

/**
 * cacheResponse(ttlMs) — Express middleware factory.
 * Use: router.get('/dashboard', authMiddleware, cacheResponse(15000), handler)
 */
function cacheResponse(ttlMs = 15000) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    if ((req.headers['cache-control'] || '').includes('no-cache')) return next();
    const key = makeKey(req);
    const now = Date.now();
    const hit = _store.get(key);
    if (hit && hit.expiresAt > now) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(hit.status).json(hit.body);
    }
    prune(now);
    // Intercept res.json
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        _store.set(key, { body, status: res.statusCode, expiresAt: now + ttlMs });
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };
    next();
  };
}

function clearCache(pattern) {
  if (!pattern) { _store.clear(); return; }
  for (const key of _store.keys()) {
    if (key.includes(pattern)) _store.delete(key);
  }
}

module.exports = { cacheResponse, clearCache };

const database = require('../database');

const auditService = {
  log({ userId, action, entityType, entityId, details, ip }) {
    database.run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, action, entityType || null, entityId || null, JSON.stringify(details || {}), ip || null]
    );
  },

  getRecent(limit = 50, offset = 0) {
    return database.getAll(
      `SELECT al.*, u.username, u.full_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  },

  getByEntity(entityType, entityId) {
    return database.getAll(
      `SELECT al.*, u.username FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_type = ? AND al.entity_id = ?
       ORDER BY al.created_at DESC`,
      [entityType, entityId]
    );
  },

  getByUser(userId, limit = 50) {
    return database.getAll(
      `SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
  },
};

module.exports = auditService;

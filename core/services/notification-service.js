const database = require('../database');

const notificationService = {
  create({ userId, title, body, type = 'info', link = null }) {
    database.run(
      `INSERT INTO notifications (user_id, title, body, type, link) VALUES (?, ?, ?, ?, ?)`,
      [userId, title, body || '', type, link]
    );
  },

  getForUser(userId, limit = 20) {
    return database.getAll(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  },

  getUnreadCount(userId) {
    const row = database.getOne(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return row?.count || 0;
  },

  markRead(id, userId) {
    database.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
  },

  markAllRead(userId) {
    database.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  },
};

module.exports = notificationService;

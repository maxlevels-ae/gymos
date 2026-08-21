module.exports = {
  up(db) {
    const safe = (sql) => { try { db.exec(sql); } catch (_) {} };
    // Browser Web-Push subscriptions per member (one row per device/endpoint).
    safe(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      endpoint TEXT UNIQUE,
      p256dh TEXT,
      auth TEXT,
      user_agent TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    safe(`CREATE INDEX IF NOT EXISTS idx_push_sub_member ON push_subscriptions(member_id)`);
  }
};

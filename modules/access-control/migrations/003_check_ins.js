// Access check-in log for the C3-100 turnstile integration.
// Matches the repo's sql.js migration style (raw db.run). Persistence, on-disk
// flush (2s debounce + SIGINT/SIGTERM) and load-on-startup are handled by
// core/database.js — no external DB.

function ensureSetting(db, key, value, type = 'string', label = '') {
  try {
    const existing = db.exec(`SELECT id FROM settings WHERE key='${key.replace("'", "''")}'`);
    if (!existing.length || !existing[0].values.length) {
      db.run('INSERT INTO settings (key, value, type, module, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
        [key, String(value), type, 'access-control', label]);
    }
  } catch (_) {}
}

module.exports.up = function (db) {
  db.run(`CREATE TABLE IF NOT EXISTS check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER,
    panel_sn TEXT DEFAULT '',
    door_no INTEGER DEFAULT 1,
    card_no TEXT DEFAULT '',
    event_type TEXT DEFAULT '',
    scanned_at TEXT DEFAULT (datetime('now')),
    allowed INTEGER DEFAULT 0,
    reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_check_ins_member ON check_ins(member_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_check_ins_scanned ON check_ins(scanned_at)`);

  // Settings for the Python microservice bridge.
  ensureSetting(db, 'access_control.c3_service_url', '', 'string', 'C3 Microservice URL');
  ensureSetting(db, 'access_control.c3_service_key', '', 'string', 'C3 Microservice API Key');
  ensureSetting(db, 'access_control.c3_service_enabled', 'false', 'boolean', 'Enable C3 Turnstile Bridge');
  ensureSetting(db, 'access_control.c3_token_secret', '', 'string', 'QR Token HMAC Secret (shared with app)');
};

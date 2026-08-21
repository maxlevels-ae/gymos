
function ensureSetting(db, key, value, type='string', module='access-control', label='') {
  try {
    const existing = db.exec(`SELECT id FROM settings WHERE key='${key.replace("'", "''")}'`);
    if (!existing.length || !existing[0].values.length) {
      db.run('INSERT INTO settings (key, value, type, module, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))', [key, String(value), type, module, label]);
    }
  } catch (_) {}
}

module.exports.up = function (db) {
  db.run(`CREATE TABLE IF NOT EXISTS access_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    display_name TEXT NOT NULL,
    member_id INTEGER,
    status TEXT DEFAULT 'active',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS access_fingerprint_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id INTEGER NOT NULL,
    template_b64 TEXT NOT NULL,
    template_size INTEGER DEFAULT 0,
    quality INTEGER DEFAULT 0,
    scan_index INTEGER DEFAULT 0,
    source TEXT DEFAULT 'bridge',
    is_merged INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (identity_id) REFERENCES access_identities(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS access_enrollment_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id INTEGER NOT NULL,
    session_key TEXT UNIQUE NOT NULL,
    scan1_b64 TEXT DEFAULT '',
    scan2_b64 TEXT DEFAULT '',
    scan3_b64 TEXT DEFAULT '',
    scan1_quality INTEGER DEFAULT 0,
    scan2_quality INTEGER DEFAULT 0,
    scan3_quality INTEGER DEFAULT 0,
    status TEXT DEFAULT 'collecting',
    merged_template_b64 TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (identity_id) REFERENCES access_identities(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS access_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    device_type TEXT DEFAULT 'fingerprint',
    connection_type TEXT DEFAULT 'bridge',
    bridge_url TEXT DEFAULT '',
    gate_open_url TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    settings_json TEXT DEFAULT '{}',
    last_seen_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS access_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_id INTEGER,
    member_id INTEGER,
    event_type TEXT DEFAULT 'verify',
    direction TEXT DEFAULT 'entry',
    result TEXT DEFAULT 'unknown',
    score INTEGER DEFAULT 0,
    message TEXT DEFAULT '',
    raw_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (identity_id) REFERENCES access_identities(id) ON DELETE SET NULL,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_access_identities_member ON access_identities(member_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_access_templates_identity ON access_fingerprint_templates(identity_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_access_events_member ON access_events(member_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_access_events_identity ON access_events(identity_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_access_events_created ON access_events(created_at)`);

  ensureSetting(db, 'access_control.bridge_url', 'http://localhost:7001', 'string', 'access-control', 'ZK4500 Bridge URL');
  ensureSetting(db, 'access_control.score_threshold', '45', 'number', 'access-control', 'Score Threshold');
  ensureSetting(db, 'access_control.gate_provider', 'mock', 'string', 'access-control', 'Gate Provider');
  ensureSetting(db, 'access_control.gate_open_url', '', 'string', 'access-control', 'Webhook Gate Open URL');
  ensureSetting(db, 'access_control.gate_secret', '', 'string', 'access-control', 'Webhook Gate Secret');
  ensureSetting(db, 'access_control.allow_member_checkin', 'true', 'boolean', 'access-control', 'Create Attendance on Success');
  ensureSetting(db, 'access_control.c3_panel_ip', '192.168.1.201', 'string', 'access-control', 'C3-100 Panel IP');
  ensureSetting(db, 'access_control.c3_panel_port', '4370', 'number', 'access-control', 'C3-100 TCP Port');
  ensureSetting(db, 'access_control.c3_door_number', '1', 'number', 'access-control', 'C3-100 Door Number');
  ensureSetting(db, 'access_control.c3_open_duration', '5', 'number', 'access-control', 'C3-100 Open Duration (sec)');
  ensureSetting(db, 'access_control.c3_password', '', 'string', 'access-control', 'C3-100 Password');
};

module.exports.down = function (db) {
  db.run('DROP TABLE IF EXISTS access_events');
  db.run('DROP TABLE IF EXISTS access_devices');
  db.run('DROP TABLE IF EXISTS access_enrollment_sessions');
  db.run('DROP TABLE IF EXISTS access_fingerprint_templates');
  db.run('DROP TABLE IF EXISTS access_identities');
};

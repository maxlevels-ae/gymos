function ensureSetting(db, key, value, type='string', module='qr-registration', label='') {
  try {
    const escaped = String(key || '').replace(/'/g, "''");
    const existing = db.exec(`SELECT id FROM settings WHERE key='${escaped}'`);
    if (!existing.length || !existing[0].values.length) {
      db.run(
        'INSERT INTO settings (key, value, type, module, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
        [key, String(value), type, module, label]
      );
    }
  } catch (_) {}
}

module.exports.up = function (db) {
  db.run(`CREATE TABLE IF NOT EXISTS qr_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    gender TEXT DEFAULT '',
    dob TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    preferred_plan TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    member_id INTEGER,
    approved_by INTEGER,
    approved_at TEXT,
    rejected_by INTEGER,
    rejected_at TEXT,
    rejection_reason TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_qr_registrations_phone ON qr_registrations(phone)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_qr_registrations_status ON qr_registrations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_qr_registrations_created ON qr_registrations(created_at)`);

  ensureSetting(db, 'qr_registration.enabled', 'true', 'boolean', 'qr-registration', 'Enable Public QR Registration');
  ensureSetting(db, 'qr_registration.pwa_link', '/member/', 'string', 'qr-registration', 'Member App Link');
  ensureSetting(db, 'qr_registration.ios_video_link', '', 'string', 'qr-registration', 'iPhone Install Video Link');
  ensureSetting(db, 'qr_registration.android_video_link', '', 'string', 'qr-registration', 'Android Install Video Link');
  ensureSetting(db, 'qr_registration.rate_limit_per_hour', '5', 'number', 'qr-registration', 'Rate Limit Per Hour');
  ensureSetting(
    db,
    'qr_registration.whatsapp_template_registration',
    'Thank you {member_name} for registering with {gym_name} 💪\n\nYour request has been received and is under review.\nWe will notify you once your registration is approved.\n\nWelcome to our gym! 🏋️',
    'string',
    'qr-registration',
    'Registration Received Template'
  );
  ensureSetting(
    db,
    'qr_registration.whatsapp_template_approval',
    'Hi {member_name} 👋\n\nYour registration with {gym_name} has been approved ✅\n\nYou can now access our system and track your membership.\n\n📲 Download the app:\n{pwa_link}\n\n📱 iPhone users:\nWatch how to install:\n{ios_video_link}\n\n🤖 Android users:\nWatch how to install:\n{android_video_link}\n\nWelcome again 💪',
    'string',
    'qr-registration',
    'Approval Template'
  );
};

module.exports.down = function (db) {
  db.run('DROP TABLE IF EXISTS qr_registrations');
};

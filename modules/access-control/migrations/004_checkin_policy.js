// Reception check-in popup + debt policy settings.
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
  ensureSetting(db, 'access_control.checkin_popup_enabled', 'true', 'boolean', 'Reception Check-in Popup');
  ensureSetting(db, 'access_control.debt_alert_threshold', '0', 'number', 'Debt Alert Threshold');
  ensureSetting(db, 'access_control.debt_block_enabled', 'false', 'boolean', 'Block Entry on Debt');
  ensureSetting(db, 'access_control.debt_block_threshold', '0', 'number', 'Debt Block Threshold');
  ensureSetting(db, 'access_control.debt_block_grace_days', '0', 'number', 'Debt Block Grace Days');
};

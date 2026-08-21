module.exports = {
  up(db) {
    db.exec(`
      INSERT OR IGNORE INTO settings (key, value, type, module, label) VALUES
        ('cafeteria.super_admin_pos_password', '', 'string', 'cafeteria', 'Super Admin POS Password');
    `);
  }
};

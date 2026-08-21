module.exports = {
  up(db) {
    const safe = (sql) => { try { db.run(sql); } catch (_) {} };
    const hasColumn = (table, column) => {
      try {
        const rows = db.prepare(`PRAGMA table_info(${table})`).all();
        return rows.some((row) => row.name === column);
      } catch (_) { return false; }
    };

    if (!hasColumn('cafeteria_orders', 'is_refund')) safe(`ALTER TABLE cafeteria_orders ADD COLUMN is_refund INTEGER DEFAULT 0`);
    if (!hasColumn('cafeteria_orders', 'original_order_id')) safe(`ALTER TABLE cafeteria_orders ADD COLUMN original_order_id INTEGER`);

    safe(`CREATE INDEX IF NOT EXISTS idx_caf_orders_original_order ON cafeteria_orders(original_order_id)`);

    safe(`INSERT OR IGNORE INTO settings (key, value, type, module, label) VALUES ('cafeteria.super_admin_pos_password', '', 'string', 'cafeteria', 'Super Admin POS Password')`);
  }
};

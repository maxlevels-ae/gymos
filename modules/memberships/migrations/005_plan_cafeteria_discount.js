module.exports = {
  up(db) {
    const safe = (sql) => { try { db.exec(sql); } catch (_) {} };
    // Percentage discount a plan grants its members at the cafeteria POS.
    safe(`ALTER TABLE membership_plans ADD COLUMN cafeteria_discount_percent REAL DEFAULT 0`);
  }
};

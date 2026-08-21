module.exports = {
  up(db) {
    const run = (sql) => {
      try { db.exec(sql); } catch (err) {
        const msg = String(err && err.message || err);
        if (!msg.includes('duplicate column name')) throw err;
      }
    };

    run("ALTER TABLE members ADD COLUMN middle_name TEXT DEFAULT '';");
    run("ALTER TABLE members ADD COLUMN middle_name_ar TEXT DEFAULT '';");
    run("CREATE INDEX IF NOT EXISTS idx_members_middle_name ON members(middle_name);");
  }
};

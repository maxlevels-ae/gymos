// Add retry tracking to the automation log
module.exports = { up(db) {
  const run = (s) => { try { db.run(s); } catch (_) { /* column may already exist */ } };
  run("ALTER TABLE automation_log ADD COLUMN attempts INTEGER DEFAULT 1");
  run("ALTER TABLE automation_log ADD COLUMN retryable INTEGER DEFAULT 0");
} };

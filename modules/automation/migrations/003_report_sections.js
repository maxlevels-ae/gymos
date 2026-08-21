// Configurable content sections for the weekly report
module.exports = { up(db) {
  const run = (s, p) => { try { db.run(s, p); } catch (_) {} };
  run("ALTER TABLE automation_rules ADD COLUMN report_sections TEXT DEFAULT '[\"active_members\",\"expiring\",\"revenue\"]'");
  // Give the existing weekly-report rule a sensible default selection.
  run("UPDATE automation_rules SET report_sections = '[\"active_members\",\"new_members\",\"expiring\",\"revenue\",\"debts\"]' WHERE trigger='weekly_report' AND (report_sections IS NULL OR report_sections='')");
} };

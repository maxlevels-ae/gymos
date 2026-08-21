module.exports = function up(db) { try { db.run('DROP INDEX IF EXISTS idx_memberships_member_unique'); } catch (_) {} };

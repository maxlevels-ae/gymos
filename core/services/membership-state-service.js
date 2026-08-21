/**
 * Centralized membership state synchronization service.
 * Replaces duplicated logic in: members/routes.js, access-control/routes.js,
 * attendance/routes.js, and core/routes.js.
 */
const database = require('../database');

function todayDateOnly() {
  try {
    return database.getOne("SELECT date('now','localtime') AS d")?.d || new Date().toISOString().slice(0, 10);
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function computeStatus(row, today) {
  if (!row) return 'inactive';
  if (row.cancelled_at || row.status === 'cancelled') return 'cancelled';
  if (row.status === 'frozen') return 'frozen';
  if (row.end_date && String(row.end_date).slice(0, 10) < today) return 'expired';
  if (row.status === 'scheduled' && row.start_date && String(row.start_date).slice(0, 10) <= today
      && (!row.end_date || String(row.end_date).slice(0, 10) >= today)) return 'active';
  return row.status || 'inactive';
}

const membershipStateService = {
  todayDateOnly,
  computeStatus,

  /**
   * Sync all membership statuses for a member and update the member's status accordingly.
   * This is the SINGLE SOURCE OF TRUTH for membership/member state transitions.
   */
  syncMember(memberId) {
    const today = todayDateOnly();
    try {
      // Expire overdue memberships
      database.run(
        `UPDATE memberships SET status='expired', updated_at=datetime('now')
         WHERE member_id=? AND status NOT IN ('cancelled','frozen','expired')
         AND end_date IS NOT NULL AND date(end_date) < date(?)`,
        [memberId, today]
      );
      // Activate scheduled memberships that have started
      database.run(
        `UPDATE memberships SET status='active', updated_at=datetime('now')
         WHERE member_id=? AND status='scheduled'
         AND date(start_date) <= date(?) AND (end_date IS NULL OR date(end_date) >= date(?))`,
        [memberId, today, today]
      );

      // Determine member-level status
      const stats = database.getOne(`
        SELECT
          SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN status='frozen' THEN 1 ELSE 0 END) AS frozen_count,
          SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) AS scheduled_count
        FROM memberships WHERE member_id = ?
      `, [memberId]) || {};

      let memberStatus = 'inactive';
      if (Number(stats.active_count || 0) > 0) memberStatus = 'active';
      else if (Number(stats.frozen_count || 0) > 0) memberStatus = 'frozen';

      // Respect an explicit admin deactivation: if a member was manually set to
      // 'inactive', never auto-reactivate here just because a membership row is
      // active. Real activation paths (create/renew/pay a membership) set
      // status='active' directly, so genuine members still activate correctly.
      const current = database.getOne('SELECT status FROM members WHERE id=?', [memberId])?.status || '';
      if (current === 'inactive' && memberStatus === 'active') return current;

      database.run(
        `UPDATE members SET status=?, updated_at=datetime('now') WHERE id=? AND COALESCE(status,'') <> ?`,
        [memberStatus, memberId, memberStatus]
      );

      return memberStatus;
    } catch (_) {
      return 'inactive';
    }
  },

  /** Decorate a membership row with computed effective status and amounts */
  decorateMembership(ms) {
    if (!ms) return null;
    const today = todayDateOnly();
    const effectiveStatus = computeStatus(ms, today);
    // Compute totals using same logic as memberships service getMembershipTotals
    const total = Math.max(0, Number(ms.total_amount || 0) || (Number(ms.price || 0) + Number(ms.signup_fee || 0) - Number(ms.discount || 0)));
    const paid = Number(ms.paid_amount || ms.total_paid || 0);
    const balance = Math.max(0, Number(ms.balance_amount || ms.outstanding_amount || ms.balance_due || (total - paid) || 0));
    const payment_status = ms.payment_status || (balance <= 0.0001 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'));
    return {
      ...ms,
      effective_status: effectiveStatus,
      status: effectiveStatus,
      total_amount: total,
      paid_amount: paid,
      balance_amount: balance,
      outstanding_amount: balance,
      payment_status,
    };
  },

  /** Pick the "current" (most relevant) membership from a list */
  pickCurrent(memberships) {
    const rows = (memberships || []).map(ms => this.decorateMembership(ms));
    return rows.find(ms => ms?.status === 'active')
      || rows.find(ms => ms?.status === 'frozen')
      || rows.find(ms => ms?.status === 'scheduled')
      || rows.find(ms => ms?.status === 'expired')
      || rows[0] || null;
  },
};

module.exports = membershipStateService;

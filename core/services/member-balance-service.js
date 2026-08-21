'use strict';
// Single source of truth for a member's outstanding balance. These are the SAME
// queries the members `/:id/balance` endpoint and the renewal/payments screens
// use — cafeteria unpaid + memberships.balance_due + unpaid freezes. Do not fork
// this calculation; both the members endpoint and the access-control decision
// call in here.
const database = require('../database');
const db = database;
const n = (v) => Number(v || 0);

function getOutstanding(memberId) {
  let cafeteria = 0, cafeteriaCount = 0, memberships = 0, membershipCount = 0, freezes = 0, freezeCount = 0;
  try {
    const c = db.getOne("SELECT COALESCE(SUM(total - COALESCE(paid_total,0)),0) s, COUNT(*) c FROM cafeteria_orders WHERE member_id = ? AND status NOT IN ('void','draft','cancelled','refunded') AND (total - COALESCE(paid_total,0)) > 0.009", [memberId]);
    cafeteria = n(c && c.s); cafeteriaCount = n(c && c.c);
  } catch (_) {}
  try {
    const m = db.getOne("SELECT COALESCE(SUM(balance_due),0) s, COUNT(*) c FROM memberships WHERE member_id = ? AND COALESCE(balance_due,0) > 0.009", [memberId]);
    memberships = n(m && m.s); membershipCount = n(m && m.c);
  } catch (_) {}
  try {
    const f = db.getOne(`SELECT COALESCE(SUM(fr.price - COALESCE(fp.paid,0)),0) s, COUNT(*) c
      FROM freeze_requests fr
      LEFT JOIN (SELECT freeze_id, SUM(CASE WHEN direction='out' THEN -amount ELSE amount END) paid FROM freeze_payments WHERE status='completed' GROUP BY freeze_id) fp ON fp.freeze_id = fr.id
      WHERE fr.member_id = ? AND fr.status NOT IN ('cancelled') AND (fr.price - COALESCE(fp.paid,0)) > 0.009`, [memberId]);
    freezes = n(f && f.s); freezeCount = n(f && f.c);
  } catch (_) {}
  return {
    total: Number((cafeteria + memberships + freezes).toFixed(3)),
    cafeteria, cafeteriaCount, memberships, membershipCount, freezes, freezeCount,
  };
}

// Oldest unpaid record's created_at (ISO-ish string) — origin of the debt, for
// the grace-period aging. Null when the member owes nothing.
function getOldestUnpaidDate(memberId) {
  const dates = [];
  const pick = (sql) => { try { const r = db.getOne(sql, [memberId]); if (r && r.d) dates.push(String(r.d)); } catch (_) {} };
  pick("SELECT MIN(created_at) d FROM memberships WHERE member_id=? AND COALESCE(balance_due,0) > 0.009");
  pick("SELECT MIN(created_at) d FROM cafeteria_orders WHERE member_id=? AND status NOT IN ('void','draft','cancelled','refunded') AND (total - COALESCE(paid_total,0)) > 0.009");
  pick("SELECT MIN(created_at) d FROM freeze_requests fr LEFT JOIN (SELECT freeze_id, SUM(CASE WHEN direction='out' THEN -amount ELSE amount END) paid FROM freeze_payments WHERE status='completed' GROUP BY freeze_id) fp ON fp.freeze_id = fr.id WHERE member_id=? AND fr.status NOT IN ('cancelled') AND (fr.price - COALESCE(fp.paid,0)) > 0.009");
  if (!dates.length) return null;
  return dates.sort()[0]; // lexical min works for ISO 'YYYY-MM-DD[ HH:MM:SS]'
}

// Whole days since the debt was incurred. Null if no debt / undatable.
function debtAgeDays(memberId, todayDate) {
  const oldest = getOldestUnpaidDate(memberId);
  if (!oldest) return null;
  const start = Date.parse(oldest.slice(0, 10) + 'T00:00:00');
  const today = Date.parse(String(todayDate).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(start) || Number.isNaN(today)) return null;
  return Math.max(0, Math.floor((today - start) / 86400000));
}

module.exports = { getOutstanding, getOldestUnpaidDate, debtAgeDays };

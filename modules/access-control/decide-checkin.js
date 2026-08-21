'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Pure check-in decision. Takes gathered FACTS + SETTINGS, returns the decision.
// No DB / no I/O → fully unit-testable. The reception popup only renders what
// this decided; it never re-decides client-side.
//
// Matrix (evaluated in order — expired is ALWAYS denied, regardless of debt cfg):
//   1. not found / invalid token .................. DENY  reason='unknown'  state='unknown'
//   2. expired (or no current subscription) ....... DENY  reason='expired'  state='expired'
//   3. debt_block_enabled & balance > block_thr
//        & not within grace ...................... DENY  reason='debt_blocked' state='blocked'
//   4. balance > alert_thr ........................ ALLOW reason='debt_alert'  state='debt'
//   5. otherwise .................................. ALLOW reason='ok'          state='active'
//
// Thresholds are STRICTLY greater-than: balance exactly at the threshold passes.
// Negative balance (account credit) never trips alert or block.
// ─────────────────────────────────────────────────────────────────────────────
const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const int = (v, d = 0) => { const x = parseInt(v, 10); return Number.isFinite(x) ? x : d; };
const round3 = (v) => Number(n(v).toFixed(3));
const dateOnly = (v) => String(v || '').slice(0, 10);
const R = (allowed, reason, state, debt) => ({ allowed, reason, state, debt });

function decideCheckin(facts, settings) {
  const alertT  = n(settings && settings.debtAlertThreshold, 0);
  const blockOn = !!(settings && settings.debtBlockEnabled);
  const blockT  = n(settings && settings.debtBlockThreshold, 0);
  const grace   = int(settings && settings.debtBlockGraceDays, 0);
  const balance = round3(facts && facts.balance);

  // 1) invalid credential / member not found
  if (!facts || !facts.found) return R(false, 'unknown', 'unknown', balance);

  // 2) expired — no current subscription, or end_date strictly before today.
  //    end_date === today is NOT expired (ending today still allows entry).
  const expired = !facts.hasMembership ||
    (facts.endDate ? dateOnly(facts.endDate) < dateOnly(facts.today) : false);
  if (expired) return R(false, 'expired', 'expired', balance);

  // 3) configurable debt block — strictly over the threshold, outside grace.
  if (blockOn && balance > blockT) {
    const inGrace = grace > 0 && facts.debtAgeDays != null && facts.debtAgeDays <= grace;
    if (!inGrace) return R(false, 'debt_blocked', 'blocked', balance);
  }

  // 4) debt alert — allowed, reception warned to collect.
  if (balance > alertT) return R(true, 'debt_alert', 'debt', balance);

  // 5) clean entry
  return R(true, 'ok', 'active', balance);
}

module.exports = { decideCheckin };

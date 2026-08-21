// Unit tests for the check-in decision matrix + debt policy.
// Run:  node modules/access-control/decide-checkin.test.js
'use strict';
const assert = require('node:assert');
const { decideCheckin } = require('./decide-checkin');

const TODAY = '2026-07-08';
// base facts: found member with an active subscription ending in the future, no debt
const base = { found: true, hasMembership: true, endDate: '2026-08-01', today: TODAY, balance: 0, debtAgeDays: null };
const noBlock = { debtAlertThreshold: 0, debtBlockEnabled: false, debtBlockThreshold: 0, debtBlockGraceDays: 0 };

let pass = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const dec = (f, s) => decideCheckin(f, s);

// ── core states ──────────────────────────────────────────────────────────────
test('unknown: member not found → deny', () => {
  const r = dec({ found: false, today: TODAY, balance: 0 }, noBlock);
  assert.deepStrictEqual([r.allowed, r.reason, r.state], [false, 'unknown', 'unknown']);
});

test('expired: end_date before today → deny (even with zero debt)', () => {
  const r = dec({ ...base, endDate: '2026-06-30' }, noBlock);
  assert.deepStrictEqual([r.allowed, r.reason, r.state], [false, 'expired', 'expired']);
});

test('expired: no current subscription → deny', () => {
  const r = dec({ ...base, hasMembership: false }, noBlock);
  assert.deepStrictEqual([r.allowed, r.reason], [false, 'expired']);
});

test('EDGE ending today → allow (not expired)', () => {
  const r = dec({ ...base, endDate: TODAY, balance: 0 }, noBlock);
  assert.deepStrictEqual([r.allowed, r.reason, r.state], [true, 'ok', 'active']);
});

test('active + no debt → allow ok', () => {
  const r = dec({ ...base, balance: 0 }, noBlock);
  assert.deepStrictEqual([r.allowed, r.reason, r.state], [true, 'ok', 'active']);
});

// ── alert (block OFF) ────────────────────────────────────────────────────────
test('block disabled + debt → allow with debt_alert', () => {
  const r = dec({ ...base, balance: 25 }, noBlock);
  assert.deepStrictEqual([r.allowed, r.reason, r.state], [true, 'debt_alert', 'debt']);
  assert.strictEqual(r.debt, 25);
});

test('EDGE negative balance (credit) → allow ok, no alert', () => {
  const r = dec({ ...base, balance: -5 }, { ...noBlock, debtAlertThreshold: 0 });
  assert.deepStrictEqual([r.allowed, r.reason], [true, 'ok']);
});

test('alert threshold respected (>, strictly)', () => {
  const s = { ...noBlock, debtAlertThreshold: 10 };
  assert.strictEqual(dec({ ...base, balance: 10 }, s).reason, 'ok');       // == threshold → no alert
  assert.strictEqual(dec({ ...base, balance: 10.5 }, s).reason, 'debt_alert');
});

// ── block policy ON ──────────────────────────────────────────────────────────
const block20 = { debtAlertThreshold: 0, debtBlockEnabled: true, debtBlockThreshold: 20, debtBlockGraceDays: 0 };

test('block enabled + debt UNDER threshold → allow with alert', () => {
  const r = dec({ ...base, balance: 15 }, block20);
  assert.deepStrictEqual([r.allowed, r.reason, r.state], [true, 'debt_alert', 'debt']);
});

test('block enabled + debt OVER threshold → deny debt_blocked', () => {
  const r = dec({ ...base, balance: 25 }, block20);
  assert.deepStrictEqual([r.allowed, r.reason, r.state], [false, 'debt_blocked', 'blocked']);
});

test('EDGE exactly at block threshold → allow (strictly-greater rule)', () => {
  const r = dec({ ...base, balance: 20 }, block20);
  assert.strictEqual(r.allowed, true);          // 20 > 20 is false → not blocked
  assert.strictEqual(r.reason, 'debt_alert');   // but 20 > alert(0) → still alerts
});

test('over threshold but WITHIN grace → allow with alert', () => {
  const s = { ...block20, debtBlockGraceDays: 7 };
  const r = dec({ ...base, balance: 25, debtAgeDays: 3 }, s);
  assert.deepStrictEqual([r.allowed, r.reason], [true, 'debt_alert']);
});

test('over threshold and BEYOND grace → deny', () => {
  const s = { ...block20, debtBlockGraceDays: 7 };
  const r = dec({ ...base, balance: 25, debtAgeDays: 10 }, s);
  assert.deepStrictEqual([r.allowed, r.reason], [false, 'debt_blocked']);
});

test('grace configured but debt age unknown → no grace, deny', () => {
  const s = { ...block20, debtBlockGraceDays: 7 };
  const r = dec({ ...base, balance: 25, debtAgeDays: null }, s);
  assert.strictEqual(r.reason, 'debt_blocked');
});

test('expired outranks debt policy (blocked never reached)', () => {
  const r = dec({ ...base, hasMembership: false, balance: 25 }, block20);
  assert.strictEqual(r.reason, 'expired');
});

console.log(`\n${pass} passed` + (process.exitCode ? ' (with failures)' : ''));

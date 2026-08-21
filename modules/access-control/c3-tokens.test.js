// Unit tests for the access-token logic (Node bridge = authoritative validator).
// No framework — run directly:  node modules/access-control/c3-tokens.test.js
// Mirrors services/c3-access/tests/test_tokens.py so both sides stay in lock-step.
'use strict';

const assert = require('node:assert');
const t = require('./c3-tokens');

const S = 'unit-test-secret';
const NOW = 1720000000000;            // fixed ms so windows are deterministic
const W = t.windowOf(NOW);

let pass = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

// ── full token (Mode B) ──────────────────────────────────────────────────────
test('roundtrip: issued token validates', () => {
  const v = t.validateToken(S, t.issueToken(S, 7, NOW), NOW);
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.memberId, 7);
  assert.strictEqual(v.reason, 'ok');
});

test('replay TTL equals remaining lifetime (not fixed 30s)', () => {
  const v = t.validateToken(S, t.issueToken(S, 7, NOW), NOW);
  // window valid until (W + skew + 1) * 30000; here skew=1 → up to 2 windows ahead
  const expected = (W + t.SKEW_WINDOWS + 1) * t.WINDOW_MS - NOW;
  assert.strictEqual(v.replayTtlMs, expected);
  assert.ok(v.replayTtlMs > 0 && v.replayTtlMs <= (t.SKEW_WINDOWS + 2) * t.WINDOW_MS);
  assert.strictEqual(v.replayNonce, `tok:7.${W}`);
});

test('skew: previous/next window still accepted', () => {
  assert.strictEqual(t.validateToken(S, t.issueToken(S, 7, NOW - t.WINDOW_MS), NOW).ok, true);
  assert.strictEqual(t.validateToken(S, t.issueToken(S, 7, NOW + t.WINDOW_MS), NOW).ok, true);
});

test('expired: window beyond skew rejected', () => {
  const old = `7.${W - 5}.${t.issueToken(S, 7, (W - 5) * t.WINDOW_MS).split('.')[2]}`;
  assert.strictEqual(t.validateToken(S, old, NOW).reason, 'expired');
});

test('forged signature rejected', () => {
  assert.strictEqual(t.validateToken(S, `7.${W}.deadbeefdeadbeef`, NOW).reason, 'bad_signature');
});

test('wrong secret rejected', () => {
  assert.strictEqual(t.validateToken('other-secret', t.issueToken(S, 7, NOW), NOW).ok, false);
});

test('malformed token rejected', () => {
  for (const bad of ['', 'x', '7.abc', '7.100', 'a.b.c.d']) {
    assert.strictEqual(t.validateToken(S, bad, NOW).ok, false, `should reject "${bad}"`);
  }
});

// ── Wiegand-26 rotating code (Mode A) ────────────────────────────────────────
test('code24 always fits 24 bits', () => {
  for (let m = 1; m <= 2000; m++) {
    const c = t.code24(S, m, W);
    assert.ok(c >= 0 && c <= t.WIEGAND24_MAX, `member ${m} → ${c} out of 24-bit range`);
  }
});

test('resolveCode24 identifies the owning member', () => {
  const active = [3, 11, 42, 99, 512];
  const card = t.code24(S, 42, W);
  const r = t.resolveCode24(S, card, NOW, active);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.memberId, 42);
  assert.strictEqual(r.replayNonce, `wg:42.${W}`);
});

test('resolveCode24 tolerates skew window', () => {
  const active = [42];
  const cardPrev = t.code24(S, 42, W - 1);
  assert.strictEqual(t.resolveCode24(S, cardPrev, NOW, active).ok, true);
});

test('resolveCode24 rejects unknown / out-of-range', () => {
  assert.strictEqual(t.resolveCode24(S, 12345, NOW, [1, 2, 3]).reason, 'no_match');
  assert.strictEqual(t.resolveCode24(S, 99999999, NOW, [1]).reason, 'not_wiegand24');   // > 24-bit
  assert.strictEqual(t.resolveCode24(S, -1, NOW, [1]).reason, 'not_wiegand24');
  assert.strictEqual(t.resolveCode24(S, 'abc', NOW, [1]).reason, 'not_wiegand24');
});

console.log(`\n${pass} passed` + (process.exitCode ? ' (with failures)' : ''));

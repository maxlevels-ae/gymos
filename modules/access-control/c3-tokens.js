// ─────────────────────────────────────────────────────────────────────────────
// Rotating access tokens — Node mirror of services/c3-access/app/tokens.py.
// The HMAC token is the SOURCE OF TRUTH for access; the panel allowlist is only
// an offline fallback (see c3-service.js).
//
// Two physical reader paths, one shared secret:
//
//  MODE B — "full token" (reader in HTTP / keyboard-wedge mode)
//    The whole string `${member}.${window}.${sig}` reaches the bridge intact and
//    is verified directly (HMAC + window + replay). Preferred when possible.
//
//  MODE A — "Wiegand-26" (Sunlux QR reader → Wiegand → C3 panel → SSE)
//    Wiegand-26 carries 24 usable data bits, so ONLY a number < 16,777,216 can
//    survive the wire. A 256-bit HMAC token cannot fit. So the QR for a Wiegand
//    turnstile encodes a 24-BIT ROTATING CODE DERIVED FROM THE HMAC:
//
//        code24(member, window) = first 3 bytes (24 bits) of
//                                 HMAC-SHA256(secret, "wg:<member>.<window>")
//
//    ── THIS is where the token "maps to a number that fits on Wiegand-26": the
//    derivation is the truncation. We take digest[0:3] as a big-endian uint, so
//    the result is 0..16,777,215 BY CONSTRUCTION — it can never exceed 24 bits.
//    The secret stays server-side; the member app fetches the current code24 to
//    render its QR (it does not hold the secret). It rotates every window (~30s).
//
//    On read we don't "decode" a 24-bit number — we RECOMPUTE code24 for every
//    active member across the accepted windows and match. A hit simultaneously
//    proves HMAC authenticity, pins the time window, and identifies the member.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const crypto = require('crypto');

const WINDOW_MS = 30000;               // rotation period — must match tokens.py
const SKEW_WINDOWS = 1;                // accept ±1 window for clock skew / scan lag
const WIEGAND24_MAX = 0xFFFFFF;        // 16,777,215 — Wiegand-26 = 24 usable bits

const windowOf = (nowMs) => Math.floor(nowMs / WINDOW_MS);
const hmac = (secret, msg) => crypto.createHmac('sha256', String(secret)).update(msg).digest();

function timingEq(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Last real-time instant a token/code minted in `window` can still be accepted.
// Used both to bound validation and to size the replay TTL (point 3): a replay
// entry lives exactly as long as the token could still be replayed, no more.
const validUntilMs = (window) => (window + SKEW_WINDOWS + 1) * WINDOW_MS;

// ── MODE B: full string token ────────────────────────────────────────────────
function signHex(secret, member, window) {
  return hmac(secret, `tok:${member}.${window}`).toString('hex').slice(0, 16);
}
function issueToken(secret, memberId, nowMs) {
  const w = windowOf(nowMs);
  return `${memberId}.${w}.${signHex(secret, memberId, w)}`;
}
// → { ok, memberId, window, reason, replayNonce, replayTtlMs }
function validateToken(secret, token, nowMs) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const memberId = Number(parts[0]);
  const w = Number(parts[1]);
  const sig = parts[2];
  if (!Number.isInteger(memberId) || !Number.isInteger(w)) return { ok: false, reason: 'malformed' };
  if (Math.abs(w - windowOf(nowMs)) > SKEW_WINDOWS) return { ok: false, reason: 'expired' };
  if (!timingEq(sig, signHex(secret, memberId, w))) return { ok: false, reason: 'bad_signature' };
  return {
    ok: true, memberId, window: w, reason: 'ok',
    replayNonce: `tok:${memberId}.${w}`,
    replayTtlMs: Math.max(0, validUntilMs(w) - nowMs),
  };
}

// ── MODE A: 24-bit Wiegand rotating code ─────────────────────────────────────
// Enforce the Wiegand constraint at GENERATION: the value is derived to fit.
function code24(secret, memberId, window) {
  const n = hmac(secret, `wg:${memberId}.${window}`).readUIntBE(0, 3); // digest[0:3] → 24 bits
  return n & WIEGAND24_MAX;                                            // belt & suspenders
}
function isWiegand24(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= WIEGAND24_MAX;
}
// Recompute-and-match a scanned 24-bit card value against active members.
// activeMemberIds: number[] (kept small — only members with an active membership).
// → { ok, memberId, window, reason, replayNonce, replayTtlMs }
function resolveCode24(secret, cardValue, nowMs, activeMemberIds) {
  if (!isWiegand24(cardValue)) return { ok: false, reason: 'not_wiegand24' };
  const target = Number(cardValue);
  const wNow = windowOf(nowMs);
  for (let dw = -SKEW_WINDOWS; dw <= SKEW_WINDOWS; dw++) {
    const w = wNow + dw;
    for (const m of activeMemberIds) {
      if (code24(secret, m, w) === target) {
        return {
          ok: true, memberId: m, window: w, reason: 'ok',
          replayNonce: `wg:${m}.${w}`,
          replayTtlMs: Math.max(0, validUntilMs(w) - nowMs),
        };
      }
    }
  }
  return { ok: false, reason: 'no_match' };
}

module.exports = {
  WINDOW_MS, SKEW_WINDOWS, WIEGAND24_MAX,
  windowOf, issueToken, validateToken,
  code24, isWiegand24, resolveCode24,
};

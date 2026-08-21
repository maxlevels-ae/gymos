// ─────────────────────────────────────────────────────────────────────────────
// C3 Turnstile Bridge — GymOS (Express + sql.js) ↔ Python C3 microservice.
//
// Design ↔ constraints:
//  • PERSISTENCE  — writes go through the existing `database` singleton; its 2s
//                   debounce flush + SIGINT/SIGTERM flush + load-on-startup give
//                   crash-survival for free. No manual export here. The SSE
//                   cursor is persisted in `settings` (also flushed by that path).
//  • CONCURRENCY  — one instance, one 30s timer, one SSE reader; every check_ins
//                   write is serialized through `writeQueue` (single async chain).
//  • NO REDIS     — `memberCache` (Map, 60s TTL) for membership status;
//                   `usedTokens` (Map, per-entry remaining-lifetime TTL) for replay.
//  • NO BULLMQ    — allowlist push is a plain setInterval(~30s).
//
// AUTH MODEL (locked in):
//  1. HMAC token is the source of truth. handleScan verifies HMAC + TTL + replay
//     FIRST, then checks membership. The panel allowlist is ONLY an offline
//     fallback (what the panel decides with when the bridge is disconnected); it
//     never authorizes while the bridge is online and a token/code is present.
//  4. SSE is treated as best-effort. On reconnect we PULL transactions since the
//     persisted last-read timestamp — we never assume the stream re-delivers
//     missed events. The cursor survives a bridge restart (stored in settings).
//  5. c3_token_secret is never logged and is masked in the settings GET.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const settingsService = require('../../core/services/settings-service');
const tokens = require('./c3-tokens');
const balanceService = require('../../core/services/member-balance-service');
const { decideCheckin } = require('./decide-checkin');

const dateOnly = (v) => String(v || '').slice(0, 10);

const CURSOR_KEY = 'access_control.c3_last_txn_at'; // persisted SSE/pull cursor

module.exports = function createC3Service({ database, eventBus, log = console }) {
  const db = database;
  const run = (sql, p = []) => db.run(sql, p);
  const all = (sql, p = []) => db.getAll(sql, p);
  const one = (sql, p = []) => db.getOne(sql, p);

  // ── config (read live each cycle) ─────────────────────────────────────────
  function cfg() {
    return {
      enabled:   !!settingsService.get('access_control.c3_service_enabled', false),
      baseUrl:   String(settingsService.get('access_control.c3_service_url', '') || '').replace(/\/+$/, ''),
      apiKey:    settingsService.get('access_control.c3_service_key', ''),
      secret:    settingsService.get('access_control.c3_token_secret', ''),
      doorNo:    Number(settingsService.get('access_control.c3_door_number', 1) || 1),
      openSecs:  Number(settingsService.get('access_control.c3_open_duration', 5) || 5),
      syncMs:    30000,
      cacheTtlMs: 60000,
    };
  }

  // ── caches (replace Redis) ────────────────────────────────────────────────
  const memberCache = new Map(); // memberId -> { active, name, exp(ms) }
  const usedTokens  = new Map(); // replayNonce -> expiry(ms)  (point 3: TTL = remaining token lifetime)

  function membershipStatus(memberId) {
    const nowMs = Date.now();
    const hit = memberCache.get(memberId);
    if (hit && hit.exp > nowMs) return hit;
    const m = one(`SELECT id, first_name, last_name, status FROM members WHERE id = ?`, [memberId]);
    let active = false, name = '';
    if (m) {
      name = `${m.first_name || ''} ${m.last_name || ''}`.trim();
      if (m.status === 'active') {
        const ms = one(
          `SELECT id FROM memberships
             WHERE member_id = ? AND status = 'active'
               AND (end_date IS NULL OR date(end_date) >= date('now'))
             LIMIT 1`, [memberId]);
        active = !!ms;
      }
    }
    const val = { active, name, exp: nowMs + cfg().cacheTtlMs };
    memberCache.set(memberId, val);
    return val;
  }

  // replay store — record only after a successful validate; TTL = remaining life
  function isReplay(nonce) {
    const exp = usedTokens.get(nonce);
    return typeof exp === 'number' && exp > Date.now();
  }
  function markUsed(nonce, ttlMs) {
    if (nonce && ttlMs > 0) usedTokens.set(nonce, Date.now() + ttlMs);
  }
  function pruneTokens() {
    const nowMs = Date.now();
    for (const [k, exp] of usedTokens) if (exp <= nowMs) usedTokens.delete(k);
  }

  // set of member IDs with an active membership (for Wiegand code24 matching)
  function activeMemberIds() {
    const rows = all(
      `SELECT DISTINCT m.id AS id
         FROM members m
         JOIN memberships ms ON ms.member_id = m.id
        WHERE m.status = 'active' AND ms.status = 'active'
          AND (ms.end_date IS NULL OR date(ms.end_date) >= date('now'))`);
    return rows.map(r => r.id);
  }

  // Resolve a STATIC Wiegand id to a member — the credential a FACE TERMINAL
  // (ZKTeco SpeedFace / Hikvision) emits per enrolled person, matched on-device.
  // The terminal's user id is stored as the member's access_identities.code.
  // Also covers plain proximity cards. No HMAC/replay — it's a fixed enrolled id.
  function resolveStaticCard(cardNo) {
    if (cardNo == null || cardNo === '') return null;
    const row = one(`SELECT member_id FROM access_identities
       WHERE code = ? AND status = 'active' AND member_id IS NOT NULL LIMIT 1`, [String(cardNo)]);
    return row && row.member_id ? row.member_id : null;
  }

  // ── microservice HTTP (STUB — swappable for the real endpoints later) ──────
  // Kept behind one function so the wire protocol is the only thing to swap in
  // when the panel is reachable. Offline build: no live calls are made because
  // start() only runs when enabled + baseUrl are set.
  async function svc(path, { method = 'GET', body, timeoutMs = 4000 } = {}) {
    const c = cfg();
    if (!c.baseUrl) throw new Error('c3 service url not configured');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${c.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-api-key': c.apiKey },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(`c3 ${path} → ${res.status}: ${data.detail || text}`);
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  async function openDoor(reason = 'bridge') {
    const c = cfg();
    return svc('/door/open', { method: 'POST', body: { door_no: c.doorNo, seconds: c.openSecs, reason } });
  }

  // ── allowlist push (offline fallback only) ────────────────────────────────
  // Permanent card numbers (access_identities.code) for members with an active
  // membership. This is what the PANEL falls back to when the bridge is offline;
  // while the bridge is online, tokens — not this list — authorize.
  function buildAllowlist() {
    const rows = all(
      `SELECT ai.code AS card_no, ai.member_id AS member_id, ms.end_date AS expires_at
         FROM access_identities ai
         JOIN members m       ON m.id = ai.member_id AND m.status = 'active'
         JOIN memberships ms  ON ms.member_id = ai.member_id AND ms.status = 'active'
                             AND (ms.end_date IS NULL OR date(ms.end_date) >= date('now'))
        WHERE ai.status = 'active' AND ai.code IS NOT NULL AND ai.code != ''`);
    // dedupe by card_no (a member may have >1 active membership row)
    const seen = new Set();
    const entries = [];
    for (const r of rows) {
      if (seen.has(r.card_no)) continue;
      seen.add(r.card_no);
      entries.push({ card_no: String(r.card_no), member_id: r.member_id, expires_at: r.expires_at || null });
    }
    return entries;
  }
  async function pushAllowlist() {
    const c = cfg();
    if (!c.enabled || !c.baseUrl) return;
    try {
      const entries = buildAllowlist();
      await svc('/allowlist/sync', { method: 'POST', body: { entries } });
      log.log(`[c3] allowlist synced (${entries.length} cards)`);
    } catch (e) {
      log.warn(`[c3] allowlist sync failed: ${e.message}`);
    }
  }

  // ── SSE consumer with pull-from-last-timestamp on (re)connect ──────────────
  let sseAbort = null;
  let sseRunning = false;

  function getCursor() { return settingsService.get(CURSOR_KEY, '') || ''; }
  function setCursor(ts) {
    if (ts) settingsService.set(CURSOR_KEY, String(ts), { module: 'access-control', label: 'C3 last transaction cursor' });
  }

  // Pull any transactions the panel buffered while we were disconnected, so a
  // dropped SSE stream never loses a scan. The microservice exposes this as a
  // history read since a timestamp; the C3 keeps transactions in its own memory.
  async function pullSince(cursor) {
    try {
      const q = cursor ? `?since=${encodeURIComponent(cursor)}` : '';
      const data = await svc(`/events/history${q}`, { method: 'GET' });
      const list = (data && data.transactions) || [];
      for (const rec of list) await handleScan(rec);
      if (list.length) log.log(`[c3] replayed ${list.length} buffered txns since ${cursor || 'start'}`);
    } catch (e) {
      log.warn(`[c3] history pull failed: ${e.message}`);
    }
  }

  async function consumeEvents() {
    if (sseRunning) return;
    sseRunning = true;
    let backoff = 1000;
    while (sseRunning && cfg().enabled) {
      const c = cfg();
      try {
        // 1) reconcile anything missed while disconnected BEFORE trusting the stream
        await pullSince(getCursor());
        // 2) open the live stream
        sseAbort = new AbortController();
        const res = await fetch(`${c.baseUrl}/events/stream`, {
          headers: { 'x-api-key': c.apiKey, accept: 'text/event-stream' },
          signal: sseAbort.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        backoff = 1000;
        log.log('[c3] SSE connected');
        await readSse(res.body);
      } catch (e) {
        if (!sseRunning) break;
        log.warn(`[c3] SSE dropped (${e.message}); retry in ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30000);
      }
    }
    sseRunning = false;
  }

  // Minimal text/event-stream parser over a fetch ReadableStream.
  async function readSse(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json || json === '[]') continue;
        try { await handleScan(JSON.parse(json)); }
        catch (e) { log.warn(`[c3] bad SSE frame: ${e.message}`); }
      }
    }
  }

  // ── scan handling: token FIRST, then membership; always log ────────────────
  let writeQueue = Promise.resolve();
  function enqueue(fn) {
    writeQueue = writeQueue.then(fn).catch(e => log.error('[c3] write error:', e.message));
    return writeQueue;
  }

  // Debt/alert policy from settings (feeds the pure decision).
  function policySettings() {
    return {
      debtAlertThreshold: Number(settingsService.get('access_control.debt_alert_threshold', 0) || 0),
      debtBlockEnabled: !!settingsService.get('access_control.debt_block_enabled', false),
      debtBlockThreshold: Number(settingsService.get('access_control.debt_block_threshold', 0) || 0),
      debtBlockGraceDays: parseInt(settingsService.get('access_control.debt_block_grace_days', 0) || 0, 10),
    };
  }

  // Gather the member facts the decision + popup need (reuses the shared balance
  // calc — no parallel debt math). Returns { found:false } for a missing member.
  function gatherContext(memberId) {
    const today = (one("SELECT date('now','localtime') d") || {}).d || new Date().toISOString().slice(0, 10);
    const member = one('SELECT id, member_no, first_name, last_name, first_name_ar, last_name_ar, phone, photo FROM members WHERE id = ?', [memberId]);
    if (!member) return { found: false, today };
    let membership = null;
    try {
      membership = one(`SELECT * FROM memberships WHERE member_id = ? AND status IN ('active','scheduled')
        ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, start_date ASC, end_date DESC LIMIT 1`, [memberId]);
    } catch (_) {}
    const started = membership && (!membership.start_date || dateOnly(membership.start_date) <= today);
    const hasMembership = !!membership && membership.status === 'active' && started;
    const endDate = membership && membership.end_date ? dateOnly(membership.end_date) : null;
    const daysRemaining = endDate
      ? Math.max(0, Math.round((Date.parse(endDate + 'T00:00:00') - Date.parse(today + 'T00:00:00')) / 86400000))
      : null;
    const bal = balanceService.getOutstanding(memberId);
    const debtAgeDays = balanceService.debtAgeDays(memberId, today);
    return { found: true, today, member, membership, hasMembership, endDate, daysRemaining, balance: bal.total, debtAgeDays };
  }

  // Build + emit the reception-popup payload (server decided; UI only renders).
  function emitDisplay({ rec, doorNo, allowed, reason, state, ctx, opened }) {
    if (!settingsService.get('access_control.checkin_popup_enabled', true)) return;
    const m = ctx && ctx.member, ms = ctx && ctx.membership;
    const payload = {
      ts: new Date().toISOString(),
      decision: { allowed, reason, state },
      door: { no: doorNo, opened: !!opened },
      card_no: rec.card_no != null ? String(rec.card_no) : '',
      member: m ? {
        id: m.id, member_no: m.member_no,
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
        name_ar: `${m.first_name_ar || ''} ${m.last_name_ar || ''}`.trim(),
        phone: m.phone || '', photo: m.photo || '',
      } : null,
      subscription: ms ? {
        plan_name: ms.plan_name || '', start_date: ms.start_date || null, end_date: ctx.endDate,
        days_remaining: ctx.daysRemaining, billing_type: ms.billing_type || 'period', remaining_sessions: ms.remaining_sessions,
      } : null,
      finance: ctx && ctx.found ? {
        price: ms ? Number(ms.price || 0) : 0, paid: ms ? Number(ms.total_paid || 0) : 0,
        balance_due: ms ? Number(ms.balance_due || 0) : 0,
        outstanding: Number(ctx.balance || 0), currency: (ms && ms.currency) || 'JOD',
      } : null,
      policy: policySettings(),
    };
    try { eventBus && eventBus.emit && eventBus.emit('access.checkin.display', payload); } catch (_) {}
  }

  // rec: { card_no?, token?, door_no?, event_type?, panel_sn?, time? }
  async function handleScan(rec) {
    const c = cfg();
    const nowMs = Date.now();
    const doorNo = Number(rec.door_no || c.doorNo || 1);
    let memberId = null, allowed = false, reason = 'unknown', state = 'unknown', ctx = null;

    // 1) Resolve the credential to a member.
    //    token (rotating HMAC) → code24 (rotating QR) → static id (face terminal / card).
    let auth = { ok: false, reason: 'no_credential' };
    if (rec.token) {
      auth = tokens.validateToken(c.secret, rec.token, nowMs);            // Mode B: rotating token
    } else if (rec.card_no != null && rec.card_no !== '') {
      auth = tokens.resolveCode24(c.secret, rec.card_no, nowMs, activeMemberIds()); // Mode A: rotating QR
      if (!auth.ok) {
        const sid = resolveStaticCard(rec.card_no);                       // face terminal / enrolled card
        if (sid) auth = { ok: true, memberId: sid, reason: 'ok', replayNonce: null, replayTtlMs: 0, static: true };
      }
    }

    if (!auth.ok) {
      reason = 'unknown'; state = 'unknown';                              // invalid/expired token/card
    } else if (isReplay(auth.replayNonce)) {
      reason = 'replay'; state = 'unknown';                               // still-valid token already used (passback)
    } else {
      // 2) decision — expired/debt policy — only AFTER the credential is proven.
      memberId = auth.memberId;
      ctx = gatherContext(memberId);
      const decision = decideCheckin({
        found: ctx.found, hasMembership: ctx.hasMembership, endDate: ctx.endDate,
        today: ctx.today, balance: ctx.balance, debtAgeDays: ctx.debtAgeDays,
      }, policySettings());
      allowed = decision.allowed; reason = decision.reason; state = decision.state;
      if (allowed) markUsed(auth.replayNonce, auth.replayTtlMs);          // consume token only when it granted entry
    }

    // 3) act + log (serialized). Open only when online and allowed.
    let opened = false;
    if (allowed) {
      try { await openDoor(`member:${memberId}`); opened = true; }
      catch (e) { reason = 'ok_open_failed'; log.warn(`[c3] open failed: ${e.message}`); }
    }
    enqueue(() => logCheckIn({
      member_id: memberId,
      panel_sn: rec.panel_sn || '',
      door_no: doorNo,
      card_no: rec.card_no != null ? String(rec.card_no) : '',
      event_type: rec.event_type || 'scan',
      allowed,
      reason,
    }));

    // 4) advance the persisted cursor so we never re-read this txn after a drop
    if (rec.time) setCursor(rec.time);

    // 5) reception popup + legacy event
    emitDisplay({ rec, doorNo, allowed, reason, state, ctx, opened });
    try { eventBus && eventBus.emit && eventBus.emit('access.checkin', { memberId, allowed, reason, doorNo }); }
    catch (_) {}

    return { memberId, allowed, reason, state };
  }

  function logCheckIn(rec) {
    run(`INSERT INTO check_ins (member_id, panel_sn, door_no, card_no, event_type, scanned_at, allowed, reason)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
      [rec.member_id || null, rec.panel_sn || '', rec.door_no || 1, rec.card_no || '',
       rec.event_type || '', rec.allowed ? 1 : 0, rec.reason || '']);
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────
  let syncTimer = null;
  function start() {
    const c = cfg();
    if (!c.enabled || !c.baseUrl) { log.log('[c3] bridge disabled (set url + enable)'); return; }
    log.log(`[c3] bridge → ${c.baseUrl} (sync ${c.syncMs}ms)`);
    pushAllowlist();
    syncTimer = setInterval(() => { pruneTokens(); pushAllowlist(); }, c.syncMs);
    consumeEvents(); // self-reconnecting; pulls missed txns on each (re)connect
  }
  function stop() {
    sseRunning = false;
    if (syncTimer) clearInterval(syncTimer);
    if (sseAbort) { try { sseAbort.abort(); } catch (_) {} }
    syncTimer = sseAbort = null;
  }
  function restart() { stop(); memberCache.clear(); start(); }

  return {
    start, stop, restart, cfg,
    pushAllowlist, membershipStatus, handleScan, logCheckIn, svc, openDoor,
    buildAllowlist, activeMemberIds,
  };
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

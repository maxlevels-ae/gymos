
const express = require('express');
const { randomUUID } = require('crypto');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const settingsService = require('../../core/services/settings-service');
const createC3Service = require('./c3-service');
const jwt = require('jsonwebtoken');
const config = require('../../core/config');

module.exports = function (app, { database, eventBus }) {
  const router = express.Router();
  const db = database;

  function one(sql, params = []) { return db.getOne(sql, params); }
  function all(sql, params = []) { return db.getAll(sql, params); }
  function run(sql, params = []) { return db.run(sql, params); }

  function getSettings() {
    return {
      bridgeUrl: settingsService.get('access_control.bridge_url', 'http://localhost:7001'),
      scoreThreshold: Number(settingsService.get('access_control.score_threshold', 45) || 45),
      gateProvider: settingsService.get('access_control.gate_provider', 'mock'),
      gateOpenUrl: settingsService.get('access_control.gate_open_url', ''),
      gateSecret: settingsService.get('access_control.gate_secret', ''),
      allowMemberCheckin: !!settingsService.get('access_control.allow_member_checkin', true),
      c3PanelIp: settingsService.get('access_control.c3_panel_ip', '192.168.1.201'),
      c3PanelPort: Number(settingsService.get('access_control.c3_panel_port', 4370) || 4370),
      c3DoorNumber: Number(settingsService.get('access_control.c3_door_number', 1) || 1),
      c3OpenDuration: Number(settingsService.get('access_control.c3_open_duration', 5) || 5),
      c3Password: settingsService.get('access_control.c3_password', ''),
      // ── C3 microservice bridge (secrets NEVER returned — only a "set" flag) ──
      c3ServiceUrl: settingsService.get('access_control.c3_service_url', ''),
      c3ServiceEnabled: !!settingsService.get('access_control.c3_service_enabled', false),
      c3ServiceKeySet: !!settingsService.get('access_control.c3_service_key', ''),
      c3TokenSecretSet: !!settingsService.get('access_control.c3_token_secret', ''),
      c3QrMode: settingsService.get('access_control.c3_qr_mode', 'code24'),
      // ── Reception popup + debt policy ──
      checkinPopupEnabled: !!settingsService.get('access_control.checkin_popup_enabled', true),
      debtAlertThreshold: Number(settingsService.get('access_control.debt_alert_threshold', 0) || 0),
      debtBlockEnabled: !!settingsService.get('access_control.debt_block_enabled', false),
      debtBlockThreshold: Number(settingsService.get('access_control.debt_block_threshold', 0) || 0),
      debtBlockGraceDays: parseInt(settingsService.get('access_control.debt_block_grace_days', 0) || 0, 10),
    };
  }

  async function bridgeRequest(path, method = 'GET', body = null) {
    const cfg = getSettings();
    const url = String(cfg.bridgeUrl || '').replace(/\/$/, '') + path;
    const init = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) init.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(url, init);
    } catch (error) {
      throw new Error('Bridge unreachable: ' + error.message);
    }
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || `Bridge error ${res.status}`);
    return data;
  }

  function codeForIdentity(id) {
    return 'ACC-' + String(id).padStart(5, '0');
  }

  // Ensure employee_id column exists
  try { db.get().exec(`ALTER TABLE access_identities ADD COLUMN employee_id INTEGER DEFAULT NULL`); } catch (_) {}
  try { db.get().exec(`ALTER TABLE access_events ADD COLUMN employee_id INTEGER DEFAULT NULL`); } catch (_) {}

  function addTimeline(memberId, type, title, desc, userId, meta) {
    try {
      run('INSERT INTO member_timeline (member_id, event_type, title, description, created_by, meta) VALUES (?,?,?,?,?,?)', [
        memberId, type, title, desc || '', userId || null, JSON.stringify(meta || {})
      ]);
    } catch (_) {}
  }

  function dateOnly(input) {
    if (!input) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(input))) return String(input);
    try { return new Date(input).toISOString().slice(0, 10); } catch (_) { return String(input).slice(0, 10); }
  }

  const membershipState = require('../../core/services/membership-state-service');
  function normalizeMembershipState(memberId) { return membershipState.syncMember(memberId); }

  function checkEligibility(memberId) {
    const member = one('SELECT id, first_name, middle_name, last_name, status, member_no, photo FROM members WHERE id = ?', [memberId]);
    if (!member) return { allowed: false, reason: 'Member not found', member: null };
    if (member.status !== 'active') return { allowed: false, reason: `Member is ${member.status}`, member };

    normalizeMembershipState(memberId);

    const existing = one("SELECT id FROM attendance_logs WHERE member_id = ? AND date(check_in) = date('now') AND check_out IS NULL AND was_denied = 0", [memberId]);
    if (existing) return { allowed: false, reason: 'Already checked in today', member };

    let membership = null;
    try {
      membership = one("SELECT * FROM memberships WHERE member_id = ? AND status IN ('active','scheduled') ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, start_date ASC, end_date DESC LIMIT 1", [memberId]);
    } catch (_) {}

    if (!membership) return { allowed: false, reason: 'No active membership', member };
    const today = dateOnly(new Date());
    if (membership.status === 'scheduled' || (membership.start_date && dateOnly(membership.start_date) > today)) {
      return { allowed: false, reason: 'Membership has not started yet', member, membership };
    }
    if (membership.end_date && dateOnly(membership.end_date) < today) return { allowed: false, reason: 'Membership expired', member, membership };
    if (membership.billing_type === 'sessions' && Number(membership.remaining_sessions || 0) <= 0) return { allowed: false, reason: 'No sessions remaining', member, membership };

    return { allowed: true, reason: null, member, membership };
  }

  function registerAttendanceForFingerprint(memberId, userId) {
    const elig = checkEligibility(memberId);
    if (!elig.allowed) return { success: false, error: elig.reason, member: elig.member, membership: elig.membership };

    const msId = elig.membership?.id || null;

    if (elig.membership?.billing_type === 'sessions') {
      run('UPDATE memberships SET used_sessions = used_sessions + 1, remaining_sessions = remaining_sessions - 1 WHERE id = ?', [msId]);
    }

    const result = run('INSERT INTO attendance_logs (member_id, membership_id, branch_id, method, checked_by) VALUES (?,?,?,?,?)',
      [memberId, msId, elig.membership?.branch_id || null, 'fingerprint', userId || null]);

    run("UPDATE members SET last_visit_at = datetime('now'), total_visits = total_visits + 1 WHERE id = ?", [memberId]);
    addTimeline(memberId, 'access_granted', 'Fingerprint Access Granted', 'Member entered through fingerprint verification', userId, { attendance_log_id: result.lastInsertRowid });
    eventBus.emit('attendance.checkin', { member_id: memberId, logId: result.lastInsertRowid, method: 'fingerprint' });
    return { success: true, attendanceLogId: result.lastInsertRowid, member: elig.member };
  }

  /**
   * Open door via ZKTeco C3-100 TCP protocol (PULL SDK ControlDevice command).
   * The C3-100 uses a binary TCP protocol on port 4370.
   * Command: ControlDevice with output_number=door, address=1(lock), duration=seconds.
   * Protocol: Connect → send CONTROL DEVICE command → close.
   */
  async function openC3Door(cfg) {
    const net = require('net');
    return new Promise((resolve) => {
      const ip = cfg.c3PanelIp || '192.168.1.201';
      const port = cfg.c3PanelPort || 4370;
      const door = cfg.c3DoorNumber || 1;
      const duration = cfg.c3OpenDuration || 5;
      const timeout = 5000;

      // C3 PULL SDK uses a text-based TCP protocol for ControlDevice
      // Format: "CONTROL DEVICE {AA}{BB}{CC}{DD}{EE}"
      // AA=01(output), BB=door(01-04), CC=01(lock), DD=01(open), EE=duration(hex)
      const cmd = `ControlDevice:${door},1,1,${duration},0\r\n`;

      const socket = new net.Socket();
      let responded = false;

      socket.setTimeout(timeout);
      socket.on('timeout', () => {
        if (!responded) { responded = true; socket.destroy(); resolve({ success: false, provider: 'c3-100', error: 'Connection timeout' }); }
      });
      socket.on('error', (err) => {
        if (!responded) { responded = true; socket.destroy(); resolve({ success: false, provider: 'c3-100', error: err.message }); }
      });
      socket.on('data', (data) => {
        if (!responded) {
          responded = true;
          socket.destroy();
          const resp = data.toString();
          resolve({ success: true, provider: 'c3-100', response: resp, ip, port, door, duration });
        }
      });
      socket.on('close', () => {
        if (!responded) { responded = true; resolve({ success: true, provider: 'c3-100', message: 'Command sent (no response)', ip, port, door, duration }); }
      });

      socket.connect(port, ip, () => {
        socket.write(cmd);
        // Some C3 panels don't respond, just close after a short wait
        setTimeout(() => {
          if (!responded) { responded = true; socket.destroy(); resolve({ success: true, provider: 'c3-100', message: 'Command sent', ip, port, door, duration }); }
        }, 2000);
      });
    });
  }

  async function triggerGateOpen(identity, meta = {}) {
    const cfg = getSettings();

    // C3-100 direct TCP control
    if (cfg.gateProvider === 'c3-100') {
      try {
        return await openC3Door(cfg);
      } catch (error) {
        return { success: false, provider: 'c3-100', error: error.message };
      }
    }

    // Webhook
    if (cfg.gateProvider === 'webhook' && cfg.gateOpenUrl) {
      try {
        const res = await fetch(cfg.gateOpenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cfg.gateSecret ? { 'x-gate-secret': cfg.gateSecret } : {})
          },
          body: JSON.stringify({
            identityId: identity?.id || null,
            memberId: identity?.member_id || null,
            code: identity?.code || null,
            displayName: identity?.display_name || '',
            timestamp: new Date().toISOString(),
            meta
          })
        });
        let data = {};
        try { data = await res.json(); } catch (_) {}
        return { success: res.ok, provider: 'webhook', response: data, status: res.status };
      } catch (error) {
        return { success: false, provider: 'webhook', error: error.message };
      }
    }

    // Mock
    return { success: true, provider: 'mock', message: 'Mock gate open executed' };
  }

  function eventRowToResponse(row) {
    if (!row) return row;
    try { row.raw = row.raw_json ? JSON.parse(row.raw_json) : {}; } catch (_) { row.raw = {}; }
    return row;
  }

  router.get('/status', authMiddleware, requirePermission('access-control.view'), async (req, res) => {
    const cfg = getSettings();
    let bridge = { connected: false, error: 'Bridge not checked' };
    try {
      bridge = await bridgeRequest('/device/status', 'GET');
      run("UPDATE access_devices SET last_seen_at=datetime('now'), updated_at=datetime('now') WHERE connection_type='bridge'");
    } catch (error) {
      bridge = { connected: false, error: error.message };
    }
    const totalIdentities = one('SELECT COUNT(*) as c FROM access_identities')?.c || 0;
    const linkedMembers = one('SELECT COUNT(*) as c FROM access_identities WHERE member_id IS NOT NULL')?.c || 0;
    const templates = one('SELECT COUNT(*) as c FROM access_fingerprint_templates WHERE is_merged = 1')?.c || 0;
    const eventsToday = one("SELECT COUNT(*) as c FROM access_events WHERE date(created_at) = date('now')")?.c || 0;
    res.json({ success: true, data: { bridge, settings: cfg, stats: { totalIdentities, linkedMembers, templates, eventsToday } } });
  });

  router.get('/dashboard', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const total = one('SELECT COUNT(*) as c FROM access_events')?.c || 0;
    const today = one("SELECT COUNT(*) as c FROM access_events WHERE date(created_at) = date('now')")?.c || 0;
    const granted = one("SELECT COUNT(*) as c FROM access_events WHERE result = 'granted'")?.c || 0;
    const denied = one("SELECT COUNT(*) as c FROM access_events WHERE result = 'denied'")?.c || 0;
    const successRate = total ? Math.round((granted / total) * 100) : 0;
    const recent = all(`SELECT ae.*, ai.display_name, ai.code, m.first_name, m.middle_name, m.last_name
      FROM access_events ae
      LEFT JOIN access_identities ai ON ai.id = ae.identity_id
      LEFT JOIN members m ON m.id = ae.member_id
      ORDER BY ae.created_at DESC LIMIT 20`).map(eventRowToResponse);
    res.json({ success: true, data: { total, today, granted, denied, successRate, recent } });
  });

  router.get('/identities', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const rows = all(`SELECT ai.*,
        m.member_no, m.first_name, m.middle_name, m.last_name,
        (SELECT COUNT(*) FROM access_fingerprint_templates t WHERE t.identity_id = ai.id AND t.is_merged = 1) as template_count,
        (SELECT MAX(created_at) FROM access_fingerprint_templates t WHERE t.identity_id = ai.id) as last_template_at
      FROM access_identities ai
      LEFT JOIN members m ON m.id = ai.member_id
      ORDER BY ai.created_at DESC`);
    res.json({ success: true, data: rows });
  });

  router.post('/identities', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    const { display_name, code, member_id, notes } = req.body || {};
    if (!display_name) return res.status(400).json({ success: false, error: 'display_name is required' });
    const result = run(`INSERT INTO access_identities (code, display_name, member_id, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`, [code || null, display_name, member_id || null, notes || '']);
    const id = result.lastInsertRowid;
    if (!code) run(`UPDATE access_identities SET code = ?, updated_at=datetime('now') WHERE id = ?`, [codeForIdentity(id), id]);
    const row = one('SELECT * FROM access_identities WHERE id = ?', [id]);
    if (row?.member_id) addTimeline(row.member_id, 'access_identity_created', 'Access identity created', `Identity ${row.code || codeForIdentity(id)} linked to member`, req.user.id);
    res.json({ success: true, data: one('SELECT * FROM access_identities WHERE id = ?', [id]) });
  });

  router.put('/identities/:id', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    const current = one('SELECT * FROM access_identities WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ success: false, error: 'Identity not found' });
    const payload = req.body || {};
    run(`UPDATE access_identities SET code=?, display_name=?, member_id=?, status=?, notes=?, updated_at=datetime('now') WHERE id=?`, [
      payload.code || current.code || codeForIdentity(current.id),
      payload.display_name || current.display_name,
      payload.member_id !== undefined ? (payload.member_id || null) : current.member_id,
      payload.status || current.status || 'active',
      payload.notes !== undefined ? payload.notes : current.notes,
      req.params.id
    ]);
    res.json({ success: true, data: one('SELECT * FROM access_identities WHERE id = ?', [req.params.id]) });
  });

  router.get('/members/search', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });
    const like = `%${q}%`;
    const rows = all(`SELECT m.id, m.member_no, m.first_name, m.middle_name, m.last_name, m.status,
      ms.plan_name, ms.end_date,
      ai.id as access_identity_id
      FROM members m
      LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.status IN ('active','scheduled')
      LEFT JOIN access_identities ai ON ai.member_id = m.id
      WHERE m.member_no LIKE ? OR m.first_name LIKE ? OR m.middle_name LIKE ? OR m.last_name LIKE ? OR m.phone LIKE ?
      ORDER BY m.id DESC LIMIT 15`, [like, like, like, like, like]);
    res.json({ success: true, data: rows });
  });

  // ── Face access: map a member ↔ their face-terminal ID ─────────────────────
  // Faces are enrolled ON the terminal against this numeric id; GymOS stores the
  // id (access_identities.code). The terminal emits it over Wiegand → the C3
  // bridge resolves it to the member (resolveStaticCard) → decision + popup.
  const WIEGAND_MAX = 16777215;
  router.get('/face/next-id', authMiddleware, requirePermission('access-control.enroll'), (req, res) => {
    const row = one("SELECT MAX(CAST(code AS INTEGER)) mx FROM access_identities WHERE code GLOB '[0-9]*'");
    let next = Math.max(1000, Number((row && row.mx) || 0)) + 1;
    if (next > WIEGAND_MAX) next = 1001;
    res.json({ success: true, data: { code: String(next) } });
  });

  router.post('/face/assign', authMiddleware, requirePermission('access-control.enroll'), (req, res) => {
    const memberId = Number(req.body.memberId);
    const code = String(req.body.code || '').trim();
    if (!memberId) return res.status(400).json({ success: false, error: 'memberId required' });
    if (!/^\d+$/.test(code) || Number(code) < 1 || Number(code) > WIEGAND_MAX)
      return res.status(400).json({ success: false, error: `Face ID must be a number 1..${WIEGAND_MAX} (Wiegand-26)` });
    const clash = one('SELECT id, member_id FROM access_identities WHERE code = ? LIMIT 1', [code]);
    if (clash && Number(clash.member_id) !== memberId)
      return res.status(409).json({ success: false, error: 'Face ID already used by another member' });
    const member = one('SELECT id, first_name, middle_name, last_name, member_no FROM members WHERE id = ?', [memberId]);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
    const name = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim() || member.member_no || ('#' + memberId);
    const existing = one('SELECT id FROM access_identities WHERE member_id = ? LIMIT 1', [memberId]);
    if (existing) run("UPDATE access_identities SET code=?, display_name=?, status='active', updated_at=datetime('now') WHERE id=?", [code, name, existing.id]);
    else run("INSERT INTO access_identities (code, display_name, member_id, status, notes, created_at, updated_at) VALUES (?,?,?,'active','Face access',datetime('now'),datetime('now'))", [code, name, memberId]);
    addTimeline(memberId, 'face_id_assigned', 'Face ID assigned', `Face terminal ID ${code}`, req.user.id);
    res.json({ success: true, data: { memberId, code } });
  });

  router.get('/face/enrolled', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const rows = all(`SELECT ai.code, ai.member_id, ai.display_name, m.member_no, m.phone,
        ms.plan_name, ms.end_date
      FROM access_identities ai
      LEFT JOIN members m ON m.id = ai.member_id
      LEFT JOIN memberships ms ON ms.member_id = ai.member_id AND ms.status IN ('active','scheduled')
      WHERE ai.status='active' AND ai.member_id IS NOT NULL AND ai.code GLOB '[0-9]*'
      ORDER BY ai.updated_at DESC LIMIT 300`);
    res.json({ success: true, data: rows });
  });

  router.post('/members/:memberId/bootstrap-identity', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    const member = one('SELECT * FROM members WHERE id = ?', [req.params.memberId]);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
    let identity = one('SELECT * FROM access_identities WHERE member_id = ?', [req.params.memberId]);
    if (!identity) {
      const name = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim();
      const result = run(`INSERT INTO access_identities (code, display_name, member_id, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`, [null, name || member.member_no, member.id, 'Linked from member profile']);
      const id = result.lastInsertRowid;
      run('UPDATE access_identities SET code=?, updated_at=datetime("now") WHERE id=?', [codeForIdentity(id), id]);
      identity = one('SELECT * FROM access_identities WHERE id = ?', [id]);
      addTimeline(member.id, 'access_identity_created', 'Access identity created', `Linked identity ${identity.code}`, req.user.id);
    }
    res.json({ success: true, data: identity });
  });

  router.post('/identities/:id/enroll/start', authMiddleware, requirePermission('access-control.enroll'), (req, res) => {
    const identity = one('SELECT * FROM access_identities WHERE id = ?', [req.params.id]);
    if (!identity) return res.status(404).json({ success: false, error: 'Identity not found' });
    const sessionKey = randomUUID();
    run(`INSERT INTO access_enrollment_sessions (identity_id, session_key, status, created_at, updated_at)
      VALUES (?, ?, 'collecting', datetime('now'), datetime('now'))`, [identity.id, sessionKey]);
    res.json({ success: true, data: { sessionKey, identity } });
  });

  router.post('/enroll/:sessionKey/capture', authMiddleware, requirePermission('access-control.enroll'), async (req, res) => {
    try {
      const session = one('SELECT * FROM access_enrollment_sessions WHERE session_key = ?', [req.params.sessionKey]);
      if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
      if (session.status === 'completed') return res.status(400).json({ success: false, error: 'Enrollment already completed' });

      const capture = await bridgeRequest('/capture', 'POST');
      const nextIndex = session.scan1_b64 ? (session.scan2_b64 ? (session.scan3_b64 ? 4 : 3) : 2) : 1;
      if (nextIndex > 3) return res.status(400).json({ success: false, error: 'Three scans already collected' });

      run(`UPDATE access_enrollment_sessions
        SET scan${nextIndex}_b64 = ?, scan${nextIndex}_quality = ?, updated_at = datetime('now')
        WHERE session_key = ?`, [capture.template, capture.quality || 0, req.params.sessionKey]);

      res.json({ success: true, data: { captured: nextIndex, quality: capture.quality || 0, width: capture.width, height: capture.height } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/enroll/:sessionKey/merge', authMiddleware, requirePermission('access-control.enroll'), async (req, res) => {
    try {
      const session = one('SELECT * FROM access_enrollment_sessions WHERE session_key = ?', [req.params.sessionKey]);
      if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
      if (!session.scan1_b64 || !session.scan2_b64 || !session.scan3_b64) {
        return res.status(400).json({ success: false, error: 'Three scans are required before merge' });
      }

      const merged = await bridgeRequest('/merge', 'POST', {
        template1B64: session.scan1_b64,
        template2B64: session.scan2_b64,
        template3B64: session.scan3_b64
      });

      run(`INSERT INTO access_fingerprint_templates (identity_id, template_b64, template_size, quality, scan_index, source, is_merged, created_at)
        VALUES (?, ?, ?, ?, 0, 'bridge', 1, datetime('now'))`, [
        session.identity_id, merged.templateB64, merged.templateSize || 0,
        Math.round(((session.scan1_quality || 0) + (session.scan2_quality || 0) + (session.scan3_quality || 0)) / 3)
      ]);

      run(`UPDATE access_enrollment_sessions SET status='completed', merged_template_b64=?, updated_at=datetime('now') WHERE session_key=?`,
        [merged.templateB64, req.params.sessionKey]);

      const identity = one('SELECT * FROM access_identities WHERE id = ?', [session.identity_id]);
      if (identity?.member_id) {
        addTimeline(identity.member_id, 'fingerprint_enrolled', 'Fingerprint enrolled', `Fingerprint template saved for ${identity.display_name}`, req.user.id);
      }
      res.json({ success: true, data: { identityId: session.identity_id, templateSize: merged.templateSize || 0 } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/events', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const rows = all(`SELECT ae.*, ai.display_name, ai.code, m.member_no, m.first_name, m.middle_name, m.last_name
      FROM access_events ae
      LEFT JOIN access_identities ai ON ai.id = ae.identity_id
      LEFT JOIN members m ON m.id = ae.member_id
      ORDER BY ae.created_at DESC LIMIT 100`).map(eventRowToResponse);
    res.json({ success: true, data: rows });
  });

  router.post('/verify-and-open', authMiddleware, requirePermission('access-control.verify'), async (req, res) => {
    try {
      const cfg = getSettings();
      const identities = all(`SELECT ai.*, t.template_b64, t.quality
        FROM access_identities ai
        JOIN access_fingerprint_templates t ON t.identity_id = ai.id AND t.is_merged = 1
        WHERE ai.status = 'active'
        ORDER BY ai.id ASC`);

      if (!identities.length) {
        return res.status(400).json({ success: false, error: 'No enrolled templates found' });
      }

      const capture = await bridgeRequest('/capture', 'POST');
      const identify = await bridgeRequest('/identify', 'POST', {
        probeTemplateB64: capture.template,
        candidates: identities.map(row => ({
          memberId: String(row.id),
          templateB64: row.template_b64
        }))
      });

      if (!identify.matched || !identify.memberId) {
        run(`INSERT INTO access_events (identity_id, member_id, event_type, direction, result, score, message, raw_json, created_at)
          VALUES (NULL, NULL, 'verify', 'entry', 'denied', ?, ?, ?, datetime('now'))`, [
          identify.score || 0, 'No fingerprint match', JSON.stringify({ capture, identify })
        ]);
        return res.status(200).json({ success: true, data: { allowed: false, matched: false, score: identify.score || 0, reason: 'No fingerprint match' } });
      }

      const identity = one('SELECT * FROM access_identities WHERE id = ?', [Number(identify.memberId)]);
      if (!identity) {
        return res.status(404).json({ success: false, error: 'Matched identity not found in local database' });
      }

      const score = Number(identify.score || 0);
      if (score < cfg.scoreThreshold) {
        run(`INSERT INTO access_events (identity_id, member_id, event_type, direction, result, score, message, raw_json, created_at)
          VALUES (?, ?, 'verify', 'entry', 'denied', ?, ?, ?, datetime('now'))`, [
          identity.id, identity.member_id || null, score, `Score below threshold (${cfg.scoreThreshold})`,
          JSON.stringify({ capture, identify, threshold: cfg.scoreThreshold })
        ]);
        return res.json({ success: true, data: { allowed: false, matched: true, score, threshold: cfg.scoreThreshold, identity, reason: 'Score below threshold' } });
      }

      let attendance = null;
      if (identity.member_id && cfg.allowMemberCheckin) {
        attendance = registerAttendanceForFingerprint(identity.member_id, req.user.id);
        if (!attendance.success) {
          run(`INSERT INTO access_events (identity_id, member_id, event_type, direction, result, score, message, raw_json, created_at)
            VALUES (?, ?, 'verify', 'entry', 'denied', ?, ?, ?, datetime('now'))`, [
            identity.id, identity.member_id, score, attendance.error || 'Member is not eligible',
            JSON.stringify({ capture, identify, attendance })
          ]);
          return res.json({ success: true, data: { allowed: false, matched: true, score, identity, member: attendance.member, reason: attendance.error } });
        }
      }

      const gate = await triggerGateOpen(identity, { score, attendanceLogId: attendance?.attendanceLogId || null, requestedBy: req.user.id });

      run(`INSERT INTO access_events (identity_id, member_id, event_type, direction, result, score, message, raw_json, created_at)
        VALUES (?, ?, 'verify', 'entry', 'granted', ?, ?, ?, datetime('now'))`, [
        identity.id, identity.member_id || null, score, gate.success ? 'Access granted' : 'Gate open request failed',
        JSON.stringify({ capture, identify, gate, attendance })
      ]);

      res.json({ success: true, data: {
        allowed: gate.success,
        matched: true,
        score,
        threshold: cfg.scoreThreshold,
        identity,
        gate,
        attendance,
      } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/settings', authMiddleware, requirePermission('access-control.settings.manage'), (req, res) => {
    res.json({ success: true, data: getSettings() });
  });

  router.post('/settings', authMiddleware, requirePermission('access-control.settings.manage'), (req, res) => {
    const payload = req.body || {};
    settingsService.set('access_control.bridge_url', payload.bridgeUrl || 'http://localhost:7001', { module: 'access-control', label: 'Bridge URL' });
    settingsService.set('access_control.score_threshold', Number(payload.scoreThreshold || 45), { type: 'number', module: 'access-control', label: 'Score Threshold' });
    settingsService.set('access_control.gate_provider', payload.gateProvider || 'mock', { module: 'access-control', label: 'Gate Provider' });
    settingsService.set('access_control.gate_open_url', payload.gateOpenUrl || '', { module: 'access-control', label: 'Gate Open URL' });
    settingsService.set('access_control.gate_secret', payload.gateSecret || '', { module: 'access-control', label: 'Gate Secret' });
    settingsService.set('access_control.allow_member_checkin', !!payload.allowMemberCheckin, { type: 'boolean', module: 'access-control', label: 'Create Attendance on Success' });
    settingsService.set('access_control.c3_panel_ip', payload.c3PanelIp || '192.168.1.201', { module: 'access-control', label: 'C3-100 Panel IP' });
    settingsService.set('access_control.c3_panel_port', Number(payload.c3PanelPort || 4370), { type: 'number', module: 'access-control', label: 'C3-100 Panel Port' });
    settingsService.set('access_control.c3_door_number', Number(payload.c3DoorNumber || 1), { type: 'number', module: 'access-control', label: 'C3-100 Door Number' });
    settingsService.set('access_control.c3_open_duration', Number(payload.c3OpenDuration || 5), { type: 'number', module: 'access-control', label: 'C3-100 Open Duration' });
    settingsService.set('access_control.c3_password', payload.c3Password || '', { module: 'access-control', label: 'C3-100 Password' });
    // ── C3 microservice bridge ──
    settingsService.set('access_control.c3_service_url', payload.c3ServiceUrl || '', { module: 'access-control', label: 'C3 Microservice URL' });
    settingsService.set('access_control.c3_service_enabled', !!payload.c3ServiceEnabled, { type: 'boolean', module: 'access-control', label: 'Enable C3 Turnstile Bridge' });
    // Secrets: only overwrite when a real new value is supplied (blank/mask keeps the stored one).
    const MASK = '••••••••';
    if (typeof payload.c3ServiceKey === 'string' && payload.c3ServiceKey.trim() && payload.c3ServiceKey !== MASK)
      settingsService.set('access_control.c3_service_key', payload.c3ServiceKey.trim(), { module: 'access-control', label: 'C3 Microservice API Key' });
    if (typeof payload.c3TokenSecret === 'string' && payload.c3TokenSecret.trim() && payload.c3TokenSecret !== MASK)
      settingsService.set('access_control.c3_token_secret', payload.c3TokenSecret.trim(), { module: 'access-control', label: 'QR Token HMAC Secret' });
    settingsService.set('access_control.c3_qr_mode', payload.c3QrMode === 'token' ? 'token' : 'code24', { module: 'access-control', label: 'QR Encoding Mode' });
    // ── Reception popup + debt policy ──
    settingsService.set('access_control.checkin_popup_enabled', !!payload.checkinPopupEnabled, { type: 'boolean', module: 'access-control', label: 'Reception Check-in Popup' });
    settingsService.set('access_control.debt_alert_threshold', Number(payload.debtAlertThreshold || 0), { type: 'number', module: 'access-control', label: 'Debt Alert Threshold' });
    settingsService.set('access_control.debt_block_enabled', !!payload.debtBlockEnabled, { type: 'boolean', module: 'access-control', label: 'Block Entry on Debt' });
    settingsService.set('access_control.debt_block_threshold', Number(payload.debtBlockThreshold || 0), { type: 'number', module: 'access-control', label: 'Debt Block Threshold' });
    settingsService.set('access_control.debt_block_grace_days', parseInt(payload.debtBlockGraceDays || 0, 10), { type: 'number', module: 'access-control', label: 'Debt Block Grace Days' });
    try { c3bridge.restart(); } catch (e) { console.warn('[c3] restart after settings save failed:', e.message); }
    res.json({ success: true, data: getSettings() });
  });

  // ── Templates per identity ──
  router.get('/identities/:id/templates', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const rows = all('SELECT * FROM access_fingerprint_templates WHERE identity_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json({ success: true, data: rows });
  });

  // ── Events per identity ──
  router.get('/identities/:id/events', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const rows = all('SELECT * FROM access_events WHERE identity_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    res.json({ success: true, data: rows });
  });

  // ── Devices CRUD ──
  router.get('/devices', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const rows = all('SELECT * FROM access_devices ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  });

  router.post('/devices', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    const { name, device_type, connection_type, bridge_url, gate_open_url } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'Device name is required' });
    const result = run(`INSERT INTO access_devices (name, device_type, connection_type, bridge_url, gate_open_url, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`, [
      name, device_type || 'fingerprint', connection_type || 'bridge', bridge_url || '', gate_open_url || ''
    ]);
    res.json({ success: true, data: one('SELECT * FROM access_devices WHERE id = ?', [result.lastInsertRowid]) });
  });

  router.put('/devices/:id', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    const current = one('SELECT * FROM access_devices WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ success: false, error: 'Device not found' });
    const p = req.body || {};
    run(`UPDATE access_devices SET name=?, device_type=?, connection_type=?, bridge_url=?, gate_open_url=?, is_active=?, settings_json=?, updated_at=datetime('now') WHERE id=?`, [
      p.name || current.name, p.device_type || current.device_type, p.connection_type || current.connection_type,
      p.bridge_url !== undefined ? p.bridge_url : current.bridge_url,
      p.gate_open_url !== undefined ? p.gate_open_url : current.gate_open_url,
      p.is_active !== undefined ? (p.is_active ? 1 : 0) : current.is_active,
      p.settings_json || current.settings_json || '{}',
      req.params.id
    ]);
    res.json({ success: true, data: one('SELECT * FROM access_devices WHERE id = ?', [req.params.id]) });
  });

  router.delete('/devices/:id', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    const current = one('SELECT * FROM access_devices WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ success: false, error: 'Device not found' });
    run('DELETE FROM access_devices WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ── Employee Identity Bootstrap ──
  router.post('/employees/:employeeId/bootstrap-identity', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    let employee;
    try { employee = one('SELECT * FROM hr_employees WHERE id = ?', [req.params.employeeId]); } catch (_) {}
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    let identity = one('SELECT * FROM access_identities WHERE employee_id = ?', [req.params.employeeId]);
    if (!identity) {
      const name = employee.full_name || `${employee.first_name} ${employee.last_name}`.trim();
      const result = run(`INSERT INTO access_identities (code, display_name, employee_id, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`, [employee.badge_id || null, name, employee.id, 'Employee identity']);
      const id = result.lastInsertRowid;
      if (!employee.badge_id) run('UPDATE access_identities SET code=?, updated_at=datetime("now") WHERE id=?', [codeForIdentity(id), id]);
      identity = one('SELECT * FROM access_identities WHERE id = ?', [id]);
    }
    res.json({ success: true, data: identity });
  });

  // ── Employee Verify & Clock ──
  router.post('/employee/verify-and-clock', authMiddleware, requirePermission('access-control.verify'), async (req, res) => {
    try {
      const cfg = getSettings();
      const identities = all(`SELECT ai.*, t.template_b64, t.quality
        FROM access_identities ai
        JOIN access_fingerprint_templates t ON t.identity_id = ai.id AND t.is_merged = 1
        WHERE ai.status = 'active' AND ai.employee_id IS NOT NULL
        ORDER BY ai.id ASC`);
      if (!identities.length) return res.status(400).json({ success: false, error: 'No enrolled employee templates' });

      const capture = await bridgeRequest('/capture', 'POST');
      const identify = await bridgeRequest('/identify', 'POST', {
        probeTemplateB64: capture.template,
        candidates: identities.map(row => ({ memberId: String(row.id), templateB64: row.template_b64 }))
      });

      if (!identify.matched || !identify.memberId) {
        run(`INSERT INTO access_events (identity_id, employee_id, event_type, direction, result, score, message, raw_json, created_at)
          VALUES (NULL, NULL, 'verify', 'entry', 'denied', ?, ?, ?, datetime('now'))`, [identify.score || 0, 'No employee fingerprint match', JSON.stringify({ capture, identify })]);
        return res.json({ success: true, data: { allowed: false, matched: false, reason: 'No match' } });
      }

      const identity = one('SELECT * FROM access_identities WHERE id = ?', [Number(identify.memberId)]);
      if (!identity || !identity.employee_id) return res.status(404).json({ success: false, error: 'Matched identity has no employee' });

      // Auto clock in or out
      let clockResult;
      const existingLog = one(`SELECT * FROM hr_attendance_logs WHERE employee_id = ? AND attendance_date = date('now') AND check_out IS NULL ORDER BY id DESC LIMIT 1`, [identity.employee_id]);
      if (existingLog) {
        // Clock out
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const worked = (new Date(now) - new Date(existingLog.check_in)) / 3600000;
        run(`UPDATE hr_attendance_logs SET check_out=?, worked_hours=?, updated_at=datetime('now') WHERE id=?`, [now, Number(worked.toFixed(2)), existingLog.id]);
        clockResult = { action: 'clock_out', worked_hours: Number(worked.toFixed(2)) };
      } else {
        // Clock in
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        run(`INSERT INTO hr_attendance_logs (employee_id, attendance_date, check_in, status, source, created_by) VALUES (?, date('now'), ?, 'present', 'fingerprint', ?)`, [identity.employee_id, now, req.user.id]);
        clockResult = { action: 'clock_in', check_in: now };
      }

      // Gate open
      const gate = await triggerGateOpen(identity, { score: identify.score, employeeId: identity.employee_id });

      run(`INSERT INTO access_events (identity_id, employee_id, event_type, direction, result, score, message, raw_json, created_at)
        VALUES (?, ?, 'verify', 'entry', 'granted', ?, ?, ?, datetime('now'))`, [
        identity.id, identity.employee_id, identify.score || 0, clockResult.action, JSON.stringify({ capture, identify, gate, clock: clockResult })]);

      res.json({ success: true, data: { allowed: true, matched: true, score: identify.score, identity, gate, clock: clockResult } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  eventBus.addFilter('dashboard.stats', (stats) => {
    const total = one("SELECT COUNT(*) as c FROM access_events WHERE date(created_at) = date('now')")?.c || 0;
    const granted = one("SELECT COUNT(*) as c FROM access_events WHERE date(created_at) = date('now') AND result = 'granted'")?.c || 0;
    stats.accessControlEventsToday = total;
    stats.accessControlSuccessRate = total ? Math.round((granted / total) * 100) + '%' : '0%';
    return stats;
  });

  // ── C3 Turnstile Bridge (single instance, single process) ──────────────────
  const c3bridge = createC3Service({ database, eventBus, log: console });
  c3bridge.start(); // no-op unless c3_service_enabled + c3_service_url are set

  // ── Reception check-in popup: SSE fan-out ─────────────────────────────────
  // Real-time channel to every open admin screen. handleScan emits
  // 'access.checkin.display'; we push it to all connected reception clients.
  const checkinClients = new Set();
  eventBus.on('access.checkin.display', (payload) => {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of checkinClients) { try { res.write(data); } catch (_) {} }
  });

  // EventSource can't send Authorization headers → verify a ?token= query JWT.
  app.get('/api/access-control/checkin-stream', (req, res) => {
    const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '') || (req.cookies && req.cookies.token);
    try { jwt.verify(token, config.jwt.secret); }
    catch (_) { return res.status(401).end(); }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    checkinClients.add(res);
    const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 25000);
    req.on('close', () => { clearInterval(beat); checkinClients.delete(res); });
  });

  // Fire a synthetic popup to all reception screens — for previewing each state
  // without a live scan (panel offline). Uses a real member if memberId given.
  router.post('/checkin/test-popup', authMiddleware, requirePermission('access-control.manage'), (req, res) => {
    const state = ['active', 'debt', 'blocked', 'expired', 'unknown'].includes(req.body.state) ? req.body.state : 'active';
    const policy = {
      debtAlertThreshold: Number(settingsService.get('access_control.debt_alert_threshold', 0) || 0),
      debtBlockEnabled: !!settingsService.get('access_control.debt_block_enabled', false),
      debtBlockThreshold: Number(settingsService.get('access_control.debt_block_threshold', 0) || 0),
      debtBlockGraceDays: parseInt(settingsService.get('access_control.debt_block_grace_days', 0) || 0, 10),
    };
    let member = null;
    if (req.body.memberId) member = one('SELECT id, member_no, first_name, last_name, first_name_ar, last_name_ar, phone, photo FROM members WHERE id = ?', [req.body.memberId]);
    const dmap = { active: ['ok', true], debt: ['debt_alert', true], blocked: ['debt_blocked', false], expired: ['expired', false], unknown: ['unknown', false] };
    const [reason, allowed] = dmap[state];
    const bal = state === 'debt' ? 25 : state === 'blocked' ? 60 : 0;
    const payload = {
      ts: new Date().toISOString(), preview: true,
      decision: { allowed, reason, state },
      door: { no: 1, opened: allowed },
      card_no: '12345678',
      member: state === 'unknown' ? null : (member ? {
        id: member.id, member_no: member.member_no, name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
        name_ar: `${member.first_name_ar || ''} ${member.last_name_ar || ''}`.trim(), phone: member.phone || '', photo: member.photo || '',
      } : { id: 0, member_no: 'TEST', name: 'Test Member', name_ar: 'عضو تجريبي', phone: '0790000000', photo: '' }),
      subscription: state === 'unknown' ? null : {
        plan_name: 'Monthly', start_date: '2026-06-01', end_date: state === 'expired' ? '2026-06-30' : '2026-09-01',
        days_remaining: state === 'expired' ? 0 : 55, billing_type: 'period', remaining_sessions: 0,
      },
      finance: state === 'unknown' ? null : { price: 40, paid: 40 - bal, balance_due: bal, outstanding: bal, currency: 'JOD' },
      policy,
    };
    eventBus.emit('access.checkin.display', payload);
    res.json({ success: true, data: { clients: checkinClients.size } });
  });

  // Recent check-ins (turnstile log)
  router.get('/check-ins', authMiddleware, requirePermission('access-control.view'), (req, res) => {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const rows = all(
      `SELECT ci.*, (m.first_name || ' ' || m.last_name) AS member_name
         FROM check_ins ci
         LEFT JOIN members m ON m.id = ci.member_id
        ORDER BY ci.id DESC LIMIT ?`, [limit]);
    res.json({ success: true, data: rows });
  });

  // Manual open via the microservice (proxy)
  router.post('/c3/open', authMiddleware, requirePermission('access-control.verify'), async (req, res) => {
    try {
      const data = await c3bridge.openDoor(`manual:${req.user ? req.user.id : '?'}`);
      res.json({ success: true, data });
    } catch (e) {
      res.status(502).json({ success: false, error: e.message });
    }
  });

  // Bridge + panel status (secrets masked)
  router.get('/c3/status', authMiddleware, requirePermission('access-control.view'), async (req, res) => {
    const c = c3bridge.cfg();
    const out = {
      enabled: c.enabled,
      baseUrl: c.baseUrl,
      keyConfigured: !!c.apiKey,
      secretConfigured: !!c.secret,
      allowlistCount: c3bridge.buildAllowlist().length,
      activeMembers: c3bridge.activeMemberIds().length,
      lastCursor: settingsService.get('access_control.c3_last_txn_at', '') || null,
    };
    try { out.panel = await c3bridge.svc('/health'); }
    catch (e) { out.panel = { error: e.message }; }
    res.json({ success: true, data: out });
  });

  app.use('/api/access-control', router);
};

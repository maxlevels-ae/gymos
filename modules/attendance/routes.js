const express = require('express');
const { authMiddleware } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus }) {
  const router = express.Router();
  const db = database;

  function addTimeline(memberId, type, title, desc, userId) {
    try { db.run('INSERT INTO member_timeline (member_id, event_type, title, description, created_by) VALUES (?,?,?,?,?)', [memberId, type, title, desc || '', userId || null]); } catch(_){}
  }

  function dateOnly(input) {
    if (!input) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(input))) return String(input);
    try { return new Date(input).toISOString().slice(0, 10); } catch (_) { return String(input).slice(0, 10); }
  }

  const membershipState = require('../../core/services/membership-state-service');
  function normalizeMembershipState(memberId) { return membershipState.syncMember(memberId); }

  // Check eligibility before check-in
  function checkEligibility(memberId) {
    const member = db.getOne('SELECT id, first_name, last_name, status, member_no, photo FROM members WHERE id = ?', [memberId]);
    if (!member) return { allowed: false, reason: 'Member not found', member: null };
    if (member.status !== 'active') return { allowed: false, reason: `Member is ${member.status}`, member };

    normalizeMembershipState(memberId);

    const existing = db.getOne("SELECT id FROM attendance_logs WHERE member_id = ? AND date(check_in) = date('now') AND check_out IS NULL AND was_denied = 0", [memberId]);
    if (existing) return { allowed: false, reason: 'Already checked in today', member };

    let membership = null;
    try {
      membership = db.getOne("SELECT * FROM memberships WHERE member_id = ? AND status IN ('active','scheduled') ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, start_date ASC, end_date DESC LIMIT 1", [memberId]);
    } catch(_) {}

    if (!membership) return { allowed: false, reason: 'No active membership', member };
    const today = dateOnly(new Date());
    if (membership.status === 'scheduled' || (membership.start_date && dateOnly(membership.start_date) > today)) {
      return { allowed: false, reason: 'Membership has not started yet', member, membership };
    }
    if (membership.end_date && dateOnly(membership.end_date) < today) return { allowed: false, reason: 'Membership expired', member, membership };
    if (membership.billing_type === 'sessions' && membership.remaining_sessions <= 0) return { allowed: false, reason: 'No sessions remaining', member, membership };

    return { allowed: true, reason: null, member, membership };
  }

  // ─── Stats ─────────────────────────────────────
  router.get('/stats', authMiddleware, (req, res) => {
    const today = db.getOne("SELECT COUNT(*) as c FROM attendance_logs WHERE date(check_in) = date('now') AND was_denied = 0")?.c || 0;
    const currentlyIn = db.getOne("SELECT COUNT(*) as c FROM attendance_logs WHERE date(check_in) = date('now') AND check_out IS NULL AND was_denied = 0")?.c || 0;
    const thisWeek = db.getOne("SELECT COUNT(*) as c FROM attendance_logs WHERE check_in >= date('now','weekday 0','-7 days') AND was_denied = 0")?.c || 0;
    const thisMonth = db.getOne("SELECT COUNT(*) as c FROM attendance_logs WHERE check_in >= date('now','start of month') AND was_denied = 0")?.c || 0;
    const hourly = db.getAll("SELECT CAST(strftime('%H', check_in) AS INTEGER) as hour, COUNT(*) as count FROM attendance_logs WHERE date(check_in) = date('now') AND was_denied = 0 GROUP BY hour ORDER BY hour");
    const weeklyHeatmap = db.getAll("SELECT CAST(strftime('%w', check_in) AS INTEGER) as dow, CAST(strftime('%H', check_in) AS INTEGER) as hour, COUNT(*) as count FROM attendance_logs WHERE check_in >= date('now','-30 days') AND was_denied = 0 GROUP BY dow, hour");
    res.json({ success: true, data: { today, currentlyIn, thisWeek, thisMonth, hourly, weeklyHeatmap } });
  });

  // ─── Eligibility check (for QR/front-desk) ────
  router.get('/eligibility/:memberId', authMiddleware, (req, res) => {
    const result = checkEligibility(Number(req.params.memberId));
    res.json({ success: true, data: result });
  });

  // ─── QR Check-in ───────────────────────────────
  router.post('/qr-checkin', authMiddleware, (req, res) => {
    const { qr_code } = req.body;
    if (!qr_code) return res.status(400).json({ success: false, error: 'QR code required' });
    const member = db.getOne('SELECT id FROM members WHERE qr_code = ?', [qr_code]);
    if (!member) return res.status(404).json({ success: false, error: 'Invalid QR code' });
    // Delegate to regular check-in
    req.body.member_id = member.id;
    req.body.method = 'qr';
    return doCheckIn(req, res);
  });

  // ─── Check-in ──────────────────────────────────
  function doCheckIn(req, res) {
    const { member_id, membership_id, branch_id, method } = req.body;
    if (!member_id) return res.status(400).json({ success: false, error: 'Member ID required' });

    const elig = checkEligibility(member_id);

    if (!elig.allowed) {
      // Log denied attempt
      db.run('INSERT INTO attendance_logs (member_id, branch_id, method, was_denied, denied_reason, checked_by) VALUES (?,?,?,1,?,?)',
        [member_id, branch_id || null, method || 'manual', elig.reason, req.user.id]);
      return res.status(400).json({ success: false, error: elig.reason, member: elig.member });
    }

    const msId = membership_id || elig.membership?.id;

    // Session decrement
    if (elig.membership?.billing_type === 'sessions') {
      db.run('UPDATE memberships SET used_sessions = used_sessions + 1, remaining_sessions = remaining_sessions - 1 WHERE id = ?', [msId]);
    }

    const result = db.run('INSERT INTO attendance_logs (member_id, membership_id, branch_id, method, checked_by) VALUES (?,?,?,?,?)',
      [member_id, msId || null, branch_id || req.user.branch_id || null, method || 'manual', req.user.id]);

    // Update member's last visit
    db.run("UPDATE members SET last_visit_at = datetime('now'), total_visits = total_visits + 1 WHERE id = ?", [member_id]);

    addTimeline(member_id, 'checkin', 'Checked In', `Via ${method || 'manual'}`, req.user.id);
    eventBus.emit('attendance.checkin', { member_id, logId: result.lastInsertRowid });
    res.json({ success: true, data: { id: result.lastInsertRowid, member: elig.member, remaining_sessions: elig.membership?.remaining_sessions ? elig.membership.remaining_sessions - 1 : null } });
  }

  router.post('/checkin', authMiddleware, doCheckIn);

  // ─── Check-out ─────────────────────────────────
  router.post('/checkout', authMiddleware, (req, res) => {
    const { member_id } = req.body;
    const log = db.getOne("SELECT id, check_in FROM attendance_logs WHERE member_id = ? AND date(check_in) = date('now') AND check_out IS NULL AND was_denied = 0 ORDER BY check_in DESC LIMIT 1", [member_id]);
    if (!log) return res.status(404).json({ success: false, error: 'No active check-in found' });
    const minutes = Math.round((Date.now() - new Date(log.check_in + 'Z').getTime()) / 60000);
    db.run("UPDATE attendance_logs SET check_out = datetime('now'), duration_minutes = ? WHERE id = ?", [minutes, log.id]);
    eventBus.emit('attendance.checkout', { member_id, logId: log.id, duration: minutes });
    res.json({ success: true, data: { duration_minutes: minutes } });
  });

  // ─── Quick search ──────────────────────────────
  router.get('/search', authMiddleware, (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const members = db.getAll(
      `SELECT m.id, m.member_no, m.first_name, m.last_name, m.phone, m.status, m.photo, m.qr_code,
              ms.id as membership_id, ms.plan_name, ms.billing_type, ms.remaining_sessions, ms.end_date, ms.status as ms_status
       FROM members m LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.status IN ('active','scheduled')
       WHERE m.member_no LIKE ? OR m.first_name LIKE ? OR m.last_name LIKE ? OR m.phone LIKE ? OR m.qr_code LIKE ?
       LIMIT 10`, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
    res.json({ success: true, data: members });
  });

  // ─── Currently in gym ──────────────────────────
  router.get('/currently-in', authMiddleware, (req, res) => {
    const list = db.getAll(
      `SELECT al.id, al.check_in, al.method, m.id as member_id, m.first_name, m.last_name, m.member_no, m.photo
       FROM attendance_logs al LEFT JOIN members m ON m.id = al.member_id
       WHERE date(al.check_in) = date('now') AND al.check_out IS NULL AND al.was_denied = 0
       ORDER BY al.check_in DESC`);
    res.json({ success: true, data: list });
  });

  // ─── Today's log ───────────────────────────────
  router.get('/today', authMiddleware, (req, res) => {
    const logs = db.getAll(
      `SELECT al.*, m.first_name, m.last_name, m.member_no, m.photo
       FROM attendance_logs al LEFT JOIN members m ON m.id = al.member_id
       WHERE date(al.check_in) = date('now') ORDER BY al.check_in DESC`);
    res.json({ success: true, data: logs });
  });

  // ─── History ───────────────────────────────────
  router.get('/', authMiddleware, (req, res) => {
    const { page = 1, limit = 30, member_id, from, to, branch_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = ['al.was_denied = 0'], params = [];
    if (member_id) { where.push('al.member_id = ?'); params.push(Number(member_id)); }
    if (from) { where.push('date(al.check_in) >= ?'); params.push(from); }
    if (to) { where.push('date(al.check_in) <= ?'); params.push(to); }
    if (branch_id) { where.push('al.branch_id = ?'); params.push(Number(branch_id)); }
    const wc = 'WHERE ' + where.join(' AND ');
    const logs = db.getAll(`SELECT al.*, m.first_name, m.last_name, m.member_no FROM attendance_logs al LEFT JOIN members m ON m.id=al.member_id ${wc} ORDER BY al.check_in DESC LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);
    const total = db.getOne(`SELECT COUNT(*) as c FROM attendance_logs al ${wc}`, params)?.c || 0;
    res.json({ success: true, data: logs, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // Dashboard
  eventBus.addFilter('dashboard.stats', (stats) => {
    stats.todayCheckins = db.getOne("SELECT COUNT(*) as c FROM attendance_logs WHERE date(check_in) = date('now') AND was_denied = 0")?.c || 0;
    stats.currentlyInGym = db.getOne("SELECT COUNT(*) as c FROM attendance_logs WHERE date(check_in) = date('now') AND check_out IS NULL AND was_denied = 0")?.c || 0;
    return stats;
  });

  app.use('/api/attendance', router);
};

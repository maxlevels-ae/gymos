const express = require('express');
const crypto = require('crypto');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus }) {
  const router = express.Router();
  const db = database;

  const sequenceService = require('../../core/services/sequence-service');
  sequenceService.initFromTable('member_no', 'members', 'member_no', 'M-');
  function generateMemberNo() { return sequenceService.next('member_no', 'M-', 4); }

  // ── Outbound messaging (WhatsApp via WaSender, in-app notifications) ──
  const settingsService = require('../../core/services/settings-service');
  function normalizePhone(p) {
    let s = String(p || '').replace(/[^\d+]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('00')) s = s.slice(2);
    if (s.startsWith('0')) s = '962' + s.slice(1);                 // Jordanian local → 962
    else if (!s.startsWith('962') && s.length <= 10) s = '962' + s;
    return s;
  }
  async function sendWhatsApp(phone, text) {
    const base = String(settingsService.get('marketing.wesender_base_url', '') || '').trim().replace(/\/$/, '');
    const token = String(settingsService.get('marketing.wesender_token', '') || '').trim();
    const sendPath = String(settingsService.get('marketing.wesender_send_path', '/api/send-message') || '/api/send-message').trim();
    const session = String(settingsService.get('marketing.wesender_session', '') || '').trim();
    if (!base || !token) return { sent: false, error: 'WhatsApp gateway not configured' };
    if (!phone) return { sent: false, error: 'Member has no phone number' };
    const to = '+' + normalizePhone(phone);
    try {
      const payload = { to, text };
      if (session) payload.session = session;
      const r = await fetch(base + sendPath, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
      const body = await r.text();
      if (!r.ok) return { sent: false, error: 'gateway ' + r.status + ': ' + String(body).slice(0, 180) };
      return { sent: true };
    } catch (e) { return { sent: false, error: e.message }; }
  }
  const pushService = require('../../core/services/push-service');
  function sendNotification(memberId, text) {
    try {
      db.run("INSERT INTO member_notifications (member_id, category, title, title_ar, body, body_ar, is_read, created_at) VALUES (?,?,?,?,?,?,0,datetime('now'))",
        [memberId, 'general', 'Message', 'رسالة من الإدارة', text, text]);
      try { pushService.pushToMember(memberId, { title: 'رسالة من الإدارة', body: text, category: 'general', url: '/member/' }).catch(() => {}); } catch (_) {}
      return { sent: true };
    } catch (e) { return { sent: false, error: e.message }; }
  }

  function generateQR() { return 'GYM-' + crypto.randomBytes(6).toString('hex').toUpperCase(); }

  function calcCompleteness(m) {
    const fields = ['email','phone','date_of_birth','gender','address','city','national_id'];
    const filled = fields.filter(f => m[f] && m[f] !== '').length;
    return Math.round((filled / fields.length) * 100);
  }

  // Canonicalize a phone number so local and international forms of the same number match
  // (e.g. "0793088001", "+962 79-308 8001" and "00962793088001" all canonicalize to "793088001").
  function canonPhone(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('962')) d = d.slice(3);   // Jordan country code
    if (d.startsWith('0')) d = d.slice(1);      // local trunk prefix
    return d;
  }

  // Returns { field, member } if another member already has the same (non-empty) phone/email, else null.
  // Empty values are skipped so multiple members without a phone/email are still allowed.
  const DUP_COLS = 'id, member_no, first_name, middle_name, last_name, phone, email';
  function findDuplicateMember({ email, phone }, excludeId = null) {
    const exId = excludeId != null ? Number(excludeId) : null;
    const em = String(email || '').trim().toLowerCase();
    const ph = canonPhone(phone);
    if (em) {
      const row = db.getOne(
        `SELECT ${DUP_COLS} FROM members WHERE email != '' AND LOWER(TRIM(email)) = ?${exId ? ' AND id != ?' : ''} LIMIT 1`,
        exId ? [em, exId] : [em]
      );
      if (row) return { field: 'email', member: row };
    }
    if (ph) {
      // Phone formats vary (local vs +962), so canonicalize each candidate in JS. The member table is small.
      const rows = db.getAll(
        `SELECT ${DUP_COLS} FROM members WHERE phone != ''${exId ? ' AND id != ?' : ''}`,
        exId ? [exId] : []
      );
      const hit = rows.find(r => canonPhone(r.phone) === ph);
      if (hit) return { field: 'phone', member: hit };
    }
    return null;
  }
  function duplicateError(field) {
    return field === 'email'
      ? 'يوجد عضو مسجّل بنفس البريد الإلكتروني · A member with this email already exists'
      : 'يوجد عضو مسجّل بنفس رقم الهاتف · A member with this phone number already exists';
  }
  // Build a 409 duplicate response that also points the client to the existing member (so the UI
  // can offer to open/edit that member instead of dead-ending).
  function duplicateResponse(dup) {
    const m = dup.member;
    const name = [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ').trim();
    return {
      success: false,
      error: duplicateError(dup.field),
      field: dup.field,
      existingMember: { id: m.id, member_no: m.member_no, name }
    };
  }

  function todayDateOnly() {
    try { return db.getOne("SELECT date('now','localtime') AS d")?.d || new Date().toISOString().slice(0, 10); } catch (_) { return new Date().toISOString().slice(0, 10); }
  }

  const membershipState = require('../../core/services/membership-state-service');
  function syncMemberMembershipState(memberId) { return membershipState.syncMember(memberId); }

  function decorateMembership(ms) { return membershipState.decorateMembership(ms); }

  function pickCurrentMembership(memberships) {
    const rows = (memberships || []).map(decorateMembership);
    return rows.find(ms => ms.status === 'active')
      || rows.find(ms => ms.status === 'frozen')
      || rows.find(ms => ms.status === 'scheduled')
      || rows.find(ms => ms.status === 'expired')
      || rows[0]
      || null;
  }

  function addTimeline(memberId, eventType, title, description, createdBy, meta) {
    db.run('INSERT INTO member_timeline (member_id, event_type, title, description, created_by, meta) VALUES (?,?,?,?,?,?)',
      [memberId, eventType, title, description || '', createdBy || null, JSON.stringify(meta || {})]);
  }

  // ─── Stats ─────────────────────────────────────
  router.get('/stats', authMiddleware, (req, res) => {
    const total = db.getOne('SELECT COUNT(*) as c FROM members')?.c || 0;
    const active = db.getOne("SELECT COUNT(*) as c FROM members WHERE status = 'active'")?.c || 0;
    const frozen = db.getOne("SELECT COUNT(*) as c FROM members WHERE status = 'frozen'")?.c || 0;
    const inactive = db.getOne("SELECT COUNT(*) as c FROM members WHERE status = 'inactive'")?.c || 0;
    const thisMonth = db.getOne("SELECT COUNT(*) as c FROM members WHERE joined_date >= date('now','start of month')")?.c || 0;
    const atRisk = db.getOne("SELECT COUNT(*) as c FROM members WHERE risk_level IN ('medium','high')")?.c || 0;
    const byGender = db.getAll("SELECT gender, COUNT(*) as count FROM members GROUP BY gender");
    const byLifecycle = db.getAll("SELECT lifecycle_stage, COUNT(*) as count FROM members GROUP BY lifecycle_stage");
    res.json({ success: true, data: { total, active, frozen, inactive, newThisMonth: thisMonth, atRisk, byGender, byLifecycle } });
  });

  // ─── Smart Filters / List ─────────────────────
  router.get('/', authMiddleware, requirePermission('members.view'), (req, res) => {
    const { page = 1, limit = 20, search = '', status = '', branch_id = '', gender = '',
            lifecycle = '', risk = '', sort = 'created_at', order = 'desc', filter = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = [], params = [];

    if (search) {
      const rawSearch = String(search).trim();
      const searchLike = `%${rawSearch}%`;
      const normalizedPhone = rawSearch.replace(/[^0-9]/g, '');
      where.push(`(
        m.first_name LIKE ? OR m.middle_name LIKE ? OR m.last_name LIKE ? OR
        TRIM(COALESCE(m.first_name,'') || ' ' || COALESCE(m.middle_name,'') || ' ' || COALESCE(m.last_name,'')) LIKE ? OR
        m.email LIKE ? OR m.phone LIKE ? OR m.member_no LIKE ? OR m.qr_code LIKE ?
        ${normalizedPhone ? "OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(m.phone,''), '+', ''), ' ', ''), '-', ''), '(', '') LIKE ?" : ''}
      )`);
      params.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike);
      if (normalizedPhone) params.push(`%${normalizedPhone}%`);
    }
    if (status) { where.push("m.status = ?"); params.push(status); }
    if (branch_id) { where.push("m.branch_id = ?"); params.push(Number(branch_id)); }
    if (gender) { where.push("m.gender = ?"); params.push(gender); }
    if (lifecycle) { where.push("m.lifecycle_stage = ?"); params.push(lifecycle); }
    if (risk) { where.push("m.risk_level = ?"); params.push(risk); }

    // Smart preset filters
    if (filter === 'at_risk') { where.push("m.risk_level IN ('medium','high')"); }
    if (filter === 'no_visit_30d') { where.push("(m.last_visit_at IS NULL OR m.last_visit_at < datetime('now','-30 days'))"); }
    if (filter === 'new_this_week') { where.push("m.joined_date >= date('now','-7 days')"); }
    if (filter === 'no_membership') {
      where.push("m.id NOT IN (SELECT DISTINCT member_id FROM memberships WHERE status = 'active')");
    }
    if (filter === 'expiring_soon') {
      where.push("m.id IN (SELECT member_id FROM memberships WHERE status='active' AND end_date BETWEEN date('now') AND date('now','+7 days'))");
    }
    if (filter === 'old_members') {
      where.push("m.joined_date < date('now','-90 days')");
    }
    if (filter === 'unpaid') {
      where.push("m.id IN (SELECT DISTINCT member_id FROM memberships WHERE payment_status IN ('unpaid','partial'))");
    }
    if (filter === 'expired') {
      where.push("m.id IN (SELECT member_id FROM memberships WHERE status='expired')");
    }
    if (filter === 'new_renewals') {
      where.push("m.id IN (SELECT member_id FROM memberships WHERE status='active' AND created_at >= date('now','-14 days') AND member_id IN (SELECT member_id FROM memberships GROUP BY member_id HAVING COUNT(*)>1))");
    }

    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const validSort = ['created_at','first_name','last_name','joined_date','last_visit_at','total_visits'].includes(sort) ? sort : 'created_at';
    const dir = order === 'asc' ? 'ASC' : 'DESC';

    const members = db.getAll(
      `SELECT m.*, b.name as branch_name FROM members m LEFT JOIN branches b ON b.id = m.branch_id ${wc} ORDER BY m.${validSort} ${dir} LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // Sync state and attach current membership info
    for (const mem of members) {
      try { syncMemberMembershipState(mem.id); } catch (_) {}
      try {
        const rows = db.getAll(`
          SELECT ms.*, mp.name as plan_display
          FROM memberships ms
          LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
          WHERE ms.member_id = ?
          ORDER BY
            CASE
              WHEN ms.status='active' THEN 0
              WHEN ms.status='frozen' THEN 1
              WHEN ms.status='scheduled' THEN 2
              WHEN ms.status='expired' THEN 3
              WHEN ms.status='cancelled' THEN 4
              ELSE 5
            END,
            date(COALESCE(ms.end_date, '9999-12-31')) DESC,
            datetime(ms.created_at) DESC,
            ms.id DESC
        `, [mem.id]) || [];
        const current = pickCurrentMembership(rows);
        mem.status = db.getOne('SELECT status FROM members WHERE id = ?', [mem.id])?.status || mem.status;
        mem.activePlan = current?.plan_display || current?.plan_name || null;
        mem.membershipEnd = current?.end_date || null;
        mem.paymentStatus = current?.payment_status || null;
        mem.membershipStatus = current?.status || null;
      } catch (_) {}
    }

    const total = db.getOne(`SELECT COUNT(*) as c FROM members m ${wc}`, params)?.c || 0;
    res.json({ success: true, data: members, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  // ─── Get One (full profile) ────────────────────
  router.get('/:id', authMiddleware, requirePermission('members.view'), (req, res) => {
    try { syncMemberMembershipState(req.params.id); } catch (_) {}
    const member = db.getOne('SELECT m.*, b.name as branch_name FROM members m LEFT JOIN branches b ON b.id = m.branch_id WHERE m.id = ?', [req.params.id]);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    member.contacts = db.getAll('SELECT * FROM member_contacts WHERE member_id = ?', [req.params.id]);
    member.memberNotes = db.getAll('SELECT mn.*, u.full_name as author FROM member_notes mn LEFT JOIN users u ON u.id = mn.user_id WHERE mn.member_id = ? ORDER BY mn.created_at DESC', [req.params.id]);
    member.timeline = db.getAll('SELECT * FROM member_timeline WHERE member_id = ? ORDER BY created_at DESC LIMIT 30', [req.params.id]);

    try {
      member.memberships = db.getAll(`
        SELECT ms.*, mp.name as plan_display,
               mp.freeze_max_days, mp.freeze_max_count, mp.freeze_allowed,
               mp.freeze_pricing_mode, mp.freeze_fixed_price, mp.freeze_price_per_day
        FROM memberships ms
        LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
        WHERE ms.member_id = ?
        ORDER BY
          CASE
            WHEN ms.status='active' THEN 0
            WHEN ms.status='frozen' THEN 1
            WHEN ms.status='scheduled' THEN 2
            WHEN ms.status='expired' THEN 3
            WHEN ms.status='cancelled' THEN 4
            ELSE 5
          END,
          date(COALESCE(ms.end_date, '9999-12-31')) DESC,
          datetime(ms.created_at) DESC,
          ms.id DESC
      `, [req.params.id]) || [];
      member.memberships = member.memberships.map(decorateMembership);
      // Attach active_freeze_id to frozen memberships so the UI can show unfreeze button
      for (const ms of member.memberships) {
        if (ms.status === 'frozen') {
          try {
            const af = db.getOne("SELECT id, end_date, start_date FROM freeze_requests WHERE membership_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [ms.id]);
            if (af) { ms.active_freeze_id = af.id; ms.active_freeze_end_date = af.end_date; ms.active_freeze_start_date = af.start_date; }
          } catch (_) {}
        }
      }
      member.activeMembership = pickCurrentMembership(member.memberships);
    } catch (_) { member.memberships = []; member.activeMembership = null; }

    try {
      member.recentAttendance = db.getAll("SELECT * FROM attendance_logs WHERE member_id = ? ORDER BY check_in DESC LIMIT 10", [req.params.id]);
      member.attendanceCount30d = db.getOne("SELECT COUNT(*) as c FROM attendance_logs WHERE member_id = ? AND check_in >= datetime('now','-30 days')", [req.params.id])?.c || 0;
    } catch (_) { member.recentAttendance = []; member.attendanceCount30d = 0; }

    // Profile completeness
    member.profile_completeness = calcCompleteness(member);

    // Alerts for this member
    member.alerts = [];
    if (member.activeMembership) {
      const ms = member.activeMembership;
      if (ms.end_date) {
        const daysLeft = Math.ceil((new Date(ms.end_date) - new Date()) / 86400000);
        if (daysLeft <= 0) member.alerts.push({ type: 'danger', text: 'Membership expired' });
        else if (daysLeft <= 7) member.alerts.push({ type: 'warning', text: `Membership expires in ${daysLeft} days` });
      }
      if (ms.payment_status === 'unpaid') member.alerts.push({ type: 'danger', text: 'Unpaid balance' });
      if (ms.payment_status === 'partial') member.alerts.push({ type: 'warning', text: 'Partial payment' });
      if (ms.type === 'sessions' && ms.remaining_sessions <= 2) member.alerts.push({ type: 'warning', text: `Only ${ms.remaining_sessions} sessions left` });
    } else if (member.status === 'active') {
      member.alerts.push({ type: 'info', text: 'No active membership' });
    }
    if (member.status === 'frozen') member.alerts.push({ type: 'info', text: 'Membership frozen' });
    if (member.profile_completeness < 60) member.alerts.push({ type: 'info', text: 'Incomplete profile' });

    res.json({ success: true, data: member });
  });

  // ─── Create ────────────────────────────────────
  router.post('/', authMiddleware, requirePermission('members.create'), (req, res) => {
    const { first_name, middle_name, last_name, first_name_ar, middle_name_ar, last_name_ar, email, phone, phone2,
            gender, date_of_birth, national_id, address, city, country, branch_id,
            source, notes, emergency_contact, lifecycle_stage } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ success: false, error: 'First and family name required' });

    // Prevent duplicate members sharing the same phone or email; point the UI to the existing member.
    const dup = findDuplicateMember({ email, phone });
    if (dup) return res.status(409).json(duplicateResponse(dup));

    const member_no = generateMemberNo();
    const qr_code = generateQR();

    try {
      const result = db.run(
        `INSERT INTO members (member_no, first_name, middle_name, last_name, first_name_ar, middle_name_ar, last_name_ar, email, phone, phone2,
         gender, date_of_birth, national_id, address, city, country, branch_id, source, notes, qr_code, lifecycle_stage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [member_no, first_name, middle_name || '', last_name, first_name_ar || '', middle_name_ar || '', last_name_ar || '', email || '', phone || '', phone2 || '',
         gender || 'male', date_of_birth || null, national_id || '', address || '', city || '', country || '', branch_id || null,
         source || '', notes || '', qr_code, lifecycle_stage || 'new']
      );
      const memberId = result.lastInsertRowid;

      if (emergency_contact?.name && emergency_contact?.phone) {
        db.run('INSERT INTO member_contacts (member_id, name, relationship, phone, is_emergency) VALUES (?, ?, ?, ?, 1)',
          [memberId, emergency_contact.name, emergency_contact.relationship || '', emergency_contact.phone]);
      }

      // Update completeness
      const mem = db.getOne('SELECT * FROM members WHERE id = ?', [memberId]);
      if (mem) db.run('UPDATE members SET profile_completeness = ? WHERE id = ?', [calcCompleteness(mem), memberId]);

      addTimeline(memberId, 'registered', 'Member Registered', `${[first_name, middle_name, last_name].filter(Boolean).join(' ')} joined as member ${member_no}`, req.user.id);
      eventBus.emit('member.created', { memberId, member_no });
      res.json({ success: true, data: { id: memberId, member_no, qr_code } });
    } catch (err) {
      if (err.message?.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'Duplicate entry' });
      throw err;
    }
  });

  // ─── Update ────────────────────────────────────
  router.put('/:id', authMiddleware, requirePermission('members.edit'), (req, res) => {
    const current = db.getOne('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ success: false, error: 'Member not found' });

    const payload = req.body || {};
    const first_name = String((payload.first_name ?? current.first_name ?? '')).trim();
    const middle_name = String((payload.middle_name ?? current.middle_name ?? '')).trim();
    const last_name = String((payload.last_name ?? current.last_name ?? '')).trim();
    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'First name and family name are required' });
    }

    const first_name_ar = payload.first_name_ar ?? current.first_name_ar ?? '';
    const middle_name_ar = payload.middle_name_ar ?? current.middle_name_ar ?? '';
    const last_name_ar = payload.last_name_ar ?? current.last_name_ar ?? '';
    const email = payload.email ?? current.email ?? '';
    const phone = payload.phone ?? current.phone ?? '';
    const phone2 = payload.phone2 ?? current.phone2 ?? '';
    const gender = payload.gender ?? current.gender ?? 'male';
    const date_of_birth = payload.date_of_birth ?? current.date_of_birth ?? null;
    const national_id = payload.national_id ?? current.national_id ?? '';
    const address = payload.address ?? current.address ?? '';
    const city = payload.city ?? current.city ?? '';
    const country = payload.country ?? current.country ?? '';
    const branch_id = payload.branch_id ?? current.branch_id ?? null;
    const status = payload.status ?? current.status ?? 'active';
    const source = payload.source ?? current.source ?? '';
    const notes = payload.notes ?? current.notes ?? '';
    const lifecycle_stage = payload.lifecycle_stage ?? current.lifecycle_stage ?? 'active';
    const waiver_signed = payload.waiver_signed !== undefined ? (payload.waiver_signed ? 1 : 0) : (current.waiver_signed ? 1 : 0);

    // Prevent an edit from colliding with another member's phone or email (exclude this member).
    const dup = findDuplicateMember({ email, phone }, req.params.id);
    if (dup) return res.status(409).json(duplicateResponse(dup));

    db.run(
      `UPDATE members SET first_name=?, middle_name=?, last_name=?, first_name_ar=?, middle_name_ar=?, last_name_ar=?, email=?, phone=?, phone2=?,
       gender=?, date_of_birth=?, national_id=?, address=?, city=?, country=?, branch_id=?,
       status=?, source=?, notes=?, lifecycle_stage=?, waiver_signed=?, updated_at=datetime('now') WHERE id=?`,
      [first_name, middle_name, last_name, first_name_ar, middle_name_ar, last_name_ar, email, phone, phone2,
       gender, date_of_birth, national_id, address, city, country, branch_id,
       status, source, notes, lifecycle_stage, waiver_signed, req.params.id]
    );

    const mem = db.getOne('SELECT * FROM members WHERE id = ?', [req.params.id]);
    if (mem) db.run('UPDATE members SET profile_completeness = ? WHERE id = ?', [calcCompleteness(mem), req.params.id]);

    if (current.status !== status) {
      addTimeline(req.params.id, 'status_change', 'Status Changed', `Status changed from ${current.status} to ${status}`, req.user.id);
    }
    eventBus.emit('member.updated', { memberId: req.params.id });
    res.json({ success: true });
  });

  // ─── QR Lookup ─────────────────────────────────
  router.get('/qr/:code', authMiddleware, (req, res) => {
    const member = db.getOne('SELECT id, member_no, first_name, middle_name, last_name, status, photo, qr_code FROM members WHERE qr_code = ?', [req.params.code]);
    if (!member) return res.status(404).json({ success: false, error: 'QR code not found' });
    res.json({ success: true, data: member });
  });

  // ─── Timeline ──────────────────────────────────
  router.get('/:id/timeline', authMiddleware, (req, res) => {
    const id = req.params.id;
    const limit = Number(req.query.limit || 80);
    const rows = db.getAll('SELECT id, event_type AS type, title, description, created_at FROM member_timeline WHERE member_id = ? ORDER BY created_at DESC LIMIT ?', [id, limit]);
    const fmt = v => Number(v || 0).toFixed(2);
    const methodAr = { cash: 'نقدي', card: 'بطاقة', bank: 'بنك', cliq: 'CliQ', click: 'كليك', visa: 'فيزا' };
    let pays = [];
    try {
      pays = db.getAll('SELECT id, amount, method, payment_date, created_at FROM membership_payments WHERE member_id = ? ORDER BY created_at DESC LIMIT 50', [id]).map(p => ({
        id: 'pay-' + p.id, type: 'payment', title: 'Membership payment', title_ar: 'دفعة اشتراك',
        description: 'Paid ' + fmt(p.amount) + ' JOD (' + (p.method || 'cash') + ')',
        description_ar: 'سدّد ' + fmt(p.amount) + ' د.أ (' + (methodAr[String(p.method || '').toLowerCase()] || p.method || 'نقدي') + ')',
        created_at: p.created_at || p.payment_date,
      }));
    } catch (_) {}
    let debts = [];
    try {
      debts = db.getAll("SELECT id, order_no, total, paid_total, created_at FROM cafeteria_orders WHERE member_id = ? AND (total - COALESCE(paid_total,0)) > 0.009 AND status NOT IN ('void','draft','cancelled','refunded') ORDER BY created_at DESC LIMIT 50", [id]).map(o => {
        const bal = Number(o.total || 0) - Number(o.paid_total || 0);
        return {
          id: 'debt-' + o.id, type: 'debt', title: 'Cafeteria', title_ar: 'الكافتيريا',
          description: 'Debt ' + fmt(bal) + ' JOD from cafeteria',
          description_ar: 'دين ' + fmt(bal) + ' د.أ من الكافتيريا' + (o.order_no ? ' · ' + o.order_no : ''),
          created_at: o.created_at,
        };
      });
    } catch (_) {}
    const all = [...rows, ...pays, ...debts]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, limit);
    res.json({ success: true, data: all });
  });

  // Outstanding balance for a member (cafeteria unpaid + membership balance due).
  router.get('/:id/balance', authMiddleware, (req, res) => {
    const id = req.params.id;
    const n = (v) => Number(v || 0);
    let cafeteria = 0, cafeteriaCount = 0, memberships = 0, membershipCount = 0;
    try {
      const c = db.getOne("SELECT COALESCE(SUM(total - COALESCE(paid_total,0)),0) s, COUNT(*) c FROM cafeteria_orders WHERE member_id = ? AND status NOT IN ('void','draft','cancelled','refunded') AND (total - COALESCE(paid_total,0)) > 0.009", [id]);
      cafeteria = n(c?.s); cafeteriaCount = n(c?.c);
    } catch (_) {}
    try {
      const m = db.getOne("SELECT COALESCE(SUM(balance_due),0) s, COUNT(*) c FROM memberships WHERE member_id = ? AND COALESCE(balance_due,0) > 0.009", [id]);
      memberships = n(m?.s); membershipCount = n(m?.c);
    } catch (_) {}
    let freezes = 0, freezeCount = 0;
    try {
      const f = db.getOne(`SELECT COALESCE(SUM(fr.price - COALESCE(fp.paid,0)),0) s, COUNT(*) c
        FROM freeze_requests fr
        LEFT JOIN (SELECT freeze_id, SUM(CASE WHEN direction='out' THEN -amount ELSE amount END) paid FROM freeze_payments WHERE status='completed' GROUP BY freeze_id) fp ON fp.freeze_id = fr.id
        WHERE fr.member_id = ? AND fr.status NOT IN ('cancelled') AND (fr.price - COALESCE(fp.paid,0)) > 0.009`, [id]);
      freezes = n(f?.s); freezeCount = n(f?.c);
    } catch (_) {}
    res.json({ success: true, data: {
      total: Number((cafeteria + memberships + freezes).toFixed(3)),
      cafeteria, cafeteriaCount, memberships, membershipCount, freezes, freezeCount,
    } });
  });

  // ─── Contacts CRUD ─────────────────────────────
  router.post('/:id/contacts', authMiddleware, (req, res) => {
    const { name, relationship, phone, is_emergency } = req.body;
    const result = db.run('INSERT INTO member_contacts (member_id, name, relationship, phone, is_emergency) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, name, relationship || '', phone, is_emergency ? 1 : 0]);
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  });
  router.delete('/:memberId/contacts/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM member_contacts WHERE id = ? AND member_id = ?', [req.params.id, req.params.memberId]);
    res.json({ success: true });
  });

  // ─── Notes / messages — logs to timeline AND delivers live (WhatsApp / notification) ───
  router.post('/:id/notes', authMiddleware, async (req, res) => {
    const { content, type } = req.body;
    const ty = String(type || 'note');
    if (!content || !String(content).trim()) return res.status(400).json({ success: false, error: 'Content required' });
    db.run('INSERT INTO member_notes (member_id, user_id, content, type) VALUES (?, ?, ?, ?)', [req.params.id, req.user.id, content, ty]);
    let result = { sent: null };
    if (ty === 'wa') {
      const m = db.getOne('SELECT phone FROM members WHERE id = ?', [req.params.id]);
      result = await sendWhatsApp(m && m.phone, content);
    } else if (ty === 'email') {
      const m = db.getOne('SELECT email FROM members WHERE id = ?', [req.params.id]);
      if (m && m.email) {
        try { const emailService = require('../../core/services/email-service'); const r = await emailService.sendEmail({ to: m.email, subject: emailService.company(), html: emailService.messageEmail({ title: emailService.company(), body: content }) }); result = { sent: r.ok, error: r.error }; }
        catch (e) { result = { sent: false, error: e.message }; }
      } else result = { sent: false, error: 'Member has no email' };
    } else if (ty === 'sms') {
      result = { sent: false, error: 'No SMS gateway configured' };
    } else if (ty === 'notif') {
      result = sendNotification(req.params.id, content);
    }
    const titleAr = { note: 'ملاحظة', notif: 'إشعار', wa: 'واتساب', sms: 'SMS', email: 'بريد إلكتروني' }[ty] || 'ملاحظة';
    const desc = content + (result.sent === false ? ' — ' + (result.error || 'لم يُرسل') : '');
    addTimeline(req.params.id, ty, titleAr, desc, req.user.id);
    res.json({ success: true, data: { channel: ty, sent: result.sent, error: result.error || null } });
  });

  // ─── Delete ────────────────────────────────────
  router.delete('/:id', authMiddleware, requirePermission('members.delete'), (req, res) => {
    db.run('DELETE FROM members WHERE id = ?', [req.params.id]);
    eventBus.emit('member.deleted', { memberId: req.params.id });
    res.json({ success: true });
  });

  // ─── Dashboard Stats + Alerts ──────────────────
  eventBus.addFilter('dashboard.stats', (stats) => {
    stats.totalMembers = db.getOne('SELECT COUNT(*) as c FROM members')?.c || 0;
    stats.activeMembers = db.getOne("SELECT COUNT(*) as c FROM members WHERE status='active'")?.c || 0;
    stats.newMembersThisMonth = db.getOne("SELECT COUNT(*) as c FROM members WHERE joined_date >= date('now','start of month')")?.c || 0;
    stats.atRiskMembers = db.getOne("SELECT COUNT(*) as c FROM members WHERE risk_level IN ('medium','high')")?.c || 0;
    return stats;
  });

  eventBus.addFilter('dashboard.alerts', (alerts) => {
    const noVisit = db.getOne("SELECT COUNT(*) as c FROM members WHERE status='active' AND (last_visit_at IS NULL OR last_visit_at < datetime('now','-14 days'))")?.c || 0;
    if (noVisit > 0) alerts.push({ type: 'warning', icon: 'alert-triangle', text: `${noVisit} active member(s) haven't visited in 14+ days`, link: '/members?filter=no_visit_30d' });

    const noMembership = db.getOne("SELECT COUNT(*) as c FROM members WHERE status='active' AND id NOT IN (SELECT DISTINCT member_id FROM memberships WHERE status='active')")?.c || 0;
    if (noMembership > 0) alerts.push({ type: 'info', icon: 'user-x', text: `${noMembership} member(s) without active membership`, link: '/members?filter=no_membership' });
    return alerts;
  });

  app.use('/api/members', router);
};

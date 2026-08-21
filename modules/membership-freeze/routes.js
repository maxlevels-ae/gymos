const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus, container }) {
  const router = express.Router();
  const db = database;
  function svc() { return container.resolve('membership-freeze.freeze-service'); }

  // Fix global defaults — ensure sensible values for existing installs
  try {
    const settingsSvc = container.resolve('settings');
    const fixes = [
      ['freeze.max_days_single', 30, 'number'],
      ['freeze.min_days', 1, 'number'],
    ];
    for (const [key, val, type] of fixes) {
      const current = settingsSvc.get(key);
      if (current === '15' || current === 15 || current === '3' || current === 3) {
        settingsSvc.set(key, val, { type, module: 'membership-freeze' });
      }
    }
  } catch (_) {}

  // Self-heal stale freezes: freeze_requests with status='active' but membership NOT 'frozen'
  // This fixes the bug where createRequest INSERT set status='active' but activate() skipped.
  try {
    const stale = db.getAll(`
      SELECT fr.id, fr.membership_id, fr.member_id, ms.status as ms_status
      FROM freeze_requests fr
      LEFT JOIN memberships ms ON ms.id = fr.membership_id
      WHERE fr.status = 'active' AND (ms.status IS NULL OR ms.status != 'frozen')
    `);
    for (const row of stale) {
      try {
        const result = svc().activate(row.id, null);
        if (!result.success) {
          // Can't activate — cancel the stale freeze to unblock
          svc().cancel(row.id, { reason: 'Auto-cancelled: stale freeze from bug fix', userId: null });
        }
      } catch (err) {
        console.error('[freeze] self-heal failed for freeze #' + row.id, err.message);
      }
    }
    if (stale.length > 0) console.log(`[freeze] self-healed ${stale.length} stale freeze(s)`);
  } catch (_) {}

  router.get('/stats', authMiddleware, requirePermission('freeze.view'), (_req, res) => res.json({ success:true, data:svc().getStats() }));
  router.get('/rules', authMiddleware, requirePermission('freeze.view'), (_req, res) => res.json({ success:true, data:svc().getRules() }));

  router.put('/rules', authMiddleware, requirePermission('freeze.settings'), (req, res) => {
    const settingsSvc = container.resolve('settings');
    const allowed = ['max_days_per_membership','max_times','min_days','max_days_single','require_payment','pricing_mode','price_per_day','fixed_price','pwa_requests_enabled','pwa_unfreeze_enabled','auto_approve_admin_created'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const type = ['price_per_day','fixed_price','max_days_per_membership','max_times','min_days','max_days_single'].includes(key) ? 'number' : (String(key).includes('enabled') || key === 'require_payment' ? 'boolean' : 'string');
        settingsSvc.set('freeze.' + key, req.body[key], { type, module:'membership-freeze' });
      }
    }
    res.json({ success:true, data:svc().getRules() });
  });

  router.get('/search-memberships', authMiddleware, requirePermission('freeze.view'), (req, res) => {
    const q = String(req.query.search || '').trim();
    if (!q) return res.json({ success:true, data:[] });
    const like = `%${q}%`;
    const rows = db.getAll(`
      SELECT ms.id, ms.member_id, ms.plan_name, ms.status, ms.end_date,
             m.first_name, m.middle_name, m.last_name, m.member_no, m.phone
      FROM memberships ms
      JOIN members m ON m.id = ms.member_id
      WHERE ms.status IN ('active','frozen')
        AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.middle_name LIKE ? OR m.member_no LIKE ? OR m.phone LIKE ? OR ms.plan_name LIKE ?)
      ORDER BY ms.id DESC LIMIT 20`, [like, like, like, like, like, like]);
    res.json({ success:true, data:rows });
  });

  router.get('/eligibility/:membershipId', authMiddleware, requirePermission('freeze.create'), (req, res) => res.json({ success:true, data:svc().getEligibility(Number(req.params.membershipId)) }));
  router.post('/preview', authMiddleware, requirePermission('freeze.create'), (req, res) => {
    const { membership_id, start_date, end_date } = req.body;
    const validation = svc().validate(Number(membership_id), start_date, end_date, 'admin');
    if (!validation.valid) return res.json({ success:true, data:{ valid:false, errors:validation.errors } });
    const price = svc().calculatePrice(validation.totalDays, validation.membership);
    res.json({ success:true, data:{ valid:true, totalDays:validation.totalDays, price, requiresPayment: price > 0 && validation.rules.requirePayment, currency: validation.rules.currency } });
  });

  router.get('/', authMiddleware, requirePermission('freeze.view'), (req, res) => {
    const { page = 1, limit = 20, status = '', member_id = '', membership_id = '', search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const where = [];
    const params = [];
    if (status) { where.push('fr.status = ?'); params.push(status); }
    if (member_id) { where.push('fr.member_id = ?'); params.push(Number(member_id)); }
    if (membership_id) { where.push('fr.membership_id = ?'); params.push(Number(membership_id)); }
    if (search) {
      where.push('(m.first_name LIKE ? OR m.last_name LIKE ? OR m.member_no LIKE ? OR m.phone LIKE ? OR ms.plan_name LIKE ? OR fr.receipt_no LIKE ?)');
      const s = `%${search}%`; params.push(s,s,s,s,s,s);
    }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sql = `SELECT fr.*, m.first_name, m.last_name, m.phone, m.member_no, ms.plan_name
                 FROM freeze_requests fr
                 LEFT JOIN members m ON m.id = fr.member_id
                 LEFT JOIN memberships ms ON ms.id = fr.membership_id
                 ${wc}
                 ORDER BY fr.created_at DESC LIMIT ? OFFSET ?`;
    const data = db.getAll(sql, [...params, Number(limit), offset]);
    const total = db.getOne(`SELECT COUNT(*) as c FROM freeze_requests fr LEFT JOIN members m ON m.id = fr.member_id LEFT JOIN memberships ms ON ms.id = fr.membership_id ${wc}`, params)?.c || 0;
    res.json({ success:true, data, meta:{ total, page:Number(page), limit:Number(limit) } });
  });

  router.get('/:id', authMiddleware, requirePermission('freeze.view'), (req, res) => {
    const freeze = svc().getById(Number(req.params.id));
    if (!freeze) return res.status(404).json({ success:false, error:'Freeze not found' });
    res.json({ success:true, data:freeze });
  });

  router.get('/:id/receipt', authMiddleware, requirePermission('freeze.view'), (req, res) => {
    const receipt = svc().getReceipt(Number(req.params.id));
    if (!receipt) return res.status(404).json({ success:false, error:'Freeze not found' });
    res.json({ success:true, data:receipt });
  });

  router.post('/', authMiddleware, requirePermission('freeze.create'), (req, res) => {
    const { membership_id, start_date, end_date, reason = '', pay = false, payment_method = 'cash' } = req.body;
    if (!membership_id || !start_date || !end_date) return res.status(400).json({ success:false, error:'membership_id, start_date and end_date are required' });
    const service = svc();
    const result = service.createRequest({ membershipId:Number(membership_id), startDate:start_date, endDate:end_date, reason, userId:req.user.id, source:'admin' });
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    let freeze = result.data;
    // A paid freeze that needs no approval: either collect the fee now (pay & freeze)
    // or freeze immediately and record the fee as a debt on the member.
    if (result.requiresPayment && !result.requiresApproval && freeze && freeze.id) {
      if (pay) {
        service.recordPayment(freeze.id, { method: payment_method, amount: freeze.price, userId: req.user.id });
      } else {
        service.activate(freeze.id, req.user.id, { allowUnpaid: true }); // fee becomes a debt
      }
      try { freeze = service.getById(freeze.id) || freeze; } catch (_) {}
    }
    res.json({ success:true, data:freeze, requiresPayment: !!result.requiresPayment, requiresApproval: !!result.requiresApproval, paid: !!pay });
  });

  router.post('/:id/approve', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().approve(Number(req.params.id), req.user.id);
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true, data:result.data || null });
  });

  router.post('/:id/pay', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().recordPayment(Number(req.params.id), { ...req.body, userId:req.user.id });
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true, data:result.data });
  });

  router.post('/:id/refund', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().refund(Number(req.params.id), { amount:req.body.amount, reason:req.body.reason || '', userId:req.user.id });
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true, data:result.data });
  });

  router.post('/:id/request-unfreeze', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().requestUnfreeze(Number(req.params.id), { reason:req.body.reason || '', userId:req.user.id, source:'admin' });
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true, data:result.data });
  });

  router.post('/:id/approve-unfreeze', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().approveUnfreeze(Number(req.params.id), req.user.id);
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true });
  });

  router.post('/:id/complete', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().complete(Number(req.params.id), req.user.id);
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true });
  });

  router.post('/:id/cancel', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().cancel(Number(req.params.id), { reason:req.body.reason || '', userId:req.user.id });
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true });
  });

  // Self-heal: re-run activate on a freeze that's stuck
  router.post('/:id/force-activate', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const result = svc().activate(Number(req.params.id), req.user.id);
    if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
    res.json({ success:true, data:result.data || null });
  });

  // Cancel all active/pending freezes for a membership (used by frontend to unblock)
  router.post('/cancel-by-membership/:membershipId', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const membershipId = Number(req.params.membershipId);
    const active = db.getAll("SELECT id FROM freeze_requests WHERE membership_id = ? AND status IN ('active','pending','requested')", [membershipId]);
    let cancelled = 0;
    for (const row of active) {
      try {
        const r = svc().cancel(row.id, { reason: req.body.reason || 'Cancelled by admin', userId: req.user.id });
        if (r.success) cancelled++;
      } catch (_) {}
    }
    res.json({ success: true, data: { cancelled } });
  });

  eventBus.addFilter('dashboard.stats', (stats) => {
    const freezeStats = svc().getStats();
    stats.activeFreezes = freezeStats.active;
    stats.freezeRevenue = freezeStats.revenueMonth;
    stats.freezeRequested = freezeStats.requested;
    return stats;
  });

  app.use('/api/freeze', router);
};
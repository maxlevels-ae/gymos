const express = require('express');
const database = require('../../core/database');
const settingsService = require('../../core/services/settings-service');
const auditService = require('../../core/services/audit-service');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const cafeteria = require('./services/cafeteria-service');

let _staleSweepHandle = null;

module.exports = function setup(app, { eventBus } = {}) {
  const router = express.Router();
  router.use(authMiddleware);

  function requireSuperAdminPassword(req, { action = 'cafeteria.super_admin.action' } = {}) {
    const provided = String(req.body?.password || req.body?.super_admin_password || '');
    const expected = String(settingsService.get('cafeteria.super_admin_pos_password', '') || '');
    if (!expected) throw new Error('Super admin password is not configured in Cafeteria Settings');
    if (!provided || provided !== expected) {
      auditService.log({ userId: req.user.id, action: 'cafeteria.super_admin.failed', entityType: 'settings', entityId: null, details: { action } });
      throw new Error('Invalid super admin password');
    }
  }

  const { cacheResponse: _cacheCaf } = require('../../core/middleware/response-cache');

  router.get('/dashboard', requirePermission('cafeteria.view'), _cacheCaf(15000), (req, res) => {
    res.json({ success: true, data: cafeteria.dashboardStats() });
  });

  router.get('/meta', requirePermission('cafeteria.view'), (req, res) => {
    res.json({ success: true, data: {
      currency: cafeteria.getCurrency(),
      paymentMethods: cafeteria.getEnabledPaymentMethods(),
      categories: cafeteria.listCategories(),
      warehouses: cafeteria.listWarehouses(),
      openSession: cafeteria.getOpenSessionForUser(req.user.id),
      currentUser: { id: req.user.id, username: req.user.username, full_name: req.user.full_name, role: req.user.role }
    } });
  });

  router.post('/super-admin/validate', requirePermission('cafeteria.pos.sell'), (req, res) => {
    try {
      requireSuperAdminPassword(req, { action: 'cafeteria.super_admin.validate' });
      res.json({ success: true, data: { valid: true } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/session/active', requirePermission('cafeteria.pos.open_session'), (req, res) => {
    res.json({ success: true, data: { session: cafeteria.getOpenSessionForUser(req.user.id), currency: cafeteria.getCurrency() } });
  });

  router.get('/products', requirePermission('cafeteria.view'), (req, res) => {
    res.json({ success: true, data: cafeteria.listProducts(req.query) });
  });
  router.post('/products', requirePermission('cafeteria.manage_products'), (req, res) => {
    const body = req.body || {};
    const result = database.run(`INSERT INTO cafeteria_products (name,name_ar,sku,barcode,category_id,selling_price,standard_cost,average_cost,tax_rate,image_url,is_active,product_type,uom,reorder_level,low_stock_threshold,availability_status,notes,allergens,tags,recipe_json,qty_on_hand)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      body.name, body.name_ar || '', body.sku || '', body.barcode || '', body.category_id || null, Number(body.selling_price || 0), Number(body.standard_cost || 0), Number(body.average_cost || body.standard_cost || 0), Number(body.tax_rate || 0), body.image_url || '', body.is_active === false ? 0 : 1, body.product_type || 'stockable', body.uom || 'Unit', Number(body.reorder_level || 0), Number(body.low_stock_threshold || 0), body.availability_status || 'available', body.notes || '', JSON.stringify(body.allergens || []), JSON.stringify(body.tags || []), JSON.stringify(body.recipe_json || []), Number(body.qty_on_hand || 0)
    ]);
    auditService.log({ userId: req.user.id, action: 'cafeteria.product.create', entityType: 'cafeteria_products', entityId: result.lastInsertRowid, details: body });
    res.json({ success: true, data: cafeteria.getProductById(result.lastInsertRowid) });
  });
  router.put('/products/:id', requirePermission('cafeteria.manage_products'), (req, res) => {
    const id = Number(req.params.id);
    const body = req.body || {};
    const existing = cafeteria.getProductById(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });
    database.run(`UPDATE cafeteria_products SET name=?,name_ar=?,sku=?,barcode=?,category_id=?,selling_price=?,standard_cost=?,average_cost=?,tax_rate=?,image_url=?,is_active=?,product_type=?,uom=?,reorder_level=?,low_stock_threshold=?,availability_status=?,notes=?,allergens=?,tags=?,recipe_json=?,updated_at=datetime('now') WHERE id=?`, [
      body.name ?? existing.name, body.name_ar ?? existing.name_ar, body.sku ?? existing.sku, body.barcode ?? existing.barcode, body.category_id ?? existing.category_id, Number(body.selling_price ?? existing.selling_price), Number(body.standard_cost ?? existing.standard_cost), Number(body.average_cost ?? existing.average_cost), Number(body.tax_rate ?? existing.tax_rate), body.image_url ?? existing.image_url, body.is_active === undefined ? existing.is_active : (body.is_active ? 1 : 0), body.product_type ?? existing.product_type, body.uom ?? existing.uom, Number(body.reorder_level ?? existing.reorder_level), Number(body.low_stock_threshold ?? existing.low_stock_threshold), body.availability_status ?? existing.availability_status, body.notes ?? existing.notes, JSON.stringify(body.allergens || JSON.parse(existing.allergens || '[]')), JSON.stringify(body.tags || JSON.parse(existing.tags || '[]')), JSON.stringify(body.recipe_json || JSON.parse(existing.recipe_json || '[]')), id
    ]);
    if (body.selling_price !== undefined || body.standard_cost !== undefined) {
      auditService.log({ userId: req.user.id, action: 'cafeteria.product.price_change', entityType: 'cafeteria_products', entityId: id, details: { from: { selling_price: existing.selling_price, standard_cost: existing.standard_cost }, to: { selling_price: body.selling_price, standard_cost: body.standard_cost } } });
    }
    res.json({ success: true, data: cafeteria.getProductById(id) });
  });

  router.get('/categories', requirePermission('cafeteria.view'), (_req, res) => {
    res.json({ success: true, data: cafeteria.listCategories() });
  });
  router.post('/categories', requirePermission('cafeteria.manage_categories'), (req, res) => {
    const b = req.body || {};
    const result = database.run(`INSERT INTO cafeteria_categories (name,name_ar,parent_id,icon,color,revenue_group,stock_group,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?)`, [b.name, b.name_ar || '', b.parent_id || null, b.icon || 'package', b.color || '#6366f1', b.revenue_group || '', b.stock_group || '', Number(b.sort_order || 0), b.is_active === false ? 0 : 1]);
    res.json({ success: true, data: database.getOne(`SELECT * FROM cafeteria_categories WHERE id=?`, [result.lastInsertRowid]) });
  });
  router.put('/categories/:id', requirePermission('cafeteria.manage_categories'), (req, res) => {
    const id = Number(req.params.id); const b = req.body || {}; const e = database.getOne(`SELECT * FROM cafeteria_categories WHERE id=?`, [id]);
    if (!e) return res.status(404).json({ success: false, error: 'Category not found' });
    database.run(`UPDATE cafeteria_categories SET name=?,name_ar=?,parent_id=?,icon=?,color=?,revenue_group=?,stock_group=?,sort_order=?,is_active=?,updated_at=datetime('now') WHERE id=?`, [b.name ?? e.name, b.name_ar ?? e.name_ar, b.parent_id ?? e.parent_id, b.icon ?? e.icon, b.color ?? e.color, b.revenue_group ?? e.revenue_group, b.stock_group ?? e.stock_group, Number(b.sort_order ?? e.sort_order), b.is_active === undefined ? e.is_active : (b.is_active ? 1 : 0), id]);
    res.json({ success: true, data: database.getOne(`SELECT * FROM cafeteria_categories WHERE id=?`, [id]) });
  });

  router.get('/warehouses', requirePermission('cafeteria.view'), (_req, res) => {
    res.json({ success: true, data: cafeteria.listWarehouses() });
  });
  router.post('/warehouses', requirePermission('cafeteria.manage_warehouses'), (req, res) => {
    const b = req.body || {};
    const result = database.run(`INSERT INTO cafeteria_warehouses (name,name_ar,code,branch_id,is_pos_default,is_active,notes) VALUES (?,?,?,?,?,?,?)`, [b.name, b.name_ar || '', b.code || '', b.branch_id || null, b.is_pos_default ? 1 : 0, b.is_active === false ? 0 : 1, b.notes || '']);
    res.json({ success: true, data: database.getOne(`SELECT * FROM cafeteria_warehouses WHERE id=?`, [result.lastInsertRowid]) });
  });
  router.put('/warehouses/:id', requirePermission('cafeteria.manage_warehouses'), (req, res) => {
    const id = Number(req.params.id); const b = req.body || {}; const e = database.getOne(`SELECT * FROM cafeteria_warehouses WHERE id=?`, [id]);
    if (!e) return res.status(404).json({ success: false, error: 'Warehouse not found' });
    database.run(`UPDATE cafeteria_warehouses SET name=?,name_ar=?,code=?,branch_id=?,is_pos_default=?,is_active=?,notes=?,updated_at=datetime('now') WHERE id=?`, [b.name ?? e.name, b.name_ar ?? e.name_ar, b.code ?? e.code, b.branch_id ?? e.branch_id, b.is_pos_default === undefined ? e.is_pos_default : (b.is_pos_default ? 1 : 0), b.is_active === undefined ? e.is_active : (b.is_active ? 1 : 0), b.notes ?? e.notes, id]);
    res.json({ success: true, data: database.getOne(`SELECT * FROM cafeteria_warehouses WHERE id=?`, [id]) });
  });

  router.get('/stock-moves', requirePermission('cafeteria.manage_inventory'), (req, res) => {
    const params = []; let sql = `SELECT sm.*, p.name AS product_name, p.name_ar AS product_name_ar, w.name AS warehouse_name FROM cafeteria_stock_moves sm LEFT JOIN cafeteria_products p ON p.id = sm.product_id LEFT JOIN cafeteria_warehouses w ON w.id = sm.warehouse_id WHERE 1=1`;
    if (req.query.product_id) { sql += ` AND sm.product_id = ?`; params.push(req.query.product_id); }
    if (req.query.warehouse_id) { sql += ` AND sm.warehouse_id = ?`; params.push(req.query.warehouse_id); }
    sql += ` ORDER BY sm.id DESC LIMIT 200`;
    res.json({ success: true, data: database.getAll(sql, params) });
  });
  router.post('/stock-moves', requirePermission('cafeteria.manage_inventory'), (req, res) => {
    try {
      const b = req.body || {};
      const type = b.move_type || 'adjustment';
      const sign = ['sale','waste','issue'].includes(type) ? -Math.abs(Number(b.qty || 0)) : Math.abs(Number(b.qty || 0));
      const result = cafeteria.applyStockMove({ productId: Number(b.product_id), warehouseId: Number(b.warehouse_id || 1), moveType: type, qty: sign, unitCost: Number(b.unit_cost || 0), referenceType: b.reference_type || '', referenceId: b.reference_id || null, notes: b.notes || '', userId: req.user.id });
      auditService.log({ userId: req.user.id, action: 'cafeteria.stock.adjust', entityType: 'cafeteria_stock_moves', entityId: result.moveId, details: b });
      res.json({ success: true, data: result });
    } catch (err) { res.status(400).json({ success: false, error: err.message }); }
  });

  router.get('/sessions', requirePermission('cafeteria.pos.open_session'), (_req, res) => {
    res.json({ success: true, data: database.getAll(`SELECT s.*, COUNT(o.id) AS orders_count, COALESCE(SUM(CASE WHEN o.status='paid' THEN o.total ELSE 0 END),0) AS sales_total FROM cafeteria_sessions s LEFT JOIN cafeteria_orders o ON o.session_id = s.id GROUP BY s.id ORDER BY s.id DESC LIMIT 100`) });
  });
  router.post('/sessions/open', requirePermission('cafeteria.pos.open_session'), (req, res) => {
    try { res.json({ success: true, data: cafeteria.openSession({ warehouseId: req.body?.warehouse_id, openingCash: req.body?.opening_cash, notes: req.body?.notes, user: req.user }) }); }
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
  });
  router.post('/sessions/:id/close', requirePermission('cafeteria.pos.close_session'), (req, res) => {
    try { res.json({ success: true, data: cafeteria.closeSession({ sessionId: Number(req.params.id), countedCash: req.body?.counted_cash, notes: req.body?.notes, user: req.user }) }); }
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
  });

  router.get('/orders', requirePermission('cafeteria.view'), (req, res) => {
    const params = []; let sql = `SELECT * FROM cafeteria_orders WHERE 1=1`;
    if (req.query.status) { sql += ` AND status = ?`; params.push(req.query.status); }
    sql += ` ORDER BY id DESC LIMIT 200`;
    res.json({ success: true, data: database.getAll(sql, params) });
  });
  router.get('/orders/last', requirePermission('cafeteria.pos.sell'), (req, res) => {
    try {
      const order = cafeteria.getLastPaidOrderForSession({ sessionId: req.query.session_id ? Number(req.query.session_id) : null, userId: req.user.id });
      res.json({ success: true, data: order });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
  router.get('/orders/:id', requirePermission('cafeteria.view'), (req, res) => {
    const order = cafeteria.getOrderById(Number(req.params.id));
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: order });
  });
  router.post('/orders', requirePermission('cafeteria.pos.sell'), (req, res) => {
    try {
      const created = cafeteria.createOrder({ order: req.body?.order || {}, lines: req.body?.lines || [], payment_lines: req.body?.payment_lines || [], user: req.user });
      if (created && created.status === 'paid' && eventBus) {
        eventBus.emit('cafeteria.order_completed', {
          id: created.id,
          order_no: created.order_no,
          order_date: created.created_at ? String(created.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
          total_amount: Number(created.total || 0),
          user_id: req.user.id
        });
      }
      res.json({ success: true, data: created });
    }
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
  });
  router.post('/orders/:id/void', requirePermission('cafeteria.pos.void'), (req, res) => {
    const order = database.getOne(`SELECT * FROM cafeteria_orders WHERE id=?`, [req.params.id]);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'held') return res.status(400).json({ success: false, error: 'Only held orders can be voided' });
    database.run(`UPDATE cafeteria_orders SET status='voided', void_reason=?, updated_at=datetime('now') WHERE id=?`, [req.body?.reason || '', req.params.id]);
    auditService.log({ userId: req.user.id, action: 'cafeteria.order.void', entityType: 'cafeteria_orders', entityId: req.params.id, details: { reason: req.body?.reason || '' } });
    res.json({ success: true });
  });
  router.post('/orders/:id/refund', requirePermission('cafeteria.pos.sell'), (req, res) => {
    try {
      requireSuperAdminPassword(req, { action: 'cafeteria.order.refund' });
      res.json({ success: true, data: cafeteria.refundOrder({ orderId: Number(req.params.id), lines: req.body?.lines || [], reason: req.body?.reason || '', refundPaymentMethod: req.body?.refund_payment_method || 'cash', user: req.user }) });
    }
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
  });
  router.post('/orders/:id/payment-method', requirePermission('cafeteria.pos.sell'), (req, res) => {
    try {
      requireSuperAdminPassword(req, { action: 'cafeteria.payment.adjust' });
      res.json({ success: true, data: cafeteria.changeOrderPaymentMethod({ orderId: Number(req.params.id), newPaymentMethod: req.body?.payment_method, reason: req.body?.reason || '', user: req.user }) });
    }
    catch (err) { res.status(400).json({ success: false, error: err.message }); }
  });

  router.get('/reports/summary', requirePermission('cafeteria.reports.view'), (req, res) => {
    res.json({ success: true, data: cafeteria.reportSummary(req.query || {}) });
  });

  router.get('/settings', requirePermission('cafeteria.settings.manage'), (_req, res) => {
    const rows = settingsService.getByModule('cafeteria');
    const obj = rows.reduce((acc, row) => { acc[row.key] = settingsService.cast(row.value, row.type); return acc; }, {});
    obj['app.currency'] = settingsService.get('app.currency', 'JOD');
    res.json({ success: true, data: obj });
  });
  router.put('/settings', requirePermission('cafeteria.settings.manage'), (req, res) => {
    const body = req.body || {};
    Object.entries(body).forEach(([key, value]) => {
      if (key === 'app.currency') settingsService.set('app.currency', value, { type: 'string', module: 'core' });
      else settingsService.set(key, value, { type: typeof value === 'boolean' ? 'boolean' : (typeof value === 'number' ? 'number' : (typeof value === 'object' ? 'json' : 'string')), module: 'cafeteria' });
    });
    res.json({ success: true });
  });

  // Member's active-plan cafeteria discount (%) — used by the POS to preview the discount.
  router.get('/member-discount/:memberId', requirePermission('cafeteria.pos.sell'), (req, res) => {
    res.json({ success: true, data: { percent: cafeteria.getMemberCafeteriaDiscount(Number(req.params.memberId)) } });
  });

  // ─── Cafeteria Debts ─────────────────────────────
  router.get('/debts', requirePermission('cafeteria.view'), (req, res) => {
    res.json({ success: true, data: cafeteria.getDebts({ member_id: req.query.member_id }) });
  });
  router.post('/debts/:orderId/settle', requirePermission('cafeteria.pos.sell'), (req, res) => {
    try {
      const result = cafeteria.settleDebt(Number(req.params.orderId), { method: req.body.method || 'cash', reference: req.body.reference || '', userId: req.user.id });
      res.json({ success: true, data: result });
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
  });

  app.use('/api/cafeteria', router);

  // Auto-close stale/abandoned POS sessions — run once at boot, then hourly.
  try { cafeteria.autoCloseStaleSessions(); } catch (_) {}
  if (!_staleSweepHandle) {
    _staleSweepHandle = setInterval(() => { try { cafeteria.autoCloseStaleSessions(); } catch (_) {} }, 60 * 60 * 1000);
    if (_staleSweepHandle.unref) _staleSweepHandle.unref();
  }
  app.get('/api/cafeteria-reports', authMiddleware, requirePermission('cafeteria.reports.view'), (req, res) => {
    res.json({ success: true, data: cafeteria.reportSummary(req.query || {}) });
  });

  // ─── Peak Hours Report ─────────────────────────────
  app.get('/api/reports/peak-hours', authMiddleware, (req, res) => {
    const days = Number(req.query.days || 30);
    try {
      const rows = database.getAll(`
        SELECT CAST(strftime('%H', check_in) AS INTEGER) as hour,
               COUNT(*) as visits,
               COUNT(DISTINCT member_id) as unique_members
        FROM attendance_logs
        WHERE check_in >= datetime('now', '-${Math.min(days, 365)} days')
          AND was_denied = 0
        GROUP BY hour ORDER BY hour
      `);
      // Fill gaps (0-23)
      const full = [];
      for (let h = 0; h < 24; h++) {
        const found = rows.find(r => r.hour === h);
        full.push({ hour: h, label: `${String(h).padStart(2, '0')}:00`, visits: found?.visits || 0, unique_members: found?.unique_members || 0 });
      }
      const peak = full.reduce((max, r) => r.visits > max.visits ? r : max, full[0]);
      // Day of week distribution
      const byDay = database.getAll(`
        SELECT CAST(strftime('%w', check_in) AS INTEGER) as dow,
               COUNT(*) as visits
        FROM attendance_logs
        WHERE check_in >= datetime('now', '-${Math.min(days, 365)} days') AND was_denied = 0
        GROUP BY dow ORDER BY dow
      `);
      const dayNames = { ar: ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'], en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] };
      const byDayFull = [];
      for (let d = 0; d < 7; d++) {
        const found = byDay.find(r => r.dow === d);
        byDayFull.push({ dow: d, dayAr: dayNames.ar[d], dayEn: dayNames.en[d], visits: found?.visits || 0 });
      }
      res.json({ success: true, data: { hours: full, peakHour: peak, byDay: byDayFull, days } });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ─── Monthly Comparison Report ─────────────────────
  app.get('/api/reports/monthly-comparison', authMiddleware, (req, res) => {
    const months = Math.min(Number(req.query.months || 6), 12);
    try {
      const rows = [];
      for (let i = 0; i < months; i++) {
        const offset = `-${i} months`;
        const monthStart = database.getOne(`SELECT date('now','start of month','${offset}') as d`)?.d;
        const monthEnd = database.getOne(`SELECT date('now','start of month','${offset}','+1 month','-1 day') as d`)?.d;
        const label = monthStart ? monthStart.slice(0, 7) : '';
        const revenue = database.getOne(`SELECT COALESCE(SUM(total_paid),0) as t FROM memberships WHERE created_at >= ? AND created_at <= ? || ' 23:59:59'`, [monthStart, monthEnd])?.t || 0;
        const cafRevenue = database.getOne(`SELECT COALESCE(SUM(total),0) as t FROM cafeteria_orders WHERE status IN ('paid','debt') AND created_at >= ? AND created_at <= ? || ' 23:59:59'`, [monthStart, monthEnd])?.t || 0;
        const newMembers = database.getOne(`SELECT COUNT(*) as c FROM members WHERE joined_date >= ? AND joined_date <= ?`, [monthStart, monthEnd])?.c || 0;
        const newMemberships = database.getOne(`SELECT COUNT(*) as c FROM memberships WHERE created_at >= ? AND created_at <= ? || ' 23:59:59'`, [monthStart, monthEnd])?.c || 0;
        const renewals = database.getOne(`SELECT COUNT(*) as c FROM memberships WHERE created_at >= ? AND created_at <= ? || ' 23:59:59' AND member_id IN (SELECT member_id FROM memberships GROUP BY member_id HAVING COUNT(*) > 1)`, [monthStart, monthEnd])?.c || 0;
        const attendance = database.getOne(`SELECT COUNT(*) as c FROM attendance_logs WHERE check_in >= ? AND check_in <= ? || ' 23:59:59' AND was_denied = 0`, [monthStart, monthEnd])?.c || 0;
        const expired = database.getOne(`SELECT COUNT(*) as c FROM memberships WHERE end_date >= ? AND end_date <= ? AND status='expired'`, [monthStart, monthEnd])?.c || 0;
        const renewalRate = expired > 0 ? Math.round((renewals / (expired + renewals)) * 100) : (renewals > 0 ? 100 : 0);
        rows.push({ month: label, revenue, cafRevenue, totalRevenue: revenue + cafRevenue, newMembers, newMemberships, renewals, renewalRate, attendance, expired });
      }
      res.json({ success: true, data: rows.reverse() });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });
};

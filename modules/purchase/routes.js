const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const { validateBody, schemas } = require('../../core/middleware/validation');
const settingsService = require('../../core/services/settings-service');
const auditService = require('../../core/services/audit-service');
const sequenceService = require('../../core/services/sequence-service');

module.exports = function setup(app, { database, eventBus }) {
  const router = express.Router();
  router.use(authMiddleware);

  const db = database;
  const q   = (sql, p=[]) => db.getAll(sql, p);
  const one = (sql, p=[]) => db.getOne(sql, p);
  const run = (sql, p=[]) => db.run(sql, p);

  // ── Settings defaults ─────────────────────────────────────
  function ensureDefaults() {
    const defaults = [
      ['purchase.po_prefix',           'PO-',    'string'],
      ['purchase.rfq_prefix',          'RFQ-',   'string'],
      ['purchase.default_currency',    'JOD',    'string'],
      ['purchase.require_approval',    false,    'boolean'],
      ['purchase.approval_min_amount', '5000',   'string'],
      ['purchase.default_lead_days',   '7',      'string'],
      ['purchase.auto_create_bill',    false,    'boolean'],
      ['purchase.lock_confirmed_po',   true,     'boolean'],
    ];
    defaults.forEach(([key, val, type]) => {
      if (settingsService.get(key) === null)
        settingsService.set(key, val, { type, module: 'purchase', label: key });
    });
  }
  try { ensureDefaults(); } catch(_) {}

  // ── Number generators ─────────────────────────────────────
  function nextNumber(table, col, prefixKey, fallback) {
    const prefix = settingsService.get(prefixKey, fallback);
    const seqName = `${table}_${col}`;
    sequenceService.initFromTable(seqName, table, col, prefix);
    return sequenceService.next(seqName, prefix, 5);
  }

  function nextStandaloneCode(sequenceName, prefix, table, column) {
    sequenceService.initFromTable(sequenceName, table, column, prefix);
    return sequenceService.next(sequenceName, prefix, 4);
  }

  // ── Totals calculator ─────────────────────────────────────
  function calcLineTotals(lines) {
    let subtotal = 0, tax = 0;
    const computed = lines.map(l => {
      const qty = Number(l.qty_ordered || l.qty || 1);
      const price = Number(l.unit_price || 0);
      const disc = Number(l.discount_pct || 0);
      const taxRate = Number(l.tax_rate || 0);
      const base = qty * price * (1 - disc / 100);
      const lineTax = base * (taxRate / 100);
      subtotal += base;
      tax += lineTax;
      return { ...l, line_subtotal: base, line_total: base + lineTax };
    });
    return { lines: computed, subtotal, tax_amount: tax, total_amount: subtotal + tax };
  }

  // ── Update order totals from lines ────────────────────────
  function refreshOrderTotals(orderId) {
    const lines = q(`SELECT * FROM po_order_lines WHERE order_id=?`, [orderId]);
    const sub  = lines.reduce((s,l) => s + Number(l.line_subtotal||0), 0);
    const tax  = lines.reduce((s,l) => s + Number(l.line_total||0) - Number(l.line_subtotal||0), 0);
    const tot  = sub + tax;
    run(`UPDATE po_orders SET subtotal=?,tax_amount=?,total_amount=?,updated_at=datetime('now') WHERE id=?`,
        [sub, tax, tot, orderId]);
  }

  // ── Update receipt status on order ────────────────────────
  function refreshOrderReceiptStatus(orderId) {
    const lines = q(`SELECT qty_ordered, qty_received FROM po_order_lines WHERE order_id=?`, [orderId]);
    if (!lines.length) return;
    const totalOrdered  = lines.reduce((s,l) => s + Number(l.qty_ordered||0), 0);
    const totalReceived = lines.reduce((s,l) => s + Number(l.qty_received||0), 0);
    let status = 'pending';
    if (totalReceived >= totalOrdered && totalOrdered > 0) status = 'full';
    else if (totalReceived > 0) status = 'partial';
    run(`UPDATE po_orders SET receipt_status=?,updated_at=datetime('now') WHERE id=?`, [status, orderId]);
  }

  // ── Update billing status on order ────────────────────────
  function refreshOrderBillingStatus(orderId) {
    const lines = q(`SELECT qty_ordered, qty_billed FROM po_order_lines WHERE order_id=?`, [orderId]);
    if (!lines.length) return;
    const totalOrdered = lines.reduce((s,l) => s + Number(l.qty_ordered||0), 0);
    const totalBilled  = lines.reduce((s,l) => s + Number(l.qty_billed||0), 0);
    let status = 'nothing';
    if (totalBilled >= totalOrdered && totalOrdered > 0) status = 'billed';
    else if (totalBilled > 0) status = 'partial';
    const billTotal = one(`SELECT COALESCE(SUM(total_amount),0) as v FROM po_bills WHERE order_id=?`, [orderId])?.v || 0;
    run(`UPDATE po_orders SET billing_status=?,amount_billed=?,updated_at=datetime('now') WHERE id=?`,
        [status, billTotal, orderId]);
  }

  // ════════════════════════════════════════════════════════════
  // BOOTSTRAP
  // ════════════════════════════════════════════════════════════
  router.get('/bootstrap', requirePermission('purchase.view'), (req, res) => {
    const cur = settingsService.get('app.currency', settingsService.get('purchase.default_currency','JOD'));
    res.json({
      success: true,
      data: {
        currency: cur,
        settings: {
          require_approval: settingsService.get('purchase.require_approval', false),
          auto_create_bill: settingsService.get('purchase.auto_create_bill', false),
          lock_confirmed_po: settingsService.get('purchase.lock_confirmed_po', true),
          approval_min_amount: Number(settingsService.get('purchase.approval_min_amount','5000')),
          default_lead_days: Number(settingsService.get('purchase.default_lead_days','7')),
          default_currency: cur,
        },
        vendors:  q(`SELECT id, name, name_ar, currency, payment_terms FROM po_vendors WHERE is_active=1 ORDER BY name`),
        products: q(`SELECT id, name, name_ar, uom, standard_price, last_purchase_price, tax_rate FROM po_products WHERE is_active=1 ORDER BY name`),
        branches: db.tableExists('branches') ? q(`SELECT id, name FROM branches WHERE is_active=1 ORDER BY name`) : [],
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════
  const { cacheResponse: _cachePurch } = require('../../core/middleware/response-cache');

  router.get('/dashboard', requirePermission('purchase.view'), _cachePurch(15000), (req, res) => {
    if (!db.tableExists('po_orders')) {
      return res.json({ success:true, data:{ rfqCount:0, poCount:0, doneCount:0, toReceive:0, toBill:0, mtdSpend:0, ytdSpend:0, pendingBillAmount:0, topVendors:[], recentOrders:[], byCategory:[] } });
    }
    const rfqCount    = one(`SELECT COUNT(*) as c FROM po_orders WHERE state IN ('draft','sent')`)?.c || 0;
    const poCount     = one(`SELECT COUNT(*) as c FROM po_orders WHERE state IN ('confirmed','approved')`)?.c || 0;
    const doneCount   = one(`SELECT COUNT(*) as c FROM po_orders WHERE state='done'`)?.c || 0;
    const toReceive   = one(`SELECT COUNT(*) as c FROM po_orders WHERE state IN ('confirmed','approved') AND receipt_status IN ('pending','partial')`)?.c || 0;
    const toBill      = one(`SELECT COUNT(*) as c FROM po_orders WHERE state IN ('confirmed','approved','done') AND billing_status IN ('nothing','partial')`)?.c || 0;
    const mtdSpend    = one(`SELECT COALESCE(SUM(total_amount),0) as v FROM po_orders WHERE state NOT IN ('draft','cancelled') AND substr(order_date,1,7)=substr(date('now'),1,7)`)?.v || 0;
    const ytdSpend    = one(`SELECT COALESCE(SUM(total_amount),0) as v FROM po_orders WHERE state NOT IN ('draft','cancelled') AND substr(order_date,1,4)=substr(date('now'),1,4)`)?.v || 0;
    const pendingBillAmount = one(`SELECT COALESCE(SUM(total_amount-amount_billed),0) as v FROM po_orders WHERE billing_status IN ('nothing','partial') AND state NOT IN ('draft','cancelled')`)?.v || 0;
    const topVendors  = q(`SELECT vendor_name, COUNT(*) as orders, COALESCE(SUM(total_amount),0) as spend FROM po_orders WHERE state NOT IN ('draft','cancelled') GROUP BY vendor_name ORDER BY spend DESC LIMIT 5`);
    const recentOrders = q(`SELECT id,po_number,vendor_name,order_date,state,total_amount,receipt_status,billing_status FROM po_orders ORDER BY id DESC LIMIT 8`);
    const byCategory  = q(`SELECT COALESCE(p.category,'general') as category, COUNT(*) as lines, COALESCE(SUM(l.line_total),0) as amount FROM po_order_lines l LEFT JOIN po_products p ON p.id=l.product_id GROUP BY COALESCE(p.category,'general') ORDER BY amount DESC LIMIT 6`);
    res.json({ success:true, data:{ rfqCount, poCount, doneCount, toReceive, toBill, mtdSpend, ytdSpend, pendingBillAmount, topVendors, recentOrders, byCategory } });
  });

  // ════════════════════════════════════════════════════════════
  // VENDORS
  // ════════════════════════════════════════════════════════════
  router.get('/vendors', requirePermission('purchase.view'), (req, res) => {
    const { search='' } = req.query;
    const where = search ? `WHERE (name LIKE ? OR code LIKE ? OR email LIKE ?)` : `WHERE 1=1`;
    const params = search ? [`%${search}%`,`%${search}%`,`%${search}%`] : [];
    res.json({ success:true, data: q(`SELECT * FROM po_vendors ${where} ORDER BY name`, params) });
  });

  router.get('/vendors/:id', requirePermission('purchase.view'), (req, res) => {
    const v = one(`SELECT * FROM po_vendors WHERE id=?`, [req.params.id]);
    if (!v) return res.status(404).json({ success:false, error:'Not found' });
    const orders = q(`SELECT id,po_number,order_date,state,total_amount FROM po_orders WHERE vendor_id=? ORDER BY id DESC LIMIT 10`, [req.params.id]);
    const pricelists = q(`SELECT pl.*, p.name as product_name FROM po_vendor_pricelists pl JOIN po_products p ON p.id=pl.product_id WHERE pl.vendor_id=?`, [req.params.id]);
    res.json({ success:true, data:{ ...v, orders, pricelists } });
  });

  router.post('/vendors', requirePermission('purchase.manage_vendors'), validateBody(schemas.purchaseVendor), (req, res) => {
    const b = req.validatedBody;
    const code = b.code || nextStandaloneCode('po_vendors_code', 'VND-', 'po_vendors', 'code');
    const r = run(`INSERT INTO po_vendors (code,name,name_ar,email,phone,mobile,contact_name,address,city,country,tax_number,payment_terms,currency,bank_name,bank_account,bank_iban,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [code,b.name,b.name_ar||'',b.email||'',b.phone||'',b.mobile||'',b.contact_name||'',b.address||'',b.city||'',b.country||'',b.tax_number||'',Number(b.payment_terms||30),b.currency||settingsService.get('app.currency', settingsService.get('purchase.default_currency','JOD')),b.bank_name||'',b.bank_account||'',b.bank_iban||'',b.notes||'']);
    res.json({ success:true, data:{ id:r.lastInsertRowid, code } });
  });

  router.put('/vendors/:id', requirePermission('purchase.manage_vendors'), validateBody(schemas.purchaseVendor), (req, res) => {
    const b = req.validatedBody;
    run(`UPDATE po_vendors SET name=?,name_ar=?,email=?,phone=?,mobile=?,contact_name=?,address=?,city=?,country=?,tax_number=?,payment_terms=?,currency=?,bank_name=?,bank_account=?,bank_iban=?,notes=?,is_active=?,updated_at=datetime('now') WHERE id=?`,
      [b.name,b.name_ar||'',b.email||'',b.phone||'',b.mobile||'',b.contact_name||'',b.address||'',b.city||'',b.country||'',b.tax_number||'',Number(b.payment_terms||30),b.currency||settingsService.get('app.currency', settingsService.get('purchase.default_currency','JOD')),b.bank_name||'',b.bank_account||'',b.bank_iban||'',b.notes||'',b.is_active===false?0:1,req.params.id]);
    res.json({ success:true });
  });

  // ════════════════════════════════════════════════════════════
  // PRODUCTS
  // ════════════════════════════════════════════════════════════
  router.get('/products', requirePermission('purchase.view'), (req, res) => {
    const { search='', category='' } = req.query;
    const where=['1=1']; const params=[];
    if (search) { where.push('(name LIKE ? OR code LIKE ?)'); params.push(`%${search}%`,`%${search}%`); }
    if (category) { where.push('category=?'); params.push(category); }
    res.json({ success:true, data: q(`SELECT * FROM po_products WHERE ${where.join(' AND ')} ORDER BY name`, params) });
  });

  router.post('/products', requirePermission('purchase.manage_products'), validateBody(schemas.purchaseProduct), (req, res) => {
    const b = req.validatedBody;
    const code = b.code || nextStandaloneCode('po_products_code', 'ITEM-', 'po_products', 'code');
    const r = run(`INSERT INTO po_products (code,name,name_ar,description,category,uom,standard_price,last_purchase_price,min_qty,reorder_qty,on_hand_qty,tax_rate,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [code,b.name,b.name_ar||'',b.description||'',b.category||'general',b.uom||'unit',Number(b.standard_price||0),Number(b.last_purchase_price||0),Number(b.min_qty||0),Number(b.reorder_qty||0),Number(b.on_hand_qty||0),Number(b.tax_rate||0),b.notes||'']);
    res.json({ success:true, data:{ id:r.lastInsertRowid, code } });
  });

  router.put('/products/:id', requirePermission('purchase.manage_products'), validateBody(schemas.purchaseProduct), (req, res) => {
    const b = req.validatedBody;
    run(`UPDATE po_products SET name=?,name_ar=?,description=?,category=?,uom=?,standard_price=?,last_purchase_price=?,min_qty=?,reorder_qty=?,on_hand_qty=?,tax_rate=?,notes=?,is_active=?,updated_at=datetime('now') WHERE id=?`,
      [b.name,b.name_ar||'',b.description||'',b.category||'general',b.uom||'unit',Number(b.standard_price||0),Number(b.last_purchase_price||0),Number(b.min_qty||0),Number(b.reorder_qty||0),Number(b.on_hand_qty||0),Number(b.tax_rate||0),b.notes||'',b.is_active===false?0:1,req.params.id]);
    res.json({ success:true });
  });

  // ════════════════════════════════════════════════════════════
  // PURCHASE ORDERS (RFQ + PO)
  // ════════════════════════════════════════════════════════════
  router.get('/orders', requirePermission('purchase.view'), (req, res) => {
    const { state='', vendor_id='', date_from='', date_to='', search='' } = req.query;
    const where=['1=1']; const params=[];
    if (state) { where.push('o.state=?'); params.push(state); }
    if (vendor_id) { where.push('o.vendor_id=?'); params.push(Number(vendor_id)); }
    if (date_from) { where.push('o.order_date>=?'); params.push(date_from); }
    if (date_to)   { where.push('o.order_date<=?'); params.push(date_to); }
    if (search)    { where.push('(o.po_number LIKE ? OR o.vendor_name LIKE ?)'); params.push(`%${search}%`,`%${search}%`); }
    const rows = q(`SELECT o.*, v.name as vendor_ref FROM po_orders o LEFT JOIN po_vendors v ON v.id=o.vendor_id WHERE ${where.join(' AND ')} ORDER BY o.id DESC`, params);
    res.json({ success:true, data:rows });
  });

  router.get('/orders/:id', requirePermission('purchase.view'), (req, res) => {
    const order = one(`SELECT o.* FROM po_orders o WHERE o.id=?`, [req.params.id]);
    if (!order) return res.status(404).json({ success:false, error:'Order not found' });
    const lines = q(`SELECT l.*, p.name as product_name, p.name_ar as product_name_ar FROM po_order_lines l LEFT JOIN po_products p ON p.id=l.product_id WHERE l.order_id=? ORDER BY l.id`, [req.params.id]);
    const receipts = q(`SELECT r.*, (SELECT COALESCE(SUM(qty_done),0) FROM po_receipt_lines WHERE receipt_id=r.id) as total_received FROM po_receipts r WHERE r.order_id=? ORDER BY r.id DESC`, [req.params.id]);
    const bills    = q(`SELECT * FROM po_bills WHERE order_id=? ORDER BY id DESC`, [req.params.id]);
    res.json({ success:true, data:{ ...order, lines, receipts, bills } });
  });

  router.post('/orders', requirePermission('purchase.create'), validateBody(schemas.purchaseOrder), (req, res) => {
    const b = req.validatedBody;
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const totals = calcLineTotals(lines);
    const po_number = nextNumber('po_orders','po_number','purchase.rfq_prefix','RFQ-');
    const vendor = b.vendor_id ? one(`SELECT name FROM po_vendors WHERE id=?`,[b.vendor_id]) : null;
    db.get().exec('BEGIN');
    try {
      const r = run(`INSERT INTO po_orders (po_number,order_type,state,vendor_id,vendor_name,branch_id,order_date,expected_date,currency,payment_terms,subtotal,tax_amount,total_amount,notes,internal_notes,source_reference,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [po_number,'rfq','draft',b.vendor_id||null,b.vendor_name||vendor?.name||'',b.branch_id||null,b.order_date,b.expected_date||null,b.currency||settingsService.get('app.currency', settingsService.get('purchase.default_currency','JOD')),Number(b.payment_terms||30),totals.subtotal,totals.tax_amount,totals.total_amount,b.notes||'',b.internal_notes||'',b.source_reference||'',req.user.id]);
      for (const l of totals.lines) {
        run(`INSERT INTO po_order_lines (order_id,product_id,description,uom,qty_ordered,unit_price,discount_pct,tax_rate,line_subtotal,line_total,expected_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.lastInsertRowid,l.product_id||null,l.description||'',l.uom||'unit',Number(l.qty_ordered||1),Number(l.unit_price||0),Number(l.discount_pct||0),Number(l.tax_rate||0),l.line_subtotal,l.line_total,l.expected_date||null,l.notes||'']);
      }
      db.get().exec('COMMIT');
      auditService.log({ userId:req.user.id, action:'purchase.rfq.created', entityType:'po_orders', entityId:r.lastInsertRowid, details:{ po_number } });
      res.json({ success:true, data:{ id:r.lastInsertRowid, po_number } });
    } catch(e) { db.get().exec('ROLLBACK'); res.status(500).json({ success:false, error:e.message }); }
  });

  router.put('/orders/:id', requirePermission('purchase.create'), validateBody(schemas.purchaseOrder), (req, res) => {
    const id = Number(req.params.id);
    const order = one(`SELECT * FROM po_orders WHERE id=?`,[id]);
    if (!order) return res.status(404).json({ success:false, error:'Not found' });
    if (['confirmed','approved','done'].includes(order.state) && settingsService.get('purchase.lock_confirmed_po',true))
      return res.status(400).json({ success:false, error:'Order is locked. Cancel or reset to edit.' });
    const b = req.validatedBody;
    const vendor = b.vendor_id ? one(`SELECT name FROM po_vendors WHERE id=?`,[b.vendor_id]) : null;
    run(`UPDATE po_orders SET vendor_id=?,vendor_name=?,branch_id=?,order_date=?,expected_date=?,currency=?,payment_terms=?,notes=?,internal_notes=?,source_reference=?,updated_at=datetime('now') WHERE id=?`,
      [b.vendor_id||null,b.vendor_name||vendor?.name||'',b.branch_id||null,b.order_date,b.expected_date||null,b.currency||settingsService.get('app.currency', settingsService.get('purchase.default_currency','JOD')),Number(b.payment_terms||30),b.notes||'',b.internal_notes||'',b.source_reference||'',id]);
    if (Array.isArray(b.lines)) {
      run(`DELETE FROM po_order_lines WHERE order_id=?`,[id]);
      const totals = calcLineTotals(b.lines);
      for (const l of totals.lines) {
        run(`INSERT INTO po_order_lines (order_id,product_id,description,uom,qty_ordered,unit_price,discount_pct,tax_rate,line_subtotal,line_total,expected_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [id,l.product_id||null,l.description||'',l.uom||'unit',Number(l.qty_ordered||1),Number(l.unit_price||0),Number(l.discount_pct||0),Number(l.tax_rate||0),l.line_subtotal,l.line_total,l.expected_date||null,l.notes||'']);
      }
      refreshOrderTotals(id);
    }
    res.json({ success:true });
  });

  // ── Confirm RFQ → Purchase Order ─────────────────────────
  router.post('/orders/:id/confirm', requirePermission('purchase.confirm'), (req, res) => {
    const id = Number(req.params.id);
    const order = one(`SELECT * FROM po_orders WHERE id=?`,[id]);
    if (!order) return res.status(404).json({ success:false, error:'Not found' });
    if (!['draft','sent'].includes(order.state)) return res.status(400).json({ success:false, error:'Only draft/sent RFQs can be confirmed' });
    const lines = q(`SELECT * FROM po_order_lines WHERE order_id=?`,[id]);
    if (!lines.length) return res.status(400).json({ success:false, error:'Add at least one order line before confirming' });
    if (!order.vendor_id) return res.status(400).json({ success:false, error:'Select a vendor before confirming' });
    const requireApproval = settingsService.get('purchase.require_approval',false);
    const minAmount = Number(settingsService.get('purchase.approval_min_amount','5000'));
    const newState = requireApproval && Number(order.total_amount) >= minAmount ? 'confirmed' : 'approved';
    const po_number = nextNumber('po_orders','po_number','purchase.po_prefix','PO-');
    run(`UPDATE po_orders SET state=?,po_number=?,order_type='purchase',confirmed_date=date('now'),updated_at=datetime('now') WHERE id=?`,
      [newState,po_number,id]);
    auditService.log({ userId:req.user.id, action:'purchase.order.confirmed', entityType:'po_orders', entityId:id, details:{ po_number, state:newState } });
    eventBus.emit('purchase.order.confirmed', { id, po_number, vendor_id:order.vendor_id, total:order.total_amount });
    res.json({ success:true, data:{ state:newState, po_number } });
  });

  // ── Approve (if approval workflow enabled) ───────────────
  router.post('/orders/:id/approve', requirePermission('purchase.confirm'), (req, res) => {
    const id = Number(req.params.id);
    const order = one(`SELECT * FROM po_orders WHERE id=?`,[id]);
    if (!order || order.state !== 'confirmed') return res.status(400).json({ success:false, error:'Order not in confirmed state' });
    run(`UPDATE po_orders SET state='approved',approved_by=?,approved_at=datetime('now'),updated_at=datetime('now') WHERE id=?`,[req.user.id,id]);
    auditService.log({ userId:req.user.id, action:'purchase.order.approved', entityType:'po_orders', entityId:id, details:{} });
    res.json({ success:true });
  });

  // ── Send RFQ (mark as sent) ──────────────────────────────
  router.post('/orders/:id/send', requirePermission('purchase.create'), (req, res) => {
    const id = Number(req.params.id);
    const order = one(`SELECT * FROM po_orders WHERE id=?`,[id]);
    if (!order || order.state !== 'draft') return res.status(400).json({ success:false, error:'Only draft RFQs can be sent' });
    run(`UPDATE po_orders SET state='sent',updated_at=datetime('now') WHERE id=?`,[id]);
    res.json({ success:true });
  });

  // ── Cancel ────────────────────────────────────────────────
  router.post('/orders/:id/cancel', requirePermission('purchase.cancel'), (req, res) => {
    const id = Number(req.params.id);
    const order = one(`SELECT * FROM po_orders WHERE id=?`,[id]);
    if (!order) return res.status(404).json({ success:false, error:'Not found' });
    if (order.state === 'done') return res.status(400).json({ success:false, error:'Done orders cannot be cancelled' });
    const reason = req.body?.reason || '';
    run(`UPDATE po_orders SET state='cancelled',cancelled_by=?,cancel_reason=?,updated_at=datetime('now') WHERE id=?`,[req.user.id,reason,id]);
    auditService.log({ userId:req.user.id, action:'purchase.order.cancelled', entityType:'po_orders', entityId:id, details:{ reason } });
    res.json({ success:true });
  });

  // ── Reset to draft ────────────────────────────────────────
  router.post('/orders/:id/reset', requirePermission('purchase.confirm'), (req, res) => {
    const id = Number(req.params.id);
    run(`UPDATE po_orders SET state='draft',order_type='rfq',po_number=REPLACE(po_number,'PO-','RFQ-'),updated_at=datetime('now') WHERE id=? AND state='cancelled'`,[id]);
    res.json({ success:true });
  });

  // ════════════════════════════════════════════════════════════
  // RECEIPTS (Goods Received Notes)
  // ════════════════════════════════════════════════════════════
  router.get('/receipts', requirePermission('purchase.view'), (req, res) => {
    const { order_id='', state='' } = req.query;
    const where=['1=1']; const params=[];
    if (order_id) { where.push('r.order_id=?'); params.push(Number(order_id)); }
    if (state)    { where.push('r.state=?'); params.push(state); }
    res.json({ success:true, data: q(`SELECT r.*, o.po_number FROM po_receipts r JOIN po_orders o ON o.id=r.order_id WHERE ${where.join(' AND ')} ORDER BY r.id DESC`, params) });
  });

  router.get('/receipts/:id', requirePermission('purchase.view'), (req, res) => {
    const r = one(`SELECT r.*, o.po_number, o.vendor_name FROM po_receipts r JOIN po_orders o ON o.id=r.order_id WHERE r.id=?`,[req.params.id]);
    if (!r) return res.status(404).json({ success:false, error:'Not found' });
    const lines = q(`SELECT rl.*, ol.description, ol.uom, ol.qty_ordered, ol.qty_received FROM po_receipt_lines rl JOIN po_order_lines ol ON ol.id=rl.order_line_id WHERE rl.receipt_id=?`,[req.params.id]);
    res.json({ success:true, data:{ ...r, lines } });
  });

  router.post('/receipts', requirePermission('purchase.receive'), validateBody(schemas.purchaseReceipt), (req, res) => {
    const b = req.validatedBody;
    const lines = Array.isArray(b.lines) ? b.lines.filter(l => Number(l.qty_done||0) > 0) : [];
    if (!lines.length) return res.status(400).json({ success:false, error:'At least one line with qty_done > 0 required' });
    const order = one(`SELECT * FROM po_orders WHERE id=?`,[b.order_id]);
    if (!order) return res.status(404).json({ success:false, error:'Order not found' });
    if (!['approved','confirmed'].includes(order.state)) return res.status(400).json({ success:false, error:'Order must be confirmed/approved before receiving' });
    const receipt_number = nextNumber('po_receipts','receipt_number','purchase.po_prefix','WH-');
    const rn = receipt_number.replace('PO-','WH-').replace('RFQ-','WH-');
    db.get().exec('BEGIN');
    try {
      const r = run(`INSERT INTO po_receipts (receipt_number,order_id,vendor_id,vendor_name,receipt_date,state,notes,created_by) VALUES (?,?,?,?,?,?,?,?)`,
        [rn,b.order_id,order.vendor_id,order.vendor_name,b.receipt_date,'done',b.notes||'',req.user.id]);
      for (const l of lines) {
        run(`INSERT INTO po_receipt_lines (receipt_id,order_line_id,product_id,description,qty_done,uom) VALUES (?,?,?,?,?,?)`,
          [r.lastInsertRowid,l.order_line_id,l.product_id||null,l.description||'',Number(l.qty_done),l.uom||'unit']);
        run(`UPDATE po_order_lines SET qty_received=COALESCE(qty_received,0)+? WHERE id=?`,[Number(l.qty_done),l.order_line_id]);
        // Update product on_hand if product tracked
        if (l.product_id) run(`UPDATE po_products SET on_hand_qty=COALESCE(on_hand_qty,0)+?,last_purchase_price=(SELECT unit_price FROM po_order_lines WHERE id=?) WHERE id=?`,[Number(l.qty_done),l.order_line_id,l.product_id]);
      }
      db.get().exec('COMMIT');
      refreshOrderReceiptStatus(b.order_id);
      // Check if fully received → mark done
      const updatedOrder = one(`SELECT receipt_status,state FROM po_orders WHERE id=?`,[b.order_id]);
      if (updatedOrder?.receipt_status === 'full' && ['confirmed','approved'].includes(updatedOrder.state)) {
        run(`UPDATE po_orders SET state='done',received_date=date('now'),updated_at=datetime('now') WHERE id=?`,[b.order_id]);
        // Auto-create bill if setting enabled
        if (settingsService.get('purchase.auto_create_bill',false)) {
          createBillFromOrder(b.order_id, req.user.id);
        }
      }
      auditService.log({ userId:req.user.id, action:'purchase.receipt.created', entityType:'po_receipts', entityId:r.lastInsertRowid, details:{ receipt_number:rn, order_id:b.order_id } });
      eventBus.emit('purchase.goods.received', { orderId:b.order_id, receiptId:r.lastInsertRowid });
      res.json({ success:true, data:{ id:r.lastInsertRowid, receipt_number:rn } });
    } catch(e) { db.get().exec('ROLLBACK'); res.status(500).json({ success:false, error:e.message }); }
  });

  // ════════════════════════════════════════════════════════════
  // BILLS (Vendor Bills linked to POs)
  // ════════════════════════════════════════════════════════════
  function createBillFromOrder(orderId, userId) {
    const order = one(`SELECT * FROM po_orders WHERE id=?`,[orderId]);
    if (!order) return null;
    const lines = q(`SELECT * FROM po_order_lines WHERE order_id=?`,[orderId]);
    const bill_number = nextNumber('po_bills','bill_number','purchase.po_prefix','BILL-').replace('PO-','BILL-').replace('RFQ-','BILL-');
    const today = new Date().toISOString().slice(0,10);
    const dueDate = new Date(Date.now() + (Number(order.payment_terms||30)*86400000)).toISOString().slice(0,10);
    const r = run(`INSERT INTO po_bills (bill_number,order_id,vendor_id,vendor_name,invoice_date,due_date,state,subtotal,tax_amount,total_amount,residual_amount,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [bill_number,orderId,order.vendor_id,order.vendor_name,today,dueDate,'draft',order.subtotal,order.tax_amount,order.total_amount,order.total_amount,userId]);
    for (const l of lines) {
      const qty_to_bill = Number(l.qty_received||0) - Number(l.qty_billed||0);
      if (qty_to_bill <= 0) continue;
      run(`INSERT INTO po_bill_lines (bill_id,order_line_id,product_id,description,qty,unit_price,tax_rate,line_subtotal,line_total) VALUES (?,?,?,?,?,?,?,?,?)`,
        [r.lastInsertRowid,l.id,l.product_id||null,l.description,qty_to_bill,l.unit_price,l.tax_rate,qty_to_bill*l.unit_price,qty_to_bill*l.unit_price*(1+l.tax_rate/100)]);
      run(`UPDATE po_order_lines SET qty_billed=COALESCE(qty_billed,0)+? WHERE id=?`,[qty_to_bill,l.id]);
    }
    refreshOrderBillingStatus(orderId);
    return { id:r.lastInsertRowid, bill_number };
  }

  router.get('/bills', requirePermission('purchase.view'), (req, res) => {
    const { state='', order_id='' } = req.query;
    const where=['1=1']; const params=[];
    if (state)    { where.push('state=?'); params.push(state); }
    if (order_id) { where.push('order_id=?'); params.push(Number(order_id)); }
    res.json({ success:true, data: q(`SELECT * FROM po_bills WHERE ${where.join(' AND ')} ORDER BY id DESC`, params) });
  });

  router.get('/bills/:id', requirePermission('purchase.view'), (req, res) => {
    const bill = one(`SELECT * FROM po_bills WHERE id=?`,[req.params.id]);
    if (!bill) return res.status(404).json({ success:false, error:'Not found' });
    const lines = q(`SELECT bl.*, ol.description as po_description FROM po_bill_lines bl LEFT JOIN po_order_lines ol ON ol.id=bl.order_line_id WHERE bl.bill_id=?`,[req.params.id]);
    res.json({ success:true, data:{ ...bill, lines } });
  });

  router.post('/bills/create-from-order/:orderId', requirePermission('purchase.create'), (req, res) => {
    const result = createBillFromOrder(Number(req.params.orderId), req.user.id);
    if (!result) return res.status(400).json({ success:false, error:'Could not create bill from this order' });
    res.json({ success:true, data:result });
  });

  router.post('/bills', requirePermission('purchase.create'), validateBody(schemas.purchaseBill), (req, res) => {
    const b = req.validatedBody;
    const lines = Array.isArray(b.lines) ? b.lines : [];
    let sub=0,tax=0;
    for (const l of lines) { const base=Number(l.qty)*Number(l.unit_price); sub+=base; tax+=base*(Number(l.tax_rate||0)/100); }
    const total=sub+tax;
    const bill_number = nextNumber('po_bills','bill_number','purchase.po_prefix','BILL-').replace('PO-','BILL-').replace('RFQ-','BILL-');
    const dueDate = b.due_date || new Date(Date.now()+(Number(b.payment_terms||30)*86400000)).toISOString().slice(0,10);
    db.get().exec('BEGIN');
    try {
      const r = run(`INSERT INTO po_bills (bill_number,order_id,vendor_id,vendor_name,invoice_date,due_date,state,subtotal,tax_amount,total_amount,residual_amount,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [bill_number,b.order_id||null,b.vendor_id||null,b.vendor_name||'',b.invoice_date,dueDate,'draft',sub,tax,total,total,b.notes||'',req.user.id]);
      for (const l of lines) {
        const base=Number(l.qty)*Number(l.unit_price); const lineTax=base*(Number(l.tax_rate||0)/100);
        run(`INSERT INTO po_bill_lines (bill_id,order_line_id,product_id,description,qty,unit_price,tax_rate,line_subtotal,line_total) VALUES (?,?,?,?,?,?,?,?,?)`,
          [r.lastInsertRowid,l.order_line_id||null,l.product_id||null,l.description||'',Number(l.qty),Number(l.unit_price),Number(l.tax_rate||0),base,base+lineTax]);
      }
      db.get().exec('COMMIT');
      res.json({ success:true, data:{ id:r.lastInsertRowid, bill_number } });
    } catch(e) { db.get().exec('ROLLBACK'); res.status(500).json({ success:false, error:e.message }); }
  });

  router.post('/bills/:id/post', requirePermission('purchase.confirm'), (req, res) => {
    const id = Number(req.params.id);
    const bill = one(`SELECT * FROM po_bills WHERE id=?`,[id]);
    if (!bill || bill.state !== 'draft') return res.status(400).json({ success:false, error:'Bill not in draft state' });
    run(`UPDATE po_bills SET state='posted',updated_at=datetime('now') WHERE id=?`,[id]);
    if (bill.order_id) refreshOrderBillingStatus(bill.order_id);
    // Emit to accounting module for integration
    eventBus.emit('purchase.bill.posted', { billId:id, orderId:bill.order_id, vendorId: bill.vendor_id || null, vendorName:bill.vendor_name, billNumber: bill.bill_number, invoiceDate: bill.invoice_date, dueDate: bill.due_date, total:bill.total_amount, userId: req.user.id });
    auditService.log({ userId:req.user.id, action:'purchase.bill.posted', entityType:'po_bills', entityId:id, details:{ bill_number:bill.bill_number } });
    res.json({ success:true });
  });

  router.post('/bills/:id/reset', requirePermission('purchase.confirm'), (req, res) => {
    run(`UPDATE po_bills SET state='draft',updated_at=datetime('now') WHERE id=? AND state='posted'`,[req.params.id]);
    res.json({ success:true });
  });

  // ════════════════════════════════════════════════════════════
  // REPORTS
  // ════════════════════════════════════════════════════════════
  router.get('/reports/purchase-analysis', requirePermission('purchase.view_reports'), (req, res) => {
    const { date_from='', date_to='', vendor_id='' } = req.query;
    const where=['o.state NOT IN (\'draft\',\'cancelled\')']; const params=[];
    if (date_from) { where.push('o.order_date>=?'); params.push(date_from); }
    if (date_to)   { where.push('o.order_date<=?'); params.push(date_to); }
    if (vendor_id) { where.push('o.vendor_id=?'); params.push(Number(vendor_id)); }
    const orders = q(`SELECT o.po_number,o.vendor_name,o.order_date,o.state,o.total_amount,o.receipt_status,o.billing_status FROM po_orders o WHERE ${where.join(' AND ')} ORDER BY o.order_date DESC`, params);
    const byVendor = q(`SELECT o.vendor_name, COUNT(*) as orders, COALESCE(SUM(o.total_amount),0) as total FROM po_orders o WHERE ${where.join(' AND ')} GROUP BY o.vendor_name ORDER BY total DESC`, params);
    const byMonth  = q(`SELECT substr(order_date,1,7) as month, COUNT(*) as orders, COALESCE(SUM(total_amount),0) as total FROM po_orders WHERE ${where.join(' AND ')} GROUP BY substr(order_date,1,7) ORDER BY month DESC LIMIT 12`, params);
    const byCategory = q(`SELECT COALESCE(p.category,'general') as category, COUNT(l.id) as lines, COALESCE(SUM(l.line_total),0) as total FROM po_order_lines l LEFT JOIN po_products p ON p.id=l.product_id JOIN po_orders o ON o.id=l.order_id WHERE ${where.join(' AND ')} GROUP BY COALESCE(p.category,'general') ORDER BY total DESC`, params);
    res.json({ success:true, data:{ orders, byVendor, byMonth, byCategory } });
  });

  router.get('/reports/vendor-performance', requirePermission('purchase.view_reports'), (_req, res) => {
    const data = q(`SELECT v.name, v.currency, v.payment_terms, COUNT(o.id) as total_orders, COALESCE(SUM(CASE WHEN o.state NOT IN ('draft','cancelled') THEN o.total_amount ELSE 0 END),0) as total_spend, COALESCE(AVG(CASE WHEN o.state NOT IN ('draft','cancelled') THEN o.total_amount ELSE NULL END),0) as avg_order FROM po_vendors v LEFT JOIN po_orders o ON o.vendor_id=v.id WHERE v.is_active=1 GROUP BY v.id ORDER BY total_spend DESC`);
    res.json({ success:true, data });
  });

  router.get('/reports/stock-status', requirePermission('purchase.view_reports'), (_req, res) => {
    const data = q(`SELECT * FROM po_products WHERE is_active=1 ORDER BY on_hand_qty ASC`);
    res.json({ success:true, data });
  });

  // ════════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════════
  router.get('/settings', requirePermission('purchase.manage_settings'), (req, res) => {
    res.json({ success:true, data:{
      po_prefix:            settingsService.get('purchase.po_prefix','PO-'),
      rfq_prefix:           settingsService.get('purchase.rfq_prefix','RFQ-'),
      default_currency:     settingsService.get('app.currency', settingsService.get('purchase.default_currency','JOD')),
      require_approval:     !!settingsService.get('purchase.require_approval',false),
      approval_min_amount:  settingsService.get('purchase.approval_min_amount','5000'),
      default_lead_days:    settingsService.get('purchase.default_lead_days','7'),
      auto_create_bill:     !!settingsService.get('purchase.auto_create_bill',false),
      lock_confirmed_po:    !!settingsService.get('purchase.lock_confirmed_po',true),
    }});
  });

  router.put('/settings', requirePermission('purchase.manage_settings'), (req, res) => {
    const b = req.body||{};
    const allowed = ['po_prefix','rfq_prefix','default_currency','require_approval','approval_min_amount','default_lead_days','auto_create_bill','lock_confirmed_po'];
    for (const k of allowed) {
      if (b[k] !== undefined) {
        const type = ['require_approval','auto_create_bill','lock_confirmed_po'].includes(k) ? 'boolean' : 'string';
        settingsService.set(`purchase.${k}`, b[k], { type, module:'purchase' });
      }
    }
    auditService.log({ userId:req.user.id, action:'purchase.settings.updated', entityType:'settings', entityId:0, details:b });
    res.json({ success:true });
  });

  // ── Dashboard widget integration ──────────────────────────
  // Guards: check tableExists AND column existence before querying.
  // po_orders may exist from a partial earlier migration without all columns.
  function poTableReady() {
    if (!db.tableExists('po_orders')) return false;
    // Verify the 'state' column exists by checking sqlite_master
    try {
      const cols = db.getAll(`PRAGMA table_info(po_orders)`);
      return cols.some(c => c.name === 'state');
    } catch(_) { return false; }
  }

  eventBus.addFilter('dashboard.stats', (stats) => {
    if (!poTableReady()) return stats;
    try {
      stats.purchaseRfqCount = one(`SELECT COUNT(*) as c FROM po_orders WHERE state IN ('draft','sent')`)?.c || 0;
      stats.purchasePoCount  = one(`SELECT COUNT(*) as c FROM po_orders WHERE state IN ('confirmed','approved')`)?.c || 0;
      stats.purchaseMtdSpend = one(`SELECT COALESCE(SUM(total_amount),0) as v FROM po_orders WHERE state NOT IN ('draft','cancelled') AND substr(order_date,1,7)=substr(date('now'),1,7)`)?.v || 0;
    } catch(_) {}
    return stats;
  });

  eventBus.addFilter('dashboard.alerts', (alerts) => {
    if (!poTableReady()) return alerts;
    try {
      const toApprove = one(`SELECT COUNT(*) as c FROM po_orders WHERE state='confirmed'`)?.c || 0;
      if (toApprove > 0) alerts.push({ type:'warning', icon:'package', text:`${toApprove} purchase order(s) awaiting approval`, link:'/purchase' });
      const toReceive = one(`SELECT COUNT(*) as c FROM po_orders WHERE state IN ('confirmed','approved') AND receipt_status IN ('pending','partial')`)?.c || 0;
      if (toReceive > 0) alerts.push({ type:'info', icon:'package', text:`${toReceive} purchase order(s) waiting for goods receipt`, link:'/purchase' });
    } catch(_) {}
    return alerts;
  });

  app.use('/api/purchase', router);
};

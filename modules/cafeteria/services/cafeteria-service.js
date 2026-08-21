const database = require('../../../core/database');
const settingsService = require('../../../core/services/settings-service');
const auditService = require('../../../core/services/audit-service');

function num(v) { return Number(v || 0); }
function nowDate() { return new Date().toISOString().slice(0, 10); }
function escLike(v) { return `%${String(v || '').replace(/[%_]/g, '')}%`; }
function generateOrderNo(prefix = 'CAF-') { return prefix + Date.now(); }

function getCurrency() {
  return settingsService.get('app.currency', 'JOD');
}

function getEnabledPaymentMethods() {
  const methods = settingsService.get('cafeteria.enabled_payment_methods', ['cash', 'card', 'cliq']);
  let list;
  if (Array.isArray(methods)) list = methods;
  else { try { list = JSON.parse(methods); } catch (_) { list = ['cash', 'card', 'cliq']; } }
  if (!list.includes('debt')) list.push('debt');
  return list;
}

function getDefaultWarehouseId() {
  return Number(settingsService.get('cafeteria.default_warehouse_id', 1) || 1);
}

function getProductById(id) {
  return database.getOne(`
    SELECT p.*, c.name AS category_name, c.name_ar AS category_name_ar
    FROM cafeteria_products p
    LEFT JOIN cafeteria_categories c ON c.id = p.category_id
    WHERE p.id = ?
  `, [id]);
}

function getOpenSessionForUser(userId) {
  return database.getOne(`SELECT * FROM cafeteria_sessions WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`, [userId]);
}

function getSessionById(sessionId) {
  if (!sessionId) return null;
  return database.getOne(`SELECT * FROM cafeteria_sessions WHERE id = ?`, [sessionId]);
}

function listProducts({ search = '', category_id = '', active = '' } = {}) {
  const params = [];
  let sql = `
    SELECT p.*, c.name AS category_name, c.name_ar AS category_name_ar,
           CASE WHEN p.product_type = 'stockable' AND p.qty_on_hand <= COALESCE(NULLIF(p.low_stock_threshold,0), CAST(? AS REAL), 0)
                THEN 'low' ELSE 'available' END AS computed_availability
    FROM cafeteria_products p
    LEFT JOIN cafeteria_categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  params.push(settingsService.get('cafeteria.low_stock_threshold', 5));
  if (search) {
    sql += ` AND (p.name LIKE ? OR p.name_ar LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
    const q = escLike(search);
    params.push(q, q, q, q);
  }
  if (category_id) { sql += ` AND p.category_id = ?`; params.push(category_id); }
  if (active !== '') { sql += ` AND p.is_active = ?`; params.push(active ? 1 : 0); }
  sql += ` ORDER BY c.sort_order, p.name`;
  return database.getAll(sql, params);
}

function listCategories() {
  return database.getAll(`SELECT * FROM cafeteria_categories ORDER BY sort_order, name`);
}

function listWarehouses() {
  return database.getAll(`SELECT * FROM cafeteria_warehouses ORDER BY is_pos_default DESC, name`);
}

function applyStockMove({ productId, warehouseId, moveType, qty, unitCost, referenceType = '', referenceId = null, notes = '', userId = null }) {
  const product = getProductById(productId);
  if (!product) throw new Error('Product not found');
  const signedQty = num(qty);
  const beforeQty = num(product.qty_on_hand);
  let afterQty = beforeQty + signedQty;
  const allowNegative = !!settingsService.get('cafeteria.allow_negative_stock', false);
  if (!allowNegative && product.product_type === 'stockable' && afterQty < 0) throw new Error('Insufficient stock');

  let averageCost = num(product.average_cost || product.standard_cost || 0);
  let effectiveCost = num(unitCost || averageCost || product.standard_cost || 0);
  if (signedQty > 0 && product.product_type === 'stockable') {
    const currentValue = beforeQty * averageCost;
    const incomingValue = signedQty * effectiveCost;
    averageCost = afterQty > 0 ? ((currentValue + incomingValue) / afterQty) : averageCost;
  }
  if (signedQty < 0 && product.product_type === 'stockable') {
    effectiveCost = averageCost;
  }
  database.run(
    `UPDATE cafeteria_products
     SET qty_on_hand = ?, average_cost = ?, availability_status = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [afterQty, averageCost, afterQty <= num(product.low_stock_threshold || 0) ? 'low' : 'available', productId]
  );
  const totalValue = Math.abs(signedQty) * num(effectiveCost);
  const move = database.run(
    `INSERT INTO cafeteria_stock_moves
      (warehouse_id, product_id, move_type, reference_type, reference_id, qty, unit_cost, total_value, before_qty, after_qty, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [warehouseId || getDefaultWarehouseId(), productId, moveType, referenceType, referenceId, signedQty, effectiveCost, totalValue, beforeQty, afterQty, notes, userId]
  );
  return { moveId: move.lastInsertRowid, beforeQty, afterQty, averageCost, totalValue, effectiveCost };
}

function validatePaymentLines(paymentLines = [], total, { allowNegative = false } = {}) {
  const enabled = getEnabledPaymentMethods();
  const clean = (paymentLines || []).map((p) => ({
    payment_method: p.payment_method || p.method,
    amount: num(p.amount),
    tendered_amount: num(p.tendered_amount || p.amount),
    reference: p.reference || ''
  })).filter((p) => p.payment_method && (allowNegative ? p.amount !== 0 : p.amount > 0));
  if (!clean.length) throw new Error('At least one payment line is required');
  clean.forEach((line) => {
    if (!enabled.includes(line.payment_method)) throw new Error(`Payment method not enabled: ${line.payment_method}`);
  });
  const paid = clean.reduce((s, line) => s + line.amount, 0);
  const allowOver = !!settingsService.get('cafeteria.allow_overpayment', false);
  const expected = num(total);
  if (!allowNegative) {
    if (!allowOver && Math.abs(paid - expected) > 0.0001) throw new Error('Payment total must equal order total');
    if (allowOver && paid < expected) throw new Error('Payment total is less than order total');
    const over = Math.max(0, paid - expected);
    let remainingChange = over;
    return clean.map((line) => {
      let change = 0;
      if (remainingChange > 0 && line.payment_method === 'cash') {
        change = remainingChange;
        remainingChange = 0;
      }
      return { ...line, change_amount: change };
    });
  }
  if (Math.abs(paid - expected) > 0.0001) throw new Error('Payment total must equal refund total');
  return clean.map((line) => ({ ...line, change_amount: 0 }));
}

// Cafeteria % discount granted by the member's active membership plan.
function getMemberCafeteriaDiscount(memberId) {
  if (!memberId) return 0;
  try {
    const row = database.getOne(
      `SELECT COALESCE(mp.cafeteria_discount_percent,0) pct
       FROM memberships ms JOIN membership_plans mp ON mp.id = ms.plan_id
       WHERE ms.member_id = ? AND ms.status = 'active'
       ORDER BY date(COALESCE(ms.end_date,'9999-12-31')) DESC LIMIT 1`, [memberId]);
    return Math.max(0, Math.min(100, Number(row?.pct || 0)));
  } catch (_) { return 0; }
}

function createOrder({ order = {}, lines = [], payment_lines = [], user }) {
  const warehouseId = Number(order.warehouse_id || getDefaultWarehouseId());
  const allowWithoutSession = !!settingsService.get('cafeteria.allow_sale_without_session', false);
  const session = order.session_id ? getSessionById(order.session_id) : getOpenSessionForUser(user.id);
  if (!allowWithoutSession && !session) throw new Error('Active POS session is required');
  if (session && session.status !== 'open') throw new Error('POS session is not open');
  if (session && session.user_id !== user.id && user.role !== 'admin') throw new Error('Cashier can only sell in own session');

  if (!Array.isArray(lines) || !lines.length) throw new Error('Order requires at least one line');
  const currency = getCurrency();
  // Member's plan cafeteria discount (%) — applied on top of any per-line discount.
  const memberDiscPct = getMemberCafeteriaDiscount(order.member_id);
  const computedLines = lines.map((line) => {
    const product = getProductById(line.product_id);
    if (!product) throw new Error('Invalid product');
    const qty = num(line.qty || 1);
    if (qty <= 0) throw new Error('Line quantity must be positive');
    const unitPrice = line.unit_price !== undefined ? num(line.unit_price) : num(product.selling_price);
    const lineSubtotalRaw = unitPrice * qty;
    const planDisc = memberDiscPct > 0 ? Math.round(lineSubtotalRaw * (memberDiscPct / 100) * 1000) / 1000 : 0;
    const discountAmount = num(line.discount_amount || 0) + planDisc;
    const lineSubtotal = unitPrice * qty;
    const taxableBase = Math.max(0, lineSubtotal - discountAmount);
    const taxRate = num(line.tax_rate !== undefined ? line.tax_rate : product.tax_rate);
    const taxAmount = taxableBase * (taxRate / 100);
    const total = taxableBase + taxAmount;
    const unitCost = num(product.average_cost || product.standard_cost || 0);
    const totalCost = product.product_type === 'stockable' ? unitCost * qty : 0;
    return {
      product,
      qty,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      subtotal: taxableBase,
      total,
      unit_cost: unitCost,
      total_cost: totalCost,
      note: line.note || ''
    };
  });

  const subtotal = computedLines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const discountTotal = computedLines.reduce((s, l) => s + l.discount_amount, 0);
  const taxTotal = computedLines.reduce((s, l) => s + l.tax_amount, 0);
  const total = computedLines.reduce((s, l) => s + l.total, 0);
  const cogsTotal = computedLines.reduce((s, l) => s + l.total_cost, 0);
  const grossProfit = total - cogsTotal;
  const status = order.status === 'held' ? 'held' : (payment_lines.length === 1 && payment_lines[0]?.payment_method === 'debt' ? 'debt' : 'paid');
  const isDebt = status === 'debt';
  if (isDebt && !order.member_id) throw new Error('Member selection is required for debt orders');

  const orderResult = database.run(
    `INSERT INTO cafeteria_orders
      (order_no, source, status, warehouse_id, session_id, member_id, customer_name, staff_name, subtotal, discount_total, tax_total, total, paid_total, change_total, cogs_total, gross_profit, currency, cashier_id, cashier_name, notes, is_refund, original_order_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [generateOrderNo(), order.source || 'pos', status, warehouseId, session?.id || null, order.member_id || null, order.customer_name || 'Walk-in Customer', order.staff_name || '', subtotal, discountTotal, taxTotal, total, isDebt ? 0 : (status === 'held' ? 0 : total), 0, cogsTotal, grossProfit, currency, user.id, user.full_name || user.username, order.notes || '']
  );
  const orderId = orderResult.lastInsertRowid;

  computedLines.forEach((line) => {
    database.run(
      `INSERT INTO cafeteria_order_lines
       (order_id, product_id, product_name, product_name_ar, sku, qty, unit_price, discount_amount, tax_rate, tax_amount, subtotal, total, unit_cost, total_cost, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, line.product.id, line.product.name, line.product.name_ar || '', line.product.sku || '', line.qty, line.unit_price, line.discount_amount, line.tax_rate, line.tax_amount, line.subtotal, line.total, line.unit_cost, line.total_cost, line.note]
    );
    if (status !== 'held' && line.product.product_type === 'stockable') {
      applyStockMove({ productId: line.product.id, warehouseId, moveType: 'sale', qty: -line.qty, unitCost: line.unit_cost, referenceType: 'order', referenceId: orderId, notes: 'POS sale', userId: user.id });
    }
  });

  if (status !== 'held') {
    if (isDebt) {
      // Debt order: record a single 'debt' payment line, no cash movement
      database.run(
        `INSERT INTO cafeteria_payments (order_id, session_id, payment_method, amount, tendered_amount, change_amount, reference, created_by)
         VALUES (?, ?, 'debt', ?, 0, 0, ?, ?)`,
        [orderId, session?.id || null, total, 'Debt - ' + (order.customer_name || ''), user.id]
      );
    } else {
      const paymentLines = validatePaymentLines(payment_lines, total);
      const paidTotal = paymentLines.reduce((s, line) => s + line.amount, 0);
      const changeTotal = paymentLines.reduce((s, line) => s + line.change_amount, 0);
      database.run(`UPDATE cafeteria_orders SET paid_total = ?, change_total = ?, updated_at = datetime('now') WHERE id = ?`, [paidTotal, changeTotal, orderId]);
      paymentLines.forEach((line) => {
        database.run(
          `INSERT INTO cafeteria_payments (order_id, session_id, payment_method, amount, tendered_amount, change_amount, reference, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, session?.id || null, line.payment_method, line.amount, line.tendered_amount, line.change_amount, line.reference || '', user.id]
        );
        if (session?.id && line.payment_method === 'cash') {
          database.run(`UPDATE cafeteria_sessions SET expected_cash = expected_cash + ? WHERE id = ?`, [line.amount - line.change_amount, session.id]);
        }
      });
    }
  }

  auditService.log({ userId: user.id, action: 'cafeteria.order.create', entityType: 'cafeteria_orders', entityId: orderId, details: { total, status, lines: computedLines.length } });
  return getOrderById(orderId);
}

function getOrderById(orderId) {
  const order = database.getOne(`SELECT * FROM cafeteria_orders WHERE id = ?`, [orderId]);
  if (!order) return null;
  order.lines = database.getAll(`SELECT * FROM cafeteria_order_lines WHERE order_id = ? ORDER BY id`, [orderId]);
  order.payments = database.getAll(`SELECT * FROM cafeteria_payments WHERE order_id = ? ORDER BY id`, [orderId]);
  return order;
}

function getLastPaidOrderForSession({ sessionId, userId }) {
  const session = sessionId ? getSessionById(sessionId) : getOpenSessionForUser(userId);
  if (!session) throw new Error('Active POS session is required');
  const row = database.getOne(
    `SELECT id
     FROM cafeteria_orders
     WHERE session_id = ? AND status = 'paid' AND COALESCE(is_refund,0) = 0
     ORDER BY id DESC LIMIT 1`,
    [session.id]
  );
  if (!row) return null;
  return getOrderById(row.id);
}

function closeSession({ sessionId, countedCash = 0, notes = '', user }) {
  const session = database.getOne(`SELECT * FROM cafeteria_sessions WHERE id = ?`, [sessionId]);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'open') throw new Error('Session is already closed');
  if (session.user_id !== user.id && user.role !== 'admin') throw new Error('Cannot close another user session');
  const expected = num(session.expected_cash);
  const discrepancy = num(countedCash) - expected;
  database.run(
    `UPDATE cafeteria_sessions
     SET counted_cash = ?, discrepancy = ?, close_notes = ?, status = 'closed', closed_at = datetime('now')
     WHERE id = ?`,
    [num(countedCash), discrepancy, notes || '', sessionId]
  );
  auditService.log({ userId: user.id, action: 'cafeteria.session.close', entityType: 'cafeteria_sessions', entityId: sessionId, details: { countedCash, expected, discrepancy } });
  return database.getOne(`SELECT * FROM cafeteria_sessions WHERE id = ?`, [sessionId]);
}

// Auto-close POS sessions left open longer than the configured threshold (stale/abandoned sessions).
// Neutral close: counted_cash = expected_cash (discrepancy 0) and a marker note. Set hours to 0 to disable.
function autoCloseStaleSessions() {
  try {
    const hours = Number(settingsService.get('cafeteria.session_auto_close_hours', 16));
    if (!Number.isFinite(hours) || hours <= 0) return { closed: 0, disabled: true };
    const stale = database.getAll(
      `SELECT id FROM cafeteria_sessions WHERE status = 'open' AND opened_at <= datetime('now', ?)`,
      [`-${hours} hours`]
    );
    for (const s of stale) {
      database.run(
        `UPDATE cafeteria_sessions
         SET counted_cash = expected_cash, discrepancy = 0, status = 'closed', closed_at = datetime('now'),
             close_notes = TRIM(COALESCE(close_notes, '') || ' [auto-closed: stale session > ' || ? || 'h]')
         WHERE id = ? AND status = 'open'`,
        [hours, s.id]
      );
      try { auditService.log({ userId: null, action: 'cafeteria.session.auto_close', entityType: 'cafeteria_sessions', entityId: s.id, details: { reason: 'stale', thresholdHours: hours } }); } catch (_) {}
    }
    if (stale.length) console.log(`[cafeteria] auto-closed ${stale.length} stale POS session(s) (open > ${hours}h)`);
    return { closed: stale.length, thresholdHours: hours };
  } catch (e) {
    console.error('[cafeteria] auto-close stale sessions failed:', e.message);
    return { closed: 0, error: e.message };
  }
}

function openSession({ warehouseId, openingCash = 0, notes = '', user }) {
  const existing = getOpenSessionForUser(user.id);
  if (existing) throw new Error('An open POS session already exists for this user');
  const result = database.run(
    `INSERT INTO cafeteria_sessions (user_id, username, warehouse_id, opening_cash, expected_cash, open_notes, status)
     VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    [user.id, user.username || user.full_name || '', Number(warehouseId || getDefaultWarehouseId()), num(openingCash), num(openingCash), notes || '']
  );
  auditService.log({ userId: user.id, action: 'cafeteria.session.open', entityType: 'cafeteria_sessions', entityId: result.lastInsertRowid, details: { warehouseId, openingCash } });
  return database.getOne(`SELECT * FROM cafeteria_sessions WHERE id = ?`, [result.lastInsertRowid]);
}

function refundOrder({ orderId, lines = [], reason = '', refundPaymentMethod = 'cash', user }) {
  const order = getOrderById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'paid') throw new Error('Only paid orders can be refunded');

  const threshold = num(settingsService.get('cafeteria.refund_approval_threshold', 25));
  const lineMap = new Map(order.lines.map((l) => [l.id, l]));
  const selected = (lines || []).map((line) => {
    const original = lineMap.get(Number(line.line_id || line.id));
    if (!original) throw new Error('Invalid refund line');
    const qty = num(line.qty || 0);
    if (qty <= 0 || qty > num(original.qty)) throw new Error('Invalid refund quantity');
    const factor = qty / num(original.qty || 1);
    return {
      original,
      qty,
      total: num(original.total) * factor,
      cost: num(original.total_cost) * factor,
      tax: num(original.tax_amount) * factor,
      subtotal: num(original.subtotal) * factor
    };
  });

  if (!selected.length) throw new Error('Select at least one refund line');
  const refundTotalAbs = selected.reduce((s, l) => s + l.total, 0);
  const subtotalAbs = selected.reduce((s, l) => s + l.subtotal, 0);
  const taxAbs = selected.reduce((s, l) => s + l.tax, 0);
  const costAbs = selected.reduce((s, l) => s + l.cost, 0);
  if (refundTotalAbs > threshold && user.role !== 'admin') throw new Error('Manager approval required for refund above threshold');

  const paymentLines = validatePaymentLines([
    { payment_method: refundPaymentMethod, amount: -refundTotalAbs, tendered_amount: -refundTotalAbs, reference: `refund:${order.order_no}` }
  ], -refundTotalAbs, { allowNegative: true });

  const refundOrderResult = database.run(
    `INSERT INTO cafeteria_orders
      (order_no, source, status, warehouse_id, session_id, member_id, customer_name, staff_name, subtotal, discount_total, tax_total, total, paid_total, change_total, cogs_total, gross_profit, currency, cashier_id, cashier_name, notes, refunded_order_id, is_refund, original_order_id)
     VALUES (?, 'refund', 'refunded', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      generateOrderNo('CAF-RFD-'),
      order.warehouse_id,
      order.session_id,
      order.member_id,
      order.customer_name,
      order.staff_name,
      -subtotalAbs,
      -taxAbs,
      -refundTotalAbs,
      -refundTotalAbs,
      -costAbs,
      -(refundTotalAbs - costAbs),
      order.currency,
      user.id,
      user.full_name || user.username,
      reason || '',
      order.id,
      order.id
    ]
  );
  const refundOrderId = refundOrderResult.lastInsertRowid;

  selected.forEach((entry) => {
    database.run(
      `INSERT INTO cafeteria_order_lines
       (order_id, product_id, product_name, product_name_ar, sku, qty, unit_price, discount_amount, tax_rate, tax_amount, subtotal, total, unit_cost, total_cost, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        refundOrderId,
        entry.original.product_id,
        entry.original.product_name,
        entry.original.product_name_ar || '',
        entry.original.sku || '',
        -entry.qty,
        entry.original.unit_price,
        0,
        entry.original.tax_rate,
        -entry.tax,
        -entry.subtotal,
        -entry.total,
        entry.original.unit_cost,
        -entry.cost,
        reason || 'Refund'
      ]
    );
    const product = getProductById(entry.original.product_id);
    if (product && product.product_type === 'stockable') {
      applyStockMove({
        productId: product.id,
        warehouseId: order.warehouse_id,
        moveType: 'refund',
        qty: entry.qty,
        unitCost: product.average_cost || product.standard_cost || 0,
        referenceType: 'refund',
        referenceId: refundOrderId,
        notes: 'Customer refund',
        userId: user.id
      });
    }
  });

  paymentLines.forEach((line) => {
    database.run(
      `INSERT INTO cafeteria_payments (order_id, session_id, payment_method, amount, tendered_amount, change_amount, reference, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [refundOrderId, order.session_id || null, line.payment_method, line.amount, line.tendered_amount, 0, line.reference || '', user.id]
    );
    if (order.session_id && line.payment_method === 'cash') {
      database.run(`UPDATE cafeteria_sessions SET expected_cash = expected_cash + ? WHERE id = ?`, [line.amount, order.session_id]);
    }
  });

  database.run(
    `INSERT INTO cafeteria_refunds (order_id, refund_order_id, refund_total, reason, approved_by, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [order.id, refundOrderId, refundTotalAbs, reason || '', user.id, user.id]
  );
  auditService.log({
    userId: user.id,
    action: 'cafeteria.order.refund',
    entityType: 'cafeteria_orders',
    entityId: order.id,
    details: { refundOrderId, refundTotal: refundTotalAbs, reason, refundPaymentMethod }
  });
  return getOrderById(refundOrderId);
}

function changeOrderPaymentMethod({ orderId, newPaymentMethod, reason = '', user }) {
  const order = getOrderById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'paid') throw new Error('Only paid orders can change payment method');
  const enabled = getEnabledPaymentMethods();
  if (!enabled.includes(newPaymentMethod)) throw new Error('Payment method not enabled');

  const oldCashNet = (order.payments || []).reduce((sum, payment) => {
    if (payment.payment_method !== 'cash') return sum;
    return sum + (num(payment.amount) - num(payment.change_amount));
  }, 0);

  database.run(`UPDATE cafeteria_payments SET payment_method = ?, reference = TRIM(COALESCE(reference,'') || ' | adjusted') WHERE order_id = ?`, [newPaymentMethod, orderId]);

  const newCashNet = newPaymentMethod === 'cash'
    ? (order.payments || []).reduce((sum, payment) => sum + (num(payment.amount) - num(payment.change_amount)), 0)
    : 0;

  const cashDelta = newCashNet - oldCashNet;
  if (order.session_id && Math.abs(cashDelta) > 0.0001) {
    database.run(`UPDATE cafeteria_sessions SET expected_cash = expected_cash + ? WHERE id = ?`, [cashDelta, order.session_id]);
  }

  auditService.log({
    userId: user.id,
    action: 'cafeteria.payment.adjust',
    entityType: 'cafeteria_orders',
    entityId: orderId,
    details: { from: order.payments || [], to_payment_method: newPaymentMethod, cash_delta: cashDelta, reason }
  });

  return getOrderById(orderId);
}

function dashboardStats() {
  const today = nowDate();
  const salesRow = database.getOne(`SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS total, COALESCE(SUM(gross_profit),0) AS gross_profit, COALESCE(AVG(total),0) AS avg_order FROM cafeteria_orders WHERE status='paid' AND substr(created_at,1,10)=?`, [today]) || {};
  const refundRow = database.getOne(`SELECT COALESCE(SUM(refund_total),0) AS refunds FROM cafeteria_refunds WHERE substr(created_at,1,10)=?`, [today]) || {};
  const openSessions = database.getOne(`SELECT COUNT(*) AS c FROM cafeteria_sessions WHERE status='open'`)?.c || 0;
  const lowStock = database.getAll(`SELECT id, name, name_ar, qty_on_hand, low_stock_threshold FROM cafeteria_products WHERE is_active=1 AND product_type='stockable' AND qty_on_hand <= COALESCE(NULLIF(low_stock_threshold,0), CAST(? AS REAL), 0) ORDER BY qty_on_hand ASC LIMIT 10`, [settingsService.get('cafeteria.low_stock_threshold', 5)]);
  const topItems = database.getAll(`SELECT ol.product_name, ol.product_name_ar, SUM(ol.qty) AS sold_qty, SUM(ol.total) AS line_total FROM cafeteria_order_lines ol JOIN cafeteria_orders o ON o.id = ol.order_id WHERE o.status='paid' AND substr(o.created_at,1,10)=? GROUP BY ol.product_id, ol.product_name, ol.product_name_ar ORDER BY sold_qty DESC LIMIT 5`, [today]);
  const paymentMix = database.getAll(`SELECT payment_method, SUM(amount) AS total FROM cafeteria_payments WHERE substr(created_at,1,10)=? GROUP BY payment_method ORDER BY total DESC`, [today]);
  const byCategory = database.getAll(`SELECT c.name, c.name_ar, SUM(ol.total) AS category_total FROM cafeteria_order_lines ol JOIN cafeteria_orders o ON o.id=ol.order_id LEFT JOIN cafeteria_products p ON p.id = ol.product_id LEFT JOIN cafeteria_categories c ON c.id = p.category_id WHERE o.status='paid' AND substr(o.created_at,1,10)=? GROUP BY c.id, c.name, c.name_ar ORDER BY category_total DESC`, [today]);
  const recentOrders = database.getAll(`SELECT id, order_no, customer_name, cashier_name, total, status, created_at FROM cafeteria_orders ORDER BY id DESC LIMIT 8`);
  const discrepancies = database.getAll(`SELECT id, username, discrepancy, closed_at FROM cafeteria_sessions WHERE status='closed' AND ABS(discrepancy) > 0.009 ORDER BY closed_at DESC LIMIT 5`);
  return {
    currency: getCurrency(),
    todaySales: num(salesRow.total),
    todayOrders: Number(salesRow.orders || 0),
    grossProfitToday: num(salesRow.gross_profit),
    avgOrderValue: num(salesRow.avg_order),
    refundsToday: num(refundRow.refunds),
    openSessions,
    lowStock,
    topItems,
    paymentMix,
    byCategory,
    recentOrders,
    discrepancies,
    warehouseSnapshot: database.getAll(`SELECT w.id, w.name, COUNT(p.id) AS products, COALESCE(SUM(p.qty_on_hand),0) AS units FROM cafeteria_warehouses w LEFT JOIN cafeteria_products p ON 1=1 GROUP BY w.id, w.name ORDER BY w.name`)
  };
}

function reportSummary(filters = {}) {
  const params = [];
  let where = ` WHERE o.status IN ('paid','refunded','held','voided') `;
  if (filters.date_from) { where += ` AND substr(o.created_at,1,10) >= ?`; params.push(filters.date_from); }
  if (filters.date_to) { where += ` AND substr(o.created_at,1,10) <= ?`; params.push(filters.date_to); }
  if (filters.cashier_id) { where += ` AND o.cashier_id = ?`; params.push(filters.cashier_id); }
  if (filters.session_id) { where += ` AND o.session_id = ?`; params.push(filters.session_id); }
  if (filters.warehouse_id) { where += ` AND o.warehouse_id = ?`; params.push(filters.warehouse_id); }

  const totals = database.getOne(`SELECT COALESCE(SUM(CASE WHEN o.status='paid' THEN o.total ELSE 0 END),0) AS gross_sales,
    COALESCE(SUM(CASE WHEN o.status='paid' THEN o.discount_total ELSE 0 END),0) AS discount_total,
    COALESCE(SUM(CASE WHEN o.status='paid' THEN o.tax_total ELSE 0 END),0) AS tax_total,
    COALESCE(SUM(CASE WHEN o.status='paid' THEN o.cogs_total ELSE 0 END),0) AS cogs_total,
    COALESCE(SUM(CASE WHEN o.status='paid' THEN o.gross_profit ELSE 0 END),0) AS gross_profit,
    COALESCE(SUM(CASE WHEN o.status='voided' THEN o.total ELSE 0 END),0) AS voided_total,
    COALESCE(SUM(CASE WHEN o.status='refunded' THEN ABS(o.total) ELSE 0 END),0) AS refunded_total,
    COUNT(*) AS orders
    FROM cafeteria_orders o ${where}`, params) || {};

  const salesByProduct = database.getAll(`SELECT ol.product_name, ol.product_name_ar, SUM(CASE WHEN o.status='paid' THEN ol.qty ELSE 0 END) AS qty, SUM(CASE WHEN o.status='paid' THEN ol.total ELSE 0 END) AS product_total, SUM(CASE WHEN o.status='paid' THEN ol.total_cost ELSE 0 END) AS cost
    FROM cafeteria_order_lines ol JOIN cafeteria_orders o ON o.id = ol.order_id ${where} GROUP BY ol.product_id, ol.product_name, ol.product_name_ar ORDER BY product_total DESC`, params);
  const salesByPaymentMethod = database.getAll(`SELECT p.payment_method, SUM(p.amount) AS payment_total FROM cafeteria_payments p JOIN cafeteria_orders o ON o.id = p.order_id ${where} GROUP BY p.payment_method ORDER BY payment_total DESC`, params);
  const salesByCashier = database.getAll(`SELECT o.cashier_name, COUNT(*) AS orders, SUM(CASE WHEN o.status='paid' THEN o.total ELSE 0 END) AS cashier_total FROM cafeteria_orders o ${where} GROUP BY o.cashier_id, o.cashier_name ORDER BY cashier_total DESC`, params);
  const salesBySession = database.getAll(`SELECT s.id AS session_id, s.username, COUNT(o.id) AS orders, SUM(CASE WHEN o.status='paid' THEN o.total ELSE 0 END) AS session_total FROM cafeteria_sessions s LEFT JOIN cafeteria_orders o ON o.session_id = s.id ${where.replace(/o\./g,'o.')} GROUP BY s.id, s.username ORDER BY session_total DESC`, params);
  const taxSummary = database.getAll(`SELECT ol.tax_rate, SUM(CASE WHEN o.status='paid' THEN ol.tax_amount ELSE 0 END) AS tax_total FROM cafeteria_order_lines ol JOIN cafeteria_orders o ON o.id = ol.order_id ${where} GROUP BY ol.tax_rate ORDER BY ol.tax_rate`, params);
  const profitabilityByCategory = database.getAll(`SELECT c.name, c.name_ar, SUM(CASE WHEN o.status='paid' THEN ol.total ELSE 0 END) AS category_sales, SUM(CASE WHEN o.status='paid' THEN ol.total_cost ELSE 0 END) AS category_cost
    FROM cafeteria_order_lines ol
    JOIN cafeteria_orders o ON o.id = ol.order_id
    LEFT JOIN cafeteria_products p ON p.id = ol.product_id
    LEFT JOIN cafeteria_categories c ON c.id = p.category_id
    ${where}
    GROUP BY c.id, c.name, c.name_ar ORDER BY category_sales DESC`, params);
  const cashMovements = database.getAll(`SELECT s.id, s.username, s.opening_cash, s.expected_cash, s.counted_cash, s.discrepancy, s.status, s.opened_at, s.closed_at FROM cafeteria_sessions s ORDER BY s.id DESC LIMIT 50`);

  return { currency: getCurrency(), totals, salesByProduct, salesByPaymentMethod, salesByCashier, salesBySession, taxSummary, profitabilityByCategory, cashMovements };
}

function getDebts({ member_id, status } = {}) {
  const where = ["o.status = 'debt'"];
  const params = [];
  if (member_id) { where.push('o.member_id = ?'); params.push(Number(member_id)); }
  if (status === 'settled') { where.push("o.status = 'paid'"); where[0] = "1=1"; }
  const rows = database.getAll(`
    SELECT o.*, m.first_name, m.middle_name, m.last_name, m.member_no, m.phone
    FROM cafeteria_orders o
    LEFT JOIN members m ON m.id = o.member_id
    WHERE ${where.join(' AND ')}
    ORDER BY o.created_at DESC
  `, params);
  // Summary
  const totalDebt = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const memberSummary = {};
  rows.forEach(r => {
    const key = r.member_id || 0;
    if (!memberSummary[key]) memberSummary[key] = { member_id: key, name: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') || r.customer_name || '—', member_no: r.member_no || '', phone: r.phone || '', total: 0, count: 0 };
    memberSummary[key].total += Number(r.total || 0);
    memberSummary[key].count += 1;
  });
  return { orders: rows, totalDebt, byMember: Object.values(memberSummary).sort((a, b) => b.total - a.total) };
}

function settleDebt(orderId, { method = 'cash', reference = '', userId } = {}) {
  const order = database.getOne('SELECT * FROM cafeteria_orders WHERE id = ?', [orderId]);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'debt') throw new Error('Order is not a debt');
  database.run(`UPDATE cafeteria_orders SET status='paid', paid_total=?, notes=COALESCE(notes,'')||?, updated_at=datetime('now') WHERE id=?`,
    [order.total, ` | Debt settled via ${method} ${reference ? '(' + reference + ')' : ''} on ${new Date().toISOString().split('T')[0]}`, orderId]);
  database.run(`INSERT INTO cafeteria_payments (order_id, session_id, payment_method, amount, tendered_amount, change_amount, reference, created_by)
    VALUES (?, NULL, ?, ?, ?, 0, ?, ?)`,
    [orderId, method, order.total, order.total, reference || 'Debt settlement', userId || null]);
  // Create accounting payment if module exists
  try {
    if (database.tableExists('accounting_payments')) {
      const member = order.member_id ? database.getOne('SELECT * FROM members WHERE id=?', [order.member_id]) : null;
      const partnerName = member ? [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ') : order.customer_name || '';
      const cashLike = ['cash'].includes(String(method).toLowerCase());
      const journal = database.getOne(`SELECT * FROM accounting_journals WHERE journal_type IN (${cashLike ? "'cash','bank'" : "'bank','cash'"}) ORDER BY CASE WHEN journal_type=? THEN 0 ELSE 1 END, id LIMIT 1`, [cashLike ? 'cash' : 'bank']);
      if (journal) {
        const payNo = 'CDEBT-' + String(orderId).padStart(4, '0');
        database.run(`INSERT INTO accounting_payments (payment_no,payment_direction,payment_category,partner_name,journal_id,payment_date,amount,method,state,memo,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [payNo, 'inbound', 'customer', partnerName, journal.id, new Date().toISOString().split('T')[0], order.total, method, 'posted', `Cafeteria debt settlement - Order #${order.order_no}`, userId || null]);
      }
    }
  } catch (_) {}
  auditService.log({ userId, action: 'cafeteria.debt.settled', entityType: 'cafeteria_orders', entityId: orderId, details: { total: order.total, method } });
  return database.getOne('SELECT * FROM cafeteria_orders WHERE id = ?', [orderId]);
}

module.exports = {
  listProducts,
  listCategories,
  listWarehouses,
  getProductById,
  getOpenSessionForUser,
  getLastPaidOrderForSession,
  openSession,
  closeSession,
  autoCloseStaleSessions,
  createOrder,
  getMemberCafeteriaDiscount,
  getOrderById,
  refundOrder,
  changeOrderPaymentMethod,
  applyStockMove,
  dashboardStats,
  reportSummary,
  getCurrency,
  getEnabledPaymentMethods,
  getDebts,
  settleDebt
};

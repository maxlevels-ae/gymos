const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');

module.exports = function (app, { database, eventBus, container }) {
  const router = express.Router();
  const plansRouter = express.Router();
  const db = database;

  function addTimeline(memberId, type, title, desc, userId) {
    try { db.run('INSERT INTO member_timeline (member_id, event_type, title, description, created_by) VALUES (?,?,?,?,?)', [memberId, type, title, desc || '', userId || null]); } catch(_){}
  }


  function ensureMembershipPaymentTables() {
    try {
      db.run(`CREATE TABLE IF NOT EXISTS membership_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        method TEXT NOT NULL DEFAULT 'cash',
        reference TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        accounting_payment_id INTEGER,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
        FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
      )`);
    } catch (_) {}
  }

  const _colCache = new Map();
  function tableHasColumn(table, column) {
    const ck = `${table}.${column}`;
    if (_colCache.has(ck)) return _colCache.get(ck);
    try {
      const cols = db.getAll(`PRAGMA table_info(${table})`) || [];
      const has = cols.some(col => col.name === column);
      _colCache.set(ck, has);
      return has;
    } catch (_) {
      _colCache.set(ck, false);
      return false;
    }
  }

  function buildSafeFreezeSelect() {
    if (!db.tableExists('freeze_requests')) return null;
    const wanted = ['id','membership_id','member_id','start_date','end_date','reason','status','created_at','payment_status','price','approved_by','completed_by'];
    const select = [];
    for (const col of wanted) {
      if (tableHasColumn('freeze_requests', col)) select.push(col);
    }
    if (tableHasColumn('freeze_requests', 'total_days')) select.push('total_days as days');
    else select.push('NULL as days');
    if (tableHasColumn('freeze_requests', 'currency')) select.push('currency');
    else select.push(`'JOD' as currency`);
    return select.join(', ');
  }

  function getMembershipTotals(ms) {
    const total = Math.max(0, Number(ms.total_amount || 0) || (Number(ms.price || 0) + Number(ms.signup_fee || 0) - Number(ms.discount || 0)));
    const paid = Number(ms.paid_amount || ms.total_paid || 0);
    const balance = Math.max(0, Number(ms.balance_amount || ms.outstanding_amount || ms.balance_due || (total - paid) || 0));
    const status = balance <= 0.0001 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
    return { total, paid, balance, status };
  }

  const sequenceService = require('../../core/services/sequence-service');
  function nextNumber(table, column, prefix) {
    const seqName = `${table}_${column}`;
    sequenceService.initFromTable(seqName, table, column, prefix);
    return sequenceService.next(seqName, prefix, 4);
  }

  function normalizePaymentMethod(method) {
    const raw = String(method || 'cash').toLowerCase();
    if (raw === 'cliq') return 'click';
    if (raw === 'visa') return 'bank';
    if (raw === 'card') return 'bank';
    return raw;
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function effectiveMembershipStatus(row) {
    if (!row) return 'cancelled';
    if (row.status === 'cancelled' || row.cancelled_at) return 'cancelled';
    if (row.status === 'frozen') return 'frozen';
    const today = todayStr();
    if (row.start_date && String(row.start_date) > today) return 'scheduled';
    if (row.end_date && String(row.end_date) < today) return 'expired';
    return row.status === 'expired' ? 'expired' : 'active';
  }

  function findBlockingMembership(memberId, excludeId = null) {
    const rows = db.getAll(`SELECT id, status, start_date, end_date, cancelled_at FROM memberships WHERE member_id = ? ${excludeId ? 'AND id != ?' : ''} ORDER BY date(start_date) DESC, id DESC`, excludeId ? [memberId, excludeId] : [memberId]) || [];
    return rows.find(row => ['active','frozen','scheduled'].includes(effectiveMembershipStatus(row))) || null;
  }

  function ensureMembershipRefundTables() {
    try {
      db.run(`CREATE TABLE IF NOT EXISTS membership_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        membership_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        refund_date TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        method TEXT NOT NULL DEFAULT 'cash',
        reason TEXT DEFAULT '',
        accounting_invoice_id INTEGER,
        accounting_payment_id INTEGER,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
        FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
      )`);
    } catch (_) {}
  }

  function getMemberDisplayName(memberId) {
    const m = db.getOne('SELECT first_name, last_name, member_no FROM members WHERE id = ?', [memberId]);
    if (!m) return 'Member #' + memberId;
    return [m.first_name, m.last_name].filter(Boolean).join(' ') + (m.member_no ? ` (${m.member_no})` : '');
  }

  function recalcMembershipFinancials(membershipId) {
    const ms = db.getOne('SELECT * FROM memberships WHERE id = ?', [membershipId]);
    if (!ms) return null;
    ensureMembershipPaymentTables();
    const totalPaid = Number(db.getOne('SELECT COALESCE(SUM(amount),0) as v FROM membership_payments WHERE membership_id=?', [membershipId])?.v || 0);
    const totalDue = Math.max(0, Number(ms.price || 0) + Number(ms.signup_fee || 0) - Number(ms.discount || 0));
    const balance = Math.max(0, totalDue - totalPaid);
    const paymentStatus = balance <= 0.0001 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');
    db.run(`UPDATE memberships SET total_paid=?, paid_amount=?, balance_due=?, outstanding_amount=?, payment_status=?, updated_at=datetime('now') WHERE id=?`, [totalPaid, totalPaid, balance, balance, paymentStatus, membershipId]);
    if (ms.invoice_ref && db.tableExists('accounting_invoices')) {
      db.run(`UPDATE accounting_invoices SET residual_amount=?, state=? WHERE invoice_no=?`, [balance, balance <= 0.0001 ? 'paid' : (totalPaid > 0 ? 'partial' : 'posted'), ms.invoice_ref]);
    }
    return { totalPaid, balance, paymentStatus };
  }

  function ensureSingleMembershipPolicy() {
    ensureMembershipPaymentTables();
    ensureMembershipRefundTables();
    try { db.run(`DROP INDEX IF EXISTS idx_memberships_member_unique`); } catch (_) {}
  }

  function postMembershipInvoiceAndPayments({ membershipId, memberId, partnerName, planName, totalDue, startDate, notes, paymentLines, userId }) {
    if (!db.tableExists('accounting_invoices') || !db.tableExists('accounting_payments')) return { invoiceId: null, invoiceNo: '' };

    const salesJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='SAJ'`)?.id || db.getOne(`SELECT id FROM accounting_journals ORDER BY id LIMIT 1`)?.id || null;
    const cashJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='CSH'`)?.id || salesJournal;
    const bankJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='BNK'`)?.id || salesJournal;
    const receivableAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='1130'`)?.id || null;
    const revenueAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='4110'`)?.id || db.getOne(`SELECT id FROM accounting_accounts WHERE account_type='income' ORDER BY id LIMIT 1`)?.id || null;
    const cashAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='1110'`)?.id || null;
    const bankAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='1120'`)?.id || cashAccount;

    const invoiceNo = nextNumber('accounting_invoices', 'invoice_no', 'INV-');
    const invoiceRef = `MEM-${membershipId}`;
    const inv = db.run(`INSERT INTO accounting_invoices (invoice_no,invoice_type,document_kind,business_line,source_reference,partner_name,invoice_date,due_date,state,subtotal,tax_amount,total_amount,residual_amount,journal_id,notes,created_by,posted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [invoiceNo, 'customer', 'invoice', 'membership', invoiceRef, partnerName, startDate, startDate, 'posted', totalDue, 0, totalDue, totalDue, salesJournal, notes || '', userId]);
    if (inv.lastInsertRowid) {
      db.run(`INSERT INTO accounting_invoice_lines (invoice_id,description,quantity,unit_price,tax_rate,line_subtotal,line_total,revenue_account_id,expense_account_id)
        VALUES (?,?,?,?,?,?,?,?,?)`, [inv.lastInsertRowid, planName || 'Membership', 1, totalDue, 0, totalDue, totalDue, revenueAccount, null]);
      if (receivableAccount && revenueAccount) {
        const entryNo = nextNumber('accounting_entries', 'entry_no', 'JE-');
        const je = db.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, salesJournal, startDate, invoiceNo, notes || '', 'posted', 'memberships', 'memberships', String(membershipId), userId]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, receivableAccount, invoiceNo, partnerName, totalDue, 0]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, revenueAccount, invoiceNo, partnerName, 0, totalDue]);
      }
    }

    let residual = Number(totalDue || 0);
    for (const line of (paymentLines || [])) {
      const amount = Number(line.amount || 0);
      if (!(amount > 0)) continue;
      const method = normalizePaymentMethod(line.method);
      const paymentNo = nextNumber('accounting_payments', 'payment_no', 'PAY-');
      const journalId = ['bank', 'click'].includes(method) ? bankJournal : cashJournal;
      const pay = db.run(`INSERT INTO accounting_payments (payment_no,payment_direction,payment_category,partner_name,journal_id,payment_date,amount,method,state,memo,invoice_id,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [paymentNo, 'inbound', 'customer', partnerName, journalId, line.payment_date || startDate, amount, method, 'posted', line.reference || '', inv.lastInsertRowid || null, userId]);
      ensureMembershipPaymentTables();
      db.run(`INSERT INTO membership_payments (membership_id,member_id,payment_date,amount,method,reference,notes,accounting_payment_id,created_by)
        VALUES (?,?,?,?,?,?,?,?,?)`, [membershipId, memberId, line.payment_date || startDate, amount, line.method || method, line.reference || '', notes || '', pay.lastInsertRowid || null, userId]);
      residual = Math.max(0, residual - amount);
      if (receivableAccount && (cashAccount || bankAccount)) {
        const entryNo = nextNumber('accounting_entries', 'entry_no', 'JE-');
        const liquidityAccount = ['bank', 'click'].includes(method) ? (bankAccount || cashAccount) : (cashAccount || bankAccount);
        const je = db.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, journalId, line.payment_date || startDate, paymentNo, line.reference || '', 'posted', 'memberships', 'membership_payments', String(pay.lastInsertRowid || ''), userId]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, liquidityAccount, paymentNo, partnerName, amount, 0]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, receivableAccount, paymentNo, partnerName, 0, amount]);
      }
    }

    if (inv.lastInsertRowid) {
      db.run(`UPDATE accounting_invoices SET residual_amount=?, state=? WHERE id=?`, [residual, residual <= 0.0001 ? 'paid' : ((totalDue - residual) > 0 ? 'partial' : 'posted'), inv.lastInsertRowid]);
    }

    return { invoiceId: inv.lastInsertRowid || null, invoiceNo };
  }

  ensureSingleMembershipPolicy();

  // ═══ PLANS ═══
  const parseFeatures = (p) => { if (p) { try { p.features = JSON.parse(p.features || '[]'); } catch (_) { p.features = []; } if (!Array.isArray(p.features)) p.features = []; } return p; };
  plansRouter.get('/', authMiddleware, (req, res) => {
    const plans = db.getAll('SELECT * FROM membership_plans ORDER BY sort_order, name');
    plans.forEach(parseFeatures);
    res.json({ success: true, data: plans });
  });
  plansRouter.get('/:id', authMiddleware, (req, res) => {
    const p = db.getOne('SELECT * FROM membership_plans WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ success: false, error: 'Plan not found' });
    res.json({ success: true, data: parseFeatures(p) });
  });
  plansRouter.post('/', authMiddleware, requirePermission('plans.manage'), (req, res) => {
    const { name, name_ar, description, plan_type, billing_type, duration_days, total_sessions, price, signup_fee,
            currency, is_recurring, recurring_interval, trial_days, freeze_allowed, freeze_max_days, freeze_max_count,
            freeze_requires_approval, freeze_allow_pwa_request, freeze_allow_pwa_unfreeze, freeze_pricing_mode, freeze_price_per_day, freeze_fixed_price,
            auto_renew, branch_id, features, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Plan name required' });
    const r = db.run(
      `INSERT INTO membership_plans (name, name_ar, description, plan_type, billing_type, duration_days, total_sessions,
       price, signup_fee, currency, is_recurring, recurring_interval, trial_days, freeze_allowed, freeze_max_days,
       freeze_max_count, freeze_requires_approval, freeze_allow_pwa_request, freeze_allow_pwa_unfreeze, freeze_pricing_mode, freeze_price_per_day, freeze_fixed_price, auto_renew, branch_id, features, cafeteria_discount_percent, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, name_ar||'', description||'', plan_type||'standard', billing_type||'period', duration_days||30, total_sessions||0,
       price||0, signup_fee||0, currency||(container.resolve('settings').get('app.currency', 'JOD')), is_recurring?1:0, recurring_interval||'monthly', trial_days||0,
       freeze_allowed!==false?1:0, freeze_max_days||30, freeze_max_count||2,
       freeze_requires_approval?1:0, freeze_allow_pwa_request===false?0:1, freeze_allow_pwa_unfreeze===false?0:1,
       freeze_pricing_mode||'inherit', Number(freeze_price_per_day||0), Number(freeze_fixed_price||0),
       auto_renew?1:0, branch_id||null, JSON.stringify(features||[]), Number(req.body.cafeteria_discount_percent||0), sort_order||0]
    );
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });
  plansRouter.put('/:id', authMiddleware, requirePermission('plans.manage'), (req, res) => {
    const b = req.body;
    db.run(
      `UPDATE membership_plans SET name=?, name_ar=?, description=?, plan_type=?, billing_type=?, duration_days=?,
       total_sessions=?, price=?, signup_fee=?, currency=?, is_recurring=?, recurring_interval=?, trial_days=?,
       freeze_allowed=?, freeze_max_days=?, freeze_max_count=?, freeze_requires_approval=?, freeze_allow_pwa_request=?, freeze_allow_pwa_unfreeze=?, freeze_pricing_mode=?, freeze_price_per_day=?, freeze_fixed_price=?, auto_renew=?, branch_id=?, is_active=?,
       features=?, cafeteria_discount_percent=?, sort_order=?, updated_at=datetime('now') WHERE id=?`,
      [b.name, b.name_ar, b.description, b.plan_type, b.billing_type, b.duration_days, b.total_sessions,
       b.price, b.signup_fee, b.currency, b.is_recurring?1:0, b.recurring_interval, b.trial_days,
       b.freeze_allowed?1:0, b.freeze_max_days, b.freeze_max_count, b.freeze_requires_approval?1:0, b.freeze_allow_pwa_request===false?0:1, b.freeze_allow_pwa_unfreeze===false?0:1, b.freeze_pricing_mode||'inherit', Number(b.freeze_price_per_day||0), Number(b.freeze_fixed_price||0), b.auto_renew?1:0, b.branch_id,
       b.is_active?1:0, JSON.stringify(b.features||[]), Number(b.cafeteria_discount_percent||0), b.sort_order||0, req.params.id]
    );
    res.json({ success: true });
  });
  plansRouter.delete('/:id', authMiddleware, requirePermission('plans.manage'), (req, res) => {
    db.run('DELETE FROM membership_plans WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  });

  // ═══ MEMBERSHIPS ═══
  router.get('/stats', authMiddleware, (req, res) => {
    const active = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE status='active'")?.c || 0;
    const expiringSoon = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE status='active' AND end_date BETWEEN date('now') AND date('now','+7 days')")?.c || 0;
    const expired = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE status='expired'")?.c || 0;
    const frozen = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE status='frozen'")?.c || 0;
    const trials = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE is_trial = 1 AND status='active'")?.c || 0;
    const unpaid = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE payment_status IN ('unpaid','partial') AND status='active'")?.c || 0;
    const revenue = db.getOne("SELECT COALESCE(SUM(total_paid),0) as t FROM memberships WHERE created_at >= date('now','start of month')")?.t || 0;
    res.json({ success: true, data: { active, expiringSoon, expired, frozen, trials, unpaid, revenueThisMonth: revenue } });
  });


  function createMembershipCreditNote({ membership, amount, reason, userId }) {
    if (!(db.tableExists('accounting_invoices') && db.tableExists('accounting_invoice_lines'))) return { invoiceId: null, invoiceNo: '' };
    const partnerName = getMemberDisplayName(membership.member_id);
    const salesJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='SAJ'`)?.id || db.getOne(`SELECT id FROM accounting_journals ORDER BY id LIMIT 1`)?.id || null;
    const receivableAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='1130'`)?.id || null;
    const revenueAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='2210'`)?.id || db.getOne(`SELECT id FROM accounting_accounts WHERE code='4110'`)?.id || db.getOne(`SELECT id FROM accounting_accounts WHERE account_type='income' ORDER BY id LIMIT 1`)?.id || null;
    const invoiceNo = nextNumber('accounting_invoices', 'invoice_no', 'CN-');
    const sourceRef = `MEM-REFUND-${membership.id}`;
    const inv = db.run(`INSERT INTO accounting_invoices (invoice_no,invoice_type,document_kind,business_line,source_reference,partner_name,invoice_date,due_date,state,subtotal,tax_amount,total_amount,residual_amount,journal_id,notes,created_by,posted_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [invoiceNo, 'customer', 'credit_note', 'memberships', sourceRef, partnerName, todayStr(), todayStr(), 'posted', -amount, 0, -amount, -amount, salesJournal, reason || 'Membership refund', userId]);
    if (inv.lastInsertRowid) {
      db.run(`INSERT INTO accounting_invoice_lines (invoice_id,description,quantity,unit_price,tax_rate,line_subtotal,line_total,revenue_account_id,expense_account_id)
        VALUES (?,?,?,?,?,?,?,?,?)`, [inv.lastInsertRowid, `Membership refund - ${membership.plan_name || 'Membership'}`, 1, amount, 0, -amount, -amount, revenueAccount, null]);
      if (receivableAccount && revenueAccount && db.tableExists('accounting_entries') && db.tableExists('accounting_entry_lines')) {
        const entryNo = nextNumber('accounting_entries', 'entry_no', 'JE-');
        const je = db.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, salesJournal, todayStr(), invoiceNo, reason || 'Membership refund', 'posted', 'memberships', 'membership_refunds', String(inv.lastInsertRowid), userId]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, revenueAccount, invoiceNo, partnerName, amount, 0]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, receivableAccount, invoiceNo, partnerName, 0, amount]);
      }
    }
    return { invoiceId: inv.lastInsertRowid || null, invoiceNo };
  }

  function createMembershipRefundPayment({ membership, amount, method, reason, invoiceId, userId }) {
    if (!(db.tableExists('accounting_payments'))) return { paymentId: null, paymentNo: '' };
    const normalized = normalizePaymentMethod(method);
    const partnerName = getMemberDisplayName(membership.member_id);
    const cashJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='CSH'`)?.id || db.getOne(`SELECT id FROM accounting_journals ORDER BY id LIMIT 1`)?.id || null;
    const bankJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='BNK'`)?.id || cashJournal;
    const journalId = ['bank','click'].includes(normalized) ? bankJournal : cashJournal;
    const paymentNo = nextNumber('accounting_payments', 'payment_no', 'PAY-');
    const pay = db.run(`INSERT INTO accounting_payments (payment_no,payment_direction,payment_category,partner_name,journal_id,payment_date,amount,method,state,memo,invoice_id,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [paymentNo, 'outbound', 'customer', partnerName, journalId, todayStr(), amount, normalized, 'posted', reason || 'Membership refund', invoiceId || null, userId]);

    if (db.tableExists('accounting_entries') && db.tableExists('accounting_entry_lines')) {
      const receivableAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='1130'`)?.id || null;
      const cashAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='1110'`)?.id || null;
      const bankAccount = db.getOne(`SELECT id FROM accounting_accounts WHERE code='1120'`)?.id || cashAccount;
      const offsetAccount = ['bank','click'].includes(normalized) ? bankAccount : cashAccount;
      if (receivableAccount && offsetAccount) {
        const entryNo = nextNumber('accounting_entries', 'entry_no', 'JE-');
        const je = db.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, journalId, todayStr(), paymentNo, reason || 'Membership refund payment', 'posted', 'memberships', 'membership_refunds', String(pay.lastInsertRowid || 0), userId]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, receivableAccount, paymentNo, partnerName, amount, 0]);
        db.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [je.lastInsertRowid, offsetAccount, paymentNo, partnerName, 0, amount]);
      }
    }
    return { paymentId: pay.lastInsertRowid || null, paymentNo };
  }

  function applyMembershipRefund({ membershipId, amount, method, reason, userId }) {
    ensureMembershipPaymentTables();
    ensureMembershipRefundTables();
    const membership = db.getOne('SELECT * FROM memberships WHERE id = ?', [membershipId]);
    if (!membership) throw new Error('Membership not found');
    const refundAmount = Number(amount || 0);
    if (!(refundAmount > 0)) throw new Error('Refund amount must be greater than zero');
    const refundable = Math.max(0, Number(membership.paid_amount || membership.total_paid || 0));
    if (refundAmount - refundable > 0.0001) throw new Error('Refund amount exceeds paid amount');

    const credit = createMembershipCreditNote({ membership, amount: refundAmount, reason, userId });
    const payment = createMembershipRefundPayment({ membership, amount: refundAmount, method, reason, invoiceId: credit.invoiceId, userId });

    db.run(`INSERT INTO membership_refunds (membership_id, member_id, refund_date, amount, method, reason, accounting_invoice_id, accounting_payment_id, created_by)
      VALUES (?,?,?,?,?,?,?,?,?)`, [membership.id, membership.member_id, todayStr(), refundAmount, normalizePaymentMethod(method), reason || '', credit.invoiceId, payment.paymentId, userId]);

    db.run(`INSERT INTO membership_payments (membership_id, member_id, payment_date, amount, method, reference, notes, accounting_payment_id, created_by)
      VALUES (?,?,?,?,?,?,?,?,?)`, [membership.id, membership.member_id, todayStr(), -refundAmount, normalizePaymentMethod(method), payment.paymentNo || credit.invoiceNo || '', reason || 'Refund', payment.paymentId, userId]);

    recalcMembershipFinancials(membership.id);
    addTimeline(membership.member_id, 'membership_refund', 'Membership Refund', `${refundAmount} refunded`, userId);
    return { creditNote: credit.invoiceNo || '', paymentNo: payment.paymentNo || '' };
  }

  router.get('/', authMiddleware, requirePermission('memberships.view'), (req, res) => {
    const { page = 1, limit = 20, status = '', member_id = '', search = '', type = '', payment = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = [], params = [];
    if (status) { where.push("ms.status = ?"); params.push(status); }
    if (member_id) { where.push("ms.member_id = ?"); params.push(Number(member_id)); }
    if (type) { where.push("ms.membership_type = ?"); params.push(type); }
    if (payment) { where.push("ms.payment_status = ?"); params.push(payment); }
    if (search) {
      where.push("(m.first_name LIKE ? OR m.last_name LIKE ? OR m.member_no LIKE ? OR ms.plan_name LIKE ?)");
      const s = `%${search}%`; params.push(s, s, s, s);
    }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const data = db.getAll(
      `SELECT ms.*, m.first_name, m.last_name, m.member_no, m.phone FROM memberships ms
       LEFT JOIN members m ON m.id = ms.member_id ${wc} ORDER BY ms.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    // Decorate each row with computed totals so the list shows correct amounts
    for (const row of data) {
      const t = getMembershipTotals(row);
      row.total_amount = t.total;
      row.paid_amount = t.paid;
      row.balance_amount = t.balance;
      row.outstanding_amount = t.balance;
      if (!row.payment_status) row.payment_status = t.status;
    }
    const total = db.getOne(`SELECT COUNT(*) as c FROM memberships ms LEFT JOIN members m ON m.id=ms.member_id ${wc}`, params)?.c || 0;
    res.json({ success: true, data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  router.get('/:id', authMiddleware, (req, res) => {
    const ms = db.getOne('SELECT ms.*, m.first_name, m.last_name, m.member_no FROM memberships ms LEFT JOIN members m ON m.id=ms.member_id WHERE ms.id=?', [req.params.id]);
    if (!ms) return res.status(404).json({ success: false, error: 'Not found' });

    const totals = getMembershipTotals(ms);
    ms.total_amount = totals.total;
    ms.paid_amount = totals.paid;
    ms.balance_amount = totals.balance;
    ms.outstanding_amount = totals.balance;
    ms.payment_status = ms.payment_status || totals.status;

    const freezeSelect = buildSafeFreezeSelect();
    ms.freezes = freezeSelect ? db.getAll(`SELECT ${freezeSelect} FROM freeze_requests WHERE membership_id = ? ORDER BY created_at DESC`, [req.params.id]) : [];
    ms.renewals = db.tableExists('membership_renewals') ? db.getAll('SELECT * FROM membership_renewals WHERE membership_id = ? ORDER BY created_at DESC', [req.params.id]) : [];
    ms.refunds = db.tableExists('membership_refunds') ? db.getAll('SELECT * FROM membership_refunds WHERE membership_id = ? ORDER BY created_at DESC', [req.params.id]) : [];

    if (ms.end_date) { ms.daysLeft = Math.max(0, Math.ceil((new Date(ms.end_date) - new Date()) / 86400000)); }
    if (ms.billing_type === 'sessions' && ms.total_sessions > 0) { ms.usagePercent = Math.round((ms.used_sessions / ms.total_sessions) * 100); }
    else if (ms.start_date && ms.end_date) {
      const total = (new Date(ms.end_date) - new Date(ms.start_date)) / 86400000;
      const elapsed = (new Date() - new Date(ms.start_date)) / 86400000;
      ms.usagePercent = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
    }
    res.json({ success: true, data: ms });
  });

  router.post('/', authMiddleware, requirePermission('memberships.create'), (req, res) => {
    const b = req.body || {};
    if (!b.member_id || !b.start_date) return res.status(400).json({ success: false, error: 'Member and start date required' });
    ensureMembershipPaymentTables();

    const existingMembership = findBlockingMembership(Number(b.member_id));
    if (existingMembership) return res.status(409).json({ success: false, error: 'يوجد اشتراك فعّال أو مجدول أو مجمّد لهذا العضو. يمكنك التجديد أو التعديل بدلاً من إنشاء اشتراك جديد.' });

    let plan_name = '', billing_type = 'period', total_sessions = 0, finalEnd = b.end_date, membership_type = b.membership_type || 'standard';
    let freeze_days_allowed = 30, freeze_max_count = 2, is_trial = 0, auto_renew = 0, signup_fee = Number(b.signup_fee || 0);

    if (b.plan_id) {
      const plan = db.getOne('SELECT * FROM membership_plans WHERE id = ?', [b.plan_id]);
      if (plan) {
        plan_name = plan.name; billing_type = plan.billing_type; total_sessions = plan.total_sessions || 0;
        membership_type = plan.plan_type || 'standard';
        freeze_days_allowed = plan.freeze_max_days || 30; freeze_max_count = plan.freeze_max_count || 2;
        is_trial = plan.trial_days > 0 && membership_type === 'trial' ? 1 : 0;
        auto_renew = plan.auto_renew; signup_fee = Number(b.signup_fee ?? plan.signup_fee ?? 0);
        if (!finalEnd && plan.duration_days) {
          const d = new Date(b.start_date); d.setDate(d.getDate() + Number(plan.duration_days || 0));
          finalEnd = d.toISOString().split('T')[0];
        }
        if (b.price === undefined || b.price === null || b.price === '') b.price = plan.price;
      }
    }
    if (b.is_trial) { is_trial = 1; membership_type = 'trial'; }

    const paymentLines = (Array.isArray(b.payment_lines) ? b.payment_lines : []).map(line => ({
      method: line.method || 'cash',
      amount: Number(line.amount || 0),
      payment_date: line.payment_date || b.start_date,
      reference: line.reference || '',
    })).filter(line => line.amount > 0);
    if (!paymentLines.length && Number(b.total_paid || 0) > 0) {
      paymentLines.push({ method: b.payment_method || 'cash', amount: Number(b.total_paid || 0), payment_date: b.start_date, reference: '' });
    }

    const totalPaid = paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const totalDue = Math.max(0, Number(b.price || 0) + signup_fee - Number(b.discount || 0));
    const balance = Math.max(0, totalDue - totalPaid);
    const payStatus = balance <= 0.0001 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');
    const primaryMethod = paymentLines.length > 1 ? 'split' : (paymentLines[0]?.method || b.payment_method || '');

    try {
      const r = db.run(
        `INSERT INTO memberships (member_id, plan_id, plan_name, membership_type, billing_type, start_date, end_date,
         total_sessions, remaining_sessions, price, signup_fee, discount, total_paid, balance_due, payment_status,
         payment_method, is_trial, is_recurring, auto_renew, freeze_days_allowed, freeze_max_count, branch_id,
         trainer_id, notes, activated_by, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [b.member_id, b.plan_id||null, plan_name, membership_type, billing_type, b.start_date, finalEnd||null,
         total_sessions, total_sessions, Number(b.price||0), signup_fee, Number(b.discount||0), totalPaid, balance,
         b.payment_status || payStatus, primaryMethod, is_trial, b.is_recurring?1:0, auto_renew,
         freeze_days_allowed, freeze_max_count, b.branch_id||null, b.trainer_id||null, b.notes||'', req.user.id, 'active']
      );

      const partnerName = getMemberDisplayName(b.member_id);
      const accounting = postMembershipInvoiceAndPayments({
        membershipId: r.lastInsertRowid,
        memberId: Number(b.member_id),
        partnerName,
        planName: plan_name || 'Membership',
        totalDue,
        startDate: b.start_date,
        notes: b.notes || '',
        paymentLines,
        userId: req.user.id,
      });
      if (accounting.invoiceNo) {
        db.run(`UPDATE memberships SET invoice_ref=?, updated_at=datetime('now') WHERE id=?`, [accounting.invoiceNo, r.lastInsertRowid]);
      }

      // Giving a member a membership activates them — set status explicitly so this
      // survives the manual-deactivation guard in the state sync.
      db.run("UPDATE members SET status='active', lifecycle_stage = CASE WHEN lifecycle_stage IN ('new','lead') THEN 'active' ELSE lifecycle_stage END WHERE id = ?", [b.member_id]);

      addTimeline(b.member_id, 'membership_created', 'Membership Started', `${plan_name || 'Custom'} membership created`, req.user.id);
      eventBus.emit('membership.created', { membershipId: r.lastInsertRowid, member_id: b.member_id });
      res.json({ success: true, data: { id: r.lastInsertRowid, invoice_ref: accounting.invoiceNo || '' } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || 'Failed to create membership' });
    }
  });

  router.put('/:id', authMiddleware, requirePermission('memberships.edit'), (req, res) => {
    const b = req.body;
    db.run(
      `UPDATE memberships SET start_date=?, end_date=?, total_sessions=?, used_sessions=?, remaining_sessions=?,
       price=?, discount=?, total_paid=?, balance_due=?, payment_status=?, payment_method=?, status=?, notes=?,
       trainer_id=?, updated_at=datetime('now') WHERE id=?`,
      [b.start_date, b.end_date, b.total_sessions, b.used_sessions, b.remaining_sessions,
       b.price, b.discount, b.total_paid, b.balance_due, b.payment_status, b.payment_method,
       b.status, b.notes, b.trainer_id, req.params.id]
    );
    res.json({ success: true });
  });

  // ─── Freeze (delegated to membership-freeze module) ──
  // Legacy routes are preserved, but the dedicated freeze service is now the only authoritative flow.
  router.post('/:id/freeze', authMiddleware, requirePermission('freeze.create'), (req, res) => {
    const ms = db.getOne('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
    if (!ms) return res.status(404).json({ success: false, error: 'Not found' });

    let freezeSvc;
    try {
      freezeSvc = container.resolve('membership-freeze.freeze-service');
    } catch (_) {
      return res.status(409).json({ success: false, error: 'membership-freeze module is required for freeze operations' });
    }

    try {
      const { start_date, end_date, days, reason } = req.body || {};
      const startDate = start_date || new Date().toISOString().split('T')[0];
      const computedEndDate = end_date || (() => {
        const end = new Date(startDate);
        end.setDate(end.getDate() + Number(days || 7));
        return end.toISOString().split('T')[0];
      })();

      const result = freezeSvc.createRequest({
        membershipId: Number(req.params.id),
        startDate,
        endDate: computedEndDate,
        reason: reason || '',
        userId: req.user.id,
      });

      if (!result.success) {
        return res.status(400).json({ success: false, error: (result.errors || ['Freeze request failed']).join('; ') });
      }

      return res.json({ success: true, data: result.data, requiresPayment: !!result.requiresPayment });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message || 'Freeze request failed' });
    }
  });

  router.post('/:id/unfreeze', authMiddleware, requirePermission('freeze.manage'), (req, res) => {
    const ms = db.getOne('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
    if (!ms) return res.status(404).json({ success: false, error: 'Not found' });

    let freezeSvc;
    try {
      freezeSvc = container.resolve('membership-freeze.freeze-service');
    } catch (_) {
      return res.status(409).json({ success: false, error: 'membership-freeze module is required for freeze operations' });
    }

    const activeFreezes = db.getAll("SELECT id FROM freeze_requests WHERE membership_id = ? AND status = 'active'", [req.params.id]);
    if (!activeFreezes.length) {
      return res.status(400).json({ success: false, error: 'No active freeze found for this membership' });
    }

    for (const freeze of activeFreezes) {
      freezeSvc.complete(freeze.id, req.user.id);
    }

    res.json({ success: true, data: { completed: activeFreezes.length } });
  });

  // ─── Renew ─────────────────────────────────────
  router.post('/:id/renew', authMiddleware, (req, res) => {
    const ms = db.getOne('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
    if (!ms) return res.status(404).json({ success: false, error: 'Not found' });
    const { days, price, total_paid } = req.body;
    const oldEnd = ms.end_date || new Date().toISOString().split('T')[0];
    const newEnd = new Date(oldEnd); newEnd.setDate(newEnd.getDate() + (days || 30));
    const newEndStr = newEnd.toISOString().split('T')[0];

    db.run('INSERT INTO membership_renewals (membership_id, member_id, old_end_date, new_end_date, price, renewed_by) VALUES (?,?,?,?,?,?)',
      [req.params.id, ms.member_id, oldEnd, newEndStr, price || 0, req.user.id]);

    db.run("UPDATE memberships SET end_date=?, status='active', total_paid=total_paid+?, updated_at=datetime('now') WHERE id=?",
      [newEndStr, total_paid || 0, req.params.id]);

    db.run("UPDATE members SET status='active', lifecycle_stage='active' WHERE id=?", [ms.member_id]);
    addTimeline(ms.member_id, 'renewal', 'Membership Renewed', `Extended to ${newEndStr}`, req.user.id);
    eventBus.emit('membership.renewed', { membershipId: req.params.id });
    res.json({ success: true, data: { new_end_date: newEndStr } });
  });

  // ─── Refund ────────────────────────────────────
  router.post('/:id/refund', authMiddleware, requirePermission('memberships.edit'), (req, res) => {
    try {
      const ms = db.getOne('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
      if (!ms) return res.status(404).json({ success: false, error: 'Not found' });
      const result = applyMembershipRefund({ membershipId: Number(req.params.id), amount: Number(req.body.amount || 0), method: req.body.method || 'cash', reason: req.body.reason || '', userId: req.user.id });
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message || 'Refund failed' });
    }
  });

  // ─── Cancel ────────────────────────────────────
  router.post('/:id/cancel', authMiddleware, requirePermission('memberships.edit'), (req, res) => {
    const ms = db.getOne('SELECT * FROM memberships WHERE id = ?', [req.params.id]);
    if (!ms) return res.status(404).json({ success: false, error: 'Not found' });
    try {
      const refundAmount = Number(req.body.refund_amount || 0);
      let refundResult = null;
      if (refundAmount > 0) {
        refundResult = applyMembershipRefund({ membershipId: Number(req.params.id), amount: refundAmount, method: req.body.refund_method || 'cash', reason: req.body.reason || 'Membership cancelled', userId: req.user.id });
      }
      db.run("UPDATE memberships SET status='cancelled', cancelled_at=datetime('now'), cancelled_reason=?, updated_at=datetime('now') WHERE id=?",
        [req.body.reason || '', req.params.id]);
      addTimeline(ms.member_id, 'cancel', 'Membership Cancelled', req.body.reason || '', req.user.id);
      eventBus.emit('membership.cancelled', { membershipId: req.params.id, member_id: ms.member_id });
      res.json({ success: true, data: { refund: refundResult } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message || 'Cancellation failed' });
    }
  });


  router.get('/:id/payments', authMiddleware, requirePermission('memberships.view'), (req, res) => {
    ensureMembershipPaymentTables();
    const data = db.getAll(`SELECT * FROM membership_payments WHERE membership_id=? ORDER BY payment_date DESC, id DESC`, [req.params.id]);
    res.json({ success: true, data });
  });

  router.post('/:id/payments', authMiddleware, requirePermission('memberships.edit'), (req, res) => {
    ensureMembershipPaymentTables();
    const ms = db.getOne('SELECT * FROM memberships WHERE id=?', [req.params.id]);
    if (!ms) return res.status(404).json({ success: false, error: 'Not found' });

    const inputLines = Array.isArray(req.body?.lines) ? req.body.lines : [req.body || {}];
    const lines = inputLines.map(line => ({
      amount: Number(line.amount || 0),
      payment_date: line.payment_date || new Date().toISOString().split('T')[0],
      method: line.method || 'cash',
      reference: line.reference || '',
      notes: line.notes || '',
    })).filter(line => line.amount > 0);

    if (!lines.length) return res.status(400).json({ success: false, error: 'Payment amount required' });

    const current = getMembershipTotals(ms);
    const batchAmount = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    if (batchAmount > current.balance + 0.0001) {
      return res.status(400).json({ success: false, error: 'Payment exceeds outstanding balance' });
    }

    let accountingInvoice = null;
    if (ms.invoice_ref && db.tableExists('accounting_invoices')) {
      accountingInvoice = db.getOne('SELECT * FROM accounting_invoices WHERE invoice_no=?', [ms.invoice_ref]);
    }

    try {
      const partnerName = getMemberDisplayName(ms.member_id);
      const cashJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='CSH'`)?.id || db.getOne(`SELECT id FROM accounting_journals ORDER BY id LIMIT 1`)?.id || null;
      const bankJournal = db.getOne(`SELECT id FROM accounting_journals WHERE code='BNK'`)?.id || cashJournal;

      for (const line of lines) {
        let accountingPaymentId = null;
        if (db.tableExists('accounting_payments')) {
          const normalized = normalizePaymentMethod(line.method);
          const journalId = ['bank','click'].includes(normalized) ? bankJournal : cashJournal;
          const paymentNo = nextNumber('accounting_payments', 'payment_no', 'PAY-');
          const pay = db.run(`INSERT INTO accounting_payments (payment_no,payment_direction,payment_category,partner_name,journal_id,payment_date,amount,method,state,memo,invoice_id,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [paymentNo, 'inbound', 'customer', partnerName, journalId, line.payment_date, line.amount, normalized, 'posted', line.reference || '', accountingInvoice?.id || null, req.user.id]);
          accountingPaymentId = pay.lastInsertRowid || null;
          if (accountingInvoice) {
            accountingInvoice.residual_amount = Math.max(0, Number(accountingInvoice.residual_amount || 0) - line.amount);
          }
        }
        db.run(`INSERT INTO membership_payments (membership_id,member_id,payment_date,amount,method,reference,notes,accounting_payment_id,created_by)
          VALUES (?,?,?,?,?,?,?,?,?)`, [req.params.id, ms.member_id, line.payment_date, line.amount, line.method, line.reference || '', line.notes || '', accountingPaymentId, req.user.id]);
      }

      const totalPaid = db.getOne('SELECT COALESCE(SUM(amount),0) as v FROM membership_payments WHERE membership_id=?', [req.params.id])?.v || 0;
      const totalDue = current.total;
      const balance = Math.max(0, totalDue - Number(totalPaid || 0));
      const status = balance <= 0.0001 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');
      const primaryMethod = lines.length > 1 ? 'split' : lines[0].method;

      db.run(`UPDATE memberships SET total_paid=?, paid_amount=?, balance_due=?, outstanding_amount=?, payment_status=?, payment_method=?, updated_at=datetime('now') WHERE id=?`, [totalPaid, totalPaid, balance, balance, status, primaryMethod, req.params.id]);

      if (accountingInvoice) {
        db.run(`UPDATE accounting_invoices SET residual_amount=?, state=? WHERE id=?`, [accountingInvoice.residual_amount, accountingInvoice.residual_amount <= 0.0001 ? 'paid' : 'partial', accountingInvoice.id]);
      }

      res.json({ success: true, data: { total_paid: totalPaid, paid_amount: totalPaid, balance_due: balance, outstanding_amount: balance, payment_status: status } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || 'Failed to add payment' });
    }
  });

  // Dashboard
  eventBus.addFilter('dashboard.stats', (stats) => {
    stats.activeMemberships = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE status='active'")?.c || 0;
    stats.expiringSoon = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE status='active' AND end_date BETWEEN date('now') AND date('now','+7 days')")?.c || 0;
    stats.revenueThisMonth = db.getOne("SELECT COALESCE(SUM(total_paid),0) as t FROM memberships WHERE created_at >= date('now','start of month')")?.t || 0;
    return stats;
  });

  eventBus.addFilter('dashboard.alerts', (alerts) => {
    const expiring = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE status='active' AND end_date BETWEEN date('now') AND date('now','+3 days')")?.c || 0;
    if (expiring > 0) alerts.push({ type: 'danger', icon: 'clock', text: `${expiring} membership(s) expiring within 3 days`, link: '/memberships?status=active' });
    const unpaid = db.getOne("SELECT COUNT(*) as c FROM memberships WHERE payment_status IN ('unpaid','partial') AND status='active'")?.c || 0;
    if (unpaid > 0) alerts.push({ type: 'warning', icon: 'dollar-sign', text: `${unpaid} active membership(s) with unpaid balance`, link: '/memberships?payment=unpaid' });
    return alerts;
  });

  app.use('/api/memberships', router);
  app.use('/api/plans', plansRouter);
};

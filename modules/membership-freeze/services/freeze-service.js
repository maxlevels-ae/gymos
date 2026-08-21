module.exports = function ({ database, eventBus, container }) {
  const db = database;
  const settingsSvc = () => container.resolve('settings');

  function settings(key, fallback) { return settingsSvc().get('freeze.' + key, fallback); }
  function todayIso() { return new Date().toISOString().split('T')[0]; }
  function nowIso() { return new Date().toISOString(); }
  function addDays(dateStr, days) {
    const d = new Date(String(dateStr || todayIso()) + 'T00:00:00');
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().split('T')[0];
  }
  function bool(v, fallback=false) {
    if (v === undefined || v === null || v === '') return fallback;
    return v === true || v === 1 || v === '1' || v === 'true';
  }
  function nextNumber(table, field, prefix) {
    const row = db.getOne(`SELECT ${field} as no FROM ${table} ORDER BY id DESC LIMIT 1`);
    const val = String(row?.no || '').replace(prefix, '');
    const n = Number(val) || 0;
    return prefix + String(n + 1).padStart(4, '0');
  }
  function addTimeline(memberId, type, title, desc, userId) {
    try {
      db.run('INSERT INTO member_timeline (member_id, event_type, title, description, created_by) VALUES (?,?,?,?,?)',
        [memberId, type, title, desc || '', userId || null]);
    } catch (_) {}
  }
  function computeMembershipStatus(row, explicitEndDate = null) {
    if (!row) return 'inactive';
    if (row.cancelled_at || row.status === 'cancelled') return 'cancelled';
    if (row.status === 'frozen') return 'frozen';
    const endDate = explicitEndDate || row.end_date;
    if (endDate && endDate < todayIso()) return 'expired';
    return 'active';
  }
  function syncMemberStatus(memberId) {
    const memberships = db.getAll('SELECT status, end_date, cancelled_at FROM memberships WHERE member_id = ?', [memberId]);
    let status = 'inactive';
    if (memberships.some((row) => computeMembershipStatus(row) === 'active')) status = 'active';
    else if (memberships.some((row) => computeMembershipStatus(row) === 'frozen')) status = 'frozen';
    db.run('UPDATE members SET status = ?, updated_at = datetime("now") WHERE id = ?', [status, memberId]);
    return status;
  }
  function getMembership(membershipId) {
    return db.getOne(`
      SELECT ms.*, mp.freeze_allowed, mp.freeze_max_days, mp.freeze_max_count,
             mp.freeze_pricing_mode, mp.freeze_price_per_day, mp.freeze_fixed_price,
             mp.freeze_requires_approval, mp.freeze_allow_pwa_request, mp.freeze_allow_pwa_unfreeze
      FROM memberships ms
      LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
      WHERE ms.id = ?`, [membershipId]);
  }
  function getRemainingActiveDays(membership, fromDate = null) {
    if (!membership?.end_date) return 0;
    const base = new Date((fromDate || todayIso()) + 'T00:00:00');
    const end = new Date(String(membership.end_date) + 'T00:00:00');
    const diff = Math.ceil((end - base) / 86400000);
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
  }
  function paymentSummary(freezeId) {
    const row = db.getOne(`
      SELECT
        COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0) as paid_in,
        COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) as paid_out
      FROM freeze_payments WHERE freeze_id=? AND status IN ('completed','refunded')`, [freezeId]) || {};
    return { paidIn: Number(row.paid_in || 0), paidOut: Number(row.paid_out || 0) };
  }
  function planRules(membership) {
    const globalRules = {
      maxDaysPerMembership: Number(settings('max_days_per_membership', 30)),
      maxTimes: Number(settings('max_times', 3)),
      minDays: Number(settings('min_days', 1)),
      maxDaysSingle: Number(settings('max_days_single', 30)),
      requirePayment: bool(settings('require_payment', false)),
      pricingMode: settings('pricing_mode', 'per_day'),
      pricePerDay: Number(settings('price_per_day', 1)),
      fixedPrice: Number(settings('fixed_price', 10)),
      currency: settingsSvc().get('app.currency', settings('currency', 'JOD')),
    };
    const m = membership || {};
    const planMaxDays = Number(m.freeze_max_days || 0);
    const planPricingMode = (m.freeze_pricing_mode && m.freeze_pricing_mode !== 'inherit') ? m.freeze_pricing_mode : globalRules.pricingMode;
    // When plan says 'free', override requirePayment to false regardless of global
    const planRequirePayment = planPricingMode === 'free' ? false : globalRules.requirePayment;
    return {
      ...globalRules,
      maxDaysPerMembership: planMaxDays > 0 ? planMaxDays : globalRules.maxDaysPerMembership,
      maxDaysSingle: planMaxDays > 0 ? planMaxDays : globalRules.maxDaysSingle,
      maxTimes: Number(m.freeze_max_count || globalRules.maxTimes),
      freezeAllowed: bool(m.freeze_allowed, true),
      requireApproval: bool(m.freeze_requires_approval, false),
      allowPwaRequest: bool(m.freeze_allow_pwa_request, true),
      allowPwaUnfreeze: bool(m.freeze_allow_pwa_unfreeze, true),
      pricingMode: planPricingMode,
      requirePayment: planRequirePayment,
      pricePerDay: Number(m.freeze_price_per_day || globalRules.pricePerDay),
      fixedPrice: Number(m.freeze_fixed_price || globalRules.fixedPrice),
    };
  }
  function createAccountingPayment({ freeze, amount, method, reference, userId }) {
    if (!db.tableExists('accounting_payments')) return null;
    const paymentNo = nextNumber('accounting_payments', 'payment_no', 'PAY-');
    const member = db.getOne('SELECT * FROM members WHERE id=?', [freeze.member_id]) || {};
    const partnerName = [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim() || member.member_no || '';
    const cashLike = ['cash'].includes(String(method || '').toLowerCase());
    const journal = db.getOne(
      `SELECT * FROM accounting_journals
       WHERE journal_type IN (${cashLike ? "'cash','bank'" : "'bank','cash'"})
       ORDER BY CASE WHEN journal_type=? THEN 0 ELSE 1 END, id LIMIT 1`,
      [cashLike ? 'cash' : 'bank']
    ) || db.getOne('SELECT * FROM accounting_journals ORDER BY id LIMIT 1');
    const journalId = journal?.id || null;
    if (!journalId) return null;
    const result = db.run(`INSERT INTO accounting_payments
      (payment_no,payment_direction,payment_category,partner_name,journal_id,payment_date,amount,method,state,memo,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [paymentNo, 'inbound', 'customer', partnerName, journalId, todayIso(), amount, method || 'cash', 'posted', reference || `Freeze payment #${freeze.id}`, userId || null]
    );
    return { id: result.lastInsertRowid, payment_no: paymentNo };
  }

  const api = {
    getRules() {
      return {
        maxDaysPerMembership: Number(settings('max_days_per_membership', 30)),
        maxTimes: Number(settings('max_times', 3)),
        minDays: Number(settings('min_days', 1)),
        maxDaysSingle: Number(settings('max_days_single', 30)),
        requirePayment: bool(settings('require_payment', false)),
        pricingMode: settings('pricing_mode', 'per_day'),
        pricePerDay: Number(settings('price_per_day', 1)),
        fixedPrice: Number(settings('fixed_price', 10)),
        currency: settingsSvc().get('app.currency', settings('currency', 'JOD')),
        pwaRequestsEnabled: bool(settings('pwa_requests_enabled', true)),
        pwaUnfreezeEnabled: bool(settings('pwa_unfreeze_enabled', true)),
      };
    },
    calculatePrice(totalDays, membership) {
      const rules = planRules(membership);
      // If the plan explicitly sets pricing mode to 'free', price is always 0
      if (rules.pricingMode === 'free') return 0;
      if (!rules.requirePayment) return 0;
      return rules.pricingMode === 'fixed' ? Number(rules.fixedPrice || 0) : Number(totalDays || 0) * Number(rules.pricePerDay || 0);
    },
    validate(membershipId, startDate, endDate, source='admin') {
      const errors = [];
      const membership = getMembership(Number(membershipId));
      if (!membership) return { valid: false, errors: ['Membership not found'] };
      const rules = planRules(membership);
      if (!rules.freezeAllowed) errors.push('Freeze is not allowed for this plan');
      if (source === 'pwa' && !rules.allowPwaRequest) errors.push('Freeze request from app is disabled for this plan');

      // Outstanding balance check — member must settle before freezing
      const outstandingBalance = Number(
        membership.outstanding_amount ||
        membership.balance_due ||
        Math.max(0, (Number(membership.price || 0) + Number(membership.signup_fee || 0) - Number(membership.discount || 0) - Number(membership.paid_amount || membership.total_paid || 0)))
        || 0
      );
      if (outstandingBalance > 0.001) {
        errors.push(`Membership has outstanding balance of ${outstandingBalance.toFixed(2)}. Please settle before freezing.`);
      }

      const state = computeMembershipStatus(membership);
      if (state === 'expired') errors.push('Cannot freeze an expired membership');
      if (state === 'cancelled') errors.push('Cannot freeze a cancelled membership');
      if (membership.status === 'frozen') errors.push('Membership is already frozen');

      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date(todayIso());
      const totalDays = Math.ceil((end - start) / 86400000);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) errors.push('Invalid dates');
      if (!isNaN(start.getTime()) && start < today) errors.push('Start date cannot be in the past');
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) errors.push('End date must be after start date');
      if (totalDays < rules.minDays) errors.push(`Minimum freeze duration is ${rules.minDays} days`);
      if (totalDays > rules.maxDaysSingle) errors.push(`Maximum single freeze is ${rules.maxDaysSingle} days`);

      const usedDays = this.getUsedFreezeDays(membershipId);
      if (usedDays + totalDays > rules.maxDaysPerMembership) errors.push(`Exceeds max freeze days (${usedDays} used of ${rules.maxDaysPerMembership})`);

      const remainingActiveDays = getRemainingActiveDays(membership, startDate);
      if (remainingActiveDays <= 0) errors.push('Membership does not have enough remaining active days to freeze');
      else if (totalDays > remainingActiveDays) errors.push(`Freeze duration exceeds remaining active days (${remainingActiveDays})`);

      const freezeCount = this.getFreezeCount(membershipId);
      if (freezeCount >= rules.maxTimes) errors.push(`Max freeze count reached (${rules.maxTimes})`);

      const overlap = db.getOne(
        `SELECT id FROM freeze_requests
         WHERE membership_id = ? AND status IN ('requested','pending','active')
         AND start_date < ? AND end_date > ?`,
        [membershipId, endDate, startDate]
      );
      if (overlap) errors.push('Overlaps with an existing freeze');
      return { valid: errors.length === 0, errors, membership, totalDays, rules };
    },
    getUsedFreezeDays(membershipId) {
      const row = db.getOne("SELECT COALESCE(SUM(total_days),0) as d FROM freeze_requests WHERE membership_id = ? AND status IN ('active','completed')", [membershipId]);
      return Number(row?.d || 0);
    },
    getFreezeCount(membershipId) {
      const row = db.getOne("SELECT COUNT(*) as c FROM freeze_requests WHERE membership_id = ? AND status IN ('active','completed')", [membershipId]);
      return Number(row?.c || 0);
    },
    createRequest({ membershipId, startDate, endDate, reason, userId, source='admin' }) {
      const validation = this.validate(membershipId, startDate, endDate, source);
      if (!validation.valid) return { success: false, errors: validation.errors };
      const { membership, totalDays, rules } = validation;
      const price = this.calculatePrice(totalDays, membership);
      const requiresPayment = rules.requirePayment && price > 0;
      // Determine intent: pwa/approval → 'requested', needs payment → 'pending', ready → 'pending' (activate will set 'active')
      const needsApproval = source === 'pwa' || rules.requireApproval;
      const insertStatus = needsApproval ? 'requested' : 'pending';
      const approvalStatus = needsApproval ? 'pending' : 'approved';
      const receiptNo = nextNumber('freeze_requests', 'receipt_no', settings('receipt_prefix', 'FRZ-'));
      const result = db.run(
        `INSERT INTO freeze_requests
         (membership_id, member_id, start_date, end_date, total_days, status, reason, price, payment_status,
          membership_end_before, created_by, request_source, approval_status, receipt_no)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [Number(membershipId), membership.member_id, startDate, endDate, totalDays, insertStatus, reason || '', price,
         requiresPayment ? 'unpaid' : 'paid', membership.end_date, userId || null, source, approvalStatus, receiptNo]
      );
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id = ?', [result.lastInsertRowid]);
      addTimeline(membership.member_id, 'freeze_request', source === 'pwa' ? 'Freeze Requested from App' : 'Freeze Requested', `${totalDays} days (${startDate} → ${endDate})`, userId);
      eventBus.emit('freeze.requested', { freezeId: freeze.id, membershipId, memberId: membership.member_id, totalDays, price, source });
      // Auto-activate if no approval needed and no payment needed
      if (!needsApproval && !requiresPayment) return this.activate(freeze.id, userId);
      return { success: true, data: freeze, requiresPayment, requiresApproval: needsApproval };
    },
    approve(freezeId, userId) {
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]);
      if (!freeze) return { success:false, errors:['Freeze not found'] };
      if (!['requested','pending'].includes(freeze.status)) return { success:false, errors:['Freeze is already processed'] };
      db.run(`UPDATE freeze_requests SET approval_status='approved', approved_by=?, approved_at=datetime('now'), updated_at=datetime('now'),
        status = CASE WHEN price > 0 AND payment_status != 'paid' THEN 'pending' ELSE status END WHERE id=?`, [userId || null, freezeId]);
      addTimeline(freeze.member_id, 'freeze_approved', 'Freeze Approved', `Request #${freeze.receipt_no || freeze.id}`, userId);
      const fresh = db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]);
      if (fresh.payment_status === 'paid' || Number(fresh.price || 0) <= 0) return this.activate(freezeId, userId);
      return { success:true, data:fresh };
    },
    recordPayment(freezeId, payload = {}) {
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id = ?', [freezeId]);
      if (!freeze) return { success: false, errors: ['Freeze not found'] };
      if (!['requested','pending','active'].includes(freeze.status)) return { success: false, errors: ['Freeze is not payable'] };
      if (Number(freeze.price || 0) <= 0) return { success: false, errors: ['This freeze does not require payment'] };

      const lines = Array.isArray(payload.payments) && payload.payments.length
        ? payload.payments
        : [{ method: payload.method || 'cash', amount: payload.amount || freeze.price, reference: payload.reference || '' }];

      let total = 0;
      for (const line of lines) {
        const amount = Number(line.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, errors: ['Invalid payment amount'] };
        total += amount;
      }

      const summary = paymentSummary(freezeId);
      const newPaid = summary.paidIn - summary.paidOut + total;
      if (newPaid - Number(freeze.price || 0) > 0.0001) return { success:false, errors:['Paid amount exceeds freeze price'] };

      for (const line of lines) {
        const amount = Number(line.amount || 0);
        const method = String(line.method || 'cash').toLowerCase();
        const accounting = createAccountingPayment({ freeze, amount, method, reference: line.reference || '', userId: payload.userId });
        const paymentNo = nextNumber('freeze_payments', 'payment_no', 'FP-');
        db.run(`INSERT INTO freeze_payments
          (freeze_id, amount, method, reference, received_by, status, accounting_payment_id, payment_no, direction)
          VALUES (?,?,?,?,?,?,?,?,?)`,
          [freezeId, amount, method, line.reference || '', payload.userId || null, 'completed', accounting?.id || null, paymentNo, 'in']
        );
      }

      const finalSummary = paymentSummary(freezeId);
      const finalPaid = finalSummary.paidIn - finalSummary.paidOut;
      const payStatus = finalPaid >= Number(freeze.price || 0) - 0.0001 ? 'paid' : (finalPaid > 0 ? 'partial' : 'unpaid');
      db.run(`UPDATE freeze_requests
              SET payment_status=?, payment_method=?, paid_at=CASE WHEN ?='paid' THEN datetime('now') ELSE paid_at END,
                  updated_at=datetime('now')
              WHERE id=?`, [payStatus, lines.map(x => x.method).join(','), payStatus, freezeId]);
      addTimeline(freeze.member_id, 'freeze_paid', 'Freeze Payment Received', `${total} via ${lines.map(x => x.method).join(', ')}`, payload.userId);
      const fresh = db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]);
      if (fresh.approval_status === 'approved' && payStatus === 'paid' && fresh.status !== 'active') return this.activate(freezeId, payload.userId);
      return { success:true, data:fresh };
    },
    activate(freezeId, userId, opts = {}) {
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id = ?', [freezeId]);
      if (!freeze) return { success: false, errors: ['Freeze not found'] };
      // Allow activation from 'pending' or 'requested' (after approval).
      // If already 'active', re-verify membership/member status to self-heal.
      if (!['pending', 'requested', 'active'].includes(freeze.status)) return { success: false, errors: ['Freeze cannot be activated from status: ' + freeze.status] };
      if (freeze.approval_status !== 'approved') return { success:false, errors:['Approval required before activation'] };
      // opts.allowUnpaid = freeze now and leave the fee as a debt (recorded on the member).
      if (!opts.allowUnpaid && Number(freeze.price || 0) > 0 && freeze.payment_status !== 'paid') return { success: false, errors: ['Payment required before activation'] };

      const membership = getMembership(freeze.membership_id);
      if (!membership) return { success: false, errors: ['Membership not found'] };
      // Only block if membership is expired/cancelled (allow active or already-frozen to proceed)
      const membershipState = computeMembershipStatus(membership);
      if (membershipState === 'expired' || membershipState === 'cancelled') return { success: false, errors: [`Cannot freeze a ${membershipState} membership`] };

      const newEnd = addDays(membership.end_date || todayIso(), freeze.total_days);
      // Only update freeze_days_used/freeze_count if this freeze hasn't already been counted
      if (freeze.status !== 'active') {
        db.run(`UPDATE memberships SET status='frozen',
          freeze_days_used = COALESCE(freeze_days_used,0) + ?,
          freeze_count = COALESCE(freeze_count,0) + 1,
          end_date = ?, updated_at=datetime('now') WHERE id=?`,
          [freeze.total_days, newEnd, freeze.membership_id]
        );
      } else {
        // Self-heal: just ensure membership is frozen
        db.run(`UPDATE memberships SET status='frozen', updated_at=datetime('now') WHERE id=?`, [freeze.membership_id]);
      }
      db.run(`UPDATE freeze_requests SET status='active', membership_end_after=?, updated_at=datetime('now') WHERE id=?`, [newEnd, freezeId]);
      db.run('UPDATE members SET status=? WHERE id=?', ['frozen', freeze.member_id]);
      addTimeline(freeze.member_id, 'freeze_activated', 'Membership Frozen', `Frozen for ${freeze.total_days} days (${freeze.start_date} → ${freeze.end_date})`, userId);
      eventBus.emit('freeze.activated', { freezeId, membershipId: freeze.membership_id, memberId: freeze.member_id, days: freeze.total_days });
      return { success: true, data: db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]) };
    },
    requestUnfreeze(freezeId, { reason='', userId=null, source='member-pwa' } = {}) {
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]);
      if (!freeze) return { success:false, errors:['Freeze not found'] };
      if (freeze.status !== 'active') return { success:false, errors:['Only active freeze can be unfrozen'] };
      const membership = getMembership(freeze.membership_id);
      const rules = planRules(membership);
      if (source === 'member-pwa' && !rules.allowPwaUnfreeze) return { success:false, errors:['Unfreeze request from app is disabled for this plan'] };
      db.run(`UPDATE freeze_requests SET unfreeze_requested_at=datetime('now'), unfreeze_requested_by=?, unfreeze_reason=?, updated_at=datetime('now') WHERE id=?`,
        [userId || null, reason || '', freezeId]);
      addTimeline(freeze.member_id, 'unfreeze_requested', 'Unfreeze Requested', reason || '', userId);
      return { success:true, data: db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]) };
    },
    approveUnfreeze(freezeId, userId) {
      return this.complete(freezeId, userId);
    },
    complete(freezeId, userId) {
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id = ?', [freezeId]);
      if (!freeze) return { success: false, errors: ['Freeze not found'] };
      if (freeze.status !== 'active') return { success: false, errors: ['Freeze is not active'] };
      const membership = getMembership(freeze.membership_id);
      if (!membership) return { success: false, errors: ['Membership not found'] };
      const restoredStatus = computeMembershipStatus({ ...membership, status: 'active' }, membership.end_date);
      db.run("UPDATE freeze_requests SET status='completed', completed_at=datetime('now'), updated_at=datetime('now') WHERE id=?", [freezeId]);
      db.run("UPDATE memberships SET status=?, updated_at=datetime('now') WHERE id=?", [restoredStatus === 'frozen' ? 'active' : restoredStatus, freeze.membership_id]);
      syncMemberStatus(freeze.member_id);
      addTimeline(freeze.member_id, 'freeze_completed', 'Freeze Completed', 'Freeze lifecycle completed safely', userId);
      eventBus.emit('freeze.completed', { freezeId, membershipId: freeze.membership_id, memberId: freeze.member_id });
      return { success:true };
    },
    refund(freezeId, { amount, reason='', userId=null } = {}) {
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]);
      if (!freeze) return { success:false, errors:['Freeze not found'] };
      const summary = paymentSummary(freezeId);
      const refundable = summary.paidIn - summary.paidOut;
      const refundAmount = Number(amount || refundable);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) return { success:false, errors:['Invalid refund amount'] };
      if (refundAmount - refundable > 0.0001) return { success:false, errors:['Refund exceeds paid amount'] };
      const paymentNo = nextNumber('freeze_payments', 'payment_no', 'FR-');
      db.run(`INSERT INTO freeze_payments (freeze_id, amount, method, reference, received_by, status, payment_no, direction, notes)
        VALUES (?,?,?,?,?,?,?,?,?)`, [freezeId, refundAmount, 'refund', reason || '', userId || null, 'refunded', paymentNo, 'out', reason || '']);
      const newRefunded = Number(freeze.refunded_amount || 0) + refundAmount;
      db.run(`UPDATE freeze_requests SET refunded_amount=?, refund_status=?, updated_at=datetime('now') WHERE id=?`,
        [newRefunded, newRefunded >= Number(freeze.price || 0) - 0.0001 ? 'refunded' : 'partial', freezeId]);
      addTimeline(freeze.member_id, 'freeze_refunded', 'Freeze Refund', `${refundAmount} refunded. ${reason}`, userId);
      return { success:true, data: db.getOne('SELECT * FROM freeze_requests WHERE id=?', [freezeId]) };
    },
    cancel(freezeId, { reason, userId }) {
      const freeze = db.getOne('SELECT * FROM freeze_requests WHERE id = ?', [freezeId]);
      if (!freeze) return { success: false, errors: ['Freeze not found'] };
      if (freeze.status === 'completed' || freeze.status === 'cancelled') return { success: false, errors: ['Cannot cancel a ' + freeze.status + ' freeze'] };
      const membership = getMembership(freeze.membership_id);
      if (!membership) return { success: false, errors: ['Membership not found'] };
      if (freeze.status === 'active') {
        const restoredEnd = freeze.membership_end_before || membership.end_date;
        const restoredStatus = computeMembershipStatus({ ...membership, status: 'active' }, restoredEnd);
        db.run(`UPDATE memberships SET status=?, end_date=?, freeze_days_used = MAX(0, COALESCE(freeze_days_used,0) - ?),
          freeze_count = MAX(0, COALESCE(freeze_count,0) - 1), updated_at=datetime('now') WHERE id=?`,
          [restoredStatus === 'frozen' ? 'active' : restoredStatus, restoredEnd, freeze.total_days, freeze.membership_id]);
      }
      db.run("UPDATE freeze_requests SET status='cancelled', cancel_reason=?, cancelled_at=datetime('now'), updated_at=datetime('now') WHERE id=?", [reason || '', freezeId]);
      syncMemberStatus(freeze.member_id);
      addTimeline(freeze.member_id, 'freeze_cancelled', 'Freeze Cancelled', reason || '', userId);
      return { success: true };
    },
    getReceipt(freezeId) {
      const freeze = this.getById(freezeId);
      if (!freeze) return null;
      const summary = paymentSummary(freezeId);
      return {
        freeze,
        lines: freeze.payments || [],
        totals: {
          total: Number(freeze.price || 0),
          paid: summary.paidIn,
          refunded: summary.paidOut,
          balance: Math.max(0, Number(freeze.price || 0) - (summary.paidIn - summary.paidOut))
        }
      };
    },
    getById(id) {
      const freeze = db.getOne(
        `SELECT fr.*, m.first_name, m.last_name, m.phone, m.member_no, ms.plan_name
         FROM freeze_requests fr
         LEFT JOIN members m ON m.id = fr.member_id
         LEFT JOIN memberships ms ON ms.id = fr.membership_id
         WHERE fr.id = ?`, [id]
      );
      if (freeze) freeze.payments = db.getAll('SELECT * FROM freeze_payments WHERE freeze_id = ? ORDER BY created_at DESC, id DESC', [id]);
      return freeze;
    },
    getByMember(memberId) {
      return db.getAll(`SELECT fr.*, ms.plan_name
        FROM freeze_requests fr LEFT JOIN memberships ms ON ms.id = fr.membership_id
        WHERE fr.member_id=? ORDER BY fr.created_at DESC`, [memberId]);
    },
    getEligibility(membershipId) {
      const membership = getMembership(Number(membershipId));
      if (!membership) return { eligible: false, reason: 'Membership not found' };
      const state = computeMembershipStatus(membership);
      if (state === 'expired') return { eligible: false, reason: 'Membership expired' };
      if (state === 'cancelled') return { eligible: false, reason: 'Membership cancelled' };
      if (membership.status === 'frozen') return { eligible: false, reason: 'Already frozen' };
      const rules = planRules(membership);
      if (!rules.freezeAllowed) return { eligible:false, reason:'Freeze is not allowed for this plan' };
      const usedDays = this.getUsedFreezeDays(membershipId);
      const freezeCount = this.getFreezeCount(membershipId);
      if (freezeCount >= rules.maxTimes) return { eligible: false, reason: `Max freeze count reached (${rules.maxTimes})` };
      const remainingDays = rules.maxDaysPerMembership - usedDays;
      if (remainingDays <= 0) return { eligible: false, reason: 'No freeze days remaining' };
      const membershipRemainingDays = getRemainingActiveDays(membership);
      const minimumNeededDays = Math.max(1, Number(rules.minDays || 1));
      if (membershipRemainingDays < minimumNeededDays) return { eligible: false, reason: `Membership has only ${membershipRemainingDays} active day(s) remaining` };
      return {
        eligible: true,
        remainingDays: Math.min(remainingDays, membershipRemainingDays),
        membershipRemainingDays,
        remainingTimes: rules.maxTimes - freezeCount,
        rules,
        membership: { id: membership.id, plan_name: membership.plan_name, status: membership.status, end_date: membership.end_date },
      };
    },
    getStats() {
      const count = (status) => Number(db.getOne("SELECT COUNT(*) as c FROM freeze_requests WHERE status=?", [status])?.c || 0);
      const revenue = db.getOne("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) as r FROM freeze_payments")?.r || 0;
      const revenueMonth = db.getOne("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) as r FROM freeze_payments WHERE created_at >= date('now','start of month')")?.r || 0;
      return { active: count('active'), pending: count('pending'), requested: count('requested'), completed: count('completed'), total: Number(db.getOne('SELECT COUNT(*) as c FROM freeze_requests')?.c || 0), revenue, revenueMonth };
    }
  };
  return api;
};
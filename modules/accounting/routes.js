const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const settingsService = require('../../core/services/settings-service');
const auditService = require('../../core/services/audit-service');

const COUNTRY_TEMPLATES = {
  JO: { name: 'Jordan', name_ar: 'الأردن', currency: 'JOD', taxName: 'Sales Tax', taxRate: 16 },
  SA: { name: 'Saudi Arabia', name_ar: 'السعودية', currency: 'SAR', taxName: 'VAT', taxRate: 15 },
  AE: { name: 'UAE', name_ar: 'الإمارات', currency: 'AED', taxName: 'VAT', taxRate: 5 },
  QA: { name: 'Qatar', name_ar: 'قطر', currency: 'QAR', taxName: 'VAT', taxRate: 5 },
  KW: { name: 'Kuwait', name_ar: 'الكويت', currency: 'KWD', taxName: 'VAT', taxRate: 5 },
  BH: { name: 'Bahrain', name_ar: 'البحرين', currency: 'BHD', taxName: 'VAT', taxRate: 10 },
  OM: { name: 'Oman', name_ar: 'عُمان', currency: 'OMR', taxName: 'VAT', taxRate: 5 },
  EG: { name: 'Egypt', name_ar: 'مصر', currency: 'EGP', taxName: 'VAT', taxRate: 14 },
  IQ: { name: 'Iraq', name_ar: 'العراق', currency: 'IQD', taxName: 'VAT', taxRate: 15 },
  LB: { name: 'Lebanon', name_ar: 'لبنان', currency: 'LBP', taxName: 'VAT', taxRate: 11 },
  PS: { name: 'Palestine', name_ar: 'فلسطين', currency: 'ILS', taxName: 'VAT', taxRate: 16 },
  YE: { name: 'Yemen', name_ar: 'اليمن', currency: 'YER', taxName: 'VAT', taxRate: 5 },
};

function buildTemplate(countryCode) {
  const country = COUNTRY_TEMPLATES[countryCode] || COUNTRY_TEMPLATES.JO;
  const taxLabelAr = country.taxName === 'Sales Tax' ? 'ضريبة المبيعات' : 'ضريبة القيمة المضافة';
  return {
    ...country,
    accounts: [
      ['1110', 'Cash', 'الصندوق', 'asset'],
      ['1120', 'Bank', 'البنك', 'asset'],
      ['1130', 'Accounts Receivable', 'الذمم المدينة', 'asset'],
      ['1140', 'Prepaid Expenses', 'مصروفات مدفوعة مقدماً', 'asset'],
      ['1210', 'Inventory', 'المخزون', 'asset'],
      ['1220', 'Fixed Assets', 'الأصول الثابتة', 'asset'],
      ['2110', 'Accounts Payable', 'الذمم الدائنة', 'liability'],
      ['2120', `${country.taxName} Payable`, `${taxLabelAr} المستحقة`, 'liability'],
      ['2130', 'Accrued Expenses', 'مصروفات مستحقة', 'liability'],
      ['3110', 'Owner Equity', 'حقوق الملكية', 'equity'],
      ['3120', 'Retained Earnings', 'الأرباح المبقاة', 'equity'],
      ['4110', 'Membership Revenue', 'إيراد الاشتراكات', 'income'],
      ['4120', 'Service Revenue', 'إيراد الخدمات', 'income'],
      ['4130', 'Cafeteria Revenue', 'إيراد الكافتيريا', 'income'],
      ['4170', 'Daily Membership Revenue', 'إيراد الاشتراكات اليومية', 'income'],
      ['4140', 'Other Revenue', 'إيرادات أخرى', 'income'],
      ['5110', 'Operating Expenses', 'المصاريف التشغيلية', 'expense'],
      ['5120', 'Payroll Expenses', 'مصاريف الرواتب', 'expense'],
      ['5130', 'Rent Expense', 'مصاريف الإيجار', 'expense'],
      ['5140', 'Utilities Expense', 'مصاريف الخدمات', 'expense'],
      ['5150', 'Purchases', 'المشتريات', 'expense'],
    ],
    journals: [
      ['SAJ', 'Sales Journal', 'يومية المبيعات', 'sale'],
      ['PUJ', 'Purchase Journal', 'يومية المشتريات', 'purchase'],
      ['BNK', 'Bank Journal', 'يومية البنك', 'bank'],
      ['CSH', 'Cash Journal', 'يومية الصندوق', 'cash'],
      ['MISC', 'Miscellaneous Journal', 'يومية متنوعة', 'general'],
    ],
    taxes: [
      {
        name: `${country.taxName} ${country.taxRate}%`,
        name_ar: `${taxLabelAr} ${country.taxRate}%`,
        rate: country.taxRate,
      },
    ],
  };

}

function normalizeCountry(input) {
  const raw = String(input || '').trim();
  if (!raw) return 'JO';
  const upper = raw.toUpperCase();
  if (COUNTRY_TEMPLATES[upper]) return upper;
  const aliases = {
    JORDAN: 'JO', JO: 'JO', 'الأردن': 'JO',
    'SAUDI ARABIA': 'SA', SAUDI: 'SA', KSA: 'SA', SA: 'SA', 'السعودية': 'SA',
    UAE: 'AE', 'UNITED ARAB EMIRATES': 'AE', EMIRATES: 'AE', AE: 'AE', 'الإمارات': 'AE',
    QATAR: 'QA', QA: 'QA', 'قطر': 'QA',
    KUWAIT: 'KW', KW: 'KW', 'الكويت': 'KW',
    BAHRAIN: 'BH', BH: 'BH', 'البحرين': 'BH',
    OMAN: 'OM', OM: 'OM', 'عمان': 'OM', 'عُمان': 'OM',
    EGYPT: 'EG', EG: 'EG', 'مصر': 'EG',
    IRAQ: 'IQ', IQ: 'IQ', 'العراق': 'IQ',
    LEBANON: 'LB', LB: 'LB', 'لبنان': 'LB',
    PALESTINE: 'PS', PS: 'PS', 'فلسطين': 'PS',
    YEMEN: 'YE', YE: 'YE', 'اليمن': 'YE',
  };
  return aliases[upper] || 'JO';
}

const sequenceService = require('../../core/services/sequence-service');
function nextNumber(database, table, col, prefix) {
  const seqName = `${table}_${col}`;
  sequenceService.initFromTable(seqName, table, col, prefix);
  return sequenceService.next(seqName, prefix, 5);
}

function getSettings() {
  return {
    include_cafeteria: !!settingsService.get('accounting.include_cafeteria', false),
    default_currency: settingsService.get('app.currency', settingsService.get('accounting.default_currency', 'JOD')),
    fiscal_year_start: settingsService.get('accounting.fiscal_year_start', '01-01'),
    localization_region: settingsService.get('accounting.localization_region', 'Middle East'),
    localization_country: settingsService.get('accounting.localization_country', 'JO'),
  };
}

function getLocalizationInstalled(database) {
  const accountCount = database.getOne(`SELECT COUNT(*) as c FROM accounting_accounts WHERE is_active=1`)?.c || 0;
  const journalCount = database.getOne(`SELECT COUNT(*) as c FROM accounting_journals WHERE is_active=1`)?.c || 0;
  const taxCount = database.getOne(`SELECT COUNT(*) as c FROM accounting_taxes WHERE is_active=1`)?.c || 0;
  return accountCount > 0 && journalCount > 0 && taxCount > 0;
}

function normalizeBusinessLine(input, includeCafeteria = false) {
  const raw = String(input || '').trim().toLowerCase();
  const map = {
    membership: 'memberships', memberships: 'memberships',
    package: 'packages', packages: 'packages',
    pt: 'personal_training', personal_training: 'personal_training', 'personal training': 'personal_training',
    sessions: 'sessions', session: 'sessions',
    freeze: 'freeze_fees', freeze_fees: 'freeze_fees',
    retail: 'retail', other: 'other',
    cafeteria: includeCafeteria ? 'cafeteria' : 'other',
    payroll: 'payroll',
    daily_memberships: 'daily_memberships',
    daily: 'daily_memberships',
  };
  return map[raw] || 'other';
}

function getRevenueAccountCodeForBusinessLine(line, includeCafeteria = false) {
  if (line === 'memberships') return '2210';
  if (line === 'packages') return '4120';
  if (line === 'personal_training') return '4140';
  if (line === 'sessions') return '4150';
  if (line === 'freeze_fees') return '4160';
  if (line === 'cafeteria') return includeCafeteria ? '4130' : '4110';
  if (line === 'daily_memberships') return '4170';
  return '4110';
}

function dashboard(database) {
  const receivables = database.getOne(`SELECT COALESCE(SUM(residual_amount),0) as v FROM accounting_invoices WHERE invoice_type='customer' AND state IN ('posted','partial')`)?.v || 0;
  const payables = database.getOne(`SELECT COALESCE(SUM(residual_amount),0) as v FROM accounting_invoices WHERE invoice_type='vendor' AND state IN ('posted','partial')`)?.v || 0;
  const overdueReceivables = database.getOne(`SELECT COALESCE(SUM(residual_amount),0) as v FROM accounting_invoices WHERE invoice_type='customer' AND state IN ('posted','partial') AND due_date IS NOT NULL AND due_date < date('now')`)?.v || 0;
  const monthRevenue = database.getOne(`SELECT COALESCE(SUM(total_amount-residual_amount),0) as v FROM accounting_invoices WHERE invoice_type='customer' AND substr(invoice_date,1,7)=substr(date('now'),1,7) AND state IN ('posted','partial','paid')`)?.v || 0;
  const monthExpenses = database.getOne(`SELECT COALESCE(SUM(total_amount-residual_amount),0) as v FROM accounting_invoices WHERE invoice_type='vendor' AND substr(invoice_date,1,7)=substr(date('now'),1,7) AND state IN ('posted','partial','paid')`)?.v || 0;
  const bankCash = database.getOne(`SELECT COALESCE(SUM(CASE WHEN a.code IN ('1110','1120') THEN (l.debit-l.credit) ELSE 0 END),0) as v FROM accounting_entry_lines l JOIN accounting_accounts a ON a.id=l.account_id JOIN accounting_entries e ON e.id=l.entry_id WHERE e.state='posted'`)?.v || 0;
  const draftEntries = database.getOne(`SELECT COUNT(*) as c FROM accounting_entries WHERE state='draft'`)?.c || 0;
  const postedEntries = database.getOne(`SELECT COUNT(*) as c FROM accounting_entries WHERE state='posted'`)?.c || 0;
  const unpaidCustomerInvoices = database.getOne(`SELECT COUNT(*) as c FROM accounting_invoices WHERE invoice_type='customer' AND state IN ('posted','partial')`)?.c || 0;
  const unpaidVendorBills = database.getOne(`SELECT COUNT(*) as c FROM accounting_invoices WHERE invoice_type='vendor' AND state IN ('posted','partial')`)?.c || 0;
  return {
    openReceivables: Number(receivables),
    openPayables: Number(payables),
    overdueReceivables: Number(overdueReceivables),
    monthlyRevenue: Number(monthRevenue),
    monthlyExpenses: Number(monthExpenses),
    cashBankBalance: Number(bankCash),
    draftEntries: Number(draftEntries),
    postedEntries: Number(postedEntries),
    unpaidCustomerInvoices: Number(unpaidCustomerInvoices),
    unpaidVendorBills: Number(unpaidVendorBills),
  };
}

function ensureBalanced(lines) {
  const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  return Math.abs(debit - credit) < 0.0001;
}

module.exports = function setup(app, { database, eventBus }) {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/bootstrap', requirePermission('accounting.view'), (req, res) => {
    const settings = getSettings();
    settings.display_currency = settingsService.get('app.currency', settings.default_currency || 'JOD');
    const countryList = Object.entries(COUNTRY_TEMPLATES).map(([code, cfg]) => ({ code, name: cfg.name, name_ar: cfg.name_ar || cfg.name, currency: cfg.currency }));
    res.json({
      success: true,
      data: {
        settings,
        countries: countryList,
        localization_installed: getLocalizationInstalled(database),
        journals: database.getAll(`SELECT * FROM accounting_journals WHERE is_active=1 ORDER BY code`),
        accounts: database.getAll(`SELECT * FROM accounting_accounts WHERE is_active=1 ORDER BY code`),
        taxes: database.getAll(`SELECT * FROM accounting_taxes WHERE is_active=1 ORDER BY id DESC`),
        paymentMethods: database.tableExists('accounting_payment_methods') ? database.getAll(`SELECT * FROM accounting_payment_methods WHERE is_active=1 ORDER BY id`) : [],
      },
    });
  });

  const { cacheResponse: _cacheAcc } = require('../../core/middleware/response-cache');

  router.get('/dashboard', requirePermission('accounting.view'), _cacheAcc(15000), (req, res) => {
    res.json({ success: true, data: dashboard(database) });
  });

  router.get('/settings', requirePermission('accounting.manage_settings'), (req, res) => {
    res.json({ success: true, data: getSettings() });
  });

  router.put('/settings', requirePermission('accounting.manage_settings'), (req, res) => {
    const body = req.body || {};
    const allowed = ['include_cafeteria', 'default_currency', 'fiscal_year_start', 'localization_region', 'localization_country'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        settingsService.set(`accounting.${key}`, body[key], {
          module: 'accounting',
          type: key === 'include_cafeteria' ? 'boolean' : 'string',
        });
      }
    }
    auditService.log({ userId: req.user.id, action: 'accounting.settings.update', entityType: 'settings', entityId: 0, details: body });
    res.json({ success: true, data: getSettings() });
  });

  router.post('/settings/localization/install', requirePermission('accounting.manage_settings'), (req, res) => {
    try {
      if (!database.tableExists('accounting_accounts') || !database.tableExists('accounting_journals') || !database.tableExists('accounting_taxes')) {
        return res.status(500).json({ success: false, error: 'Accounting tables are missing. Reinstall or reload the accounting module first.' });
      }

      const country = normalizeCountry(req.body?.country || getSettings().localization_country || 'JO');
      const tpl = buildTemplate(country);

      settingsService.set('accounting.localization_region', 'Middle East', { module: 'accounting', type: 'string' });
      settingsService.set('accounting.localization_country', country, { module: 'accounting', type: 'string' });
      settingsService.set('accounting.default_currency', tpl.currency, { module: 'accounting', type: 'string' });

      for (const [code, name, name_ar, account_type] of tpl.accounts) {
        const existing = database.getOne('SELECT id FROM accounting_accounts WHERE code=?', [code]);
        if (!existing) {
          database.run(
            'INSERT INTO accounting_accounts (code,name,name_ar,account_type,allow_reconcile,is_active) VALUES (?,?,?,?,?,1)',
            [code, name, name_ar, account_type, ['1110', '1120', '1130', '2110'].includes(code) ? 1 : 0]
          );
        } else {
          database.run(
            'UPDATE accounting_accounts SET name=?, name_ar=?, account_type=?, allow_reconcile=?, updated_at=datetime(\'now\') WHERE code=?',
            [name, name_ar, account_type, ['1110', '1120', '1130', '2110'].includes(code) ? 1 : 0, code]
          );
        }
      }

      for (const [code, name, name_ar, journal_type] of tpl.journals) {
        const existing = database.getOne('SELECT id FROM accounting_journals WHERE code=?', [code]);
        if (!existing) {
          database.run(
            'INSERT INTO accounting_journals (code,name,name_ar,journal_type,is_active) VALUES (?,?,?,?,1)',
            [code, name, name_ar, journal_type]
          );
        } else {
          database.run(
            'UPDATE accounting_journals SET name=?, name_ar=?, journal_type=?, updated_at=datetime(\'now\') WHERE code=?',
            [name, name_ar, journal_type, code]
          );
        }
      }

      for (const tax of tpl.taxes) {
        const existing = database.getOne('SELECT id FROM accounting_taxes WHERE name=? AND rate=?', [tax.name, tax.rate]);
        if (!existing) {
          database.run(
            'INSERT INTO accounting_taxes (name,name_ar,rate,tax_scope,price_include,is_active) VALUES (?,?,?,?,?,1)',
            [tax.name, tax.name_ar, tax.rate, 'sale', 0]
          );
        } else {
          database.run(
            'UPDATE accounting_taxes SET name_ar=?, tax_scope=?, price_include=?, is_active=1 WHERE id=?',
            [tax.name_ar, 'sale', 0, existing.id]
          );
        }
      }

      auditService.log({
        userId: req.user.id,
        action: 'accounting.localization.install',
        entityType: 'settings',
        entityId: 0,
        details: { country, currency: tpl.currency }
      });

      res.json({
        success: true,
        data: {
          country,
          country_name: tpl.name,
          currency: tpl.currency,
          seeded: true,
          counts: {
            accounts: database.getOne('SELECT COUNT(*) as c FROM accounting_accounts')?.c || 0,
            journals: database.getOne('SELECT COUNT(*) as c FROM accounting_journals')?.c || 0,
            taxes: database.getOne('SELECT COUNT(*) as c FROM accounting_taxes')?.c || 0
          }
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message || 'Failed to install localization' });
    }
  });

  router.get('/accounts', requirePermission('accounting.view'), (_req, res) => {
    res.json({ success: true, data: database.getAll(`SELECT * FROM accounting_accounts ORDER BY code`) });
  });

  router.post('/accounts', requirePermission('accounting.manage_accounts'), (req, res) => {
    const b = req.body || {};
    if (!b.code || !b.name || !b.account_type) return res.status(400).json({ success: false, error: 'code, name, account_type required' });
    const r = database.run(
      `INSERT INTO accounting_accounts (code,name,name_ar,account_type,parent_id,allow_reconcile,is_active) VALUES (?,?,?,?,?,?,?)`,
      [b.code, b.name, b.name_ar || '', b.account_type, b.parent_id || null, b.allow_reconcile ? 1 : 0, b.is_active === false ? 0 : 1]
    );
    res.json({ success: true, data: database.getOne('SELECT * FROM accounting_accounts WHERE id=?', [r.lastInsertRowid]) });
  });

  router.get('/journals', requirePermission('accounting.view'), (_req, res) => {
    res.json({
      success: true,
      data: database.getAll(`SELECT j.*, da.code as debit_code, ca.code as credit_code FROM accounting_journals j LEFT JOIN accounting_accounts da ON da.id=j.default_debit_account_id LEFT JOIN accounting_accounts ca ON ca.id=j.default_credit_account_id ORDER BY j.code`),
    });
  });

  router.post('/journals', requirePermission('accounting.manage_journals'), (req, res) => {
    const b = req.body || {};
    if (!b.code || !b.name || !b.journal_type) return res.status(400).json({ success: false, error: 'code, name, journal_type required' });
    const r = database.run(
      `INSERT INTO accounting_journals (code,name,name_ar,journal_type,default_debit_account_id,default_credit_account_id,is_active) VALUES (?,?,?,?,?,?,?)`,
      [b.code, b.name, b.name_ar || '', b.journal_type, b.default_debit_account_id || null, b.default_credit_account_id || null, b.is_active === false ? 0 : 1]
    );
    res.json({ success: true, data: database.getOne('SELECT * FROM accounting_journals WHERE id=?', [r.lastInsertRowid]) });
  });

  router.get('/journal-entries', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT e.*, j.code as journal_code, j.name as journal_name, (SELECT COALESCE(SUM(debit),0) FROM accounting_entry_lines WHERE entry_id=e.id) as total_debit, (SELECT COALESCE(SUM(credit),0) FROM accounting_entry_lines WHERE entry_id=e.id) as total_credit FROM accounting_entries e JOIN accounting_journals j ON j.id=e.journal_id ORDER BY e.id DESC`);
    res.json({ success: true, data });
  });

  router.post('/journal-entries', requirePermission('accounting.manage_entries'), (req, res) => {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (!b.journal_id || !b.entry_date || !lines.length) return res.status(400).json({ success: false, error: 'journal_id, entry_date, lines required' });
    if (!ensureBalanced(lines)) return res.status(400).json({ success: false, error: 'Journal entry must be balanced' });
    const no = nextNumber(database, 'accounting_entries', 'entry_no', 'JE-');
    database.get().exec('BEGIN');
    try {
      const r = database.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,created_by) VALUES (?,?,?,?,?,?,?)`, [no, b.journal_id, b.entry_date, b.reference || '', b.memo || '', b.state === 'posted' ? 'posted' : 'draft', req.user.id]);
      for (const line of lines) {
        database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [r.lastInsertRowid, line.account_id, line.label || '', line.partner_name || '', Number(line.debit || 0), Number(line.credit || 0)]);
      }
      if (b.state === 'posted') database.run(`UPDATE accounting_entries SET posted_at=datetime('now') WHERE id=?`, [r.lastInsertRowid]);
      database.get().exec('COMMIT');
      eventBus.emit('accounting.entry.created', { id: r.lastInsertRowid, posted: b.state === 'posted' });
      res.json({ success: true, data: { id: r.lastInsertRowid, entry_no: no } });
    } catch (e) {
      database.get().exec('ROLLBACK');
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post('/invoices/:id/post', requirePermission('accounting.manage_invoices'), (req, res) => {
    const id = Number(req.params.id);
    const inv = database.getOne(`SELECT * FROM accounting_invoices WHERE id=?`, [id]);
    if (!inv) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (inv.state !== 'draft') return res.status(400).json({ success: false, error: 'Invoice is not in draft state' });
    const includeCafeteria = !!settingsService.get('accounting.include_cafeteria', false);
    const type = inv.invoice_type;
    const documentKind = inv.document_kind || (type === 'vendor' ? 'bill' : 'invoice');
    const partnerAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [type === 'vendor' ? '2110' : '1130'])?.id;
    const fallbackCode = type === 'vendor' ? '5110' : getRevenueAccountCodeForBusinessLine(inv.business_line || 'other', includeCafeteria);
    const offsetAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [fallbackCode])?.id
      || database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [type === 'vendor' ? '5110' : '4110'])?.id;
    const journal = inv.journal_id || database.getOne(`SELECT id FROM accounting_journals WHERE code=?`, [type === 'vendor' ? 'PUJ' : 'SAJ'])?.id;
    database.get().exec('BEGIN');
    try {
      database.run(`UPDATE accounting_invoices SET state='posted', posted_at=datetime('now') WHERE id=?`, [id]);
      if (partnerAccount && offsetAccount && journal) {
        const entryNo = nextNumber(database, 'accounting_entries', 'entry_no', 'JE-');
        const absTotal = Math.abs(Number(inv.total_amount || 0));
        const er = database.run(
          `INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
          [entryNo, journal, inv.invoice_date, inv.invoice_no, inv.notes || '', 'posted', 'accounting', 'accounting_invoices', String(id), req.user.id]
        );
        if (type === 'vendor') {
          if (documentKind === 'credit_note') {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, inv.invoice_no, inv.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, inv.invoice_no, inv.partner_name, 0, absTotal]);
          } else {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, inv.invoice_no, inv.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, inv.invoice_no, inv.partner_name, 0, absTotal]);
          }
        } else {
          if (documentKind === 'credit_note') {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, inv.invoice_no, inv.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, inv.invoice_no, inv.partner_name, 0, absTotal]);
          } else {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, inv.invoice_no, inv.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, inv.invoice_no, inv.partner_name, 0, absTotal]);
          }
        }
      }
      database.get().exec('COMMIT');
      auditService.log({ userId: req.user.id, action: 'accounting.invoice.post', entityType: 'accounting_invoices', entityId: id, details: { invoice_no: inv.invoice_no } });
      res.json({ success: true, data: { id, state: 'posted' } });
    } catch (e) {
      database.get().exec('ROLLBACK');
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post('/journal-entries/:id/post', requirePermission('accounting.manage_entries'), (req, res) => {
    const id = Number(req.params.id);
    const lines = database.getAll('SELECT * FROM accounting_entry_lines WHERE entry_id=?', [id]);
    if (!lines.length) return res.status(404).json({ success: false, error: 'Entry not found' });
    if (!ensureBalanced(lines)) return res.status(400).json({ success: false, error: 'Entry is not balanced' });
    database.run(`UPDATE accounting_entries SET state='posted', posted_at=datetime('now') WHERE id=? AND state='draft'`, [id]);
    res.json({ success: true });
  });

  router.get('/invoices', requirePermission('accounting.view'), (req, res) => {
    const type = req.query.type === 'vendor' ? 'vendor' : 'customer';
    const data = database.getAll(`SELECT i.*, j.code as journal_code FROM accounting_invoices i LEFT JOIN accounting_journals j ON j.id=i.journal_id WHERE i.invoice_type=? ORDER BY i.id DESC`, [type]);
    res.json({ success: true, data });
  });

  router.get('/vendor-bills', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT i.*, j.code as journal_code FROM accounting_invoices i LEFT JOIN accounting_journals j ON j.id=i.journal_id WHERE i.invoice_type='vendor' ORDER BY i.id DESC`);
    res.json({ success: true, data });
  });

  router.get('/customer-invoices', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT i.*, j.code as journal_code FROM accounting_invoices i LEFT JOIN accounting_journals j ON j.id=i.journal_id WHERE i.invoice_type='customer' AND COALESCE(i.document_kind,'invoice')='invoice' ORDER BY i.id DESC`);
    res.json({ success: true, data });
  });

  router.get('/customer-credit-notes', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT i.*, j.code as journal_code FROM accounting_invoices i LEFT JOIN accounting_journals j ON j.id=i.journal_id WHERE i.invoice_type='customer' AND COALESCE(i.document_kind,'invoice')='credit_note' ORDER BY i.id DESC`);
    res.json({ success: true, data });
  });

  router.get('/vendor-credit-notes', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT i.*, j.code as journal_code FROM accounting_invoices i LEFT JOIN accounting_journals j ON j.id=i.journal_id WHERE i.invoice_type='vendor' AND COALESCE(i.document_kind,'bill')='credit_note' ORDER BY i.id DESC`);
    res.json({ success: true, data });
  });


  router.post('/invoices', requirePermission('accounting.manage_invoices'), (req, res) => {
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : [];
    const type = b.invoice_type === 'vendor' ? 'vendor' : 'customer';
    const includeCafeteria = !!settingsService.get('accounting.include_cafeteria', false);
    const documentKind = (b.document_kind === 'credit_note') ? 'credit_note' : (type === 'vendor' ? 'bill' : 'invoice');
    const businessLine = normalizeBusinessLine(b.business_line, includeCafeteria);
    if (!b.partner_name || !b.invoice_date || !lines.length) return res.status(400).json({ success: false, error: 'partner_name, invoice_date, lines required' });
    let subtotal = 0;
    let tax = 0;
    for (const line of lines) {
      const ls = Number(line.quantity || 1) * Number(line.unit_price || 0);
      subtotal += ls;
      tax += ls * (Number(line.tax_rate || 0) / 100);
      line.line_subtotal = ls;
      line.line_total = ls + ls * (Number(line.tax_rate || 0) / 100);
    }
    const total = subtotal + tax;
    const prefix = documentKind === 'credit_note' ? (type === 'vendor' ? 'VCN-' : 'CN-') : (type === 'vendor' ? 'BILL-' : 'INV-');
    const no = nextNumber(database, 'accounting_invoices', 'invoice_no', prefix);
    const journal = b.journal_id || database.getOne(`SELECT id FROM accounting_journals WHERE code=?`, [type === 'vendor' ? 'PUJ' : 'SAJ'])?.id || null;
    database.get().exec('BEGIN');
    try {
      const sign = documentKind === 'credit_note' ? -1 : 1;
      const r = database.run(`INSERT INTO accounting_invoices (invoice_no,invoice_type,document_kind,business_line,source_reference,partner_name,invoice_date,due_date,state,subtotal,tax_amount,total_amount,residual_amount,journal_id,notes,created_by,posted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [no, type, documentKind, businessLine, b.source_reference || '', b.partner_name, b.invoice_date, b.due_date || null, b.state === 'posted' ? 'posted' : 'draft', subtotal * sign, tax * sign, total * sign, total * sign, journal, b.notes || '', req.user.id, b.state === 'posted' ? new Date().toISOString() : null]);
      for (const line of lines) {
        database.run(`INSERT INTO accounting_invoice_lines (invoice_id,description,quantity,unit_price,tax_rate,line_subtotal,line_total,revenue_account_id,expense_account_id) VALUES (?,?,?,?,?,?,?,?,?)`, [r.lastInsertRowid, line.description, Number(line.quantity || 1), Number(line.unit_price || 0), Number(line.tax_rate || 0), line.line_subtotal * sign, line.line_total * sign, line.revenue_account_id || null, line.expense_account_id || null]);
      }
      if (b.state === 'posted') {
        const partnerAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [type === 'vendor' ? '2110' : '1130'])?.id;
        const fallbackOffset = type === 'vendor' ? '5110' : getRevenueAccountCodeForBusinessLine(businessLine, includeCafeteria);
        const offsetAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [fallbackOffset])?.id || database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [type === 'vendor' ? '5110' : '4110'])?.id;
        const entryNo = nextNumber(database, 'accounting_entries', 'entry_no', 'JE-');
        const er = database.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, journal, b.invoice_date, no, b.notes || '', 'posted', 'accounting', 'accounting_invoices', String(r.lastInsertRowid), req.user.id]);
        const absTotal = Math.abs(total);
        if (type === 'vendor') {
          if (documentKind === 'credit_note') {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, no, b.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, no, b.partner_name, 0, absTotal]);
          } else {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, no, b.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, no, b.partner_name, 0, absTotal]);
          }
        } else {
          if (documentKind === 'credit_note') {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, no, b.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, no, b.partner_name, 0, absTotal]);
          } else {
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, no, b.partner_name, absTotal, 0]);
            database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, offsetAccount, no, b.partner_name, 0, absTotal]);
          }
        }
      }
      database.get().exec('COMMIT');
      res.json({ success: true, data: { id: r.lastInsertRowid, invoice_no: no, document_kind: documentKind, business_line: businessLine } });
    } catch (e) {
      database.get().exec('ROLLBACK');
      res.status(500).json({ success: false, error: e.message });
    }
  });


  router.get('/payments', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT p.*, j.code as journal_code, i.invoice_no FROM accounting_payments p JOIN accounting_journals j ON j.id=p.journal_id LEFT JOIN accounting_invoices i ON i.id=p.invoice_id ORDER BY p.id DESC`);
    res.json({ success: true, data });
  });

  router.get('/customer-payments', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT p.*, j.code as journal_code, i.invoice_no FROM accounting_payments p JOIN accounting_journals j ON j.id=p.journal_id LEFT JOIN accounting_invoices i ON i.id=p.invoice_id WHERE COALESCE(p.payment_category,'customer')='customer' ORDER BY p.id DESC`);
    res.json({ success: true, data });
  });

  router.get('/vendor-payments', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT p.*, j.code as journal_code, i.invoice_no FROM accounting_payments p JOIN accounting_journals j ON j.id=p.journal_id LEFT JOIN accounting_invoices i ON i.id=p.invoice_id WHERE COALESCE(p.payment_category,'vendor')='vendor' ORDER BY p.id DESC`);
    res.json({ success: true, data });
  });

  router.get('/transfers', requirePermission('accounting.view'), (_req, res) => {
    const data = database.getAll(`SELECT p.*, j.code as journal_code FROM accounting_payments p JOIN accounting_journals j ON j.id=p.journal_id WHERE COALESCE(p.payment_category,'')='transfer' ORDER BY p.id DESC`);
    res.json({ success: true, data });
  });


  router.post('/payments', requirePermission('accounting.manage_payments'), (req, res) => {
    const b = req.body || {};
    if (!b.payment_direction || !b.journal_id || !b.payment_date || !b.amount) return res.status(400).json({ success: false, error: 'payment_direction, journal_id, payment_date, amount required' });
    const no = nextNumber(database, 'accounting_payments', 'payment_no', 'PAY-');
    const paymentCategory = b.payment_category || (b.payment_direction === 'outbound' ? 'vendor' : 'customer');
    database.get().exec('BEGIN');
    try {
      const amount = Number(b.amount);
      const r = database.run(`INSERT INTO accounting_payments (payment_no,payment_direction,payment_category,partner_name,journal_id,payment_date,amount,method,state,memo,invoice_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [no, b.payment_direction, paymentCategory, b.partner_name || '', b.journal_id, b.payment_date, amount, b.method || 'cash', 'posted', b.memo || '', b.invoice_id || null, req.user.id]);
      if (b.invoice_id) {
        const inv = database.getOne(`SELECT * FROM accounting_invoices WHERE id=?`, [b.invoice_id]);
        if (inv) {
          const residual = Number(inv.residual_amount || 0) > 0 ? Math.max(0, Number(inv.residual_amount || 0) - amount) : Math.min(0, Number(inv.residual_amount || 0) + amount);
          const state = Math.abs(residual) <= 0.0001 ? 'paid' : 'partial';
          database.run(`UPDATE accounting_invoices SET residual_amount=?, state=? WHERE id=?`, [residual, state, inv.id]);
        }
      }
      const liquidityCode = ['bank','click'].includes(String(b.method || '').toLowerCase()) ? '1120' : '1110';
      const liquidityAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [liquidityCode])?.id || database.getOne(`SELECT id FROM accounting_accounts WHERE code IN ('1110','1120') ORDER BY code LIMIT 1`)?.id;
      const partnerAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code=?`, [b.payment_direction === 'inbound' ? '1130' : '2110'])?.id;
      const entryNo = nextNumber(database, 'accounting_entries', 'entry_no', 'JE-');
      const er = database.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, b.journal_id, b.payment_date, no, b.memo || '', 'posted', 'accounting', 'accounting_payments', String(r.lastInsertRowid), req.user.id]);
      if (b.payment_direction === 'inbound') {
        database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, liquidityAccount, no, b.partner_name || '', amount, 0]);
        database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, no, b.partner_name || '', 0, amount]);
      } else {
        database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, partnerAccount, no, b.partner_name || '', amount, 0]);
        database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,partner_name,debit,credit) VALUES (?,?,?,?,?,?)`, [er.lastInsertRowid, liquidityAccount, no, b.partner_name || '', 0, amount]);
      }
      database.get().exec('COMMIT');
      res.json({ success: true, data: { id: r.lastInsertRowid, payment_no: no, payment_category: paymentCategory } });
    } catch (e) {
      database.get().exec('ROLLBACK');
      res.status(500).json({ success: false, error: e.message });
    }
  });


  router.get('/taxes', requirePermission('accounting.view'), (_req, res) => {
    res.json({ success: true, data: database.getAll('SELECT * FROM accounting_taxes ORDER BY id DESC') });
  });

  router.get('/payment-methods', requirePermission('accounting.view'), (_req, res) => {
    const data = database.tableExists('accounting_payment_methods') ? database.getAll(`SELECT * FROM accounting_payment_methods ORDER BY id`) : [];
    res.json({ success: true, data });
  });

  router.post('/transfers', requirePermission('accounting.manage_payments'), (req, res) => {
    const b = req.body || {};
    if (!b.from_journal_id || !b.to_journal_id || !b.payment_date || !b.amount) return res.status(400).json({ success: false, error: 'from_journal_id, to_journal_id, payment_date, amount required' });
    if (Number(b.from_journal_id) === Number(b.to_journal_id)) return res.status(400).json({ success: false, error: 'Source and destination journals must differ' });
    const amount = Number(b.amount || 0);
    const no = nextNumber(database, 'accounting_payments', 'payment_no', 'TRF-');
    database.get().exec('BEGIN');
    try {
      const r = database.run(`INSERT INTO accounting_payments (payment_no,payment_direction,payment_category,partner_name,journal_id,source_journal_id,destination_journal_id,payment_date,amount,method,state,memo,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [no, 'transfer', 'transfer', '', b.from_journal_id, b.from_journal_id, b.to_journal_id, b.payment_date, amount, b.method || 'bank', 'posted', b.memo || 'Liquidity transfer', req.user.id]);
      const fromJournal = database.getOne(`SELECT * FROM accounting_journals WHERE id=?`, [b.from_journal_id]);
      const toJournal = database.getOne(`SELECT * FROM accounting_journals WHERE id=?`, [b.to_journal_id]);
      const fromAccount = fromJournal?.default_credit_account_id || fromJournal?.default_debit_account_id || database.getOne(`SELECT id FROM accounting_accounts WHERE code='1110'`)?.id;
      const toAccount = toJournal?.default_debit_account_id || toJournal?.default_credit_account_id || database.getOne(`SELECT id FROM accounting_accounts WHERE code='1120'`)?.id;
      const generalJournal = database.getOne(`SELECT id FROM accounting_journals WHERE code='GJ'`)?.id || b.from_journal_id;
      const entryNo = nextNumber(database, 'accounting_entries', 'entry_no', 'JE-');
      const er = database.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, generalJournal, b.payment_date, no, b.memo || 'Liquidity transfer', 'posted', 'accounting', 'accounting_payments', String(r.lastInsertRowid), req.user.id]);
      database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,debit,credit) VALUES (?,?,?,?,?)`, [er.lastInsertRowid, toAccount, no, amount, 0]);
      database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,debit,credit) VALUES (?,?,?,?,?)`, [er.lastInsertRowid, fromAccount, no, 0, amount]);
      database.get().exec('COMMIT');
      res.json({ success: true, data: { id: r.lastInsertRowid, payment_no: no } });
    } catch (e) {
      database.get().exec('ROLLBACK');
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.get('/reports/trial-balance', requirePermission('accounting.view_reports'), (_req, res) => {
    const data = database.getAll(`SELECT a.code, a.name, a.name_ar, a.account_type, COALESCE(SUM(CASE WHEN e.state='posted' THEN l.debit ELSE 0 END),0) as debit, COALESCE(SUM(CASE WHEN e.state='posted' THEN l.credit ELSE 0 END),0) as credit, COALESCE(SUM(CASE WHEN e.state='posted' THEN (l.debit-l.credit) ELSE 0 END),0) as balance FROM accounting_accounts a LEFT JOIN accounting_entry_lines l ON l.account_id=a.id LEFT JOIN accounting_entries e ON e.id=l.entry_id GROUP BY a.id ORDER BY a.code`);
    res.json({ success: true, data });
  });

  router.get('/reports/profit-loss', requirePermission('accounting.view_reports'), (_req, res) => {
    const revenue = database.getOne(`SELECT COALESCE(SUM(l.credit-l.debit),0) as v FROM accounting_entry_lines l JOIN accounting_accounts a ON a.id=l.account_id JOIN accounting_entries e ON e.id=l.entry_id WHERE e.state='posted' AND a.account_type='income'`)?.v || 0;
    const expense = database.getOne(`SELECT COALESCE(SUM(l.debit-l.credit),0) as v FROM accounting_entry_lines l JOIN accounting_accounts a ON a.id=l.account_id JOIN accounting_entries e ON e.id=l.entry_id WHERE e.state='posted' AND a.account_type='expense'`)?.v || 0;
    res.json({ success: true, data: { revenue: Number(revenue), expense: Number(expense), profit: Number(revenue) - Number(expense) } });
  });

  router.get('/reports/balance-sheet', requirePermission('accounting.view_reports'), (_req, res) => {
    const asset = database.getOne(`SELECT COALESCE(SUM(l.debit-l.credit),0) as v FROM accounting_entry_lines l JOIN accounting_accounts a ON a.id=l.account_id JOIN accounting_entries e ON e.id=l.entry_id WHERE e.state='posted' AND a.account_type='asset'`)?.v || 0;
    const liability = database.getOne(`SELECT COALESCE(SUM(l.credit-l.debit),0) as v FROM accounting_entry_lines l JOIN accounting_accounts a ON a.id=l.account_id JOIN accounting_entries e ON e.id=l.entry_id WHERE e.state='posted' AND a.account_type='liability'`)?.v || 0;
    const equity = database.getOne(`SELECT COALESCE(SUM(l.credit-l.debit),0) as v FROM accounting_entry_lines l JOIN accounting_accounts a ON a.id=l.account_id JOIN accounting_entries e ON e.id=l.entry_id WHERE e.state='posted' AND a.account_type='equity'`)?.v || 0;
    res.json({ success: true, data: { assets: Number(asset), liabilities: Number(liability), equity: Number(equity) } });
  });

  router.get('/reports/general-ledger', requirePermission('accounting.view_reports'), (req, res) => {
    const accountId = req.query.account_id ? Number(req.query.account_id) : null;
    const params = [];
    let where = `WHERE e.state='posted'`;
    if (accountId) {
      where += ` AND l.account_id=?`;
      params.push(accountId);
    }
    const data = database.getAll(`SELECT l.id, e.entry_date, e.entry_no, e.reference, a.code as account_code, a.name as account_name, l.label, l.debit, l.credit FROM accounting_entry_lines l JOIN accounting_entries e ON e.id=l.entry_id JOIN accounting_accounts a ON a.id=l.account_id ${where} ORDER BY e.entry_date DESC, l.id DESC`, params);
    res.json({ success: true, data });
  });

  router.get('/reports/aged-receivables', requirePermission('accounting.view_reports'), (_req, res) => {
    const data = database.getAll(`SELECT invoice_no, partner_name, due_date, residual_amount, CASE WHEN due_date IS NULL THEN 'undated' WHEN due_date >= date('now') THEN 'current' WHEN julianday('now') - julianday(due_date) <= 30 THEN '1-30' WHEN julianday('now') - julianday(due_date) <= 60 THEN '31-60' WHEN julianday('now') - julianday(due_date) <= 90 THEN '61-90' ELSE '90+' END AS aging_bucket FROM accounting_invoices WHERE invoice_type='customer' AND state IN ('posted','partial') ORDER BY due_date IS NULL, due_date ASC`);
    res.json({ success: true, data });
  });

  router.get('/reports/aged-payables', requirePermission('accounting.view_reports'), (_req, res) => {
    const data = database.getAll(`SELECT invoice_no, partner_name, due_date, residual_amount, CASE WHEN due_date IS NULL THEN 'undated' WHEN due_date >= date('now') THEN 'current' WHEN julianday('now') - julianday(due_date) <= 30 THEN '1-30' WHEN julianday('now') - julianday(due_date) <= 60 THEN '31-60' WHEN julianday('now') - julianday(due_date) <= 90 THEN '61-90' ELSE '90+' END AS aging_bucket FROM accounting_invoices WHERE invoice_type='vendor' AND state IN ('posted','partial') ORDER BY due_date IS NULL, due_date ASC`);
    res.json({ success: true, data });
  });

  router.get('/reports/revenue-business-line', requirePermission('accounting.view_reports'), (_req, res) => {
    const data = database.getAll(`SELECT COALESCE(business_line,'other') as business_line, ROUND(SUM(CASE WHEN total_amount < 0 THEN 0 ELSE total_amount - residual_amount END), 3) as revenue FROM accounting_invoices WHERE invoice_type='customer' AND COALESCE(document_kind,'invoice')='invoice' AND state IN ('posted','partial','paid') GROUP BY COALESCE(business_line,'other') ORDER BY revenue DESC`);
    res.json({ success: true, data });
  });

  router.get('/reports/customer-ledger', requirePermission('accounting.view_reports'), (_req, res) => {
    const data = database.getAll(`SELECT l.partner_name, e.entry_no as document_no, e.entry_date, l.debit, l.credit FROM accounting_entry_lines l JOIN accounting_entries e ON e.id=l.entry_id JOIN accounting_accounts a ON a.id=l.account_id WHERE e.state='posted' AND a.code='1130' ORDER BY e.entry_date DESC, l.id DESC`);
    res.json({ success: true, data });
  });

  router.get('/reports/vendor-ledger', requirePermission('accounting.view_reports'), (_req, res) => {
    const data = database.getAll(`SELECT l.partner_name, e.entry_no as document_no, e.entry_date, l.debit, l.credit FROM accounting_entry_lines l JOIN accounting_entries e ON e.id=l.entry_id JOIN accounting_accounts a ON a.id=l.account_id WHERE e.state='posted' AND a.code='2110' ORDER BY e.entry_date DESC, l.id DESC`);
    res.json({ success: true, data });
  });

  eventBus.on('cafeteria.order_completed', (payload = {}) => {
    if (!settingsService.get('accounting.include_cafeteria', false)) return;
    if (!payload.total_amount || payload.accounting_posted) return;
    const salesJournal = database.getOne(`SELECT id FROM accounting_journals WHERE code='CJ'`)?.id || database.getOne(`SELECT id FROM accounting_journals WHERE code='SAJ'`)?.id;
    const cashAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code='1110'`)?.id;
    const revenueAccount = database.getOne(`SELECT id FROM accounting_accounts WHERE code='4130'`)?.id || database.getOne(`SELECT id FROM accounting_accounts WHERE code='4110'`)?.id;
    if (!salesJournal || !cashAccount || !revenueAccount) return;
    const entryNo = nextNumber(database, 'accounting_entries', 'entry_no', 'JE-');
    const total = Number(payload.total_amount || 0);
    const date = payload.order_date || new Date().toISOString().slice(0, 10);
    const ref = payload.order_no || `CAF-${Date.now()}`;
    database.get().exec('BEGIN');
    try {
      const er = database.run(`INSERT INTO accounting_entries (entry_no,journal_id,entry_date,reference,memo,state,source_module,source_model,source_id,created_by,posted_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`, [entryNo, salesJournal, date, ref, 'Cafeteria sale', 'posted', 'cafeteria', 'order', String(payload.id || ''), payload.user_id || null]);
      database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,debit,credit) VALUES (?,?,?,?,?)`, [er.lastInsertRowid, cashAccount, ref, total, 0]);
      database.run(`INSERT INTO accounting_entry_lines (entry_id,account_id,label,debit,credit) VALUES (?,?,?,?,?)`, [er.lastInsertRowid, revenueAccount, ref, 0, total]);
      database.get().exec('COMMIT');
    } catch (_) {
      database.get().exec('ROLLBACK');
    }
  });

  app.use('/api/accounting', router);
};

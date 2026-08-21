const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const { validateBody, schemas } = require('../../core/middleware/validation');
const sequenceService = require('../../core/services/sequence-service');

module.exports = function (app, { database, eventBus, container }) {
  const router = express.Router();
  const db = database;
  const settings = container.resolve('settings');

  const q = (sql, params=[]) => db.getAll(sql, params);
  const one = (sql, params=[]) => db.getOne(sql, params);
  const run = (sql, params=[]) => db.run(sql, params);

  function nextCode(prefixKey, table, field, fallback) {
    const prefix = settings.get(prefixKey, fallback || 'HR-');
    const seqName = `${table}_${field}`;
    sequenceService.initFromTable(seqName, table, field, prefix);
    return sequenceService.next(seqName, prefix, 4);
  }

  function rowCount(sql, params=[]) { return one(sql, params)?.c || 0; }

  function calcWorkedHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const diff = (new Date(checkOut) - new Date(checkIn)) / 3600000;
    return Number.isFinite(diff) && diff > 0 ? Number(diff.toFixed(2)) : 0;
  }

  function ensureDefaults() {
    const defaults = [
      ['hr.employee_prefix', 'EMP-', { type: 'string', module: 'hr', label: 'Employee Prefix' }],
      ['hr.default_probation_days', '90', { type: 'string', module: 'hr', label: 'Probation Days' }],
      ['hr.leave_requires_approval', true, { type: 'boolean', module: 'hr', label: 'Leave Approval Required' }],
      ['hr.attendance_mode', 'manual', { type: 'string', module: 'hr', label: 'Attendance Mode' }],
      ['hr.payroll_cycle', 'monthly', { type: 'string', module: 'hr', label: 'Payroll Cycle' }],
      ['hr.default_work_days', '6', { type: 'string', module: 'hr', label: 'Default Work Days' }],
      ['hr.auto_create_contract', true, { type: 'boolean', module: 'hr', label: 'Auto Contract' }],
      ['hr.onboarding_checklist', 'ID copy, signed offer, bank details, medical fitness', { type: 'string', module: 'hr', label: 'Onboarding Checklist' }],
    ];
    defaults.forEach(([key, value, meta]) => { if (settings.get(key) === null) settings.set(key, value, meta); });

    if (!rowCount('SELECT COUNT(*) as c FROM hr_leave_types')) {
      db.get().exec(`
        INSERT INTO hr_leave_types (name, name_ar, code, default_days, is_paid) VALUES
        ('Annual Leave', 'إجازة سنوية', 'ANNUAL', 21, 1),
        ('Sick Leave', 'إجازة مرضية', 'SICK', 14, 1),
        ('Emergency Leave', 'إجازة طارئة', 'EMERGENCY', 7, 0),
        ('Maternity Leave', 'إجازة أمومة', 'MATERNITY', 70, 1);
      `);
    }
  }
  ensureDefaults();

  // Ensure deduction_details column exists on hr_payslips
  try { db.get().exec(`ALTER TABLE hr_payslips ADD COLUMN deduction_details TEXT DEFAULT ''`); } catch (_) { /* already exists */ }
  // Ensure fingerprint columns exist on hr_employees
  try { db.get().exec(`ALTER TABLE hr_employees ADD COLUMN fingerprint_enrolled INTEGER DEFAULT 0`); } catch (_) {}
  try { db.get().exec(`ALTER TABLE hr_employees ADD COLUMN fingerprint_date TEXT DEFAULT ''`); } catch (_) {}
  try { db.get().exec(`ALTER TABLE hr_employees ADD COLUMN fingerprint_template TEXT DEFAULT ''`); } catch (_) {}

  function dashboardStats() {
    const totalEmployees = rowCount(`SELECT COUNT(*) as c FROM hr_employees WHERE is_active = 1`);
    const activeEmployees = rowCount(`SELECT COUNT(*) as c FROM hr_employees WHERE employee_status IN ('active','probation') AND is_active = 1`);
    const departments = rowCount(`SELECT COUNT(*) as c FROM hr_departments WHERE is_active = 1`);
    const presentToday = rowCount(`SELECT COUNT(*) as c FROM hr_attendance_logs WHERE attendance_date = date('now') AND status IN ('present','late')`);
    const pendingLeaves = rowCount(`SELECT COUNT(*) as c FROM hr_leave_requests WHERE status = 'pending'`);
    const openApplicants = rowCount(`SELECT COUNT(*) as c FROM hr_applicants WHERE stage NOT IN ('hired','rejected')`);
    const payrollMonth = one(`SELECT COALESCE(SUM(net_amount),0) as total FROM hr_payslips WHERE period_year = CAST(strftime('%Y','now') AS INTEGER) AND period_month = CAST(strftime('%m','now') AS INTEGER)`)?.total || 0;
    const byDepartment = q(`SELECT d.name, COUNT(e.id) as count FROM hr_departments d LEFT JOIN hr_employees e ON e.department_id = d.id AND e.is_active = 1 GROUP BY d.id ORDER BY count DESC, d.name ASC LIMIT 8`);
    const upcomingContracts = q(`SELECT c.id, c.contract_ref, c.end_date, e.full_name FROM hr_contracts c JOIN hr_employees e ON e.id = c.employee_id WHERE c.status='active' AND c.end_date IS NOT NULL AND c.end_date BETWEEN date('now') AND date('now','+30 days') ORDER BY c.end_date ASC LIMIT 10`);
    return { totalEmployees, activeEmployees, departments, presentToday, pendingLeaves, openApplicants, payrollMonth, byDepartment, upcomingContracts };
  }

  router.get('/', authMiddleware, (req, res) => {
    res.json({ success: true, data: dashboardStats() });
  });

  const { cacheResponse: _cacheResp } = require('../../core/middleware/response-cache');

  router.get('/dashboard', authMiddleware, requirePermission('hr.dashboard'), _cacheResp(15000), (req, res) => {
    res.json({ success: true, data: dashboardStats() });
  });

  router.get('/bootstrap', authMiddleware, requirePermission('hr.employee.view'), (req, res) => {
    const data = {
      branches: q(`SELECT id, name FROM branches WHERE is_active = 1 ORDER BY name`),
      departments: q(`SELECT id, name FROM hr_departments WHERE is_active = 1 ORDER BY name`),
      positions: q(`SELECT id, name, department_id FROM hr_positions WHERE is_active = 1 ORDER BY name`),
      leaveTypes: q(`SELECT id, name, default_days FROM hr_leave_types WHERE is_active = 1 ORDER BY name`),
      employees: q(`SELECT id, full_name FROM hr_employees WHERE is_active = 1 ORDER BY full_name`)
    };
    res.json({ success: true, data });
  });

  router.get('/employees', authMiddleware, requirePermission('hr.employee.view'), (req, res) => {
    const { search = '', branch_id = '', department_id = '', status = '' } = req.query;
    const where = ['1=1']; const params = [];
    if (search) { where.push('(e.full_name LIKE ? OR e.employee_no LIKE ? OR e.work_email LIKE ? OR e.mobile LIKE ?)'); const s = `%${search}%`; params.push(s,s,s,s); }
    if (branch_id) { where.push('e.branch_id = ?'); params.push(Number(branch_id)); }
    if (department_id) { where.push('e.department_id = ?'); params.push(Number(department_id)); }
    if (status) { where.push('e.employee_status = ?'); params.push(status); }
    const rows = q(`SELECT e.*, b.name as branch_name, d.name as department_name, p.name as position_name,
      m.full_name as manager_name FROM hr_employees e
      LEFT JOIN branches b ON b.id = e.branch_id
      LEFT JOIN hr_departments d ON d.id = e.department_id
      LEFT JOIN hr_positions p ON p.id = e.position_id
      LEFT JOIN hr_employees m ON m.id = e.manager_employee_id
      WHERE ${where.join(' AND ')} ORDER BY e.id DESC`, params);
    res.json({ success: true, data: rows });
  });

  router.post('/employees', authMiddleware, requirePermission('hr.employee.create'), validateBody(schemas.hrEmployee), (req, res) => {
    const body = req.validatedBody;
    const employee_no = nextCode('hr.employee_prefix', 'hr_employees', 'employee_no', 'EMP-');
    const full_name = `${body.first_name} ${body.last_name}`.trim();
    const badge_id = body.badge_id || ('STAFF-' + require('crypto').randomBytes(6).toString('hex').toUpperCase());
    const result = run(`INSERT INTO hr_employees (
      employee_no, first_name, last_name, full_name, first_name_ar, last_name_ar, work_email, private_email, mobile, phone, gender, marital_status,
      date_of_birth, nationality, national_id, hire_date, confirmation_date, employee_status, employment_type, branch_id, department_id, position_id,
      manager_employee_id, badge_id, shift_code, blood_type, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
      address, city, country, base_salary, housing_allowance, transport_allowance, other_allowance, overtime_rate, leave_balance, notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      employee_no, body.first_name, body.last_name, full_name, body.first_name_ar || '', body.last_name_ar || '', body.work_email || '', body.private_email || '', body.mobile || '', body.phone || '', body.gender || 'male', body.marital_status || 'single',
      body.date_of_birth || null, body.nationality || '', body.national_id || '', body.hire_date || null, body.confirmation_date || null, body.employee_status || 'draft', body.employment_type || 'full_time', body.branch_id || null, body.department_id || null, body.position_id || null,
      body.manager_employee_id || null, badge_id, body.shift_code || '', body.blood_type || '', body.emergency_contact_name || '', body.emergency_contact_phone || '', body.emergency_contact_relation || '',
      body.address || '', body.city || '', body.country || '', Number(body.base_salary || 0), Number(body.housing_allowance || 0), Number(body.transport_allowance || 0), Number(body.other_allowance || 0), Number(body.overtime_rate || 0), Number(body.leave_balance || 0), body.notes || ''
    ]);
    if (settings.get('hr.auto_create_contract', true) && body.hire_date) {
      const contract_ref = nextCode('hr.employee_prefix', 'hr_contracts', 'contract_ref', 'CTR-');
      run(`INSERT INTO hr_contracts (employee_id, contract_ref, contract_type, start_date, probation_days, wage, allowance_total, payroll_cycle, status)
           VALUES (?,?,?,?,?,?,?,?,?)`, [result.lastInsertRowid, contract_ref, 'permanent', body.hire_date, Number(settings.get('hr.default_probation_days', '90')), Number(body.base_salary || 0), Number(body.housing_allowance || 0) + Number(body.transport_allowance || 0) + Number(body.other_allowance || 0), settings.get('hr.payroll_cycle', 'monthly'), 'draft']);
    }
    eventBus.emit('hr.employee.created', { employeeId: result.lastInsertRowid });
    res.json({ success: true, data: { id: result.lastInsertRowid, employee_no } });
  });

  router.put('/employees/:id', authMiddleware, requirePermission('hr.employee.edit'), validateBody(schemas.hrEmployee), (req, res) => {
    const body = req.validatedBody;
    const full_name = `${body.first_name || ''} ${body.last_name || ''}`.trim();
    run(`UPDATE hr_employees SET first_name=?, last_name=?, full_name=?, first_name_ar=?, last_name_ar=?, work_email=?, private_email=?, mobile=?, phone=?, gender=?, marital_status=?, date_of_birth=?, nationality=?, national_id=?, hire_date=?, confirmation_date=?, employee_status=?, employment_type=?, branch_id=?, department_id=?, position_id=?, manager_employee_id=?, badge_id=?, shift_code=?, blood_type=?, emergency_contact_name=?, emergency_contact_phone=?, emergency_contact_relation=?, address=?, city=?, country=?, base_salary=?, housing_allowance=?, transport_allowance=?, other_allowance=?, overtime_rate=?, leave_balance=?, notes=?, is_active=?, updated_at=datetime('now') WHERE id=?`, [
      body.first_name || '', body.last_name || '', full_name, body.first_name_ar || '', body.last_name_ar || '', body.work_email || '', body.private_email || '', body.mobile || '', body.phone || '', body.gender || 'male', body.marital_status || 'single', body.date_of_birth || null, body.nationality || '', body.national_id || '', body.hire_date || null, body.confirmation_date || null, body.employee_status || 'draft', body.employment_type || 'full_time', body.branch_id || null, body.department_id || null, body.position_id || null, body.manager_employee_id || null, body.badge_id || '', body.shift_code || '', body.blood_type || '', body.emergency_contact_name || '', body.emergency_contact_phone || '', body.emergency_contact_relation || '', body.address || '', body.city || '', body.country || '', Number(body.base_salary || 0), Number(body.housing_allowance || 0), Number(body.transport_allowance || 0), Number(body.other_allowance || 0), Number(body.overtime_rate || 0), Number(body.leave_balance || 0), body.notes || '', body.is_active === false ? 0 : 1, req.params.id
    ]);
    eventBus.emit('hr.employee.updated', { employeeId: Number(req.params.id) });
    res.json({ success: true });
  });

  router.delete('/employees/:id', authMiddleware, requirePermission('hr.employee.delete'), (req, res) => {
    run(`DELETE FROM hr_employees WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  });

  router.get('/departments', authMiddleware, requirePermission('hr.employee.view'), (req, res) => {
    const rows = q(`SELECT d.*, b.name as branch_name, m.full_name as manager_name,
      (SELECT COUNT(*) FROM hr_employees e WHERE e.department_id = d.id AND e.is_active = 1) as employees_count
      FROM hr_departments d
      LEFT JOIN branches b ON b.id = d.branch_id
      LEFT JOIN hr_employees m ON m.id = d.manager_employee_id
      ORDER BY d.name ASC`);
    res.json({ success: true, data: rows });
  });

  router.post('/departments', authMiddleware, requirePermission('hr.department.manage'), (req, res) => {
    const b = req.body || {};
    const r = run(`INSERT INTO hr_departments (name, name_ar, code, manager_employee_id, parent_department_id, branch_id, color, notes, is_active) VALUES (?,?,?,?,?,?,?,?,?)`, [b.name, b.name_ar || '', b.code || null, b.manager_employee_id || null, b.parent_department_id || null, b.branch_id || null, b.color || '', b.notes || '', b.is_active === false ? 0 : 1]);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });

  router.put('/departments/:id', authMiddleware, requirePermission('hr.department.manage'), (req, res) => {
    const b = req.body || {};
    run(`UPDATE hr_departments SET name=?, name_ar=?, code=?, manager_employee_id=?, parent_department_id=?, branch_id=?, color=?, notes=?, is_active=?, updated_at=datetime('now') WHERE id=?`, [b.name, b.name_ar || '', b.code || null, b.manager_employee_id || null, b.parent_department_id || null, b.branch_id || null, b.color || '', b.notes || '', b.is_active === false ? 0 : 1, req.params.id]);
    res.json({ success: true });
  });

  router.get('/positions', authMiddleware, requirePermission('hr.employee.view'), (req, res) => {
    res.json({ success: true, data: q(`SELECT p.*, d.name as department_name FROM hr_positions p LEFT JOIN hr_departments d ON d.id = p.department_id ORDER BY p.name`) });
  });
  router.post('/positions', authMiddleware, requirePermission('hr.department.manage'), (req, res) => {
    const b = req.body || {};
    const r = run(`INSERT INTO hr_positions (name, name_ar, department_id, grade, employment_type, notes, is_active) VALUES (?,?,?,?,?,?,?)`, [b.name, b.name_ar || '', b.department_id || null, b.grade || '', b.employment_type || 'full_time', b.notes || '', b.is_active === false ? 0 : 1]);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });
  router.put('/positions/:id', authMiddleware, requirePermission('hr.department.manage'), (req, res) => {
    const b = req.body || {};
    run(`UPDATE hr_positions SET name=?, name_ar=?, department_id=?, grade=?, employment_type=?, notes=?, is_active=?, updated_at=datetime('now') WHERE id=?`, [b.name, b.name_ar || '', b.department_id || null, b.grade || '', b.employment_type || 'full_time', b.notes || '', b.is_active === false ? 0 : 1, req.params.id]);
    res.json({ success: true });
  });

  router.get('/attendance', authMiddleware, requirePermission('hr.attendance.manage'), (req, res) => {
    const { date = '', employee_id = '', status = '' } = req.query;
    const where = ['1=1']; const params = [];
    if (date) { where.push('a.attendance_date = ?'); params.push(date); }
    if (employee_id) { where.push('a.employee_id = ?'); params.push(Number(employee_id)); }
    if (status) { where.push('a.status = ?'); params.push(status); }
    res.json({ success: true, data: q(`SELECT a.*, e.full_name, e.employee_no FROM hr_attendance_logs a JOIN hr_employees e ON e.id = a.employee_id WHERE ${where.join(' AND ')} ORDER BY a.attendance_date DESC, a.id DESC`, params) });
  });
  router.post('/attendance', authMiddleware, requirePermission('hr.attendance.manage'), (req, res) => {
    const b = req.body || {};
    const worked = b.worked_hours !== undefined && b.worked_hours !== '' ? Number(b.worked_hours) : calcWorkedHours(b.check_in, b.check_out);
    const r = run(`INSERT INTO hr_attendance_logs (employee_id, attendance_date, check_in, check_out, worked_hours, overtime_hours, status, source, note, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`, [b.employee_id, b.attendance_date, b.check_in || null, b.check_out || null, worked, Number(b.overtime_hours || 0), b.status || 'present', b.source || settings.get('hr.attendance_mode', 'manual'), b.note || '', req.user.id]);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });
  router.put('/attendance/:id', authMiddleware, requirePermission('hr.attendance.manage'), (req, res) => {
    const b = req.body || {};
    const worked = b.worked_hours !== undefined && b.worked_hours !== '' ? Number(b.worked_hours) : calcWorkedHours(b.check_in, b.check_out);
    run(`UPDATE hr_attendance_logs SET employee_id=?, attendance_date=?, check_in=?, check_out=?, worked_hours=?, overtime_hours=?, status=?, source=?, note=?, updated_at=datetime('now') WHERE id=?`, [b.employee_id, b.attendance_date, b.check_in || null, b.check_out || null, worked, Number(b.overtime_hours || 0), b.status || 'present', b.source || 'manual', b.note || '', req.params.id]);
    res.json({ success: true });
  });

  router.get('/leave-types', authMiddleware, requirePermission('hr.employee.view'), (req, res) => {
    res.json({ success: true, data: q(`SELECT * FROM hr_leave_types ORDER BY name`) });
  });
  router.post('/leave-types', authMiddleware, requirePermission('hr.leave.manage'), (req, res) => {
    const b = req.body || {};
    const r = run(`INSERT INTO hr_leave_types (name, name_ar, code, default_days, requires_attachment, is_paid, gender_rule, color, is_active) VALUES (?,?,?,?,?,?,?,?,?)`, [b.name, b.name_ar || '', b.code || null, Number(b.default_days || 0), b.requires_attachment ? 1 : 0, b.is_paid === false ? 0 : 1, b.gender_rule || 'all', b.color || '', b.is_active === false ? 0 : 1]);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });

  router.get('/leaves', authMiddleware, requirePermission('hr.leave.manage'), (req, res) => {
    const rows = q(`SELECT l.*, e.full_name, e.employee_no, t.name as leave_type_name FROM hr_leave_requests l JOIN hr_employees e ON e.id = l.employee_id JOIN hr_leave_types t ON t.id = l.leave_type_id ORDER BY l.id DESC`);
    res.json({ success: true, data: rows });
  });
  router.post('/leaves', authMiddleware, requirePermission('hr.leave.manage'), (req, res) => {
    const b = req.body || {};
    const request_no = nextCode('hr.employee_prefix', 'hr_leave_requests', 'request_no', 'LEV-');
    const status = settings.get('hr.leave_requires_approval', true) ? 'pending' : 'approved';
    const r = run(`INSERT INTO hr_leave_requests (employee_id, leave_type_id, request_no, date_from, date_to, days, reason, attachment_name, status, approved_by, approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [b.employee_id, b.leave_type_id, request_no, b.date_from, b.date_to, Number(b.days || 1), b.reason || '', b.attachment_name || '', status, status === 'approved' ? req.user.id : null, status === 'approved' ? new Date().toISOString() : null]);
    if (status === 'approved') run(`UPDATE hr_employees SET leave_balance = COALESCE(leave_balance,0) - ? WHERE id = ?`, [Number(b.days || 1), b.employee_id]);
    res.json({ success: true, data: { id: r.lastInsertRowid, request_no, status } });
  });
  router.post('/leaves/:id/approve', authMiddleware, requirePermission('hr.leave.manage'), (req, res) => {
    const leave = one(`SELECT * FROM hr_leave_requests WHERE id = ?`, [req.params.id]);
    if (!leave) return res.status(404).json({ success: false, error: 'Leave request not found' });
    run(`UPDATE hr_leave_requests SET status='approved', approved_by=?, approved_at=?, updated_at=datetime('now') WHERE id=?`, [req.user.id, new Date().toISOString(), req.params.id]);
    run(`UPDATE hr_employees SET leave_balance = COALESCE(leave_balance,0) - ? WHERE id = ?`, [Number(leave.days || 0), leave.employee_id]);
    res.json({ success: true });
  });
  router.post('/leaves/:id/reject', authMiddleware, requirePermission('hr.leave.manage'), (req, res) => {
    const reason = req.body?.reason || '';
    run(`UPDATE hr_leave_requests SET status='rejected', reject_reason=?, updated_at=datetime('now') WHERE id=?`, [reason, req.params.id]);
    res.json({ success: true });
  });

  // ─── Fingerprint Enrollment ───
  router.post('/employees/:id/fingerprint/enroll', authMiddleware, requirePermission('hr.employee.edit'), (req, res) => {
    const emp = one(`SELECT id, full_name FROM hr_employees WHERE id = ?`, [req.params.id]);
    if (!emp) return res.status(404).json({ success: false, error: 'Employee not found' });
    const template = 'FP-' + require('crypto').randomBytes(16).toString('hex').toUpperCase();
    const now = new Date().toISOString().split('T')[0];
    run(`UPDATE hr_employees SET fingerprint_enrolled = 1, fingerprint_date = ?, fingerprint_template = ?, updated_at = datetime('now') WHERE id = ?`, [now, template, req.params.id]);
    res.json({ success: true, data: { fingerprint_enrolled: true, fingerprint_date: now, template_id: template } });
  });

  router.delete('/employees/:id/fingerprint', authMiddleware, requirePermission('hr.employee.edit'), (req, res) => {
    run(`UPDATE hr_employees SET fingerprint_enrolled = 0, fingerprint_date = '', fingerprint_template = '', updated_at = datetime('now') WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  });

  router.get('/employees/:id/fingerprint', authMiddleware, requirePermission('hr.employee.view'), (req, res) => {
    const emp = one(`SELECT id, fingerprint_enrolled, fingerprint_date, badge_id FROM hr_employees WHERE id = ?`, [req.params.id]);
    if (!emp) return res.status(404).json({ success: false, error: 'Employee not found' });
    res.json({ success: true, data: { enrolled: !!emp.fingerprint_enrolled, date: emp.fingerprint_date, badge_id: emp.badge_id } });
  });

  // ─── Employee Clock-In/Out (like member attendance) ───
  router.get('/clock/search', authMiddleware, (req, res) => {
    const { q: query } = req.query;
    if (!query) return res.json({ success: true, data: [] });
    const s = `%${query}%`;
    const rows = q(`SELECT e.id, e.employee_no, e.full_name, e.first_name, e.last_name, e.mobile, e.badge_id, e.employee_status, e.department_name, e.position_name, d.name as dept, p.name as pos
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      LEFT JOIN hr_positions p ON p.id = e.position_id
      WHERE e.is_active = 1 AND (e.full_name LIKE ? OR e.employee_no LIKE ? OR e.mobile LIKE ? OR e.badge_id LIKE ?)
      LIMIT 10`, [s, s, s, s]);
    res.json({ success: true, data: rows });
  });

  router.get('/clock/badge/:code', authMiddleware, (req, res) => {
    const emp = one(`SELECT e.*, d.name as department_name, p.name as position_name FROM hr_employees e LEFT JOIN hr_departments d ON d.id=e.department_id LEFT JOIN hr_positions p ON p.id=e.position_id WHERE e.badge_id = ? AND e.is_active = 1`, [req.params.code]);
    if (!emp) return res.status(404).json({ success: false, error: 'Badge not found' });
    const todayLog = one(`SELECT * FROM hr_attendance_logs WHERE employee_id = ? AND attendance_date = date('now') ORDER BY id DESC LIMIT 1`, [emp.id]);
    emp.today_log = todayLog || null;
    emp.is_clocked_in = !!(todayLog && todayLog.check_in && !todayLog.check_out);
    res.json({ success: true, data: emp });
  });

  router.get('/clock/status/:id', authMiddleware, (req, res) => {
    const emp = one(`SELECT e.*, d.name as department_name, p.name as position_name FROM hr_employees e LEFT JOIN hr_departments d ON d.id=e.department_id LEFT JOIN hr_positions p ON p.id=e.position_id WHERE e.id = ? AND e.is_active = 1`, [req.params.id]);
    if (!emp) return res.status(404).json({ success: false, error: 'Employee not found' });
    const todayLog = one(`SELECT * FROM hr_attendance_logs WHERE employee_id = ? AND attendance_date = date('now') ORDER BY id DESC LIMIT 1`, [emp.id]);
    emp.today_log = todayLog || null;
    emp.is_clocked_in = !!(todayLog && todayLog.check_in && !todayLog.check_out);
    res.json({ success: true, data: emp });
  });

  router.post('/clock/in', authMiddleware, (req, res) => {
    const { employee_id, source } = req.body;
    if (!employee_id) return res.status(400).json({ success: false, error: 'Employee ID required' });
    const emp = one(`SELECT * FROM hr_employees WHERE id = ? AND is_active = 1`, [employee_id]);
    if (!emp) return res.status(404).json({ success: false, error: 'Employee not found' });
    if (!['active', 'probation'].includes(emp.employee_status)) return res.status(400).json({ success: false, error: 'Employee is ' + emp.employee_status });
    const existing = one(`SELECT id FROM hr_attendance_logs WHERE employee_id = ? AND attendance_date = date('now') AND check_out IS NULL`, [employee_id]);
    if (existing) return res.status(400).json({ success: false, error: 'Already clocked in today' });
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const r = run(`INSERT INTO hr_attendance_logs (employee_id, attendance_date, check_in, status, source, created_by) VALUES (?, date('now'), ?, 'present', ?, ?)`,
      [employee_id, now, source || 'manual', req.user.id]);
    res.json({ success: true, data: { id: r.lastInsertRowid, check_in: now } });
  });

  router.post('/clock/out', authMiddleware, (req, res) => {
    const { employee_id } = req.body;
    if (!employee_id) return res.status(400).json({ success: false, error: 'Employee ID required' });
    const log = one(`SELECT * FROM hr_attendance_logs WHERE employee_id = ? AND attendance_date = date('now') AND check_out IS NULL ORDER BY id DESC LIMIT 1`, [employee_id]);
    if (!log) return res.status(404).json({ success: false, error: 'No active clock-in found' });
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const worked = calcWorkedHours(log.check_in, now);
    run(`UPDATE hr_attendance_logs SET check_out = ?, worked_hours = ?, updated_at = datetime('now') WHERE id = ?`, [now, worked, log.id]);
    res.json({ success: true, data: { id: log.id, worked_hours: worked } });
  });

  router.get('/clock/today', authMiddleware, (req, res) => {
    const rows = q(`SELECT a.*, e.full_name, e.employee_no, e.badge_id FROM hr_attendance_logs a JOIN hr_employees e ON e.id = a.employee_id WHERE a.attendance_date = date('now') ORDER BY a.check_in DESC`);
    res.json({ success: true, data: rows });
  });

  router.get('/clock/stats', authMiddleware, (req, res) => {
    const today = rowCount(`SELECT COUNT(*) as c FROM hr_attendance_logs WHERE attendance_date = date('now')`);
    const clockedIn = rowCount(`SELECT COUNT(*) as c FROM hr_attendance_logs WHERE attendance_date = date('now') AND check_in IS NOT NULL AND check_out IS NULL`);
    const late = rowCount(`SELECT COUNT(*) as c FROM hr_attendance_logs WHERE attendance_date = date('now') AND status = 'late'`);
    const absent = rowCount(`SELECT COUNT(*) as c FROM hr_attendance_logs WHERE attendance_date = date('now') AND status = 'absent'`);
    res.json({ success: true, data: { today, clockedIn, late, absent } });
  });

  // ─── Employee Attendance Summary (for profile/fingerprint tab) ───
  router.get('/employees/:id/attendance-summary', authMiddleware, requirePermission('hr.attendance.manage'), (req, res) => {
    const empId = req.params.id;
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || (new Date().getMonth() + 1));
    const monthStr = String(month).padStart(2, '0');
    const logs = q(`SELECT * FROM hr_attendance_logs WHERE employee_id = ? AND strftime('%Y', attendance_date) = ? AND strftime('%m', attendance_date) = ? ORDER BY attendance_date ASC, check_in ASC`, [empId, String(year), monthStr]);
    const presentDays = logs.filter(l => l.status === 'present').length;
    const lateDays = logs.filter(l => l.status === 'late').length;
    const absentDays = logs.filter(l => l.status === 'absent').length;
    const totalWorkedHours = logs.reduce((a, l) => a + Number(l.worked_hours || 0), 0);
    const totalOvertimeHours = logs.reduce((a, l) => a + Number(l.overtime_hours || 0), 0);
    const emp = one(`SELECT base_salary, hire_date FROM hr_employees WHERE id = ?`, [empId]);
    const workDaysPerMonth = Number(settings.get('hr.default_work_days', '26'));
    const dailyRate = emp?.base_salary ? Number(emp.base_salary) / workDaysPerMonth : 0;
    const latePenalty = lateDays * (dailyRate * 0.25);
    const absentPenalty = absentDays * dailyRate;
    res.json({ success: true, data: { year, month, logs, presentDays, lateDays, absentDays, totalWorkedHours, totalOvertimeHours, workDaysPerMonth, dailyRate, latePenalty, absentPenalty, totalDeductions: latePenalty + absentPenalty } });
  });

  router.get('/contracts', authMiddleware, requirePermission('hr.contract.manage'), (req, res) => {
    res.json({ success: true, data: q(`SELECT c.*, e.full_name, e.employee_no FROM hr_contracts c JOIN hr_employees e ON e.id = c.employee_id ORDER BY c.id DESC`) });
  });
  router.post('/contracts', authMiddleware, requirePermission('hr.contract.manage'), (req, res) => {
    const b = req.body || {};
    const contract_ref = nextCode('hr.employee_prefix', 'hr_contracts', 'contract_ref', 'CTR-');
    const r = run(`INSERT INTO hr_contracts (employee_id, contract_ref, contract_type, start_date, end_date, probation_days, wage, allowance_total, schedule, payroll_cycle, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [b.employee_id, contract_ref, b.contract_type || 'permanent', b.start_date, b.end_date || null, Number(b.probation_days || settings.get('hr.default_probation_days','90')), Number(b.wage || 0), Number(b.allowance_total || 0), b.schedule || 'standard', b.payroll_cycle || settings.get('hr.payroll_cycle','monthly'), b.status || 'draft', b.notes || '']);
    res.json({ success: true, data: { id: r.lastInsertRowid, contract_ref } });
  });
  router.put('/contracts/:id', authMiddleware, requirePermission('hr.contract.manage'), (req, res) => {
    const b = req.body || {};
    run(`UPDATE hr_contracts SET employee_id=?, contract_type=?, start_date=?, end_date=?, probation_days=?, wage=?, allowance_total=?, schedule=?, payroll_cycle=?, status=?, notes=?, updated_at=datetime('now') WHERE id=?`, [b.employee_id, b.contract_type || 'permanent', b.start_date, b.end_date || null, Number(b.probation_days || 0), Number(b.wage || 0), Number(b.allowance_total || 0), b.schedule || 'standard', b.payroll_cycle || 'monthly', b.status || 'draft', b.notes || '', req.params.id]);
    res.json({ success: true });
  });

  router.get('/payroll', authMiddleware, requirePermission('hr.payroll.view'), (req, res) => {
    const year = Number(req.query.year || new Date().getFullYear());
    const month = Number(req.query.month || (new Date().getMonth() + 1));
    const rows = q(`SELECT p.*, e.full_name, e.employee_no FROM hr_payslips p JOIN hr_employees e ON e.id = p.employee_id WHERE p.period_year = ? AND p.period_month = ? ORDER BY e.full_name`, [year, month]);
    const summary = {
      year, month,
      employees: rows.length,
      basic: rows.reduce((a, r) => a + Number(r.basic || 0), 0),
      allowances: rows.reduce((a, r) => a + Number(r.allowances || 0), 0),
      deductions: rows.reduce((a, r) => a + Number(r.deductions || 0), 0),
      overtime: rows.reduce((a, r) => a + Number(r.overtime_amount || 0), 0),
      net: rows.reduce((a, r) => a + Number(r.net_amount || 0), 0)
    };
    res.json({ success: true, data: { summary, rows } });
  });
  router.post('/payroll/generate', authMiddleware, requirePermission('hr.payroll.view'), (req, res) => {
    const year = Number(req.body?.year || new Date().getFullYear());
    const month = Number(req.body?.month || (new Date().getMonth() + 1));
    const employees = q(`SELECT * FROM hr_employees WHERE is_active = 1 AND employee_status IN ('active','probation')`);
    let generated = 0;
    employees.forEach((emp) => {
      const exists = one(`SELECT id FROM hr_payslips WHERE employee_id = ? AND period_year = ? AND period_month = ?`, [emp.id, year, month]);
      if (exists) return;
      const overtimeHours = one(`SELECT COALESCE(SUM(overtime_hours),0) as total FROM hr_attendance_logs WHERE employee_id = ? AND strftime('%Y', attendance_date) = ? AND strftime('%m', attendance_date) = ?`, [emp.id, String(year), String(month).padStart(2,'0')])?.total || 0;
      const basic = Number(emp.base_salary || 0);
      const allowances = Number(emp.housing_allowance || 0) + Number(emp.transport_allowance || 0) + Number(emp.other_allowance || 0);
      const overtimeAmount = Number(overtimeHours) * Number(emp.overtime_rate || 0);

      // Attendance-based deductions
      const workDaysPerMonth = Number(settings.get('hr.default_work_days', '26'));
      const dailyRate = basic > 0 ? basic / workDaysPerMonth : 0;
      const lateDays = one(`SELECT COUNT(*) as c FROM hr_attendance_logs WHERE employee_id = ? AND strftime('%Y', attendance_date) = ? AND strftime('%m', attendance_date) = ? AND status = 'late'`, [emp.id, String(year), String(month).padStart(2,'0')])?.c || 0;
      const absentDays = one(`SELECT COUNT(*) as c FROM hr_attendance_logs WHERE employee_id = ? AND strftime('%Y', attendance_date) = ? AND strftime('%m', attendance_date) = ? AND status = 'absent'`, [emp.id, String(year), String(month).padStart(2,'0')])?.c || 0;
      const latePenalty = Number((lateDays * dailyRate * 0.25).toFixed(2));
      const absentPenalty = Number((absentDays * dailyRate).toFixed(2));
      const deductions = latePenalty + absentPenalty;
      const deductionDetails = JSON.stringify({ lateDays, absentDays, latePenalty, absentPenalty, dailyRate: Number(dailyRate.toFixed(2)), workDaysPerMonth });

      const net = basic + allowances + overtimeAmount - deductions;
      run(`INSERT INTO hr_payslips (employee_id, period_year, period_month, basic, allowances, deductions, overtime_amount, net_amount, status, deduction_details) VALUES (?,?,?,?,?,?,?,?,?,?)`, [emp.id, year, month, basic, allowances, deductions, overtimeAmount, net, 'draft', deductionDetails]);
      generated += 1;
    });
    res.json({ success: true, data: { generated } });
  });

  router.post('/payroll/post', authMiddleware, requirePermission('hr.payroll.view'), (req, res) => {
    const year = Number(req.body?.year || new Date().getFullYear());
    const month = Number(req.body?.month || (new Date().getMonth() + 1));
    const rows = q(`SELECT p.*, e.full_name, e.employee_no FROM hr_payslips p JOIN hr_employees e ON e.id = p.employee_id WHERE p.period_year = ? AND p.period_month = ? ORDER BY e.full_name`, [year, month]);
    if (!rows.length) return res.status(400).json({ success: false, error: 'No payslips found for this period' });
    const alreadyPosted = rows.every(r => String(r.status || '').toLowerCase() === 'posted');
    if (!alreadyPosted) {
      run(`UPDATE hr_payslips SET status='posted', updated_at=datetime('now') WHERE period_year=? AND period_month=?`, [year, month]);
    }
    const totals = {
      employees: rows.length,
      basic: rows.reduce((a, r) => a + Number(r.basic || 0), 0),
      allowances: rows.reduce((a, r) => a + Number(r.allowances || 0), 0),
      deductions: rows.reduce((a, r) => a + Number(r.deductions || 0), 0),
      overtime: rows.reduce((a, r) => a + Number(r.overtime_amount || 0), 0),
      net: rows.reduce((a, r) => a + Number(r.net_amount || 0), 0),
    };
    eventBus.emit('hr.payroll.posted', {
      year,
      month,
      payslipIds: rows.map(r => r.id),
      totals,
      userId: req.user.id,
    });
    res.json({ success: true, data: { year, month, totals, status: 'posted' } });
  });

  router.get('/recruitment', authMiddleware, requirePermission('hr.recruitment.manage'), (req, res) => {
    res.json({ success: true, data: q(`SELECT a.*, p.name as position_name FROM hr_applicants a LEFT JOIN hr_positions p ON p.id = a.position_id ORDER BY a.id DESC`) });
  });
  router.post('/recruitment', authMiddleware, requirePermission('hr.recruitment.manage'), (req, res) => {
    const b = req.body || {};
    const r = run(`INSERT INTO hr_applicants (full_name, email, mobile, position_id, source, stage, rating, expected_salary, available_from, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`, [b.full_name, b.email || '', b.mobile || '', b.position_id || null, b.source || '', b.stage || 'new', Number(b.rating || 0), Number(b.expected_salary || 0), b.available_from || null, b.notes || '']);
    res.json({ success: true, data: { id: r.lastInsertRowid } });
  });
  router.put('/recruitment/:id', authMiddleware, requirePermission('hr.recruitment.manage'), (req, res) => {
    const b = req.body || {};
    run(`UPDATE hr_applicants SET full_name=?, email=?, mobile=?, position_id=?, source=?, stage=?, rating=?, expected_salary=?, available_from=?, notes=?, updated_at=datetime('now') WHERE id=?`, [b.full_name, b.email || '', b.mobile || '', b.position_id || null, b.source || '', b.stage || 'new', Number(b.rating || 0), Number(b.expected_salary || 0), b.available_from || null, b.notes || '', req.params.id]);
    res.json({ success: true });
  });

  eventBus.addFilter('dashboard.stats', (stats) => {
    const hr = dashboardStats();
    stats.hrEmployees = hr.totalEmployees;
    stats.hrPendingLeaves = hr.pendingLeaves;
    stats.hrPresentToday = hr.presentToday;
    return stats;
  });

  eventBus.addFilter('dashboard.alerts', (alerts) => {
    const pendingLeaves = rowCount(`SELECT COUNT(*) as c FROM hr_leave_requests WHERE status = 'pending'`);
    if (pendingLeaves > 0) alerts.push({ type: 'warning', icon: 'users', text: `${pendingLeaves} HR leave request(s) pending approval`, link: '/hr-leaves' });
    const contractsEnding = rowCount(`SELECT COUNT(*) as c FROM hr_contracts WHERE status='active' AND end_date BETWEEN date('now') AND date('now','+30 days')`);
    if (contractsEnding > 0) alerts.push({ type: 'info', icon: 'users', text: `${contractsEnding} employee contract(s) end within 30 days`, link: '/hr-contracts' });
    return alerts;
  });

  app.use('/api/hr', router);
};

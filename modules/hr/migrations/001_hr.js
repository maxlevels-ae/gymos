module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS hr_departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        code TEXT UNIQUE,
        manager_employee_id INTEGER,
        parent_department_id INTEGER,
        branch_id INTEGER,
        color TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS hr_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        department_id INTEGER,
        grade TEXT DEFAULT '',
        employment_type TEXT DEFAULT 'full_time',
        notes TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS hr_employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_no TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        first_name_ar TEXT DEFAULT '',
        last_name_ar TEXT DEFAULT '',
        work_email TEXT DEFAULT '',
        private_email TEXT DEFAULT '',
        mobile TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        gender TEXT DEFAULT 'male',
        marital_status TEXT DEFAULT 'single',
        date_of_birth TEXT,
        nationality TEXT DEFAULT '',
        national_id TEXT DEFAULT '',
        hire_date TEXT,
        confirmation_date TEXT,
        employee_status TEXT DEFAULT 'draft',
        employment_type TEXT DEFAULT 'full_time',
        branch_id INTEGER,
        department_id INTEGER,
        position_id INTEGER,
        manager_employee_id INTEGER,
        user_id INTEGER,
        badge_id TEXT DEFAULT '',
        shift_code TEXT DEFAULT '',
        blood_type TEXT DEFAULT '',
        emergency_contact_name TEXT DEFAULT '',
        emergency_contact_phone TEXT DEFAULT '',
        emergency_contact_relation TEXT DEFAULT '',
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT '',
        base_salary REAL DEFAULT 0,
        housing_allowance REAL DEFAULT 0,
        transport_allowance REAL DEFAULT 0,
        other_allowance REAL DEFAULT 0,
        overtime_rate REAL DEFAULT 0,
        leave_balance REAL DEFAULT 0,
        image_url TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS hr_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        contract_ref TEXT UNIQUE,
        contract_type TEXT DEFAULT 'permanent',
        start_date TEXT NOT NULL,
        end_date TEXT,
        probation_days INTEGER DEFAULT 90,
        wage REAL DEFAULT 0,
        allowance_total REAL DEFAULT 0,
        schedule TEXT DEFAULT 'standard',
        payroll_cycle TEXT DEFAULT 'monthly',
        status TEXT DEFAULT 'draft',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS hr_attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        attendance_date TEXT NOT NULL,
        check_in TEXT,
        check_out TEXT,
        worked_hours REAL DEFAULT 0,
        overtime_hours REAL DEFAULT 0,
        status TEXT DEFAULT 'present',
        source TEXT DEFAULT 'manual',
        note TEXT DEFAULT '',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS hr_leave_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        code TEXT UNIQUE,
        default_days REAL DEFAULT 0,
        requires_attachment INTEGER DEFAULT 0,
        is_paid INTEGER DEFAULT 1,
        gender_rule TEXT DEFAULT 'all',
        color TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS hr_leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        leave_type_id INTEGER NOT NULL,
        request_no TEXT UNIQUE,
        date_from TEXT NOT NULL,
        date_to TEXT NOT NULL,
        days REAL DEFAULT 1,
        reason TEXT DEFAULT '',
        attachment_name TEXT DEFAULT '',
        status TEXT DEFAULT 'draft',
        approved_by INTEGER,
        approved_at TEXT,
        reject_reason TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
        FOREIGN KEY (leave_type_id) REFERENCES hr_leave_types(id)
      );

      CREATE TABLE IF NOT EXISTS hr_applicants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT DEFAULT '',
        mobile TEXT DEFAULT '',
        position_id INTEGER,
        source TEXT DEFAULT '',
        stage TEXT DEFAULT 'new',
        rating INTEGER DEFAULT 0,
        expected_salary REAL DEFAULT 0,
        available_from TEXT,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS hr_payslips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        period_year INTEGER NOT NULL,
        period_month INTEGER NOT NULL,
        basic REAL DEFAULT 0,
        allowances REAL DEFAULT 0,
        deductions REAL DEFAULT 0,
        overtime_amount REAL DEFAULT 0,
        net_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_hr_emp_branch ON hr_employees(branch_id);
      CREATE INDEX IF NOT EXISTS idx_hr_emp_dept ON hr_employees(department_id);
      CREATE INDEX IF NOT EXISTS idx_hr_att_emp_date ON hr_attendance_logs(employee_id, attendance_date);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_emp ON hr_leave_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_status ON hr_leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_hr_payslip_period ON hr_payslips(period_year, period_month);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('hr.dashboard', 'HR Dashboard', 'hr'),
        ('hr.employee.view', 'View Employees', 'hr'),
        ('hr.employee.create', 'Create Employees', 'hr'),
        ('hr.employee.edit', 'Edit Employees', 'hr'),
        ('hr.employee.delete', 'Delete Employees', 'hr'),
        ('hr.department.manage', 'Manage Departments & Positions', 'hr'),
        ('hr.attendance.manage', 'Manage Attendance', 'hr'),
        ('hr.leave.manage', 'Manage Leaves', 'hr'),
        ('hr.contract.manage', 'Manage Contracts', 'hr'),
        ('hr.payroll.view', 'View Payroll', 'hr'),
        ('hr.recruitment.manage', 'Manage Recruitment', 'hr'),
        ('hr.settings.manage', 'Manage HR Settings', 'hr');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'admin' AND p.module = 'hr';
    `);
  }
};

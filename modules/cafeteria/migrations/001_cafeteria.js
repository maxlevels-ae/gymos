module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cafeteria_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        parent_id INTEGER,
        icon TEXT DEFAULT 'package',
        color TEXT DEFAULT '#6366f1',
        revenue_group TEXT DEFAULT '',
        stock_group TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cafeteria_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        sku TEXT UNIQUE,
        barcode TEXT DEFAULT '',
        category_id INTEGER,
        selling_price REAL DEFAULT 0,
        cost_method TEXT DEFAULT 'average',
        standard_cost REAL DEFAULT 0,
        average_cost REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        image_url TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        product_type TEXT DEFAULT 'stockable',
        uom TEXT DEFAULT 'Unit',
        reorder_level REAL DEFAULT 0,
        low_stock_threshold REAL DEFAULT 0,
        availability_status TEXT DEFAULT 'available',
        notes TEXT DEFAULT '',
        allergens TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        recipe_json TEXT DEFAULT '[]',
        qty_on_hand REAL DEFAULT 0,
        reserved_qty REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cafeteria_warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        code TEXT UNIQUE,
        branch_id INTEGER,
        is_pos_default INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cafeteria_stock_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warehouse_id INTEGER,
        product_id INTEGER NOT NULL,
        move_type TEXT NOT NULL,
        reference_type TEXT DEFAULT '',
        reference_id INTEGER,
        qty REAL NOT NULL,
        unit_cost REAL DEFAULT 0,
        total_value REAL DEFAULT 0,
        before_qty REAL DEFAULT 0,
        after_qty REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cafeteria_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE,
        source TEXT DEFAULT 'pos',
        status TEXT DEFAULT 'draft',
        warehouse_id INTEGER,
        session_id INTEGER,
        member_id INTEGER,
        customer_name TEXT DEFAULT '',
        staff_name TEXT DEFAULT '',
        subtotal REAL DEFAULT 0,
        discount_total REAL DEFAULT 0,
        tax_total REAL DEFAULT 0,
        total REAL DEFAULT 0,
        paid_total REAL DEFAULT 0,
        change_total REAL DEFAULT 0,
        cogs_total REAL DEFAULT 0,
        gross_profit REAL DEFAULT 0,
        currency TEXT DEFAULT 'JOD',
        cashier_id INTEGER,
        cashier_name TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        void_reason TEXT DEFAULT '',
        refunded_order_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cafeteria_order_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        product_name_ar TEXT DEFAULT '',
        sku TEXT DEFAULT '',
        qty REAL DEFAULT 1,
        unit_price REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cafeteria_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        session_id INTEGER,
        payment_method TEXT NOT NULL,
        amount REAL NOT NULL,
        tendered_amount REAL DEFAULT 0,
        change_amount REAL DEFAULT 0,
        reference TEXT DEFAULT '',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cafeteria_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT DEFAULT '',
        warehouse_id INTEGER,
        opening_cash REAL DEFAULT 0,
        expected_cash REAL DEFAULT 0,
        counted_cash REAL DEFAULT 0,
        discrepancy REAL DEFAULT 0,
        status TEXT DEFAULT 'open',
        opened_at TEXT DEFAULT (datetime('now')),
        closed_at TEXT,
        open_notes TEXT DEFAULT '',
        close_notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS cafeteria_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        refund_order_id INTEGER,
        refund_total REAL DEFAULT 0,
        reason TEXT DEFAULT '',
        approved_by INTEGER,
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_caf_products_category ON cafeteria_products(category_id);
      CREATE INDEX IF NOT EXISTS idx_caf_products_sku ON cafeteria_products(sku);
      CREATE INDEX IF NOT EXISTS idx_caf_stock_moves_product ON cafeteria_stock_moves(product_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_caf_orders_status ON cafeteria_orders(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_caf_orders_session ON cafeteria_orders(session_id);
      CREATE INDEX IF NOT EXISTS idx_caf_payments_order ON cafeteria_payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_caf_sessions_user_status ON cafeteria_sessions(user_id, status);

      INSERT OR IGNORE INTO permissions (key, display_name, module) VALUES
        ('cafeteria.view', 'View Cafeteria', 'cafeteria'),
        ('cafeteria.manage_products', 'Manage Cafeteria Products', 'cafeteria'),
        ('cafeteria.manage_categories', 'Manage Cafeteria Categories', 'cafeteria'),
        ('cafeteria.manage_warehouses', 'Manage Cafeteria Warehouses', 'cafeteria'),
        ('cafeteria.manage_inventory', 'Manage Cafeteria Inventory', 'cafeteria'),
        ('cafeteria.pos.open_session', 'Open Cafeteria POS Session', 'cafeteria'),
        ('cafeteria.pos.close_session', 'Close Cafeteria POS Session', 'cafeteria'),
        ('cafeteria.pos.sell', 'Sell via Cafeteria POS', 'cafeteria'),
        ('cafeteria.pos.refund', 'Refund Cafeteria Order', 'cafeteria'),
        ('cafeteria.pos.discount', 'Discount Cafeteria Order', 'cafeteria'),
        ('cafeteria.pos.void', 'Void Cafeteria Order', 'cafeteria'),
        ('cafeteria.reports.view', 'View Cafeteria Reports', 'cafeteria'),
        ('cafeteria.settings.manage', 'Manage Cafeteria Settings', 'cafeteria');

      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'cafeteria';

      INSERT OR IGNORE INTO settings (key, value, type, module, label) VALUES
        ('cafeteria.allow_negative_stock', 'false', 'boolean', 'cafeteria', 'Allow Negative Stock'),
        ('cafeteria.allow_sale_without_session', 'false', 'boolean', 'cafeteria', 'Allow Sale Without Session'),
        ('cafeteria.allow_overpayment', 'false', 'boolean', 'cafeteria', 'Allow Overpayment'),
        ('cafeteria.refund_approval_threshold', '25', 'number', 'cafeteria', 'Refund Approval Threshold'),
        ('cafeteria.low_stock_threshold', '5', 'number', 'cafeteria', 'Low Stock Threshold'),
        ('cafeteria.enabled_payment_methods', '["cash","card","cliq"]', 'json', 'cafeteria', 'Enabled Payment Methods'),
        ('cafeteria.receipt_footer', 'Thank you for visiting', 'string', 'cafeteria', 'Receipt Footer');

      INSERT OR IGNORE INTO cafeteria_categories (id, name, name_ar, icon, color, revenue_group, stock_group, sort_order) VALUES
        (1, 'Coffee & Hot Drinks', 'القهوة والمشروبات الساخنة', 'coffee', '#8b5cf6', 'beverages', 'dry', 10),
        (2, 'Cold Drinks', 'المشروبات الباردة', 'cup-soda', '#06b6d4', 'beverages', 'cooler', 20),
        (3, 'Snacks', 'الوجبات الخفيفة', 'sandwich', '#10b981', 'food', 'snacks', 30),
        (4, 'Supplements', 'المكملات', 'dumbbell', '#f59e0b', 'supplements', 'retail', 40);

      INSERT OR IGNORE INTO cafeteria_warehouses (id, name, name_ar, code, is_pos_default, is_active, notes) VALUES
        (1, 'Main Cafeteria', 'مستودع الكافتيريا الرئيسي', 'CAF-MAIN', 1, 1, 'Default cafeteria stock point');

      INSERT OR IGNORE INTO cafeteria_products (id, name, name_ar, sku, barcode, category_id, selling_price, standard_cost, average_cost, tax_rate, product_type, uom, reorder_level, low_stock_threshold, qty_on_hand, is_active, notes) VALUES
        (1, 'Espresso', 'إسبريسو', 'CAF-ESP', '1000001', 1, 2.50, 0.90, 0.90, 0.00, 'stockable', 'Cup', 10, 5, 50, 1, ''),
        (2, 'Protein Shake', 'بروتين شيك', 'CAF-PSH', '1000002', 2, 4.50, 2.20, 2.20, 0.00, 'stockable', 'Bottle', 8, 4, 30, 1, ''),
        (3, 'Chicken Sandwich', 'ساندويتش دجاج', 'CAF-SND', '1000003', 3, 5.00, 2.75, 2.75, 0.00, 'stockable', 'Piece', 6, 3, 20, 1, ''),
        (4, 'Water Bottle', 'عبوة ماء', 'CAF-WAT', '1000004', 2, 1.00, 0.25, 0.25, 0.00, 'stockable', 'Bottle', 25, 10, 100, 1, ''),
        (5, 'Membership Snack Add-on', 'إضافة وجبة للاشتراك', 'CAF-ADD', '1000005', 3, 3.00, 0.00, 0.00, 0.00, 'service', 'Unit', 0, 0, 0, 1, 'Service item');
    `);
  }
};

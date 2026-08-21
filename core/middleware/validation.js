const { z } = require('zod');

function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body || {});
      next();
    } catch (error) {
      const issues = Array.isArray(error?.issues) ? error.issues.map(i => ({
        path: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
        message: i.message,
      })) : [];
      return res.status(400).json({
        success: false,
        error: issues[0]?.message || 'Validation failed',
        details: issues,
      });
    }
  };
}

const schemas = {
  login: z.object({
    username: z.string().trim().min(1, 'Username is required').max(120),
    password: z.string().min(1, 'Password is required').max(500),
  }),
  changePassword: z.object({
    current_password: z.string().min(1, 'Current password is required').max(500),
    new_password: z.string().min(8, 'Password must be at least 8 characters').max(500),
  }),
  refresh: z.object({
    refreshToken: z.string().trim().min(1).max(4096).optional(),
  }).optional().default({}),
  otpSend: z.object({
    type: z.enum(['member', 'employee']).default('member'),
    phone: z.string().trim().min(3, 'Phone is required').max(50),
  }),
  otpVerify: z.object({
    type: z.enum(['member', 'employee']).default('member'),
    phone: z.string().trim().min(3, 'Phone is required').max(50),
    otp: z.string().trim().min(4, 'OTP is required').max(12),
  }),
  pwaRefresh: z.object({
    refreshToken: z.string().trim().min(1, 'Refresh token is required').max(4096),
  }),
};



const idLike = z.coerce.number().int().positive();
const numericLike = z.union([z.number(), z.string(), z.null(), z.undefined()]).transform(v => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
});
const nullableDate = z.union([z.string().trim().min(1), z.null(), z.undefined()]).transform(v => v ? String(v) : null);
const optionalText = (max = 1000) => z.union([z.string(), z.null(), z.undefined()]).transform(v => v == null ? '' : String(v).trim()).pipe(z.string().max(max));
const optionalBool = z.union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()]).transform(v => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(s);
});

schemas.hrEmployee = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(120),
  last_name: z.string().trim().min(1, 'Last name is required').max(120),
  first_name_ar: optionalText(120),
  last_name_ar: optionalText(120),
  work_email: optionalText(190),
  private_email: optionalText(190),
  mobile: optionalText(50),
  phone: optionalText(50),
  gender: z.enum(['male', 'female']).optional().default('male'),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional().default('single'),
  date_of_birth: nullableDate,
  nationality: optionalText(80),
  national_id: optionalText(80),
  hire_date: nullableDate,
  confirmation_date: nullableDate,
  employee_status: z.enum(['draft', 'probation', 'active', 'suspended', 'terminated']).optional().default('draft'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern', 'temporary']).optional().default('full_time'),
  branch_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  department_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  position_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  manager_employee_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  badge_id: optionalText(80),
  shift_code: optionalText(50),
  blood_type: optionalText(20),
  emergency_contact_name: optionalText(120),
  emergency_contact_phone: optionalText(50),
  emergency_contact_relation: optionalText(60),
  address: optionalText(300),
  city: optionalText(80),
  country: optionalText(80),
  base_salary: numericLike,
  housing_allowance: numericLike,
  transport_allowance: numericLike,
  other_allowance: numericLike,
  overtime_rate: numericLike,
  leave_balance: numericLike,
  notes: optionalText(2000),
  is_active: optionalBool.optional().default(true),
});

schemas.purchaseVendor = z.object({
  code: optionalText(40),
  name: z.string().trim().min(1, 'Vendor name is required').max(190),
  name_ar: optionalText(190),
  email: optionalText(190),
  phone: optionalText(50),
  mobile: optionalText(50),
  contact_name: optionalText(120),
  address: optionalText(300),
  city: optionalText(80),
  country: optionalText(80),
  tax_number: optionalText(80),
  payment_terms: numericLike,
  currency: optionalText(10),
  bank_name: optionalText(120),
  bank_account: optionalText(120),
  bank_iban: optionalText(120),
  notes: optionalText(2000),
  is_active: optionalBool.optional().default(true),
});

schemas.purchaseProduct = z.object({
  code: optionalText(40),
  name: z.string().trim().min(1, 'Product name is required').max(190),
  name_ar: optionalText(190),
  description: optionalText(1000),
  category: optionalText(80),
  uom: optionalText(40),
  standard_price: numericLike,
  last_purchase_price: numericLike,
  min_qty: numericLike,
  reorder_qty: numericLike,
  on_hand_qty: numericLike,
  tax_rate: numericLike,
  notes: optionalText(2000),
  is_active: optionalBool.optional().default(true),
});

const purchaseOrderLine = z.object({
  product_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  description: optionalText(500),
  uom: optionalText(40),
  qty_ordered: numericLike,
  qty: numericLike.optional(),
  unit_price: numericLike,
  discount_pct: numericLike,
  tax_rate: numericLike,
  expected_date: nullableDate,
  notes: optionalText(500),
});

schemas.purchaseOrder = z.object({
  vendor_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  vendor_name: optionalText(190),
  branch_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  order_date: z.string().trim().min(1, 'order_date required').max(40),
  expected_date: nullableDate,
  currency: optionalText(10),
  payment_terms: numericLike,
  notes: optionalText(2000),
  internal_notes: optionalText(2000),
  source_reference: optionalText(120),
  lines: z.array(purchaseOrderLine).max(100).default([]),
});

schemas.purchaseReceipt = z.object({
  order_id: idLike,
  vendor_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  vendor_name: optionalText(190),
  receipt_date: z.string().trim().min(1, 'receipt_date required').max(40),
  notes: optionalText(1000),
  lines: z.array(z.object({
    order_line_id: idLike,
    qty_done: numericLike,
    notes: optionalText(500),
  })).max(200).default([]),
});

schemas.purchaseBill = z.object({
  order_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  vendor_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
  vendor_name: optionalText(190),
  invoice_date: z.string().trim().min(1, 'invoice_date required').max(40),
  due_date: nullableDate,
  payment_terms: numericLike,
  subtotal: numericLike,
  tax_amount: numericLike,
  total_amount: numericLike,
  notes: optionalText(2000),
  lines: z.array(z.object({
    order_line_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
    product_id: z.union([idLike, z.null(), z.undefined()]).transform(v => v ?? null),
    description: optionalText(500),
    qty: numericLike,
    unit_price: numericLike,
    tax_rate: numericLike,
  })).max(200).default([]),
});

module.exports = { validateBody, schemas, z };


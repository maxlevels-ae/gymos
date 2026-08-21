const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const database = require('./database');
const authService = require('./services/auth-service');
const settingsService = require('./services/settings-service');
const auditService = require('./services/audit-service');
const notificationService = require('./services/notification-service');
const eventBus = require('./event-bus');
const container = require('./container');
const accessTokens = require('../modules/access-control/c3-tokens'); // rotating QR tokens (shared with C3 bridge)
const { authMiddleware, requirePermission } = require('./middleware/auth');
const { validateBody, schemas } = require('./middleware/validation');
const ModuleInstaller = require('./services/module-installer');
const config = require('./config');

// Multer for module zip uploads
const upload = multer({
  dest: path.join(config.paths.uploads, 'modules'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) cb(null, true);
    else cb(new Error('Only .zip files are accepted'));
  }
});

const pwaAssetUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(config.paths.uploads, 'pwa');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const safeType = String(req.params.type || 'pwa').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const safeAsset = String(req.params.asset || 'asset').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      cb(null, `${safeType}-${safeAsset}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if ((file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are accepted'));
  }
});

const SETTINGS_TABS = [
  { id: 'general', label: 'General', labelAr: 'عام' },
  { id: 'localization', label: 'Localization', labelAr: 'اللغة والمنطقة' },
  { id: 'system', label: 'System', labelAr: 'النظام' },
  { id: 'notifications', label: 'Notifications', labelAr: 'الإشعارات' },
  { id: 'member_pwa', label: 'Member PWA', labelAr: 'تطبيق الأعضاء' },
  { id: 'employee_pwa', label: 'Employee PWA', labelAr: 'تطبيق الموظفين' },
  { id: 'modules', label: 'Modules', labelAr: 'الوحدات' },
];

function inferFieldType(setting) {
  if (setting.type === 'boolean') return 'toggle';
  const key = setting.key || '';
  if (['app.locale', 'app.dir', 'app.date_format', 'app.currency', 'freeze.pricing_mode'].includes(key)) return 'select';
  if (key === 'app.timezone') return 'searchable-select';
  return setting.type === 'string' ? 'text' : (setting.type || 'text');
}


function buildCoreSettingsSections() {
  return [
    {
      id: 'app-general',
      tab: 'general',
      title: 'Application',
      titleAr: 'التطبيق',
      description: 'Core application identity and primary defaults.',
      descriptionAr: 'هوية التطبيق والإعدادات الأساسية.',
      order: 10,
      fields: [
        { key: 'app.name', type: 'text', label: 'Application Name', labelAr: 'اسم التطبيق' },
        { key: 'app.public_url', type: 'text', label: 'Public URL (e.g. https://gym.example.com)', labelAr: 'الرابط العام للموقع (مثال: https://gym.example.com)' },
        { key: 'app.admin_logo_url', type: 'image-upload', assetType: 'admin_logo', uploadScope: 'app', label: 'Admin Logo', labelAr: 'شعار لوحة التحكم' },
        { key: 'app.login_logo_url', type: 'image-upload', assetType: 'login_logo', uploadScope: 'app', label: 'Login Logo', labelAr: 'شعار تسجيل الدخول' },
      ],
    },
    {
      id: 'app-localization',
      tab: 'localization',
      title: 'Regional Settings',
      titleAr: 'الإعدادات الإقليمية',
      description: 'Language, direction, timezone, date and currency formatting.',
      descriptionAr: 'اللغة والاتجاه والمنطقة الزمنية وتنسيق التاريخ والعملة.',
      order: 20,
      fields: [
        { key: 'app.locale', type: 'select', label: 'Language', labelAr: 'اللغة', options: [
          { value: 'en', label: 'English' },
          { value: 'ar', label: 'العربية' },
        ] },
        { key: 'app.dir', type: 'select', label: 'Direction', labelAr: 'الاتجاه', options: [
          { value: 'auto', label: 'Auto' },
          { value: 'rtl', label: 'RTL' },
          { value: 'ltr', label: 'LTR' },
        ] },
        { key: 'app.timezone', type: 'searchable-select', label: 'Timezone', labelAr: 'المنطقة الزمنية', options: [
          { value: 'Asia/Amman', label: 'Asia/Amman', group: 'Middle East' },
          { value: 'Asia/Riyadh', label: 'Asia/Riyadh', group: 'Middle East' },
          { value: 'Asia/Dubai', label: 'Asia/Dubai', group: 'Middle East' },
          { value: 'Asia/Kuwait', label: 'Asia/Kuwait', group: 'Middle East' },
          { value: 'Asia/Qatar', label: 'Asia/Qatar', group: 'Middle East' },
          { value: 'Asia/Bahrain', label: 'Asia/Bahrain', group: 'Middle East' },
          { value: 'Asia/Baghdad', label: 'Asia/Baghdad', group: 'Middle East' },
          { value: 'Asia/Beirut', label: 'Asia/Beirut', group: 'Middle East' },
          { value: 'Asia/Cairo', label: 'Asia/Cairo', group: 'Middle East' },
          { value: 'UTC', label: 'UTC', group: 'Global' },
          { value: 'Europe/London', label: 'Europe/London', group: 'Global' },
          { value: 'America/New_York', label: 'America/New_York', group: 'Global' },
        ] },
        { key: 'app.date_format', type: 'select', label: 'Date Format', labelAr: 'تنسيق التاريخ', options: [
          { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
          { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
        ] },
        { key: 'app.currency', type: 'select', label: 'Currency', labelAr: 'العملة', options: [
          { value: 'USD', label: 'USD' },
          { value: 'SAR', label: 'SAR' },
          { value: 'AED', label: 'AED' },
          { value: 'JOD', label: 'JOD' },
          { value: 'KWD', label: 'KWD' },
          { value: 'QAR', label: 'QAR' },
        ] },
      ],
    },
    {
      id: 'app-system',
      tab: 'system',
      title: 'Platform Controls',
      titleAr: 'عناصر تحكم المنصة',
      description: 'System behaviour toggles that apply across the SaaS shell.',
      descriptionAr: 'خيارات تحكم عامة على مستوى المنصة.',
      order: 30,
      fields: [
        { key: 'system.module_uploads_enabled', type: 'toggle', label: 'Allow Module Uploads', labelAr: 'السماح برفع الوحدات' },
        { key: 'system.auto_complete_freezes', type: 'toggle', label: 'Auto-complete Freezes', labelAr: 'الإكمال التلقائي للتجميد' },
      ],
    },
    {
      id: 'app-notifications',
      tab: 'notifications',
      title: 'Notification Channels',
      titleAr: 'قنوات الإشعارات',
      description: 'Default delivery channels for the application.',
      descriptionAr: 'قنوات الإرسال الافتراضية داخل التطبيق.',
      order: 40,
      fields: [
        { key: 'notifications.in_app.enabled', type: 'toggle', label: 'In-App Notifications', labelAr: 'إشعارات داخل التطبيق' },
        { key: 'notifications.email.enabled', type: 'toggle', label: 'Email Notifications', labelAr: 'إشعارات البريد الإلكتروني' },
      ],
    },
    {
      id: 'member-pwa-branding',
      tab: 'member_pwa',
      title: 'Member PWA Branding',
      titleAr: 'هوية تطبيق الأعضاء',
      description: 'Control the member app title, subtitle, colors, logo, and install icons.',
      descriptionAr: 'التحكم باسم تطبيق الأعضاء والعنوان الفرعي والألوان والشعار وأيقونات التثبيت.',
      order: 10,
      fields: [
        { key: 'member_pwa.enabled', type: 'toggle', label: 'Enable Member PWA', labelAr: 'تفعيل تطبيق الأعضاء' },
        { key: 'member_pwa.app_name', type: 'text', label: 'App Name (EN)', labelAr: 'اسم التطبيق (EN)' },
        { key: 'member_pwa.app_name_ar', type: 'text', label: 'App Name (AR)', labelAr: 'اسم التطبيق (AR)' },
        { key: 'member_pwa.subtitle', type: 'text', label: 'Subtitle (EN)', labelAr: 'العنوان الفرعي (EN)' },
        { key: 'member_pwa.subtitle_ar', type: 'text', label: 'Subtitle (AR)', labelAr: 'العنوان الفرعي (AR)' },
        { key: 'member_pwa.theme_color', type: 'color', label: 'Theme Color', labelAr: 'لون الثيم' },
        { key: 'member_pwa.accent_color', type: 'color', label: 'Accent Color', labelAr: 'اللون الرئيسي' },
        { key: 'member_pwa.background_color', type: 'color', label: 'Background Color', labelAr: 'لون الخلفية' },
        { key: 'member_pwa.logo_url', type: 'image-upload', assetType: 'logo', uploadScope: 'member', label: 'Logo', labelAr: 'الشعار' },
        { key: 'member_pwa.icon_192_url', type: 'image-upload', assetType: 'icon192', uploadScope: 'member', label: 'Install Icon 192', labelAr: 'أيقونة التثبيت 192' },
        { key: 'member_pwa.icon_512_url', type: 'image-upload', assetType: 'icon512', uploadScope: 'member', label: 'Install Icon 512', labelAr: 'أيقونة التثبيت 512' },
      ],
    },
    {
      id: 'member-pwa-auth',
      tab: 'member_pwa',
      title: 'Member PWA Authentication',
      titleAr: 'مصادقة تطبيق الأعضاء',
      description: 'Configure real OTP delivery and member login security.',
      descriptionAr: 'إعداد إرسال OTP الحقيقي وأمان دخول الأعضاء.',
      order: 20,
      fields: [
        { key: 'member_pwa.otp_enabled', type: 'toggle', label: 'Enable OTP Login', labelAr: 'تفعيل دخول OTP' },
        { key: 'member_pwa.otp_provider', type: 'select', label: 'OTP Provider', labelAr: 'مزود OTP', options: [
          { value: 'wasender', label: 'Wasender / WhatsApp', labelAr: 'Wasender / واتساب' },
          { value: 'dev', label: 'Developer Mode', labelAr: 'وضع المطور' },
        ] },
        { key: 'member_pwa.otp_length', type: 'number', label: 'OTP Length', labelAr: 'طول رمز OTP' },
        { key: 'member_pwa.otp_expiry_minutes', type: 'number', label: 'OTP Expiry (minutes)', labelAr: 'مدة صلاحية OTP (دقائق)' },
        { key: 'member_pwa.otp_message', type: 'text', label: 'OTP Message Template', labelAr: 'قالب رسالة OTP' },
        { key: 'member_pwa.otp_debug_mode', type: 'toggle', label: 'Show OTP in Debug', labelAr: 'إظهار OTP في وضع التصحيح' },
        { key: 'member_pwa.otp_allow_dev_fallback', type: 'toggle', label: 'Allow Dev Fallback', labelAr: 'السماح بالرجوع لوضع المطور' },
      ],
    },
    {
      id: 'member-pwa-access',
      tab: 'member_pwa',
      title: 'Member PWA Access',
      titleAr: 'دخول الأعضاء عبر التطبيق',
      description: 'Control QR visibility, direct door opening, and access actions from the member app.',
      descriptionAr: 'التحكم بإظهار QR وفتح الباب المباشر وإجراءات الدخول من تطبيق الأعضاء.',
      order: 30,
      fields: [
        { key: 'member_pwa.show_qr', type: 'toggle', label: 'Show QR Card', labelAr: 'إظهار بطاقة QR' },
        { key: 'member_pwa.qr_open_enabled', type: 'toggle', label: 'Enable Door Open Button', labelAr: 'تفعيل زر فتح الباب' },
      ],
    },
    {
      id: 'employee-pwa-branding',
      tab: 'employee_pwa',
      title: 'Employee PWA Branding',
      titleAr: 'هوية تطبيق الموظفين',
      description: 'Control the employee app title, subtitle, colors, logo, and install icons.',
      descriptionAr: 'التحكم باسم تطبيق الموظفين والعنوان الفرعي والألوان والشعار وأيقونات التثبيت.',
      order: 10,
      fields: [
        { key: 'employee_pwa.enabled', type: 'toggle', label: 'Enable Employee PWA', labelAr: 'تفعيل تطبيق الموظفين' },
        { key: 'employee_pwa.app_name', type: 'text', label: 'App Name (EN)', labelAr: 'اسم التطبيق (EN)' },
        { key: 'employee_pwa.app_name_ar', type: 'text', label: 'App Name (AR)', labelAr: 'اسم التطبيق (AR)' },
        { key: 'employee_pwa.subtitle', type: 'text', label: 'Subtitle (EN)', labelAr: 'العنوان الفرعي (EN)' },
        { key: 'employee_pwa.subtitle_ar', type: 'text', label: 'Subtitle (AR)', labelAr: 'العنوان الفرعي (AR)' },
        { key: 'employee_pwa.theme_color', type: 'color', label: 'Theme Color', labelAr: 'لون الثيم' },
        { key: 'employee_pwa.accent_color', type: 'color', label: 'Accent Color', labelAr: 'اللون الرئيسي' },
        { key: 'employee_pwa.background_color', type: 'color', label: 'Background Color', labelAr: 'لون الخلفية' },
        { key: 'employee_pwa.logo_url', type: 'image-upload', assetType: 'logo', uploadScope: 'employee', label: 'Logo', labelAr: 'الشعار' },
        { key: 'employee_pwa.icon_192_url', type: 'image-upload', assetType: 'icon192', uploadScope: 'employee', label: 'Install Icon 192', labelAr: 'أيقونة التثبيت 192' },
        { key: 'employee_pwa.icon_512_url', type: 'image-upload', assetType: 'icon512', uploadScope: 'employee', label: 'Install Icon 512', labelAr: 'أيقونة التثبيت 512' },
      ],
    },
    {
      id: 'employee-pwa-auth',
      tab: 'employee_pwa',
      title: 'Employee PWA Authentication',
      titleAr: 'مصادقة تطبيق الموظفين',
      description: 'Configure real OTP delivery and employee login security.',
      descriptionAr: 'إعداد إرسال OTP الحقيقي وأمان دخول الموظفين.',
      order: 20,
      fields: [
        { key: 'employee_pwa.otp_enabled', type: 'toggle', label: 'Enable OTP Login', labelAr: 'تفعيل دخول OTP' },
        { key: 'employee_pwa.otp_provider', type: 'select', label: 'OTP Provider', labelAr: 'مزود OTP', options: [
          { value: 'wasender', label: 'Wasender / WhatsApp', labelAr: 'Wasender / واتساب' },
          { value: 'dev', label: 'Developer Mode', labelAr: 'وضع المطور' },
        ] },
        { key: 'employee_pwa.otp_length', type: 'number', label: 'OTP Length', labelAr: 'طول رمز OTP' },
        { key: 'employee_pwa.otp_expiry_minutes', type: 'number', label: 'OTP Expiry (minutes)', labelAr: 'مدة صلاحية OTP (دقائق)' },
        { key: 'employee_pwa.otp_message', type: 'text', label: 'OTP Message Template', labelAr: 'قالب رسالة OTP' },
        { key: 'employee_pwa.otp_debug_mode', type: 'toggle', label: 'Show OTP in Debug', labelAr: 'إظهار OTP في وضع التصحيح' },
        { key: 'employee_pwa.otp_allow_dev_fallback', type: 'toggle', label: 'Allow Dev Fallback', labelAr: 'السماح بالرجوع لوضع المطور' },
      ],
    },
    {
      id: 'employee-pwa-access',
      tab: 'employee_pwa',
      title: 'Employee PWA Actions',
      titleAr: 'إجراءات تطبيق الموظفين',
      description: 'Control attendance clocking and access actions from the employee app.',
      descriptionAr: 'التحكم بتسجيل الحضور وإجراءات الدخول من تطبيق الموظفين.',
      order: 30,
      fields: [
        { key: 'employee_pwa.allow_clock', type: 'toggle', label: 'Allow Clock In/Out from App', labelAr: 'السماح بتسجيل الدوام من التطبيق' },
        { key: 'employee_pwa.show_badge', type: 'toggle', label: 'Show Employee Badge', labelAr: 'إظهار بطاقة الموظف' },
      ],
    },
  ];
}

function buildSettingsSchema(moduleLoader) {
  const rows = settingsService.getAll();
  const valueMap = rows.reduce((acc, row) => {
    acc[row.key] = settingsService.cast(row.value, row.type);
    return acc;
  }, {});

  const sectionMap = new Map();
  for (const section of buildCoreSettingsSections()) {
    sectionMap.set(section.id, { ...section, fields: [...(section.fields || [])] });
  }

  for (const [moduleName, info] of moduleLoader.modules.entries()) {
    if (info?.status !== 'active') continue;
    const manifestSections = Array.isArray(info?.manifest?.settingsSections) ? info.manifest.settingsSections : [];
    for (const rawSection of manifestSections) {
      const sectionId = rawSection.id || `${moduleName}-${rawSection.tab || 'modules'}`;
      sectionMap.set(sectionId, {
        id: sectionId,
        module: moduleName,
        tab: rawSection.tab || 'modules',
        title: rawSection.title || rawSection.label || moduleName,
        titleAr: rawSection.titleAr || rawSection.labelAr || rawSection.title || moduleName,
        description: rawSection.description || '',
        descriptionAr: rawSection.descriptionAr || rawSection.description || '',
        order: rawSection.order || 100,
        fields: (rawSection.fields || []).map((field) => ({ ...field, module: moduleName })),
      });
    }
  }

  // Backward-compatible fallback: only create a legacy module section when a module has stored settings
  // but did not declare injected sections explicitly.
  const rowsByModule = new Map();
  for (const row of rows) {
    if (row.module === 'core') continue;
    if (!rowsByModule.has(row.module)) rowsByModule.set(row.module, []);
    rowsByModule.get(row.module).push(row);
  }

  for (const [moduleName, moduleRows] of rowsByModule.entries()) {
    const hasExplicitSection = [...sectionMap.values()].some((section) => section.module === moduleName);
    if (hasExplicitSection) continue;
    const modInfo = moduleLoader.getModuleInfo(moduleName);
    const manifest = modInfo?.manifest || {};
    sectionMap.set(`legacy-${moduleName}`, {
      id: `legacy-${moduleName}`,
      module: moduleName,
      tab: 'modules',
      title: manifest.label || manifest.name || moduleName,
      titleAr: manifest.labelAr || manifest.label || manifest.name || moduleName,
      description: manifest.description || `Settings exposed by ${moduleName}.`,
      descriptionAr: manifest.descriptionAr || `إعدادات الوحدة ${moduleName}.`,
      order: 900,
      fields: moduleRows.map((row) => ({
        key: row.key,
        type: inferFieldType(row),
        label: row.label || row.key,
        labelAr: row.labelAr || row.label || row.key,
        module: row.module,
      })),
    });
  }

  const tabOrder = SETTINGS_TABS.reduce((acc, tab, index) => ({ ...acc, [tab.id]: index }), {});
  const sections = [...sectionMap.values()].sort((a, b) => {
    const tabA = tabOrder[a.tab || 'modules'] ?? 999;
    const tabB = tabOrder[b.tab || 'modules'] ?? 999;
    if (tabA !== tabB) return tabA - tabB;
    return (a.order || 99) - (b.order || 99);
  });

  const fallbackValues = {
    'member_pwa.enabled': true,
    'member_pwa.app_name': 'Member Portal',
    'member_pwa.app_name_ar': 'بوابة العضوية',
    'member_pwa.subtitle': 'Fitness Club',
    'member_pwa.subtitle_ar': 'نادي اللياقة',
    'member_pwa.theme_color': '#0c1017',
    'member_pwa.accent_color': '#6366f1',
    'member_pwa.background_color': '#06080d',
    'member_pwa.otp_enabled': true,
    'member_pwa.otp_provider': 'wasender',
    'member_pwa.otp_length': 6,
    'member_pwa.otp_expiry_minutes': 5,
    'member_pwa.otp_message': 'Your member login code is: {otp}',
    'member_pwa.otp_debug_mode': false,
    'member_pwa.otp_allow_dev_fallback': true,
    'member_pwa.show_qr': true,
    'member_pwa.qr_open_enabled': true,
    'employee_pwa.enabled': true,
    'employee_pwa.app_name': 'Employee Portal',
    'employee_pwa.app_name_ar': 'بوابة الموظف',
    'employee_pwa.subtitle': 'Employee Management',
    'employee_pwa.subtitle_ar': 'نظام إدارة الموظفين',
    'employee_pwa.theme_color': '#0c1017',
    'employee_pwa.accent_color': '#6366f1',
    'employee_pwa.background_color': '#06080d',
    'employee_pwa.otp_enabled': true,
    'employee_pwa.otp_provider': 'wasender',
    'employee_pwa.otp_length': 6,
    'employee_pwa.otp_expiry_minutes': 5,
    'employee_pwa.otp_message': 'Your employee login code is: {otp}',
    'employee_pwa.otp_debug_mode': false,
    'employee_pwa.otp_allow_dev_fallback': true,
    'employee_pwa.allow_clock': true,
    'employee_pwa.show_badge': true,
  };
  Object.entries(fallbackValues).forEach(([key, value]) => {
    if (valueMap[key] === undefined) valueMap[key] = value;
  });

  return { tabs: SETTINGS_TABS, sections, values: valueMap };
}

function registerCoreRoutes(app, moduleLoader) {
  const api = express.Router();
  const installer = new ModuleInstaller(moduleLoader);

  // ─── Restricted module frontend assets ──────────────────
  app.get('/module-assets/:module/*', authMiddleware, (req, res) => {
    const moduleName = decodeURIComponent(req.params.module || '');
    const rel = req.params[0] || '';
    if (!rel.startsWith('frontend/')) {
      return res.status(403).json({ success: false, error: 'Only frontend assets are exposed' });
    }

    const info = moduleLoader.getModuleInfo(moduleName);
    if (!info) return res.status(404).json({ success: false, error: 'Module not found' });

    const abs = path.resolve(config.paths.modules, info.path || moduleName, rel);
    const allowedRoot = path.resolve(config.paths.modules, info.path || moduleName, 'frontend');
    if (!abs.startsWith(allowedRoot) || !fs.existsSync(abs)) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    // Cache module assets aggressively in production (1 day).
    // Files are versioned implicitly by content: if a module is updated, the server restarts
    // and the file mtime changes. ETag still protects correctness.
    if (config.app.isProduction) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5min in dev
    }
    res.sendFile(abs);
  });

  // ─── Health ──────────────────────────────────────
  api.get('/health', (_req, res) => {
    res.json({ success: true, status: 'healthy', uptime: process.uptime(),
      modules: moduleLoader.getLoadedCount(), timestamp: new Date().toISOString(),
      memory: process.memoryUsage().rss, nodeVersion: process.version });
  });

  // ─── Database Backup ──────────────────────────────
  api.post('/system/backup', authMiddleware, requirePermission('system.health'), (req, res) => {
    try {
      const dest = database.backup();
      if (!dest) return res.status(500).json({ success: false, error: 'Backup failed or not configured' });
      auditService.log({ userId: req.user.id, action: 'system.backup', details: { path: dest }, ip: req.ip });
      res.json({ success: true, data: { path: dest, timestamp: new Date().toISOString() } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── System Diagnostics ──────────────────────────
  api.get('/system/diagnostics', authMiddleware, requirePermission('system.health'), (_req, res) => {
    const diag = moduleLoader.getSystemDiagnostics();
    const bootInfo = container.has('diagnostics') ? container.resolve('diagnostics') : {};
    res.json({ success: true, data: { ...diag, boot: bootInfo } });
  });

  api.get('/system/module-logs', authMiddleware, requirePermission('system.health'), (req, res) => {
    const { module, limit = 100 } = req.query;
    const logs = module ? moduleLoader.getModuleLogs(module, Number(limit)) : moduleLoader.getAllLogs(Number(limit));
    res.json({ success: true, data: logs });
  });

  // ─── Auth (rate-limited) ─────────────────────────
  const { authLimiter, otpSendLimiter, otpVerifyLimiter } = require('./middleware/rate-limiter');

  api.post('/auth/login', authLimiter, validateBody(schemas.login), async (req, res, next) => {
    try {
      const { username, password } = req.validatedBody;
      if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
      const result = await authService.login(username, password);
      res.cookie('token', result.token, config.jwt.cookieOptions);
      if (result.refreshToken) res.cookie('refreshToken', result.refreshToken, { ...config.jwt.cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
      auditService.log({ userId: result.user.id, action: 'login', ip: req.ip });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  });
  api.post('/auth/logout', (_req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: config.app.isProduction ? 'strict' : 'lax' });
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: config.app.isProduction ? 'strict' : 'lax' });
    res.json({ success: true });
  });
  api.get('/auth/me', authMiddleware, (req, res) => {
    const unread = notificationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: { ...req.user, unread_notifications: unread } });
  });
  api.post('/auth/change-password', authMiddleware, validateBody(schemas.changePassword), async (req, res, next) => {
    try {
      const { current_password, new_password } = req.validatedBody;
      if (!current_password || !new_password) return res.status(400).json({ success: false, error: 'Both current and new passwords required' });
      await authService.changePassword(req.user.id, current_password, new_password);
      auditService.log({ userId: req.user.id, action: 'password_changed', ip: req.ip });
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) { next(err); }
  });
  api.post('/auth/refresh', validateBody(schemas.refresh), async (req, res, next) => {
    try {
      const refreshToken = req.validatedBody?.refreshToken || req.cookies?.refreshToken;
      if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token required' });
      const result = await authService.refreshAccessToken(refreshToken);
      res.cookie('token', result.token, config.jwt.cookieOptions);
      res.cookie('refreshToken', result.refreshToken, { ...config.jwt.cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // ─── Users ───────────────────────────────────────
  api.get('/users', authMiddleware, requirePermission('users.view'), (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;
    let sql = `SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login, u.created_at, u.branch_id,
                      r.name as role, r.display_name as role_display
               FROM users u LEFT JOIN roles r ON r.id = u.role_id`;
    const params = [];
    if (search) { sql += ' WHERE (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?'; params.push(Number(limit), Number(offset));
    const users = database.getAll(sql, params);
    const cSql = search ? 'SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR email LIKE ? OR full_name LIKE ?' : 'SELECT COUNT(*) as total FROM users';
    const total = database.getOne(cSql, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);
    res.json({ success: true, data: users, meta: { total: total?.total || 0, page: Number(page), limit: Number(limit) } });
  });
  api.post('/users', authMiddleware, requirePermission('users.create'), async (req, res, next) => {
    try {
      const { username, email, password, full_name, role_id, branch_id } = req.body;
      if (!username || !email || !password) return res.status(400).json({ success: false, error: 'Required fields missing' });
      const id = await authService.createUser({ username, email, password, full_name, role_id, branch_id });
      res.json({ success: true, data: { id } });
    } catch (err) {
      if (err.message?.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'Already exists' });
      next(err);
    }
  });
  api.put('/users/:id', authMiddleware, requirePermission('users.edit'), (req, res) => {
    const { full_name, email, role_id, branch_id, is_active } = req.body;
    database.run('UPDATE users SET full_name=?, email=?, role_id=?, branch_id=?, is_active=?, updated_at=datetime("now") WHERE id=?',
      [full_name, email, role_id, branch_id, is_active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  });

  // ─── Roles & Permissions ─────────────────────────
  api.get('/roles', authMiddleware, (_req, res) => { res.json({ success: true, data: database.getAll('SELECT * FROM roles ORDER BY id') }); });
  api.get('/roles/:id/permissions', authMiddleware, (req, res) => {
    res.json({ success: true, data: database.getAll('SELECT p.* FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ?', [req.params.id]) });
  });
  api.put('/roles/:id/permissions', authMiddleware, requirePermission('roles.manage'), (req, res) => {
    database.run('DELETE FROM role_permissions WHERE role_id = ?', [req.params.id]);
    for (const pid of (req.body.permission_ids || [])) { database.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [req.params.id, pid]); }
    res.json({ success: true });
  });
  api.get('/permissions', authMiddleware, (_req, res) => { res.json({ success: true, data: database.getAll('SELECT * FROM permissions ORDER BY module, key') }); });

  // ─── Settings ────────────────────────────────────
  api.get('/settings', authMiddleware, (req, res) => {
    const rows = req.query.module ? settingsService.getByModule(req.query.module) : settingsService.getAll();
    res.json({ success: true, data: rows });
  });
  api.put('/settings', authMiddleware, requirePermission('settings.manage'), (req, res) => {
    if (req.body.settings && typeof req.body.settings === 'object') {
      settingsService.bulkSet(req.body.settings);
      // Keep the process timezone in sync so server-side date math (scheduler,
      // automation, reports) reflects the change immediately, without a restart.
      const tz = req.body.settings['app.timezone'];
      if (tz && typeof tz === 'string' && tz.trim()) process.env.TZ = tz.trim();
    }
    res.json({ success: true, data: buildSettingsSchema(moduleLoader) });
  });

  // ─── Frontend Registry ───────────────────────────
  api.get('/frontend/registry', authMiddleware, (req, res) => {
    const frontend = moduleLoader.getFrontendRegistry();
    res.json({ success: true, data: {
      modules: frontend.modules,
      menu: moduleLoader.getMenuItems(),
      widgets: moduleLoader.getDashboardWidgets(),
      profileTabs: moduleLoader.getMemberProfileTabs(),
      quickActions: moduleLoader.getQuickActions(),
      settingsSchema: buildSettingsSchema(moduleLoader),
    }});
  });

  // ─── Modules Management ──────────────────────────
  api.get('/modules', authMiddleware, (_req, res) => {
    const modules = moduleLoader.getLoadedModules();
    const dbModules = database.getAll('SELECT * FROM modules_registry ORDER BY name');
    const merged = dbModules.map(m => {
      const l = modules.find(lm => lm.name === m.name);
      return { ...m, status: l?.status || 'unknown', error: l?.error, core: l?.core,
        dependencies: l?.dependencies || [], migrations: l?.migrations, health: l?.health, loadTimeMs: l?.loadTimeMs, frontend: l?.frontend };
    });
    for (const lm of modules) { if (!merged.find(m => m.name === lm.name)) merged.push(lm); }
    res.json({ success: true, data: merged });
  });

  api.get('/modules/:name/logs', authMiddleware, (req, res) => {
    const logs = moduleLoader.getModuleLogs(req.params.name, Number(req.query.limit || 50));
    res.json({ success: true, data: logs });
  });

  api.put('/modules/:name/toggle', authMiddleware, requirePermission('modules.manage'), (req, res) => {
    moduleLoader.toggleModule(req.params.name, !!req.body.enabled);
    auditService.log({ userId: req.user.id, action: req.body.enabled ? 'module.enabled' : 'module.disabled', details: { module: req.params.name }, ip: req.ip });
    res.json({ success: true, message: 'Module toggled. Restart to apply changes.' });
  });

  api.get('/modules/:name/validate', authMiddleware, (req, res) => {
    const result = installer.validateModule(req.params.name);
    res.json({ success: true, data: result });
  });

  // ─── Module Upload & Install ─────────────────────
  api.post('/modules/upload', authMiddleware, requirePermission('modules.upload'), upload.single('module'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No zip file uploaded' });
    try {
      if (settingsService.get('system.module_uploads_enabled', true) === false) {
        return res.status(403).json({ success: false, error: 'Module uploads are disabled in settings' });
      }
      if (config.app.isProduction && config.security.allowTrustedModuleUploads !== true) {
        return res.status(403).json({ success: false, error: 'Module code uploads are blocked in production; only declarative/assets-only module packages are allowed' });
      }
      const result = await installer.installFromZip(req.file.path, { expressApp: app });
      auditService.log({ userId: req.user.id, action: 'module.uploaded', details: result, ip: req.ip });
      res.json({ success: result.success, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Notifications ──────────────────────────────
  api.get('/notifications', authMiddleware, (req, res) => { res.json({ success: true, data: notificationService.getForUser(req.user.id) }); });
  api.put('/notifications/read-all', authMiddleware, (req, res) => { notificationService.markAllRead(req.user.id); res.json({ success: true }); });

  // ─── Activity Logs ──────────────────────────────
  api.get('/activity', authMiddleware, requirePermission('activity.view'), (req, res) => {
    res.json({ success: true, data: auditService.getRecent(Number(req.query.limit || 50), Number(req.query.offset || 0)) });
  });

  // ─── Layout ─────────────────────────────────────
  api.get('/layout', authMiddleware, (req, res) => {
    const locale = settingsService.get('app.locale', 'en');
    const fallbackBranchId = settingsService.get('app.default_branch_id', null);
    const activeBranchId = req.user?.branch_id || fallbackBranchId || null;
    let branch = null;

    if (activeBranchId) {
      branch = database.getOne('SELECT id, name, name_ar, code, city FROM branches WHERE id = ?', [activeBranchId]);
    }

    const branchDisplayName = branch
      ? ((locale === 'ar' && branch.name_ar) ? branch.name_ar : branch.name)
      : settingsService.get('app.name', 'GymOS');

    res.json({ success: true, data: {
      menu: moduleLoader.getMenuItems(),
      widgets: moduleLoader.getDashboardWidgets(),
      cards: moduleLoader.getDashboardCards(),
      profileTabs: moduleLoader.getMemberProfileTabs(),
      quickActions: moduleLoader.getQuickActions(),
      settings: {
        name: settingsService.get('app.name', 'GymOS'),
        companyName: branchDisplayName,
        activeBranchId,
        activeBranch: branch,
        adminLogoUrl: settingsService.get('app.admin_logo_url', ''),
        loginLogoUrl: settingsService.get('app.login_logo_url', ''),
        locale,
        dir: settingsService.get('app.dir', 'ltr'),
        timezone: settingsService.get('app.timezone', 'Asia/Amman'),
        currency: settingsService.get('app.currency', 'JOD'),
        dateFormat: settingsService.get('app.date_format', 'YYYY-MM-DD'),
      },
      user: req.user
    }});
  });

  // ─── Dashboard ──────────────────────────────────
  api.get('/public/branding', (_req, res) => {
    res.json({ success: true, data: {
      name: settingsService.get('app.name', 'GymOS'),
      adminLogoUrl: settingsService.get('app.admin_logo_url', ''),
      loginLogoUrl: settingsService.get('app.login_logo_url', ''),
      locale: settingsService.get('app.locale', 'en'),
      dir: settingsService.get('app.dir', 'auto'),
    }});
  });

  const { cacheResponse } = require('./middleware/response-cache');

  api.get('/dashboard', authMiddleware, cacheResponse(15000), (req, res) => {
    const stats = { users: database.getOne('SELECT COUNT(*) as c FROM users WHERE is_active = 1')?.c || 0 };
    Object.assign(stats, eventBus.applyFilters('dashboard.stats', {}));
    const alerts = eventBus.applyFilters('dashboard.alerts', []);
    stats.alerts = Array.isArray(alerts) ? alerts : [];
    stats.recentActivity = auditService.getRecent(8);
    res.json({ success: true, data: stats });
  });

  // Lightweight counter endpoint for the bell icon — no dashboard alerts, no filters
  // Replaces the expensive dual-fetch (/api/notifications + /api/dashboard) that was polled every 30s
  api.get('/notifications/count', authMiddleware, (req, res) => {
    try {
      const unreadRow = database.getOne(
        'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0',
        [req.user?.id || 0]
      );
      res.json({ success: true, data: { unread: unreadRow?.c || 0 } });
    } catch (_) {
      res.json({ success: true, data: { unread: 0 } });
    }
  });

  // ─── Engines Info ───────────────────────────────
  api.get('/system/engines', authMiddleware, requirePermission('system.health'), (_req, res) => {
    const workflowEngine = container.resolve('workflowEngine');
    const rulesEngine = container.resolve('rulesEngine');
    const notifTemplates = container.resolve('notificationTemplates');
    res.json({ success: true, data: {
      workflows: workflowEngine.list(),
      rules: rulesEngine.list(),
      notificationTemplates: notifTemplates.list(),
    }});
  });

  // ─── Translations ─────────────────────────────
  api.get('/translations/:locale', (req, res) => {
    const locale = req.params.locale || 'en';
    const translations = moduleLoader.getTranslations(locale);
    res.json({ success: true, data: translations });
  });

  // ─── Settings Schema (fixed SaaS tabs) ─────────
  api.get('/settings/schema', authMiddleware, (_req, res) => {
    res.json({ success: true, data: buildSettingsSchema(moduleLoader) });
  });


  // ─── PWA API Endpoints ─────────────────────────
  const jwt = require('jsonwebtoken');

  function safePwaType(type) {
    return type === 'employee' ? 'employee' : 'member';
  }

  function pwaSettingKey(type, key) {
    return `${safePwaType(type)}_pwa.${key}`;
  }

  function getPwaConfig(type = 'member') {
    const isEmployee = safePwaType(type) === 'employee';
    const defaultName = isEmployee ? 'Employee Portal' : 'Member Portal';
    const defaultNameAr = isEmployee ? 'بوابة الموظف' : 'بوابة العضوية';
    const defaultSubtitle = isEmployee ? 'Employee Management' : 'Fitness Club';
    const defaultSubtitleAr = isEmployee ? 'نظام إدارة الموظفين' : 'نادي اللياقة';
    const prefix = `${safePwaType(type)}_pwa`;
    return {
      type: safePwaType(type),
      enabled: settingsService.get(`${prefix}.enabled`, true) !== false,
      appName: settingsService.get(`${prefix}.app_name`, defaultName),
      appNameAr: settingsService.get(`${prefix}.app_name_ar`, defaultNameAr),
      subtitle: settingsService.get(`${prefix}.subtitle`, defaultSubtitle),
      subtitleAr: settingsService.get(`${prefix}.subtitle_ar`, defaultSubtitleAr),
      themeColor: settingsService.get(`${prefix}.theme_color`, '#0c1017'),
      accentColor: settingsService.get(`${prefix}.accent_color`, '#6366f1'),
      backgroundColor: settingsService.get(`${prefix}.background_color`, '#06080d'),
      logoUrl: settingsService.get(`${prefix}.logo_url`, ''),
      icon192Url: settingsService.get(`${prefix}.icon_192_url`, isEmployee ? '/employee/icons/icon-192.png' : '/member/icons/icon-192.png'),
      icon512Url: settingsService.get(`${prefix}.icon_512_url`, isEmployee ? '/employee/icons/icon-512.png' : '/member/icons/icon-512.png'),
      locale: settingsService.get(`${prefix}.default_locale`, settingsService.get('app.locale', 'ar')),
      dir: settingsService.get(`${prefix}.default_direction`, settingsService.get('app.dir', 'rtl')),
      otpEnabled: settingsService.get(`${prefix}.otp_enabled`, true) !== false,
      otpProvider: settingsService.get(`${prefix}.otp_provider`, 'wasender'),
      otpLength: Math.max(4, Math.min(8, Number(settingsService.get(`${prefix}.otp_length`, 6) || 6))),
      otpExpiryMinutes: Math.max(1, Math.min(30, Number(settingsService.get(`${prefix}.otp_expiry_minutes`, 5) || 5))),
      otpMessage: settingsService.get(`${prefix}.otp_message`, isEmployee ? 'Your employee login code is: {otp}' : 'Your member login code is: {otp}'),
      otpDebugMode: settingsService.get(`${prefix}.otp_debug_mode`, false) === true,
      otpAllowDevFallback: settingsService.get(`${prefix}.otp_allow_dev_fallback`, false) === true,
      wasenderBaseUrl: settingsService.get('marketing.wesender_base_url', ''),
      wasenderToken: settingsService.get('marketing.wesender_token', ''),
      wasenderSession: settingsService.get('marketing.wesender_session', ''),
      wasenderSendPath: settingsService.get('marketing.wesender_send_path', '/api/send-message'),
      showQr: settingsService.get(`${prefix}.show_qr`, !isEmployee) === true,
      qrOpenEnabled: settingsService.get(`${prefix}.qr_open_enabled`, !isEmployee) === true,
      allowClock: settingsService.get(`${prefix}.allow_clock`, isEmployee) === true,
      showBadge: settingsService.get(`${prefix}.show_badge`, isEmployee) === true,
      version: '1.1.0'
    };
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function normalizePhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let digits = digitsOnly(raw);
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('962')) return `+${digits}`;
    if (digits.length === 9 && digits.startsWith('7')) return `+962${digits}`;
    if (digits.length === 10 && digits.startsWith('07')) return `+962${digits.slice(1)}`;
    return raw.startsWith('+') ? `+${digits}` : `+${digits}`;
  }

  function maskPhone(phone) {
    const digits = digitsOnly(phone);
    if (digits.length < 4) return phone;
    return `${digits.slice(0, 3)}*****${digits.slice(-2)}`;
  }

  function matchesNormalizedPhone(candidate, normalized) {
    if (!candidate || !normalized) return false;
    const cand = normalizePhone(candidate);
    if (cand === normalized) return true;
    const candDigits = digitsOnly(cand);
    const normDigits = digitsOnly(normalized);
    return !!candDigits && !!normDigits && candDigits.slice(-9) === normDigits.slice(-9);
  }

  function findMemberByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const tail = digitsOnly(normalized).slice(-9);
    const rows = database.getAll(
      `SELECT * FROM members
       WHERE phone = ? OR phone2 = ? OR phone LIKE ? OR phone2 LIKE ?
       ORDER BY id DESC LIMIT 30`,
      [normalized, normalized, `%${tail}`, `%${tail}`]
    );
    return rows.find((row) => matchesNormalizedPhone(row.phone, normalized) || matchesNormalizedPhone(row.phone2, normalized)) || null;
  }

  function findEmployeeByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const tail = digitsOnly(normalized).slice(-9);
    const rows = database.getAll(
      `SELECT e.*, d.name as department_name, p.name as position_name
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.department_id
       LEFT JOIN hr_positions p ON p.id = e.position_id
       WHERE e.mobile = ? OR e.phone = ? OR e.mobile LIKE ? OR e.phone LIKE ?
       ORDER BY e.id DESC LIMIT 30`,
      [normalized, normalized, `%${tail}`, `%${tail}`]
    );
    return rows.find((row) => matchesNormalizedPhone(row.mobile, normalized) || matchesNormalizedPhone(row.phone, normalized)) || null;
  }

  function buildPwaManifest(type = 'member') {
    const cfg = getPwaConfig(type);
    const isEmployee = cfg.type === 'employee';
    return {
      name: cfg.locale === 'ar' ? (cfg.appNameAr || cfg.appName) : (cfg.appName || cfg.appNameAr),
      short_name: cfg.locale === 'ar' ? (cfg.appNameAr || cfg.appName) : (cfg.appName || cfg.appNameAr),
      description: cfg.locale === 'ar' ? (cfg.subtitleAr || cfg.subtitle) : (cfg.subtitle || cfg.subtitleAr),
      start_url: isEmployee ? '/employee/' : '/member/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: cfg.themeColor,
      background_color: cfg.backgroundColor,
      dir: cfg.dir === 'auto' ? (cfg.locale === 'ar' ? 'rtl' : 'ltr') : cfg.dir,
      lang: cfg.locale || 'ar',
      icons: [
        { src: cfg.icon192Url, sizes: '192x192', type: 'image/png' },
        { src: cfg.icon512Url, sizes: '512x512', type: 'image/png' }
      ],
      categories: isEmployee ? ['business', 'productivity'] : ['health', 'fitness']
    };
  }

  function readPwaToken(req, expectedType) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) throw Object.assign(new Error('No token'), { status: 401 });
    const decoded = jwt.verify(token, config.jwt.secret);
    const actualType = decoded.type || decoded.personType;
    if (decoded.kind !== 'pwa' || decoded.tokenType === 'refresh' || (expectedType && actualType !== expectedType)) {
      throw Object.assign(new Error('Invalid token scope'), { status: 403 });
    }
    return { ...decoded, personId: decoded.personId || decoded.id, type: actualType };
  }

  function dateOnly(input) {
    if (!input) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(input))) return String(input);
    try { return new Date(input).toISOString().slice(0, 10); } catch (_) { return String(input).slice(0, 10); }
  }

  function localDbDate() {
    try { return database.getOne("SELECT date('now','localtime') AS d")?.d || dateOnly(new Date()); } catch (_) { return dateOnly(new Date()); }
  }

  const membershipState = require('./services/membership-state-service');

  function normalizeMembershipState(memberId) {
    return membershipState.syncMember(memberId);
  }

  function checkMemberAccessEligibility(memberId) {
    normalizeMembershipState(memberId);
    const member = database.getOne('SELECT * FROM members WHERE id = ?', [memberId]);
    if (!member) return { allowed: false, reason: 'Member not found' };
    if (member.status !== 'active') return { allowed: false, reason: `Member is ${member.status}` };

    normalizeMembershipState(memberId);

    const openVisit = database.getOne(`SELECT id FROM attendance_logs WHERE member_id = ? AND date(check_in) = date('now') AND check_out IS NULL AND was_denied = 0`, [memberId]);
    if (openVisit) return { allowed: false, reason: 'Member already checked in today', member };

    let membership = null;
    try {
      membership = database.getOne(`SELECT * FROM memberships WHERE member_id = ? AND status IN ('active','scheduled') ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, start_date ASC, end_date DESC LIMIT 1`, [memberId]);
    } catch (_) {}

    if (!membership) return { allowed: false, reason: 'No active membership', member };
    const today = localDbDate();
    if (membership.status === 'scheduled' || (membership.start_date && dateOnly(membership.start_date) > today)) {
      return { allowed: false, reason: 'Membership has not started yet', member, membership };
    }
    if (membership.end_date && dateOnly(membership.end_date) < today) return { allowed: false, reason: 'Membership expired', member, membership };
    if (membership.billing_type === 'sessions' && Number(membership.remaining_sessions || 0) <= 0) return { allowed: false, reason: 'No sessions remaining', member, membership };

    return { allowed: true, member, membership };
  }

  function registerMemberCheckin(memberId, membership, method = 'qr-pwa') {
    if (membership?.billing_type === 'sessions') {
      database.run('UPDATE memberships SET used_sessions = used_sessions + 1, remaining_sessions = remaining_sessions - 1, updated_at = datetime(\'now\') WHERE id = ?', [membership.id]);
    }
    const result = database.run(
      'INSERT INTO attendance_logs (member_id, membership_id, branch_id, method, checked_by, notes) VALUES (?,?,?,?,?,?)',
      [memberId, membership?.id || null, membership?.branch_id || null, method, null, 'PWA QR access']
    );
    database.run('UPDATE members SET last_visit_at = datetime(\'now\'), total_visits = total_visits + 1, updated_at = datetime(\'now\') WHERE id = ?', [memberId]);
    try {
      database.run('INSERT INTO member_timeline (member_id, event_type, title, description, meta) VALUES (?,?,?,?,?)', [
        memberId,
        'access_granted',
        'PWA QR Access Granted',
        'Member entered through the member PWA QR action.',
        JSON.stringify({ attendance_log_id: result.lastInsertRowid, method })
      ]);
    } catch (_) {}
    return result.lastInsertRowid;
  }

  function getAccessControlSettings() {
    return {
      gateProvider: settingsService.get('access_control.gate_provider', 'mock'),
      gateOpenUrl: settingsService.get('access_control.gate_open_url', ''),
      gateSecret: settingsService.get('access_control.gate_secret', ''),
      c3PanelIp: settingsService.get('access_control.c3_panel_ip', '192.168.1.201'),
      c3PanelPort: Number(settingsService.get('access_control.c3_panel_port', 4370) || 4370),
      c3DoorNumber: Number(settingsService.get('access_control.c3_door_number', 1) || 1),
      c3OpenDuration: Number(settingsService.get('access_control.c3_open_duration', 5) || 5),
    };
  }

  async function openC3Door(cfg) {
    const net = require('net');
    return new Promise((resolve) => {
      const ip = cfg.c3PanelIp || '192.168.1.201';
      const port = cfg.c3PanelPort || 4370;
      const door = cfg.c3DoorNumber || 1;
      const duration = cfg.c3OpenDuration || 5;
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(5000);
      socket.on('timeout', () => {
        if (!resolved) { resolved = true; socket.destroy(); resolve({ success: false, provider: 'c3-100', error: 'Connection timeout' }); }
      });
      socket.on('error', (err) => {
        if (!resolved) { resolved = true; socket.destroy(); resolve({ success: false, provider: 'c3-100', error: err.message }); }
      });
      socket.on('data', (data) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ success: true, provider: 'c3-100', response: data.toString(), ip, port, door, duration });
        }
      });
      socket.on('close', () => {
        if (!resolved) resolved = true, resolve({ success: true, provider: 'c3-100', message: 'Command sent', ip, port, door, duration });
      });
      socket.connect(port, ip, () => {
        socket.write(`ControlDevice:${door},1,1,${duration},0\r\n`);
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve({ success: true, provider: 'c3-100', message: 'Command sent', ip, port, door, duration });
          }
        }, 2000);
      });
    });
  }

  async function triggerGateOpen(meta = {}) {
    const cfg = getAccessControlSettings();

    if (cfg.gateProvider === 'c3-100') {
      return openC3Door(cfg);
    }

    if (cfg.gateProvider === 'webhook' && cfg.gateOpenUrl) {
      try {
        const response = await fetch(cfg.gateOpenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cfg.gateSecret ? { 'x-gate-secret': cfg.gateSecret } : {})
          },
          body: JSON.stringify({ timestamp: new Date().toISOString(), source: 'pwa', meta })
        });
        let payload = {};
        try { payload = await response.json(); } catch (_) {}
        return { success: response.ok, provider: 'webhook', status: response.status, response: payload };
      } catch (error) {
        return { success: false, provider: 'webhook', error: error.message };
      }
    }

    return { success: true, provider: 'mock', message: 'Mock gate open executed' };
  }

  function buildMemberDashboard(memberId) {
    normalizeMembershipState(memberId);
    const member = database.getOne('SELECT * FROM members WHERE id = ?', [memberId]);
    if (!member) return null;

    let memberships = [];
    try {
      memberships = database.getAll(`
        SELECT ms.*, mp.name as plan_display
        FROM memberships ms
        LEFT JOIN membership_plans mp ON mp.id = ms.plan_id
        WHERE ms.member_id=?
        ORDER BY
          CASE
            WHEN ms.status='active' THEN 0
            WHEN ms.status='frozen' THEN 1
            WHEN ms.status='scheduled' THEN 2
            WHEN ms.status='expired' THEN 3
            WHEN ms.status='cancelled' THEN 4
            ELSE 5
          END,
          date(COALESCE(ms.end_date, '9999-12-31')) DESC,
          datetime(ms.created_at) DESC,
          ms.id DESC
      `, [member.id]) || [];
    } catch (_) {}

    const today = localDbDate();
    memberships = (memberships || []).map((row) => {
      let effectiveStatus = row.status || 'inactive';
      if (effectiveStatus !== 'cancelled' && effectiveStatus !== 'frozen' && row.end_date && dateOnly(row.end_date) < today) effectiveStatus = 'expired';
      else if (effectiveStatus === 'scheduled' && (!row.start_date || dateOnly(row.start_date) <= today) && (!row.end_date || dateOnly(row.end_date) >= today)) effectiveStatus = 'active';
      return { ...row, effective_status: effectiveStatus, status: effectiveStatus };
    });

    let membership = memberships.find((row) => row.status === 'active')
      || memberships.find((row) => row.status === 'frozen')
      || memberships.find((row) => row.status === 'scheduled' && (!row.start_date || dateOnly(row.start_date) <= today))
      || memberships.find((row) => row.status === 'expired')
      || memberships[0]
      || null;

    let effectiveMemberStatus = member.status || 'inactive';
    if (memberships.some((row) => row.status === 'active')) effectiveMemberStatus = 'active';
    else if (memberships.some((row) => row.status === 'frozen')) effectiveMemberStatus = 'frozen';
    else if (memberships.some((row) => row.status === 'expired')) effectiveMemberStatus = 'inactive';

    // Respect a manual admin deactivation — do not auto-reactivate from an active membership.
    if (member.status === 'inactive' && effectiveMemberStatus === 'active') effectiveMemberStatus = 'inactive';

    if (effectiveMemberStatus !== member.status) {
      try {
        database.run(`UPDATE members SET status=?, updated_at=datetime('now') WHERE id=?`, [effectiveMemberStatus, member.id]);
        member.status = effectiveMemberStatus;
      } catch (_) {}
    }

    let attendance = [];
    try { attendance = database.getAll('SELECT * FROM attendance_logs WHERE member_id=? ORDER BY check_in DESC LIMIT 10', [member.id]); } catch (_) {}

    let daysLeft = null;
    if (membership?.end_date) {
      const diff = Math.ceil((new Date(dateOnly(membership.end_date) + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
      daysLeft = Math.max(0, Number.isFinite(diff) ? diff : 0);
      if (daysLeft <= 0 && membership.status !== 'frozen' && membership.status !== 'cancelled' && membership.status !== 'expired') {
        membership = { ...membership, status: 'expired' };
      }
    }

    const eligibility = checkMemberAccessEligibility(member.id);
    return {
      member,
      membership,
      memberships,
      attendance,
      daysLeft,
      qr_code: member.qr_code,
      accessAllowed: !!eligibility.allowed,
      accessReason: eligibility.reason || ''
    };
  }

  function buildEmployeeDashboard(employeeId) {
    let emp = null;
    try { emp = database.getOne('SELECT e.*, d.name as department_name, p.name as position_name FROM hr_employees e LEFT JOIN hr_departments d ON d.id=e.department_id LEFT JOIN hr_positions p ON p.id=e.position_id WHERE e.id=?', [employeeId]); } catch (_) {}
    if (!emp) try { emp = database.getOne('SELECT * FROM hr_employees WHERE id=?', [employeeId]); } catch (_) {}
    if (!emp) return null;
    let todayLog = null;
    try { todayLog = database.getOne("SELECT * FROM hr_attendance_logs WHERE employee_id=? AND attendance_date=date('now') ORDER BY id DESC LIMIT 1", [emp.id]); } catch (_) {}
    let monthLogs = [];
    try { monthLogs = database.getAll("SELECT * FROM hr_attendance_logs WHERE employee_id=? AND attendance_date >= date('now','start of month') ORDER BY attendance_date DESC", [emp.id]); } catch (_) {}
    const totalHours = monthLogs.reduce((a, l) => a + Number(l.worked_hours || 0), 0);
    let latestPayslip = null;
    try { latestPayslip = database.getOne('SELECT * FROM hr_payslips WHERE employee_id=? ORDER BY period_year DESC, period_month DESC LIMIT 1', [emp.id]); } catch (_) {}
    return { employee: emp, todayLog, monthLogs, totalHoursThisMonth: Number(totalHours.toFixed(1)), latestPayslip, badge_id: emp.badge_id };
  }

  const otpService = require('./services/otp-service');
  otpService.ensureTable();

  async function deliverOtp(type, phone, otp) {
    const cfg = getPwaConfig(type);
    const message = String(cfg.otpMessage || 'Your verification code is: {otp}').replace(/\{otp\}/g, otp);

    if (cfg.otpProvider === 'dev') {
      return { provider: 'dev', success: true };
    }

    const baseUrl = String(cfg.wasenderBaseUrl || '').trim().replace(/\/$/, '');
    const token = String(cfg.wasenderToken || '').trim();
    const sendPath = String(cfg.wasenderSendPath || '/api/send-message').trim() || '/api/send-message';
    const session = String(cfg.wasenderSession || '').trim();

    if (cfg.otpProvider === 'wasender') {
      if (!baseUrl || !token) {
        if (cfg.otpAllowDevFallback) return { provider: 'dev-fallback', success: true };
        throw new Error('Marketing WeSender settings are not configured');
      }

      const payload = { to: phone, text: message };
      if (session) payload.session = session;

      const response = await fetch(baseUrl + sendPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let parsed = {};
      try { parsed = text ? JSON.parse(text) : {}; } catch (_) { parsed = { raw: text }; }

      if (!response.ok) {
        const remoteError = parsed?.error || parsed?.message || parsed?.raw || `WeSender error ${response.status}`;
        if (cfg.otpAllowDevFallback) return { provider: 'dev-fallback', success: true, warning: String(remoteError) };
        throw new Error(String(remoteError));
      }

      return { provider: 'wesender', success: true, response: parsed };
    }

    if (cfg.otpAllowDevFallback) {
      return { provider: 'dev-fallback', success: true };
    }

    throw new Error('OTP provider is not configured');
  }

  api.get('/pwa/settings', (req, res) => {
    const type = safePwaType(req.query.type);
    res.json({ success: true, data: getPwaConfig(type) });
  });

  api.get('/pwa/config/:type', (req, res) => {
    const type = safePwaType(req.params.type);
    const cfg = getPwaConfig(type);
    if (!cfg.enabled) return res.status(403).json({ success: false, error: 'PWA disabled' });
    res.json({ success: true, data: cfg });
  });

  api.get('/pwa/manifest/:type', (req, res) => {
    const type = safePwaType(req.params.type);
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(buildPwaManifest(type));
  });

  api.post('/pwa/assets/:type/:asset', authMiddleware, requirePermission('settings.manage'), pwaAssetUpload.single('file'), (req, res) => {
    const rawType = String(req.params.type || '').toLowerCase();
    const type = rawType === 'app' ? 'app' : safePwaType(rawType);
    const asset = String(req.params.asset || '').toLowerCase();
    if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });

    const keyMap = type === 'app'
      ? {
          admin_logo: 'app.admin_logo_url',
          login_logo: 'app.login_logo_url',
        }
      : {
          logo: pwaSettingKey(type, 'logo_url'),
          icon192: pwaSettingKey(type, 'icon_192_url'),
          icon512: pwaSettingKey(type, 'icon_512_url'),
        };
    const settingKey = keyMap[asset];
    if (!settingKey) return res.status(400).json({ success: false, error: 'Invalid asset type' });

    const publicUrl = `/uploads/pwa/${req.file.filename}`;
    res.json({ success: true, data: { url: publicUrl, key: settingKey } });
  });

  api.post('/auth/otp/send', otpSendLimiter, validateBody(schemas.otpSend), async (req, res) => {
    try {
      const type = safePwaType(req.validatedBody?.type);
      const cfg = getPwaConfig(type);
      if (!cfg.enabled) return res.status(403).json({ success: false, error: 'App login is disabled' });
      if (!cfg.otpEnabled) return res.status(403).json({ success: false, error: 'OTP login is disabled' });

      const normalizedPhone = normalizePhone(req.validatedBody?.phone);
      if (!normalizedPhone) return res.status(400).json({ success: false, error: 'Valid phone is required' });

      // DB-backed send rate limit
      if (!otpService.canSend(type, normalizedPhone, cfg.otpSendLimitPerHour || 5)) {
        return res.status(429).json({ success: false, error: 'Too many OTP requests. Please try again later.' });
      }

      const person = type === 'employee' ? findEmployeeByPhone(normalizedPhone) : findMemberByPhone(normalizedPhone);
      if (!person) {
        return res.status(404).json({ success: false, error: type === 'employee' ? 'Employee not found with this phone' : 'Member not found with this phone' });
      }

      const otp = otpService.create({
        type, phone: normalizedPhone, personId: person.id,
        lengthOverride: cfg.otpLength, expiryMinutes: cfg.otpExpiryMinutes,
      });

      let delivery;
      try {
        delivery = await deliverOtp(type, normalizedPhone, otp);
      } catch (deliveryErr) {
        // Never leak raw gateway/provider errors (e.g. "invalid API key") to end users.
        // Log the real reason server-side; return a neutral, user-friendly message + code.
        console.error('[otp] delivery failed for', maskPhone(normalizedPhone), '—', deliveryErr && deliveryErr.message);
        return res.status(502).json({
          success: false,
          code: 'OTP_DELIVERY_FAILED',
          error: 'Could not send the verification code right now. Please try again shortly or contact the gym.',
          ...(cfg.otpDebugMode ? { dev_otp: otp, dev_reason: String((deliveryErr && deliveryErr.message) || '') } : {})
        });
      }

      res.json({
        success: true,
        data: {
          sent: true,
          provider: delivery.provider,
          maskedPhone: maskPhone(normalizedPhone),
          expiresInSeconds: cfg.otpExpiryMinutes * 60,
          ...(cfg.otpDebugMode ? { dev_otp: otp } : {})
        }
      });
    } catch (error) {
      console.error('[otp] send error:', error && error.message);
      res.status(500).json({ success: false, error: 'Verification code could not be sent. Please try again.' });
    }
  });

  api.post('/auth/otp/verify', otpVerifyLimiter, validateBody(schemas.otpVerify), (req, res) => {
    try {
      const type = safePwaType(req.validatedBody?.type);
      const normalizedPhone = normalizePhone(req.validatedBody?.phone);
      const providedOtp = String(req.validatedBody?.otp || '').trim();

      const result = otpService.verify({ type, phone: normalizedPhone, otp: providedOtp });

      if (!result.valid) {
        return res.status(400).json({ success: false, error: result.error });
      }

      const person = type === 'employee'
        ? (findEmployeeByPhone(normalizedPhone) || database.getOne('SELECT * FROM hr_employees WHERE id = ?', [result.personId]))
        : (findMemberByPhone(normalizedPhone) || database.getOne('SELECT * FROM members WHERE id = ?', [result.personId]));

      if (!person) return res.status(404).json({ success: false, error: type === 'employee' ? 'Employee not found' : 'Member not found' });

      const token = jwt.sign(
        { kind: 'pwa', tokenType: 'access', type, personId: person.id, phone: normalizedPhone },
        config.jwt.secret,
        { expiresIn: config.jwt.pwaExpiresIn }
      );
      const refreshToken = jwt.sign(
        { kind: 'pwa', tokenType: 'refresh', type, personId: person.id, phone: normalizedPhone },
        config.jwt.secret,
        { expiresIn: config.jwt.pwaRefreshExpiresIn }
      );

      res.json({ success: true, data: { token, refreshToken, type, expiresIn: config.jwt.pwaExpiresIn } });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message || 'OTP verification failed' });
    }
  });

  api.post('/auth/otp/refresh', validateBody(schemas.pwaRefresh), (req, res) => {
    try {
      const decoded = jwt.verify(req.validatedBody.refreshToken, config.jwt.secret);
      if (decoded.kind !== 'pwa' || decoded.tokenType !== 'refresh') {
        return res.status(401).json({ success: false, error: 'Invalid refresh token scope' });
      }
      const type = safePwaType(decoded.type || decoded.personType);
      const person = type === 'employee'
        ? database.getOne('SELECT id, mobile as phone FROM hr_employees WHERE id = ?', [decoded.personId])
        : database.getOne('SELECT id, phone FROM members WHERE id = ?', [decoded.personId]);
      if (!person) return res.status(404).json({ success: false, error: type === 'employee' ? 'Employee not found' : 'Member not found' });
      const token = jwt.sign(
        { kind: 'pwa', tokenType: 'access', type, personId: decoded.personId, phone: decoded.phone || person.phone || '' },
        config.jwt.secret,
        { expiresIn: config.jwt.pwaExpiresIn }
      );
      res.json({ success: true, data: { token, type, expiresIn: config.jwt.pwaExpiresIn } });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid refresh token' });
    }
  });

  api.get('/auth/csrf', (_req, res) => {
    res.json({ success: true, data: { csrfToken: _req.csrfToken || null, headerName: config.security.csrfHeaderName, cookieName: config.security.csrfCookieName } });
  });

  api.get('/pwa/member/dashboard', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const data = buildMemberDashboard(decoded.personId);
      if (!data) return res.status(404).json({ success: false, error: 'Member not found' });
      res.json({ success: true, data });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.get('/pwa/employee/dashboard', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'employee');
      const data = buildEmployeeDashboard(decoded.personId);
      if (!data) return res.status(404).json({ success: false, error: 'Employee not found' });
      res.json({ success: true, data });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.get('/pwa/employee/payslips', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'employee');
      let slips = [];
      try { slips = database.getAll('SELECT * FROM hr_payslips WHERE employee_id=? ORDER BY period_year DESC, period_month DESC', [decoded.personId]); } catch (_) {}
      res.json({ success: true, data: slips });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.get('/pwa/employee/attendance', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'employee');
      let logs = [];
      try { logs = database.getAll('SELECT * FROM hr_attendance_logs WHERE employee_id=? ORDER BY attendance_date DESC LIMIT 60', [decoded.personId]); } catch (_) {}
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.post('/pwa/employee/clock', (req, res) => {
    try {
      const cfg = getPwaConfig('employee');
      if (!cfg.allowClock) return res.status(403).json({ success: false, error: 'Clocking from employee app is disabled' });

      const decoded = readPwaToken(req, 'employee');
      const employee = database.getOne('SELECT * FROM hr_employees WHERE id = ?', [decoded.personId]);
      if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

      const action = String(req.body?.action || 'toggle').toLowerCase();
      const today = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const openLog = database.getOne('SELECT * FROM hr_attendance_logs WHERE employee_id = ? AND attendance_date = ? ORDER BY id DESC LIMIT 1', [employee.id, today]);

      if (action === 'out' || (action === 'toggle' && openLog?.check_in && !openLog?.check_out)) {
        if (!openLog || !openLog.check_in || openLog.check_out) {
          return res.status(400).json({ success: false, error: 'Employee is not clocked in' });
        }
        const workedHours = Math.max(0, (new Date(nowIso) - new Date(openLog.check_in)) / 3600000);
        database.run(
          `UPDATE hr_attendance_logs
             SET check_out = ?, worked_hours = ?, status = ?, source = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [nowIso, Number(workedHours.toFixed(2)), 'present', 'pwa', openLog.id]
        );
        return res.json({ success: true, data: { action: 'clock_out', id: openLog.id } });
      }

      if (openLog?.check_in && !openLog?.check_out) {
        return res.status(400).json({ success: false, error: 'Employee already clocked in' });
      }

      const result = database.run(
        `INSERT INTO hr_attendance_logs (employee_id, attendance_date, check_in, check_out, worked_hours, overtime_hours, status, source, note)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [employee.id, today, nowIso, null, 0, 0, 'present', 'pwa', 'Employee PWA clock-in']
      );
      res.json({ success: true, data: { action: 'clock_in', id: result.lastInsertRowid } });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message || 'Clock operation failed' });
    }
  });

  api.get('/pwa/member/subscriptions', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      normalizeMembershipState(decoded.personId);
      let subs = [];
      try {
        subs = database.getAll(`
          SELECT ms.*, mp.name as plan_display, mp.features as plan_features
          FROM memberships ms
          LEFT JOIN membership_plans mp ON mp.id=ms.plan_id
          WHERE ms.member_id=?
          ORDER BY
            CASE
              WHEN ms.status='active' THEN 0
              WHEN ms.status='frozen' THEN 1
              WHEN ms.status='scheduled' THEN 2
              WHEN ms.status='expired' THEN 3
              WHEN ms.status='cancelled' THEN 4
              ELSE 5
            END,
            date(COALESCE(ms.end_date, '9999-12-31')) DESC,
            datetime(ms.created_at) DESC,
            ms.id DESC
        `, [decoded.personId]);
      } catch (_) {}
      if (!subs.length) try { subs = database.getAll('SELECT * FROM memberships WHERE member_id=? ORDER BY id DESC', [decoded.personId]); } catch (_) {}

      const today = localDbDate();
      subs = (subs || []).map((row) => {
        let effectiveStatus = row.status || 'inactive';
        if (row.status !== 'cancelled' && row.status !== 'frozen' && row.end_date && dateOnly(row.end_date) < today) effectiveStatus = 'expired';
        else if (row.status === 'scheduled' && row.start_date && dateOnly(row.start_date) <= today && (!row.end_date || dateOnly(row.end_date) >= today)) effectiveStatus = 'active';
        let planFeatures = []; try { planFeatures = JSON.parse(row.plan_features || '[]'); } catch (_) {} if (!Array.isArray(planFeatures)) planFeatures = [];
        return { ...row, effective_status: effectiveStatus, status: effectiveStatus, plan_features: planFeatures };
      });

      res.json({ success: true, data: subs });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });


  api.get('/pwa/member/freezes', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      let rows = [];
      try {
        rows = database.getAll(`SELECT fr.*, ms.plan_name FROM freeze_requests fr LEFT JOIN memberships ms ON ms.id = fr.membership_id WHERE fr.member_id=? ORDER BY fr.created_at DESC`, [decoded.personId]);
      } catch (_) {}
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.post('/pwa/member/freezes/request', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const freezeSvc = container.resolve('membership-freeze.freeze-service');
      const { membership_id, start_date, end_date, reason = '' } = req.body || {};
      const membership = database.getOne('SELECT * FROM memberships WHERE id=? AND member_id=?', [membership_id, decoded.personId]);
      if (!membership) return res.status(404).json({ success:false, error:'Membership not found' });
      const result = freezeSvc.createRequest({ membershipId:Number(membership_id), startDate:start_date, endDate:end_date, reason, userId:decoded.personId, source:'pwa' });
      if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
      res.json({ success:true, data:result.data, requiresApproval: !!result.requiresApproval, requiresPayment: !!result.requiresPayment });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message || 'Freeze request failed' });
    }
  });

  api.post('/pwa/member/freezes/:id/request-unfreeze', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const freezeSvc = container.resolve('membership-freeze.freeze-service');
      const freeze = database.getOne('SELECT * FROM freeze_requests WHERE id=? AND member_id=?', [req.params.id, decoded.personId]);
      if (!freeze) return res.status(404).json({ success:false, error:'Freeze not found' });
      const result = freezeSvc.requestUnfreeze(Number(req.params.id), { reason:req.body?.reason || '', userId:decoded.personId, source:'member-pwa' });
      if (!result.success) return res.status(400).json({ success:false, error:result.errors.join('; ') });
      res.json({ success:true, data:result.data });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message || 'Unfreeze request failed' });
    }
  });


  api.get('/pwa/member/payments', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      let payments = [];
      try { payments = database.getAll('SELECT p.* FROM membership_payments p JOIN memberships ms ON ms.id=p.membership_id WHERE ms.member_id=? ORDER BY p.payment_date DESC', [decoded.personId]); } catch (_) {}
      res.json({ success: true, data: payments });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.get('/pwa/member/training', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      let profile = null;
      try { profile = database.getOne('SELECT tp.*, p.name as program_name, p.name_ar as program_name_ar, p.duration_weeks, p.days_per_week FROM training_member_profiles tp LEFT JOIN training_programs p ON p.id=tp.assigned_program_id WHERE tp.member_id=?', [decoded.personId]); } catch (_) {}
      let exercises = [];
      if (profile?.assigned_program_id) {
        try { exercises = database.getAll('SELECT pe.*, e.name, e.name_ar, e.muscle_group, e.image_url, e.video_url, c.icon as category_icon FROM training_program_exercises pe JOIN training_exercises e ON e.id=pe.exercise_id LEFT JOIN training_categories c ON c.id=e.category_id WHERE pe.program_id=? ORDER BY pe.day_number, pe.sort_order', [profile.assigned_program_id]); } catch (_) {}
      }
      let progress = [];
      try { progress = database.getAll('SELECT tp.*, e.name, e.name_ar FROM training_progress tp JOIN training_exercises e ON e.id=tp.exercise_id WHERE tp.member_id=? ORDER BY tp.completed_at DESC LIMIT 10', [decoded.personId]); } catch (_) {}
      res.json({ success: true, data: { enrollment: profile || null, exercises, progress } });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.get('/pwa/member/access', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      let logs = [];
      try { logs = database.getAll('SELECT * FROM attendance_logs WHERE member_id=? AND was_denied=0 ORDER BY check_in DESC LIMIT 60', [decoded.personId]); } catch (_) {}
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  // Rotating QR access token — minted SERVER-SIDE (the HMAC secret never leaves
  // the server). Matches modules/access-control/c3-tokens.js so the C3 bridge
  // validates it. The PWA fetches this and re-fetches each window (~30s).
  api.get('/pwa/member/access/token', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const secret = settingsService.get('access_control.c3_token_secret', '');
      if (!secret) {
        // Not configured yet → client falls back to the static qr_code.
        return res.json({ success: true, data: { configured: false } });
      }
      const memberId = decoded.personId;
      const now = Date.now();
      const window = accessTokens.windowOf(now);
      const token = accessTokens.issueToken(secret, memberId, now);
      const code24 = accessTokens.code24(secret, memberId, window);
      // 'code24' for Wiegand-26 lanes (Sunlux→C3); 'token' for HTTP/wedge readers.
      const mode = settingsService.get('access_control.c3_qr_mode', 'code24') === 'token' ? 'token' : 'code24';
      const qrValue = mode === 'token' ? token : String(code24);
      let eligible = true;
      try { eligible = !!checkMemberAccessEligibility(memberId).allowed; } catch (_) {}
      res.json({ success: true, data: {
        configured: true, mode, qrValue, code24, token, window, eligible,
        windowMs: accessTokens.WINDOW_MS,
        // ms until this window rolls over → when the client should re-fetch.
        refreshInMs: (window + 1) * accessTokens.WINDOW_MS - now,
      } });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message || 'Invalid token' });
    }
  });

  api.post('/pwa/member/access/open', async (req, res) => {
    try {
      const cfg = getPwaConfig('member');
      if (!cfg.qrOpenEnabled) return res.status(403).json({ success: false, error: 'Door open from member app is disabled' });

      const decoded = readPwaToken(req, 'member');
      const eligibility = checkMemberAccessEligibility(decoded.personId);
      if (!eligibility.allowed) return res.status(403).json({ success: false, error: eligibility.reason });

      const gate = await triggerGateOpen({
        memberId: eligibility.member.id,
        memberNo: eligibility.member.member_no,
        qrCode: eligibility.member.qr_code,
        source: 'member-pwa'
      });

      if (!gate.success) {
        return res.status(502).json({ success: false, error: gate.error || 'Door open request failed', data: { gate } });
      }

      const attendanceLogId = registerMemberCheckin(eligibility.member.id, eligibility.membership, 'qr-pwa');
      res.json({ success: true, data: { opened: true, attendanceLogId, gate } });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message || 'QR access failed' });
    }
  });

  // ─── Exercise Library for Member PWA (reads from training_exercises — 100% internal) ──
  const exerciseLib = require('../modules/training/services/exercise-library');
  const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

  // PWA: Get exercises with filters
  api.get('/pwa/member/exercises', (req, res) => {
    try {
      readPwaToken(req, 'member');
      let sql = `SELECT e.*, c.name as category_name, c.name_ar as category_name_ar, c.icon as category_icon
        FROM training_exercises e LEFT JOIN training_categories c ON c.id=e.category_id WHERE e.is_active=1`;
      const params = [];
      if (req.query.muscle) { sql += ' AND e.muscle_group LIKE ?'; params.push('%' + req.query.muscle + '%'); }
      if (req.query.equipment) { sql += ' AND e.equipment=?'; params.push(req.query.equipment); }
      if (req.query.level) { sql += ' AND (e.experience_level=? OR e.experience_level="all")'; params.push(req.query.level); }
      if (req.query.category_id) { sql += ' AND e.category_id=?'; params.push(req.query.category_id); }
      if (req.query.search) { sql += ' AND e.name LIKE ?'; params.push('%' + req.query.search + '%'); }
      sql += ' ORDER BY c.sort_order, e.name';
      const limit = Math.min(Number(req.query.limit || 100), 500);
      sql += ' LIMIT ?'; params.push(limit);
      if (req.query.offset) { sql += ' OFFSET ?'; params.push(Number(req.query.offset)); }

      const rows = database.getAll(sql, params).map(r => {
        try { r.instructionsArr = JSON.parse(r.instructions || '[]'); } catch(_) { r.instructionsArr = r.instructions ? [r.instructions] : []; }
        try { r.images = JSON.parse(r.images_json || '[]'); } catch(_) { r.images = []; }
        r.primaryMuscles = (r.muscle_group || '').split(',').map(s => s.trim()).filter(Boolean);
        r.secondaryMusclesArr = (r.secondary_muscles || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!r.image_url && r.images[0]) r.image_url = IMG_BASE + r.images[0];
        if (!r.thumbnail_url && r.images[1]) r.thumbnail_url = IMG_BASE + r.images[1];
        return r;
      });
      const total = database.getOne(`SELECT COUNT(*) as c FROM training_exercises WHERE is_active=1`)?.c || 0;
      res.json({ success: true, data: { exercises: rows, total, imageBase: IMG_BASE } });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message });
    }
  });

  // PWA: Get single exercise detail
  api.get('/pwa/member/exercises/:id', (req, res) => {
    try {
      readPwaToken(req, 'member');
      const r = database.getOne(`SELECT e.*, c.name as category_name, c.name_ar as category_name_ar, c.icon as category_icon
        FROM training_exercises e LEFT JOIN training_categories c ON c.id=e.category_id WHERE e.id=?`, [req.params.id]);
      if (!r) return res.status(404).json({ success: false, error: 'Exercise not found' });
      try { r.instructionsArr = JSON.parse(r.instructions || '[]'); } catch(_) { r.instructionsArr = []; }
      try { r.images = JSON.parse(r.images_json || '[]'); } catch(_) { r.images = []; }
      r.primaryMuscles = (r.muscle_group || '').split(',').map(s => s.trim()).filter(Boolean);
      r.secondaryMusclesArr = (r.secondary_muscles || '').split(',').map(s => s.trim()).filter(Boolean);
      res.json({ success: true, data: { ...r, imageBase: IMG_BASE } });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message });
    }
  });

  // PWA: Get filter options
  api.get('/pwa/member/exercise-filters', (req, res) => {
    try {
      readPwaToken(req, 'member');
      const muscles = [...new Set(database.getAll('SELECT DISTINCT muscle_group FROM training_exercises WHERE is_active=1').flatMap(r => (r.muscle_group||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort();
      const equipments = [...new Set(database.getAll('SELECT DISTINCT equipment FROM training_exercises WHERE is_active=1 AND equipment != ""').map(r => r.equipment))].sort();
      const levels = [...new Set(database.getAll('SELECT DISTINCT experience_level FROM training_exercises WHERE is_active=1').map(r => r.experience_level))].sort();
      const categories = database.getAll('SELECT * FROM training_categories WHERE is_active=1 ORDER BY sort_order');
      res.json({ success: true, data: {
        muscles, equipments, levels, categories,
        translations: { muscles: exerciseLib.muscleTranslations, equipment: exerciseLib.equipmentTranslations, categories: exerciseLib.categoryTranslations, levels: exerciseLib.levelTranslations },
        muscleGroups: exerciseLib.muscleGroups, equipmentList: exerciseLib.equipmentList, imageBase: IMG_BASE,
        total: database.getOne('SELECT COUNT(*) as c FROM training_exercises WHERE is_active=1')?.c || 0,
      }});
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message });
    }
  });

  // Member workout plans — save/load personal workout routines
  try {
    database.get().exec(`
      CREATE TABLE IF NOT EXISTS member_workout_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        name_ar TEXT DEFAULT '',
        description TEXT DEFAULT '',
        exercises_json TEXT DEFAULT '[]',
        schedule_json TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS member_workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        plan_id INTEGER,
        exercise_id TEXT NOT NULL,
        exercise_name TEXT DEFAULT '',
        sets_completed INTEGER DEFAULT 0,
        reps_json TEXT DEFAULT '[]',
        weight_json TEXT DEFAULT '[]',
        duration_seconds INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        completed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_mwp_member ON member_workout_plans(member_id);
      CREATE INDEX IF NOT EXISTS idx_mwl_member ON member_workout_logs(member_id);
    `);
    database.save();
  } catch (_) {}

  api.get('/pwa/member/workout-plans', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const plans = database.getAll('SELECT * FROM member_workout_plans WHERE member_id=? ORDER BY updated_at DESC', [decoded.personId]);
      res.json({ success: true, data: plans.map(p => ({ ...p, exercises: JSON.parse(p.exercises_json || '[]'), schedule: JSON.parse(p.schedule_json || '{}') })) });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message });
    }
  });

  api.post('/pwa/member/workout-plans', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const { name, name_ar, description, exercises, schedule } = req.body || {};
      if (!name) return res.status(400).json({ success: false, error: 'Plan name required' });
      const r = database.run(
        `INSERT INTO member_workout_plans (member_id, name, name_ar, description, exercises_json, schedule_json) VALUES (?,?,?,?,?,?)`,
        [decoded.personId, name, name_ar || '', description || '', JSON.stringify(exercises || []), JSON.stringify(schedule || {})]
      );
      res.json({ success: true, data: { id: r.lastInsertRowid } });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message });
    }
  });

  api.put('/pwa/member/workout-plans/:id', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const plan = database.getOne('SELECT * FROM member_workout_plans WHERE id=? AND member_id=?', [req.params.id, decoded.personId]);
      if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
      const { name, name_ar, description, exercises, schedule, is_active } = req.body || {};
      database.run(
        `UPDATE member_workout_plans SET name=?, name_ar=?, description=?, exercises_json=?, schedule_json=?, is_active=?, updated_at=datetime('now') WHERE id=?`,
        [name || plan.name, name_ar ?? plan.name_ar, description ?? plan.description, JSON.stringify(exercises || JSON.parse(plan.exercises_json || '[]')), JSON.stringify(schedule || JSON.parse(plan.schedule_json || '{}')), is_active ?? plan.is_active, plan.id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message });
    }
  });

  api.delete('/pwa/member/workout-plans/:id', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      database.run('DELETE FROM member_workout_plans WHERE id=? AND member_id=?', [req.params.id, decoded.personId]);
      res.json({ success: true });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message });
    }
  });

  // Workout session logging
  api.post('/pwa/member/workout-log', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const { plan_id, exercise_id, exercise_name, sets_completed, reps, weights, duration_seconds, notes } = req.body || {};
      if (!exercise_id) return res.status(400).json({ success: false, error: 'exercise_id required' });
      const r = database.run(
        `INSERT INTO member_workout_logs (member_id, plan_id, exercise_id, exercise_name, sets_completed, reps_json, weight_json, duration_seconds, notes) VALUES (?,?,?,?,?,?,?,?,?)`,
        [decoded.personId, plan_id || null, exercise_id, exercise_name || '', sets_completed || 0, JSON.stringify(reps || []), JSON.stringify(weights || []), duration_seconds || 0, notes || '']
      );
      res.json({ success: true, data: { id: r.lastInsertRowid } });
    } catch (error) {
      res.status(error.status || 400).json({ success: false, error: error.message });
    }
  });

  api.get('/pwa/member/workout-log', (req, res) => {
    try {
      const decoded = readPwaToken(req, 'member');
      const days = Math.min(Number(req.query.days || 30), 365);
      const logs = database.getAll(
        `SELECT * FROM member_workout_logs WHERE member_id=? AND completed_at >= datetime('now', '-${days} days') ORDER BY completed_at DESC`,
        [decoded.personId]
      );
      res.json({ success: true, data: logs.map(l => ({ ...l, reps: JSON.parse(l.reps_json || '[]'), weights: JSON.parse(l.weight_json || '[]') })) });
    } catch (error) {
      res.status(error.status || 401).json({ success: false, error: error.message });
    }
  });

  // ─── Exercise Instruction Translation Proxy ──────────
  api.post('/pwa/member/translate-instructions', async (req, res) => {
    try {
      readPwaToken(req, 'member');
      const { instructions, exerciseId } = req.body || {};
      if (!instructions?.length) return res.status(400).json({ success: false, error: 'No instructions' });

      // Check cache first
      const cached = database.getOne('SELECT translated FROM exercise_translations WHERE exercise_id = ?', [exerciseId]);
      if (cached?.translated) return res.json({ success: true, data: JSON.parse(cached.translated) });

      // Try Anthropic API
      const apiKey = settingsService.get('anthropic.api_key', process.env.ANTHROPIC_API_KEY || '');
      if (!apiKey) {
        // Fallback: basic term replacement
        const dict = [
          ['Starting position','وضع البداية'],['Repeat for the recommended amount of repetitions','كرر للعدد الموصى به من التكرارات'],
          ['Breathe out','ازفر'],['Breathe in','استنشق'],['Exhale','ازفر'],['Inhale','استنشق'],
          ['slowly','ببطء'],['Tip:','ملاحظة:'],['starting position','وضع البداية'],
        ];
        const translated = instructions.map(s => { let t=s; dict.forEach(([en,ar])=>{t=t.replace(new RegExp(en,'gi'),ar)}); return t; });
        return res.json({ success: true, data: translated, source: 'basic' });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 2000,
          messages: [{ role: 'user', content: `ترجم تعليمات التمرين الرياضي التالية إلى العربية بشكل طبيعي ومفهوم. أرجع JSON array فقط بدون أي نص إضافي أو markdown. كل عنصر هو ترجمة السطر المقابل بالترتيب:\n${JSON.stringify(instructions)}` }]
        })
      });
      const data = await response.json();
      const text = data?.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (Array.isArray(parsed) && parsed.length === instructions.length) {
        // Cache the translation
        try {
          database.get().exec(`CREATE TABLE IF NOT EXISTS exercise_translations (exercise_id TEXT PRIMARY KEY, translated TEXT, created_at TEXT DEFAULT (datetime('now')))`);
          database.run('INSERT OR REPLACE INTO exercise_translations (exercise_id, translated) VALUES (?, ?)', [exerciseId, JSON.stringify(parsed)]);
          database.save();
        } catch (_) {}
        return res.json({ success: true, data: parsed, source: 'ai' });
      }
      res.json({ success: true, data: instructions, source: 'fallback' });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  });

  app.use('/api', api);
}

module.exports = registerCoreRoutes;

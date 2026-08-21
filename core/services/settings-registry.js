class SettingsRegistry {
  constructor() {
    this.tabs = new Map();
    this.sections = new Map();
    this.sources = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.registerTab({
      key: 'general',
      label: 'General',
      labelAr: 'عام',
      description: 'Application identity, defaults, and branch behavior.',
      descriptionAr: 'هوية التطبيق والإعدادات الافتراضية وسلوك الفروع.',
      icon: 'settings',
      order: 10,
    });
    this.registerTab({
      key: 'localization',
      label: 'Localization',
      labelAr: 'اللغة والتوطين',
      description: 'Language, direction, timezone, and regional preferences.',
      descriptionAr: 'اللغة والاتجاه والمنطقة الزمنية والتفضيلات الإقليمية.',
      icon: 'globe',
      order: 20,
    });
    this.registerTab({
      key: 'system',
      label: 'System',
      labelAr: 'النظام',
      description: 'Runtime, logging, backups, and diagnostics controls.',
      descriptionAr: 'إعدادات التشغيل والسجلات والنسخ الاحتياطي والتشخيص.',
      icon: 'database',
      order: 30,
    });
    this.registerTab({
      key: 'notifications',
      label: 'Notifications',
      labelAr: 'الإشعارات',
      description: 'Notification defaults and delivery behavior.',
      descriptionAr: 'إعدادات الإشعارات الافتراضية وآلية الإرسال.',
      icon: 'bell',
      order: 40,
    });
    this.registerTab({
      key: 'modules',
      label: 'Modules',
      labelAr: 'الوحدات',
      description: 'Module-level extension points and injected settings.',
      descriptionAr: 'نقاط التوسعة الخاصة بالوحدات والإعدادات المحقونة.',
      icon: 'puzzle',
      order: 50,
    });

    this.registerSection({
      key: 'app_identity',
      tab: 'general',
      label: 'Workspace Defaults',
      labelAr: 'إعدادات بيئة العمل',
      description: 'Core application identity and default operational assignments.',
      descriptionAr: 'هوية التطبيق الأساسية والتعيينات التشغيلية الافتراضية.',
      icon: 'building',
      module: 'core',
      order: 10,
      fields: [
        {
          key: 'application_name',
          path: 'general.applicationName',
          storageKey: 'app.name',
          label: 'Application Name',
          labelAr: 'اسم التطبيق',
          description: 'Displayed in the browser title and across the admin shell.',
          descriptionAr: 'يظهر في عنوان المتصفح وواجهة النظام.',
          type: 'text',
          default: 'GymOS',
          placeholder: 'GymOS',
        },
        {
          key: 'default_branch',
          path: 'general.defaultBranchId',
          storageKey: 'app.default_branch_id',
          label: 'Default Branch',
          labelAr: 'الفرع الافتراضي',
          description: 'Used as the default branch in forms and operational flows.',
          descriptionAr: 'يُستخدم كفرع افتراضي في النماذج والعمليات.',
          type: 'searchable-select',
          source: 'branches',
          valueType: 'number',
          allowEmpty: true,
          emptyLabel: 'No default branch',
          emptyLabelAr: 'بدون فرع افتراضي',
          default: null,
        },
        {
          key: 'default_trainer',
          path: 'general.defaultTrainerId',
          storageKey: 'app.default_trainer_id',
          label: 'Default Trainer',
          labelAr: 'المدرب الافتراضي',
          description: 'Preselected trainer for trainer-related workflows.',
          descriptionAr: 'المدرب المحدد مسبقاً للعمليات المرتبطة بالمدربين.',
          type: 'searchable-select',
          source: 'trainers',
          valueType: 'number',
          allowEmpty: true,
          emptyLabel: 'No default trainer',
          emptyLabelAr: 'بدون مدرب افتراضي',
          default: null,
        },
        {
          key: 'enable_multi_branch',
          path: 'general.enableMultiBranch',
          storageKey: 'app.multi_branch',
          label: 'Enable Multi-Branch',
          labelAr: 'تفعيل تعدد الفروع',
          description: 'Enables branch-aware behavior across supported modules.',
          descriptionAr: 'يفعل السلوك المرتبط بالفروع عبر الوحدات المدعومة.',
          type: 'toggle',
          default: false,
        },
      ],
    });

    this.registerSection({
      key: 'regional_preferences',
      tab: 'localization',
      label: 'Regional Preferences',
      labelAr: 'التفضيلات الإقليمية',
      description: 'Middle East optimized localization, formatting, and language behavior.',
      descriptionAr: 'توطين محسّن للشرق الأوسط مع اللغة والصيغ والإعدادات الإقليمية.',
      icon: 'globe',
      module: 'core',
      order: 10,
      fields: [
        {
          key: 'language',
          path: 'localization.language',
          storageKey: 'app.locale',
          label: 'Language',
          labelAr: 'اللغة',
          description: 'Primary interface language.',
          descriptionAr: 'لغة واجهة النظام الأساسية.',
          type: 'select',
          default: 'en',
          options: [
            { value: 'ar', label: 'Arabic', labelAr: 'العربية' },
            { value: 'en', label: 'English', labelAr: 'الإنجليزية' },
          ],
        },
        {
          key: 'text_direction',
          path: 'localization.direction',
          storageKey: 'app.dir',
          label: 'Text Direction',
          labelAr: 'اتجاه النص',
          description: 'Auto follows the selected language unless manually overridden.',
          descriptionAr: 'الوضع التلقائي يتبع اللغة المختارة ما لم يتم التعديل يدوياً.',
          type: 'select',
          default: 'auto',
          options: [
            { value: 'auto', label: 'Auto', labelAr: 'تلقائي' },
            { value: 'rtl', label: 'RTL', labelAr: 'من اليمين إلى اليسار' },
            { value: 'ltr', label: 'LTR', labelAr: 'من اليسار إلى اليمين' },
          ],
        },
        {
          key: 'timezone',
          path: 'localization.timezone',
          storageKey: 'app.timezone',
          label: 'Timezone',
          labelAr: 'المنطقة الزمنية',
          description: 'Used for schedules, timestamps, and operational reporting.',
          descriptionAr: 'تُستخدم للمواعيد والطوابع الزمنية والتقارير التشغيلية.',
          type: 'searchable-select',
          source: 'timezones',
          default: 'Asia/Amman',
        },
        {
          key: 'date_format',
          path: 'localization.dateFormat',
          storageKey: 'app.date_format',
          label: 'Date Format',
          labelAr: 'تنسيق التاريخ',
          description: 'Default display format for dates across the application.',
          descriptionAr: 'تنسيق عرض التاريخ الافتراضي في النظام.',
          type: 'select',
          default: 'YYYY-MM-DD',
          options: [
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', labelAr: 'YYYY-MM-DD' },
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', labelAr: 'DD/MM/YYYY' },
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', labelAr: 'MM/DD/YYYY' },
          ],
        },
        {
          key: 'currency',
          path: 'localization.currency',
          storageKey: 'app.currency',
          label: 'Currency',
          labelAr: 'العملة',
          description: 'Default operational currency.',
          descriptionAr: 'العملة التشغيلية الافتراضية.',
          type: 'select',
          default: 'JOD',
          options: [
            { value: 'USD', label: 'USD', labelAr: 'دولار أمريكي' },
            { value: 'SAR', label: 'SAR', labelAr: 'ريال سعودي' },
            { value: 'AED', label: 'AED', labelAr: 'درهم إماراتي' },
            { value: 'JOD', label: 'JOD', labelAr: 'دينار أردني' },
            { value: 'KWD', label: 'KWD', labelAr: 'دينار كويتي' },
            { value: 'QAR', label: 'QAR', labelAr: 'ريال قطري' },
          ],
        },
      ],
    });

    this.registerSection({
      key: 'runtime_controls',
      tab: 'system',
      label: 'Runtime Controls',
      labelAr: 'التحكم بالتشغيل',
      description: 'Controls for backup cadence, logs, and debug visibility.',
      descriptionAr: 'إعدادات النسخ الاحتياطي والسجلات ووضع التصحيح.',
      icon: 'database',
      module: 'core',
      order: 10,
      fields: [
        {
          key: 'auto_backup',
          path: 'system.autoBackup',
          storageKey: 'system.auto_backup',
          label: 'Auto Backup',
          labelAr: 'النسخ الاحتياطي التلقائي',
          description: 'Enables scheduled database backup behavior.',
          descriptionAr: 'يفعل النسخ الاحتياطي المجدول لقاعدة البيانات.',
          type: 'toggle',
          default: false,
        },
        {
          key: 'backup_interval',
          path: 'system.backupInterval',
          storageKey: 'system.backup_interval',
          label: 'Backup Interval',
          labelAr: 'فترة النسخ الاحتياطي',
          description: 'Select how often automatic backups should run.',
          descriptionAr: 'حدد عدد مرات تشغيل النسخ الاحتياطي التلقائي.',
          type: 'select',
          default: 'weekly',
          options: [
            { value: 'daily', label: 'Daily', labelAr: 'يومي' },
            { value: 'weekly', label: 'Weekly', labelAr: 'أسبوعي' },
            { value: 'monthly', label: 'Monthly', labelAr: 'شهري' },
          ],
        },
        {
          key: 'debug_mode',
          path: 'system.debugMode',
          storageKey: 'system.debug_mode',
          label: 'Debug Mode',
          labelAr: 'وضع التصحيح',
          description: 'Shows verbose diagnostics intended for administrators.',
          descriptionAr: 'يعرض معلومات تشخيصية موسعة للمسؤولين.',
          type: 'toggle',
          default: false,
        },
        {
          key: 'log_level',
          path: 'system.logLevel',
          storageKey: 'system.log_level',
          label: 'Log Level',
          labelAr: 'مستوى السجل',
          description: 'Controls the verbosity of system logging.',
          descriptionAr: 'يتحكم بدرجة تفصيل سجلات النظام.',
          type: 'select',
          default: 'info',
          options: [
            { value: 'error', label: 'Error', labelAr: 'أخطاء' },
            { value: 'warn', label: 'Warn', labelAr: 'تحذير' },
            { value: 'info', label: 'Info', labelAr: 'معلومات' },
            { value: 'debug', label: 'Debug', labelAr: 'تصحيح' },
          ],
        },
      ],
    });

    this.registerSection({
      key: 'notification_defaults',
      tab: 'notifications',
      label: 'Delivery Defaults',
      labelAr: 'إعدادات الإرسال الافتراضية',
      description: 'Base notification controls ready for future channels and workflows.',
      descriptionAr: 'إعدادات أساسية جاهزة لقنوات وسير عمل الإشعارات المستقبلية.',
      icon: 'bell',
      module: 'core',
      order: 10,
      fields: [
        {
          key: 'in_app_notifications',
          path: 'notifications.inAppEnabled',
          storageKey: 'notifications.in_app_enabled',
          label: 'In-App Notifications',
          labelAr: 'إشعارات داخل التطبيق',
          description: 'Enables the in-app notification center by default.',
          descriptionAr: 'يفعل مركز الإشعارات داخل التطبيق بشكل افتراضي.',
          type: 'toggle',
          default: true,
        },
        {
          key: 'default_channel',
          path: 'notifications.defaultChannel',
          storageKey: 'notifications.default_channel',
          label: 'Default Channel',
          labelAr: 'القناة الافتراضية',
          description: 'Preferred delivery channel for future notification workflows.',
          descriptionAr: 'القناة المفضلة لعمليات الإشعار المستقبلية.',
          type: 'select',
          default: 'in_app',
          options: [
            { value: 'in_app', label: 'In-App', labelAr: 'داخل التطبيق' },
            { value: 'email', label: 'Email', labelAr: 'البريد الإلكتروني' },
            { value: 'sms', label: 'SMS', labelAr: 'رسائل قصيرة' },
            { value: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب' },
          ],
        },
      ],
    });

    this.registerSection({
      key: 'module_extensions',
      tab: 'modules',
      label: 'Extension Model',
      labelAr: 'نموذج التوسعة',
      description: 'Controls how modules can contribute their own settings sections.',
      descriptionAr: 'يتحكم بكيفية إضافة الوحدات لأقسام إعداداتها الخاصة.',
      icon: 'puzzle',
      module: 'core',
      order: 10,
      fields: [
        {
          key: 'allow_module_settings',
          path: 'modules.allowModuleSettings',
          storageKey: 'modules.allow_settings_extensions',
          label: 'Allow Module Settings',
          labelAr: 'السماح بإعدادات الوحدات',
          description: 'Allows installed modules to inject settings tabs or sections.',
          descriptionAr: 'يسمح للوحدات المثبتة بإضافة تبويبات أو أقسام إعدادات.',
          type: 'toggle',
          default: true,
        },
        {
          key: 'module_injection_mode',
          path: 'modules.injectionMode',
          storageKey: 'modules.settings_injection_mode',
          label: 'Injection Mode',
          labelAr: 'وضع الحقن',
          description: 'Defines whether modules add sections only or full tabs as well.',
          descriptionAr: 'يحدد ما إذا كانت الوحدات تضيف أقساماً فقط أو تبويبات كاملة أيضاً.',
          type: 'select',
          default: 'tabs_and_sections',
          options: [
            { value: 'sections_only', label: 'Sections Only', labelAr: 'أقسام فقط' },
            { value: 'tabs_and_sections', label: 'Tabs and Sections', labelAr: 'تبويبات وأقسام' },
          ],
        },
      ],
    });

    // ── Integrations Tab (Wasender, PWA) ──
    this.registerTab({
      key: 'integrations',
      label: 'Integrations',
      labelAr: 'التكاملات',
      description: 'WhatsApp OTP, PWA apps, and external service connections.',
      descriptionAr: 'إعدادات واتساب OTP وتطبيقات الجوال والخدمات الخارجية.',
      icon: 'puzzle',
      order: 45,
    });

    this.registerSection({
      key: 'wasender_whatsapp',
      tab: 'integrations',
      label: 'WhatsApp OTP (Wasender)',
      labelAr: 'واتساب OTP (Wasender)',
      description: 'Send OTP verification codes to employees and members via WhatsApp.',
      descriptionAr: 'إرسال رموز التحقق OTP للموظفين والأعضاء عبر واتساب.',
      icon: 'megaphone',
      module: 'core',
      order: 10,
      fields: [
        {
          key: 'wasender_api_key',
          path: 'wasender.apiKey',
          storageKey: 'wasender.api_key',
          label: 'Wasender API Key',
          labelAr: 'مفتاح API لـ Wasender',
          description: 'Your Wasender API key for sending WhatsApp messages.',
          descriptionAr: 'مفتاح API الخاص بك من Wasender لإرسال رسائل واتساب.',
          type: 'string',
          default: '',
        },
        {
          key: 'wasender_api_url',
          path: 'wasender.apiUrl',
          storageKey: 'wasender.api_url',
          label: 'Wasender API URL',
          labelAr: 'رابط API لـ Wasender',
          description: 'API endpoint URL. Default: https://api.wasender.net/v1/message/send',
          descriptionAr: 'رابط نقطة النهاية. الافتراضي: https://api.wasender.net/v1/message/send',
          type: 'string',
          default: 'https://api.wasender.net/v1/message/send',
        },
        {
          key: 'wasender_otp_message',
          path: 'wasender.otpMessage',
          storageKey: 'wasender.otp_message',
          label: 'OTP Message Template',
          labelAr: 'قالب رسالة OTP',
          description: 'Message template. Use {otp} for the code. Example: Your code is: {otp}',
          descriptionAr: 'قالب الرسالة. استخدم {otp} للرمز. مثال: رمز التحقق الخاص بك: {otp}',
          type: 'string',
          default: 'Your GymOS verification code is: {otp}',
        },
      ],
    });

    this.registerSection({
      key: 'pwa_settings',
      tab: 'integrations',
      label: 'PWA Mobile Apps',
      labelAr: 'تطبيقات الجوال PWA',
      description: 'Settings for the Employee and Member mobile apps.',
      descriptionAr: 'إعدادات تطبيقات الموظف والعضو للجوال.',
      icon: 'activity',
      module: 'core',
      order: 20,
      fields: [
        {
          key: 'pwa_employee_enabled',
          path: 'pwa.employeeEnabled',
          storageKey: 'pwa.employee_enabled',
          label: 'Employee App Enabled',
          labelAr: 'تفعيل تطبيق الموظف',
          type: 'toggle',
          default: true,
        },
        {
          key: 'pwa_member_enabled',
          path: 'pwa.memberEnabled',
          storageKey: 'pwa.member_enabled',
          label: 'Member App Enabled',
          labelAr: 'تفعيل تطبيق العضو',
          type: 'toggle',
          default: true,
        },
      ],
    });
  }

  registerTab(tab) {
    if (!tab || !tab.key) throw new Error('Tab key is required');
    const existing = this.tabs.get(tab.key) || {};
    this.tabs.set(tab.key, { ...existing, ...tab });
  }

  registerSection(section) {
    if (!section || !section.key) throw new Error('Section key is required');
    if (!section.tab) throw new Error(`Section "${section.key}" must specify a tab`);
    const normalizedFields = (section.fields || []).map((field) => ({
      module: section.module || 'core',
      ...field,
    }));
    const existing = this.sections.get(section.key) || {};
    this.sections.set(section.key, { ...existing, ...section, fields: normalizedFields });
  }

  registerSource(name, resolver) {
    if (!name || typeof resolver !== 'function') throw new Error('Source name and resolver are required');
    this.sources.set(name, resolver);
  }

  getTabs() {
    return Array.from(this.tabs.values()).sort((a, b) => (a.order || 999) - (b.order || 999));
  }

  getSections(tab = null) {
    const sections = Array.from(this.sections.values()).sort((a, b) => (a.order || 999) - (b.order || 999));
    return tab ? sections.filter((s) => s.tab === tab) : sections;
  }

  getFields() {
    return this.getSections().flatMap((section) => section.fields || []);
  }

  getFieldByStorageKey(storageKey) {
    return this.getFields().find((field) => field.storageKey === storageKey) || null;
  }

  getFieldByPath(path) {
    return this.getFields().find((field) => field.path === path) || null;
  }

  getSourceResolvers() {
    return this.sources;
  }
}

module.exports = new SettingsRegistry();

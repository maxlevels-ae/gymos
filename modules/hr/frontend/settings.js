GymOS.registerSettingsSection({
  id:'hr-general-settings',
  module:'hr',
  tab:'modules',
  title:'HR Configuration',
  titleAr:'إعدادات الموارد البشرية',
  description:'Odoo-style HR behavior, numbering, approvals, payroll cycle, and onboarding defaults.',
  descriptionAr:'سلوك الموارد البشرية على نمط أودو بما يشمل الترقيم والموافقات ودورة الرواتب وإعدادات التعيين.',
  order:120,
  fields:[
    { key:'hr.employee_prefix', type:'text', label:'Employee Number Prefix', labelAr:'بادئة رقم الموظف' },
    { key:'hr.default_probation_days', type:'text', label:'Default Probation Days', labelAr:'أيام التجربة الافتراضية' },
    { key:'hr.leave_requires_approval', type:'toggle', label:'Leave Requires Approval', labelAr:'الإجازات تتطلب موافقة' },
    { key:'hr.attendance_mode', type:'select', label:'Attendance Mode', labelAr:'طريقة الحضور', options:[
      { value:'manual', label:'Manual', labelAr:'يدوي' },
      { value:'kiosk', label:'Kiosk', labelAr:'كشك' },
      { value:'hybrid', label:'Hybrid', labelAr:'مختلط' }
    ] },
    { key:'hr.payroll_cycle', type:'select', label:'Payroll Cycle', labelAr:'دورة الرواتب', options:[
      { value:'monthly', label:'Monthly', labelAr:'شهري' },
      { value:'biweekly', label:'Biweekly', labelAr:'نصف شهري' },
      { value:'weekly', label:'Weekly', labelAr:'أسبوعي' }
    ] },
    { key:'hr.default_work_days', type:'text', label:'Default Work Days / Week', labelAr:'أيام العمل الافتراضية في الأسبوع' },
    { key:'hr.auto_create_contract', type:'toggle', label:'Auto-create Draft Contract', labelAr:'إنشاء عقد مسودة تلقائياً' },
    { key:'hr.onboarding_checklist', type:'text', label:'Default Onboarding Checklist', labelAr:'قائمة التهيئة الافتراضية' }
  ]
});

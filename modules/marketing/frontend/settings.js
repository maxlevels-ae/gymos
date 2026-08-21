GymOS.registerSettingsSection({
  id:'marketing-whatsapp-settings',
  module:'marketing',
  tab:'modules',
  title:'Marketing / WhatsApp',
  titleAr:'التسويق / واتساب',
  order:170,
  fields:[
    { key:'marketing.provider', type:'text', label:'Provider', labelAr:'مزود الخدمة' },
    { key:'marketing.wesender_base_url', type:'text', label:'Base URL', labelAr:'الرابط الأساسي' },
    { key:'marketing.wesender_token', type:'text', label:'API Token', labelAr:'رمز API' },
    { key:'marketing.wesender_session', type:'text', label:'Session', labelAr:'الجلسة' },
    { key:'marketing.default_country_code', type:'text', label:'Default Country Code', labelAr:'رمز الدولة الافتراضي' },
    { key:'marketing.expiry_reminder_days', type:'text', label:'Expiry Reminder Days', labelAr:'أيام تذكير انتهاء الاشتراك' },
    { key:'marketing.payment_due_days', type:'text', label:'Payment Due Reminder Days', labelAr:'أيام تذكير الاستحقاق' },
    { key:'marketing.daily_send_limit', type:'text', label:'Daily Send Limit', labelAr:'حد الإرسال اليومي' },
    { key:'marketing.auto_sync_contacts', type:'toggle', label:'Auto-sync Contacts', labelAr:'مزامنة جهات الاتصال تلقائياً' },
    { key:'marketing.enable_birthday_automation', type:'toggle', label:'Birthday Automation', labelAr:'أتمتة أعياد الميلاد' },
    { key:'marketing.enable_expiry_automation', type:'toggle', label:'Expiry Automation', labelAr:'أتمتة انتهاء الاشتراكات' },
    { key:'marketing.enable_payment_automation', type:'toggle', label:'Payment Automation', labelAr:'أتمتة الدفعات' }
  ]
});

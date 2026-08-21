GymOS.registerSettingsSection({
  id:'purchase-general', module:'purchase', tab:'modules', title:'Purchase Settings', titleAr:'إعدادات المشتريات', order:160,
  fields:[
    { key:'purchase.po_prefix',           type:'text',   label:'PO Number Prefix',        labelAr:'بادئة رقم أمر الشراء' },
    { key:'purchase.rfq_prefix',          type:'text',   label:'RFQ Number Prefix',        labelAr:'بادئة رقم طلب عرض السعر' },
    { key:'purchase.default_currency',    type:'text',   label:'Default Currency',         labelAr:'العملة الافتراضية' },
    { key:'purchase.require_approval',    type:'toggle', label:'Require PO Approval',      labelAr:'طلب موافقة على أوامر الشراء' },
    { key:'purchase.auto_create_bill',    type:'toggle', label:'Auto-create Bill on Receipt', labelAr:'إنشاء فاتورة تلقائياً عند الاستلام' },
    { key:'purchase.lock_confirmed_po',   type:'toggle', label:'Lock Confirmed POs',       labelAr:'قفل أوامر الشراء المؤكدة' },
  ]
});

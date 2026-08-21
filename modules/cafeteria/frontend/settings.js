GymOS.registerSettingsSection({
  id:'cafeteria-general',
  module:'cafeteria',
  tab:'modules',
  title:'Cafeteria POS Policy',
  titleAr:'سياسات نقطة بيع الكافتيريا',
  description:'Warehouse, session, refund and payment controls.',
  descriptionAr:'إعدادات المستودع والجلسات والاسترجاع وطرق الدفع.',
  order:160,
  fields:[
    { key:'cafeteria.default_warehouse_id', type:'text', label:'Default Warehouse ID', labelAr:'معرف المستودع الافتراضي' },
    { key:'cafeteria.allow_negative_stock', type:'toggle', label:'Allow Negative Stock', labelAr:'السماح بمخزون سالب' },
    { key:'cafeteria.allow_sale_without_session', type:'toggle', label:'Allow Sale Without Session', labelAr:'السماح بالبيع بدون جلسة' },
    { key:'cafeteria.session_auto_close_hours', type:'text', label:'Auto-close Sessions After (hours, 0 = off)', labelAr:'إغلاق الجلسات تلقائياً بعد (ساعات، 0 = إيقاف)' },
    { key:'cafeteria.allow_overpayment', type:'toggle', label:'Allow Overpayment', labelAr:'السماح بالمبلغ الزائد' },
    { key:'cafeteria.refund_approval_threshold', type:'text', label:'Refund Approval Threshold', labelAr:'حد موافقة الاسترجاع' },
    { key:'cafeteria.low_stock_threshold', type:'text', label:'Default Low Stock Threshold', labelAr:'حد التنبيه الافتراضي للمخزون' },
    { key:'cafeteria.receipt_footer', type:'text', label:'Receipt Footer', labelAr:'تذييل الإيصال' },
    { key:'cafeteria.super_admin_pos_password', type:'text', label:'Super Admin POS Password', labelAr:'كلمة مرور سوبر أدمن نقطة البيع' }
  ]
});

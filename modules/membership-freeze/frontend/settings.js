GymOS.registerSettingsSection({
  id:'membership-freeze-rules',
  module:'membership-freeze',
  tab:'modules',
  title:'Freeze Rules',
  titleAr:'قواعد التجميد',
  description:'Authoritative freeze lifecycle, pricing and policy controls.',
  descriptionAr:'إعدادات دورة حياة التجميد والتسعير والسياسات.',
  order:110,
  fields:[
    { key:'freeze.max_days_per_membership', type:'number', label:'Max freeze days per membership', labelAr:'أقصى أيام تجميد لكل اشتراك' },
    { key:'freeze.max_times', type:'number', label:'Max freeze count', labelAr:'أقصى عدد مرات التجميد' },
    { key:'freeze.min_days', type:'number', label:'Minimum freeze duration', labelAr:'أقل مدة تجميد' },
    { key:'freeze.max_days_single', type:'number', label:'Maximum single freeze duration', labelAr:'أقصى مدة لتجميد واحد' },
    { key:'freeze.require_payment', type:'toggle', label:'Require payment', labelAr:'يتطلب دفع' },
    { key:'freeze.pricing_mode', type:'select', label:'Pricing mode', labelAr:'نوع التسعير', options:[{value:'per_day',label:'Per Day',labelAr:'لكل يوم'},{value:'fixed',label:'Fixed',labelAr:'ثابت'}] },
    { key:'freeze.price_per_day', type:'number', label:'Price per day', labelAr:'سعر اليوم' },
    { key:'freeze.fixed_price', type:'number', label:'Fixed price', labelAr:'السعر الثابت' },
  ]
});

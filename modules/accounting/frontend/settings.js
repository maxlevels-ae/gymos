
GymOS.registerSettingsSection({
  id:'accounting-general', module:'accounting', tab:'modules', title:'Accounting Settings', titleAr:'إعدادات المحاسبة', order:170,
  fields:[
    { key:'accounting.default_currency', type:'text', label:'Default Currency', labelAr:'العملة الافتراضية' },
    { key:'accounting.fiscal_year_start', type:'text', label:'Fiscal Year Start', labelAr:'بداية السنة المالية' },
    { key:'accounting.localization_region', type:'text', label:'Localization Region', labelAr:'منطقة التوطين' },
    { key:'accounting.localization_country', type:'text', label:'Localization Country', labelAr:'دولة التوطين' },
    { key:'accounting.include_cafeteria', type:'toggle', label:'Include Cafeteria in Accounting', labelAr:'شمول الكافتيريا في المحاسبة' }
  ]
});

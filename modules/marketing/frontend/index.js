(function(){
  const css = `
.mkt-top-nav{display:flex;align-items:stretch;background:var(--bg-1);border-bottom:1px solid var(--border);height:46px;overflow-x:auto;scrollbar-width:none;position:sticky;top:0;z-index:50}
.mkt-top-nav::-webkit-scrollbar{display:none}
.mkt-brand{display:flex;align-items:center;gap:8px;padding:0 18px;border-inline-end:1px solid var(--border);font-size:13px;font-weight:700;color:var(--t1);flex-shrink:0}
.mkt-tabs{display:flex;align-items:stretch;flex:1}
.mkt-tab{display:flex;align-items:center;gap:6px;padding:0 14px;font-size:13px;font-weight:500;color:var(--t3);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap}
.mkt-tab.active{color:var(--accent-h);border-bottom-color:var(--accent)}
.mkt-tab:hover{color:var(--t1);background:rgba(255,255,255,.02)}
.mkt-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:14px}
.mkt-kpi{background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r);padding:14px}
.mkt-kpi .l{font-size:12px;color:var(--t3)}
.mkt-kpi .v{font-size:24px;font-weight:700;margin-top:8px;color:var(--t1)}
.mkt-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}
.mkt-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.mkt-list{display:flex;flex-direction:column;gap:10px}
.mkt-row{display:flex;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--border);border-radius:var(--rs);background:var(--bg-2)}
.mkt-row-title{font-size:13px;font-weight:600;color:var(--t1)}
.mkt-row-sub{font-size:11px;color:var(--t3);margin-top:4px}
.mkt-actions{display:flex;gap:8px;flex-wrap:wrap}
.mkt-small{font-size:11px;color:var(--t3)}
@media(max-width:860px){.mkt-grid{grid-template-columns:1fr}.mkt-brand{display:none}}
  `;
  if(!document.getElementById('marketing-v1-css')){ const el=document.createElement('style'); el.id='marketing-v1-css'; el.textContent=css; document.head.appendChild(el); }
  GymOS.registerTranslations('en',{ marketing:{ title:'Marketing', subtitle:'WhatsApp campaigns, reminders, and contact segments via Wesender', sync:'Sync Contacts', sendTest:'Send Test' } });
  GymOS.registerTranslations('ar',{ marketing:{ title:'التسويق', subtitle:'حملات واتساب والتذكيرات وشرائح العملاء عبر Wesender', sync:'مزامنة جهات الاتصال', sendTest:'إرسال تجريبي' } });
})();

// Member App (PWA management) — scoped styles + translations
(function () {
  const css = `
.ma-top-nav { display:flex; align-items:stretch; background:var(--bg-1); border-bottom:1px solid var(--border); height:46px; overflow-x:auto; scrollbar-width:none; position:sticky; top:0; z-index:50; }
.ma-top-nav::-webkit-scrollbar { display:none; }
.ma-brand { display:flex; align-items:center; gap:8px; padding:0 20px 0 18px; border-inline-end:1px solid var(--border); flex-shrink:0; font-size:13px; font-weight:700; color:var(--t1); }
.ma-tabs { display:flex; align-items:stretch; flex:1; }
.ma-tab { display:flex; align-items:center; gap:6px; padding:0 15px; font-size:13px; font-weight:500; color:var(--t3); border:none; background:transparent; cursor:pointer; border-bottom:2px solid transparent; transition:color .12s, border-color .12s; white-space:nowrap; height:100%; }
.ma-tab:hover { color:var(--t1); }
.ma-tab.active { color:var(--accent-h); border-bottom-color:var(--accent); }

.ma-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.ma-stat { background:var(--bg-2); border:1px solid var(--border); border-radius:var(--r); padding:16px 18px; }
.ma-stat .n { font-size:26px; font-weight:800; color:var(--t1); }
.ma-stat .l { font-size:12px; color:var(--t3); margin-top:4px; }

.ma-plan-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
.ma-plan { background:var(--bg-2); border:1px solid var(--border); border-radius:var(--r); padding:16px; }
.ma-plan-hd { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px; }
.ma-plan-title { font-size:15px; font-weight:700; color:var(--t1); }
.ma-goal { display:inline-block; font-size:11px; font-weight:600; padding:2px 9px; border-radius:10px; background:var(--bg-3); color:var(--t2); }
.ma-macros { display:flex; gap:14px; margin:10px 0; }
.ma-macros div { font-size:12px; color:var(--t3); }
.ma-macros b { display:block; font-size:15px; color:var(--t1); }
.ma-meal-row { display:grid; grid-template-columns:1.2fr 1.2fr 0.8fr 0.8fr auto; gap:6px; align-items:center; margin-bottom:6px; }

@media (max-width:640px){ .ma-meal-row{ grid-template-columns:1fr 1fr; } }
`;
  if (!document.getElementById('ma-css')) {
    const el = document.createElement('style'); el.id = 'ma-css'; el.textContent = css; document.head.appendChild(el);
  }
  GymOS.registerTranslations('en', { member_app: { loaded: 'Member App loaded' } });
  GymOS.registerTranslations('ar', { member_app: { loaded: 'تم تحميل تطبيق الأعضاء' } });
})();

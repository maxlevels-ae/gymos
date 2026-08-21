// Automation module — scoped styles + translations
(function () {
  const css = `
.au-top-nav { display:flex; align-items:stretch; background:var(--bg-1); border-bottom:1px solid var(--border); height:46px; overflow-x:auto; scrollbar-width:none; position:sticky; top:0; z-index:50; }
.au-top-nav::-webkit-scrollbar { display:none; }
.au-brand { display:flex; align-items:center; gap:8px; padding:0 20px 0 18px; border-inline-end:1px solid var(--border); flex-shrink:0; font-size:13px; font-weight:700; color:var(--t1); }
.au-tabs { display:flex; align-items:stretch; flex:1; }
.au-tab { display:flex; align-items:center; gap:6px; padding:0 15px; font-size:13px; font-weight:500; color:var(--t3); border:none; background:transparent; cursor:pointer; border-bottom:2px solid transparent; transition:color .12s, border-color .12s; white-space:nowrap; height:100%; }
.au-tab:hover { color:var(--t1); }
.au-tab.active { color:var(--accent-h); border-bottom-color:var(--accent); }

.au-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; }
.au-stat { background:var(--bg-2); border:1px solid var(--border); border-radius:var(--r); padding:16px 18px; }
.au-stat .n { font-size:26px; font-weight:800; color:var(--t1); }
.au-stat .l { font-size:12px; color:var(--t3); margin-top:4px; }

.au-rule { background:var(--bg-2); border:1px solid var(--border); border-radius:var(--r); padding:16px; margin-bottom:10px; display:flex; align-items:flex-start; gap:14px; }
.au-rule-ic { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:var(--o-brand-soft); color:var(--o-brand); }
.au-chip { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:2px 9px; border-radius:20px; background:var(--bg-3); color:var(--t2); }
.au-chip.wa { background:#e7f9ee; color:#1a9b4e; }
.au-chip.sms { background:#fef3c7; color:#b45309; }
.au-chip.notif { background:var(--o-brand-soft); color:var(--o-brand); }
.au-sw { width:40px; height:22px; border-radius:100px; border:none; position:relative; cursor:pointer; flex-shrink:0; transition:background .2s; }
.au-sw .k { position:absolute; top:3px; width:16px; height:16px; border-radius:50%; background:#fff; transition:inset-inline-start .2s; }
`;
  if (!document.getElementById('au-css')) { const el = document.createElement('style'); el.id = 'au-css'; el.textContent = css; document.head.appendChild(el); }
  GymOS.registerTranslations('en', { automation: { loaded: 'Automation loaded' } });
  GymOS.registerTranslations('ar', { automation: { loaded: 'تم تحميل الأتمتة' } });
})();

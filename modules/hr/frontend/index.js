// HR V2 — Module entry point with scoped CSS for top nav only
(function () {
  const css = `
/* ── HR top nav ── */
.hr-top-nav {
  display: flex;
  align-items: stretch;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
  height: 46px;
  overflow-x: auto;
  scrollbar-width: none;
  position: sticky;
  top: 0;
  z-index: 50;
}
.hr-top-nav::-webkit-scrollbar { display: none; }
.hr-top-nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px 0 18px;
  border-inline-end: 1px solid var(--border);
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
}
.hr-top-nav-tabs { display: flex; align-items: stretch; flex: 1; }
.hr-nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 15px;
  font-size: 13px;
  font-weight: 500;
  color: var(--t3);
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color .12s, border-color .12s, background .12s;
  white-space: nowrap;
  height: 100%;
}
.hr-nav-tab:hover { color: var(--t1); background: rgba(255,255,255,.02); }
.hr-nav-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }

/* ── Sub tabs ── */
.hr-sub-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 14px;
}
.hr-sub-tab {
  padding: 8px 15px;
  font-size: 13px;
  font-weight: 500;
  color: var(--t3);
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color .12s, border-color .12s;
  white-space: nowrap;
}
.hr-sub-tab:hover { color: var(--t1); }
.hr-sub-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }

/* ── Action bar ── */
.hr-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.hr-bar-right { display: flex; align-items: center; gap: 8px; }

/* ── Form header ── */
.hr-form-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: var(--r) var(--r) 0 0;
  flex-wrap: wrap;
}
.hr-form-hdr h2 { font-size: 15px; font-weight: 600; margin: 0; }
.hr-form-acts { display: flex; gap: 8px; align-items: center; }
.hr-form-body {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  padding: 18px;
}

/* ── Employee profile header ── */
.hr-emp-hdr {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin-bottom: 14px;
}
.hr-emp-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.hr-emp-name { font-size: 16px; font-weight: 700; color: var(--t1); }
.hr-emp-meta { font-size: 12px; color: var(--t3); margin-top: 3px; }

/* ── Payroll summary ── */
.hr-payroll-totals {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  padding: 12px 0 4px;
  border-top: 1px solid var(--border);
  margin-top: 10px;
}
.hr-total-row { display: flex; gap: 24px; font-size: 13px; color: var(--t3); }
.hr-total-row strong { color: var(--t1); min-width: 100px; text-align: end; font-variant-numeric: tabular-nums; }
.hr-total-final { padding-top: 8px; border-top: 1px solid var(--border); font-size: 15px; font-weight: 700; color: var(--t1); }
.hr-total-final strong { color: var(--green); }

/* ── Pipeline kanban ── */
.hr-pipeline {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  align-items: start;
}
.hr-pipeline-col {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
}
.hr-pipeline-hdr {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--t4);
  background: var(--bg-3);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hr-pipeline-count {
  background: var(--accent-g);
  color: var(--accent-h);
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
}
.hr-pipeline-card {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background .12s;
}
.hr-pipeline-card:last-child { border-bottom: none; }
.hr-pipeline-card:hover { background: rgba(255,255,255,.02); }
.hr-pipeline-card-name { font-size: 13px; font-weight: 500; color: var(--t1); }
.hr-pipeline-card-sub { font-size: 11px; color: var(--t3); margin-top: 2px; }

/* ── Section note ── */
.hr-note {
  padding: 10px 12px;
  background: var(--bg-3);
  border-radius: var(--rs);
  font-size: 12px;
  color: var(--t3);
  border-inline-start: 3px solid var(--accent);
  line-height: 1.5;
  margin-bottom: 14px;
}
[dir=rtl] .hr-note { border-inline-start: none; border-inline-end: 3px solid var(--accent); }

/* ── Responsive ── */
@media (max-width: 900px) {
  .hr-form-hdr { flex-direction: column; align-items: flex-start; }
  .fr3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .fr, .fr3 { grid-template-columns: 1fr; }
  .hr-bar { flex-direction: column; align-items: flex-start; }
}
`;
  if (!document.getElementById('hr-v2-css')) {
    const el = document.createElement('style');
    el.id = 'hr-v2-css';
    el.textContent = css;
    document.head.appendChild(el);
  }
  GymOS.registerTranslations('en', { hr: { loaded: 'HR loaded' } });
  GymOS.registerTranslations('ar', { hr: { loaded: 'تم تحميل الموارد البشرية' } });
})();

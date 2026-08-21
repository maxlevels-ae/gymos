// GymOS Accounting V2 — Module entry point
// Uses GymOS native design system. No custom theme overrides.

(function () {
  // Minimal scoped CSS only for accounting-specific layout needs
  // that have no GymOS equivalent (top nav bar, balance error, CoA grouping)
  const css = `
/* ── Accounting top nav (unique to this module) ── */
.acc-top-nav {
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
.acc-top-nav::-webkit-scrollbar { display: none; }

.acc-top-nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px 0 18px;
  border-inline-end: 1px solid var(--border);
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
  letter-spacing: -0.01em;
}
.acc-top-nav-tabs {
  display: flex;
  align-items: stretch;
  flex: 1;
}
.acc-nav-tab {
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
.acc-nav-tab:hover { color: var(--t1); background: rgba(255,255,255,.02); }
.acc-nav-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }
.acc-top-nav-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-inline-start: 1px solid var(--border);
  flex-shrink: 0;
}
.acc-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-3);
  color: var(--t2);
}
.acc-pill-green { background: var(--green-g); color: #34d399; }

/* ── Section action bar ── */
.acc-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.acc-bar-right { display: flex; align-items: center; gap: 8px; }
.acc-sub-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 14px;
}
.acc-sub-tab {
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
.acc-sub-tab:hover { color: var(--t1); }
.acc-sub-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }

/* ── Form header ── */
.acc-form-hdr {
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
.acc-form-hdr h2 { font-size: 15px; font-weight: 600; margin: 0; }
.acc-form-acts { display: flex; gap: 8px; align-items: center; }

/* ── Form body ── */
.acc-form-body {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  padding: 18px;
}

/* ── Balance error ── */
.acc-bal-err {
  background: var(--red-g);
  color: #f87171;
  padding: 8px 12px;
  border-radius: var(--rs);
  font-size: 12px;
  font-weight: 500;
  margin-top: 6px;
}

/* ── CoA group header ── */
.acc-coa-grp-hdr {
  padding: 7px 12px;
  background: var(--bg-3);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--t4);
  border-bottom: 1px solid var(--border);
}
.acc-coa-code { font-family: monospace; font-size: 12px; color: var(--accent-h); }

/* ── Document header info ── */
.acc-doc-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.acc-doc-no { font-size: 18px; font-weight: 700; color: var(--t1); }

/* ── P&L report layout ── */
.acc-report-section {
  padding: 8px 12px;
  background: var(--bg-3);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--t4);
  border-bottom: 1px solid var(--border);
}
.acc-report-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  font-size: 13px;
  border-bottom: 1px solid rgba(255,255,255,.03);
}
.acc-report-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  font-size: 14px;
  font-weight: 700;
  background: var(--bg-3);
  border-top: 1px solid var(--border);
}

/* ── Localization note ── */
.acc-loc-note {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--bg-3);
  border-radius: var(--rs);
  font-size: 12px;
  color: var(--t3);
  border-inline-start: 3px solid var(--accent);
  line-height: 1.5;
}
[dir=rtl] .acc-loc-note {
  border-inline-start: none;
  border-inline-end: 3px solid var(--accent);
}

/* ── Totals block ── */
.acc-totals {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  padding: 12px 0 4px;
  border-top: 1px solid var(--border);
  margin-top: 10px;
}
.acc-total-row {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: var(--t3);
}
.acc-total-row strong { color: var(--t1); min-width: 90px; text-align: end; font-variant-numeric: tabular-nums; }
.acc-total-final {
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
}
.acc-total-final strong { color: var(--accent-h); }

/* ── Payment form inline card ── */
.acc-pay-inline {
  background: var(--bg-3);
  border: 1px solid var(--border-l);
  border-radius: var(--rs);
  padding: 16px;
  margin-bottom: 14px;
}

/* ── Country row in localization ── */
.acc-country-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.acc-country-row:last-child { border-bottom: none; }

/* ── Table del button ── */
.acc-del-btn {
  background: none;
  border: none;
  color: var(--t4);
  font-size: 15px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}
.acc-del-btn:hover { color: var(--red); background: var(--red-g); }

/* ── Readonly field ── */
.acc-ro {
  padding: 8px 12px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--rs);
  font-size: 13px;
  color: var(--t2);
  min-height: 36px;
  display: flex;
  align-items: center;
}

/* ── RTL table headers ── */
[dir=rtl] th { text-align: right; }
[dir=rtl] .acc-totals { align-items: flex-start; }
[dir=rtl] .acc-total-row strong { text-align: start; }

/* ── Responsive ── */
@media (max-width: 900px) {
  .acc-form-hdr { flex-direction: column; align-items: flex-start; }
  .fr3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .fr, .fr3 { grid-template-columns: 1fr; }
  .acc-bar { flex-direction: column; align-items: flex-start; }
}
`;

  if (!document.getElementById('acc-v2-css')) {
    const el = document.createElement('style');
    el.id = 'acc-v2-css';
    el.textContent = css;
    document.head.appendChild(el);
  }

  GymOS.registerTranslations('en', { accounting: { moduleLoaded: 'Accounting loaded' } });
  GymOS.registerTranslations('ar', { accounting: { moduleLoaded: 'تم تحميل المحاسبة' } });
})();

// Access Control V2 — Module entry point with scoped CSS for top nav
// Odoo-style workspace matching HR and Accounting modules
(function () {
  const css = `
/* ── Access Control top nav ── */
.ac-top-nav {
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
.ac-top-nav::-webkit-scrollbar { display: none; }
.ac-top-nav-brand {
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
.ac-top-nav-tabs { display: flex; align-items: stretch; flex: 1; }
.ac-nav-tab {
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
.ac-nav-tab:hover { color: var(--t1); background: rgba(255,255,255,.02); }
.ac-nav-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }
.ac-top-nav-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-inline-start: 1px solid var(--border);
  flex-shrink: 0;
}
.ac-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-3);
  color: var(--t2);
}
.ac-pill-green { background: var(--green-g); color: #34d399; }
.ac-pill-red   { background: var(--red-g);   color: #f87171; }

/* ── Sub tabs ── */
.ac-sub-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 14px;
}
.ac-sub-tab {
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
.ac-sub-tab:hover { color: var(--t1); }
.ac-sub-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }

/* ── Action bar ── */
.ac-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.ac-bar-right { display: flex; align-items: center; gap: 8px; }

/* ── Form header ── */
.ac-form-hdr {
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
.ac-form-hdr h2 { font-size: 15px; font-weight: 600; margin: 0; }
.ac-form-acts { display: flex; gap: 8px; align-items: center; }
.ac-form-body {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  padding: 18px;
}

/* ── Identity header ── */
.ac-id-hdr {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin-bottom: 14px;
}
.ac-id-avatar {
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
.ac-id-name { font-size: 16px; font-weight: 700; color: var(--t1); }
.ac-id-meta { font-size: 12px; color: var(--t3); margin-top: 3px; }

/* ── Fingerprint scan indicator ── */
.ac-scan-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  justify-content: center;
}
.ac-scan-dot {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--t4);
  transition: all .3s;
}
.ac-scan-dot.done {
  border-color: var(--green);
  background: var(--green-g);
  color: var(--green);
}
.ac-scan-dot.active {
  border-color: var(--accent);
  background: var(--accent-g);
  color: var(--accent-h);
  animation: ac-pulse 1.2s ease-in-out infinite;
}
@keyframes ac-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
.ac-scan-line {
  width: 32px;
  height: 2px;
  background: var(--border);
}
.ac-scan-line.done { background: var(--green); }

/* ── Live verify result ── */
.ac-verify-result {
  padding: 20px;
  border-radius: var(--r);
  text-align: center;
  margin-bottom: 14px;
}
.ac-verify-result.granted {
  background: var(--green-g);
  border: 1px solid rgba(52, 211, 153, .2);
}
.ac-verify-result.denied {
  background: var(--red-g);
  border: 1px solid rgba(248, 113, 113, .2);
}
.ac-verify-icon { font-size: 48px; margin-bottom: 8px; }
.ac-verify-name { font-size: 18px; font-weight: 700; color: var(--t1); }
.ac-verify-sub { font-size: 13px; color: var(--t3); margin-top: 4px; }

/* ── Device status card ── */
.ac-device-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
}
.ac-device-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ac-device-dot.online  { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,.4); }
.ac-device-dot.offline { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,.4); }

/* ── Note block ── */
.ac-note {
  padding: 10px 12px;
  background: var(--bg-3);
  border-radius: var(--rs);
  font-size: 12px;
  color: var(--t3);
  border-inline-start: 3px solid var(--accent);
  line-height: 1.5;
  margin-bottom: 14px;
}
[dir=rtl] .ac-note { border-inline-start: none; border-inline-end: 3px solid var(--accent); }

/* ── Responsive ── */
@media (max-width: 900px) {
  .ac-form-hdr { flex-direction: column; align-items: flex-start; }
  .fr3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .fr, .fr3 { grid-template-columns: 1fr; }
  .ac-bar { flex-direction: column; align-items: flex-start; }
}
`;
  if (!document.getElementById('ac-v2-css')) {
    const el = document.createElement('style');
    el.id = 'ac-v2-css';
    el.textContent = css;
    document.head.appendChild(el);
  }
  GymOS.registerTranslations('en', { accessControl: { moduleLoaded: 'Access Control loaded' } });
  GymOS.registerTranslations('ar', { accessControl: { moduleLoaded: 'تم تحميل وحدة التحكم بالدخول' } });
})();

// Training V1 — Module entry point with scoped CSS
// Odoo-style workspace matching HR and Accounting modules
(function () {
  const css = `
/* ── Training top nav ── */
.trn-top-nav {
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
.trn-top-nav::-webkit-scrollbar { display: none; }
.trn-top-nav-brand {
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
.trn-top-nav-tabs { display: flex; align-items: stretch; flex: 1; }
.trn-nav-tab {
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
.trn-nav-tab:hover { color: var(--t1); background: rgba(255,255,255,.02); }
.trn-nav-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }

/* ── Sub tabs ── */
.trn-sub-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 14px;
}
.trn-sub-tab {
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
.trn-sub-tab:hover { color: var(--t1); }
.trn-sub-tab.active { color: var(--accent-h); border-bottom-color: var(--accent); }

/* ── Bar ── */
.trn-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.trn-bar-right { display: flex; align-items: center; gap: 8px; }

/* ── Form header ── */
.trn-form-hdr {
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
.trn-form-hdr h2 { font-size: 15px; font-weight: 600; margin: 0; }
.trn-form-acts { display: flex; gap: 8px; align-items: center; }
.trn-form-body {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  padding: 18px;
}

/* ── Member profile header ── */
.trn-member-hdr {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin-bottom: 14px;
}
.trn-avatar {
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
.trn-name { font-size: 16px; font-weight: 700; color: var(--t1); }
.trn-meta { font-size: 12px; color: var(--t3); margin-top: 3px; }

/* ── Exercise card grid ── */
.trn-ex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.trn-ex-card {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
  cursor: pointer;
  transition: border-color .15s;
}
.trn-ex-card:hover { border-color: var(--accent); }
.trn-ex-thumb {
  width: 100%;
  height: 140px;
  object-fit: cover;
  background: var(--bg-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: var(--t4);
}
.trn-ex-body { padding: 12px; }
.trn-ex-title { font-size: 14px; font-weight: 600; color: var(--t1); }
.trn-ex-sub { font-size: 12px; color: var(--t3); margin-top: 3px; }

/* ── Level badges ── */
.trn-level {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}
.trn-level-beginner { background: var(--green-g); color: #34d399; }
.trn-level-mid      { background: rgba(245,158,11,.15); color: #f59e0b; }
.trn-level-expert   { background: var(--red-g); color: #f87171; }

/* ── Category chip ── */
.trn-cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--bg-3);
  color: var(--t2);
  border: 1px solid var(--border);
}

/* ── Onboard form ── */
.trn-onboard-card {
  max-width: 500px;
  margin: 0 auto;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px;
}
.trn-onboard-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--t1);
  text-align: center;
  margin-bottom: 6px;
}
.trn-onboard-sub {
  font-size: 13px;
  color: var(--t3);
  text-align: center;
  margin-bottom: 18px;
}

/* ── Note ── */
.trn-note {
  padding: 10px 12px;
  background: var(--bg-3);
  border-radius: var(--rs);
  font-size: 12px;
  color: var(--t3);
  border-inline-start: 3px solid var(--accent);
  line-height: 1.5;
  margin-bottom: 14px;
}
[dir=rtl] .trn-note { border-inline-start: none; border-inline-end: 3px solid var(--accent); }

/* ── Safe video card ── */
.trn-video-card {
  border: 1px solid var(--line);
  border-radius: calc(var(--r) + 2px);
  background: var(--card);
  overflow: hidden;
  margin-bottom: 14px;
  box-shadow: var(--sh-sm);
}
.trn-video-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #111827;
}
.trn-video-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.trn-video-thumb__play {
  position: absolute;
  inset-inline-start: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 68px;
  height: 68px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 24px;
  border: 1px solid rgba(255,255,255,0.22);
  backdrop-filter: blur(4px);
}
.trn-video-card__body {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
}
.trn-video-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-weight: 700;
  flex: 0 0 42px;
}
.trn-video-card__content {
  min-width: 0;
  flex: 1;
}
.trn-video-card__title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--t);
}
.trn-video-card__desc {
  font-size: 12px;
  color: var(--t3);
  line-height: 1.7;
}
.trn-video-card__actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 14px 14px;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .trn-form-hdr { flex-direction: column; align-items: flex-start; }
  .trn-ex-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .fr3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .fr, .fr3 { grid-template-columns: 1fr; }
  .trn-bar { flex-direction: column; align-items: flex-start; }
  .trn-ex-grid { grid-template-columns: 1fr; }
}
`;
  if (!document.getElementById('trn-v1-css')) {
    const el = document.createElement('style');
    el.id = 'trn-v1-css';
    el.textContent = css;
    document.head.appendChild(el);
  }
  GymOS.registerTranslations('en', { training: { loaded: 'Training loaded' } });
  GymOS.registerTranslations('ar', { training: { loaded: 'تم تحميل التدريب' } });
})();

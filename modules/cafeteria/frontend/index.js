(function(){
  const css = `
/* ── Cafeteria top nav ── */
.caf-top-nav{display:flex;align-items:stretch;background:var(--bg-1);border-bottom:1px solid var(--border);height:46px;overflow-x:auto;scrollbar-width:none;position:sticky;top:0;z-index:50}
.caf-top-nav::-webkit-scrollbar{display:none}
.caf-top-nav-brand{display:flex;align-items:center;gap:8px;padding:0 20px 0 18px;border-inline-end:1px solid var(--border);flex-shrink:0;font-size:13px;font-weight:700;color:var(--t1)}
.caf-top-nav-tabs{display:flex;align-items:stretch;flex:1}
.caf-nav-tab{display:flex;align-items:center;gap:6px;padding:0 16px;font-size:13px;font-weight:500;color:var(--t3);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;transition:color .12s,border-color .12s,background .12s;white-space:nowrap;height:100%}
.caf-nav-tab:hover{color:var(--t1);background:rgba(255,255,255,.02)}
.caf-nav-tab.active{color:var(--accent-h);border-bottom-color:var(--accent)}
.caf-top-nav-actions{display:flex;align-items:center;gap:8px;padding:0 14px;border-inline-start:1px solid var(--border);flex-shrink:0}

/* ══════════════════════════════════════════════════════
   POS — pixel-matched to design handoff (Gram Gym POS)
   RTL: order panel on the right, products panel on the left
   ══════════════════════════════════════════════════════ */
.pos-root{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:#f0f0f0;color:#1e1b3a;direction:rtl;font-family:'Noto Sans Arabic','Segoe UI',Tahoma,sans-serif}
.pos-root *,.pos-root *::before,.pos-root *::after{box-sizing:border-box}
.pos-root ::-webkit-scrollbar{width:4px;height:4px}
.pos-root ::-webkit-scrollbar-track{background:transparent}
.pos-root ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}
.pos-products ::-webkit-scrollbar-thumb{background:#ddd}

/* ── Top bar ── */
.pos-tbar{background:#1a1a2e;display:flex;align-items:center;padding:0 14px;height:40px;gap:8px;flex-shrink:0}
.pos-tbar-close{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:7px;padding:4px 12px;font-size:12px;font-weight:600;color:#f87171;cursor:pointer;font-family:inherit}
.pos-tbar-close:hover{background:rgba(239,68,68,.25)}
.pos-tbar-last{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:4px 12px;font-size:12px;font-weight:500;color:#c4c4d4;cursor:pointer;font-family:inherit}
.pos-tbar-last:hover{background:rgba(255,255,255,.14)}
.pos-tbar-spacer{flex:1}
.pos-tbar-meta{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#8888aa;white-space:nowrap}
.pos-tbar-live{display:flex;align-items:center;gap:4px;color:#34d399;font-weight:600}
.pos-tbar-dot{width:6px;height:6px;background:#34d399;border-radius:50%;display:inline-block}
.pos-tbar-meta strong{color:#e2e2f0;font-weight:600}

/* ── Main split ── */
.pos-main{display:flex;height:calc(100vh - 40px);overflow:hidden}

/* ── Order panel (right, dark) ── */
.pos-order{width:340px;background:#1e1e32;display:flex;flex-direction:column;flex-shrink:0;border-inline-end:1px solid rgba(255,255,255,.06);overflow:hidden}
.pos-otype{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;display:flex;gap:6px;align-items:center}
.pos-oseg{display:flex;background:rgba(255,255,255,.06);border-radius:9px;padding:3px;gap:2px;flex:1}
.pos-oseg-btn{flex:1;padding:5px;border:none;border-radius:6px;background:none;color:#8888aa;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit}
.pos-oseg-btn:hover{background:rgba(255,255,255,.08);color:#e2e2f0}
.pos-oseg-btn.active{background:#14b8a6;color:#fff;font-weight:700}
.pos-new{background:#6366f1;border:none;border-radius:7px;padding:5px 12px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;font-family:inherit;flex-shrink:0}
.pos-new:hover{background:#5457e0}

.pos-cust-wrap{padding:6px 12px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;display:flex;gap:6px;align-items:center}
.pos-cust{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:7px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:0;font-family:inherit}
.pos-cust:hover{border-color:rgba(20,184,166,.5);background:rgba(20,184,166,.06)}
.pos-cust-av{width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-cust-name{font-size:12.5px;color:#8888aa;flex:1;text-align:start;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pos-cust-x{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#8888aa;width:32px;height:32px;cursor:pointer;flex-shrink:0;font-family:inherit}
.pos-cust-x:hover{color:#f87171;border-color:rgba(239,68,68,.4)}

/* ── Cart ── */
.pos-cart{flex:1;overflow-y:auto;min-height:0;display:flex;flex-direction:column}
.pos-cart-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px}
.pos-cart-empty-ic{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center}
.pos-cart-empty-txt{font-size:12px;color:#555577;font-weight:500}
.pos-item{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;gap:10px;align-items:flex-start}
.pos-item:hover{background:rgba(255,255,255,.015)}
.pos-item-ic{width:34px;height:34px;border-radius:9px;background:#0f766e;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-item-ic svg{width:18px;height:18px}
.pos-item-info{flex:1;min-width:0}
.pos-item-name{font-size:12.5px;font-weight:700;color:#e2e2f0;line-height:1.35}
.pos-item-price{font-size:11px;color:#8888aa;margin-top:2px}
.pos-item-ctl{display:flex;align-items:center;gap:4px;margin-top:6px}
.pos-qbtn{width:24px;height:24px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#e2e2f0;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;line-height:1;font-family:inherit}
.pos-qbtn:hover{border-color:#14b8a6;color:#14b8a6}
.pos-qinput{width:38px;height:24px;text-align:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e2e2f0;font-size:12px;font-weight:700;outline:none;font-family:inherit}
.pos-dinput{width:52px;height:24px;padding:0 6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e2e2f0;font-size:11px;outline:none;font-family:inherit}
.pos-qinput:focus,.pos-dinput:focus{border-color:#14b8a6}
.pos-item-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
.pos-item-total{font-size:13px;font-weight:700;color:#e2e2f0}
.pos-item-x{color:#555577;background:none;border:none;cursor:pointer;font-size:14px;padding:2px;line-height:1;font-family:inherit}
.pos-item-x:hover{color:#f87171}

/* ── Totals ── */
.pos-sum{padding:8px 14px;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.15);flex-shrink:0}
.pos-sum-row{display:flex;justify-content:space-between;margin-bottom:4px}
.pos-sum-row span:first-child{font-size:12px;color:#8888aa}
.pos-sum-row span:last-child{font-size:12px;color:#c4c4d4;font-weight:500}
.pos-sum-row.grand{margin-bottom:0}
.pos-sum-row.grand span{font-size:14px;font-weight:700;color:#e2e2f0}

/* ── Payment methods ── */
.pos-pm-wrap{padding:5px 12px;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0}
.pos-pm-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.pos-pm{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 4px;color:#c4c4d4;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:2px}
.pos-pm:hover{border-color:#14b8a6;color:#14b8a6;background:rgba(20,184,166,.08)}
.pos-pm-lbl{font-size:10.5px;font-weight:600}
.pos-pm.active{background:#14b8a6;border-color:#14b8a6;color:#fff}
.pos-pm.active .pos-pm-lbl{font-weight:700}
.pos-pm.active:hover{background:#0d9488;color:#fff}

/* ── Split payment lines ── */
.pos-split{padding:4px 12px;display:flex;flex-direction:column;gap:5px;flex-shrink:0}
.pos-split-row{display:grid;grid-template-columns:1fr 80px 24px;gap:5px;align-items:center}
.pos-split-row select,.pos-split-row input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e2e2f0;font-size:11px;padding:4px 6px;font-family:inherit;outline:none}
.pos-split-x{background:none;border:none;color:#8888aa;cursor:pointer;font-size:13px;font-family:inherit}
.pos-split-x:hover{color:#f87171}

/* ── Amount match ── */
.pos-match{padding:4px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0}
.pos-match-box{width:14px;height:14px;border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#14b8a6}
.pos-match-box.off{background:rgba(255,255,255,.12)}
.pos-match-lbl{font-size:11.5px;color:#666688}
.pos-match-amt{font-size:11.5px;color:#c4c4d4;font-weight:600;margin-inline-start:auto}

/* ── Complete sale ── */
.pos-cta-wrap{padding:5px 12px;flex-shrink:0}
.pos-cta{width:100%;background:#14b8a6;border:none;border-radius:10px;padding:11px;color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer}
.pos-cta:hover{background:#0d9488}
.pos-cta:disabled{opacity:.5;cursor:not-allowed}

/* ── Secondary actions ── */
.pos-sec{padding:0 12px 5px;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;flex-shrink:0}
.pos-sec-btn{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:6px 4px;font-size:11px;font-weight:500;color:#8888aa;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.pos-sec-btn:hover{background:rgba(255,255,255,.09);color:#c4c4d4}
.pos-sec-btn:disabled{opacity:.45;cursor:not-allowed}

/* ── Pending orders footer ── */
.pos-pend{padding:5px 12px 7px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:6px;flex-shrink:0;cursor:pointer;user-select:none}
.pos-pend:hover .pos-pend-lbl{color:#c4c4d4}
.pos-pend-lbl{font-size:11.5px;color:#666688}
.pos-pend-badge{background:#6366f1;color:#fff;border-radius:20px;padding:1px 7px;font-size:10.5px;font-weight:700}
.pos-pend-list{max-height:180px;overflow-y:auto;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0}
.pos-pend-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)}
.pos-pend-item .n{font-weight:600;font-size:12px;color:#e2e2f0}
.pos-pend-item .c{font-size:11px;color:#8888aa}
.pos-pend-resume{background:#14b8a6;border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:600;padding:4px 10px;cursor:pointer;font-family:inherit}
.pos-pend-resume:hover{background:#0d9488}

/* ── Products panel (left, light) ── */
.pos-products{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f5f5f8;min-width:0}
.pos-psearch-row{background:#fff;border-bottom:1px solid #e8e8ec;padding:8px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0}
.pos-psearch{flex:1;display:flex;align-items:center;background:#f5f5f8;border:1.5px solid #e8e8ec;border-radius:9px;padding:0 11px;height:33px;gap:7px}
.pos-psearch:focus-within{border-color:#14b8a6}
.pos-psearch input{border:none;outline:none;font-family:inherit;font-size:13px;color:#1e1b3a;background:transparent;direction:rtl;width:100%}
.pos-psearch input::placeholder{color:#aaa}
.pos-prefresh{background:#fff;border:1.5px solid #e4dff5;border-radius:9px;padding:0 12px;height:33px;font-size:12px;font-weight:500;color:#6b6893;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;white-space:nowrap}
.pos-prefresh:hover{background:#f8f5ff;border-color:#c4b5fd;color:#6366f1}

.pos-cats{background:#fff;border-bottom:1px solid #e8e8ec;padding:6px 14px;display:flex;align-items:center;gap:5px;overflow-x:auto;flex-shrink:0;scrollbar-width:none}
.pos-cats::-webkit-scrollbar{display:none}
.pos-cat{background:none;border:1.5px solid #e8e8ec;border-radius:7px;padding:5px 11px;font-size:12px;font-weight:500;color:#666;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0}
.pos-cat:hover{border-color:#14b8a6;color:#0d9488}
.pos-cat.active{background:#14b8a6;border-color:#14b8a6;color:#fff;font-weight:700;padding:5px 13px}

.pos-pgrid{flex:1;overflow-y:auto;padding:12px;min-height:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px;align-content:start}
.pos-card{background:#fff;border-radius:12px;padding:13px 12px 11px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;border:1.5px solid #ebebef;box-shadow:0 1px 3px rgba(0,0,0,.04);position:relative;font-family:inherit}
.pos-card:hover{border-color:#14b8a6;box-shadow:0 6px 20px rgba(0,0,0,.09);transform:translateY(-2px)}
.pos-card-stock{position:absolute;top:7px;left:7px;background:#f0fdf9;color:#0d9488;border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700}
.pos-card-stock.out{background:#fef2f2;color:#ef4444}
.pos-card-stock.low{background:#fff7ed;color:#f97316}
.pos-card-ic{width:52px;height:52px;border-radius:13px;background:#0f766e;display:flex;align-items:center;justify-content:center}
.pos-card-txt{text-align:center}
.pos-card-name{font-size:12.5px;font-weight:700;color:#1e1b3a;margin-bottom:3px;line-height:1.3}
.pos-card-cat{font-size:10.5px;color:#999;margin-bottom:4px}
.pos-card-price{font-size:13.5px;font-weight:700;color:#0d9488}
.pos-card.out{opacity:.5;cursor:not-allowed}
.pos-card.out:hover{transform:none;box-shadow:0 1px 3px rgba(0,0,0,.04);border-color:#ebebef}
.pos-empty-products{grid-column:1/-1;text-align:center;color:#999;font-size:14px;padding:40px}

/* ── Session gate (pre-session screen, app theme) ── */
.pos-gate{display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg-0)}
.pos-gate-card{background:var(--bg-2);border:1px solid var(--border);border-radius:20px;display:grid;grid-template-columns:1.2fr 1fr;width:min(860px,95vw);overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.5)}
.pos-gate-left{padding:40px 36px;background:linear-gradient(160deg,rgba(20,184,166,.12),transparent);display:flex;flex-direction:column}
.pos-gate-right{padding:36px 32px;border-inline-start:1px solid var(--border);display:flex;flex-direction:column;justify-content:center}
.pos-gate-title{font-size:28px;font-weight:700;color:var(--t1);margin-bottom:10px}
.pos-gate-desc{font-size:13px;color:var(--t3);line-height:1.8;margin-bottom:24px}

/* ── Cafeteria workspace (non-POS sections) ── */
.caf-section-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.caf-sub-tabs{display:flex;align-items:stretch;border-bottom:1px solid var(--border);margin-bottom:14px}
.caf-sub-tab{padding:8px 15px;font-size:13px;font-weight:500;color:var(--t3);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.caf-sub-tab.active{color:var(--accent-h);border-bottom-color:var(--accent)}
.caf-sub-tab:hover{color:var(--t1)}

/* ── Responsive ── */
@media(max-width:900px){.pos-order{width:300px}}
@media(max-width:640px){.pos-pgrid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}.pos-tbar-meta{font-size:10.5px;gap:5px}}
`;
  if(!document.getElementById('caf-v2-css')){const el=document.createElement('style');el.id='caf-v2-css';el.textContent=css;document.head.appendChild(el);}
  GymOS.registerTranslations('en',{cafeteria:{v2loaded:'Cafeteria loaded'}});
  GymOS.registerTranslations('ar',{cafeteria:{v2loaded:'تم تحميل الكافتيريا'}});
})();

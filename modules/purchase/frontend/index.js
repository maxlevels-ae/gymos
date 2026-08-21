(function(){
  const css = `
.po-top-nav{display:flex;align-items:stretch;background:var(--bg-1);border-bottom:1px solid var(--border);height:46px;overflow-x:auto;scrollbar-width:none;position:sticky;top:0;z-index:50}
.po-top-nav::-webkit-scrollbar{display:none}
.po-top-nav-brand{display:flex;align-items:center;gap:8px;padding:0 20px 0 18px;border-inline-end:1px solid var(--border);flex-shrink:0;font-size:13px;font-weight:700;color:var(--t1)}
.po-top-nav-tabs{display:flex;align-items:stretch;flex:1}
.po-nav-tab{display:flex;align-items:center;gap:6px;padding:0 15px;font-size:13px;font-weight:500;color:var(--t3);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;transition:color .12s,border-color .12s,background .12s;white-space:nowrap;height:100%}
.po-nav-tab:hover{color:var(--t1);background:rgba(255,255,255,.02)}
.po-nav-tab.active{color:var(--accent-h);border-bottom-color:var(--accent)}
.po-sub-tabs{display:flex;align-items:stretch;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px}
.po-sub-tab{padding:8px 15px;font-size:13px;font-weight:500;color:var(--t3);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;transition:color .12s,border-color .12s;white-space:nowrap}
.po-sub-tab:hover{color:var(--t1)}
.po-sub-tab.active{color:var(--accent-h);border-bottom-color:var(--accent)}
.po-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.po-form-hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border);background:var(--bg-2);border-radius:var(--r) var(--r) 0 0;flex-wrap:wrap}
.po-form-hdr h2{font-size:15px;font-weight:600;margin:0}
.po-form-acts{display:flex;gap:8px;align-items:center}
.po-form-body{background:var(--bg-2);border:1px solid var(--border);border-top:none;border-radius:0 0 var(--r) var(--r);padding:18px}
.po-doc-no{font-size:20px;font-weight:700;color:var(--t1)}
.po-state-flow{display:flex;align-items:center;gap:0;margin-bottom:14px;flex-wrap:wrap}
.po-state-step{display:flex;align-items:center;padding:6px 14px;font-size:12px;font-weight:500;color:var(--t4);border-bottom:2px solid var(--border);position:relative}
.po-state-step.done{color:var(--green);border-bottom-color:var(--green)}
.po-state-step.active{color:var(--accent-h);border-bottom-color:var(--accent);font-weight:700}
.po-state-step:not(:last-child)::after{content:'›';margin-inline-start:10px;color:var(--t4)}
.po-totals{display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding:12px 0 4px;border-top:1px solid var(--border);margin-top:10px}
.po-total-row{display:flex;gap:24px;font-size:13px;color:var(--t3)}
.po-total-row strong{color:var(--t1);min-width:100px;text-align:end;font-variant-numeric:tabular-nums}
.po-total-final{padding-top:8px;border-top:1px solid var(--border);font-size:15px;font-weight:700;color:var(--t1)}
.po-total-final strong{color:var(--accent-h)}
.po-note{padding:10px 12px;background:var(--bg-3);border-radius:var(--rs);font-size:12px;color:var(--t3);border-inline-start:3px solid var(--accent);line-height:1.5;margin-bottom:12px}
[dir=rtl] .po-note{border-inline-start:none;border-inline-end:3px solid var(--accent)}
.po-receipt-qty{font-variant-numeric:tabular-nums;font-weight:600;color:var(--green)}
.po-del-btn{background:none;border:none;color:var(--t4);font-size:15px;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1}
.po-del-btn:hover{color:var(--red);background:var(--red-g)}
[dir=rtl] .po-totals{align-items:flex-start}
[dir=rtl] .po-total-row strong{text-align:start}
@media(max-width:900px){.po-form-hdr{flex-direction:column;align-items:flex-start}.fr3{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.fr,.fr3{grid-template-columns:1fr}.po-bar{flex-direction:column;align-items:flex-start}}
`;
  if(!document.getElementById('po-v1-css')){const el=document.createElement('style');el.id='po-v1-css';el.textContent=css;document.head.appendChild(el);}
  GymOS.registerTranslations('en',{purchase:{loaded:'Purchase loaded'}});
  GymOS.registerTranslations('ar',{purchase:{loaded:'تم تحميل المشتريات'}});
})();

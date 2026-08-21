
const{useState,useEffect,useCallback,createContext,useContext,useRef}=React;

// ═══════════════════════════════════════════════════
// API LAYER
// ═══════════════════════════════════════════════════
const api={token:localStorage.getItem('token')||null,
  async _refresh(){try{const rt=localStorage.getItem('refreshToken');const r=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(rt?{refreshToken:rt}:{})});if(!r.ok)return false;const d=await r.json();if(d.data&&d.data.token){this.token=d.data.token;localStorage.setItem('token',d.data.token);if(d.data.refreshToken)localStorage.setItem('refreshToken',d.data.refreshToken);return true;}return false;}catch(_){return false;}},
  async req(u,o={},_retried){const h={'Content-Type':'application/json',...(o.headers||{})};if(this.token)h['Authorization']='Bearer '+this.token;const r=await fetch(u,{...o,headers:h});
    // On an expired/invalid token, transparently refresh once and retry — avoids a "no data" flash.
    if(r.status===401&&!_retried&&!/\/api\/auth\/(login|refresh|logout)/.test(u)){const ok=await this._refresh();if(ok)return this.req(u,o,true);}
    const d=await r.json();if(!r.ok){const err=new Error(d.error||'Failed');err.status=r.status;err.data=d;throw err;}return d},
  get:u=>api.req(u),post:(u,b)=>api.req(u,{method:'POST',body:JSON.stringify(b)}),put:(u,b)=>api.req(u,{method:'PUT',body:JSON.stringify(b)}),del:u=>api.req(u,{method:'DELETE'}),
  upload:async(u,file)=>{const fd=new FormData();fd.append('module',file);const h={};if(api.token)h['Authorization']='Bearer '+api.token;const r=await fetch(u,{method:'POST',headers:h,body:fd});return r.json()}};

// ═══════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════
const I={
  'layout-dashboard':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  users:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  'credit-card':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  'scan-line':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  dumbbell:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>,
  building:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  calendar:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  megaphone:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
  package:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
  settings:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
  shield:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  puzzle:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.743-.953a2.5 2.5 0 1 0-4.95-.613 2.5 2.5 0 0 0 .656 1.69"/></svg>,
  activity:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  upload:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  plus:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  eye:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  check:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  menu:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>,
  'chevron-right':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  'chevron-down':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  'log-out':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  snowflake:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
  refresh:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  search:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>,
  bell:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></svg>,
  message:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  mail:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>,
  clock:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  grid:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  columns:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M15 4v16"/></svg>,
  bookmark:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  filter:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  star:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  'bar-chart':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  'trending-up':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  'user-plus':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  'alert-triangle':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  coffee:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  archive:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>,
  'file-text':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
  clipboard:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>,
  briefcase:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  monitor:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  user:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  folder:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>,
  target:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  sprout:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>,
  trophy:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  utensils:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 2v7c0 1.1.9 2 2 2h.5a1.5 1.5 0 0 0 1.5-1.5V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>,
  link:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  smartphone:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
  book:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  'dollar-sign':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  'palm-tree':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/></svg>,
  fingerprint:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2"/></svg>,
  hand:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>,
  trash:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  factory:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>,
  wrench:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  plug:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>,
  'shopping-cart':p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>,
  lightbulb:p=><svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>,
};
function Ic({name,size=17,...r}){const C=I[name]||I.package;return <C width={size} height={size} {...r}/>}
let tt;function toast(m,t='s'){const e=document.querySelector('.toast');if(e)e.remove();const el=document.createElement('div');el.className='toast toast-'+t;el.textContent=m;document.body.appendChild(el);clearTimeout(tt);tt=setTimeout(()=>el.remove(),3000)}

// ═══════════════════════════════════════════════════
// I18N CONTEXT
// ═══════════════════════════════════════════════════
// Server timestamps come from SQLite datetime('now') as "YYYY-MM-DD HH:MM:SS" in UTC
// with NO zone marker. `new Date()` misparses that bare form as *local* time, so every
// timezone-aware format would be off by the offset. Normalize such strings to explicit
// UTC before formatting. Date-only values are left as-is (already parsed as UTC midnight).
function parseServerDate(value){
  if(value instanceof Date) return value;
  if(typeof value==='string'){
    const s=value.trim();
    if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) return new Date(s.replace(' ','T')+'Z');
    return new Date(s);
  }
  return new Date(value);
}
const I18n=createContext({t:k=>k,locale:'en',dir:'ltr'});
function I18nProvider({children}){
  const[strings,setStrings]=useState({});
  const[locale,setLocaleState]=useState('en');
  const[dir,setDir]=useState('ltr');
  const[formatSettings,setFormatSettings]=useState({currency:'JOD',timezone:'Asia/Amman',dateFormat:'YYYY-MM-DD'});

  const applyLayoutSettings=useCallback((settings={})=>{
    const nextSettings={
      currency:settings.currency||'JOD',
      timezone:settings.timezone||settings.timeZone||'Asia/Amman',
      dateFormat:settings.dateFormat||settings.date_format||'YYYY-MM-DD',
    };
    setFormatSettings(nextSettings);
    const rawDir=settings.dir||'auto';
    const resolvedDir=rawDir==='auto'?(locale==='ar'?'rtl':'ltr'):rawDir;
    setDir(resolvedDir);
    document.documentElement.lang=locale||'en';
    document.documentElement.dir=resolvedDir;
  },[locale]);

  const setLocale=useCallback(async(loc,settings={})=>{
    const nextLocale=loc||'en';
    await window.GymOS.ensureLocale(nextLocale);
    setStrings(window.GymOS.getMergedTranslations(nextLocale));
    setLocaleState(nextLocale);
    const rawDir=settings.dir||'auto';
    const resolvedDir=rawDir==='auto'?(nextLocale==='ar'?'rtl':'ltr'):rawDir;
    setDir(resolvedDir);
    if(settings && Object.keys(settings).length){
      setFormatSettings({
        currency:settings.currency||'JOD',
        timezone:settings.timezone||settings.timeZone||'Asia/Amman',
        dateFormat:settings.dateFormat||settings.date_format||'YYYY-MM-DD',
      });
    }
    document.documentElement.lang=nextLocale;
    document.documentElement.dir=resolvedDir;
  },[]);

  useEffect(()=>{
    window.GymOS.ensureLocale('en').then(()=>setStrings(window.GymOS.getMergedTranslations('en'))).catch(()=>{});
  },[]);

  const t=useCallback((key,fb)=>{
    const parts=String(key||'').split('.');
    let value=strings;
    for(const part of parts){
      if(!value||typeof value!=='object'||!(part in value)){ value=undefined; break; }
      value=value[part];
    }
    if(typeof value==='string') return value;
    if(fb!==undefined&&fb!==null) return fb;
    return key;
  },[strings]);

  const formatDate=useCallback((value,opts={})=>{
    if(!value) return '—';
    try{
      const tz=formatSettings.timezone||undefined;
      return new Intl.DateTimeFormat(locale==='ar'?'ar-JO':'en-GB',{
        year:'numeric',month:'2-digit',day:'2-digit',timeZone:tz,...opts
      }).format(parseServerDate(value));
    }catch(_){return String(value)}
  },[locale,formatSettings]);

  const formatDateTime=useCallback((value,opts={})=>{
    if(!value) return '—';
    try{
      const tz=formatSettings.timezone||undefined;
      return new Intl.DateTimeFormat(locale==='ar'?'ar-JO':'en-GB',{
        year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:tz,...opts
      }).format(parseServerDate(value));
    }catch(_){return String(value)}
  },[locale,formatSettings]);

  const formatCurrency=useCallback((value,currency)=>{
    const amount=Number(value||0);
    try{
      return new Intl.NumberFormat(locale==='ar'?'ar-JO':'en-US',{
        style:'currency',currency:currency||formatSettings.currency||'JOD',maximumFractionDigits:2
      }).format(amount);
    }catch(_){return `${amount} ${currency||formatSettings.currency||'JOD'}`}
  },[locale,formatSettings]);

  window.GymOS.shared.getI18n=()=>({locale,dir,t,formatDate,formatDateTime,formatCurrency,settings:formatSettings});

  return<I18n.Provider value={{t,locale,dir,setLocale,strings,applyLayoutSettings,formatDate,formatDateTime,formatCurrency,settings:formatSettings}}>{children}</I18n.Provider>
}
function useI18n(){return useContext(I18n)}

// ═══════════════════════════════════════════════════
// AUTH CONTEXT
// ═══════════════════════════════════════════════════
const AC=createContext();
function AP({children}){
  const cachedUser=(()=>{try{return JSON.parse(localStorage.getItem('currentUser')||'null')}catch(_){return null}})();
  const[u,su]=useState(cachedUser);
  const[l,sl]=useState(Boolean(localStorage.getItem('token')) && !cachedUser);
  const{setLocale,applyLayoutSettings}=useI18n();
  useEffect(()=>{
    const token=localStorage.getItem('token');
    const cachedLayout=(()=>{try{return JSON.parse(localStorage.getItem('appLayout')||'null')}catch(_){return null}})();
    if(cachedLayout?.settings){
      setLocale(cachedLayout.settings.locale||'en',cachedLayout.settings||{}).catch(()=>{});
      applyLayoutSettings(cachedLayout.settings||{});
    }
    if(!token){sl(false);return;}
    api.token=token;
    api.get('/api/auth/me').then(async r=>{
      su(r.data||null);
      localStorage.setItem('currentUser',JSON.stringify(r.data||null));
      try{
        const lay=await api.get('/api/layout');
        localStorage.setItem('appLayout',JSON.stringify(lay.data||{}));
        await setLocale(lay.data?.settings?.locale||'en',lay.data?.settings||{});
        applyLayoutSettings(lay.data?.settings||{});
      }catch(_){
        await setLocale(cachedLayout?.settings?.locale||'en',cachedLayout?.settings||{dir:'auto'});
      }
      sl(false);
    }).catch(()=>{
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentUser');
      api.token=null;
      su(null);
      sl(false);
    });
  },[]);
  const login=async(un,pw)=>{
    const r=await api.post('/api/auth/login',{username:un,password:pw});
    api.token=r.data.token;
    localStorage.setItem('token',r.data.token||'');
    if(r.data.refreshToken) localStorage.setItem('refreshToken',r.data.refreshToken);
    su(r.data.user||null);
    localStorage.setItem('currentUser',JSON.stringify(r.data.user||null));
    try{
      const lay=await api.get('/api/layout');
      localStorage.setItem('appLayout',JSON.stringify(lay.data||{}));
      await setLocale(lay.data?.settings?.locale||'en',lay.data?.settings||{});
      applyLayoutSettings(lay.data?.settings||{});
    }catch(_){
      await setLocale('en',{dir:'auto'});
    }
    window.location.href=`${window.location.origin}/#/apps`;
  };
  const logout=async()=>{
    await api.post('/api/auth/logout').catch(()=>{});
    api.token=null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    su(null);
  };
  return<AC.Provider value={{user:u,loading:l,login,logout}}>{children}</AC.Provider>}

// ═══════════════════════════════════════════════════
// ROUTER + MODAL + HELPERS
// ═══════════════════════════════════════════════════
function useRouter(){const[p,sp]=useState(window.location.hash.slice(1)||'/');useEffect(()=>{const h=()=>sp(window.location.hash.slice(1)||'/');window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h)},[]);
  return{path:p,nav:p=>{window.location.hash=p},param:k=>{const u=new URLSearchParams(window.location.hash.split('?')[1]||'');return u.get(k)}}}
function Modal({title,onClose,children,wide}){return<div className="mo" onClick={e=>e.target===e.currentTarget&&onClose()}><div className={'mdl'+(wide?' wide':'')}><div className="mdl-h"><h2>{title}</h2><button className="mdl-c" onClick={onClose}>×</button></div>{children}</div></div>}
function LoginPage(){const{login}=useContext(AC);const{t}=useI18n();const[un,sU]=useState('');const[pw,sP]=useState('');const[err,sE]=useState('');const[ld,sL]=useState(false);const[branding,sBranding]=useState({name:'',loginLogoUrl:''});
  useEffect(()=>{fetch('/api/public/branding').then(r=>r.json()).then(r=>{if(r&&r.success&&r.data)sBranding(r.data)}).catch(()=>{})},[]);
  const sub=async e=>{e.preventDefault();sE('');sL(true);try{await login(un,pw)}catch(e){sE(e.message)}sL(false)};
  return<div className="login-page"><div className="login-box"><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>{branding.loginLogoUrl?<img src={branding.loginLogoUrl} alt={branding.name||t('app.name','GymOS')} style={{width:56,height:56,objectFit:'contain',borderRadius:14,background:'rgba(255,255,255,.04)',padding:8,border:'1px solid var(--line)'}}/>:<Ic name='dumbbell' size={32}/>}<div><h1>{branding.name||t('app.name','GymOS')}</h1><p>{t('app.tagline','Smart Gym Management Platform')}</p></div></div>
    {err&&<div style={{color:'var(--red)',fontSize:13,marginBottom:14}}>{err}</div>}
    <form onSubmit={sub}><div className="fg"><label>{t('auth.username','Username')}</label><input className="fi" value={un} onChange={e=>sU(e.target.value)} placeholder={t('auth.username','Username')} autoFocus/></div>
    <div className="fg"><label>{t('auth.password','Password')}</label><input className="fi" type="password" value={pw} onChange={e=>sP(e.target.value)} placeholder={t('auth.password','Password')}/></div>
    <button className="btn btn-p btn-lg" disabled={ld}>{ld?<span className="spinner"/>:t('auth.signIn','Sign In')}</button></form></div></div>}

function timeSince(d){const ctx=window.GymOS.shared.getI18n?window.GymOS.shared.getI18n():{locale:'en',t:(k,f)=>f||k};const s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(Number.isNaN(s))return'—';if(s<60)return ctx.t('time.justNow',ctx.locale==='ar'?'الآن':'just now');if(s<3600){const v=Math.floor(s/60);return ctx.locale==='ar'?`${v} د`:`${v}m ago`}if(s<86400){const v=Math.floor(s/3600);return ctx.locale==='ar'?`${v} س`:`${v}h ago`}const days=Math.floor(s/86400);if(days<30)return ctx.locale==='ar'?`${days} ي`:`${days}d ago`;const months=Math.floor(days/30);return ctx.locale==='ar'?`${months} ش`:`${months}mo ago`}
function fullMemberName(m){return [m&&m.first_name,m&&m.middle_name,m&&m.last_name].filter(Boolean).join(' ').trim()}
function formatMoney(value,currency){const ctx=window.GymOS.shared.getI18n?window.GymOS.shared.getI18n():null;return ctx?.formatCurrency?ctx.formatCurrency(value,currency):String(value||0)}

// ═══ DASHBOARD ═══

function DashboardPage(){const[data,setData]=useState({loading:true,core:null,accounting:null,hr:null,purchase:null,cafeteria:null,training:null});const{nav}=useRouter();const{t,locale}=useI18n();const{user}=useContext(AC);const isAr=locale==='ar'; const [devMode,toggleDevMode,canUseDevMode]=useDeveloperMode(user); const [orderTick,setOrderTick]=useState(0); const [dragKey,setDragKey]=useState(null);
  const load=useCallback(async()=>{
    setData(p=>({...p,loading:true}));
    const wrap=(p)=>p.then(r=>r?.data||null).catch(()=>null);
    const [core,accounting,hr,purchase,cafeteria,training]=await Promise.all([
      wrap(api.get('/api/dashboard')),
      wrap(api.get('/api/accounting/dashboard')),
      wrap(api.get('/api/hr/dashboard')),
      wrap(api.get('/api/purchase/dashboard')),
      wrap(api.get('/api/cafeteria/dashboard')),
      wrap(api.get('/api/training/dashboard')),
    ]);
    setData({loading:false,core:core||{},accounting,hr,purchase,cafeteria,training});
  },[]);
  useEffect(()=>{load()},[load]);
  if(data.loading||!data.core)return<div className="pld"><span className="spinner"/></div>;
  const d=data.core||{};
  const moduleCards=[
    {key:'members',path:'/members',icon:'users',title:isAr?'الأعضاء':'Members',stats:[
      {label:isAr?'إجمالي الأعضاء':'Members',value:d.totalMembers||0,type:'count'},
      {label:isAr?'الاشتراكات الفعالة':'Active Memberships',value:d.activeMemberships||0,type:'count'},
      {label:isAr?'تنتهي قريباً':'Expiring Soon',value:d.expiringSoon||0,type:'count'},
    ]},
    {key:'accounting',path:'/accounting',icon:'package',title:isAr?'المحاسبة':'Accounting',stats:[
      {label:isAr?'إيراد الشهر':'Monthly Revenue',value:data.accounting?.monthlyRevenue||0,type:'money'},
      {label:isAr?'الذمم المفتوحة':'Open Receivables',value:data.accounting?.openReceivables||0,type:'money'},
      {label:isAr?'فواتير العملاء غير المسددة':'Unpaid Customer Invoices',value:data.accounting?.unpaidCustomerInvoices||0,type:'count'},
    ]},
    {key:'hr',path:'/hr',icon:'users',title:isAr?'الموارد البشرية':'HR',stats:[
      {label:isAr?'الموظفون النشطون':'Active Employees',value:data.hr?.activeEmployees||0,type:'count'},
      {label:isAr?'الحضور اليوم':'Present Today',value:data.hr?.presentToday||0,type:'count'},
      {label:isAr?'طلبات الإجازة المعلقة':'Pending Leaves',value:data.hr?.pendingLeaves||0,type:'count'},
    ]},
    {key:'purchase',path:'/purchase',icon:'package',title:isAr?'المشتريات':'Purchase',stats:[
      {label:isAr?'طلبات الشراء':'Purchase Orders',value:data.purchase?.poCount||0,type:'count'},
      {label:isAr?'بانتظار الاستلام':'To Receive',value:data.purchase?.toReceive||0,type:'count'},
      {label:isAr?'إنفاق الشهر':'MTD Spend',value:data.purchase?.mtdSpend||0,type:'money'},
    ]},
    {key:'cafeteria',path:'/cafeteria',icon:'package',title:isAr?'الكافتيريا':'Cafeteria',stats:[
      {label:isAr?'مبيعات اليوم':'Today Sales',value:data.cafeteria?.todaySales||0,type:'money'},
      {label:isAr?'طلبات اليوم':'Today Orders',value:data.cafeteria?.todayOrders||0,type:'count'},
      {label:isAr?'جلسات مفتوحة':'Open Sessions',value:data.cafeteria?.openSessions||0,type:'count'},
    ]},
    {key:'training',path:'/training',icon:'dumbbell',title:isAr?'التدريب':'Training',stats:[
      {label:isAr?'المشتركون في التدريب':'Enrolled Members',value:data.training?.enrolledMembers||0,type:'count'},
      {label:isAr?'البرامج':'Programs',value:data.training?.totalPrograms||0,type:'count'},
      {label:isAr?'تقدم اليوم':'Progress Today',value:data.training?.progressToday||0,type:'count'},
    ]},
  ];
  const orderedModuleCards=sortModulesByPreference(moduleCards); const moduleKeys=orderedModuleCards.map(m=>m.key); const moveDashboardCard=(key,dir)=>{moveModulePreference(key,dir,moduleKeys);setOrderTick(v=>v+1)}; const reorderDashboardCard=(fromKey,toKey)=>{if(!fromKey||!toKey||fromKey===toKey)return;reorderModulePreference(fromKey,toKey,moduleKeys);setOrderTick(v=>v+1)}; const resetDashboardOrder=()=>{localStorage.removeItem(MODULE_ORDER_KEY);setOrderTick(v=>v+1)}; const fmt=(item)=>item.type==='money'?formatMoney(item.value||0):String(item.value||0);
  const recentActivity=d.recentActivity||[];
  const lowStock=(data.cafeteria?.lowStock||[]).slice(0,6);
  const upcomingContracts=(data.hr?.upcomingContracts||[]).slice(0,6);
  const recentOrders=(data.purchase?.recentOrders||[]).slice(0,6);
  return <div className='o-main-dashboard' key={orderTick}>
    <div className="o-main-control">
      <div>
        <div className='o-main-caption'>{isAr?'نظرة عامة':'Overview'}</div>
        <h1>{isAr?'لوحة التحكم الرئيسية':'Main Dashboard'}</h1>
        <p>{isAr?'ملخص تشغيلي موحد بأسلوب Odoo لكل الوحدات الرئيسية':'Unified Odoo-style operational summary across the main apps'}</p>
      </div>
      <div className="o-main-control-actions">
        {canUseDevMode&&<button type='button' className={'btn btn-s o-dev-toggle'+(devMode?' ac':'')} onClick={toggleDevMode}>{devMode?(isAr?'وضع المطور: مفعل':'Developer Mode: On'):(isAr?'وضع المطور':'Developer Mode')}</button>}
        {devMode&&<button type='button' className='btn btn-s' onClick={resetDashboardOrder}><Ic name='refresh-ccw' size={15}/>{isAr?'إعادة ترتيب افتراضي':'Reset Order'}</button>}
        <button type='button' className='btn btn-s' onClick={()=>nav('/apps')}><Ic name='grid' size={15}/>{isAr?'كل التطبيقات':'All Apps'}</button>
        <button type='button' className='btn btn-p' onClick={load}><Ic name='refresh' size={15}/>{isAr?'تحديث':'Refresh'}</button>
      </div>
    </div>
    <div className="o-main-kpis">
      <div className="o-kpi-card o-kpi-link" role='button' tabIndex={0} onClick={()=>nav('/members')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();nav('/members')}}}><div className="o-kpi-top"><span className="o-kpi-label">{isAr?'الأعضاء':'Members'}</span><span className="o-kpi-icon m-members"><Ic name='users' size={17}/></span></div><div className="o-kpi-value">{d.totalMembers||0}</div><div className="o-kpi-sub">{d.activeMembers||0} {isAr?'نشط':'active'}</div></div>
      <div className="o-kpi-card o-kpi-link" role='button' tabIndex={0} onClick={()=>nav('/memberships')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();nav('/memberships')}}}><div className="o-kpi-top"><span className="o-kpi-label">{isAr?'الاشتراكات':'Memberships'}</span><span className="o-kpi-icon m-branches"><Ic name='calendar' size={17}/></span></div><div className="o-kpi-value">{d.activeMemberships||0}</div><div className="o-kpi-sub">{d.expiringSoon||0} {isAr?'تنتهي قريباً':'expiring soon'}</div></div>
      <div className="o-kpi-card o-kpi-link" role='button' tabIndex={0} onClick={()=>nav('/attendance')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();nav('/attendance')}}}><div className="o-kpi-top"><span className="o-kpi-label">{isAr?'الحضور اليوم':'Check-ins Today'}</span><span className="o-kpi-icon m-engagement"><Ic name='activity' size={17}/></span></div><div className="o-kpi-value">{d.todayCheckins||0}</div><div className="o-kpi-sub">{d.currentlyInGym||0} {isAr?'في الجيم الآن':'in the gym now'}</div></div>
      <div className="o-kpi-card o-kpi-link" role='button' tabIndex={0} onClick={()=>nav('/accounting')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();nav('/accounting')}}}><div className="o-kpi-top"><span className="o-kpi-label">{isAr?'إيراد الشهر':'Revenue This Month'}</span><span className="o-kpi-icon m-accounting"><Ic name='trending-up' size={17}/></span></div><div className="o-kpi-value">{formatMoney(d.revenueThisMonth||0)}</div><div className="o-kpi-sub">{isAr?'من الاشتراكات الحالية':'from active subscriptions'}</div></div>
      <div className="o-kpi-card o-kpi-link" role='button' tabIndex={0} onClick={()=>nav('/members?filter=new_this_week')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();nav('/members?filter=new_this_week')}}}><div className="o-kpi-top"><span className="o-kpi-label">{isAr?'الأعضاء الجدد هذا الشهر':'New This Month'}</span><span className="o-kpi-icon m-purchase"><Ic name='user-plus' size={17}/></span></div><div className="o-kpi-value">{d.newMembersThisMonth||0}</div><div className="o-kpi-sub">{isAr?'أعضاء جدد':'new members'}</div></div>
      <div className="o-kpi-card warn o-kpi-link" role='button' tabIndex={0} onClick={()=>nav('/members?filter=at_risk')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();nav('/members?filter=at_risk')}}}><div className="o-kpi-top"><span className="o-kpi-label">{isAr?'بحاجة لمتابعة':'At Risk'}</span><span className="o-kpi-icon m-operations"><Ic name='alert-triangle' size={17}/></span></div><div className="o-kpi-value">{d.atRiskMembers||0}</div><div className="o-kpi-sub">{isAr?'يتطلبون متابعة':'need attention'}</div></div>
    </div>

    <div className='o-modules-board'>
      <div className='o-section-head'>
        <h2>{isAr?'ملخص الوحدات':'Module Summary'}</h2>
        <span>{isAr?'نظرة سريعة على أهم المؤشرات في كل وحدة':'Quick business snapshot for each main app'}</span>
      </div>
      <div className='o-modules-grid'>
        {orderedModuleCards.map((card,idx)=><div key={card.key} className={'o-module-summary-wrap'+(devMode?' dev':'')+(dragKey===card.key?' dragging':'')} draggable={devMode} onDragStart={()=>setDragKey(card.key)} onDragEnd={()=>setDragKey(null)} onDragOver={e=>{if(devMode)e.preventDefault()}} onDrop={e=>{e.preventDefault();reorderDashboardCard(dragKey,card.key);setDragKey(null)}}><button type='button' className='o-module-summary-card' onClick={()=>nav(card.path)}>
          <div className='o-module-summary-head'>
            <span className={'o-module-summary-icon m-'+card.key}><Ic name={card.icon} size={22}/></span>
            <div className='o-module-summary-title'>{card.title}</div>
            <span className='o-module-summary-open'>{isAr?'فتح':'Open'}</span>
          </div>
          <div className='o-module-summary-stats'>
            {card.stats.map((stat,idx)=><div className='o-module-stat' key={idx}><div className='o-module-stat-label'>{stat.label}</div><div className='o-module-stat-value'>{fmt(stat)}</div></div>)}
          </div>
        </button>{devMode&&<div className='o-dev-order-controls inline'><button type='button' className='o-dev-order-btn' disabled={idx===0} onClick={()=>moveDashboardCard(card.key,-1)}>↑</button><button type='button' className='o-dev-order-btn' disabled={idx===orderedModuleCards.length-1} onClick={()=>moveDashboardCard(card.key,1)}>↓</button><span className='o-dev-drag-hint'>{isAr?'اسحب':'Drag'}</span></div>}</div>)}
      </div>
    </div>

    <div className='o-main-two-col'>
      <div className='card o-activity-card'>
        <div className='ct'>{isAr?'النشاط الأخير':'Recent Activity'}</div>
        {recentActivity.length?<table><thead><tr><th>{isAr?'الإجراء':'Action'}</th><th>{isAr?'المستخدم':'User'}</th><th>{isAr?'الوقت':'Time'}</th></tr></thead><tbody>{recentActivity.map(a=><tr key={a.id}><td>{a.action}</td><td>{a.full_name||a.username||'—'}</td><td style={{fontSize:12,color:'var(--tx-3)'}}>{timeSince(a.created_at)}</td></tr>)}</tbody></table>:<div className='empty'><h3>{isAr?'لا يوجد نشاط حديث':'No recent activity'}</h3></div>}
      </div>
      <div className='card o-alerts-card'>
        <div className='ct'>{isAr?'التنبيهات التشغيلية':'Operational Alerts'}</div>
        {d.alerts?.length?d.alerts.map((a,i)=><button type='button' key={i} className={'alert-card a-'+a.type+' o-alert-row'} onClick={()=>a.link&&nav(a.link)}><span className='o-alert-arrow'>←</span><div className='at'>{isAr?a.text.replace(/membership\(s\)/g,'اشتراك').replace(/expiring within 3 days/g,'تنتهي خلال 3 أيام').replace(/active membership\(s\) with unpaid balance/g,'اشتراكات فعالة عليها رصيد غير مدفوع').replace(/member\(s\) without active membership/g,'عضو بدون اشتراك فعال').replace(/active member\(s\) haven\'t visited in 14\+ days/g,'أعضاء نشطون لم يزوروا النادي منذ 14 يوماً'):a.text}</div></button>):<div className='empty'><h3>{isAr?'لا توجد تنبيهات حالياً':'No alerts right now'}</h3></div>}
      </div>
    </div>

    <div className='o-main-bottom-grid'>
      <div className='card'>
        <div className='ct'>{isAr?'عقود الموظفين القريبة':'Upcoming HR Contracts'}</div>
        {upcomingContracts.length?<table><thead><tr><th>{isAr?'الموظف':'Employee'}</th><th>{isAr?'المرجع':'Reference'}</th><th>{isAr?'تاريخ النهاية':'End Date'}</th></tr></thead><tbody>{upcomingContracts.map(row=><tr key={row.id}><td>{row.full_name}</td><td>{row.contract_ref||'—'}</td><td>{row.end_date||'—'}</td></tr>)}</tbody></table>:<div className='empty'><h3>{isAr?'لا توجد عقود قريبة':'No upcoming contracts'}</h3></div>}
      </div>
      <div className='card'>
        <div className='ct'>{isAr?'أحدث أوامر الشراء':'Recent Purchase Orders'}</div>
        {recentOrders.length?<table><thead><tr><th>{isAr?'المورد':'Vendor'}</th><th>{isAr?'الحالة':'State'}</th><th>{isAr?'الإجمالي':'Total'}</th></tr></thead><tbody>{recentOrders.map(row=><tr key={row.id}><td>{row.vendor_name||'—'}</td><td><span className={'badge b-'+(row.state||'unknown')}>{row.state||'—'}</span></td><td>{formatMoney(row.total_amount||0)}</td></tr>)}</tbody></table>:<div className='empty'><h3>{isAr?'لا توجد أوامر شراء حديثة':'No recent purchase orders'}</h3></div>}
      </div>
      <div className='card'>
        <div className='ct'>{isAr?'مخزون منخفض في الكافتيريا':'Cafeteria Low Stock'}</div>
        {lowStock.length?<table><thead><tr><th>{isAr?'الصنف':'Product'}</th><th>{isAr?'الكمية الحالية':'On Hand'}</th><th>{isAr?'حد التنبيه':'Threshold'}</th></tr></thead><tbody>{lowStock.map(row=><tr key={row.id}><td>{isAr?(row.name_ar||row.name):row.name}</td><td>{row.qty_on_hand}</td><td>{row.low_stock_threshold}</td></tr>)}</tbody></table>:<div className='empty'><h3>{isAr?'لا يوجد مخزون منخفض':'No low-stock items'}</h3></div>}
      </div>
    </div>
  </div>}

// ═══ MEMBERS ═══

function MemberTrainingTab({memberId,memberName}){const{t,locale,formatDate}=useI18n();const isAr=locale==='ar';const[data,setData]=useState(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{setLoading(true);api.get('/api/training/members/'+memberId).then(r=>setData(r.data)).catch(()=>setData(null)).finally(()=>setLoading(false))},[memberId]);
  if(loading)return<div className="pld"><span className="spinner"/></div>;
  if(!data)return<div className="empty"><h3>{isAr?'لم يتم تسجيل هذا العضو في نظام التدريب بعد — اختر المستوى عند تعديل بيانات العضو':'This member is not enrolled in training yet — select experience level when editing member profile'}</h3></div>;
  const levelMap={beginner:{en:'Beginner',ar:'مبتدئ',cls:'trn-level-beginner'},mid:{en:'Intermediate',ar:'متوسط',cls:'trn-level-mid'},expert:{en:'Expert',ar:'متقدم',cls:'trn-level-expert'}};
  const lv=levelMap[data.experience_level]||levelMap.beginner;
  const days={};(data.exercises||[]).forEach(e=>{if(!days[e.day_number])days[e.day_number]=[];days[e.day_number].push(e)});
  return<div style={{display:'grid',gap:14}}>
    <div className="dg"><div className="di"><div className="dl">{isAr?'المستوى':'Level'}</div><div className="dv"><span className={`trn-level ${lv.cls}`}>{isAr?lv.ar:lv.en}</span></div></div>
    <div className="di"><div className="dl">{isAr?'البرنامج':'Program'}</div><div className="dv">{isAr?data.program_name_ar||data.program_name||'—':data.program_name||'—'}</div></div>
    <div className="di"><div className="dl">{isAr?'العمر':'Age'}</div><div className="dv">{data.age||'—'}</div></div>
    <div className="di"><div className="dl">{isAr?'الهدف':'Goal'}</div><div className="dv">{data.fitness_goal||'—'}</div></div>
    <div className="di"><div className="dl">{isAr?'المدة':'Duration'}</div><div className="dv">{data.duration_weeks||'—'} {isAr?'أسبوع':'weeks'} · {data.days_per_week||'—'} {isAr?'يوم/أسبوع':'days/wk'}</div></div></div>
    {Object.keys(days).length===0?<div className="empty"><h3>{isAr?'لا توجد تمارين مخصصة':'No exercises assigned'}</h3></div>:
    Object.entries(days).map(([day,exs])=><div key={day}><h3 style={{fontSize:14,fontWeight:600,marginBottom:8}}>{isAr?`اليوم ${day}`:`Day ${day}`}</h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10}}>
    {exs.map(e=><div key={e.id} style={{background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:'var(--r)',overflow:'hidden'}}>
      {e.image_url?<img src={e.image_url} alt={e.name} style={{width:'100%',height:120,objectFit:'cover',background:'var(--bg-3)'}} onError={ev=>{ev.target.style.display='none'}}/>:<div style={{width:'100%',height:120,background:'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>{e.category_icon||<Ic name='dumbbell' size={32}/>}</div>}
      <div style={{padding:10}}><div style={{fontSize:13,fontWeight:600}}>{isAr?e.name_ar||e.name:e.name}</div>
      <div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>{e.muscle_group||'—'} · {e.sets}×{e.reps}</div>
      {e.video_url&&<a href={e.video_url} target="_blank" rel="noopener" style={{fontSize:12,color:'var(--accent-h)',marginTop:4,display:'inline-block'}}>▶ {isAr?'شاهد الفيديو':'Watch Video'}</a>}
      </div></div>)}</div></div>)}
    {(data.progress||[]).length>0&&<div><h3 style={{fontSize:14,fontWeight:600,marginBottom:8}}>{isAr?'آخر التمارين المسجلة':'Recent Progress'}</h3>
    <table><thead><tr><th>{isAr?'التمرين':'Exercise'}</th><th>{isAr?'مجموعات':'Sets'}</th><th>{isAr?'تكرارات':'Reps'}</th><th>{isAr?'الوزن':'Weight'}</th><th>{isAr?'التاريخ':'Date'}</th></tr></thead>
    <tbody>{data.progress.slice(0,10).map(p=><tr key={p.id}><td>{isAr?p.name_ar||p.name:p.name}</td><td>{p.sets_completed}</td><td>{p.reps_completed}</td><td>{p.weight_used?p.weight_used+' kg':'—'}</td><td style={{fontSize:12,color:'var(--t3)'}}>{formatDate(p.completed_at)}</td></tr>)}</tbody></table></div>}
  </div>}


function MemberForm({member,onSave,onClose}){const{t,locale}=useI18n();const isAr=locale==='ar';const[f,sF]=useState({first_name:member?.first_name||'',middle_name:member?.middle_name||'',last_name:member?.last_name||'',phone:member?.phone||'',email:member?.email||'',gender:member?.gender||'male',date_of_birth:member?.date_of_birth||'',joined_date:member?.joined_date||new Date().toISOString().split('T')[0],status:member?.status||'inactive',experience_level:member?.experience_level||'beginner',notes:member?.notes||''});const s=(k,v)=>sF(p=>({...p,[k]:v}));const sub=e=>{e.preventDefault();onSave&&onSave(f)};return<form onSubmit={sub}><div className='o-member-form-grid'><div className='fg'><label>{t('members.firstName','الاسم الأول')}</label><input className='fi' value={f.first_name} onChange={e=>s('first_name',e.target.value)}/></div><div className='fg'><label>{isAr?'اسم الأب':'Father Name'}</label><input className='fi' value={f.middle_name} onChange={e=>s('middle_name',e.target.value)}/></div><div className='fg'><label>{t('members.lastName','اسم العائلة')}</label><input className='fi' value={f.last_name} onChange={e=>s('last_name',e.target.value)}/></div><div className='fg'><label>{t('common.phone','رقم الهاتف')}</label><input className='fi' value={f.phone} onChange={e=>s('phone',e.target.value)}/></div><div className='fg'><label>{t('common.email','البريد الإلكتروني')}</label><input className='fi' type='email' value={f.email} onChange={e=>s('email',e.target.value)}/></div><div className='fg'><label>{t('common.gender','الجنس')}</label><select className='fi' value={f.gender} onChange={e=>s('gender',e.target.value)}><option value='male'>{t('common.male','ذكر')}</option><option value='female'>{t('common.female','أنثى')}</option></select></div><div className='fg'><label>{t('members.dob','تاريخ الميلاد')}</label><input className='fi' type='date' value={f.date_of_birth||''} onChange={e=>s('date_of_birth',e.target.value)}/></div><div className='fg'><label>{t('members.joined','تاريخ الانضمام')}</label><input className='fi' type='date' value={f.joined_date||''} onChange={e=>s('joined_date',e.target.value)}/></div><div className='fg'><label>{t('common.status','الحالة')}</label><select className='fi' value={f.status} onChange={e=>s('status',e.target.value)}><option value='active'>{t('status.active','نشط')}</option><option value='inactive'>{t('status.inactive','غير نشط')}</option><option value='frozen'>{t('status.frozen','مجمّد')}</option></select></div><div className='fg'><label>{t('members.experience','مستوى الخبرة')}</label><select className='fi' value={f.experience_level} onChange={e=>s('experience_level',e.target.value)}><option value='beginner'>{t('training.beginner','مبتدئ')}</option><option value='mid'>{t('training.intermediate','متوسط')}</option><option value='expert'>{t('training.expert','متقدم')}</option></select></div><div className='fg full'><label>{t('common.notes','ملاحظات')}</label><textarea className='fi' rows='5' value={f.notes} onChange={e=>s('notes',e.target.value)}/></div></div><button id='member-form-submit' type='submit' hidden />{onClose?<button type='button' hidden onClick={onClose}></button>:null}</form>}
function MemberChatter({memberId}){
  const{locale}=useI18n();const isAr=locale==='ar';
  const[tab,sTab]=useState('note');const[mtype,sMtype]=useState('notif');
  const[log,sLog]=useState(null);const[txt,sTxt]=useState('');const[busy,sBusy]=useState(false);
  const load=useCallback(()=>{api.get('/api/members/'+memberId+'/timeline').then(r=>sLog(r.data||[])).catch(()=>sLog([]))},[memberId]);
  useEffect(()=>{load()},[load]);
  const post=async(type)=>{const content=txt.trim();if(!content)return;sBusy(true);try{const r=await api.post('/api/members/'+memberId+'/notes',{content,type});const d=r.data||{};if(type!=='note'){if(d.sent===true)toast(isAr?'تم الإرسال':'Sent');else if(d.sent===false)toast((isAr?'لم يُرسل: ':'Not sent: ')+(d.error||''),'e');else toast(isAr?'تم التسجيل':'Logged');}else{toast(isAr?'تمت الإضافة':'Added');}sTxt('');await load();}catch(e){toast(e.message,'e')}sBusy(false)};
  const styleFor=ty=>{ty=String(ty||'');if(/pay/.test(ty))return{c:'#22c55e',bg:'#f0fdf4',lb:isAr?'دفع':'Pay'};if(/debt|due/.test(ty))return{c:'#ef4444',bg:'#fff1f1',lb:isAr?'دين':'Debt'};if(ty==='sms')return{c:'#f59e0b',bg:'#fffbeb',lb:'SMS'};if(ty==='wa')return{c:'#25d366',bg:'#f0fdf4',lb:isAr?'واتساب':'WA'};if(ty==='email')return{c:'#0ea5e9',bg:'#e0f2fe',lb:isAr?'بريد':'Email'};if(ty==='notif')return{c:'var(--o-brand)',bg:'var(--o-brand-soft)',lb:isAr?'إشعار':'Notif'};return{c:'var(--o-brand)',bg:'var(--o-brand-soft)',lb:'م'};};
  const niceDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const p=s.split('-');const AR=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];const EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return (+p[2])+' '+(isAr?AR:EN)[(+p[1])-1]+' '+p[0];};
  const mtypes=[['notif',isAr?'إشعار':'Notification'],['wa',isAr?'واتساب':'WhatsApp'],['email',isAr?'بريد':'Email'],['sms','SMS']];
  return <div className='o-chatter'>
    <div className='o-chatter-tabs'>
      <button type='button' className={'o-chatter-tab'+(tab==='note'?' ac':'')} onClick={()=>sTab('note')}>{isAr?'تسجيل ملاحظة':'Log note'}</button>
      <button type='button' className={'o-chatter-tab'+(tab==='msg'?' ac':'')} onClick={()=>sTab('msg')}>{isAr?'إرسال رسالة':'Send message'}</button>
    </div>
    <div className='o-chatter-compose'>
      {tab==='msg'&&<div className='o-chatter-mtypes'>{mtypes.map(([k,l])=><button type='button' key={k} className={'o-chatter-mtype'+(mtype===k?' ac t-'+k:'')} onClick={()=>sMtype(k)}>{l}</button>)}</div>}
      <textarea className='fi o-chatter-ta' rows='4' value={txt} onChange={e=>sTxt(e.target.value)} placeholder={tab==='note'?(isAr?'اكتب ملاحظتك هنا...':'Write a note...'):(isAr?'اكتب رسالتك هنا...':'Write a message...')}/>
      <div className='o-chatter-actions'>
        <button type='button' className='btn btn-p btn-sm' disabled={busy||!txt.trim()} onClick={()=>post(tab==='note'?'note':mtype)}>{tab==='note'?(isAr?'إضافة':'Add'):(isAr?'إرسال':'Send')}</button>
        <button type='button' className='btn btn-s btn-sm' onClick={()=>sTxt('')}>{isAr?'إلغاء':'Cancel'}</button>
      </div>
    </div>
    <div className='o-chatter-log'>
      {log===null?<div className='o-chatter-empty'><span className='spinner'/></div>:log.length?log.map((e,i)=>{const st=styleFor(e.type);return <div key={e.id||i} className='o-chatter-entry'>
        <div className='o-chatter-av' style={{background:st.bg,color:st.c}}>{st.lb}</div>
        <div className='o-chatter-body'>
          <div className='o-chatter-meta'>{(isAr?(e.title_ar||e.title):e.title)||(isAr?'مدير النظام':'System')} • {niceDate(e.created_at)}</div>
          <div className='o-chatter-text' style={{background:st.bg,borderInlineStartColor:st.c}}>{(isAr?(e.description_ar||e.description):e.description)||(isAr?(e.title_ar||e.title):e.title)||'—'}</div>
        </div>
      </div>;}):<div className='o-chatter-empty'>{isAr?'لا يوجد نشاط بعد':'No activity yet'}</div>}
    </div>
  </div>;
}
function MembersPage(){const{t,locale}=useI18n();const isAr=locale==='ar';const[ms,sMs]=useState([]);const[meta,sMeta]=useState({total:0,page:1});const[search,sSrch]=useState('');const[sf,sSf]=useState('');const[showForm,sSF]=useState(false);const[editing,sEd]=useState(null);const[viewing,sView]=useState(null);const[formKey,sFormKey]=useState(0);const[dupError,sDupError]=useState(null);const[debtGate,sDebtGate]=useState(null);const{param,nav}=useRouter();
  const[preset,sPreset]=useState(param('filter')||'all');const[counts,sCounts]=useState({});const[lifecycle,sLifecycle]=useState('');const[risk,sRisk]=useState('');const[sortBy,sSortBy]=useState('created_at');const[sortOrder,sSortOrder]=useState('desc');const[viewMode,sViewMode]=useState('list');const openMemberId=param('open');const editMemberId=param('edit');
  useEffect(()=>{api.get('/api/members/stats').then(r=>sCounts(r.data||{})).catch(()=>{})},[]);
  useEffect(()=>{if(openMemberId)sView(openMemberId)},[openMemberId]);useEffect(()=>{sDupError(null);if(!editMemberId)return; if(editMemberId==='new'){sEd(null);sFormKey(k=>k+1);return;} api.get('/api/members/'+editMemberId).then(r=>api.get('/api/training/members/'+editMemberId).then(tr=>({member:r.data,exp:tr.data?.experience_level||''})).catch(()=>({member:r.data,exp:r.data?.experience_level||''}))).then(({member,exp})=>{sEd({...member,experience_level:exp});sFormKey(k=>k+1)}).catch(()=>{})},[editMemberId]);
  const presets=[
    {id:'all',label:isAr?'الكل':'All',count:counts.total},
    {id:'new_this_week',label:isAr?'أعضاء جدد':'New',count:counts.newThisMonth},
    {id:'old_members',label:isAr?'أعضاء قدامى':'Old',count:null},
    {id:'no_membership',label:isAr?'بدون اشتراك':'No membership',count:null},
    {id:'unpaid',label:isAr?'غير مدفوع':'Not paid',count:null},
    {id:'expired',label:isAr?'منتهي':'Expired',count:null},
    {id:'expiring_soon',label:isAr?'ينتهي قريباً':'Expiring soon',count:null},
    {id:'new_renewals',label:isAr?'تجديدات جديدة':'New renewals',count:null},
    {id:'at_risk',label:isAr?'بحاجة لمتابعة':'At risk',count:counts.atRisk},
  ];
  const load=useCallback((page=1)=>{const p=new URLSearchParams({page,limit:20,search,status:sf,sort:sortBy,order:sortOrder});if(lifecycle)p.set('lifecycle',lifecycle);if(risk)p.set('risk',risk);if(preset&&preset!=='all')p.set('filter',preset);
    api.get('/api/members?'+p).then(r=>{sMs(r.data);sMeta(r.meta)}).catch(()=>{})},[search,sf,preset,lifecycle,risk,sortBy,sortOrder]);useEffect(()=>{load()},[load]);
  const doSave=async data=>{sDupError(null);try{let memberId=editing?.id;if(editing?.id){await api.put('/api/members/'+editing.id,data);toast(t('btn.save'))}else{const r=await api.post('/api/members',data);memberId=r.data?.id;toast(t('btn.create'))}if(memberId&&data.experience_level){try{await api.post('/api/training/onboard',{member_id:memberId,date_of_birth:data.date_of_birth||'',experience_level:data.experience_level,fitness_goal:'general'})}catch(_){}}sSF(false);sEd(null);nav('/members?open='+(memberId||editing?.id||viewing||''));if(!memberId&&!editing?.id&&!viewing)load()}catch(e){const ex=e.status===409&&e.data&&e.data.existingMember;if(ex){sDupError({field:e.data.field,member:ex});return}toast(e.message,'e')}};
  const save=async data=>{
    // Guard: deactivating a member who still owes money → confirm & offer to collect first.
    if(data.status==='inactive' && editing?.id && editing.status!=='inactive'){
      try{const bal=(await api.get('/api/members/'+editing.id+'/balance')).data;if(bal&&bal.total>0.009){sDebtGate({data,balance:bal});return;}}catch(_){}
    }
    return doSave(data);
  };
  const openEdit=(m)=>{nav('/members?edit='+m.id)};
  const openCreate=()=>{nav('/members?edit=new')};
  if(editMemberId){if(editMemberId!=='new'&&!editing)return <div className='o-module-page'><div className='o-form-shell'><div className='o-form-sheet'><div className='o-form-sheet-header'><div><h1>{t('members.editMember','تعديل عضو')}</h1><p>{isAr?'جاري تحميل بيانات العضو':'Loading member data'}</p></div><div className='acts'><button className='btn btn-s' onClick={()=>nav(viewing?('/members?open='+viewing):'/members')}>{t('btn.cancel','إلغاء')}</button></div></div><div className='o-sheet-inner'><div className='pld'><span className='spinner'/></div></div></div></div></div>;return <div className='o-module-page'><div className='o-form-shell'><div className='o-form-sheet'><div className='o-form-sheet-header'><div><h1>{editMemberId==='new'?t('members.newMember','إضافة عضو'):t('members.editMember','تعديل عضو')}</h1><p>{isAr?'نموذج كامل داخل الصفحة بدون نافذة منبثقة':'Full-page member form without popup'}</p></div><div className='acts'><button className='btn btn-p' onClick={()=>document.getElementById('member-form-submit')?.click()}>{t('btn.save','حفظ')}</button><button className='btn btn-s' onClick={()=>nav(viewing?('/members?open='+viewing):'/members')}>{t('btn.cancel','إلغاء')}</button></div></div><div className='o-sheet-inner'>{dupError&&<div style={{background:'rgba(245,158,11,.14)',border:'1px solid rgba(245,158,11,.5)',borderRadius:10,padding:'12px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><Ic name='alert-triangle' size={18}/><span>{dupError.field==='email'?(isAr?'يوجد عضو مسجّل بنفس البريد الإلكتروني.':'A member with this email already exists.'):(isAr?'يوجد عضو مسجّل بنفس رقم الهاتف.':'A member with this phone number already exists.')}</span><a onClick={()=>nav('/members?edit='+dupError.member.id)} style={{color:'var(--accent,#714B67)',fontWeight:800,cursor:'pointer',textDecoration:'underline'}}>{(isAr?'تابع التعديل من هنا: ':'Continue editing here: ')+(dupError.member.name?dupError.member.name+' ('+dupError.member.member_no+')':dupError.member.member_no)}</a></div>}<MemberForm key={formKey} member={editMemberId==='new'?null:editing} onSave={save} onClose={()=>nav(viewing?('/members?open='+viewing):'/members')}/></div></div>{editMemberId!=='new'&&editing&&editing.id?<MemberChatter memberId={editing.id}/>:null}{debtGate&&<Modal title={isAr?'العضو عليه رصيد مستحق':'Member has an outstanding balance'} onClose={()=>sDebtGate(null)}>
    <div className='mdl-b' dir={isAr?'rtl':'ltr'} style={{display:'grid',gap:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.3)',borderRadius:12,padding:'12px 14px'}}><Ic name='alert-triangle' size={20}/><div><div style={{fontWeight:800,fontSize:15}}>{[editing?.first_name,editing?.middle_name,editing?.last_name].filter(Boolean).join(' ')}</div><div style={{fontSize:12,color:'var(--t3)'}}>{[editing?.member_no,editing?.phone].filter(Boolean).join(' · ')}</div></div></div>
      <div style={{textAlign:'center',padding:'4px 0'}}><div style={{fontSize:12,color:'var(--t3)'}}>{isAr?'إجمالي المبلغ المستحق':'Total outstanding'}</div><div style={{fontSize:28,fontWeight:800,color:'#ef4444'}}>{formatMoney(debtGate.balance.total)}</div></div>
      <div style={{display:'grid',gap:8}}>
        {debtGate.balance.memberships>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'9px 12px',background:'var(--panel-2,#f6f6f9)',borderRadius:8}}><span>{isAr?'رصيد اشتراكات':'Membership balance'} ({debtGate.balance.membershipCount})</span><b>{formatMoney(debtGate.balance.memberships)}</b></div>}
        {debtGate.balance.cafeteria>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'9px 12px',background:'var(--panel-2,#f6f6f9)',borderRadius:8}}><span>{isAr?'دين الكافتيريا':'Cafeteria debt'} ({debtGate.balance.cafeteriaCount})</span><b>{formatMoney(debtGate.balance.cafeteria)}</b></div>}
        {debtGate.balance.freezes>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'9px 12px',background:'var(--panel-2,#f6f6f9)',borderRadius:8}}><span>{isAr?'رسوم تجميد':'Freeze fees'} ({debtGate.balance.freezeCount})</span><b>{formatMoney(debtGate.balance.freezes)}</b></div>}
      </div>
      <p style={{fontSize:13,color:'var(--t3)',margin:0}}>{isAr?'سيبقى الرصيد مسجّلاً وظاهراً للإدارة حتى بعد التعطيل. هل تريد المتابعة؟':'The balance stays recorded and visible to admins even after deactivation. Continue?'}</p>
    </div>
    <div className='mdl-f' style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
      <button className='btn btn-s' onClick={()=>sDebtGate(null)}>{isAr?'إلغاء':'Cancel'}</button>
      {debtGate.balance.cafeteria>0&&<button className='btn btn-s' onClick={()=>{sDebtGate(null);nav('/cafeteria-debts')}}><Ic name='shopping-cart' size={14}/> {isAr?'تحصيل دين الكافتيريا':'Collect cafeteria debt'}</button>}
      {debtGate.balance.memberships>0&&<button className='btn btn-s' onClick={()=>{const id=editing.id;sDebtGate(null);nav('/members?open='+id)}}><Ic name='credit-card' size={14}/> {isAr?'تحصيل دفعة الاشتراك':'Collect membership payment'}</button>}
      <button className='btn btn-p' style={{background:'#ef4444',borderColor:'#ef4444'}} onClick={()=>{const dd=debtGate.data;sDebtGate(null);doSave(dd)}}>{isAr?'تعطيل رغم ذلك':'Deactivate anyway'}</button>
    </div>
  </Modal>}</div></div>}
  if(viewing)return <MemberDetail key={`${viewing}-${editing?.id||0}`} id={viewing} onBack={()=>{sView(null);nav('/members');load(meta.page||1)}} onEdit={openEdit}/>;
  const kpiCards=[
    {label:isAr?'إجمالي الأعضاء':'Total Members',value:counts.total||0,sub:`${counts.active||0} ${isAr?'نشط':'active'}`},
    {label:isAr?'أعضاء جدد هذا الشهر':'New This Month',value:counts.newThisMonth||0,sub:isAr?'حركة تسجيل جديدة':'new registrations'},
    {label:isAr?'ينتهون قريباً':'Expiring Soon',value:counts.expiringSoon||0,sub:isAr?'بحاجة متابعة':'follow up needed'},
    {label:isAr?'مجمّدون':'Frozen',value:counts.frozen||0,sub:isAr?'اشتراكات مجمّدة':'members on freeze'},
  ];
  const kanbanCols=[{key:'active',label:isAr?'نشط':'Active'},{key:'inactive',label:isAr?'غير نشط':'Inactive'},{key:'frozen',label:isAr?'مجمّد':'Frozen'}];
  const grouped={active:[],inactive:[],frozen:[]};ms.forEach(m=>{if(grouped[m.status])grouped[m.status].push(m);else grouped.active.push(m)});
  return <div className='o-module-page'>
    <div className='o-module-titlebar'>
      <div><h1>{isAr?'الأعضاء':'Members'}</h1><p>{isAr?'إدارة الأعضاء والاشتراكات من شاشة موحدة على نمط أودو':'Unified member workspace with Odoo-style control panel and views'}</p></div>
    </div>
    <div className='o-kpi-grid compact'>{kpiCards.map((k,i)=><div key={i} className='o-kpi-card'><div className='o-kpi-label'>{k.label}</div><div className='o-kpi-value'>{k.value}</div><div className='o-kpi-sub'>{k.sub}</div></div>)}</div>
    <div className='o-control-panel-shell'>
      <div className='o-control-panel-main'>
        <div className='o-control-panel-left'>
          <button type='button' className='btn btn-p' onClick={openCreate}><Ic name='plus' size={14}/>{t('members.addMember')}</button>
          <div className='o-view-switch'><button type='button' className={'o-view-btn'+(viewMode==='list'?' ac':'')} onClick={()=>sViewMode('list')}><Ic name='menu' size={15}/></button><button type='button' className={'o-view-btn'+(viewMode==='kanban'?' ac':'')} onClick={()=>sViewMode('kanban')}><Ic name='grid' size={15}/></button></div>
        </div>
        <div className='o-control-panel-right'>
          <div className='o-searchbox'><Ic name='search' size={15}/><input className='fi clean' placeholder={isAr?'بحث بالاسم أو الرقم أو الهاتف...':'Search by member, number, or phone...'} value={search} onChange={e=>sSrch(e.target.value)}/></div>
          <select className='fi o-fi-sm' value={sf} onChange={e=>sSf(e.target.value)}><option value="">{isAr?'كل الحالات':'All Status'}</option><option value="active">{t('status.active')}</option><option value="inactive">{t('status.inactive')}</option><option value="frozen">{t('status.frozen')}</option></select>
          <select className='fi o-fi-sm' value={sortBy} onChange={e=>sSortBy(e.target.value)}><option value="created_at">{isAr?'الأحدث':'Newest'}</option><option value="first_name">{isAr?'الاسم':'Name'}</option><option value="last_visit_at">{isAr?'آخر زيارة':'Last Visit'}</option></select>
        </div>
      </div>
      <div className='o-control-panel-filters'>
        {presets.map(p=><button key={p.id} type='button' className={'o-filter-chip'+(preset===p.id?' ac':'')} onClick={()=>{sPreset(p.id);sMeta(m=>({...m,page:1}))}}>{p.label}{p.count!=null&&<span>{p.count}</span>}</button>)}
        <select className='fi o-fi-sm' value={lifecycle} onChange={e=>sLifecycle(e.target.value)}><option value="">{isAr?'مرحلة العضو':'Lifecycle'}</option><option value="new">{isAr?'جديد':'New'}</option><option value="active">{isAr?'نشط':'Active'}</option><option value="at_risk">{isAr?'معرّض':'At Risk'}</option><option value="churned">{isAr?'مغادر':'Churned'}</option></select>
        <select className='fi o-fi-sm' value={risk} onChange={e=>sRisk(e.target.value)}><option value="">{isAr?'المخاطر':'Risk'}</option><option value="low">{isAr?'منخفض':'Low'}</option><option value="medium">{isAr?'متوسط':'Medium'}</option><option value="high">{isAr?'مرتفع':'High'}</option></select>
        <select className='fi o-fi-sm' value={sortOrder} onChange={e=>sSortOrder(e.target.value)}><option value="desc">{isAr?'تنازلي':'Desc'}</option><option value="asc">{isAr?'تصاعدي':'Asc'}</option></select>
      </div>
    </div>
    {viewMode==='list'?<div className='o-list-card'><table className='o-list-table'><thead><tr><th>{isAr?'الرقم':'ID'}</th><th>{t('common.name')}</th><th>{t('common.phone')}</th><th>{isAr?'الباقة الحالية':'Current Plan'}</th><th>{isAr?'حالة الدفع':'Payment'}</th><th>{t('common.status')}</th><th>{isAr?'آخر زيارة':'Last Visit'}</th><th>{t('common.actions')}</th></tr></thead>
      <tbody>{ms.length?ms.map(m=><tr key={m.id} onClick={()=>sView(m.id)}><td className='mono-cell'>{m.member_no}</td><td><div className='o-row-primary'><div className='o-avatar-sm'>{(m.first_name||'?')[0]}</div><div><strong>{fullMemberName(m)}</strong>{m.email&&<div className='o-cell-sub'>{m.email}</div>}</div></div></td><td>{m.phone||'—'}</td><td>{m.activePlan||<span className='o-cell-sub'>—</span>}</td><td>{m.paymentStatus?<span className={'badge b-'+(m.paymentStatus||'unknown')}>{t('status.'+(m.paymentStatus||'unknown'),m.paymentStatus||'—')}</span>:<span className='o-cell-sub'>—</span>}</td><td><span className={'badge b-'+m.status}>{t('status.'+m.status,m.status)}</span></td><td className='o-cell-sub'>{m.last_visit_at?timeSince(m.last_visit_at):(isAr?'لم تتم':'Never')}</td><td onClick={e=>e.stopPropagation()}><div className='o-row-actions'><button className='btn btn-s btn-sm' onClick={()=>sView(m.id)}><Ic name='eye' size={13}/></button><button className='btn btn-s btn-sm' onClick={()=>openEdit(m)}><Ic name='edit' size={13}/></button></div></td></tr>):<tr><td colSpan='8'><div className='empty'><h3>{t('members.noMembers')}</h3></div></td></tr>}</tbody></table></div>
    :<div className='o-kanban-grid'>{kanbanCols.map(col=><div key={col.key} className='o-kanban-col'><div className='o-kanban-head'><span>{col.label}</span><span>{(grouped[col.key]||[]).length}</span></div><div className='o-kanban-body'>{(grouped[col.key]||[]).map(m=><div key={m.id} className='o-kanban-card' onClick={()=>sView(m.id)}><div className='o-kanban-title'>{fullMemberName(m)}</div><div className='o-cell-sub'>{m.member_no}</div><div className='o-kanban-meta'>{m.phone||'—'}</div><div className='o-kanban-meta'>{m.activePlan||'—'}</div><div style={{marginTop:10}}><span className={'badge b-'+m.status}>{t('status.'+m.status,m.status)}</span></div></div>)}</div></div>)}</div>}
  </div>}

function MemberDetail({id,onBack,onEdit}){const{t,locale,formatCurrency,formatDateTime}=useI18n();const isAr=locale==='ar';const[m,sM]=useState(null);const[tab,sTab]=useState('overview');const[showMembershipForm,sShowMembershipForm]=useState(false);const[paymentMembership,sPaymentMembership]=useState(null);const[freezeMembership,sFreezeMembership]=useState(null);const[refundMembership,sRefundMembership]=useState(null);const[cancelMembership,sCancelMembership]=useState(null);
  const[bal,sBal]=useState(null);const{nav}=useRouter();
  const load=useCallback(()=>{api.get('/api/members/'+id).then(r=>sM(r.data)).catch(()=>{});api.get('/api/members/'+id+'/balance').then(r=>sBal(r.data)).catch(()=>{})},[id]);useEffect(()=>{load()},[load]);
  const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
  const saveMembership=async data=>{try{await api.post('/api/memberships',data);toast(t('btn.create','Saved'));sShowMembershipForm(null);sTab('memberships');load()}catch(e){toast(e.message,'e')}};
  const unfreezeNow=async(ms)=>{if(!ms?.active_freeze_id){toast(isAr?'لا يوجد تجميد نشط':'No active freeze','e');return}if(!confirm(isAr?'هل أنت متأكد من فك التجميد؟':'Unfreeze this membership?'))return;try{await api.post('/api/freeze/'+ms.active_freeze_id+'/approve-unfreeze',{});toast(isAr?'تم فك التجميد':'Unfrozen successfully');load()}catch(e){toast(e.message,'e')}};
  const summaryCard={background:'var(--bg-100)',border:'1px solid var(--b)',borderRadius:'var(--r)',padding:'14px 16px'};
  const memberTabs={overview:t('members.overview','نظرة عامة'),memberships:t('members.memberships','الاشتراكات'),attendance:t('members.attendance','الحضور'),training:t('training.title','التدريب'),fingerprint:isAr?'البصمة':'Fingerprint',timeline:t('members.timeline','النشاط')};
  const activeMembership=(m?.memberships||[]).find(row=>row.status==='active')||(m?.memberships||[])[0]||null;
  if(!m)return<div><div className="ph"><div className="acts"><button className="btn btn-s" onClick={onBack}><Ic name="chevron-right" size={14}/>{t('btn.back','رجوع')}</button></div><h1>{t('members.memberProfile','ملف العضو')}</h1><p>{t('common.loading','جاري التحميل')}</p></div><div className="pb"><div className="card"><div className="pld"><span className="spinner"/></div></div></div></div>;
  return<div dir={isAr?'rtl':'ltr'}><div className="ph"><div className='o-member-headline'><div className='o-member-headline-main'><h1 style={{marginBottom:6}}>{fullMemberName(m)}</h1><p>{m.member_no} · {m.phone||t('common.none','—')}</p></div><div className='o-member-headline-actions'><button className="btn btn-s" onClick={()=>onEdit&&onEdit(m)}><Ic name="edit" size={14}/>{t('members.editMember','تعديل العضو')}</button>{tab==='memberships'&&<><button className="btn btn-p" onClick={()=>sShowMembershipForm({mode:'create'})}><Ic name="plus" size={14}/>{t('memberships.newMembership','إضافة اشتراك')}</button><button className="btn btn-s" onClick={()=>activeMembership&&sPaymentMembership(activeMembership)} disabled={!activeMembership}><Ic name="credit-card" size={14}/>{t('memberships.addPayment','إضافة دفعة')}</button><button className="btn btn-s" onClick={()=>activeMembership&&sFreezeMembership(activeMembership)} disabled={!activeMembership||activeMembership.status!=='active'}><Ic name="snowflake" size={14}/>{t('memberships.addFreeze','تجميد')}</button></>}<button className="btn btn-s" onClick={onBack}><Ic name="chevron-right" size={14}/>{t('btn.back','رجوع')}</button></div></div>{bal&&bal.total>0.009&&<div style={{marginTop:12,padding:'11px 16px',background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.35)',borderRadius:12,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><Ic name='alert-triangle' size={18}/><span style={{fontSize:14,fontWeight:800,color:'#b91c1c'}}>{isAr?'رصيد مستحق':'Outstanding balance'}: {money(bal.total)}</span>{bal.memberships>0&&<span style={{fontSize:12,color:'var(--t3)'}}>{isAr?'اشتراكات':'Membership'} {money(bal.memberships)}</span>}{bal.cafeteria>0&&<span style={{fontSize:12,color:'var(--t3)'}}>{isAr?'كافتيريا':'Cafeteria'} {money(bal.cafeteria)}</span>}{bal.freezes>0&&<span style={{fontSize:12,color:'var(--t3)'}}>{isAr?'تجميد':'Freeze'} {money(bal.freezes)}</span>}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{bal.memberships>0&&activeMembership&&<button className='btn btn-s' onClick={()=>sPaymentMembership(activeMembership)}><Ic name='credit-card' size={13}/> {isAr?'تحصيل دفعة':'Collect payment'}</button>}{bal.cafeteria>0&&<button className='btn btn-s' onClick={()=>nav('/cafeteria-debts')}><Ic name='shopping-cart' size={13}/> {isAr?'دين الكافتيريا':'Cafeteria debt'}</button>}</div></div>}</div>
    <div className="pb o-member-detail-flex"><div className="card o-member-detail-main" style={{padding:0,overflow:'hidden'}}>
      <div style={{padding:'18px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:14,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:14,alignItems:'center'}}><div style={{width:52,height:52,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:20}}>{(m.first_name||'?')[0]}</div>
          <div><div style={{fontSize:18,fontWeight:800,color:'var(--text-1)'}}>{fullMemberName(m)}</div><div style={{display:'flex',gap:8,marginTop:6,flexWrap:'wrap'}}><span className={'badge b-'+m.status}>{t('status.'+m.status,m.status)}</span>{m.activeMembership&&<span className={'badge b-'+(m.activeMembership.payment_status||'unpaid')}>{t('status.'+(m.activeMembership.payment_status||'unpaid'),m.activeMembership.payment_status||'unpaid')}</span>}</div></div></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(140px,1fr))',gap:10,minWidth:'min(100%,340px)'}}><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('members.totalVisits','إجمالي الزيارات')}</div><div style={{fontSize:22,fontWeight:800}}>{m.total_visits||0}</div></div><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('members.lastVisit','آخر زيارة')}</div><div style={{fontSize:13,fontWeight:700}}>{m.last_visit_at?timeSince(m.last_visit_at):t('members.never','لم تتم')}</div></div></div>
      </div>
      <div className="tabs" style={{padding:'0 20px'}}>{['overview','memberships','attendance','training','fingerprint','timeline'].map(tb=><div key={tb} className={'tab'+(tab===tb?' ac':'')} onClick={()=>sTab(tb)}>{memberTabs[tb]}</div>)}</div>
      <div style={{padding:'18px 20px'}}>
        {tab==='overview'&&<div style={{display:'grid',gap:16}}><div className="dg"><div className="di"><div className="dl">{t('common.phone')}</div><div className="dv">{m.phone||'—'}</div></div><div className="di"><div className="dl">{t('common.email')}</div><div className="dv">{m.email||'—'}</div></div><div className="di"><div className="dl">{t('common.gender')}</div><div className="dv">{t('common.'+m.gender,m.gender)}</div></div><div className="di"><div className="dl">{t('members.dob')}</div><div className="dv">{m.date_of_birth||'—'}</div></div><div className="di"><div className="dl">{t('members.joined','تاريخ الانضمام')}</div><div className="dv">{m.joined_date||'—'}</div></div><div className="di"><div className="dl">{t('members.profile','الملف')}</div><div className="dv">{m.profile_completeness||0}%</div></div></div>{m.notes?<div className="card" style={{margin:0}}><div className="ct">{t('common.notes','ملاحظات')}</div><div style={{fontSize:13,whiteSpace:'pre-wrap'}}>{m.notes}</div></div>:null}</div>}
        {tab==='memberships'&&<div style={{display:'grid',gap:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><div><div style={{fontSize:17,fontWeight:800}}>{t('memberships.title','الاشتراكات')}</div><div style={{fontSize:12,color:'var(--text-2)',marginTop:4}}>{t('members.membershipsHint','أنشئ اشتراكاً جديداً للعضو من هنا بدون مغادرة الصفحة')}</div></div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="btn btn-p" onClick={()=>sShowMembershipForm({mode:'create'})}><Ic name="plus" size={14}/>{t('memberships.newMembership','إضافة اشتراك')}</button><button className="btn btn-s" onClick={()=>activeMembership&&sPaymentMembership(activeMembership)} disabled={!activeMembership}><Ic name="credit-card" size={14}/>{t('memberships.addPayment','إضافة دفعة')}</button><button className="btn btn-s" onClick={()=>activeMembership&&sFreezeMembership(activeMembership)} disabled={!activeMembership||activeMembership.status!=='active'}><Ic name="snowflake" size={14}/>{t('memberships.addFreeze','تجميد')}</button></div></div>
          {m.activeMembership&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(160px,1fr))',gap:12}}><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('memberships.totalAmount','الإجمالي')}</div><div style={{fontSize:20,fontWeight:800}}>{money(m.activeMembership.total_amount||m.activeMembership.price)}</div></div><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('memberships.paid','المدفوع')}</div><div style={{fontSize:20,fontWeight:800,color:'#10b981'}}>{money(m.activeMembership.paid_amount||m.activeMembership.total_paid)}</div></div><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('memberships.balance','المتبقي')}</div><div style={{fontSize:20,fontWeight:800,color:Number(m.activeMembership.balance_amount||0)>0?'#f59e0b':'#10b981'}}>{money(m.activeMembership.balance_amount||0)}</div></div><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('memberships.paymentStatus','حالة الدفع')}</div><div><span className={'badge b-'+(m.activeMembership.payment_status||'unpaid')}>{t('status.'+(m.activeMembership.payment_status||'unpaid'),m.activeMembership.payment_status||'unpaid')}</span></div></div></div>}
          {m.memberships?.length?<div style={{display:'grid',gap:12}}>{m.memberships.map(ms=><div key={ms.id} className="card" style={{margin:0,background:'var(--bg-1)'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}><div style={{display:'grid',gap:4}}><strong style={{fontSize:14}}>{ms.plan_name||ms.plan_display||'—'}</strong><div style={{fontSize:12,color:'var(--t3)'}}>{ms.start_date} → {ms.end_date||'∞'}</div></div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><span className={'badge b-'+ms.status}>{t('status.'+ms.status,ms.status)}</span><span className={'badge b-'+(ms.payment_status||'unpaid')}>{t('status.'+(ms.payment_status||'unpaid'),ms.payment_status||'unpaid')}</span>{['expired','cancelled'].includes(ms.status)?<button className="btn btn-p btn-sm" onClick={()=>sShowMembershipForm({mode:'renew',membership:ms})}><Ic name="refresh-cw" size={12}/>{t('memberships.renew','تجديد')}</button>:null}<button className="btn btn-s btn-sm" onClick={()=>sPaymentMembership(ms)}><Ic name="credit-card" size={12}/>{t('memberships.addPayment','إضافة دفعة')}</button>{Number(ms.paid_amount||ms.total_paid||0)>0&&ms.status!=='cancelled'?<button className="btn btn-s btn-sm" onClick={()=>sRefundMembership(ms)}><Ic name="rotate-ccw" size={12}/>{t('memberships.refund','استرجاع')}</button>:null}{ms.status!=='cancelled'?<button className="btn btn-d btn-sm" onClick={()=>sCancelMembership(ms)}><Ic name="x-circle" size={12}/>{t('memberships.cancelMembership','إلغاء الاشتراك')}</button>:null}<button className="btn btn-s btn-sm" onClick={()=>sFreezeMembership(ms)} disabled={ms.status!=='active'}><Ic name="snowflake" size={12}/>{t('memberships.addFreeze','تجميد')}</button>{ms.status==='frozen'&&ms.active_freeze_id&&<button className="btn btn-p btn-sm" onClick={()=>unfreezeNow(ms)} style={{background:'#0891b2'}}><Ic name="sun" size={12}/>{isAr?'فك التجميد':'Unfreeze'}</button>}</div></div><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(150px,1fr))',gap:10,marginTop:12}}><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('memberships.totalAmount','الإجمالي')}</div><div style={{fontSize:16,fontWeight:800}}>{money(ms.total_amount||ms.price)}</div></div><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('memberships.paid','المدفوع')}</div><div style={{fontSize:16,fontWeight:800,color:'#10b981'}}>{money(ms.paid_amount||ms.total_paid)}</div></div><div style={summaryCard}><div style={{fontSize:11,color:'var(--text-2)',marginBottom:6}}>{t('memberships.balance','المتبقي')}</div><div style={{fontSize:16,fontWeight:800,color:Number(ms.balance_amount||0)>0?'#f59e0b':'#10b981'}}>{money(ms.balance_amount||0)}</div></div></div></div>)}</div>:<div className="empty"><h3>{t('members.noMemberships')}</h3><p style={{fontSize:12,color:'var(--text-2)'}}>{t('members.noMembershipsHint','لا يوجد أي اشتراك لهذا العضو حتى الآن')}</p></div>}</div>}
        {tab==='attendance'&&<div>{m.recentAttendance?.length?<table><thead><tr><th>{t('common.date')}</th><th>{t('attendance.in')}</th><th>{t('attendance.out')}</th><th>{t('attendance.duration')}</th></tr></thead><tbody>{m.recentAttendance.map(a=><tr key={a.id}><td style={{fontSize:12}}>{a.check_in?.split(' ')[0]}</td><td style={{fontSize:12}}>{a.check_in}</td><td style={{fontSize:12}}>{a.check_out||<span className="badge b-active">{t('attendance.in')}</span>}</td><td style={{fontSize:12}}>{a.duration_minutes?a.duration_minutes+'m':'—'}</td></tr>)}</tbody></table>:<div className="empty"><h3>{t('members.noRecords')}</h3></div>}</div>}
        {tab==='training'&&<MemberTrainingTab memberId={id} memberName={fullMemberName(m)} />}
        {tab==='fingerprint'&&<MemberFingerprintTab member={m} />}
        {tab==='timeline'&&<div>{m.timeline?.length?m.timeline.map(tl=><div key={tl.id} style={{display:'flex',gap:10,marginBottom:12,paddingInlineStart:12,borderInlineStart:'2px solid var(--border)'}}><div><div style={{fontSize:13,fontWeight:600}}>{tl.title}</div><div style={{fontSize:12,color:'var(--t3)'}}>{tl.description}</div><div style={{fontSize:11,color:'var(--t4)',marginTop:2}}>{formatDateTime(tl.created_at)}</div></div></div>):<div className="empty"><h3>{t('members.noEvents')}</h3></div>}</div>}
      </div>
    </div>
    <MemberChatter memberId={id}/>
    {showMembershipForm&&<MembershipForm presetMember={m} presetMembership={showMembershipForm?.membership||null} mode={showMembershipForm?.mode||'create'} onSave={saveMembership} onClose={()=>sShowMembershipForm(null)}/>}
    {paymentMembership&&<MembershipPaymentModal membershipId={paymentMembership.id} onClose={()=>sPaymentMembership(null)} onSaved={()=>{sPaymentMembership(null);load();sTab('memberships')}}/>}
    {refundMembership&&<MembershipRefundModal membership={refundMembership} onClose={()=>sRefundMembership(null)} onSaved={()=>{sRefundMembership(null);load();sTab('memberships')}}/>}
    {cancelMembership&&<MembershipCancelModal membership={cancelMembership} onClose={()=>sCancelMembership(null)} onSaved={()=>{sCancelMembership(null);load();sTab('memberships')}}/>}
    {freezeMembership&&<MembershipFreezeModal membership={freezeMembership} onClose={()=>sFreezeMembership(null)} onSaved={()=>{sFreezeMembership(null);load();sTab('memberships')}}/>}
  </div></div>}
// ═══ MEMBERSHIPS ═══

function MembershipsPage(){const{t,locale,formatCurrency}=useI18n();const isAr=locale==='ar';const[items,sI]=useState([]);const[search,sSrch]=useState('');const[sf,sSf]=useState('');const[showForm,sSF]=useState(null);const[paymentMembership,sPM]=useState(null);const[refundMembership,sRM]=useState(null);const[cancelMembership,sCM]=useState(null);
  const load=useCallback(()=>{const p=new URLSearchParams({page:1,limit:50,search,status:sf});api.get('/api/memberships?'+p).then(r=>sI(r.data||[])).catch(()=>{})},[search,sf]);useEffect(()=>{load()},[load]);
  const save=async d=>{try{await api.post('/api/memberships',d);toast(t('btn.create','Saved'));sSF(false);load()}catch(e){toast(e.message,'e')}};
  const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
  const stats={active:items.filter(i=>i.status==='active').length,expiring:items.filter(i=>i.status==='expired').length,partial:items.filter(i=>i.payment_status==='partial').length,total:items.length};
  return <div className='o-module-page'>
    <div className='o-module-titlebar'>
      <div><h1>{t('memberships.title','الاشتراكات')}</h1><p>{isAr?'إدارة الاشتراكات والمدفوعات وحالات التجديد بنفس منطق أودو':'Membership operations with payments, renewals, and status tracking in Odoo flow'}</p></div>
    </div>
    <div className='o-kpi-grid compact'>
      <div className='o-kpi-card'><div className='o-kpi-label'>{isAr?'كل الاشتراكات':'All Memberships'}</div><div className='o-kpi-value'>{stats.total}</div><div className='o-kpi-sub'>{isAr?'إجمالي السجلات':'total records'}</div></div>
      <div className='o-kpi-card'><div className='o-kpi-label'>{isAr?'نشطة':'Active'}</div><div className='o-kpi-value'>{stats.active}</div><div className='o-kpi-sub'>{isAr?'صالحة حالياً':'currently valid'}</div></div>
      <div className='o-kpi-card'><div className='o-kpi-label'>{isAr?'مدفوع جزئياً':'Partial Payment'}</div><div className='o-kpi-value'>{stats.partial}</div><div className='o-kpi-sub'>{isAr?'بحاجة متابعة مالية':'financial follow-up'}</div></div>
      <div className='o-kpi-card'><div className='o-kpi-label'>{isAr?'منتهية':'Expired'}</div><div className='o-kpi-value'>{stats.expiring}</div><div className='o-kpi-sub'>{isAr?'جاهزة للتجديد':'ready to renew'}</div></div>
    </div>
    <div className='o-control-panel-shell'>
      <div className='o-control-panel-main'>
        <div className='o-control-panel-left'><button className='btn btn-p' onClick={()=>sSF({mode:'create'})}><Ic name='plus' size={14}/>{t('memberships.newMembership','إضافة اشتراك')}</button></div>
        <div className='o-control-panel-right'>
          <div className='o-searchbox'><Ic name='search' size={15}/><input className='fi clean' placeholder={t('memberships.searchPlaceholder','ابحث بعضو أو باقة أو حالة...')} value={search} onChange={e=>sSrch(e.target.value)}/></div>
          <select className='fi o-fi-sm' value={sf} onChange={e=>sSf(e.target.value)}><option value="">{t('common.all','الكل')}</option><option value="active">{t('status.active','نشط')}</option><option value="expired">{t('status.expired','منتهي')}</option><option value="frozen">{t('status.frozen','مجمّد')}</option><option value="cancelled">{t('status.cancelled','ملغي')}</option></select>
        </div>
      </div>
    </div>
    <div className='o-list-card'><table className='o-list-table'><thead><tr><th>{t('memberships.member','العضو')}</th><th>{t('memberships.plan','الباقة')}</th><th>{t('memberships.totalAmount','الإجمالي')}</th><th>{t('memberships.paid','المدفوع')}</th><th>{t('memberships.balance','المتبقي')}</th><th>{t('common.status','الحالة')}</th><th>{t('memberships.paymentStatus','حالة الدفع')}</th><th>{t('common.actions','إجراءات')}</th></tr></thead>
      <tbody>{items.length?items.map(m=><tr key={m.id}><td><div style={{display:'grid',gap:3}}><strong>{fullMemberName(m)}</strong><span className='o-cell-sub'>{m.member_no||'—'}</span></div></td><td><div style={{display:'grid',gap:3}}><span>{m.plan_name||'—'}</span><span className='o-cell-sub'>{m.start_date} → {m.end_date||'∞'}</span></div></td><td className='o-money-cell'>{money(m.total_amount)}</td><td className='o-money-cell success'>{money(m.paid_amount)}</td><td className={'o-money-cell '+(Number(m.balance_amount||0)>0?'warning':'')}>{money(m.balance_amount)}</td><td><span className={'badge b-'+m.status}>{t('status.'+m.status,m.status)}</span></td><td><span className={'badge b-'+m.payment_status}>{t('status.'+m.payment_status,m.payment_status)}</span></td><td><div className='o-row-actions wrap'>{['expired','cancelled'].includes(m.status)?<button className='btn btn-p btn-sm' onClick={()=>sSF({mode:'renew',membership:m,presetMember:{id:m.member_id,first_name:m.first_name,last_name:m.last_name,member_no:m.member_no,phone:m.phone}})}>{t('memberships.renew','تجديد')}</button>:null}<button className='btn btn-s btn-sm' onClick={()=>sPM(m)}>{t('memberships.addPayment','إضافة دفعة')}</button>{Number(m.paid_amount||m.total_paid||0)>0&&m.status!=='cancelled'?<button className='btn btn-s btn-sm' onClick={()=>sRM(m)}>{t('memberships.refund','استرجاع')}</button>:null}{m.status!=='cancelled'?<button className='btn btn-d btn-sm' onClick={()=>sCM(m)}>{t('memberships.cancelMembership','إلغاء الاشتراك')}</button>:null}</div></td></tr>):<tr><td colSpan='8'><div className='empty'><h3>{t('memberships.noMemberships')}</h3></div></td></tr>}</tbody></table></div>
    {showForm&&<MembershipForm onSave={save} presetMember={showForm?.presetMember||null} presetMembership={showForm?.membership||null} mode={showForm?.mode||'create'} onClose={()=>sSF(null)}/>}
    {paymentMembership&&<MembershipPaymentModal membershipId={paymentMembership.id} onClose={()=>sPM(null)} onSaved={load}/>}{refundMembership&&<MembershipRefundModal membership={refundMembership} onClose={()=>sRM(null)} onSaved={()=>{sRM(null);load();}}/>}{cancelMembership&&<MembershipCancelModal membership={cancelMembership} onClose={()=>sCM(null)} onSaved={()=>{sCM(null);load();}}/>}
  </div>}

function MembershipForm({onSave,onClose,presetMember=null,presetMembership=null,mode='create'}){const{t,locale,formatCurrency}=useI18n();const isAr=locale==='ar';
  const autoRef=(method,date,idx)=>`AUTO-${String(method||'cash').toUpperCase()}-${String(date||new Date().toISOString().split('T')[0]).replace(/-/g,'')}-${String(idx+1).padStart(2,'0')}`;
  const defaultDate=new Date().toISOString().split('T')[0];
  const renewalStartDate=(()=>{if(!presetMembership)return defaultDate;const basis=['active','frozen','scheduled'].includes(presetMembership.status)&&presetMembership.end_date?presetMembership.end_date:defaultDate;const d=new Date(basis);if(Number.isNaN(d.getTime())) return defaultDate; if(['active','frozen','scheduled'].includes(presetMembership.status)&&presetMembership.end_date){d.setDate(d.getDate()+1);} return d.toISOString().split('T')[0];})();
  const[f,sF]=useState({member_id:presetMember?.id||presetMembership?.member_id||'',plan_id:presetMembership?.plan_id||'',start_date:mode==='renew'?renewalStartDate:defaultDate,price:Number(presetMembership?.price||0),signup_fee:Number(presetMembership?.signup_fee||0),discount:0,notes:mode==='renew'?(presetMembership?.notes||''):''});
  const[plans,sPlans]=useState([]);const[mSearch,sMSearch]=useState(presetMember?fullMemberName(presetMember):'');const[mResults,sMR]=useState([]);const[selMem,sSelMem]=useState(presetMember||null);const[paymentLines,sPL]=useState([{method:'cash',amount:'',payment_date:mode==='renew'?renewalStartDate:defaultDate,reference:'',notes:''}]);const s=(k,v)=>sF(p=>({...p,[k]:v}));
  useEffect(()=>{api.get('/api/plans').then(r=>sPlans(r.data||[])).catch(()=>{})},[]);
  useEffect(()=>{if(presetMember){sSelMem(presetMember);sMSearch(fullMemberName(presetMember));sF(p=>({...p,member_id:presetMember.id||''}))}},[presetMember]);
  useEffect(()=>{if(mode==='renew'&&presetMembership){sF(p=>({...p,member_id:presetMember?.id||presetMembership.member_id||'',plan_id:presetMembership.plan_id||'',start_date:renewalStartDate,price:Number(presetMembership.price||0),signup_fee:Number(presetMembership.signup_fee||0),discount:0,notes:presetMembership.notes||''}));sPL([{method:'cash',amount:'',payment_date:renewalStartDate,reference:'',notes:''}]);}},[mode,presetMembership,presetMember,renewalStartDate]);
  useEffect(()=>{if(presetMember)return sMR([]);if(mSearch.length<2)return sMR([]);const tm=setTimeout(()=>{api.get('/api/members?search='+encodeURIComponent(mSearch)+'&limit=5').then(r=>sMR(r.data||[])).catch(()=>{})},300);return()=>clearTimeout(tm)},[mSearch,presetMember]);
  const updateLine=(idx,key,val)=>sPL(rows=>rows.map((row,i)=>i===idx?{...row,[key]:val}:row));
  const addLine=()=>sPL(rows=>[...rows,{method:'cash',amount:'',payment_date:f.start_date||new Date().toISOString().split('T')[0],reference:'',notes:''}]);
  const removeLine=idx=>sPL(rows=>rows.length===1?[{method:'cash',amount:'',payment_date:f.start_date||new Date().toISOString().split('T')[0],reference:'',notes:''}]:rows.filter((_,i)=>i!==idx));
  const selectedPlan=plans.find(x=>x.id===Number(f.plan_id));
  const total=Math.max(0,Number(f.price||0)+Number(f.signup_fee||0)-Number(f.discount||0));
  const cleanLines=paymentLines.map((line,idx)=>({...line,amount:Number(line.amount||0),reference:autoRef(line.method,line.payment_date||f.start_date,idx)})).filter(line=>line.amount>0);
  const paid=cleanLines.reduce((sum,line)=>sum+Number(line.amount||0),0);const balance=Math.max(0,total-paid);const payState=paid<=0?'unpaid':balance>0?'partial':'paid';
  const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
  const section={background:'var(--bg-view)',border:'1px solid var(--b)',borderRadius:'var(--r)',padding:16};
  const labelStyle={display:'block',fontSize:12,fontWeight:600,color:'var(--tx-2)',marginBottom:6};const row2={display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:14};const summaryCell={background:'var(--bg-100)',border:'1px solid var(--b)',borderRadius:'var(--r)',padding:'12px 14px'};const statusClass=payState==='paid'?'b-ok':payState==='partial'?'b-warn':'b-unpaid';
  return<Modal title={mode==='renew'?t('memberships.renewMembership','تجديد الاشتراك'):t('memberships.newMembership','إضافة اشتراك')} onClose={onClose} wide>
    <div className="mdl-b" dir={isAr?'rtl':'ltr'} style={{padding:18,display:'grid',gap:16,maxHeight:'78vh',overflow:'auto',background:'var(--bg-100)'}}>
      <div style={section}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><div><div style={{fontSize:16,fontWeight:700,color:'var(--tx)'}}>{t('memberships.memberDetails','بيانات العضو')}</div><div style={{fontSize:12,color:'var(--tx-3)',marginTop:4}}>{mode==='renew'?t('memberships.renewHint','تم تحميل آخر اشتراك ويمكنك تعديل أي شيء قبل الحفظ'):t('memberships.memberDetailsHint','اختر العضو ثم أكمل بيانات الاشتراك')}</div></div><span className={'badge '+statusClass} style={{fontSize:11}}>{t('status.'+payState,payState)}</span></div>
        <div className="fg" style={{marginBottom:0}}><label style={labelStyle}>{t('memberships.member','العضو')}</label>{(presetMember||presetMembership)?<span className="fi" style={{display:'flex',alignItems:'center',justifyContent:isAr?'flex-end':'flex-start'}}>{fullMemberName(presetMember||{first_name:presetMembership?.first_name,last_name:presetMembership?.last_name,name:presetMembership?.member_name})}</span>:selMem?<div style={{display:'flex',gap:8,alignItems:'center'}}><span className="fi" style={{flex:1,display:'flex',alignItems:'center',justifyContent:isAr?'flex-end':'flex-start'}}>{fullMemberName(selMem)}</span><button className="btn btn-s btn-sm" onClick={()=>{sSelMem(null);s('member_id','')}}>{t('btn.change','تغيير')}</button></div>:<div style={{position:'relative'}}><input className="fi" placeholder={t('memberships.searchMember','ابحث عن عضو...')} value={mSearch} onChange={e=>sMSearch(e.target.value)}/>{mResults.length>0&&<div style={{position:'absolute',top:'100%',insetInlineStart:0,insetInlineEnd:0,background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:10,zIndex:30,maxHeight:220,overflow:'auto',marginTop:6,boxShadow:'0 18px 30px rgba(0,0,0,.24)'}}>{mResults.map(m=><div key={m.id} style={{padding:'10px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)'}} onClick={()=>{sSelMem(m);s('member_id',m.id);sMR([]);sMSearch(fullMemberName(m))}}>{fullMemberName(m)} <span style={{opacity:.7}}>— {m.member_no}</span></div>)}</div>}</div>}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.7fr) minmax(300px,.9fr)',gap:16,alignItems:'start'}}>
        <div style={section}><div style={{fontSize:15,fontWeight:700,color:'var(--tx)',marginBottom:12}}>{t('memberships.subscriptionDetails','تفاصيل الاشتراك')}</div>
          <div className="membership-invoice-grid" style={row2}>
            <div className="fg" style={{marginBottom:0}}><label style={labelStyle}>{t('memberships.plan','الباقة')}</label><select className="fi" value={f.plan_id} onChange={e=>{const planId=e.target.value;s('plan_id',planId);const p=plans.find(x=>x.id===Number(planId));if(p){s('price',Number(p.price||0));s('signup_fee',Number(p.signup_fee||0))}}}><option value="">{t('memberships.selectPlan','اختر...')}</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}</select>{mode==='renew'&&presetMembership?<div style={{fontSize:11,color:'var(--text-2)',marginTop:6}}>{t('memberships.renewSource','مبني على آخر اشتراك')}: {presetMembership.plan_name||presetMembership.plan_display||'—'}</div>:null}</div>
            <div className="fg" style={{marginBottom:0}}><label style={labelStyle}>{t('memberships.startDate','تاريخ البدء')}</label><input className="fi" type="date" value={f.start_date} onChange={e=>{s('start_date',e.target.value);sPL(rows=>rows.map((row,i)=>i===0&&(!row.payment_date||row.payment_date===f.start_date)?{...row,payment_date:e.target.value}:row))}}/></div>
            <div className="fg" style={{marginBottom:0}}><label style={labelStyle}>{t('common.price','السعر')}</label><input className="fi" type="number" min="0" step="0.01" value={f.price} onChange={e=>s('price',Number(e.target.value||0))}/></div>
            <div className="fg" style={{marginBottom:0}}><label style={labelStyle}>{t('memberships.signupFee','رسوم التسجيل')}</label><input className="fi" type="number" min="0" step="0.01" value={f.signup_fee} onChange={e=>s('signup_fee',Number(e.target.value||0))}/></div>
            <div className="fg" style={{marginBottom:0}}><label style={labelStyle}>{t('memberships.discount','الخصم')}</label><input className="fi" type="number" min="0" step="0.01" value={f.discount} onChange={e=>s('discount',Number(e.target.value||0))}/></div>
            <div className="fg" style={{marginBottom:0}}><label style={labelStyle}>{t('memberships.paymentPlan','خطة الدفع')}</label><div className="fi" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span>{paid>0?(balance>0?t('status.partial','جزئي'):t('status.paid','مدفوع')):t('status.unpaid','غير مدفوع')}</span><span style={{fontSize:11,color:'var(--t3)'}}>{cleanLines.length} {t('memberships.lines','أسطر')}</span></div></div>
          </div>
          <div className="fg" style={{marginTop:14,marginBottom:0}}><label style={labelStyle}>{t('common.notes','ملاحظات')}</label><textarea className="fi" rows="3" value={f.notes||''} onChange={e=>s('notes',e.target.value)} placeholder={t('common.notesPlaceholder','أضف أي ملاحظات هنا')}/></div>
        </div>
        <div style={{display:'grid',gap:16}}><div style={section}><div style={{fontSize:15,fontWeight:700,color:'var(--tx)',marginBottom:12}}>{t('memberships.invoiceSummary','الملخص المالي')}</div><div style={{display:'grid',gap:10}}><div style={summaryCell}><div style={{fontSize:11,color:'var(--tx-3)',marginBottom:6}}>{t('memberships.totalAmount','الإجمالي')}</div><div style={{fontSize:22,fontWeight:700}}>{money(total)}</div></div><div style={summaryCell}><div style={{fontSize:11,color:'var(--tx-3)',marginBottom:6}}>{t('memberships.paid','المدفوع')}</div><div style={{fontSize:20,fontWeight:700}}>{money(paid)}</div></div><div style={summaryCell}><div style={{fontSize:11,color:'var(--tx-3)',marginBottom:6}}>{t('memberships.balance','المتبقي')}</div><div style={{fontSize:20,fontWeight:700,color:balance>0?'var(--warning)':'var(--success)'}}>{money(balance)}</div></div><div style={summaryCell}><div style={{fontSize:11,color:'var(--tx-3)',marginBottom:8}}>{t('common.status','الحالة')}</div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><span className={'badge '+statusClass}>{t('status.'+payState,payState)}</span>{selectedPlan?<span style={{fontSize:12,color:'var(--tx-3)'}}>{selectedPlan.name}</span>:null}</div></div></div></div></div>
      </div>
      <div style={section}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><div><div style={{fontSize:15,fontWeight:700,color:'var(--tx)'}}>{t('memberships.paymentLines','دفعات الاشتراك')}</div><div style={{fontSize:12,color:'var(--tx-3)',marginTop:4}}>{t('memberships.paymentLinesHint','يمكنك تقسيم الدفعة على أكثر من وسيلة دفع')}</div></div><button className="btn btn-p btn-sm" onClick={addLine}><Ic name="plus" size={12}/>{t('memberships.addLine','إضافة سطر')}</button></div>
        <div style={{display:'grid',gap:10}}>{paymentLines.map((line,idx)=><div key={idx} style={{border:'1px solid var(--b)',borderRadius:'var(--r)',padding:12,display:'grid',gap:10,background:'var(--bg-100)'}}><div style={{display:'grid',gridTemplateColumns:'minmax(160px,1fr) minmax(140px,1fr) minmax(170px,1fr) auto',gap:10}}><div><label style={labelStyle}>{t('common.method','الطريقة')}</label><select className="fi" value={line.method} onChange={e=>updateLine(idx,'method',e.target.value)}><option value="cash">Cash</option><option value="click">CliQ</option><option value="visa">Visa</option></select></div><div><label style={labelStyle}>{t('common.amount','المبلغ')}</label><input className="fi" type="number" min="0" step="0.01" value={line.amount} onChange={e=>updateLine(idx,'amount',e.target.value)}/></div><div><label style={labelStyle}>{t('common.date','التاريخ')}</label><input className="fi" type="date" value={line.payment_date||f.start_date} onChange={e=>updateLine(idx,'payment_date',e.target.value)}/></div><div style={{display:'flex',alignItems:'end'}}><button className="btn btn-s btn-sm" onClick={()=>removeLine(idx)}>{t('btn.remove','حذف')}</button></div></div><div style={{display:'grid',gridTemplateColumns:'minmax(220px,.9fr) minmax(0,1.6fr)',gap:10}}><div><label style={labelStyle}>{t('common.reference','المرجع')}</label><input className="fi" value={autoRef(line.method,line.payment_date||f.start_date,idx)} readOnly style={{opacity:1,cursor:'default'}}/></div><div><label style={labelStyle}>{t('common.notes','ملاحظات')}</label><input className="fi" value={line.notes||''} onChange={e=>updateLine(idx,'notes',e.target.value)}/></div></div></div>)}</div>
      </div>
    </div>
    <div className="mdl-f" style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><div style={{fontSize:12,color:'var(--tx-3)'}}>{t('memberships.saveHint','سيتم إنشاء فاتورة الاشتراك ثم ربط كل دفعة محاسبيًا')}</div><div style={{display:'flex',gap:10}}><button className="btn btn-s" onClick={onClose}>{t('btn.cancel','إلغاء')}</button><button className="btn btn-p" onClick={()=>onSave({...f,total_paid:paid,balance_due:balance,payment_status:payState,payment_method:paymentLines.length>1?'split':(paymentLines[0]?.method||''),payment_lines:cleanLines,renewed_from_membership_id:mode==='renew'?(presetMembership?.id||null):null})} disabled={!f.member_id||!f.plan_id||total<=0}>{mode==='renew'?t('memberships.renew','تجديد'):t('btn.create','حفظ')}</button></div></div>
  </Modal>}
function MembershipPaymentModal({membershipId,onClose,onSaved}){const{t,locale,formatCurrency}=useI18n();const isAr=locale==='ar';const autoRef=(method,date,idx)=>`AUTO-${String(method||'cash').toUpperCase()}-${String(date||new Date().toISOString().split('T')[0]).replace(/-/g,'')}-${String(idx+1).padStart(2,'0')}`;const[ms,sMs]=useState(null);const[payments,sPayments]=useState([]);const[saving,sSaving]=useState(false);const[lines,sLines]=useState([{method:'cash',amount:'',payment_date:new Date().toISOString().split('T')[0],reference:'',notes:''}]);
  const load=useCallback(()=>{Promise.all([api.get('/api/memberships/'+membershipId),api.get('/api/memberships/'+membershipId+'/payments')]).then(([m,p])=>{sMs(m.data);sPayments(p.data||[])}).catch(e=>toast(e.message,'e'))},[membershipId]);useEffect(()=>{load()},[load]);
  const updateLine=(idx,key,val)=>sLines(rows=>rows.map((row,i)=>i===idx?{...row,[key]:val}:row));const addLine=()=>sLines(rows=>[...rows,{method:'cash',amount:'',payment_date:new Date().toISOString().split('T')[0],reference:'',notes:''}]);const removeLine=idx=>sLines(rows=>rows.length===1?[{method:'cash',amount:'',payment_date:new Date().toISOString().split('T')[0],reference:'',notes:''}]:rows.filter((_,i)=>i!==idx));
  const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
  const submit=async()=>{const clean=lines.map((line,idx)=>({...line,amount:Number(line.amount||0),reference:autoRef(line.method,line.payment_date,idx)})).filter(line=>line.amount>0);if(!clean.length)return toast(t('memberships.enterPayment','أدخل دفعة واحدة على الأقل'),'e');try{sSaving(true);await api.post('/api/memberships/'+membershipId+'/payments',{lines:clean});toast(t('memberships.paymentSaved','تم حفظ الدفعة'));sLines([{method:'cash',amount:'',payment_date:new Date().toISOString().split('T')[0],reference:'',notes:''}]);await load();onSaved&&onSaved()}catch(e){toast(e.message,'e')}finally{sSaving(false)}};
  if(!ms)return<Modal title={t('memberships.addPayment','إضافة دفعة')} onClose={onClose}><div className="mdl-b"><div className="pld"><span className="spinner"/></div></div></Modal>;
  return<Modal title={t('memberships.addPayment','إضافة دفعة')} onClose={onClose} wide><div className="mdl-b" dir={isAr?'rtl':'ltr'} style={{padding:18,display:'grid',gap:16,maxHeight:'78vh',overflow:'auto'}}>
    <div className="card" style={{margin:0}}><div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:12}}><div><div style={{fontSize:11,color:'var(--t3)'}}>{t('memberships.totalAmount','الإجمالي')}</div><div style={{fontSize:18,fontWeight:800}}>{money(ms.total_amount)}</div></div><div><div style={{fontSize:11,color:'var(--t3)'}}>{t('memberships.paid','المدفوع')}</div><div style={{fontSize:18,fontWeight:800}}>{money(ms.paid_amount)}</div></div><div><div style={{fontSize:11,color:'var(--t3)'}}>{t('memberships.balance','المتبقي')}</div><div style={{fontSize:18,fontWeight:800,color:Number(ms.balance_amount||0)>0?'#f59e0b':'#10b981'}}>{money(ms.balance_amount)}</div></div><div><div style={{fontSize:11,color:'var(--t3)'}}>{t('memberships.invoice','الفاتورة')}</div><div style={{fontSize:13,fontWeight:700}}>{ms.invoice_ref||'—'}</div></div><div><div style={{fontSize:11,color:'var(--t3)'}}>{t('memberships.paymentStatus','حالة الدفع')}</div><div><span className={'badge b-'+ms.payment_status}>{t('status.'+ms.payment_status,ms.payment_status)}</span></div></div></div></div>
    <div className="card" style={{margin:0}}><div className="ct">{t('memberships.newPayment','دفعة جديدة')}</div><div style={{display:'grid',gap:10}}>{lines.map((line,idx)=><div key={idx} style={{border:'1px solid var(--border)',borderRadius:12,padding:12,display:'grid',gap:10}}><div style={{display:'grid',gridTemplateColumns:'minmax(160px,1fr) minmax(140px,1fr) minmax(170px,1fr) auto',gap:10}}><div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>{t('common.method','الطريقة')}</label><select className="fi" value={line.method} onChange={e=>updateLine(idx,'method',e.target.value)}><option value="cash">Cash</option><option value="click">CliQ</option><option value="visa">Visa</option></select></div><div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>{t('common.amount','المبلغ')}</label><input className="fi" type="number" min="0" step="0.01" value={line.amount} onChange={e=>updateLine(idx,'amount',e.target.value)}/></div><div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>{t('common.date','التاريخ')}</label><input className="fi" type="date" value={line.payment_date} onChange={e=>updateLine(idx,'payment_date',e.target.value)}/></div><div style={{display:'flex',alignItems:'end'}}><button className="btn btn-s btn-sm" onClick={()=>removeLine(idx)}>{t('btn.remove','حذف')}</button></div></div><div style={{display:'grid',gridTemplateColumns:'minmax(220px,.9fr) minmax(0,1.6fr)',gap:10}}><div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>{t('common.reference','المرجع')}</label><input className="fi" value={autoRef(line.method,line.payment_date,idx)} readOnly style={{opacity:1,cursor:'default'}}/></div><div><label style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>{t('common.notes','ملاحظات')}</label><input className="fi" value={line.notes||''} onChange={e=>updateLine(idx,'notes',e.target.value)}/></div></div></div>)}</div><div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:12}}><button className="btn btn-s" onClick={addLine}><Ic name="plus" size={12}/>{t('memberships.addLine','إضافة سطر')}</button><button className="btn btn-p" onClick={submit} disabled={saving||Number(ms.balance_amount||0)<=0}>{saving?t('common.loading','Loading...'):t('memberships.savePayment','حفظ الدفعة')}</button></div></div>
    <div className="card" style={{margin:0}}><div className="ct">{t('memberships.paymentHistory','سجل الدفعات')}</div>{payments.length?<table><thead><tr><th>{t('common.date','التاريخ')}</th><th>{t('common.method','الطريقة')}</th><th>{t('common.amount','المبلغ')}</th><th>{t('common.reference','المرجع')}</th><th>{t('memberships.receipt','السند')}</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td style={{fontSize:12}}>{p.payment_date}</td><td style={{fontSize:12,textTransform:'capitalize'}}>{p.method}</td><td style={{fontSize:12,fontWeight:700}}>{money(p.amount)}</td><td style={{fontSize:12}}>{p.reference||p.payment_no||'—'}</td><td style={{fontSize:12}}>{p.payment_no||'—'}</td></tr>)}</tbody></table>:<div className="empty"><h3>{t('memberships.noPayments','لا توجد دفعات')}</h3></div>}</div>
  </div><div className="mdl-f" style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><div style={{fontSize:12,color:'var(--text-2)'}}>{t('memberships.paymentFootnote','كل سطر دفعة ينشئ receipt مستقل ويربط على الفاتورة')}</div><button className="btn btn-s" onClick={onClose}>{t('btn.close','إغلاق')}</button></div></Modal>}

function MembershipRefundModal({membership,onClose,onSaved}){const{t,locale,formatCurrency}=useI18n();const isAr=locale==='ar';const[f,sF]=useState({amount:Number(membership?.paid_amount||membership?.total_paid||0)||0,method:'cash',reason:''});const[saving,sSaving]=useState(false);const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;const maxRefund=Math.max(0,Number(membership?.paid_amount||membership?.total_paid||0));const submit=async()=>{const amount=Number(f.amount||0);if(!(amount>0))return toast(t('memberships.refundAmountRequired','أدخل مبلغ الاسترجاع'),'e');if(amount>maxRefund+0.0001)return toast(t('memberships.refundExceedsPaid','مبلغ الاسترجاع أكبر من المدفوع'),'e');try{sSaving(true);await api.post('/api/memberships/'+membership.id+'/refund',{amount,method:f.method,reason:f.reason});toast(t('memberships.refundSaved','تم حفظ الاسترجاع'));onSaved&&onSaved();}catch(e){toast(e.message,'e')}finally{sSaving(false)}};return<Modal title={t('memberships.refund','استرجاع')} onClose={onClose}><div className="mdl-b" dir={isAr?'rtl':'ltr'} style={{display:'grid',gap:14}}><div className="card" style={{margin:0,padding:14}}><div style={{fontSize:12,color:'var(--t3)'}}>{t('memberships.plan','الباقة')}</div><div style={{fontSize:15,fontWeight:800,marginTop:4}}>{membership.plan_name||'—'}</div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:12}}><div><div style={{fontSize:11,color:'var(--t3)'}}>{t('memberships.paid','المدفوع')}</div><div style={{fontSize:16,fontWeight:800,color:'#10b981'}}>{money(maxRefund)}</div></div><div><div style={{fontSize:11,color:'var(--t3)'}}>{t('memberships.refundable','القابل للاسترجاع')}</div><div style={{fontSize:16,fontWeight:800}}>{money(maxRefund)}</div></div></div></div><div className="fg"><label>{t('memberships.refundAmount','مبلغ الاسترجاع')}</label><input className="fi" type="number" min="0" max={maxRefund} value={f.amount} onChange={e=>sF(p=>({...p,amount:e.target.value}))}/></div><div className="fg"><label>{t('common.method','الطريقة')}</label><select className="fi" value={f.method} onChange={e=>sF(p=>({...p,method:e.target.value}))}><option value="cash">{isAr?'نقدي':'Cash'}</option><option value="bank">{isAr?'بطاقة / فيزا':'Card / Visa'}</option><option value="click">{isAr?'كليك / CliQ':'CliQ / Click'}</option></select></div><div className="fg"><label>{t('common.reason','السبب')}</label><textarea className="fi" rows="3" value={f.reason} onChange={e=>sF(p=>({...p,reason:e.target.value}))} placeholder={t('memberships.refundReason','سبب الاسترجاع')}/></div></div><div className="mdl-f"><button className="btn btn-s" onClick={onClose}>{t('btn.cancel','إلغاء')}</button><button className="btn btn-p" onClick={submit} disabled={saving}>{saving?t('common.loading','جاري الحفظ'):t('memberships.refund','استرجاع')}</button></div></Modal>}
function MembershipCancelModal({membership,onClose,onSaved}){const{t,locale}=useI18n();const isAr=locale==='ar';const[f,sF]=useState({reason:'',refund_amount:'',refund_method:'cash'});const[saving,sSaving]=useState(false);const paid=Math.max(0,Number(membership?.paid_amount||membership?.total_paid||0));const submit=async()=>{try{sSaving(true);await api.post('/api/memberships/'+membership.id+'/cancel',{reason:f.reason,refund_amount:Number(f.refund_amount||0),refund_method:f.refund_method});toast(t('memberships.cancelSaved','تم إلغاء الاشتراك'));onSaved&&onSaved();}catch(e){toast(e.message,'e')}finally{sSaving(false)}};return<Modal title={t('memberships.cancelMembership','إلغاء الاشتراك')} onClose={onClose}><div className="mdl-b" dir={isAr?'rtl':'ltr'} style={{display:'grid',gap:14}}><div className="card" style={{margin:0,padding:14}}><div style={{fontSize:12,color:'var(--t3)'}}>{t('memberships.plan','الباقة')}</div><div style={{fontSize:15,fontWeight:800,marginTop:4}}>{membership.plan_name||'—'}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:10}}>{t('memberships.paid','المدفوع')}: <strong style={{color:'#10b981'}}>{paid}</strong></div></div><div className="fg"><label>{t('common.reason','السبب')}</label><textarea className="fi" rows="3" value={f.reason} onChange={e=>sF(p=>({...p,reason:e.target.value}))} placeholder={t('memberships.cancelReason','سبب الإلغاء')}/></div><div className="fr"><div className="fg"><label>{t('memberships.refundAmount','مبلغ الاسترجاع')}</label><input className="fi" type="number" min="0" max={paid} value={f.refund_amount} onChange={e=>sF(p=>({...p,refund_amount:e.target.value}))} placeholder="0"/></div><div className="fg"><label>{t('common.method','الطريقة')}</label><select className="fi" value={f.refund_method} onChange={e=>sF(p=>({...p,refund_method:e.target.value}))}><option value="cash">{isAr?'نقدي':'Cash'}</option><option value="bank">{isAr?'بطاقة / فيزا':'Card / Visa'}</option><option value="click">{isAr?'كليك / CliQ':'CliQ / Click'}</option></select></div></div><div style={{fontSize:12,color:'var(--text-2)'}}>{t('memberships.cancelAccountingHint','عند وجود مبلغ استرجاع سيتم إنشاء قيد محاسبي وإشعار دائن وربط حركة الاسترجاع بالمحاسبة.')}</div></div><div className="mdl-f"><button className="btn btn-s" onClick={onClose}>{t('btn.cancel','إلغاء')}</button><button className="btn btn-d" onClick={submit} disabled={saving}>{saving?t('common.loading','جاري الحفظ'):t('memberships.cancelMembership','إلغاء الاشتراك')}</button></div></Modal>}
function MembershipFreezeModal({membership,onClose,onSaved}){const{t,locale,formatCurrency}=useI18n();const isAr=locale==='ar';const today=new Date().toISOString().split('T')[0];
  const planMaxDays=Number(membership?.freeze_max_days||membership?.freeze_days_allowed||0);
  const defaultDays=planMaxDays>0?planMaxDays:7;
  const defaultEnd=(()=>{const d=new Date();d.setDate(d.getDate()+defaultDays);return d.toISOString().split('T')[0]})();
  const[f,sF]=useState({start_date:today,end_date:defaultEnd,reason:''});const[preview,sPreview]=useState(null);const[saving,sSaving]=useState(false);
  const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
  const outstandingBalance=Math.max(0,Number(membership?.balance_amount||membership?.outstanding_amount||membership?.balance_due||0));
  const hasBalance=outstandingBalance>0.001;
  // Calculate selected days for display
  const selectedDays=(()=>{try{const s=new Date(f.start_date+'T00:00:00');const e=new Date(f.end_date+'T00:00:00');const d=Math.ceil((e-s)/86400000);return d>0?d:0}catch(_){return 0}})();
  useEffect(()=>{if(!membership?.id||!f.start_date||!f.end_date)return;const tm=setTimeout(()=>{api.post('/api/freeze/preview',{membership_id:membership.id,start_date:f.start_date,end_date:f.end_date}).then(r=>sPreview(r.data||null)).catch(()=>sPreview(null))},250);return()=>clearTimeout(tm)},[membership?.id,f.start_date,f.end_date]);
  const submit=async(pay=false)=>{
    if(hasBalance){toast(isAr?`المشترك متبقي عليه ${money(outstandingBalance)} يرجى إغلاق المبلغ ليتم التجميد`:`Member has outstanding balance of ${money(outstandingBalance)}. Please settle before freezing.`,'e');return;}
    if(!f.start_date||!f.end_date)return toast(isAr?'حدد فترة التجميد':'Select freeze period','e');
    if(preview&&!preview.valid){toast((preview.errors||[])[0]||(isAr?'التحقق فشل':'Validation failed'),'e');return;}
    try{sSaving(true);await api.post('/api/freeze',{membership_id:membership.id,start_date:f.start_date,end_date:f.end_date,reason:f.reason||'',pay});toast(pay?(isAr?'تم الدفع والتجميد':'Paid & frozen'):(preview&&preview.requiresPayment?(isAr?'تم التجميد وتسجيل الرسوم كدين':'Frozen — fee recorded as debt'):(isAr?'تم التجميد':'Frozen')));onSaved&&onSaved()}catch(e){toast(e.message,'e')}finally{sSaving(false)}
  };
  const canSubmit=!saving&&!hasBalance&&(!preview||preview.valid);
  return<Modal title={isAr?'تجميد':'Freeze'} onClose={onClose}><div className="mdl-b" dir={isAr?'rtl':'ltr'} style={{display:'grid',gap:14}}>
    {hasBalance&&<div style={{padding:12,borderRadius:10,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.25)',color:'#b91c1c'}}><strong style={{display:'inline-flex',alignItems:'center',gap:6}}><Ic name='alert-triangle' size={14}/>{isAr?'لا يمكن التجميد':'Cannot freeze'}</strong><div style={{fontSize:13,marginTop:4}}>{isAr?`المشترك متبقي عليه ${money(outstandingBalance)} يرجى إغلاق المبلغ ليتم التجميد`:`Member has outstanding balance of ${money(outstandingBalance)}. Please settle before freezing.`}</div></div>}
    {preview&&!preview.valid&&!hasBalance&&<div style={{padding:12,borderRadius:10,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.25)',color:'#b91c1c'}}><strong style={{display:'inline-flex',alignItems:'center',gap:6}}><Ic name='alert-triangle' size={14}/>{isAr?'خطأ':'Error'}</strong>{(preview.errors||[]).map((e,i)=><div key={i} style={{fontSize:13,marginTop:4}}>{e}</div>)}
      {(preview.errors||[]).some(e=>e.includes('Overlap')||e.includes('Exceeds max'))&&<button className="btn btn-d btn-sm" style={{marginTop:10}} onClick={async()=>{if(!confirm(isAr?'هل تريد إلغاء التجميد السابق العالق؟':'Cancel the stuck previous freeze?'))return;try{await api.post('/api/freeze/cancel-by-membership/'+membership.id,{reason:'Cancelled stale freeze'});toast(isAr?'تم إلغاء التجميد العالق — أعد المحاولة':'Stale freeze cancelled — try again');sPreview(null);sF(p=>({...p}))}catch(ex){toast(ex.message,'e')}}}><Ic name="trash-2" size={12}/>{isAr?' إلغاء التجميد السابق العالق':' Cancel stuck previous freeze'}</button>}
    </div>}
    <div className="card" style={{margin:0,padding:14}}>
      <div style={{fontSize:12,color:'var(--t3)'}}>{isAr?'الباقة':'Plan'}</div>
      <div style={{fontSize:15,fontWeight:800,marginTop:4}}>{membership.plan_name||'—'}</div>
      <div style={{fontSize:12,color:'var(--t3)',marginTop:8}}>{isAr?'الفترة':'Period'}</div>
      <div style={{fontSize:13,fontWeight:700,marginTop:4}}>{membership.start_date} → {membership.end_date||'∞'}</div>
      {planMaxDays>0&&<div style={{fontSize:12,color:'var(--t3)',marginTop:8}}>{isAr?`حد أيام التجميد المسموح: ${planMaxDays} يوم`:`Max allowed freeze days: ${planMaxDays}`}</div>}
    </div>
    <div className="fr"><div className="fg"><label>{isAr?'تاريخ البدء':'Start Date'}</label><input className="fi" type="date" value={f.start_date} onChange={e=>sF(p=>({...p,start_date:e.target.value}))}/></div><div className="fg"><label>{isAr?'تاريخ الانتهاء':'End Date'}</label><input className="fi" type="date" value={f.end_date} onChange={e=>sF(p=>({...p,end_date:e.target.value}))}/></div></div>
    <div style={{textAlign:'center',fontSize:14,fontWeight:700,color:selectedDays>0?(planMaxDays>0&&selectedDays>planMaxDays?'#ef4444':'#0891b2'):'var(--t3)'}}>
      {selectedDays>0?(isAr?`${selectedDays} يوم مختار`:`${selectedDays} days selected`):(isAr?'حدد الفترة':'Select period')}
      {planMaxDays>0&&selectedDays>planMaxDays&&<div style={{fontSize:12,color:'#ef4444',marginTop:2}}>{isAr?`تجاوز الحد المسموح (${planMaxDays} يوم)`:`Exceeds limit (${planMaxDays} days)`}</div>}
    </div>
    <div className="fg"><label>{isAr?'ملاحظات':'Notes'}</label><textarea className="fi" rows="3" value={f.reason} onChange={e=>sF(p=>({...p,reason:e.target.value}))} placeholder={isAr?'سبب التجميد':'Freeze reason'}/></div>
    {preview&&preview.valid&&<div className="card" style={{margin:0,padding:14}}><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
      <div><div style={{fontSize:11,color:'var(--t3)'}}>{isAr?'أيام التجميد':'Freeze Days'}</div><div style={{fontSize:17,fontWeight:800}}>{preview.totalDays||0}</div></div>
      <div><div style={{fontSize:11,color:'var(--t3)'}}>{isAr?'السعر':'Price'}</div><div style={{fontSize:17,fontWeight:800}}>{money(preview.price||0)}</div></div>
      <div><div style={{fontSize:11,color:'var(--t3)'}}>{isAr?'حالة الدفع':'Payment'}</div><div style={{fontSize:13,fontWeight:700}}>{preview.requiresPayment?(isAr?'يتطلب دفع':'Payment required'):(isAr?'بدون دفع':'No payment')}</div></div>
    </div></div>}
  </div><div className="mdl-f"><button className="btn btn-s" onClick={onClose}>{isAr?'إلغاء':'Cancel'}</button>{preview&&preview.valid&&preview.requiresPayment?<><button className="btn btn-s" onClick={()=>submit(false)} disabled={!canSubmit} title={isAr?'تجميد الآن وتسجيل الرسوم كدين على العضو':'Freeze now and record the fee as a debt'}>{saving?'...':(isAr?'تجميد (تسجيل دين)':'Freeze (as debt)')}</button><button className="btn btn-p" onClick={()=>submit(true)} disabled={!canSubmit}>{saving?'...':(isAr?`دفع وتجميد · ${money(preview.price)}`:`Pay & Freeze · ${money(preview.price)}`)}</button></>:<button className="btn btn-p" onClick={()=>submit(false)} disabled={!canSubmit}>{saving?(isAr?'جاري الحفظ':'Saving...'):(isAr?'تجميد':'Freeze')}</button>}</div></Modal>}
// ═══ SIMPLE CRUD + SPECIFIC PAGES ═══

function SimpleCrudPage({title,desc,endpoint,columns,formFields}){const{t,locale}=useI18n();const isAr=locale==='ar';const{param,nav}=useRouter();const[items,sI]=useState([]);const[ed,sEd]=useState(null);const openId=param('open');
  const load=useCallback(()=>api.get('/api/'+endpoint).then(r=>{const rows=r.data||[];sI(rows);if(openId){const found=rows.find(x=>String(x.id)===String(openId));if(found)sEd(found)}}).catch(()=>{}),[endpoint,openId]);useEffect(()=>{load()},[load]);
  const save=async d=>{try{if(ed?.id){await api.put('/api/'+endpoint+'/'+ed.id,d)}else{await api.post('/api/'+endpoint,d)}toast(t('btn.save'));sEd(null);load();nav('/'+endpoint)}catch(e){toast(e.message,'e')}};
  if(ed||openId==='new') return <div><div className='ph'><h1>{title}</h1><p>{desc}</p></div><div className='pb'><div className='o-sheet'><div className='o-form-header'><div className='acts'><button className='btn btn-p' onClick={()=>document.getElementById('simple-form-submit')?.click()}>{t('btn.save')}</button><button className='btn btn-s' onClick={()=>{sEd(null);nav('/'+endpoint)}}>{t('btn.cancel')}</button></div></div><div className='o-sheet-inner'><SimpleForm initial={openId==='new'?null:ed} fields={formFields} onSave={save} onClose={()=>{sEd(null);nav('/'+endpoint)}}/></div></div></div></div>;
  return<div><div className='ph'><h1>{title}</h1><p>{desc}</p><div className='acts'><button className='btn btn-p' onClick={()=>nav('/'+endpoint+'?open=new')}><Ic name='plus' size={14}/>{t('btn.add')}</button></div></div>
    <div className='pb'><div className='card'><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}<th>{t('common.actions')}</th></tr></thead>
      <tbody>{items.length?items.map(item=><tr key={item.id}>{columns.map(c=><td key={c.key} style={{fontSize:12}}>{c.render?c.render(item):item[c.key]||'—'}</td>)}
        <td><button className='btn btn-s btn-sm' onClick={()=>nav('/'+endpoint+'?open='+item.id)}><Ic name='edit' size={13}/></button></td></tr>)
      :<tr><td colSpan={columns.length+1}><div className='empty'><h3>{t('common.noData')}</h3></div></td></tr>}</tbody></table></div></div></div>}
function SimpleForm({initial,fields,onSave,onClose}){const{t,locale}=useI18n();const isAr=locale==='ar';const[f,sF]=useState(initial||Object.fromEntries(fields.map(fi=>[fi.key,fi.default??(fi.type==='toggle'?false:'')])));const s=(k,v)=>sF(p=>({...p,[k]:v}));
  const labelOf=fi=>isAr&&(fi.labelAr||fi.label_ar)?(fi.labelAr||fi.label_ar):fi.label;
  const optionLabel=o=>isAr&&(o.labelAr||o.label_ar)?(o.labelAr||o.label_ar):o.label;
  const visibleFields=fields.filter(fi=>{const vfn=fi.visibleIf||fi.visibleWhen;return !vfn||vfn(f)});
  return<form onSubmit={e=>{e.preventDefault();onSave(f)}}><div className='o-form-grid' dir={isAr?'rtl':'ltr'}>{visibleFields.map(fi=><div key={fi.key} className={'fg'+(fi.full?' full':'')}><label>{labelOf(fi)}</label>{fi.type==='select'?<select className='fi' value={f[fi.key]??''} onChange={e=>s(fi.key,e.target.value)}>{(fi.options||[]).map(o=><option key={o.value} value={o.value}>{optionLabel(o)}</option>)}</select>
    :fi.type==='checklist'?<div style={{display:'flex',flexWrap:'wrap',gap:8}}>{(fi.options||[]).map(o=>{const arr=Array.isArray(f[fi.key])?f[fi.key]:[];const on=arr.includes(o.value);return <label key={o.value} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,cursor:'pointer',border:'1px solid '+(on?'var(--o-brand,#714B67)':'var(--line,#d9d9df)'),background:on?'var(--o-brand-soft,#f3edf1)':'#fff',fontSize:13,fontWeight:on?700:500}}><input type='checkbox' checked={on} onChange={e=>{const cur=Array.isArray(f[fi.key])?f[fi.key]:[];s(fi.key,e.target.checked?[...cur.filter(x=>x!==o.value),o.value]:cur.filter(x=>x!==o.value))}} style={{accentColor:'var(--o-brand,#714B67)'}}/><span>{optionLabel(o)}</span></label>})}</div>
    :fi.type==='textarea'?<textarea className='fi' value={f[fi.key]||''} onChange={e=>s(fi.key,e.target.value)}/>
    :fi.type==='toggle'?<label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}><input type='checkbox' checked={!!f[fi.key]} onChange={e=>s(fi.key,e.target.checked)}/><span>{!!f[fi.key]?(isAr?'نعم':'Yes'):(isAr?'لا':'No')}</span></label>
    :<input className='fi' type={fi.type||'text'} value={f[fi.key]??''} onChange={e=>s(fi.key,fi.type==='number'?Number(e.target.value||0):e.target.value)}/> }</div>)}</div><button id='simple-form-submit' type='submit' hidden /></form>}
function TrainersPage(){const{t}=useI18n();return<SimpleCrudPage title={t('trainers.title')} desc={t('trainers.desc')} endpoint="trainers" columns={[{key:'first_name',label:t('members.firstName')},{key:'last_name',label:t('members.lastName')},{key:'phone',label:t('common.phone')},{key:'specialization',label:t('trainers.specialization')},{key:'is_active',label:t('common.status'),render:r=><span className={'badge '+(r.is_active?'b-active':'b-inactive')}>{r.is_active?t('status.active'):t('status.inactive')}</span>}]} formFields={[{key:'first_name',label:t('members.firstName')},{key:'last_name',label:t('members.lastName')},{key:'phone',label:t('common.phone')},{key:'specialization',label:t('trainers.specialization')}]}/>}
function BranchesPage(){const{t}=useI18n();return<SimpleCrudPage title={t('branches.title')} desc={t('branches.desc')} endpoint="branches" columns={[{key:'name',label:t('common.name')},{key:'code',label:t('branches.code')},{key:'city',label:t('branches.city')},{key:'phone',label:t('common.phone')},{key:'opening_time',label:t('branches.open')},{key:'closing_time',label:t('branches.close')}]} formFields={[{key:'name',label:t('common.name')},{key:'code',label:t('branches.code')},{key:'city',label:t('branches.city')},{key:'phone',label:t('common.phone')},{key:'address',label:t('branches.address')},{key:'opening_time',label:t('branches.open'),type:'time',default:'06:00'},{key:'closing_time',label:t('branches.close'),type:'time',default:'23:00'}]}/>}


// Predefined membership features (toggled per plan). Keys are stored on the plan;
// the member PWA maps the same keys to localized labels.
const PLAN_FEATURES=[
  {value:'unlimited_access',label:'Unlimited access',labelAr:'دخول غير محدود'},
  {value:'group_classes',label:'Group classes',labelAr:'حصص جماعية'},
  {value:'personal_trainer',label:'Personal trainer',labelAr:'مدرب شخصي'},
  {value:'nutrition_plan',label:'Nutrition plan',labelAr:'خطة غذائية'},
  {value:'cafeteria_discount',label:'Cafeteria discount',labelAr:'خصم الكافتيريا'},
  {value:'pool_access',label:'Pool access',labelAr:'دخول المسبح'},
  {value:'sauna_spa',label:'Sauna & spa',labelAr:'ساونا وسبا'},
  {value:'locker',label:'Personal locker',labelAr:'خزانة شخصية'},
  {value:'guest_passes',label:'Guest passes',labelAr:'تذاكر ضيوف'},
  {value:'towel_service',label:'Towel service',labelAr:'خدمة المناشف'},
  {value:'inbody',label:'InBody analysis',labelAr:'تحليل InBody'},
  {value:'classes_booking',label:'Class booking',labelAr:'حجز الحصص'},
];
function PlansPage(){
  const { t, locale, formatCurrency } = useI18n();
  const isAr = locale === 'ar';
  const { param, nav } = useRouter();
  const money = v => formatCurrency ? formatCurrency(Number(v || 0)) : `${Number(v || 0).toFixed(2)}`;

  const [items, sI] = useState([]);
  const [current, setCurrent] = useState(null);
  const openId = param('open');

  const load = useCallback(() => {
    api.get('/api/plans').then(r => sI(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openId === 'new') {
      setCurrent({ features: [] });
      return;
    }
    if (openId) {
      const found = items.find(x => String(x.id) === String(openId));
      if (found) setCurrent({ ...found, features: Array.isArray(found.features) ? found.features : [] });
      return;
    }
    setCurrent(null);
  }, [openId, items]);

  const freezeEnabled = f => !!(f.freeze_allowed === true || f.freeze_allowed === 1 || f.freeze_allowed === '1');

  const fields = [
    { key: 'name', label: isAr ? 'الاسم' : 'Name' },
    { key: 'plan_type', label: isAr ? 'النوع' : 'Type', type: 'select', options: [
      { value: 'standard', label: isAr ? 'عادي' : 'Standard' },
      { value: 'trial', label: isAr ? 'تجريبي' : 'Trial' },
      { value: 'drop_in', label: isAr ? 'دخول يومي' : 'Drop-In' },
    ]},
    { key: 'duration_days', label: isAr ? 'عدد الأيام' : 'Days', type: 'number' },
    { key: 'sessions_count', label: isAr ? 'إجمالي الجلسات' : 'Total Sessions', type: 'number', visibleWhen: f => String(f.billing_type || 'period') === 'sessions' },
    { key: 'price', label: isAr ? 'السعر' : 'Price', type: 'number' },
    { key: 'freeze_allowed', label: isAr ? 'السماح بالتجميد' : 'Allow Freeze', type: 'toggle' },
    { key: 'freeze_pricing_mode', label: isAr ? 'نوع رسوم التجميد' : 'Freeze Pricing Mode', type: 'select', default: 'free', options: [
      { value: 'free', label: isAr ? 'مجاني (بدون رسوم)' : 'Free (No Fee)' },
      { value: 'inherit', label: isAr ? 'افتراضي من الإعدادات' : 'Default from Settings' },
      { value: 'fixed', label: isAr ? 'ثابت' : 'Fixed' },
      { value: 'per_day', label: isAr ? 'لكل يوم' : 'Per Day' },
    ], visibleWhen: freezeEnabled },
    { key: 'freeze_max_days', label: isAr ? 'حد أيام التجميد' : 'Freeze Days Limit', type: 'number', visibleWhen: freezeEnabled },
    { key: 'freeze_fixed_price', label: isAr ? 'رسوم التجميد الثابتة' : 'Fixed Freeze Fee', type: 'number', visibleWhen: f => String(f.freeze_pricing_mode || 'free') === 'fixed' && freezeEnabled(f) },
    { key: 'freeze_price_per_day', label: isAr ? 'رسوم التجميد لكل يوم' : 'Freeze Fee Per Day', type: 'number', visibleWhen: f => String(f.freeze_pricing_mode || 'free') === 'per_day' && freezeEnabled(f) },
    { key: 'features', label: isAr ? 'المزايا الظاهرة في التطبيق' : 'Features shown in the app', type: 'checklist', options: PLAN_FEATURES, full: true },
    { key: 'cafeteria_discount_percent', label: isAr ? 'نسبة خصم الكافتيريا (%)' : 'Cafeteria discount (%)', type: 'number', visibleWhen: f => Array.isArray(f.features) && f.features.includes('cafeteria_discount') },
    { key: 'is_active', label: isAr ? 'نشط' : 'Active', type: 'toggle', default: true },
  ];

  const save = async data => {
    const payload = { ...data };
    // Features editor: selected feature keys → array stored on the plan.
    payload.features = Array.isArray(payload.features) ? payload.features : [];
    // Defaults for fields removed from form
    if (!payload.billing_type) payload.billing_type = 'period';
    if (payload.billing_type !== 'sessions') delete payload.sessions_count;
    if (!payload.freeze_allowed) {
      payload.freeze_pricing_mode = 'inherit';
      payload.freeze_max_days = 0;
      payload.freeze_fixed_price = 0;
      payload.freeze_price_per_day = 0;
    }
    if (payload.freeze_pricing_mode === 'free') {
      payload.freeze_fixed_price = 0;
      payload.freeze_price_per_day = 0;
    }
    if (payload.id) await api.put('/api/plans/' + payload.id, payload);
    else await api.post('/api/plans', payload);
    toast(t('btn.save'));
    setCurrent(null);
    nav('/plans');
    load();
  };

  const record = current ? { ...current } : null;

  if (record) {
    return (
      <div className='o-module-page'>
        <div className='o-form-shell'>
          <div className='o-form-sheet'>
            <div className='o-form-sheet-header'>
              <div>
                <h1>{record.id ? (isAr ? 'تعديل الباقة' : 'Edit Plan') : (isAr ? 'إضافة باقة' : 'New Plan')}</h1>
                <p>{isAr ? 'إنشاء وتعديل بيانات الباقة' : 'Create and edit plan details'}</p>
              </div>
              <div className='acts'>
                <button className='btn btn-p' onClick={() => document.getElementById('simple-form-submit')?.click()}>{t('btn.save')}</button>
                <button className='btn btn-s' onClick={() => { setCurrent(null); nav('/plans'); }}>{t('btn.cancel')}</button>
              </div>
            </div>
            <div className='o-sheet-inner'>
              <div className='o-form-section-title'>{isAr ? 'بيانات الباقة' : 'Plan Details'}</div>
              <SimpleForm initial={record} fields={fields} onSave={save} onClose={() => { setCurrent(null); nav('/plans'); }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    active: items.filter(p => p.is_active).length,
    freeze: items.filter(p => Number(p.freeze_allowed || 0)).length,
    total: items.length,
  };

  return (
    <div className='o-module-page'>
      <div className='o-module-titlebar'>
        <div>
          <h1>{t('plans.title')}</h1>
          <p>{isAr ? 'الباقات بنفس تخطيط أودو مع نموذج كامل داخل الصفحة' : 'Plans in full-page Odoo-style form and list layout'}</p>
        </div>
      </div>

      <div className='o-kpi-grid compact'>
        <div className='o-kpi-card'>
          <div className='o-kpi-label'>{isAr ? 'كل الباقات' : 'All Plans'}</div>
          <div className='o-kpi-value'>{stats.total}</div>
          <div className='o-kpi-sub'>{isAr ? 'السجلات المتاحة' : 'available records'}</div>
        </div>
        <div className='o-kpi-card'>
          <div className='o-kpi-label'>{isAr ? 'نشطة' : 'Active'}</div>
          <div className='o-kpi-value'>{stats.active}</div>
          <div className='o-kpi-sub'>{isAr ? 'قابلة للبيع' : 'ready to sell'}</div>
        </div>
        <div className='o-kpi-card'>
          <div className='o-kpi-label'>{isAr ? 'تدعم التجميد' : 'Freeze Enabled'}</div>
          <div className='o-kpi-value'>{stats.freeze}</div>
          <div className='o-kpi-sub'>{isAr ? 'مع سياسة تجميد' : 'freeze supported'}</div>
        </div>
      </div>

      <div className='o-control-panel-shell'>
        <div className='o-control-panel-main'>
          <div className='o-control-panel-left'>
            <button className='btn btn-p' onClick={() => nav('/plans?open=new')}>
              <Ic name='plus' size={14} />
              {t('btn.add')}
            </button>
          </div>
        </div>
      </div>

      <div className='o-list-card'>
        <table className='o-list-table'>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.type')}</th>
              <th>{t('plans.billing')}</th>
              <th>{t('plans.days')}</th>
              <th>{t('common.price')}</th>
              <th>{t('memberships.addFreeze', 'التجميد')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map(p => (
              <tr key={p.id}>
                <td>{isAr ? (p.name_ar || p.name) : p.name}</td>
                <td><span className='badge b-info'>{isAr ? ({ standard:'عادي', trial:'تجريبي', drop_in:'دخول يومي' }[p.plan_type] || p.plan_type) : p.plan_type}</span></td>
                <td>{isAr ? ({ period:'مدة', sessions:'جلسات' }[p.billing_type] || p.billing_type) : p.billing_type}</td>
                <td>{p.duration_days || 0}</td>
                <td className='o-money-cell'>{money(p.price)}</td>
                <td><span className={'badge ' + (Number(p.freeze_allowed || 0) ? 'b-active' : 'b-danger')}>{Number(p.freeze_allowed || 0) ? (isAr ? 'مسموح' : 'Yes') : (isAr ? 'غير مسموح' : 'No')}</span></td>
                <td><span className={'badge ' + (p.is_active ? 'b-active' : 'b-inactive')}>{p.is_active ? t('status.active') : t('status.inactive')}</span></td>
                <td>
                  <button className='btn btn-s btn-sm' onClick={() => nav('/plans?open=' + p.id)}>
                    <Ic name='edit' size={13} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan='8'>
                  <div className='empty'><h3>{t('common.noData')}</h3></div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ CHECKIN POPUP CARD ═══

function CheckinPopupCard({member,onClose,onCheckIn,onCheckOut}){const{t,locale,formatCurrency}=useI18n();const isAr=locale==='ar';
  const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
  const ms=member?.activeMembership||member?.membership||null;
  const msStatus=ms?.status||'none';
  const daysLeft=ms?.end_date?Math.ceil((new Date(ms.end_date)-new Date())/86400000):null;
  const statusLabel=msStatus==='active'?(isAr?'الاشتراك فعّال':'Subscription Active'):msStatus==='expired'?(isAr?'الاشتراك منتهي':'Subscription Expired'):msStatus==='frozen'?(isAr?'الاشتراك مجمّد':'Subscription Frozen'):(isAr?'بدون اشتراك':'No Subscription');
  const statusColor=msStatus==='active'?'var(--green)':msStatus==='expired'?'var(--red)':msStatus==='frozen'?'var(--cyan)':'var(--t4)';
  const statusBg=msStatus==='active'?'var(--green-g)':msStatus==='expired'?'var(--red-g)':msStatus==='frozen'?'var(--cyan-g)':'rgba(148,163,184,.1)';
  const isExpiringSoon=daysLeft!==null&&daysLeft>0&&daysLeft<=7;
  const canCheckIn=member?.status==='active'&&(msStatus==='active'||msStatus==='none');
  const isCurrentlyIn=member?.currently_in;
  const now=new Date();const hours=now.getHours();const mins=String(now.getMinutes()).padStart(2,'0');const secs=String(now.getSeconds()).padStart(2,'0');const ampm=hours>=12?(isAr?'م':'PM'):(isAr?'ص':'AM');const h12=hours%12||12;
  const timeStr=`${h12}:${mins}:${secs} ${ampm}`;
  return<div className="mo" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="cpc" dir={isAr?'rtl':'ltr'}>
    <button className="cpc-close" onClick={onClose}>×</button>
    <div className="cpc-status-bar" style={{background:statusBg,borderColor:statusColor}}>
      <div className="cpc-status-icon" style={{color:statusColor}}>{msStatus==='active'?<Ic name='check' size={22}/>:msStatus==='expired'?<Ic name='x' size={22}/>:msStatus==='frozen'?<Ic name='snowflake' size={22}/>:'—'}</div>
      <div><div className="cpc-status-text" style={{color:statusColor}}>{statusLabel}</div>
      <div className="cpc-time">{timeStr}</div></div>
    </div>
    <div className="cpc-body">
      <div className="cpc-profile">
        <div className="cpc-avatar" style={{background:statusColor}}>{(member?.first_name||'?')[0]}</div>
        <div className="cpc-info">
          <div className="cpc-name">{fullMemberName(member)}</div>
          <div className="cpc-phone">{isAr?'موبايل:':'Phone:'} {member?.phone||'—'}</div>
          <div className="cpc-member-no">{member?.member_no}</div>
        </div>
      </div>
      {ms&&<div className="cpc-plan-section">
        <div className="cpc-plan-grid">
          <div className="cpc-plan-item"><div className="cpc-plan-label">{isAr?'البرنامج':'Plan'}</div><div className="cpc-plan-value">{ms.plan_name||ms.plan_display||'—'}</div></div>
          <div className="cpc-plan-item"><div className="cpc-plan-label">{isAr?'من تاريخ':'Start'}</div><div className="cpc-plan-value">{ms.start_date||'—'}</div></div>
          <div className="cpc-plan-item"><div className="cpc-plan-label">{isAr?'إلى تاريخ':'End'}</div><div className="cpc-plan-value">{ms.end_date||'∞'}</div></div>
          {isExpiringSoon&&<div className="cpc-plan-item" style={{gridColumn:'1/-1'}}><div className="cpc-plan-label" style={{color:'var(--amber)',display:'inline-flex',alignItems:'center',gap:6}}><Ic name='alert-triangle' size={13}/>{isAr?'ينتهي قريباً':'Expiring Soon'}</div><div className="cpc-plan-value" style={{color:'var(--amber)'}}>{daysLeft} {isAr?'يوم متبقي':'days left'}</div></div>}
        </div>
        <div className="cpc-money-grid">
          <div className="cpc-money-item"><div className="cpc-plan-label">{isAr?'السعر':'Price'}</div><div className="cpc-money-val">{money(ms.total_amount||ms.price||0)}</div></div>
          <div className="cpc-money-item"><div className="cpc-plan-label">{isAr?'المدفوع':'Paid'}</div><div className="cpc-money-val" style={{color:'var(--green)'}}>{money(ms.paid_amount||ms.total_paid||0)}</div></div>
          <div className="cpc-money-item"><div className="cpc-plan-label">{isAr?'المتبقي':'Balance'}</div><div className="cpc-money-val" style={{color:Number(ms.balance_amount||0)>0?'var(--amber)':'var(--green)'}}>{money(ms.balance_amount||0)}</div></div>
        </div>
      </div>}
      {!ms&&<div className="cpc-no-plan"><Ic name='clipboard' size={32}/><div>{isAr?'لا يوجد اشتراك فعال':'No active subscription'}</div></div>}
    </div>
    <div className="cpc-footer">
      {isCurrentlyIn?<button className="btn cpc-btn cpc-btn-out" onClick={()=>onCheckOut&&onCheckOut(member.id)}><Ic name='log-out' size={18}/>{isAr?'تسجيل خروج':'Check Out'}</button>
      :canCheckIn?<button className="btn cpc-btn cpc-btn-in" onClick={()=>onCheckIn&&onCheckIn(member.id,ms?.id)}><Ic name='check' size={18}/>{isAr?'تسجيل دخول':'Check In'}</button>
      :<button className="btn cpc-btn cpc-btn-disabled" disabled><Ic name='x' size={18}/>{msStatus==='expired'?(isAr?'الاشتراك منتهي — لا يمكن الدخول':'Expired — Cannot Check In'):msStatus==='frozen'?(isAr?'الاشتراك مجمّد':'Frozen — Cannot Check In'):(isAr?'غير مسموح بالدخول':'Cannot Check In')}</button>}
      <button className="btn btn-s" onClick={onClose} style={{padding:'10px 20px'}}>{isAr?'إغلاق':'Close'}</button>
    </div>
  </div></div>}

// ═══ FINGERPRINT TAB ═══
function MemberFingerprintTab({member}){const{locale}=useI18n();const isAr=locale==='ar';
  const fpEnrolled=member?.fingerprint_enrolled||false;
  const fpDate=member?.fingerprint_date||null;
  return<div style={{display:'grid',gap:20}}>
    <div style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div className="fp-visual">
        <svg viewBox="0 0 120 150" width="120" height="150" style={{opacity:fpEnrolled?.8:.25}}>
          <defs><linearGradient id="fpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fpEnrolled?'var(--green)':'var(--t4)'}/><stop offset="100%" stopColor={fpEnrolled?'var(--green)':'var(--t4)'} stopOpacity=".3"/></linearGradient></defs>
          <g fill="none" stroke="url(#fpg)" strokeWidth="2">
            <ellipse cx="60" cy="85" rx="35" ry="45"/><ellipse cx="60" cy="85" rx="28" ry="38"/>
            <ellipse cx="60" cy="85" rx="21" ry="31"/><ellipse cx="60" cy="85" rx="14" ry="24"/>
            <ellipse cx="60" cy="85" rx="7" ry="17"/>
            <path d="M25 60 Q35 30 60 25 Q85 30 95 60"/><path d="M30 55 Q40 35 60 30 Q80 35 90 55"/>
            <path d="M35 50 Q45 38 60 35 Q75 38 85 50"/>
          </g>
          {fpEnrolled&&<circle cx="95" cy="25" r="14" fill="var(--green)"/>}
          {fpEnrolled&&<path d="M88 25 L93 30 L102 20" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
        </svg>
      </div>
      <div style={{flex:1,minWidth:200}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>{isAr?'البصمة':'Fingerprint'}</div>
        <div className="dg" style={{marginBottom:16}}>
          <div className="di"><div className="dl">{isAr?'الحالة':'Status'}</div><div className="dv"><span className={'badge '+(fpEnrolled?'b-active':'b-inactive')}>{fpEnrolled?(isAr?'مسجّلة':'Enrolled'):(isAr?'غير مسجّلة':'Not Enrolled')}</span></div></div>
          {fpDate&&<div className="di"><div className="dl">{isAr?'تاريخ التسجيل':'Enrolled On'}</div><div className="dv">{fpDate}</div></div>}
          <div className="di"><div className="dl">{isAr?'المعرّف':'Member ID'}</div><div className="dv" style={{fontFamily:'monospace'}}>{member?.member_no||'—'}</div></div>
          <div className="di"><div className="dl">{isAr?'QR Code':'QR Code'}</div><div className="dv" style={{fontFamily:'monospace',fontSize:11}}>{member?.qr_code||'—'}</div></div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {!fpEnrolled?<button className="btn btn-p" onClick={()=>toast(isAr?'يرجى توصيل جهاز البصمة أولاً':'Please connect fingerprint device first','i')}><Ic name="plus" size={14}/>{isAr?'تسجيل البصمة':'Enroll Fingerprint'}</button>
          :<><button className="btn btn-s" onClick={()=>toast(isAr?'يرجى توصيل جهاز البصمة أولاً':'Please connect fingerprint device first','i')}><Ic name="refresh" size={14}/>{isAr?'إعادة تسجيل':'Re-enroll'}</button>
          <button className="btn btn-d btn-sm" onClick={()=>toast(isAr?'تم حذف البصمة':'Fingerprint removed')}>{isAr?'حذف البصمة':'Remove'}</button></>}
        </div>
      </div>
    </div>
    <div className="card" style={{margin:0}}><div className="ct">{isAr?'سجل استخدام البصمة':'Fingerprint Usage Log'}</div>
      <div style={{fontSize:12,color:'var(--t3)',marginBottom:12}}>{isAr?'آخر عمليات تسجيل الدخول بالبصمة':'Recent fingerprint check-ins for this member'}</div>
      {(member?.recentAttendance||[]).length>0?<table><thead><tr><th>{isAr?'التاريخ':'Date'}</th><th>{isAr?'الدخول':'Check In'}</th><th>{isAr?'الخروج':'Check Out'}</th><th>{isAr?'المدة':'Duration'}</th><th>{isAr?'الطريقة':'Method'}</th></tr></thead>
        <tbody>{(member?.recentAttendance||[]).slice(0,10).map(a=><tr key={a.id}><td style={{fontSize:12}}>{a.check_in?.split(' ')[0]||'—'}</td><td style={{fontSize:12}}>{a.check_in||'—'}</td><td style={{fontSize:12}}>{a.check_out||<span className="badge b-active">{isAr?'داخل':'In'}</span>}</td><td style={{fontSize:12}}>{a.duration_minutes?a.duration_minutes+'m':'—'}</td><td style={{fontSize:12}}><span className="badge b-info">{isAr?'بصمة':'Fingerprint'}</span></td></tr>)}</tbody></table>
      :<div className="empty" style={{padding:30}}><h3>{isAr?'لا يوجد سجل بصمة':'No fingerprint logs'}</h3></div>}
    </div>
    <div className="card" style={{margin:0,background:'rgba(99,102,241,.04)',border:'1px solid rgba(99,102,241,.15)'}}><div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
      <span style={{flexShrink:0,display:'inline-flex'}}><Ic name='lightbulb' size={20}/></span>
      <div><div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{isAr?'ملاحظة الأجهزة':'Hardware Note'}</div>
      <div style={{fontSize:12,color:'var(--t3)',lineHeight:1.7}}>{isAr?'لتسجيل البصمة واستخدامها في تسجيل الدخول، يجب توصيل جهاز البصمة (ZK, DigitalPersona, SecuGen أو أي جهاز متوافق) بالنظام. عند مطابقة البصمة، ستظهر بطاقة العضو المنبثقة تلقائياً مع حالة الاشتراك.':'To enroll and use fingerprint for check-in, connect a compatible fingerprint reader (ZK, DigitalPersona, SecuGen, etc.) to the system. When a fingerprint matches, the member popup card will appear automatically showing subscription status.'}</div></div>
    </div></div>
  </div>}

// ═══ ATTENDANCE ═══
function AttendancePage(){const{t,locale}=useI18n();const isAr=locale==='ar';const[stats,sStats]=useState(null);const[today,sToday]=useState([]);const[q,sQ]=useState('');const[sr,sSR]=useState([]);const[popup,sPopup]=useState(null);
  const loadAll=()=>{api.get('/api/attendance/stats').then(r=>sStats(r.data)).catch(()=>{});api.get('/api/attendance/today').then(r=>sToday(r.data)).catch(()=>{})};
  useEffect(()=>{loadAll();const iv=setInterval(loadAll,30000);return()=>clearInterval(iv)},[]);
  useEffect(()=>{if(q.length<2)return sSR([]);const tm=setTimeout(()=>{api.get('/api/attendance/search?q='+q).then(r=>sSR(r.data)).catch(()=>{})},250);return()=>clearTimeout(tm)},[q]);
  const showPopup=async(m)=>{try{const r=await api.get('/api/members/'+m.id);const member=r.data;const inGym=today.find(l=>l.member_id===m.id&&!l.check_out);member.currently_in=!!inGym;member.activeMembership=member.activeMembership||(member.memberships||[])[0]||null;sPopup(member)}catch(_){sPopup({...m,activeMembership:null})}};
  const checkIn=async(mid,msid)=>{try{await api.post('/api/attendance/checkin',{member_id:mid,membership_id:msid});toast(t('attendance.checkIn'));sQ('');sSR([]);sPopup(null);loadAll()}catch(e){toast(e.message,'e')}};
  const checkOut=async mid=>{try{await api.post('/api/attendance/checkout',{member_id:mid});toast(t('attendance.checkOut'));sPopup(null);loadAll()}catch(e){toast(e.message,'e')}};
  return<div><div className="ph"><h1>{t('attendance.title')}</h1><p>{t('attendance.desc')}</p></div><div className="pb">
    {stats&&<div className="sg" style={{gridTemplateColumns:'repeat(4,1fr)'}}><div className="sc"><div className="sl">{t('attendance.today')}</div><div className="sv">{stats.today}</div></div><div className="sc"><div className="sl">{t('attendance.inGym')}</div><div className="sv">{stats.currentlyIn}</div></div><div className="sc"><div className="sl">{t('attendance.thisWeek')}</div><div className="sv">{stats.thisWeek}</div></div><div className="sc"><div className="sl">{t('attendance.thisMonth')}</div><div className="sv">{stats.thisMonth}</div></div></div>}
    <div className="checkin-hero"><div style={{fontSize:16,fontWeight:600}}>{t('attendance.quickCheckin')}</div><div style={{fontSize:13,color:'var(--t3)'}}>{isAr?'ابحث بالاسم أو الرقم أو امسح البطاقة أو ضع البصمة':t('attendance.searchScan')}</div>
      <input className="fi" placeholder={isAr?'اسم، رقم عضوية، هاتف، أو بصمة...':t('attendance.typeOrScan')} value={q} onChange={e=>sQ(e.target.value)} autoFocus style={{fontSize:18,textAlign:'center',maxWidth:500,marginTop:10}}/>
      <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:12}}><span className="badge b-info" style={{fontSize:11,padding:'4px 10px',display:'inline-flex',alignItems:'center',gap:4}}><Ic name='search' size={12}/> {isAr?'بحث':'Search'}</span><span className="badge b-active" style={{fontSize:11,padding:'4px 10px',display:'inline-flex',alignItems:'center',gap:4}}><Ic name='scan-line' size={12}/> {isAr?'QR / باركود':'QR / Barcode'}</span><span className="badge b-new" style={{fontSize:11,padding:'4px 10px',display:'inline-flex',alignItems:'center',gap:4}}><Ic name='fingerprint' size={12}/> {isAr?'بصمة':'Fingerprint'}</span></div>
    </div>
    {sr.length>0&&<div className="card">{sr.map(m=><div key={m.id} className="cpc-search-row" onClick={()=>showPopup(m)}>
      <div style={{display:'flex',alignItems:'center',gap:10}}><div className="mws-av" style={{width:36,height:36,fontSize:14}}>{(m.first_name||'?')[0]}</div><div><strong style={{fontSize:13}}>{fullMemberName(m)}</strong><div style={{fontSize:11,color:'var(--t4)'}}>{m.member_no} · {m.phone||'—'}</div></div></div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}><span className={'badge b-'+m.status}>{t('status.'+m.status,m.status)}</span><span style={{fontSize:18,color:'var(--accent-h)'}}>→</span></div>
    </div>)}</div>}
    <div className="card"><div className="ct">{t('attendance.todayLog')} ({today.length})</div>{today.length?<table><thead><tr><th>{t('memberships.member')}</th><th>{t('attendance.in')}</th><th>{t('attendance.out')}</th><th>{t('attendance.duration')}</th><th>{t('common.actions')}</th></tr></thead>
      <tbody>{today.map(l=><tr key={l.id}><td><strong style={{fontSize:12}}>{l.first_name} {l.last_name}</strong></td><td style={{fontSize:11}}>{l.check_in}</td>
        <td style={{fontSize:11}}>{l.check_out||<span className="badge b-active">{t('attendance.in')}</span>}</td><td style={{fontSize:11}}>{l.check_out?l.duration_minutes+'m':'—'}</td>
        <td>{!l.check_out&&<button className="btn btn-s btn-sm" onClick={()=>checkOut(l.member_id)}>{t('attendance.out')}</button>}</td></tr>)}</tbody></table>:<div className="empty"><h3>{t('attendance.noCheckins')}</h3></div>}</div>
  </div>
  {popup&&<CheckinPopupCard member={popup} onClose={()=>sPopup(null)} onCheckIn={checkIn} onCheckOut={checkOut}/>}
  </div>}

// ═══ SCHEDULE ═══
function SchedulePage(){const{t,locale}=useI18n();const isAr=locale==='ar';const[week,sWeek]=useState([]);const[status,sStatus]=useState('loading');useEffect(()=>{api.get('/api/schedule/week').then(r=>{sWeek(r.data||[]);sStatus('ok')}).catch(()=>sStatus('unavailable'))},[]);
  return<div><div className="ph"><h1>{t('schedule.title')}</h1><p>{t('schedule.desc')}</p></div><div className="pb">
    {status==='unavailable'?<div style={{textAlign:'center',padding:'48px 20px',color:'var(--t3)'}}><div style={{marginBottom:12}}><Ic name='calendar' size={40}/></div><h3 style={{fontSize:16,fontWeight:700,marginBottom:6}}>{isAr?'وحدة الجدولة غير مفعّلة':'Scheduling module is not enabled'}</h3><p style={{fontSize:13}}>{isAr?'يمكن تفعيلها من الإعدادات ← الوحدات لاستخدام جدول الحصص.':'Enable it from Settings → Modules to use class scheduling.'}</p></div>
    :status==='loading'?<div style={{textAlign:'center',padding:48,color:'var(--t4)',fontSize:13}}>…</div>
    :<div className="week-grid">{week.map((d,i)=><div key={i} className="week-col"><div className="day-name">{d.day?.slice(0,3)}</div>
      {d.classes?.length?d.classes.map(c=><div key={c.id} className="class-slot" style={{borderColor:c.color||'var(--accent)',background:(c.color||'#6366f1')+'18'}}>
        <div className="cs-time">{c.start_time}–{c.end_time}</div><div style={{marginTop:1}}>{c.class_name||c.title}</div></div>)
      :<div style={{fontSize:11,color:'var(--t4)',textAlign:'center',marginTop:20}}>—</div>}</div>)}</div>}</div></div>}

// ═══ ENGAGEMENT ═══
function EngagementPage(){const{t}=useI18n();const[ret,sRet]=useState(null);const[ann,sAnn]=useState([]);const[tab,sTab]=useState('retention');
  useEffect(()=>{api.get('/api/engagement/retention').then(r=>sRet(r.data)).catch(()=>{});api.get('/api/engagement/announcements').then(r=>sAnn(r.data)).catch(()=>{})},[]);
  return<div><div className="ph"><h1>{t('engagement.title')}</h1><p>{t('engagement.desc')}</p></div><div className="pb">
    <div className="tabs"><div className={'tab'+(tab==='retention'?' ac':'')} onClick={()=>sTab('retention')}>{t('engagement.retention')}</div><div className={'tab'+(tab==='announcements'?' ac':'')} onClick={()=>sTab('announcements')}>{t('engagement.announcements')}</div></div>
    {tab==='retention'&&ret&&<div><div className="sg" style={{gridTemplateColumns:'repeat(3,1fr)'}}><div className="sc"><div className="sl">{t('engagement.highRisk')}</div><div className="sv" style={{color:'var(--red)'}}>{ret.summary?.highRisk||0}</div></div><div className="sc"><div className="sl">{t('engagement.mediumRisk')}</div><div className="sv" style={{color:'var(--amber)'}}>{ret.summary?.mediumRisk||0}</div></div><div className="sc"><div className="sl">{t('engagement.lowRisk')}</div><div className="sv" style={{color:'var(--green)'}}>{ret.summary?.lowRisk||0}</div></div></div>
      <div className="card"><div className="ct">{t('engagement.atRiskMembers')}</div>{ret.members?.length?<table><thead><tr><th>{t('memberships.member')}</th><th>{t('members.lastVisit')}</th><th>{t('members.payment')}</th></tr></thead><tbody>{ret.members.map(m=><tr key={m.id}><td><strong style={{fontSize:12}}>{fullMemberName(m)}</strong></td><td style={{fontSize:12}}>{m.last_visit_at?timeSince(m.last_visit_at):t('members.never')}</td><td>{m.payment_status?<span className={'badge b-'+m.payment_status}>{t('status.'+m.payment_status,m.payment_status)}</span>:'—'}</td></tr>)}</tbody></table>:<div className="empty"><h3>{t('engagement.noAtRisk')}</h3></div>}</div></div>}
    {tab==='announcements'&&<div>{ann.length?ann.map(a=><div key={a.id} className="card"><strong>{a.title}</strong> <span className={'badge b-'+(a.is_published?'active':'inactive')}>{a.is_published?t('engagement.publish'):'Draft'}</span><p style={{fontSize:13,color:'var(--t3)',marginTop:4}}>{a.body}</p></div>):<div className="empty"><h3>{t('engagement.noAnnouncements')}</h3></div>}</div>}
  </div></div>}

// ═══ MODULES PAGE ═══
function ModulesPage(){const{t,formatDateTime}=useI18n();const[mods,sMods]=useState([]);const[logs,sLogs]=useState([]);const[selLog,sSelLog]=useState(null);const[uploading,sUploading]=useState(false);const[uploadResult,sUploadResult]=useState(null);const[tab,sTab]=useState('installed');const fileRef=useRef(null);
  const load=()=>{api.get('/api/modules').then(r=>sMods(r.data)).catch(()=>{});api.get('/api/system/module-logs?limit=80').then(r=>sLogs(r.data)).catch(()=>{})};useEffect(()=>{load()},[]);
  const toggle=async(name,en)=>{try{await api.put('/api/modules/'+name+'/toggle',{enabled:en});toast(en?t('btn.enable'):t('btn.disable'));load()}catch(e){toast(e.message,'e')}};
  const handleUpload=async e=>{const file=e.target.files?.[0];if(!file)return;sUploading(true);sUploadResult(null);try{const r=await api.upload('/api/modules/upload',file);sUploadResult(r);toast(r.success?t('modules.installSuccess'):r.errors?.[0]||t('modules.installFailed'),r.success?'s':'e');load()}catch(e){toast(e.message,'e')}sUploading(false)};
  return<div><div className="ph"><h1>{t('modules.title')}</h1><p>{t('modules.desc')}</p><div className="acts"><button className="btn btn-p" onClick={()=>fileRef.current?.click()} disabled={uploading}><Ic name="upload" size={14}/>{uploading?t('modules.uploading'):t('modules.uploadModule')}</button><input ref={fileRef} type="file" accept=".zip" style={{display:'none'}} onChange={handleUpload}/></div></div>
    <div className="pb">
      <div className="tabs"><div className={'tab'+(tab==='installed'?' ac':'')} onClick={()=>sTab('installed')}>{t('modules.installed')} ({mods.length})</div><div className={'tab'+(tab==='logs'?' ac':'')} onClick={()=>sTab('logs')}>{t('modules.logs')}</div><div className={'tab'+(tab==='upload'?' ac':'')} onClick={()=>sTab('upload')}>{t('modules.uploadTab')}</div></div>
      {tab==='installed'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:12}}>{mods.map(m=><div key={m.name} className="card" style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div><div style={{fontWeight:600,fontSize:14}}>{m.name} {m.core?<span className="badge b-info" style={{fontSize:9}}>{t('modules.core')}</span>:null}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>{m.description||'—'}</div></div><span className={'badge b-'+(m.status||'unknown')}>{t('status.'+m.status,m.status)}</span></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11,color:'var(--t3)'}}><div>{t('modules.version')}: <strong style={{color:'var(--t1)'}}>{m.version}</strong></div><div>{t('modules.loadTime')}: <strong style={{color:'var(--t1)'}}>{m.loadTimeMs||'—'}ms</strong></div></div>
          {m.error&&<div style={{fontSize:11,color:'var(--red)',background:'var(--red-g)',padding:'5px 8px',borderRadius:4}}>{m.error}</div>}
          <div style={{display:'flex',justifyContent:'flex-end',gap:4}}><button className="btn btn-s btn-sm" onClick={()=>{sSelLog(m.name);sTab('logs')}}>{t('modules.logs')}</button>{!m.core&&<button className="btn btn-s btn-sm" onClick={()=>toggle(m.name,!(m.enabled||m.status==='active'))}>{m.enabled||m.status==='active'?t('btn.disable'):t('btn.enable')}</button>}</div></div>)}</div>}
      {tab==='logs'&&<div className="card"><div className="ct">{t('modules.logs')} {selLog&&<span style={{fontWeight:400,fontSize:12,color:'var(--t3)'}}>— {selLog} <button className="btn btn-s btn-sm" onClick={()=>sSelLog(null)} style={{marginLeft:6}}>{t('common.all')}</button></span>}</div>
        <div style={{maxHeight:500,overflow:'auto'}}>{(selLog?logs.filter(l=>l.module_name===selLog):logs).map(l=><div key={l.id} className="log-entry"><span className={'log-level l-'+l.level}>{l.level}</span><div style={{flex:1}}><span style={{color:'var(--accent-h)',fontWeight:500}}>{l.module_name}</span> {l.message}<div style={{fontSize:10,color:'var(--t4)',marginTop:1}}>{formatDateTime(l.created_at)}</div></div></div>)}</div></div>}
      {tab==='upload'&&<div className="card"><div className="ct">{t('modules.uploadTab')}</div><div className="upload-zone" onClick={()=>fileRef.current?.click()}><Ic name="upload" size={32} style={{marginBottom:12,color:'var(--t3)'}}/><br/><div style={{fontSize:14,fontWeight:500,marginBottom:4}}>{t('modules.dropZip')}</div><div style={{fontSize:12,color:'var(--t3)'}}>{t('modules.mustContain')}</div></div>
        {uploadResult&&<div style={{marginTop:16,padding:14,borderRadius:'var(--rs)',background:uploadResult.success?'var(--green-g)':'var(--red-g)'}}><div style={{fontWeight:600,marginBottom:4,color:uploadResult.success?'var(--green)':'var(--red)'}}>{uploadResult.success?t('modules.installSuccess'):t('modules.installFailed')}</div>
          {uploadResult.data?.errors?.map((e,i)=><div key={i} style={{fontSize:12,color:'var(--red)',marginTop:2}}>• {e}</div>)}{uploadResult.data?.warnings?.map((w,i)=><div key={i} style={{fontSize:12,color:'var(--amber)',marginTop:2,display:'flex',alignItems:'center',gap:4}}><Ic name='alert-triangle' size={12}/> {w}</div>)}</div>}</div>}
    </div></div>}

// ═══ SYSTEM HEALTH ═══
function SystemHealthPage(){const{t}=useI18n();const[d,sd]=useState(null);useEffect(()=>{api.get('/api/system/diagnostics').then(r=>sd(r.data)).catch(()=>{})},[]);
  if(!d)return<div className="pld"><span className="spinner"/></div>;const fmt=b=>Math.round(b/1024/1024)+'MB';
  return<div><div className="ph"><h1>{t('health.title')}</h1><p>{t('health.desc')}</p></div><div className="pb">
    <div className="sg" style={{gridTemplateColumns:'repeat(4,1fr)'}}><div className="sc"><div className="sl">{t('modules.title')}</div><div className="sv">{d.totalModules}</div><div className="ss">{d.active} {t('status.active').toLowerCase()}</div></div>
      <div className="sc"><div className="sl">{t('health.uptime')}</div><div className="sv">{Math.floor(d.uptime/60)}m</div></div>
      <div className="sc"><div className="sl">{t('health.memory')}</div><div className="sv">{fmt(d.memoryUsage?.heapUsed)}</div></div>
      <div className="sc"><div className="sl">{t('health.nodeVersion')}</div><div className="sv" style={{fontSize:16}}>{d.nodeVersion}</div></div></div>
    {d.bootErrors?.length>0&&<div className="card"><div className="ct" style={{color:'var(--red)'}}>{t('health.bootErrors')}</div>{d.bootErrors.map((e,i)=><div key={i} className="alert-card a-danger"><div className="at"><strong>{e.module}:</strong> {e.error}</div></div>)}</div>}
    {d.boot?.steps&&<div className="card"><div className="ct">{t('health.bootSequence')} ({d.boot.bootTimeMs}ms)</div><table><thead><tr><th>{t('health.step')}</th><th>{t('common.status')}</th><th>{t('dashboard.time')}</th></tr></thead><tbody>{d.boot.steps.map((s,i)=><tr key={i}><td style={{fontSize:12}}>{s.name}</td><td><span className={'badge b-'+(s.status==='ok'?'active':'failed')}>{s.status}</span></td><td style={{fontSize:12}}>{s.timeMs}ms</td></tr>)}</tbody></table></div>}
    <div className="card"><div className="ct">{t('health.moduleHealth')}</div><table><thead><tr><th>{t('common.name')}</th><th>{t('common.status')}</th><th>{t('modules.version')}</th><th>{t('health.loadTimeMs')}</th></tr></thead>
      <tbody>{d.modules?.map(m=><tr key={m.name}><td><strong style={{fontSize:12}}>{m.name}</strong></td><td><span className={'badge b-'+m.status}>{t('status.'+m.status,m.status)}</span></td><td style={{fontSize:12}}>{m.version}</td><td style={{fontSize:12}}>{m.loadTimeMs||'—'}ms</td></tr>)}</tbody></table></div>
  </div></div>}

// ═══ SETTINGS (modular, schema-driven) ═══
function QrView({value,size=168}){
  const ref=useRef(null);
  useEffect(()=>{const el=ref.current;if(!el)return;const QR=window.QRCode;
    if(value&&QR&&QR.toCanvas){QR.toCanvas(el,String(value),{width:size,margin:1,errorCorrectionLevel:'M'},()=>{});}
    else{const ctx=el.getContext&&el.getContext('2d');if(ctx){ctx.clearRect(0,0,el.width,el.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,el.width,el.height);ctx.fillStyle='#666';ctx.font='600 11px monospace';ctx.textAlign='center';ctx.fillText('QR',el.width/2,el.height/2);}}
  },[value,size]);
  return <canvas ref={ref} width={size} height={size} style={{width:size,height:size,display:'block'}}/>;
}
async function downloadQrPng(value,filename){try{const QR=window.QRCode;if(!QR||!QR.toDataURL){toast('QR library not loaded','e');return;}const dataUrl=await QR.toDataURL(String(value),{width:640,margin:2,errorCorrectionLevel:'M'});const a=document.createElement('a');a.href=dataUrl;a.download=filename||'qr-code.png';document.body.appendChild(a);a.click();a.remove();}catch(e){toast(e.message,'e');}}
function SearchableSelect({value,options,onChange,placeholder,locale}){const[q,sQ]=useState('');const labelFor=(o)=>(locale==='ar'&&(o.labelAr||o.titleAr)?(o.labelAr||o.titleAr):(o.label||o.title||o.value));const filtered=options.filter(o=>!q||String(labelFor(o)).toLowerCase().includes(q.toLowerCase())||String(o.value).toLowerCase().includes(q.toLowerCase()));
  return<div><input className="fi" placeholder={placeholder||'Search...'} value={q} onChange={e=>sQ(e.target.value)} style={{marginBottom:8}}/><select className="fi" value={value} onChange={e=>onChange(e.target.value)}>{filtered.map(o=><option key={o.value} value={o.value}>{labelFor(o)}</option>)}</select></div>}
function getTimezoneOptions(){return[
  {group:'Middle East',value:'Asia/Amman',label:'Asia/Amman — Jordan'},
  {group:'Middle East',value:'Asia/Riyadh',label:'Asia/Riyadh — Saudi Arabia'},
  {group:'Middle East',value:'Asia/Dubai',label:'Asia/Dubai — United Arab Emirates'},
  {group:'Middle East',value:'Asia/Kuwait',label:'Asia/Kuwait — Kuwait'},
  {group:'Middle East',value:'Asia/Qatar',label:'Asia/Qatar — Qatar'},
  {group:'Middle East',value:'Asia/Bahrain',label:'Asia/Bahrain — Bahrain'},
  {group:'Middle East',value:'Asia/Baghdad',label:'Asia/Baghdad — Iraq'},
  {group:'Middle East',value:'Asia/Beirut',label:'Asia/Beirut — Lebanon'},
  {group:'Middle East',value:'Asia/Cairo',label:'Asia/Cairo — Egypt'},
  {group:'Global',value:'UTC',label:'UTC'},
  {group:'Global',value:'Europe/London',label:'Europe/London'},
  {group:'Global',value:'America/New_York',label:'America/New_York'}
]}
function getFieldOptions(field){const key=field.key; if(field.options?.length)return field.options; if(key==='app.locale')return[{value:'en',label:'English',labelAr:'الإنجليزية'},{value:'ar',label:'Arabic',labelAr:'العربية'}]; if(key==='app.dir')return[{value:'auto',label:'Auto',labelAr:'تلقائي'},{value:'rtl',label:'RTL',labelAr:'من اليمين إلى اليسار'},{value:'ltr',label:'LTR',labelAr:'من اليسار إلى اليمين'}]; if(key==='app.date_format')return[{value:'YYYY-MM-DD',label:'YYYY-MM-DD'},{value:'DD/MM/YYYY',label:'DD/MM/YYYY'},{value:'MM/DD/YYYY',label:'MM/DD/YYYY'}]; if(key==='app.currency'||key==='freeze.currency')return['USD','SAR','AED','JOD','KWD','QAR'].map(v=>({value:v,label:v})); if(key==='freeze.pricing_mode')return[{value:'per_day',label:'Per Day',labelAr:'لكل يوم'},{value:'fixed',label:'Fixed',labelAr:'ثابت'}]; if(key==='app.timezone')return getTimezoneOptions(); return []}
function mergeSections(serverSchema){const frontendSections=window.GymOS.getSettingsSections(); const merged=new Map(); const dedupeFields=(fields=[])=>{const fieldMap=new Map(); fields.forEach(field=>{if(!field?.key)return; fieldMap.set(field.key,{...fieldMap.get(field.key),...field});}); return [...fieldMap.values()]}; [...(serverSchema.sections||[]),...frontendSections].forEach(section=>{if(!section?.id)return; if(merged.has(section.id)){const prev=merged.get(section.id); merged.set(section.id,{...prev,...section,fields:dedupeFields([...(prev.fields||[]),...(section.fields||[])])})} else merged.set(section.id,{...section,fields:dedupeFields(section.fields||[])})}); let sections=[...merged.values()]; const modulesWithExplicit=new Set(sections.filter(sec=>sec?.module && !String(sec.id||'').startsWith('legacy-')).map(sec=>sec.module)); sections=sections.filter(sec=>!(String(sec.id||'').startsWith('legacy-') && sec.module && modulesWithExplicit.has(sec.module))); return sections.sort((a,b)=>(a.order||99)-(b.order||99))}
function SettingsPage(){const{t,setLocale,applyLayoutSettings,locale}=useI18n();const router=useRouter();const requestedTab=router.param('tab');const requestedModule=router.param('module');const[schema,sSchema]=useState({tabs:[],sections:[],values:{}});const[ed,sEd]=useState({});const[saving,sSaving]=useState(false);const moduleOnly=Boolean(requestedModule&&requestedModule!=='all');const[tab,sTab]=useState(moduleOnly?'modules':(requestedTab||'general'));const[moduleTab,sModuleTab]=useState(requestedModule||'all');
  const load=useCallback(async()=>{const server=(await api.get('/api/settings/schema')).data||{tabs:[],sections:[],values:{}}; const merged={...server,sections:mergeSections(server)}; sSchema(merged)},[]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>{if(moduleOnly){sTab('modules');sModuleTab(requestedModule)}else{if(requestedTab)sTab(requestedTab);if(requestedModule)sModuleTab(requestedModule)}},[requestedTab,requestedModule,moduleOnly]);
  useEffect(()=>{if(!moduleOnly&&tab==='modules')sTab('general')},[moduleOnly,tab]);
  const tabs=schema.tabs?.length?schema.tabs:[{id:'general',label:t('settings.general','General')},{id:'localization',label:t('settings.localization','Localization')},{id:'system',label:t('settings.system','System')},{id:'notifications',label:t('settings.notifications','Notifications')},{id:'member_pwa',label:'Member PWA',labelAr:'تطبيق الأعضاء'},{id:'employee_pwa',label:'Employee PWA',labelAr:'تطبيق الموظفين'},{id:'modules',label:t('settings.modules','Modules')}]; const effectiveTabs=moduleOnly?[{id:'modules',label:'Configuration',labelAr:'إعدادات الوحدة'}]:tabs.filter(tb=>tb.id!=='modules');
  const moduleSections=(schema.sections||[]).filter(sec=>sec.tab==='modules');
  const moduleTabs=[{id:'all',label:t('common.all','All'),labelAr:t('common.all','الكل')}].concat(Array.from(new Map(moduleSections.filter(sec=>sec.module).map(sec=>[sec.module,{id:sec.module,label:sec.module,title:sec.title,titleAr:sec.titleAr}])).values()));
  const sections=(schema.sections||[]).filter(sec=>sec.tab===tab && (tab!=='modules'||(moduleOnly?sec.module===requestedModule:(moduleTab==='all'||sec.module===moduleTab)))); const settingsTitle=moduleOnly?moduleTitleByKey(requestedModule,locale):t('settings.title'); const settingsDesc=moduleOnly?(locale==='ar'?'إعدادات هذه الوحدة فقط':'Settings for this module only'):t('settings.desc');
  const val=(key)=>ed[key]!==undefined?ed[key]:schema.values?.[key]??'';
  const set=(key,v)=>sEd(p=>({...p,[key]:v}));
  const save=async()=>{sSaving(true);try{await api.put('/api/settings',{settings:ed});await load();const nextLocale=ed['app.locale']||schema.values?.['app.locale']||locale;const nextDir=ed['app.dir']||schema.values?.['app.dir']||'auto';await setLocale(nextLocale,{dir:nextDir,currency:ed['app.currency']||schema.values?.['app.currency'],timezone:ed['app.timezone']||schema.values?.['app.timezone'],date_format:ed['app.date_format']||schema.values?.['app.date_format']});applyLayoutSettings({dir:nextDir,currency:ed['app.currency']||schema.values?.['app.currency'],timezone:ed['app.timezone']||schema.values?.['app.timezone'],date_format:ed['app.date_format']||schema.values?.['app.date_format']});toast(t('settings.saved'));sEd({})}catch(e){toast(e.message,'e')}sSaving(false)};
  const renderField=(field)=>{const options=getFieldOptions(field);const label=locale==='ar'&&(field.labelAr||field.titleAr)?(field.labelAr||field.titleAr):(field.label||field.title||field.key); const optionLabel=(o)=>locale==='ar'&&(o.labelAr||o.titleAr)?(o.labelAr||o.titleAr):(o.label||o.title||o.value); if(field.type==='toggle')return<label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type='checkbox' checked={val(field.key)===true||val(field.key)==='true'||val(field.key)===1||val(field.key)==='1'} onChange={e=>set(field.key,e.target.checked)}/><span>{label}</span></label>; if(field.type==='searchable-select')return<><label>{label}</label><SearchableSelect value={val(field.key)} options={options} onChange={v=>set(field.key,v)} placeholder={t('btn.search','Search')} locale={locale}/></>; if(field.type==='select')return<><label>{label}</label><select className='fi' value={val(field.key)} onChange={e=>set(field.key,e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{optionLabel(o)}</option>)}</select></>; if(field.type==='color')return<><label>{label}</label><div style={{display:'flex',gap:10,alignItems:'center'}}><input className='fi' style={{width:64,padding:4,height:40}} type='color' value={val(field.key)||'#6366f1'} onChange={e=>set(field.key,e.target.value)}/><input className='fi' type='text' value={val(field.key)||''} onChange={e=>set(field.key,e.target.value)} /></div></>; if(field.type==='image-upload')return<><label>{label}</label><div style={{display:'flex',flexDirection:'column',gap:10}}>{val(field.key)?<img src={val(field.key)} alt={label} style={{width:96,height:96,objectFit:'contain',borderRadius:12,border:'1px solid var(--line)',background:'var(--panel-2)',padding:8}}/>:null}<input className='fi' type='text' value={val(field.key)||''} placeholder='/uploads/pwa/...' onChange={e=>set(field.key,e.target.value)}/><input type='file' accept='image/*' onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const fd=new FormData();fd.append('file',file);const headers={};if(api.token)headers['Authorization']='Bearer '+api.token;const resp=await fetch(`/api/pwa/assets/${field.uploadScope||'member'}/${field.assetType||'logo'}`,{method:'POST',headers,body:fd});const data=await resp.json();if(!resp.ok)throw new Error(data.error||'Upload failed');set(field.key,data.data?.url||'');toast(locale==='ar'?'تم رفع الصورة':'Image uploaded')}catch(err){toast(err.message,'e')}}}/></div></>; if(field.type==='qr-link'){const url=(typeof window!=='undefined'?window.location.origin:'')+(field.urlPath||'/qr-register');const fname=(field.downloadName||'registration-qr')+'.png';return<><label>{label}</label><div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap',padding:'6px 0'}}><div style={{background:'#fff',padding:12,borderRadius:12,border:'1px solid var(--line)'}}><QrView value={url} size={168}/></div><div style={{display:'grid',gap:8,minWidth:240,flex:1}}><div style={{fontSize:13,color:'var(--t3)'}}>{locale==='ar'?'يفتح هذا الرمز صفحة التسجيل العامة. اطبعه أو اعرضه في النادي ليمسحه الزوار ويسجّلوا.':'This code opens the public registration page. Print it or display it at the gym for visitors to scan and register.'}</div><input className='fi' type='text' readOnly value={url} onFocus={e=>e.target.select()} style={{fontSize:12}}/><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type='button' className='btn btn-p btn-sm' onClick={()=>downloadQrPng(url,fname)}>{locale==='ar'?'تنزيل الرمز (PNG)':'Download QR (PNG)'}</button><a className='btn btn-s btn-sm' href={url} target='_blank' rel='noopener'>{locale==='ar'?'فتح الصفحة':'Open page'}</a></div></div></div></>;} return<><label>{label}</label><input className='fi' type={field.type==='number'?'number':'text'} value={val(field.key)} onChange={e=>set(field.key,field.type==='number'?Number(e.target.value):e.target.value)}/></>};
  return<div><div className='ph'><h1>{settingsTitle}</h1><p>{settingsDesc}</p></div><div className='pb'>
    <div className='tabs'>{effectiveTabs.map(tb=><div key={tb.id} className={'tab'+(tab===tb.id?' ac':'')} onClick={()=>{if(moduleOnly)return; sTab(tb.id); if(tb.id!=='modules') sModuleTab('all')}}>{locale==='ar'&&tb.labelAr?tb.labelAr:tb.label}</div>)}</div>
    {tab==='modules'&&!moduleOnly&&moduleTabs.length>1&&<div className='tabs' style={{marginTop:-8,marginBottom:16}}>{moduleTabs.map(tb=><div key={tb.id} className={'tab'+(moduleTab===tb.id?' ac':'')} onClick={()=>sModuleTab(tb.id)}>{locale==='ar'&&(tb.titleAr||tb.labelAr)?(tb.titleAr||tb.labelAr):(tb.title||tb.label)}</div>)}</div>}
    {sections.map(section=><div key={section.id} className='card'><div className='ct'>{locale==='ar'&&section.titleAr?section.titleAr:section.title}</div>{section.description&&<p style={{color:'var(--t3)',fontSize:13,marginBottom:14}}>{locale==='ar'&&section.descriptionAr?section.descriptionAr:section.description}</p>}
      {section.fields?.map(field=><div key={field.key} className='fg'>{renderField(field)}</div>)}
    </div>)}
    {!sections.length&&<div className='card'><div className='empty'><h3>{t('common.noData')}</h3></div></div>}
    <button className='btn btn-p' onClick={save} disabled={saving||!Object.keys(ed).length}>{saving?t('common.loading'):t('btn.save')}</button>
  </div></div>}

// ═══ ROLES ═══
function RolesPage(){const{t,locale}=useI18n();const isAr=locale==='ar';const[roles,sR]=useState([]);const[perms,sP]=useState([]);const[sel,sSel]=useState(null);const[rp,sRP]=useState([]);
  useEffect(()=>{api.get('/api/roles').then(r=>sR(r.data)).catch(()=>{});api.get('/api/permissions').then(r=>sP(r.data)).catch(()=>{})},[]);
  const loadRP=id=>{sSel(id);api.get('/api/roles/'+id+'/permissions').then(r=>sRP(r.data.map(p=>p.id))).catch(()=>{})};
  const permGrouped=(perms||[]).reduce((acc,p)=>{const k=p.module||'general';(acc[k]=acc[k]||[]).push(p);return acc},{});
  return<div className='o-module-page'><div className='o-module-titlebar'><div><h1>{isAr?'الأدوار والصلاحيات':'Roles & Permissions'}</h1><p>{isAr?'اختر دور لعرض وتعديل صلاحياته':'Select a role to view and manage its permissions'}</p></div></div>
    <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:16,padding:'0 0 20px'}}>
      <div className="card" style={{position:'sticky',top:56,alignSelf:'start'}}><div className="ct">{isAr?'الأدوار':'Roles'}</div><div style={{display:'grid',gap:4}}>{roles.map(r=><button key={r.id} className={'btn '+(sel===r.id?'btn-p':'btn-s')} style={{width:'100%',justifyContent:'flex-start'}} onClick={()=>loadRP(r.id)}><Ic name="shield" size={14}/>{roleName(r,isAr)}</button>)}</div></div>
      <div className="card"><div className="ct">{isAr?'الصلاحيات':'Permissions'} {sel&&<button className="btn btn-p btn-sm" onClick={async()=>{await api.put('/api/roles/'+sel+'/permissions',{permission_ids:rp});toast(t('btn.save'))}}>{t('btn.save')}</button>}</div>
        {sel?<div className='gymos-role-groups'>{Object.entries(permGrouped).map(([mod,items])=><div key={mod} className='gymos-role-group'>
          <div className='gymos-role-group-head'>{permModuleLabel(mod,isAr)} <span style={{fontSize:11,color:'var(--tx-4)',fontWeight:400}}>({items.length})</span></div>
          <div className='gymos-role-group-items'>{items.map(p=><label key={p.id} className={'gymos-role-perm-label'+(rp.includes(p.id)?' checked':'')}>
            <input type="checkbox" checked={rp.includes(p.id)} onChange={()=>sRP(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}/><span>{permLabel(p,isAr)}</span>
          </label>)}</div>
        </div>)}</div>
        :<div className='empty' style={{padding:'40px 0'}}><h3>{isAr?'اختر دور من القائمة':'Select a role from the list'}</h3></div>}</div>
    </div></div>}

// ═══ ADMINISTRATION ═══
function UsersPage(){const{locale,t}=useI18n();const isAr=locale==='ar';const[users,sUsers]=useState([]);const[roles,sRoles]=useState([]);const[search,sSearch]=useState('');const[loading,sLoading]=useState(true);const[saving,sSaving]=useState(false);const[openNew,sOpenNew]=useState(false);const[form,sForm]=useState({username:'',email:'',password:'',full_name:'',role_id:'',branch_id:''});
  const load=useCallback(async()=>{sLoading(true);try{const [ur,rr]=await Promise.all([api.get('/api/users?limit=100&search='+encodeURIComponent(search||'')),api.get('/api/roles')]);sUsers(ur.data||[]);sRoles(rr.data||[])}catch(_){sUsers([]);sRoles([])}sLoading(false)},[search]);
  useEffect(()=>{load()},[load]);
  const set=(k,v)=>sForm(prev=>({...prev,[k]:v}));
  const createUser=async()=>{if(!form.username||!form.email||!form.password){toast(isAr?'يرجى تعبئة الحقول المطلوبة':'Please fill the required fields','e');return;} sSaving(true); try{await api.post('/api/users',{...form,role_id:form.role_id?Number(form.role_id):null,branch_id:form.branch_id||null}); toast(isAr?'تم إنشاء المستخدم':'User created'); sOpenNew(false); sForm({username:'',email:'',password:'',full_name:'',role_id:'',branch_id:''}); load();}catch(e){toast(e.message,'e')} sSaving(false)};
  const updateUser=async(user)=>{try{await api.put('/api/users/'+user.id,{full_name:user.full_name||'',email:user.email||'',role_id:user.role_id||roles.find(r=>r.name===user.role||r.display_name===user.role_display)?.id||null,branch_id:user.branch_id||null,is_active:user.is_active?1:0}); toast(isAr?'تم تحديث المستخدم':'User updated'); load()}catch(e){toast(e.message,'e')}};
  return <div className='o-module-page'><div className='o-module-titlebar'><div><h1>{isAr?'إدارة المستخدمين':'Users'}</h1><p>{isAr?'إضافة المستخدمين وتعديل أدوارهم وصلاحية التفعيل':'Create users and manage their roles and activation state'}</p></div></div><div className='o-control-panel-shell'><div className='o-control-panel-main'><div className='o-control-panel-left'><input className='fi o-search-input compact' value={search} onChange={e=>sSearch(e.target.value)} placeholder={isAr?'بحث عن مستخدم...':'Search users...'}/></div><div className='o-control-panel-right'><button type='button' className='btn btn-p' onClick={()=>sOpenNew(v=>!v)}><Ic name='plus' size={14}/>{openNew?(isAr?'إغلاق':'Close'):(isAr?'مستخدم جديد':'New User')}</button></div></div></div>{openNew&&<div className='o-form-shell'><div className='o-form-sheet'><div className='o-form-section-title'>{isAr?'إنشاء مستخدم جديد':'Create New User'}</div><div className='o-sheet-inner'><div className='fg'><label>{isAr?'اسم المستخدم':'Username'}</label><input className='fi' value={form.username} onChange={e=>set('username',e.target.value)}/></div><div className='fg'><label>{isAr?'الاسم الكامل':'Full Name'}</label><input className='fi' value={form.full_name} onChange={e=>set('full_name',e.target.value)}/></div><div className='fg'><label>{isAr?'البريد الإلكتروني':'Email'}</label><input className='fi' value={form.email} onChange={e=>set('email',e.target.value)}/></div><div className='fg'><label>{isAr?'كلمة المرور':'Password'}</label><input className='fi' type='password' value={form.password} onChange={e=>set('password',e.target.value)}/></div><div className='fg'><label>{isAr?'الدور':'Role'}</label><select className='fi' value={form.role_id} onChange={e=>set('role_id',e.target.value)}><option value=''>{isAr?'اختر الدور':'Select role'}</option>{roles.map(r=><option key={r.id} value={r.id}>{roleName(r,isAr)}</option>)}</select></div><div className='o-form-actions'><button type='button' className='btn btn-p' disabled={saving} onClick={createUser}>{saving?(isAr?'جارٍ الحفظ...':'Saving...'):(isAr?'حفظ':'Save')}</button><button type='button' className='btn btn-s' onClick={()=>sOpenNew(false)}>{isAr?'إلغاء':'Cancel'}</button></div></div></div></div>}<div className='o-list-card'>{loading?<div className='pld'><span className='spinner'/></div>:<table className='o-list-table'><thead><tr><th>{isAr?'اسم المستخدم':'Username'}</th><th>{isAr?'الاسم':'Name'}</th><th>{isAr?'البريد':'Email'}</th><th>{isAr?'الدور':'Role'}</th><th>{isAr?'الحالة':'Status'}</th><th>{isAr?'الإجراء':'Action'}</th></tr></thead><tbody>{users.length?users.map(u=>{const resolvedRoleId=u.role_id||roles.find(r=>r.name===u.role||r.display_name===u.role_display)?.id||''; return <tr key={u.id}><td>{u.username}</td><td><input className='fi inline-edit' value={u.full_name||''} onChange={e=>sUsers(prev=>prev.map(x=>x.id===u.id?{...x,full_name:e.target.value}:x))}/></td><td><input className='fi inline-edit' value={u.email||''} onChange={e=>sUsers(prev=>prev.map(x=>x.id===u.id?{...x,email:e.target.value}:x))}/></td><td><select className='fi inline-edit' value={resolvedRoleId} onChange={e=>sUsers(prev=>prev.map(x=>x.id===u.id?{...x,role_id:e.target.value,role_display:roles.find(r=>String(r.id)===String(e.target.value))?.display_name||x.role_display}:x))}>{roles.map(r=><option key={r.id} value={r.id}>{roleName(r,isAr)}</option>)}</select></td><td><label className='o-switch-row'><input type='checkbox' checked={Boolean(u.is_active)} onChange={e=>sUsers(prev=>prev.map(x=>x.id===u.id?{...x,is_active:e.target.checked?1:0}:x))}/><span className={'badge '+(u.is_active?'b-active':'b-inactive')}>{u.is_active?(isAr?'نشط':'Active'):(isAr?'معطل':'Inactive')}</span></label></td><td><button type='button' className='btn btn-s btn-sm' onClick={()=>updateUser(u)}>{isAr?'حفظ':'Save'}</button></td></tr>}) : <tr><td colSpan='6'><div className='empty'><h3>{t('common.noData')}</h3></div></td></tr>}</tbody></table>}</div></div>}

function PermissionsPage(){const{locale,t}=useI18n();const isAr=locale==='ar';const[perms,sPerms]=useState([]);const[loading,sLoading]=useState(true); useEffect(()=>{sLoading(true);api.get('/api/permissions').then(r=>sPerms(r.data||[])).catch(()=>sPerms([])).finally(()=>sLoading(false))},[]); const grouped=(perms||[]).reduce((acc,p)=>{const key=p.module||'general';(acc[key]=acc[key]||[]).push(p);return acc},{});
  return <div className='o-module-page'><div className='o-module-titlebar'><div><h1>{isAr?'الصلاحيات':'Permissions'}</h1><p>{isAr?'عرض كل صلاحيات النظام حسب كل موديول':'View all system permissions grouped by module'}</p></div></div>
  <div className='gymos-perm-grid'>{loading?<div className='pld'><span className='spinner'/></div>:Object.keys(grouped).length?Object.entries(grouped).map(([module,items])=><div className='gymos-perm-card' key={module}>
    <div className='gymos-perm-card-head'><span className='gymos-perm-card-title'>{moduleTitleByKey(module,locale)}</span><span className='gymos-perm-card-count'>{items.length}</span></div>
    <div className='gymos-perm-card-body'>{items.map(p=><div className='gymos-perm-item' key={p.id}>
      <div className='gymos-perm-item-info'><span className='gymos-perm-item-name'>{p.display_name||p.key}</span><code className='gymos-perm-item-key'>{p.key}</code></div>
      <span className='badge b-info' style={{flexShrink:0,fontSize:10}}>{p.module||'core'}</span>
    </div>)}</div>
  </div>):<div className='card'><div className='empty'><h3>{t('common.noData')}</h3></div></div>}</div></div>}

// ═══ GENERIC MODULE PAGE (auto-renders for unknown module paths) ═══
function GenericModulePage({path:pagePath}){const{t}=useI18n();const[items,sI]=useState([]);const[loading,sL]=useState(true);
  const endpoint=pagePath.replace(/^\//,'');
  useEffect(()=>{sL(true);api.get('/api/'+endpoint).then(r=>sI(r.data||[])).catch(()=>sI([])).finally(()=>sL(false))},[endpoint]);
  const title=endpoint.split('-').map(w=>w[0]?.toUpperCase()+w.slice(1)).join(' ');
  if(loading)return<div className="pld"><span className="spinner"/></div>;
  return<div><div className="ph"><h1>{title}</h1></div><div className="pb">
    {items.length>0?<div className="card"><table><thead><tr>{Object.keys(items[0]).filter(k=>!['id','created_at','updated_at'].includes(k)).slice(0,6).map(k=><th key={k}>{k}</th>)}</tr></thead>
      <tbody>{items.map((item,i)=><tr key={item.id||i}>{Object.entries(item).filter(([k])=>!['id','created_at','updated_at'].includes(k)).slice(0,6).map(([k,v],j)=><td key={j} style={{fontSize:12}}>{typeof v==='boolean'?(v?t('common.yes','Yes'):t('common.no','No')):String(v||'—')}</td>)}</tr>)}</tbody></table></div>
    :<div className="empty"><h3>{t('common.noData')}</h3></div>}
  </div></div>}

// ═══════════════════════════════════════════════════
// DYNAMIC PAGE REGISTRATION
// ═══════════════════════════════════════════════════
window.GymOS.registerPage({path:'/',component:DashboardPage,label:'Dashboard',labelAr:'لوحة التحكم',order:1});
window.GymOS.registerPage({path:'/members',component:MembersPage,label:'Members',labelAr:'الأعضاء',order:10});
window.GymOS.registerPage({path:'/memberships',component:MembershipsPage,label:'Memberships',labelAr:'الاشتراكات',order:20});
window.GymOS.registerPage({path:'/plans',component:PlansPage,label:'Plans',labelAr:'الباقات',order:21});
window.GymOS.registerPage({path:'/attendance',component:AttendancePage,label:'Check-In',labelAr:'الحضور',order:15});
window.GymOS.registerPage({path:'/schedule',component:SchedulePage,label:'Schedule',labelAr:'الجدول',order:25});
window.GymOS.registerPage({path:'/trainers',component:TrainersPage,label:'Trainers',labelAr:'المدربين',order:40});
window.GymOS.registerPage({path:'/branches',component:BranchesPage,label:'Branches',labelAr:'الفروع',order:90});
window.GymOS.registerPage({path:'/engagement',component:EngagementPage,label:'Engagement',labelAr:'التواصل',order:50});
window.GymOS.registerPage({path:'/settings',component:SettingsPage,label:'Settings',labelAr:'الإعدادات',order:900});
window.GymOS.registerPage({path:'/modules',component:ModulesPage,label:'Modules',labelAr:'الوحدات',order:901});
window.GymOS.registerPage({path:'/health',component:SystemHealthPage,label:'Health',labelAr:'صحة النظام',order:902});
window.GymOS.registerPage({path:'/roles',component:RolesPage,label:'Roles',labelAr:'الأدوار',order:903});
window.GymOS.registerPage({path:'/users',component:UsersPage,label:'Users',labelAr:'المستخدمون',order:904});
window.GymOS.registerPage({path:'/permissions',component:PermissionsPage,label:'Permissions',labelAr:'الصلاحيات',order:905});
window.GymOS.registerPage({path:'/admin/users',component:UsersPage,label:'Users',labelAr:'المستخدمون',order:906,module:'administration'});
window.GymOS.registerPage({path:'/admin/roles',component:RolesPage,label:'Roles',labelAr:'الأدوار',order:907,module:'administration'});
window.GymOS.registerPage({path:'/admin/permissions',component:PermissionsPage,label:'Permissions',labelAr:'الصلاحيات',order:908,module:'administration'});

function dedupeMenuItems(items=[]){const map=new Map();items.forEach(item=>{if(item?.path)map.set(item.path,{...map.get(item.path),...item})});return [...map.values()].sort((a,b)=>(a.order||99)-(b.order||99))}
function titleizeSlug(v=''){return String(v||'').split(/[-_]/).filter(Boolean).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ')}
function buildGroupedModuleNav(items=[],locale='en'){
  const groups=new Map();
  items.forEach(item=>{
    const key=item.module||(item.path||'').split('/').filter(Boolean)[0]||'other';
    if(!groups.has(key))groups.set(key,{key,items:[]});
    groups.get(key).items.push(item);
  });
  return [...groups.values()].sort((a,b)=>((a.items[0]?.order||99)-(b.items[0]?.order||99))).map(group=>{
    const children=[...group.items].sort((a,b)=>(a.order||99)-(b.order||99));
    if(children.length===1){
      const item=children[0];
      return {type:'item',key:item.path,l:locale==='ar'&&item.labelAr?item.labelAr:item.label,i:item.icon||'package',p:item.path,standalone:!!item.standalone,target:item.target,newWindow:item.newWindow};
    }
    const rootPath='/' + group.key;
    const rootItem=children.find(x=>x.path===rootPath)||children[0];
    return {
      type:'group',
      key:group.key,
      l:locale==='ar'&&rootItem.labelAr?rootItem.labelAr:(rootItem.label||titleizeSlug(group.key)),
      i:rootItem.icon||'package',
      children:children.map(item=>({key:item.path,l:locale==='ar'&&item.labelAr?item.labelAr:item.label,i:item.icon||'package',p:item.path,standalone:!!item.standalone,target:item.target,newWindow:item.newWindow}))
    };
  });
}
// ═══ APP SHELL (registry-driven routing) ═══

const PAGE_LABELS={
  '/':'لوحة التحكم',
  '/members':'الأعضاء',
  '/memberships':'الاشتراكات',
  '/plans':'الباقات',
  '/attendance':'الحضور',
  '/schedule':'الجدول',
  '/trainers':'المدربون',
  '/branches':'الفروع',
  '/engagement':'التواصل',
  '/access-control':'التحكم بالدخول',
  '/employees-access':'دخول الموظفين',
  '/devices':'الأجهزة',
  '/access-logs':'سجل الوصول',
  '/settings':'الإعدادات',
  '/modules':'الوحدات',
  '/health':'صحة النظام',
  '/roles':'الصلاحيات',
  '/users':'المستخدمون',
  '/permissions':'الصلاحيات',
  '/admin/users':'المستخدمون',
  '/admin/roles':'الأدوار',
  '/admin/permissions':'الصلاحيات',
  '/qr-registrations':'تسجيلات QR',
  '/marketing':'التسويق',
  '/purchase':'المشتريات',
  '/hr':'الموارد البشرية',
  '/cafeteria':'الكافتيريا',
  '/freeze':'التجميد',
};
function arLabelFor(item){return item?.labelAr||item?.label_ar||PAGE_LABELS[item?.path]||item?.label||'—'}
function displayLabel(item,locale='en'){return locale==='ar'?arLabelFor(item):(item?.label||arLabelFor(item))}

const DEFAULT_MODULE_ORDER=['dashboard','members','operations','branches','engagement','access','qr','accounting','purchase','hr','cafeteria','training','marketing','freeze','administration','system'];
const MODULE_ORDER_KEY='gymos.module.order.v1';
const DEV_MODE_KEY='gymos.dev.mode.v1';
function readModuleOrder(){try{const raw=localStorage.getItem(MODULE_ORDER_KEY);const arr=raw?JSON.parse(raw):[];return Array.isArray(arr)?arr:[]}catch(_){return []}}
function writeModuleOrder(order){try{localStorage.setItem(MODULE_ORDER_KEY,JSON.stringify(order))}catch(_){}}
function getModuleOrder(keys=[]){const preferred=readModuleOrder();const unique=[];[...preferred,...DEFAULT_MODULE_ORDER,...keys].forEach(k=>{if(k&&!unique.includes(k))unique.push(k)});return unique}
function sortModulesByPreference(items=[]){const keys=items.map(i=>i?.key).filter(Boolean);const order=getModuleOrder(keys);const pos=new Map(order.map((k,i)=>[k,i]));return [...items].sort((a,b)=>(pos.get(a.key)??999)-(pos.get(b.key)??999))}
function moveModulePreference(key,direction=1,keys=[]){const order=getModuleOrder(keys);const i=order.indexOf(key);if(i<0)return order;const j=Math.max(0,Math.min(order.length-1,i+direction)); if(i===j)return order; const next=[...order]; const [item]=next.splice(i,1); next.splice(j,0,item); writeModuleOrder(next); return next}
function reorderModulePreference(fromKey,toKey,keys=[]){const order=getModuleOrder(keys);const from=order.indexOf(fromKey);const to=order.indexOf(toKey);if(from<0||to<0||from===to)return order;const next=[...order];const [item]=next.splice(from,1);next.splice(to,0,item);writeModuleOrder(next);return next}
function resetModulePreference(keys=[]){const next=getModuleOrder(keys);writeModuleOrder(next.filter(k=>keys.includes(k)||DEFAULT_MODULE_ORDER.includes(k)));return next}
function isAdminUser(user){if(!user)return false;const role=String(user.role||user.user_type||'').toLowerCase();const name=String(user.full_name||user.username||'').toLowerCase();return Boolean(user.is_admin||user.isAdmin||role.includes('admin')||role.includes('manager')||name.includes('admin'))}
function useDeveloperMode(user){const canUse=isAdminUser(user);const[devMode,setDevMode]=useState(()=>{try{return canUse&&localStorage.getItem(DEV_MODE_KEY)==='1'}catch(_){return false}}); useEffect(()=>{if(!canUse&&devMode)setDevMode(false)},[canUse,devMode]); const toggle=()=>{if(!canUse)return;setDevMode(prev=>{const next=!prev; try{localStorage.setItem(DEV_MODE_KEY,next?'1':'0')}catch(_){} return next})}; return [canUse&&devMode,toggle,canUse]}
function moduleTitleByKey(key,locale='en'){const p=MODULE_PRESETS[key]||{}; return locale==='ar'?(p.labelAr||p.label||key):(p.label||p.labelAr||key)}

const MODULE_PRESETS={
  dashboard:{icon:'layout-dashboard',label:'Dashboard',labelAr:'لوحة التحكم',paths:['/']},
  members:{icon:'users',label:'Members',labelAr:'الأعضاء',paths:['/members','/memberships','/plans']},
  operations:{icon:'calendar',label:'Operations',labelAr:'العمليات',paths:['/attendance','/schedule','/trainers']},
  branches:{icon:'building',label:'Branches',labelAr:'الفروع',paths:['/branches']},
  engagement:{icon:'megaphone',label:'Engagement',labelAr:'التواصل',paths:['/engagement']},
  access:{icon:'shield',label:'Access Control',labelAr:'التحكم بالدخول',paths:['/access-control','/employees-access','/devices','/access-logs']},
  qr:{icon:'scan-line',label:'QR Registrations',labelAr:'تسجيلات QR',paths:['/qr-registrations']},
  accounting:{icon:'badge-dollar-sign',label:'Accounting',labelAr:'المحاسبة',paths:['/accounting','/invoicing']},
  purchase:{icon:'package',label:'Purchase',labelAr:'المشتريات',paths:['/purchase']},
  hr:{icon:'users',label:'HR',labelAr:'الموارد البشرية',paths:['/hr']},
  cafeteria:{icon:'utensils-crossed',label:'Cafeteria',labelAr:'الكافتيريا',paths:['/cafeteria']},
  training:{icon:'dumbbell',label:'Training',labelAr:'التدريب',paths:['/training']},
  marketing:{icon:'megaphone',label:'Marketing',labelAr:'التسويق',paths:['/marketing']},
  freeze:{icon:'snowflake',label:'Freeze Mgmt',labelAr:'إدارة التجميد',paths:['/freeze']},
  administration:{icon:'shield',label:'Administration',labelAr:'الإدارة',paths:['/admin/users','/admin/roles','/admin/permissions','/users','/roles','/permissions']},
  system:{icon:'settings',label:'System',labelAr:'النظام',paths:['/settings','/modules','/health']},
};
// Arabic labels for the permission-group headers (keyed by the permission's `module` field).
const PERM_MODULE_AR={accounting:'المحاسبة',attendance:'الحضور',branches:'الفروع',cafeteria:'الكافتيريا',core:'النظام',engagement:'التواصل',hr:'الموارد البشرية',marketing:'التسويق',members:'الأعضاء','membership-freeze':'إدارة التجميد',memberships:'الاشتراكات',scheduling:'الجدولة','sdk-example':'مثال SDK',trainers:'المدربون','ui-studio':'استوديو الواجهة',training:'التدريب',general:'عام'};
function permModuleLabel(mod,isAr){ return isAr ? (PERM_MODULE_AR[mod]||moduleTitleByKey(mod,'ar')) : moduleTitleByKey(mod,'en'); }
// Arabic labels for every permission (keyed by permission key). English deployments use the DB display_name.
const PERM_AR={
  'accounting.manage_accounts':'إدارة الحسابات','accounting.manage_bills':'إدارة فواتير الموردين','accounting.manage_entries':'إدارة القيود المحاسبية','accounting.manage_invoices':'إدارة الفواتير والسندات','accounting.manage_journals':'إدارة اليوميات','accounting.manage_payments':'إدارة المدفوعات','accounting.manage_settings':'إدارة إعدادات المحاسبة','accounting.view':'عرض المحاسبة','accounting.view_reports':'عرض تقارير المحاسبة',
  'attendance.checkin':'تسجيل حضور الأعضاء','attendance.manage':'إدارة الحضور','attendance.view':'عرض الحضور',
  'branches.create':'إنشاء الفروع','branches.delete':'حذف الفروع','branches.edit':'تعديل الفروع','branches.view':'عرض الفروع',
  'cafeteria.manage_categories':'إدارة أصناف الكافتيريا','cafeteria.manage_inventory':'إدارة مخزون الكافتيريا','cafeteria.manage_products':'إدارة منتجات الكافتيريا','cafeteria.manage_warehouses':'إدارة مستودعات الكافتيريا','cafeteria.pos.close_session':'إغلاق جلسة نقطة البيع','cafeteria.pos.discount':'خصم على طلب الكافتيريا','cafeteria.pos.open_session':'فتح جلسة نقطة البيع','cafeteria.pos.refund':'استرجاع طلب الكافتيريا','cafeteria.pos.sell':'البيع عبر نقطة البيع','cafeteria.pos.void':'إلغاء طلب الكافتيريا','cafeteria.reports.view':'عرض تقارير الكافتيريا','cafeteria.settings.manage':'إدارة إعدادات الكافتيريا','cafeteria.view':'عرض الكافتيريا',
  'activity.view':'عرض سجل النشاط','modules.install':'تثبيت الوحدات','modules.manage':'إدارة الوحدات','modules.upload':'رفع الوحدات','roles.manage':'إدارة الأدوار','settings.manage':'إدارة الإعدادات','system.health':'عرض حالة النظام','system.manage':'إدارة النظام','users.create':'إنشاء المستخدمين','users.delete':'حذف المستخدمين','users.edit':'تعديل المستخدمين','users.view':'عرض المستخدمين',
  'announcements.manage':'إدارة الإعلانات','engagement.manage':'إدارة التواصل','engagement.view':'عرض التواصل',
  'hr.attendance.manage':'إدارة حضور الموظفين','hr.contract.manage':'إدارة العقود','hr.dashboard':'لوحة الموارد البشرية','hr.department.manage':'إدارة الأقسام والمناصب','hr.employee.create':'إنشاء الموظفين','hr.employee.delete':'حذف الموظفين','hr.employee.edit':'تعديل الموظفين','hr.employee.view':'عرض الموظفين','hr.leave.manage':'إدارة الإجازات','hr.payroll.view':'عرض الرواتب','hr.recruitment.manage':'إدارة التوظيف','hr.settings.manage':'إدارة إعدادات الموارد البشرية',
  'marketing.automations.manage':'إدارة أتمتة التسويق','marketing.campaigns.manage':'إدارة الحملات التسويقية','marketing.contacts.manage':'إدارة جهات اتصال التسويق','marketing.logs.view':'عرض سجل التسويق','marketing.send':'إرسال رسائل التسويق','marketing.settings.manage':'إدارة إعدادات التسويق','marketing.templates.manage':'إدارة قوالب التسويق','marketing.view':'عرض التسويق',
  'members.create':'إنشاء الأعضاء','members.delete':'حذف الأعضاء','members.edit':'تعديل الأعضاء','members.export':'تصدير الأعضاء','members.view':'عرض الأعضاء',
  'freeze.create':'إنشاء التجميد','freeze.manage':'إدارة التجميد','freeze.settings':'إعدادات التجميد','freeze.view':'عرض التجميد',
  'memberships.create':'إنشاء الاشتراكات','memberships.delete':'حذف الاشتراكات','memberships.edit':'تعديل الاشتراكات','memberships.view':'عرض الاشتراكات','plans.manage':'إدارة الباقات',
  'bookings.manage':'إدارة الحجوزات','bookings.view':'عرض الحجوزات','schedule.manage':'إدارة الجدول','schedule.view':'عرض الجدول',
  'sdk_example.create':'إنشاء (مثال SDK)','sdk_example.delete':'حذف (مثال SDK)','sdk_example.edit':'تعديل (مثال SDK)','sdk_example.view':'عرض (مثال SDK)',
  'trainers.create':'إنشاء المدربين','trainers.delete':'حذف المدربين','trainers.edit':'تعديل المدربين','trainers.view':'عرض المدربين',
  'ui_studio.manage':'إدارة استوديو الواجهة','ui_studio.publish':'نشر استوديو الواجهة','ui_studio.view':'عرض استوديو الواجهة'
};
function permLabel(p,isAr){ return isAr ? (PERM_AR[p.key]||p.display_name||p.key) : (p.display_name||p.key); }
// Arabic labels for built-in role names.
const ROLE_AR={admin:'مدير النظام',administrator:'مدير النظام',manager:'مدير',staff:'موظف',trainer:'مدرب',any:'أي',member:'عضو',owner:'المالك',accountant:'محاسب',receptionist:'موظف استقبال'};
function roleName(r,isAr){ const disp=(r&&(r.display_name||r.name))||''; if(!isAr) return disp; const nk=String((r&&r.name)||'').toLowerCase(); const dk=String((r&&r.display_name)||'').toLowerCase(); return ROLE_AR[nk]||ROLE_AR[dk]||disp; }
function moduleKeyForPath(path='/', menu=[]){
  const clean=(path||'/').split('?')[0];
  if(clean==='/'||clean==='/apps') return 'dashboard';
  for(const [key,meta] of Object.entries(MODULE_PRESETS)){
    if((meta.paths||[]).some(p=>clean===p || clean.startsWith(p+'/'))) return key;
  }
  const found=(menu||[]).find(item=>(item.path||'')===clean);
  return found?.module || clean.split('/').filter(Boolean)[0] || 'dashboard';
}
function buildModuleRegistry(menu=[], locale='en'){
  const registry=new Map();
  const push=(key,item)=>{
    if(!registry.has(key)){
      const preset=MODULE_PRESETS[key]||{};
      registry.set(key,{key,icon:preset.icon||item.icon||'package',label:locale==='ar'&&preset.labelAr?preset.labelAr:(preset.label||item.label||titleizeSlug(key)),labelAr:preset.labelAr||PAGE_LABELS[item.path]||item.labelAr||item.label_ar||item.label,pages:[]});
    }
    registry.get(key).pages.push(item);
  };
  push('dashboard',{path:'/',label:locale==='ar'?'لوحة التحكم':'Dashboard',icon:'layout-dashboard',order:1});
  menu.forEach(item=>push(moduleKeyForPath(item.path,menu),item));
  const modules=[...registry.values()].map(mod=>({
    ...mod,
    pages:dedupeMenuItems(mod.pages).sort((a,b)=>(a.order||99)-(b.order||99))
  }));
  return sortModulesByPreference(modules);
}
function buildBreadcrumbs(cp,currentModule,locale='en'){
  const items=[];
  if(currentModule && currentModule.key!=='dashboard') items.push({label:locale==='ar'?'التطبيقات':'Apps',path:'/apps'});
  if(currentModule) items.push({label:currentModule.label,path:currentModule.pages?.[0]?.path||'/'});
  const clean=(cp||'/').split('?')[0];
  const current=currentModule?.pages?.find(p=>p.path===clean);
  if(current && clean!==currentModule?.pages?.[0]?.path) items.push({label:displayLabel(current,locale),path:clean});
  if(!items.length) items.push({label:locale==='ar'?'لوحة التحكم':'Dashboard',path:'/'});
  return items;
}


function AppsGrid({modules,currentKey,onOpen,locale}){
  const {user}=useContext(AC);
  const [devMode,toggleDevMode,canUseDevMode]=useDeveloperMode(user);
  const [refreshKey,setRefreshKey]=useState(0);
  const [dragKey,setDragKey]=useState(null);
  const visibleModules=sortModulesByPreference(modules.filter(m=>m.key!=='system'));
  const moduleKeys=visibleModules.map(m=>m.key);
  const move=(key,dir)=>{moveModulePreference(key,dir,moduleKeys);setRefreshKey(v=>v+1)};
  const reorder=(fromKey,toKey)=>{if(!fromKey||!toKey||fromKey===toKey)return;reorderModulePreference(fromKey,toKey,moduleKeys);setRefreshKey(v=>v+1)};
  const resetOrder=()=>{try{localStorage.removeItem(MODULE_ORDER_KEY)}catch(_){} setRefreshKey(v=>v+1)};
  return <div className='o-apps-page' key={refreshKey}>
    <div className='o-apps-page-inner'>
      <div className='o-apps-page-head'>
        <div>
          <h1>{locale==='ar'?'كل التطبيقات':'All Applications'}</h1>
          <p>{locale==='ar'?'اختر الوحدة التي تريد العمل عليها':'Choose the module you want to work with'}</p>
        </div>
        <div className='o-dev-tools'>
          {canUseDevMode&&<button type='button' className={'btn btn-s o-dev-toggle'+(devMode?' ac':'')} onClick={toggleDevMode}>{devMode?(locale==='ar'?'وضع المطور: مفعل':'Developer Mode: On'):(locale==='ar'?'وضع المطور':'Developer Mode')}</button>}
          {devMode&&<button type='button' className='btn btn-s' onClick={resetOrder}><Ic name='refresh-ccw' size={15}/>{locale==='ar'?'إعادة الترتيب الافتراضي':'Reset Default Order'}</button>}
        </div>
      </div>
      {devMode&&<div className='o-dev-board-note'><Ic name='wand-2' size={15}/><span>{locale==='ar'?'اسحب بطاقات التطبيقات لإعادة الترتيب. يتم حفظ الترتيب مباشرة.':'Drag app cards to reorder them. Changes are saved instantly.'}</span></div>}
      <div className='o-apps-screen'>
        <div className='o-apps-grid'>{visibleModules.map((mod,idx)=><div key={mod.key} className={'o-app-card-wrap'+(devMode?' dev':'')+(dragKey===mod.key?' dragging':'')} draggable={devMode} onDragStart={()=>setDragKey(mod.key)} onDragEnd={()=>setDragKey(null)} onDragOver={e=>{if(devMode)e.preventDefault()}} onDrop={e=>{e.preventDefault();reorder(dragKey,mod.key);setDragKey(null)}}>
          <button type='button' className={'o-app-card m-'+mod.key+(currentKey===mod.key?' ac':'')} onClick={()=>onOpen(mod)}>
            <span className={'o-app-card-icon m-'+mod.key}><Ic name={mod.icon||'package'} size={28}/></span>
            <span className='o-app-card-label'>{displayLabel(mod,locale)}</span>
          </button>
          {devMode&&<div className='o-dev-order-controls'>
            <button type='button' className='o-dev-order-btn' disabled={idx===0} onClick={()=>move(mod.key,-1)}>↑</button>
            <button type='button' className='o-dev-order-btn' disabled={idx===visibleModules.length-1} onClick={()=>move(mod.key,1)}>↓</button>
            <span className='o-dev-drag-hint'>{locale==='ar'?'اسحب':'Drag'}</span>
          </div>}
        </div>)}</div>
      </div>
    </div>
  </div>
}
function NotificationsPopover({open,onClose,locale,nav}){const[data,setData]=useState({items:[],alerts:[],loading:true});
  const load=useCallback(()=>{setData(p=>({...p,loading:true}));Promise.all([api.get('/api/notifications').catch(()=>({data:[]})),api.get('/api/dashboard').catch(()=>({data:{alerts:[]}}))]).then(([n,d])=>{
    setData({items:n.data||[],alerts:d.data?.alerts||[],loading:false})
  }).catch(()=>setData({items:[],alerts:[],loading:false}))},[]);
  useEffect(()=>{if(open)load()},[open,load]);
  if(!open) return null;
  return <div className='o-popover-backdrop' onClick={onClose}><div className='o-popover o-notif-pop' onClick={e=>e.stopPropagation()}>
    <div className='o-popover-head'><div className='o-popover-title'>{locale==='ar'?'الإشعارات':'Notifications'}</div><button type='button' className='btn btn-s btn-sm' onClick={async()=>{await api.put('/api/notifications/read-all').catch(()=>{});load();}}>{locale==='ar'?'تحديد الكل كمقروء':'Mark all as read'}</button></div>
    <div className='o-popover-body'>
      {data.loading?<div className='pld'><span className='spinner'/></div>:<>
        {data.alerts?.length>0&&<div className='o-popover-section'><div className='o-popover-section-title'>{locale==='ar'?'تنبيهات النظام':'System Alerts'}</div>{data.alerts.map((a,i)=><button type='button' key={'a'+i} className={'o-notif-row a-'+a.type} onClick={()=>{onClose();if(a.link)nav(a.link)}}><div className='o-notif-main'><div className='o-notif-title'>{locale==='ar'?a.text.replace(/membership\(s\)/g,'اشتراك').replace(/expiring within 3 days/g,'تنتهي خلال 3 أيام').replace(/active membership\(s\) with unpaid balance/g,'اشتراكات فعالة عليها رصيد غير مدفوع'):a.text}</div><div className='o-notif-sub'>{locale==='ar'?'تنبيه تشغيلي':'Operational alert'}</div></div></button>)}</div>}
        {data.items?.length>0&&<div className='o-popover-section'><div className='o-popover-section-title'>{locale==='ar'?'إشعاراتك':'Your Notifications'}</div>{data.items.map(item=><button type='button' key={item.id} className={'o-notif-row'+(item.is_read?'':' unread')} onClick={()=>{onClose();if(item.link)nav(item.link)}}><div className='o-notif-main'><div className='o-notif-title'>{item.title}</div><div className='o-notif-sub'>{item.body||timeSince(item.created_at)}</div></div><div className='o-notif-time'>{timeSince(item.created_at)}</div></button>)}</div>}
        {!data.alerts?.length&&!data.items?.length&&<div className='empty'><h3>{locale==='ar'?'لا توجد إشعارات حالياً':'No notifications right now'}</h3></div>}
      </>}
    </div>
  </div></div>
}
function GlobalSearchPopover({open,onClose,locale,nav}){const[q,setQ]=useState('');const[res,setRes]=useState({loading:false,members:[],memberships:[],plans:[]});
  useEffect(()=>{if(!open){setQ('');setRes({loading:false,members:[],memberships:[],plans:[]});return;}},[open]);
  useEffect(()=>{if(!open||q.trim().length<2){setRes(p=>({...p,loading:false,members:[],memberships:[],plans:[]}));return;}const tm=setTimeout(async()=>{setRes(p=>({...p,loading:true}));
    const query=encodeURIComponent(q.trim());
    const [members,memberships,plans]=await Promise.all([
      api.get('/api/members?search='+query+'&limit=5').catch(()=>({data:[]})),
      api.get('/api/memberships?search='+query+'&limit=5').catch(()=>({data:[]})),
      api.get('/api/plans').catch(()=>({data:[]})),
    ]);
    const filteredPlans=(plans.data||[]).filter(p=>String((locale==='ar'?(p.name_ar||p.name):p.name)||'').toLowerCase().includes(q.trim().toLowerCase())||String(p.name||'').toLowerCase().includes(q.trim().toLowerCase())).slice(0,5);
    setRes({loading:false,members:members.data||[],memberships:memberships.data||[],plans:filteredPlans});
  },260);return()=>clearTimeout(tm)},[open,q,locale]);
  if(!open) return null;
  return <div className='o-popover-backdrop' onClick={onClose}><div className='o-popover o-search-pop' onClick={e=>e.stopPropagation()}>
    <div className='o-popover-head'><div className='o-popover-title'>{locale==='ar'?'بحث شامل':'Global Search'}</div></div>
    <div className='o-popover-body'>
      <input autoFocus className='fi o-search-input' placeholder={locale==='ar'?'ابحث عن عضو، اشتراك، باقة...':'Search members, memberships, plans...'} value={q} onChange={e=>setQ(e.target.value)}/>
      {q.trim().length<2?<div className='empty'><h3>{locale==='ar'?'اكتب حرفين على الأقل للبحث':'Type at least 2 characters to search'}</h3></div>:res.loading?<div className='pld'><span className='spinner'/></div>:<div className='o-search-sections'>
        <div className='o-popover-section'><div className='o-popover-section-title'>{locale==='ar'?'الأعضاء':'Members'}</div>{res.members.length?res.members.map(m=><button type='button' key={m.id} className='o-search-row' onClick={()=>{onClose();nav('/members?open='+m.id)}}><div className='o-search-title'>{fullMemberName(m)||m.name||'—'}</div><div className='o-search-sub'>{m.member_no||m.phone||'—'}</div></button>):<div className='o-empty-note'>—</div>}</div>
        <div className='o-popover-section'><div className='o-popover-section-title'>{locale==='ar'?'الاشتراكات':'Memberships'}</div>{res.memberships.length?res.memberships.map(m=><button type='button' key={m.id} className='o-search-row' onClick={()=>{onClose();nav('/memberships')}}><div className='o-search-title'>{m.member_name||m.plan_name||'#'+m.id}</div><div className='o-search-sub'>{m.plan_name||m.status||'—'}</div></button>):<div className='o-empty-note'>—</div>}</div>
        <div className='o-popover-section'><div className='o-popover-section-title'>{locale==='ar'?'الباقات':'Plans'}</div>{res.plans.length?res.plans.map(p=><button type='button' key={p.id} className='o-search-row' onClick={()=>{onClose();nav('/plans?open='+p.id)}}><div className='o-search-title'>{locale==='ar'?(p.name_ar||p.name):p.name}</div><div className='o-search-sub'>{p.plan_type||'—'}</div></button>):<div className='o-empty-note'>—</div>}</div>
      </div>}
    </div>
  </div></div>
}
function userRoleLabel(user,locale){
  const raw=(user?.role_label||user?.role_name||user?.display_role||user?.role||user?.user_type||(Array.isArray(user?.roles)?user.roles.join(', '):user?.roles)||'').toString().trim();
  if(!raw) return locale==='ar'?'مستخدم النظام':'System User';
  const low=raw.toLowerCase();
  if(locale==='ar'){
    if(low.includes('super admin')) return 'مدير النظام';
    if(low.includes('admin')) return 'مدير';
    if(low.includes('manager')) return 'مدير';
    if(low.includes('coach')) return 'مدرب';
    if(low.includes('trainer')) return 'مدرب';
    if(low.includes('cashier')) return 'كاشير';
    if(low.includes('account')) return 'محاسبة';
    if(low.includes('hr')) return 'الموارد البشرية';
    if(low.includes('employee')) return 'موظف';
    if(low.includes('user')) return 'مستخدم';
  }
  return raw;
}
function UserMenuPopover({open,onClose,locale,user,logout,nav}){if(!open) return null;const roleLabel=userRoleLabel(user,locale);return <div className='o-popover-backdrop' onClick={onClose}><div className='o-popover o-user-pop' onClick={e=>e.stopPropagation()}>
  <div className='o-user-card'><div className='o-user-avatar lg'>{(user?.full_name||user?.username||'U')[0].toUpperCase()}</div><div><div className='o-user-name'>{user?.full_name||user?.username||'System User'}</div><div className='o-user-role'>{roleLabel}</div></div></div>
  <div className='o-user-menu'>
    {isAdminUser(user)&&<button type='button' className='o-user-menu-item' onClick={()=>{onClose();nav('/admin/users')}}><Ic name='shield' size={16}/><span>{locale==='ar'?'إدارة المستخدمين والصلاحيات':'Administration'}</span></button>}
    {isAdminUser(user)&&<button type='button' className='o-user-menu-item' onClick={()=>{onClose();nav('/settings')}}><Ic name='settings' size={16}/><span>{locale==='ar'?'إعدادات النظام العامة':'System Settings'}</span></button>}
    <button type='button' className='o-user-menu-item' onClick={()=>{onClose();nav('/apps')}}><Ic name='grid' size={16}/><span>{locale==='ar'?'كل التطبيقات':'All Applications'}</span></button>
    <button type='button' className='o-user-menu-item danger' onClick={logout}><Ic name='log-out' size={16}/><span>{locale==='ar'?'تسجيل الخروج':'Log out'}</span></button>
  </div>
</div></div>}
// Reception check-in popup — global overlay on every admin screen. Subscribes to
// the access-control SSE channel; the SERVER decides allow/deny, this only shows it.
function acBeep(freqs,dur,type){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=new AC();if(ctx.state==='suspended'){try{ctx.resume()}catch(_){}}let t=ctx.currentTime;(Array.isArray(freqs)?freqs:[freqs]).forEach(f=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';o.frequency.value=f;o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.35,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.start(t);o.stop(t+dur);t+=dur;});setTimeout(()=>{try{ctx.close()}catch(_){}} ,1500);}catch(_){}}
function acPlay(state){if(state==='active')acBeep([880,1320],0.12,'sine');else if(state==='debt')acBeep([740,740,740],0.14,'square');else acBeep([220,175],0.28,'sawtooth');}
function CheckinPopup(){
  const{locale}=useI18n();const ar=locale==='ar';const{nav}=useRouter();
  const[queue,setQueue]=useState([]);const cur=queue[0]||null;
  useEffect(()=>{if(document.getElementById('ac-checkin-css'))return;const s=document.createElement('style');s.id='ac-checkin-css';s.textContent='@keyframes acPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}';document.head.appendChild(s);},[]);
  useEffect(()=>{let stopped=false,es=null,retry=null;
    const connect=()=>{const token=localStorage.getItem('token')||'';if(!token){retry=setTimeout(connect,4000);return;}
      try{es=new EventSource('/api/access-control/checkin-stream?token='+encodeURIComponent(token));}catch(_){retry=setTimeout(connect,5000);return;}
      es.onmessage=e=>{try{const p=JSON.parse(e.data);setQueue(q=>q.length>=6?[...q.slice(-5),p]:[...q,p]);}catch(_){}}
      es.onerror=()=>{try{es.close()}catch(_){}if(!stopped)retry=setTimeout(connect,5000);};};
    connect();return()=>{stopped=true;if(es)try{es.close()}catch(_){}if(retry)clearTimeout(retry);};},[]);
  useEffect(()=>{if(!cur)return;acPlay(cur.decision&&cur.decision.state);const tm=setTimeout(()=>setQueue(q=>q.slice(1)),8000);return()=>clearTimeout(tm);},[cur]);
  if(!cur)return null;
  const d=cur.decision||{},m=cur.member,sub=cur.subscription,fin=cur.finance||{},pol=cur.policy||{};
  const dismiss=()=>setQueue(q=>q.slice(1));
  const goMember=(action)=>{if(m&&m.id)nav('/members?id='+m.id+'&action='+action);dismiss();};
  const money=v=>formatMoney(Number(v||0),fin.currency||'JOD');
  const nm=(m&&(ar?(m.name_ar||m.name):(m.name||m.name_ar)))||'—';
  const S={
    active:{a:'#16a34a',soft:'#ecfdf5',icon:'✓',title:ar?'الاشتراك فعّال':'Active'},
    debt:{a:'#16a34a',soft:'#ecfdf5',icon:'✓',title:ar?'الاشتراك فعّال':'Active'},
    blocked:{a:'#dc2626',soft:'#fef2f2',icon:'⛔',title:ar?'ممنوع الدخول':'Entry Blocked'},
    expired:{a:'#dc2626',soft:'#fef2f2',icon:'⌛',title:ar?'الاشتراك منتهي':'Membership Expired'},
    unknown:{a:'#64748b',soft:'#f1f5f9',icon:'?',title:ar?'غير معروف':'Unknown'}};
  const st=S[d.state]||S.unknown;
  const RE={ok:ar?'تم فتح الباب':'Door opened',debt_alert:ar?'مسموح — عليه ذمة مالية':'Allowed — has debt',debt_blocked:ar?'ممنوع — تجاوز حد الذمة':'Blocked — over debt limit',expired:ar?'انتهى الاشتراك — لم يُفتح الباب':'Membership expired',unknown:ar?'بطاقة غير صالحة أو منتهية':'Invalid or expired card',replay:ar?'محاولة دخول مكررة':'Duplicate scan'};
  const reasonTxt=RE[d.reason]||'';
  const isSessions=sub&&sub.billing_type==='sessions';
  const dRem=sub&&sub.days_remaining!=null?Number(sub.days_remaining):null;
  let total=0,pct=0;
  if(sub&&sub.start_date&&sub.end_date){total=Math.max(1,Math.round((Date.parse(sub.end_date+'T00:00:00')-Date.parse(sub.start_date+'T00:00:00'))/86400000));const el=Math.min(total,Math.max(0,total-(dRem||0)));pct=Math.round(el/total*100);}
  const showDebt=(d.state==='debt'||d.state==='blocked')&&Number(fin.outstanding||0)>0;
  const lab={fontSize:10,fontWeight:700,letterSpacing:'.05em',color:'#94a3b8',textTransform:'uppercase',marginBottom:2};
  const Field=({label,value,accent,big})=><div style={{minWidth:0}}>
    <div style={lab}>{label}</div>
    <div style={{fontSize:big?15:13.5,fontWeight:big?800:600,color:accent||'#1e293b',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontVariantNumeric:'tabular-nums'}}>{value}</div>
  </div>;
  return <div onClick={dismiss} style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'7vh',background:'rgba(15,23,42,0.45)',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)',direction:ar?'rtl':'ltr',fontFamily:'inherit'}}>
    <div onClick={e=>e.stopPropagation()} style={{width:'min(440px,94vw)',maxHeight:'86vh',overflowY:'auto',background:'#fff',borderRadius:20,boxShadow:'0 18px 50px rgba(2,6,23,0.32)',animation:'acPop .22s cubic-bezier(.2,.8,.2,1)'}}>
      <div style={{height:4,background:st.a}}/>
      {/* Header */}
      <div style={{padding:'14px 18px',background:st.soft,display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:42,height:42,borderRadius:13,background:st.a,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,flex:'0 0 auto'}}>{st.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:20,fontWeight:800,color:st.a,lineHeight:1.1}}>{st.title}</div>
          {reasonTxt&&<div style={{fontSize:12.5,color:'#64748b',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{reasonTxt}</div>}
        </div>
        <div style={{textAlign:ar?'left':'right',flex:'0 0 auto'}}>
          <div style={{fontSize:11,fontWeight:700,color:cur.door&&cur.door.opened?'#16a34a':'#94a3b8',whiteSpace:'nowrap'}}>{cur.door&&cur.door.opened?(ar?'🚪 مفتوح':'🚪 Open'):(ar?'🔒 مغلق':'🔒 Closed')}</div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:3,fontVariantNumeric:'tabular-nums'}}>{new Date(cur.ts).toLocaleTimeString(ar?'ar':'en',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
        </div>
      </div>

      {d.state==='unknown'
        ? <div style={{padding:'28px 18px',textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:700,color:'#334155'}}>{ar?'لم يتم التعرّف على العضو':'Member not recognized'}</div>
            {cur.card_no&&<div style={{fontSize:13,color:'#94a3b8',marginTop:7,fontFamily:'monospace'}}>{ar?'الرقم الممسوح':'Scanned'}: {cur.card_no}</div>}
          </div>
        : <div style={{padding:'16px 18px'}}>
            {/* Member */}
            <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:15}}>
              {m&&m.photo?<img src={m.photo} alt='' style={{width:56,height:56,borderRadius:16,objectFit:'cover',flex:'0 0 auto',boxShadow:'0 0 0 3px '+st.soft}}/>:<div style={{width:56,height:56,borderRadius:16,background:st.a,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:25,fontWeight:800,flex:'0 0 auto',boxShadow:'0 0 0 3px '+st.soft}}>{(nm[0]||'؟')}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:18,fontWeight:800,color:'#0f172a',lineHeight:1.15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nm}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
                  {m&&<span style={{fontSize:12,fontWeight:700,color:'#475569',background:'#f1f5f9',padding:'3px 9px',borderRadius:100}}>#{m.member_no||m.id}</span>}
                  {m&&m.phone&&<span style={{fontSize:12,color:'#475569',background:'#f1f5f9',padding:'3px 9px',borderRadius:100,fontVariantNumeric:'tabular-nums'}}>{m.phone}</span>}
                </div>
              </div>
            </div>

            {/* Subscription */}
            {sub&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'11px 14px',paddingTop:14,borderTop:'1px solid #f1f5f9'}}>
              <Field label={ar?'الباقة':'Plan'} value={sub.plan_name||'—'}/>
              {isSessions
                ? <Field label={ar?'الحصص المتبقية':'Sessions left'} value={sub.remaining_sessions!=null?sub.remaining_sessions:'—'}/>
                : <Field label={ar?'الأيام المتبقية':'Days left'} value={dRem!=null?(dRem+' '+(ar?'يوم':'d')):'—'} accent={dRem!=null?(dRem<=7?'#ea580c':'#16a34a'):null}/>}
              <Field label={ar?'تاريخ البداية':'Start'} value={sub.start_date||'—'}/>
              <Field label={ar?'تاريخ الانتهاء':'End'} value={sub.end_date||'—'} accent={d.state==='expired'?'#dc2626':null}/>
            </div>}

            {/* Days progress (period plans) */}
            {!isSessions&&sub&&total>0&&<div style={{marginTop:12}}>
              <div style={{height:6,borderRadius:100,background:'#eef2f6',overflow:'hidden'}}>
                <div style={{height:'100%',width:pct+'%',borderRadius:100,background:d.state==='expired'?'#ef4444':st.a}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10.5,color:'#94a3b8',marginTop:4,fontVariantNumeric:'tabular-nums'}}>
                <span>{Math.min(total,total-(dRem||0))} / {total} {ar?'يوم':'d'}</span>
                <span>{pct}%</span>
              </div>
            </div>}

            {/* Financial */}
            {fin&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginTop:14,paddingTop:14,borderTop:'1px solid #f1f5f9'}}>
              <Field big label={ar?'السعر':'Price'} value={money(fin.price)}/>
              <Field big label={ar?'المدفوع':'Paid'} value={money(fin.paid)} accent='#16a34a'/>
              <Field big label={ar?'الذمة':'Outstanding'} value={money(fin.outstanding)} accent={Number(fin.outstanding||0)>0?(d.state==='blocked'?'#dc2626':'#ea580c'):null}/>
            </div>}

            {/* Debt strip */}
            {showDebt&&<div style={{marginTop:14,padding:'11px 14px',borderRadius:14,background:d.state==='blocked'?'#fef2f2':'#fff7ed',border:'1px solid '+(d.state==='blocked'?'#fecaca':'#fed7aa'),display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11.5,fontWeight:700,color:d.state==='blocked'?'#b91c1c':'#c2410c'}}>{d.state==='blocked'?(ar?'ممنوع — ذمة مالية':'Blocked — debt'):(ar?'عليه ذمة مالية':'Outstanding')}</div>
                <div style={{fontSize:24,fontWeight:900,color:d.state==='blocked'?'#dc2626':'#ea580c',lineHeight:1.05,fontVariantNumeric:'tabular-nums'}}>{money(fin.outstanding)}</div>
                {d.state==='blocked'&&Number(pol.debtBlockThreshold||0)>0&&<div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{ar?'الحد':'Limit'}: {money(pol.debtBlockThreshold)}</div>}
              </div>
              {m&&<button onClick={()=>goMember('pay')} style={{padding:'10px 18px',border:'none',borderRadius:11,background:d.state==='blocked'?'#dc2626':'#f97316',color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap',flex:'0 0 auto'}}>{ar?'تسديد':'Collect'}</button>}
            </div>}
          </div>}

      {/* Actions */}
      <div style={{padding:'4px 18px 16px',display:'flex',gap:9}}>
        {d.state==='expired'&&m&&<button onClick={()=>goMember('renew')} style={{flex:1,padding:'12px',border:'none',borderRadius:12,background:'#2563eb',color:'#fff',fontSize:14.5,fontWeight:700,cursor:'pointer'}}>{ar?'تجديد الاشتراك':'Renew'}</button>}
        <button onClick={dismiss} style={{flex:1,padding:'12px',border:'1px solid #e2e8f0',borderRadius:12,background:'#fff',color:'#475569',fontSize:14.5,fontWeight:700,cursor:'pointer'}}>{ar?'إغلاق':'Close'}</button>
      </div>
      {queue.length>1&&<div style={{padding:'0 18px 12px',fontSize:11.5,color:'#94a3b8'}}>+{queue.length-1} {ar?'بانتظار':'queued'}</div>}
    </div>
  </div>;
}
function AppShell(){const{user,logout}=useContext(AC);const{t,locale,setLocale,applyLayoutSettings}=useI18n();const{path,nav,param}=useRouter();
  const cachedLayout=(()=>{try{return JSON.parse(localStorage.getItem('appLayout')||'null')||{menu:[],settings:{}}}catch(_){return {menu:[],settings:{}}}})();
  const[layout,sLayout]=useState(cachedLayout);
  const[frontendReady,sFrontendReady]=useState(false);
  const[booting,sBooting]=useState(true);
  const[notifOpen,setNotifOpen]=useState(false);const[searchOpen,setSearchOpen]=useState(false);const[userMenuOpen,setUserMenuOpen]=useState(false);const[notifCounts,setNotifCounts]=useState({bell:0});
  useEffect(()=>{let alive=true;(async()=>{try{const r=await api.get('/api/layout');if(!alive)return;sLayout(r.data||{});localStorage.setItem('appLayout',JSON.stringify(r.data||{}));await setLocale(r.data?.settings?.locale||'en',r.data?.settings||{});applyLayoutSettings(r.data?.settings||{});}catch(_){if(cachedLayout?.settings){await setLocale(cachedLayout.settings.locale||'en',cachedLayout.settings||{}).catch(()=>{});applyLayoutSettings(cachedLayout.settings||{});}}try{await window.GymOS.initModuleFrontends()}catch(_){ }if(alive){sFrontendReady(true);sBooting(false);}})();return()=>{alive=false}},[]);
  useEffect(()=>{const loadCounts=()=>{api.get('/api/notifications/count').then(r=>{setNotifCounts({bell:r.data?.unread||0})}).catch(()=>setNotifCounts({bell:0}));};loadCounts();const tm=setInterval(loadCounts,30000);return()=>clearInterval(tm)},[]);
  const backendMenu=layout.menu||[]; const frontendMenu=frontendReady?window.GymOS.getMenus():[]; const adminMenu=isAdminUser(user)?[{path:'/admin/users',label:'Users',labelAr:'المستخدمون',order:904,module:'administration'},{path:'/admin/roles',label:'Roles',labelAr:'الأدوار',order:905,module:'administration'},{path:'/admin/permissions',label:'Permissions',labelAr:'الصلاحيات',order:906,module:'administration'}]:[]; const menu=dedupeMenuItems([...backendMenu,...frontendMenu,...adminMenu]);
  const cp=(path||'/').split('?')[0];
  const[moduleLoading,sModuleLoading]=useState(false);
  const[settingsModules,sSettingsModules]=useState(null);
  useEffect(()=>{if(!frontendReady)return;let alive=true;const set=new Set();const eat=s=>{if(s&&s.module&&(s.fields||[]).length&&!String(s.id||'').startsWith('legacy-'))set.add(s.module)};try{(window.GymOS.getSettingsSections?.()||[]).forEach(eat)}catch(_){}api.get('/api/settings/schema').then(r=>{if(!alive)return;(r.data?.sections||[]).forEach(eat);sSettingsModules(set)}).catch(()=>{if(alive)sSettingsModules(set)});return()=>{alive=false}},[frontendReady]);
  const lastLoadedPath=useRef('');
  useEffect(()=>{if(!frontendReady)return;const clean=cp.split('?')[0];if(lastLoadedPath.current===clean)return;lastLoadedPath.current=clean;const page=window.GymOS.getPage(clean);if(page)return;sModuleLoading(true);window.GymOS.ensureModuleLoaded(clean).then(()=>{sModuleLoading(false)}).catch(()=>{sModuleLoading(false)})},[cp,frontendReady]);
  const pageEntry=frontendReady?window.GymOS.getPage(cp):null;
  const modules=buildModuleRegistry(menu,locale);
  const requestedSettingsModule=cp==='/settings'?param('module'):null;
  const currentModuleKey=requestedSettingsModule&&requestedSettingsModule!=='all'?requestedSettingsModule:moduleKeyForPath(cp,menu);
  const currentModule=modules.find(m=>m.key===currentModuleKey)||modules[0];
  const basePages=(currentModule?.pages||[]).filter(p=>p.path!=='/' && !String(p.path||'').startsWith('/settings'));
  const hasModuleSettings=settingsModules?settingsModules.has(currentModuleKey):(requestedSettingsModule&&requestedSettingsModule!=='all'?true:false);
  const moduleSettingsPath=currentModuleKey && currentModuleKey!=='dashboard' && hasModuleSettings ? `/settings?module=${currentModuleKey}` : null;
  const configTab=moduleSettingsPath ? {path:moduleSettingsPath,label:'Configuration',labelAr:'الإعدادات',order:9998,module:currentModuleKey} : null;
  const currentPages=configTab ? dedupeMenuItems([...basePages,configTab]) : basePages;
  const breadcrumbs=buildBreadcrumbs(path,currentModule,locale);
  const routeMenuEntry=menu.find(m=>((m.path||'').split('?')[0])===cp);
  const isStandalonePage=cp==='/cafeteria-pos'||!!pageEntry?.standalone||!!routeMenuEntry?.standalone;
  const moduleHomePath=currentModule?.pages?.find(p=>p.path!=='/')?.path||currentModule?.pages?.[0]?.path||'/';
  const openModule=(mod)=>{const target=mod.pages?.find(p=>p.path!=='/')?.path||mod.pages?.[0]?.path||'/';nav(target)};
  const closeOverlays=()=>{setNotifOpen(false);setSearchOpen(false);setUserMenuOpen(false)};
  const renderPage=()=>{
    if(booting || !frontendReady || moduleLoading){
      return <div className='pld' style={{minHeight:'50vh',display:'flex',flexDirection:'column',gap:12,alignItems:'center',justifyContent:'center'}}>
        <span className='spinner'/>
        <div style={{fontSize:14,opacity:.7}}>{locale==='ar'?'جاري تحميل النظام...':'Loading system...'}</div>
      </div>;
    }
    if(cp==='/apps') return <AppsGrid modules={modules} currentKey={currentModuleKey} onOpen={openModule} locale={locale}/>;
    if(pageEntry?.component){const PageComp=pageEntry.component;return <PageComp path={cp}/>;}
    if(menu.find(m=>m.path===cp)) return <GenericModulePage path={cp}/>;
    return <div className='pb'><div className='empty'><h3>{t('common.pageNotFound','Page not found')}</h3></div></div>;
  };
  return <div className={'o-app-shell'+(isStandalonePage?' standalone-route':'')}>
    <CheckinPopup/>
    {!isStandalonePage&&<header className='o-topbar'>
      <div className='o-topbar-left'>
        <button type='button' className='o-brandmark' onClick={()=>{closeOverlays();nav(moduleHomePath)}} title={locale==='ar'?'الرئيسية داخل الوحدة':'Module Home'}>
          <span className={'o-brandmark-icon m-'+currentModuleKey}><Ic name={currentModule?.icon||'layout-dashboard'} size={17}/></span>
          <span className='o-brandmark-text'>{currentModule?.label||'GymOS'}</span>
        </button>
        {cp!=='/apps'&&<nav className='o-topmenu'>
          {currentPages.map(item=>{
            const itemPath=(item.path||'').split('?')[0];
            const currentPath=cp.split('?')[0];
            const isActive=itemPath==='/settings' ? currentPath==='/settings' : currentPath===itemPath;
            return <button type='button' key={item.path} className={'o-topmenu-item'+(isActive?' ac':'')} onClick={()=>{closeOverlays();nav(item.path)}}>{displayLabel(item,locale)}</button>
          })}
        </nav>}
      </div>
      <div className='o-topbar-right'>
        <button type='button' className='o-apps-toggle' onClick={()=>{closeOverlays();nav('/apps')}} title={locale==='ar'?'كل التطبيقات':'All Applications'}><Ic name='grid' size={18}/></button>
        <button type='button' className='o-icon-btn' onClick={()=>{setSearchOpen(v=>!v);setNotifOpen(false);setUserMenuOpen(false)}} title={locale==='ar'?'بحث':'Search'}><Ic name='search' size={16}/></button>
        <button type='button' className='o-icon-btn' onClick={()=>{setNotifOpen(v=>!v);setSearchOpen(false);setUserMenuOpen(false)}} title={locale==='ar'?'الإشعارات':'Notifications'}><span className='o-dot-badge'>{notifCounts.bell}</span><Ic name='bell' size={16}/></button>
        <button type='button' className='o-icon-btn' onClick={()=>{closeOverlays();nav('/')}} title={locale==='ar'?'لوحة التحكم الرئيسية':'Main Dashboard'}><Ic name='layout-dashboard' size={16}/></button>
        <button type='button' className='o-icon-btn' title={locale==='ar'?'آخر النشاطات':'Recent Activity'}><Ic name='clock' size={16}/></button>
        <div className='o-systray-divider'/>
        <div className='o-company'>{layout?.settings?.companyName||'Demo Company'}</div>
        <button type='button' className='o-user-btn' title={userRoleLabel(user,locale)} onClick={()=>{setUserMenuOpen(v=>!v);setNotifOpen(false);setSearchOpen(false)}}><span className='o-user-avatar'>{(user?.full_name||user?.username||'U')[0].toUpperCase()}</span></button>
      </div>
    </header>}
    <NotificationsPopover open={notifOpen} onClose={()=>setNotifOpen(false)} locale={locale} nav={nav}/>
    <GlobalSearchPopover open={searchOpen} onClose={()=>setSearchOpen(false)} locale={locale} nav={nav}/>
    <UserMenuPopover open={userMenuOpen} onClose={()=>setUserMenuOpen(false)} locale={locale} user={user} logout={logout} nav={nav}/>
    <div className='o-workspace no-sidebar'>
      <main className='o-view-shell full'>
        {!isStandalonePage&&cp!=='/apps'&&<div className='o-breadcrumbbar'>
          <div className='o-breadcrumbs'>{breadcrumbs.map((item,idx)=><React.Fragment key={item.path||idx}><button type='button' className={'o-crumb'+(idx===breadcrumbs.length-1?' ac':'')} onClick={()=>item.path&&nav(item.path)}>{item.label}</button>{idx<breadcrumbs.length-1&&<Ic name='chevron-right' size={14}/>}</React.Fragment>)}</div>
          <div className='o-breadcrumb-actions'><button type='button' className='o-icon-btn soft' onClick={()=>nav('/apps')}><Ic name='grid' size={16}/></button></div>
        </div>}
        {renderPage()}
      </main>
    </div>
  </div>}
function App(){const{user,loading}=useContext(AC);if(loading)return<div className='login-page'><span className='spinner' style={{width:28,height:28,borderWidth:3}}/></div>;if(!user)return<LoginPage/>;return<AppShell/>}
window.GymOS.shared={...window.GymOS.shared,api,useI18n,useRouter,Modal,Ic,toast,timeSince,formatMoney};
async function bootstrap(){window.GymOS.shared={...window.GymOS.shared,api,useI18n,useRouter,Modal,Ic,toast,timeSince,formatMoney};ReactDOM.createRoot(document.getElementById('root')).render(<I18nProvider><AP><App/></AP></I18nProvider>);}
bootstrap();

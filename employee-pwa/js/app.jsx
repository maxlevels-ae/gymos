
const{useState,useEffect,useCallback,createContext,useContext}=React;

const API=window.location.origin;
const defaultConfig={
  type:'employee',
  enabled:true,
  appName:'Employee Portal',
  appNameAr:'بوابة الموظف',
  subtitle:'Employee Management',
  subtitleAr:'نظام إدارة الموظفين',
  themeColor:'#0c1017',
  accentColor:'#6366f1',
  backgroundColor:'#06080d',
  logoUrl:'',
  allowClock:true,
  showBadge:true,
  locale:'ar',
  dir:'rtl'
};

const L={
  ar:{appName:'بوابة الموظف',appSub:'نظام إدارة الموظفين',login:'تسجيل الدخول',phone:'رقم الهاتف',sendOtp:'إرسال رمز التحقق',enterOtp:'أدخل الرمز',verify:'تحقق',
    home:'الرئيسية',att:'الحضور',salary:'الراتب',profile:'الملف',more:'المزيد',
    clockIn:'تسجيل دخول',clockOut:'تسجيل خروج',clockedIn:'في الدوام',notClockedIn:'لم تسجل',
    todayH:'ساعات اليوم',monthH:'ساعات الشهر',present:'حاضر',late:'متأخر',absent:'غائب',
    basic:'الأساسي',allowances:'البدلات',deductions:'الخصومات',overtime:'الإضافي',net:'الصافي',
    name:'الاسم',email:'البريد',mobile:'الجوال',dept:'القسم',pos:'الوظيفة',empNo:'رقم الموظف',badge:'البطاقة',
    lang:'اللغة',theme:'المظهر',dark:'داكن',light:'فاتح',logout:'تسجيل خروج',changeLang:'English',
    noData:'لا توجد بيانات',welcome:'مرحباً',settings:'الإعدادات',
    slips:'كشوف الراتب',attLog:'سجل الحضور',date:'التاريخ',in:'دخول',out:'خروج',hours:'ساعات',status:'الحالة',
    latePenalty:'خصم تأخير',absentPenalty:'خصم غياب',dLate:'يوم تأخير',dAbsent:'يوم غياب',
    otpSent:'تم إرسال الرمز',clockError:'تعذر تنفيذ العملية',
  },
  en:{appName:'Employee Portal',appSub:'Employee Management',login:'Sign In',phone:'Phone',sendOtp:'Send OTP',enterOtp:'Enter code',verify:'Verify',
    home:'Home',att:'Attendance',salary:'Salary',profile:'Profile',more:'More',
    clockIn:'Clock In',clockOut:'Clock Out',clockedIn:'Clocked In',notClockedIn:'Not Clocked',
    todayH:'Today',monthH:'This Month',present:'Present',late:'Late',absent:'Absent',
    basic:'Basic',allowances:'Allowances',deductions:'Deductions',overtime:'Overtime',net:'Net Pay',
    name:'Name',email:'Email',mobile:'Mobile',dept:'Department',pos:'Position',empNo:'Emp No',badge:'Badge',
    lang:'Language',theme:'Theme',dark:'Dark',light:'Light',logout:'Logout',changeLang:'العربية',
    noData:'No data',welcome:'Welcome',settings:'Settings',
    slips:'Salary Slips',attLog:'Attendance Log',date:'Date',in:'In',out:'Out',hours:'Hours',status:'Status',
    latePenalty:'Late penalty',absentPenalty:'Absent penalty',dLate:'d late',dAbsent:'d absent',
    otpSent:'OTP sent',clockError:'Operation failed',
  }
};

function hexToRgb(hex){
  const value=String(hex||'').replace('#','').trim();
  if(value.length===3){
    const expanded=value.split('').map(x=>x+x).join('');
    return {r:parseInt(expanded.slice(0,2),16),g:parseInt(expanded.slice(2,4),16),b:parseInt(expanded.slice(4,6),16)};
  }
  if(value.length!==6)return {r:99,g:102,b:241};
  return {r:parseInt(value.slice(0,2),16),g:parseInt(value.slice(2,4),16),b:parseInt(value.slice(4,6),16)};
}
function lighten(hex,ratio=.18){
  const {r,g,b}=hexToRgb(hex);
  const mix=v=>Math.min(255,Math.round(v+(255-v)*ratio));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
function alpha(hex,a=.12){
  const {r,g,b}=hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function applyBranding(cfg){
  const root=document.documentElement;
  const accent=cfg?.accentColor||defaultConfig.accentColor;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-h', lighten(accent,.22));
  root.style.setProperty('--accent-g', alpha(accent,.12));
  if(cfg?.backgroundColor) root.style.setProperty('--bg-0', cfg.backgroundColor);
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  if(themeMeta) themeMeta.setAttribute('content', cfg?.themeColor||defaultConfig.themeColor);
  document.title=(cfg?.locale||'ar')==='ar' ? (cfg?.appNameAr||cfg?.appName||defaultConfig.appNameAr) : (cfg?.appName||cfg?.appNameAr||defaultConfig.appName);
}
function getAppText(cfg,lc,key,fallback){
  if(key==='appName') return lc==='ar' ? (cfg?.appNameAr||fallback) : (cfg?.appName||fallback);
  if(key==='appSub') return lc==='ar' ? (cfg?.subtitleAr||fallback) : (cfg?.subtitle||fallback);
  return fallback;
}

const Ctx=createContext();const useApp=()=>useContext(Ctx);
const api={token:localStorage.getItem('emp_token')||null,
  async r(p,o={}){
    const h={'Content-Type':'application/json'};
    if(this.token)h['Authorization']='Bearer '+this.token;
    const r=await fetch(API+p,{...o,headers:{...h,...(o.headers||{})}});
    const d=await r.json();
    if(!r.ok){const err=new Error(d.error||'Failed');err.code=d.code;err.status=r.status;throw err;}
    return d
  },
  get:p=>api.r(p),post:(p,b)=>api.r(p,{method:'POST',body:JSON.stringify(b)})
};

// Map login/OTP errors to friendly, localized text (never expose raw gateway errors).
function otpErrMsg(e,ar){
  const code=e&&e.code;const status=e&&e.status;
  if(code==='OTP_DELIVERY_FAILED')return ar?'تعذّر إرسال رمز التحقق حالياً. حاول مرة أخرى بعد قليل أو تواصل مع الإدارة.':'Could not send the verification code right now. Please try again shortly or contact the admin.';
  if(status===404)return ar?'لا يوجد موظف مسجّل بهذا الرقم. تأكد من تسجيل رقم هاتفك لدى الإدارة.':'No employee is registered with this phone number. Please ask the admin to add your phone.';
  if(status===429)return ar?'محاولات كثيرة. يرجى المحاولة بعد قليل.':'Too many attempts. Please try again later.';
  return (e&&e.message)||(ar?'حدث خطأ. حاول مرة أخرى.':'Something went wrong. Please try again.');
}

function useTime(){const[t,s]=useState(new Date());useEffect(()=>{const i=setInterval(()=>s(new Date()),1000);return()=>clearInterval(i)},[]);return t}

function Provider({children}){
  const[lc,sLc]=useState(localStorage.getItem('emp_lc')||'ar');
  const[th,sTh]=useState(localStorage.getItem('emp_th')||'dark');
  const[user,sUser]=useState(null);
  const[ld,sLd]=useState(true);
  const[pg,sPg]=useState('home');
  const[cfg,sCfg]=useState(defaultConfig);

  const t=useCallback(k=>L[lc]?.[k]||L.en[k]||k,[lc]);const ar=lc==='ar';

  const refreshDashboard=useCallback(async(tokenOverride)=>{
    if(tokenOverride) api.token=tokenOverride;
    const r=await api.get('/api/pwa/employee/dashboard');
    sUser(r.data);
    return r.data;
  },[]);

  useEffect(()=>{
    fetch(API+'/api/pwa/config/employee').then(r=>r.json()).then(r=>{
      const next={...defaultConfig,...(r.data||{})};
      sCfg(next);
      applyBranding(next);
      if(!localStorage.getItem('emp_lc')) sLc((next.locale||'ar')==='en'?'en':'ar');
    }).catch(()=>applyBranding(defaultConfig));
  },[]);
  useEffect(()=>{document.documentElement.lang=lc;document.documentElement.dir=ar?'rtl':'ltr'},[lc,ar]);
  useEffect(()=>{document.documentElement.setAttribute('data-theme',th);localStorage.setItem('emp_th',th)},[th]);
  useEffect(()=>{localStorage.setItem('emp_lc',lc)},[lc]);
  useEffect(()=>{
    if(!api.token){sLd(false);return}
    refreshDashboard().then(()=>sLd(false)).catch(()=>{
      api.token=null;localStorage.removeItem('emp_token');sLd(false)
    })
  },[refreshDashboard]);

  const login=async(tk)=>{api.token=tk;localStorage.setItem('emp_token',tk);await refreshDashboard(tk)};
  const logout=()=>{api.token=null;localStorage.removeItem('emp_token');sUser(null);sPg('home')};

  return <Ctx.Provider value={{lc,ar,th,t,user,sUser,ld,pg,sPg,login,logout,toggleTh:()=>sTh(p=>p==='dark'?'light':'dark'),toggleLc:()=>sLc(p=>p==='ar'?'en':'ar'),cfg,refreshDashboard}}>
    {children}
  </Ctx.Provider>;
}

function BrandHeader(){
  const{cfg,lc}=useApp();
  const name=getAppText(cfg,lc,'appName',L[lc]?.appName);
  const sub=getAppText(cfg,lc,'appSub',L[lc]?.appSub);
  return <div className="pwa-login-logo">
    {cfg?.logoUrl?<img src={cfg.logoUrl} alt={name} style={{width:72,height:72,objectFit:'contain',marginBottom:12,borderRadius:16,background:'rgba(255,255,255,.04)',padding:8}}/>:<div className="logo-icon">👤</div>}
    <h1>{name}</h1>
    <p>{sub}</p>
  </div>;
}

function Login(){
  const{t,ar,login}=useApp();const[ph,sPh]=useState('');const[otp,sOtp]=useState('');const[step,sStep]=useState(1);const[busy,sBusy]=useState(false);const[err,sErr]=useState('');const[info,sInfo]=useState('');
  const send=async()=>{if(!ph.trim())return;sBusy(true);sErr('');sInfo('');try{const r=await api.post('/api/auth/otp/send',{phone:ph.trim(),type:'employee'});if(r.data?.dev_otp)sOtp(r.data.dev_otp);sInfo(`${t('otpSent')} ${r.data?.maskedPhone||''}`.trim());sStep(2)}catch(e){sErr(otpErrMsg(e,ar))}finally{sBusy(false)}};
  const verify=async()=>{if(!otp.trim())return;sBusy(true);sErr('');try{const r=await api.post('/api/auth/otp/verify',{phone:ph.trim(),otp:otp.trim(),type:'employee'});await login(r.data.token)}catch(e){sErr(otpErrMsg(e,ar))}finally{sBusy(false)}};
  return <div className="pwa-login"><div className="pwa-login-box">
    <BrandHeader/>
    {err&&<div style={{background:'var(--red-g)',color:'var(--red)',padding:10,borderRadius:10,fontSize:13,marginBottom:14,textAlign:'center'}}>{err}</div>}
    {info&&<div style={{background:'var(--green-g)',color:'var(--green)',padding:10,borderRadius:10,fontSize:13,marginBottom:14,textAlign:'center'}}>{info}</div>}
    {step===1?<><div className="pwa-field"><label className="pwa-label">{t('phone')}</label><input className="pwa-input" type="tel" value={ph} onChange={e=>sPh(e.target.value)} placeholder="07XXXXXXXX" dir="ltr" autoFocus/></div>
      <button className="pwa-btn pwa-btn-primary" onClick={send} disabled={busy}>{busy?'...':t('sendOtp')}</button></>
    :<><div className="pwa-field"><label className="pwa-label">{t('enterOtp')}</label><input className="pwa-input" type="text" inputMode="numeric" value={otp} onChange={e=>sOtp(e.target.value)} placeholder="000000" dir="ltr" autoFocus maxLength={6} style={{textAlign:'center',fontSize:28,letterSpacing:12,fontWeight:800}}/></div>
      <button className="pwa-btn pwa-btn-primary" onClick={verify} disabled={busy}>{busy?'...':t('verify')}</button>
      <button className="pwa-btn pwa-btn-outline" onClick={()=>sStep(1)} style={{marginTop:8}}>{ar?'تغيير الرقم':'Change'}</button></>}
  </div></div>;
}

function Home(){
  const{t,ar,user,sUser,cfg}=useApp();const now=useTime();const emp=user?.employee;const tl=user?.todayLog;
  const ci=!!(tl?.check_in&&!tl?.check_out);const[busy,sBusy]=useState(false);const[err,sErr]=useState('');
  const h=now.getHours()%12||12;const m=String(now.getMinutes()).padStart(2,'0');const s=String(now.getSeconds()).padStart(2,'0');
  const ap=now.getHours()>=12?(ar?'م':'PM'):(ar?'ص':'AM');
  const ds=now.toLocaleDateString(ar?'ar-JO':'en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const clock=async()=>{sBusy(true);sErr('');try{await api.post('/api/pwa/employee/clock',{action:ci?'out':'in'});const r=await api.get('/api/pwa/employee/dashboard');sUser(r.data)}catch(e){sErr(e.message||t('clockError'))}finally{sBusy(false)}};
  const wh=tl?.worked_hours?Number(tl.worked_hours).toFixed(1):ci?'--':'0';
  if(!emp)return <div className="pwa-loading"><span className="pwa-spinner"/></div>;
  return <div className="pwa-page">
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
      <div style={{width:48,height:48,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:18,flexShrink:0}}>{(emp.first_name||emp.full_name||'?')[0]}</div>
      <div style={{flex:1}}><div style={{fontSize:11,color:'var(--t3)'}}>{t('welcome')}</div><div style={{fontSize:17,fontWeight:800}}>{emp.full_name}</div><div style={{fontSize:12,color:'var(--t4)'}}>{emp.position_name||'—'} · {emp.department_name||'—'}</div></div>
    </div>
    <div style={{background:'linear-gradient(135deg,var(--bg-3),var(--bg-2))',border:'1px solid var(--border)',borderRadius:18,padding:'28px 20px',textAlign:'center',marginBottom:16}}>
      <div style={{fontSize:44,fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{h}:{m}:{s} <span style={{fontSize:18}}>{ap}</span></div>
      <div style={{fontSize:13,color:'var(--t3)',marginBottom:20}}>{ds}</div>
      <button onClick={clock} disabled={busy||!cfg?.allowClock} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:10,padding:'16px 44px',borderRadius:50,fontSize:17,fontWeight:800,cursor:'pointer',border:'none',fontFamily:'var(--font)',color:'#fff',
        background:ci?'var(--amber)':'var(--green)',opacity:cfg?.allowClock?1:.5,boxShadow:ci?'0 0 30px rgba(245,158,11,.3)':'0 0 30px rgba(16,185,129,.3)'}}>
        {busy?'...':<>{ci?'↩':'✓'} {ci?t('clockOut'):t('clockIn')}</>}
      </button>
      {ci&&<div style={{marginTop:12}}><span className="pwa-badge pwa-badge-green">{t('clockedIn')} · {tl?.check_in?.slice(11,16)}</span></div>}
      {err&&<div style={{marginTop:10,fontSize:12,color:'var(--red)'}}>{err}</div>}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
      {[[t('todayH'),wh+'h','var(--green)'],[t('monthH'),(user?.totalHoursThisMonth||0)+'h','var(--accent)'],
        [t('present'),(user?.monthLogs||[]).filter(l=>l.status==='present').length,'var(--cyan)'],
        [t('late'),(user?.monthLogs||[]).filter(l=>l.status==='late').length,'var(--amber)']].map(([l,v,c],i)=>
        <div key={i} style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:c}}/>
          <div style={{fontSize:10,color:'var(--t3)',textTransform:'uppercase',marginBottom:4}}>{l}</div>
          <div style={{fontSize:22,fontWeight:800}}>{v}</div></div>)}
    </div>
    {user?.latestPayslip&&<div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:14,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:11,color:'var(--t3)'}}>{ar?'آخر راتب':'Latest Payslip'}</div><div style={{fontSize:12,color:'var(--t4)'}}>{user.latestPayslip.period_month}/{user.latestPayslip.period_year}</div></div>
        <div style={{fontSize:22,fontWeight:800,color:'var(--green)'}}>{Number(user.latestPayslip.net_amount||0).toFixed(2)}</div>
      </div>
    </div>}
  </div>;
}

function Att(){
  const{t}=useApp();const[d,sD]=useState(null);
  useEffect(()=>{api.get('/api/pwa/employee/attendance').then(r=>sD(r.data)).catch(()=>sD([]))},[]);
  if(!d)return <div className="pwa-loading"><span className="pwa-spinner"/></div>;
  return <div className="pwa-page"><div className="pwa-page-title">{t('attLog')}</div>
    {d.length?d.map(l=><div key={l.id} style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
      <div style={{width:36,height:36,borderRadius:8,background:l.status==='present'?'var(--green-g)':l.status==='late'?'var(--amber-g)':'var(--red-g)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
        {l.status==='present'?'✓':l.status==='late'?'⏰':'✗'}</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{l.attendance_date}</div><div style={{fontSize:11,color:'var(--t3)'}}>{l.check_in?.slice(11,16)||'—'} → {l.check_out?.slice(11,16)||'--:--'} · {l.worked_hours?Number(l.worked_hours).toFixed(1)+'h':'—'}</div></div>
      <span className={`pwa-badge ${l.status==='present'?'pwa-badge-green':l.status==='late'?'pwa-badge-amber':'pwa-badge-red'}`} style={{fontSize:10}}>{t(l.status)||l.status}</span>
    </div>):<div className="pwa-empty"><div className="pwa-empty-icon">📅</div><h3>{t('noData')}</h3></div>}
  </div>;
}

function Salary(){
  const{t,ar}=useApp();const[d,sD]=useState(null);
  useEffect(()=>{api.get('/api/pwa/employee/payslips').then(r=>sD(r.data)).catch(()=>sD([]))},[]);
  const mos=ar?['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']:['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if(!d)return <div className="pwa-loading"><span className="pwa-spinner"/></div>;
  return <div className="pwa-page"><div className="pwa-page-title">{t('slips')}</div>
    {d.length?d.map(s=>{let dd=null;try{dd=s.deduction_details?JSON.parse(s.deduction_details):null}catch(_){}
      return <div key={s.id} style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:14,marginBottom:12,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',background:'var(--bg-3)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:700}}>{mos[s.period_month]} {s.period_year}</div>
          <span className={`pwa-badge ${s.status==='posted'?'pwa-badge-green':'pwa-badge-amber'}`} style={{fontSize:10}}>{s.status}</span></div>
        <div style={{padding:'14px 16px'}}>
          {[[t('basic'),s.basic],[t('allowances'),s.allowances],[t('overtime'),s.overtime_amount]].map(([l,v],i)=>
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13}}><span style={{color:'var(--t3)'}}>{l}</span><span>{Number(v||0).toFixed(2)}</span></div>)}
          <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13}}><span style={{color:'var(--t3)'}}>{t('deductions')}</span><span style={{color:'var(--red)'}}>-{Number(s.deductions||0).toFixed(2)}</span></div>
          {dd&&(dd.lateDays>0||dd.absentDays>0)&&<div style={{fontSize:11,color:'var(--t4)',paddingBottom:4}}>
            {dd.lateDays>0&&<span style={{color:'var(--amber)'}}>{dd.lateDays} {t('dLate')} </span>}
            {dd.absentDays>0&&<span style={{color:'var(--red)'}}>{dd.absentDays} {t('dAbsent')}</span>}
          </div>}
          <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',fontSize:16,fontWeight:800,borderTop:'1px solid var(--border)',marginTop:4}}><span>{t('net')}</span><span style={{color:'var(--green)'}}>{Number(s.net_amount||0).toFixed(2)}</span></div>
        </div>
      </div>}):<div className="pwa-empty"><div className="pwa-empty-icon">💰</div><h3>{t('noData')}</h3></div>}
  </div>;
}

function MorePage(){
  const{t,ar,user,th,toggleTh,toggleLc,logout,cfg}=useApp();const emp=user?.employee;const[sub,sSub]=useState('profile');
  if(!emp)return <div className="pwa-loading"><span className="pwa-spinner"/></div>;
  return <div className="pwa-page">
    <div style={{display:'flex',gap:8,marginBottom:16}}>
      {[['profile',t('profile')],['settings',t('settings')]].map(([k,l])=>
        <button key={k} onClick={()=>sSub(k)} style={{flex:1,padding:'8px 14px',borderRadius:20,border:'1px solid '+(sub===k?'var(--accent)':'var(--border)'),background:sub===k?'var(--accent-g)':'var(--bg-2)',color:sub===k?'var(--accent-h)':'var(--t2)',fontSize:13,fontWeight:600,cursor:'pointer'}}>{l}</button>)}
    </div>
    {sub==='profile'&&<>
      <div style={{textAlign:'center',marginBottom:20}}><div style={{width:64,height:64,borderRadius:'50%',background:'var(--accent)',margin:'0 auto 10px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:24}}>{(emp.first_name||emp.full_name||'?')[0]}</div>
        <div style={{fontSize:18,fontWeight:800}}>{emp.full_name}</div><div style={{fontSize:12,color:'var(--t3)'}}>{emp.position_name} · {emp.department_name}</div></div>
      <div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
        {[[t('name'),emp.full_name],[t('empNo'),emp.employee_no],[t('mobile'),emp.mobile],[t('email'),emp.work_email],[t('dept'),emp.department_name],[t('pos'),emp.position_name]].concat(cfg?.showBadge?[[t('badge'),emp.badge_id]]:[]).map(([l,v],i)=>
          <div key={i} style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:12,color:'var(--t3)'}}>{l}</span><span style={{fontSize:13,fontWeight:600,fontFamily:l===t('badge')?'monospace':'inherit'}}>{v||'—'}</span></div>)}
      </div>
      {cfg?.showBadge&&emp.badge_id&&<div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:16,padding:20,textAlign:'center',marginTop:12}}>
        <div style={{width:140,height:140,margin:'0 auto 10px',background:'#fff',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',padding:10}}><div style={{fontFamily:'monospace',fontSize:10,color:'#000',wordBreak:'break-all',fontWeight:600}}>{emp.badge_id}</div></div>
        <div style={{fontSize:12,color:'var(--t3)'}}>{ar?'بطاقة الحضور':'Attendance Badge'}</div></div>}
    </>}
    {sub==='settings'&&<div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:14,fontWeight:600}}>{t('lang')}</div><div style={{fontSize:11,color:'var(--t3)'}}>{ar?'العربية':'English'}</div></div>
        <button style={{padding:'6px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-3)',color:'var(--t1)',cursor:'pointer',fontSize:13,fontWeight:600}} onClick={toggleLc}>{t('changeLang')}</button></div>
      <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:14,fontWeight:600}}>{t('theme')}</div><div style={{fontSize:11,color:'var(--t3)'}}>{th==='dark'?t('dark'):t('light')}</div></div>
        <button className={`pwa-toggle ${th==='dark'?'on':''}`} onClick={toggleTh}/></div>
      <button onClick={logout} style={{width:'100%',padding:'14px 16px',background:'var(--red-g)',color:'var(--red)',border:'none',fontSize:14,fontWeight:700,cursor:'pointer',textAlign:'center'}}>{t('logout')}</button>
    </div>}
  </div>;
}

function Tabs(){const{t,pg,sPg}=useApp();return <nav className="pwa-tab-bar">
  {[['home','🏠'],['att','📅'],['salary','💰'],['more','☰']].map(([id,ic])=>
    <button key={id} className={`pwa-tab ${pg===id?'ac':''}`} onClick={()=>sPg(id)}><span className="tab-icon">{ic}</span><span>{t(id)}</span></button>)}
</nav>}
// Error boundary — prevents a single screen's render error from blanking the whole app.
// Keyed by the active page so switching tabs clears the error and the nav always stays usable.
class ErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={err:null,key:p.resetKey};}
  static getDerivedStateFromError(err){return{err};}
  static getDerivedStateFromProps(props,state){
    if(props.resetKey!==state.key)return{err:null,key:props.resetKey};
    return null;
  }
  componentDidCatch(err,info){try{console.error('[employee-pwa] render error:',err,info);}catch(_){}}
  render(){
    if(this.state.err){
      const ar=(localStorage.getItem('emp_lc')||'ar')==='ar';
      return <div className="pwa-page" style={{textAlign:'center',padding:'48px 20px'}}>
        <div style={{fontSize:44,marginBottom:12}}>⚠️</div>
        <h3 style={{fontSize:16,fontWeight:800,marginBottom:8}}>{ar?'حدث خطأ غير متوقع':'Something went wrong'}</h3>
        <p style={{fontSize:13,color:'var(--t3)',marginBottom:16}}>{ar?'تعذّر عرض هذه الصفحة. جرّب قسماً آخر من الشريط السفلي أو أعد المحاولة.':'This page could not be displayed. Try another tab below, or reload.'}</p>
        <button className="pwa-btn" onClick={()=>window.location.reload()}>{ar?'إعادة المحاولة':'Reload'}</button>
      </div>;
    }
    return this.props.children;
  }
}
function Shell(){const{pg}=useApp();return <div className="pwa-shell"><div className="pwa-content"><ErrorBoundary resetKey={pg}>{pg==='home'&&<Home/>}{pg==='att'&&<Att/>}{pg==='salary'&&<Salary/>}{pg==='more'&&<MorePage/>}</ErrorBoundary></div><Tabs/></div>}
function App(){const{user,ld}=useApp();if(ld)return<div className="pwa-login"><div className="pwa-spinner" style={{width:32,height:32}}/></div>;if(!user)return<Login/>;return<Shell/>}

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
ReactDOM.createRoot(document.getElementById('app')).render(<Provider><App/></Provider>);

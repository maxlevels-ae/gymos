/* Gram Gym — Member PWA. Light-theme rebuild per design handoff. All data is real (backend), no fake/localStorage state. */
const{useState,useEffect,useCallback,useRef,createContext,useContext}=React;

const API=window.location.origin;
const defaultConfig={type:'member',enabled:true,appName:'Member Portal',appNameAr:'بوابة العضوية',subtitle:'Fitness Club',subtitleAr:'نادي اللياقة',accentColor:'#3b82f6',logoUrl:'',showQr:true,qrOpenEnabled:true,locale:'ar',dir:'rtl'};
function applyBranding(cfg){ try{ if(cfg.themeColor){const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#e8f0f8');} }catch(_){} }

// ── i18n (Arabic default; every user-facing string here) ──
const L={
  ar:{welcomeBack:'مرحباً بعودتك',daysLeft:'الأيام المتبقية',day:'يوم',status:'الحالة',active:'فعّال',activeSub:'اشتراك فعّال',gymNow:'الجيم حالياً',person:'شخص',quiet:'هادئ',medium:'متوسط',busy:'مزدحم',open:'مفتوح',closed:'مغلق',schedule:'المواعيد',opens:'يفتح',closes:'يغلق',
    streak:'أيام متتالية',water:'كأس ماء',weight:'الوزن',kg:'كجم',memberNo:'رقم العضوية',subType:'نوع الاشتراك',start:'البدء',end:'الانتهاء',paid:'المدفوع',remaining:'المتبقي',
    accessCard:'بطاقة الدخول',scanToOpen:'امسح لفتح الباب',lastEntry:'آخر دخول',checkin:'تسجيل دخول',never:'لا يوجد',today:'اليوم',
    autoRefresh:'رمز آمن يتجدد كل ٣٠ ثانية',inactive:'غير نشط',
    subscriptions:'الاشتراكات',training:'التدريب',nutrition:'التغذية',more:'المزيد',home:'الرئيسية',notifications:'الإشعارات',
    enableNotifs:'فعّل الإشعارات',enableNotifsSub:'نذكّرك قبل انتهاء اشتراكك بأسبوع',enable:'تفعيل',
    renew:'تجديد الاشتراك',balance:'الرصيد المتبقي',benefits:'مزايا الاشتراك',unlimited:'دخول غير محدود',programs:'برامج تدريبية',cafeDiscount:'خصم في الكافتيريا',trainerSessions:'جلسات مع المدرب',upgradePlans:'باقات الترقية',bestValue:'الأفضل قيمة',paymentHistory:'سجل المدفوعات',months:'أشهر',month:'شهر',noPayments:'لا توجد مدفوعات',
    todayProgress:'تقدم اليوم',exercises:'تمارين',sets:'سيتات',reps:'تكرار',restSec:'ث راحة',tapDone:'اضغط عند الانتهاء',done:'مكتمل',rest:'راحة',skip:'تخطي',add30:'+ ٣٠ ث',greatJob:'أحسنت!',workoutDone:'أكملت تمرين اليوم',noPlan:'لا يوجد برنامج تدريبي مخصّص',startTraining:'ابدأ التمرين',
    calories:'سعرة',caloriesToday:'سعرات اليوم',remainingCal:'المتبقي',dailyCalories:'السعرات اليومية',macros:'توزيع المغذيات',protein:'بروتين',carbs:'كربوهيدرات',fat:'دهون',meals:'الوجبات',addGlass:'أضف كأس (250 مل)',ml:'مل',glass:'كأس',mealDone:'مكتمل',mealUpcoming:'قادم',
    all:'الكل',markAllRead:'قراءة الكل',general:'عام',subscription:'الاشتراك',noNotifs:'لا توجد إشعارات',
    profile:'الملف',weightTab:'الوزن',freeze:'التجميد',settings:'الإعدادات',name:'الاسم',mobile:'الجوال',email:'البريد',gender:'الجنس',joined:'تاريخ الانضمام',height:'الطول',initialWeight:'الوزن الأولي',cm:'سم',editProfile:'تعديل الملف الشخصي',save:'حفظ',
    currentWeight:'الوزن الحالي',change:'التغيّر',lastUpdate:'آخر تحديث',logWeight:'سجّل وزنك',weightHistory:'سجل الأوزان',
    requestFreeze:'طلب تجميد',freezeReason:'السبب',freezeHistory:'طلبات التجميد',days2:'أيام',
    notifPrefs:'الإشعارات',prefSub:'تجديد الاشتراك',prefWorkout:'تمارين اليوم',prefMeals:'وجبات الطعام',prefWater:'شرب الماء',prefOffers:'العروض والأخبار',prefTrainer:'رسائل المدرب',
    appSettings:'إعدادات التطبيق',language:'اللغة',theme:'المظهر',logout:'تسجيل خروج',support:'الدعم والمساعدة',privacy:'سياسة الخصوصية',
    doorOpened:'تم إرسال أمر فتح الباب',doorFailed:'تعذّر فتح الباب',saved:'تم الحفظ',
    goalBulk:'تضخيم',goalCut:'تنشيف',goalMaintain:'محافظة',goalNone:'غير محدد',selectPlan:'اختر الاشتراك',
    login:'تسجيل الدخول',phone:'رقم الهاتف',sendOtp:'إرسال رمز التحقق',enterOtp:'أدخل الرمز',verify:'تحقّق',changeNo:'تغيير الرقم',otpSent:'تم إرسال الرمز إلى',reload:'إعادة المحاولة',errGeneric:'حدث خطأ. حاول مرة أخرى.'},
  en:{welcomeBack:'Welcome back',daysLeft:'Days left',day:'day',status:'Status',active:'Active',activeSub:'Active subscription',gymNow:'In the gym now',person:'people',quiet:'Quiet',medium:'Moderate',busy:'Busy',open:'Open',closed:'Closed',schedule:'Hours',opens:'Opens',closes:'Closes',
    streak:'Day streak',water:'Water',weight:'Weight',kg:'kg',memberNo:'Member No',subType:'Plan',start:'Start',end:'End',paid:'Paid',remaining:'Remaining',
    accessCard:'Access Card',scanToOpen:'Scan to open the door',lastEntry:'Last entry',checkin:'Check in',never:'None',today:'Today',
    autoRefresh:'Secure code — refreshes every 30s',inactive:'Inactive',
    subscriptions:'Subscriptions',training:'Training',nutrition:'Nutrition',more:'More',home:'Home',notifications:'Notifications',
    enableNotifs:'Enable notifications',enableNotifsSub:'We remind you before your subscription ends',enable:'Enable',
    renew:'Renew subscription',balance:'Balance',benefits:'Plan benefits',unlimited:'Unlimited access',programs:'Training programs',cafeDiscount:'Cafeteria discount',trainerSessions:'Trainer sessions',upgradePlans:'Upgrade plans',bestValue:'Best value',paymentHistory:'Payment history',months:'months',month:'month',noPayments:'No payments',
    todayProgress:'Today\'s progress',exercises:'exercises',sets:'sets',reps:'reps',restSec:'s rest',tapDone:'Tap when done',done:'Done',rest:'Rest',skip:'Skip',add30:'+ 30s',greatJob:'Great job!',workoutDone:'You finished today\'s workout',noPlan:'No training program assigned',startTraining:'Start workout',
    calories:'kcal',caloriesToday:'Calories today',remainingCal:'remaining',dailyCalories:'Daily calories',macros:'Macros',protein:'Protein',carbs:'Carbs',fat:'Fat',meals:'Meals',addGlass:'Add glass (250 ml)',ml:'ml',glass:'glass',mealDone:'Done',mealUpcoming:'Upcoming',
    all:'All',markAllRead:'Mark all read',general:'General',subscription:'Subscription',noNotifs:'No notifications',
    profile:'Profile',weightTab:'Weight',freeze:'Freeze',settings:'Settings',name:'Name',mobile:'Mobile',email:'Email',gender:'Gender',joined:'Joined',height:'Height',initialWeight:'Initial weight',cm:'cm',editProfile:'Edit profile',save:'Save',
    currentWeight:'Current weight',change:'Change',lastUpdate:'Last update',logWeight:'Log weight',weightHistory:'Weight history',
    requestFreeze:'Request freeze',freezeReason:'Reason',freezeHistory:'Freeze requests',days2:'days',
    notifPrefs:'Notifications',prefSub:'Subscription renewal',prefWorkout:'Today\'s workouts',prefMeals:'Meals',prefWater:'Water',prefOffers:'Offers & news',prefTrainer:'Trainer messages',
    appSettings:'App settings',language:'Language',theme:'Theme',logout:'Logout',support:'Support & help',privacy:'Privacy policy',
    doorOpened:'Door open command sent',doorFailed:'Could not open the door',saved:'Saved',
    goalBulk:'Bulk',goalCut:'Cut',goalMaintain:'Maintain',goalNone:'Not set',selectPlan:'Select subscription',
    login:'Sign in',phone:'Phone number',sendOtp:'Send code',enterOtp:'Enter code',verify:'Verify',changeNo:'Change',otpSent:'Code sent to',reload:'Retry',errGeneric:'Something went wrong. Please try again.'}
};

// ── api ──
const api={token:localStorage.getItem('mem_token')||null,
  async r(p,o={}){const h={'Content-Type':'application/json'};if(this.token)h['Authorization']='Bearer '+this.token;const r=await fetch(API+p,{...o,headers:{...h,...(o.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok){const err=new Error(d.error||'Failed');err.code=d.code;err.status=r.status;throw err;}return d;},
  get:p=>api.r(p),post:(p,b)=>api.r(p,{method:'POST',body:JSON.stringify(b||{})}),put:(p,b)=>api.r(p,{method:'PUT',body:JSON.stringify(b||{})})};

// ── Web Push: subscribe this device so notifications reach the phone (lock screen / app closed) ──
function urlB64ToUint8Array(base64){const pad='='.repeat((4-base64.length%4)%4);const s=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(s);const arr=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);return arr;}
async function enablePush(){
  try{
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined')return{ok:false,reason:'unsupported'};
    let perm=Notification.permission;
    if(perm==='default')perm=await Notification.requestPermission();
    if(perm!=='granted')return{ok:false,reason:perm};
    const reg=await navigator.serviceWorker.ready;
    const vr=await api.get('/api/pwa/member/push/vapid').catch(()=>null);
    const pub=vr&&vr.data&&vr.data.publicKey;
    if(!pub)return{ok:false,reason:'no-vapid'};
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64ToUint8Array(pub)});
    await api.post('/api/pwa/member/push/subscribe',{subscription:sub.toJSON?sub.toJSON():sub});
    return{ok:true};
  }catch(e){return{ok:false,reason:(e&&e.message)||'error'};}
}

function otpErrMsg(e,ar){const c=e&&e.code,s=e&&e.status;if(c==='OTP_DELIVERY_FAILED')return ar?'تعذّر إرسال رمز التحقق حالياً. حاول مرة أخرى بعد قليل أو تواصل مع الصالة.':'Could not send the verification code right now. Please try again shortly or contact the gym.';if(s===404)return ar?'لا يوجد عضو مسجّل بهذا الرقم.':'No member is registered with this phone number.';if(s===429)return ar?'محاولات كثيرة. يرجى المحاولة بعد قليل.':'Too many attempts. Please try again later.';return (e&&e.message)||(ar?'حدث خطأ. حاول مرة أخرى.':'Something went wrong.');}
function fmtD(v){if(!v)return'—';const s=String(v).split('T')[0].split(' ')[0];let m=s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);if(m)return m[3]+'-'+m[2]+'-'+m[1];m=s.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);if(m)return m[1]+'-'+m[2]+'-'+m[3];return s;}
const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function fmtNiceDate(v,ar){const s=fmtD(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return s;const day=+m[3],mon=+m[2]-1,y=m[1];if(ar)return `${day} ${AR_MONTHS[mon]||''} ${y}`;const en=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${day} ${en[mon]} ${y}`;}
function genderLabel(g,ar){if(!g)return'—';if(g==='female')return ar?'أنثى':'Female';if(g==='male')return ar?'ذكر':'Male';return g;}
function relTime(v,ar){if(!v)return'';let str=String(v).replace(' ','T');if(!/[zZ]|[+\-]\d\d:?\d\d$/.test(str))str+='Z';const then=new Date(str).getTime();if(isNaN(then))return fmtD(v);const diff=Math.max(0,Date.now()-then),min=Math.floor(diff/60000),hr=Math.floor(min/60),day=Math.floor(hr/24),wk=Math.floor(day/7);
  if(ar){if(min<1)return'الآن';if(min<60)return min===1?'منذ دقيقة':min===2?'منذ دقيقتين':`منذ ${min} دقيقة`;if(hr<24)return hr===1?'منذ ساعة':hr===2?'منذ ساعتين':`منذ ${hr} ساعات`;if(day===1)return'أمس';if(day<7)return `منذ ${day} أيام`;if(wk===1)return'منذ أسبوع';if(day<30)return `منذ ${wk} أسابيع`;return fmtNiceDate(v,true);}
  if(min<1)return'now';if(min<60)return `${min}m ago`;if(hr<24)return `${hr}h ago`;if(day===1)return'yesterday';if(day<7)return `${day}d ago`;if(wk===1)return'1 week ago';if(day<30)return `${wk} weeks ago`;return fmtNiceDate(v,false);}
function arN(n,ar){if(!ar)return String(n);return String(n).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[+d]);}
function greetingText(ar){const h=new Date().getHours();if(ar)return h<12?'صباح الخير':h<17?'مساء الخير':'مساء النور';return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
function to12(hm,ar){const p=String(hm||'0:0').split(':');const H=+p[0],M=+p[1]||0;const am=H<12;let h=H%12;if(h===0)h=12;const tt=`${h}:${String(M).padStart(2,'0')}`;return ar?(tt+(am?' ص':' م')):(tt+(am?' AM':' PM'));}
function splitName(fn){const parts=String(fn||'').trim().split(/\s+/).filter(Boolean);if(parts.length<=1)return[fn||'—',''];return[parts.slice(0,-1).join(' '),parts[parts.length-1]];}
const AR_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function arFullDate(ar){const d=new Date();if(ar)return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;const en=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const ed=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];return `${ed[d.getDay()]} ${d.getDate()} ${en[d.getMonth()]} ${d.getFullYear()}`;}
function goalLabel(g,ar){const m={bulk:['تضخيم','Bulk'],cut:['تنشيف','Cut'],maintain:['محافظة','Maintain']};const v=m[String(g||'').toLowerCase()];return v?(ar?v[0]:v[1]):'';}
const PLAN_FEAT={unlimited_access:['دخول غير محدود','Unlimited access'],group_classes:['حصص جماعية','Group classes'],personal_trainer:['مدرب شخصي','Personal trainer'],nutrition_plan:['خطة غذائية','Nutrition plan'],cafeteria_discount:['خصم الكافتيريا','Cafeteria discount'],pool_access:['دخول المسبح','Pool access'],sauna_spa:['ساونا وسبا','Sauna & spa'],locker:['خزانة شخصية','Personal locker'],guest_passes:['تذاكر ضيوف','Guest passes'],towel_service:['خدمة المناشف','Towel service'],inbody:['تحليل InBody','InBody analysis'],classes_booking:['حجز الحصص','Class booking']};
function featLabel(v,ar){const e=PLAN_FEAT[v];return e?(ar?e[0]:e[1]):String(v||'');}
function levelLabel(l,ar){const m={beginner:['مبتدئ','Beginner'],intermediate:['متوسط','Intermediate'],advanced:['متقدم','Advanced'],expert:['متقدم','Advanced']};const v=m[String(l||'').toLowerCase()];return v?(ar?v[0]:v[1]):(l||'');}
const MUSCLE_AR={chest:'الصدر',back:'الظهر',legs:'الأرجل',shoulders:'الأكتاف',arms:'الذراعين',triceps:'الترايسبس',biceps:'البايسبس',core:'الجذع',abs:'البطن',cardio:'كارديو',glutes:'المؤخرة',hamstrings:'خلف الفخذ',quads:'الفخذ',calves:'السمانة',forearms:'الساعد',traps:'الترابيس',lats:'الظهر العلوي'};
function muscleAr(mg,ar){if(!mg)return'';if(!ar)return mg;return String(mg).split(/[,،]/).map(s=>{const k=s.trim().toLowerCase();return MUSCLE_AR[k]||s.trim();}).filter(Boolean).join(' · ');}
const AR_DAYS_SHORT=['أحد','إثن','ثلا','أرب','خمس','جمع','سبت'];
function durLabel(days,ar){const m=Math.round((Number(days)||0)/30);if(!ar)return m<=1?'1 month':`${m} months`;if(m<=1)return'شهر';if(m===2)return'شهرين';if(m<=10)return`${arN(m,true)} أشهر`;return`${arN(m,true)} شهراً`;}

// ── QR ──
function QrCanvas({value,size=160}){const ref=useRef(null);useEffect(()=>{const el=ref.current;if(!el)return;const QR=window.QRCode;if(value&&QR&&QR.toCanvas){QR.toCanvas(el,String(value),{width:size,margin:1,color:{dark:'#1d4ed8',light:'#ffffff'}},()=>{});}else{const c=el.getContext&&el.getContext('2d');if(c){c.clearRect(0,0,el.width,el.height);c.fillStyle='#fff';c.fillRect(0,0,el.width,el.height);}}},[value,size]);return <canvas ref={ref} width={size} height={size} style={{width:size,height:size,display:'block'}}/>;}

// ── Icon set (Lucide-style) ──
const IC={bell:'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9;M13.73 21a2 2 0 0 1-3.46 0',users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2;M9 7 a4 4 0 1 0 0.001 0;M23 21v-2a4 4 0 0 0-3-3.87;M16 3.13a4 4 0 0 1 0 7.75',bolt:'M13 2 L3 14 h9 l-1 8 l10-12 h-9 z',drop:'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z',shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',clock:'M12 6v6l4 2;M12 3a9 9 0 1 0 0.001 0',cal:'M3 4h18v18H3z;M16 2v4;M8 2v4;M3 10h18',dumbbell:'M6.5 6.5 17.5 17.5;M21 21 20 20;M3 3 4 4;M18 22 22 18;M2 6 6 2;M3 10 10 3;M14 21 21 14',check:'M20 6 9 17l-5-5',door:'M13 4h3a2 2 0 0 1 2 2v14M2 20h20M14 12v.01M13 20V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16',flame:'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',plus:'M12 5v14M5 12h14',minus:'M5 12h14',chevron:'M9 18l6-6-6-6',chevronD:'M6 9l6 6 6-6',back:'M5 12h14M12 5l7 7-7 7',user:'M12 12 a4 4 0 1 0 0.001 0;M4 20c0-4 3.6-7 8-7s8 3 8 7',utensils:'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2;M7 2v20;M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7',activity:'M22 12h-4l-3 9L9 3l-3 9H2',trophy:'M6 9H4.5a2.5 2.5 0 0 1 0-5H6;M18 9h1.5a2.5 2.5 0 0 0 0-5H18;M4 22h16;M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22;M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22;M18 2H6v7a6 6 0 0 0 12 0V2z',logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4;M16 17l5-5-5-5;M21 12H9',help:'M12 17h.01;M12 3a9 9 0 1 0 0.001 0;M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',lock:'M5 11h14v10H5z;M8 11V7a4 4 0 0 1 8 0v4',card:'M2 7 h20 v10 h-20 z;M2 11 h20',dollar:'M12 1v22;M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',refresh:'M23 4v6h-6;M20.49 15a9 9 0 1 1-2.12-9.36L23 10',edit:'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7;M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'};
function Icon({name,size=20,color='currentColor',w=2,style}){const p=(IC[name]||'').split(';');return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style}>{p.map((d,i)=><path key={i} d={d}/>)}</svg>;}

// ── theme colors ──
const C={blue:'#3b82f6',blueD:'#1d4ed8',purple:'#8b5cf6',orange:'#f97316',teal:'#14b8a6',green:'#22c55e',red:'#ef4444',indigo:'#6366f1',t1:'#0f172a',t2:'#475569',t3:'#94a3b8',t4:'#cbd5e1',surf:'#ffffff',sub:'#f8fafc',bg:'#e8f0f8',nav:'#1e293b',line:'#e2e8f0'};
const card={background:C.surf,borderRadius:18,boxShadow:'0 2px 10px rgba(0,0,0,0.06)'};
const Ctx=createContext();const useApp=()=>useContext(Ctx);

function Provider({children}){
  const[lc,sLc]=useState(localStorage.getItem('mem_lc')||'ar');
  const[user,sUser]=useState(null);const[ld,sLd]=useState(true);const[pg,sPg]=useState('home');const[cfg,sCfg]=useState(defaultConfig);
  const[revealed,setRevealed]=useState(false); // flips true when the splash finishes → screens animate in
  const t=useCallback(k=>L[lc]?.[k]||L.en[k]||k,[lc]);const ar=lc==='ar';
  const refreshDashboard=useCallback(async(tok)=>{const old=api.token;if(tok)api.token=tok;try{const r=await api.get('/api/pwa/member/dashboard');sUser(r.data);return r.data;}finally{if(tok)api.token=tok||old;}},[]);
  useEffect(()=>{fetch(API+'/api/pwa/config/member').then(r=>r.json()).then(r=>{const n={...defaultConfig,...(r.data||{})};sCfg(n);applyBranding(n);if(!localStorage.getItem('mem_lc'))sLc((n.locale||'ar')==='en'?'en':'ar');}).catch(()=>applyBranding(defaultConfig));},[]);
  useEffect(()=>{document.documentElement.lang=lc;document.documentElement.dir=ar?'rtl':'ltr';localStorage.setItem('mem_lc',lc);},[lc,ar]);
  useEffect(()=>{if(!api.token){sLd(false);return}refreshDashboard().then(()=>sLd(false)).catch(()=>{api.token=null;localStorage.removeItem('mem_token');sLd(false);})},[refreshDashboard]);
  const login=async(tok)=>{api.token=tok;localStorage.setItem('mem_token',tok);await refreshDashboard(tok);};
  const logout=()=>{api.token=null;localStorage.removeItem('mem_token');sUser(null);sPg('home');};
  return <Ctx.Provider value={{lc,ar,t,user,sUser,ld,pg,sPg,login,logout,toggleLc:()=>sLc(p=>p==='ar'?'en':'ar'),cfg,refreshDashboard,revealed,setRevealed}}>{children}</Ctx.Provider>;
}

// ── Login ──
function Login(){
  const{t,ar,login,cfg}=useApp();
  const[ph,sPh]=useState('');const[otp,sOtp]=useState('');const[step,sStep]=useState(1);const[busy,sBusy]=useState(false);const[err,sErr]=useState('');const[info,sInfo]=useState('');
  const send=async()=>{if(!ph.trim())return;sBusy(true);sErr('');sInfo('');try{const r=await api.post('/api/auth/otp/send',{phone:ph.trim(),type:'member'});if(r.data?.dev_otp)sOtp(r.data.dev_otp);sInfo(`${t('otpSent')} ${r.data?.maskedPhone||''}`.trim());sStep(2);}catch(e){sErr(otpErrMsg(e,ar))}finally{sBusy(false)}};
  const verify=async()=>{if(!otp.trim())return;sBusy(true);sErr('');try{const r=await api.post('/api/auth/otp/verify',{phone:ph.trim(),otp:otp.trim(),type:'member'});await login(r.data.token);}catch(e){sErr(otpErrMsg(e,ar))}finally{sBusy(false)}};
  const nm=ar?(cfg.appNameAr||'Gram Gym'):(cfg.appName||'Gram Gym');
  return <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',justifyContent:'center',padding:'24px',maxWidth:440,margin:'0 auto'}}>
    <div style={{textAlign:'center',marginBottom:28}}>
      <div style={{width:76,height:76,borderRadius:22,background:'linear-gradient(135deg,#14b8a6,#3b82f6)',margin:'0 auto 14px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:30,boxShadow:'0 8px 24px rgba(59,130,246,0.35)'}}>{cfg.logoUrl?<img src={cfg.logoUrl} style={{width:44,height:44,objectFit:'contain'}}/>:(nm[0]||'G')}</div>
      <h1 style={{fontSize:24,fontWeight:900,color:C.t1}}>{nm}</h1>
      <p style={{fontSize:13,color:C.t3,marginTop:4}}>{ar?(cfg.subtitleAr||'عضوية المشتركين'):(cfg.subtitle||'Member portal')}</p>
    </div>
    {err&&<div style={{background:'#fef2f2',color:C.red,padding:'11px 14px',borderRadius:12,fontSize:13,marginBottom:14,textAlign:'center'}}>{err}</div>}
    {info&&<div style={{background:'#f0fdf4',color:C.green,padding:'11px 14px',borderRadius:12,fontSize:13,marginBottom:14,textAlign:'center'}}>{info}</div>}
    {step===1?<>
      <label style={{fontSize:12,fontWeight:600,color:C.t2,marginBottom:6,display:'block'}}>{t('phone')}</label>
      <input value={ph} onChange={e=>sPh(e.target.value)} type="tel" dir="ltr" placeholder="07XXXXXXXX" autoFocus style={inp}/>
      <button onClick={send} disabled={busy} style={btnP}>{busy?'...':t('sendOtp')}</button>
    </>:<>
      <label style={{fontSize:12,fontWeight:600,color:C.t2,marginBottom:6,display:'block'}}>{t('enterOtp')}</label>
      <input value={otp} onChange={e=>sOtp(e.target.value)} type="text" inputMode="numeric" maxLength={6} dir="ltr" placeholder="000000" autoFocus style={{...inp,textAlign:'center',fontSize:26,letterSpacing:12,fontWeight:800}}/>
      <button onClick={verify} disabled={busy} style={btnP}>{busy?'...':t('verify')}</button>
      <button onClick={()=>sStep(1)} style={{...btnP,background:'transparent',color:C.t2,boxShadow:'none',marginTop:6}}>{t('changeNo')}</button>
    </>}
  </div>;
}
const inp={width:'100%',background:C.surf,border:'1px solid '+C.line,borderRadius:14,padding:'14px 16px',fontSize:15,fontFamily:'inherit',color:C.t1,outline:'none'};
const btnP={width:'100%',background:'linear-gradient(135deg,#2563eb,#3b82f6)',color:'#fff',border:'none',borderRadius:16,padding:'15px',fontSize:15,fontWeight:700,fontFamily:'inherit',marginTop:14,cursor:'pointer',boxShadow:'0 6px 20px rgba(59,130,246,0.35)'};

// ── shared bits ──
function Screen({children}){
  const ref=React.useRef(null);
  const{revealed}=useApp();
  React.useEffect(()=>{
    if(!revealed) return; // hold until the splash finishes so the entrance is actually seen
    const el=ref.current; if(!el) return;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Collect the real "cards": a stack container (flex-column / grid) contributes its children,
    // so each card animates individually instead of the whole block moving as one.
    const targets=[];
    for(const child of el.children){
      let cs; try{ cs=getComputedStyle(child); }catch(_){ cs=null; }
      const stack = cs && child.children.length>=2 && (cs.display==='grid' || (cs.display==='flex' && cs.flexDirection==='column'));
      if(stack){ for(const g of child.children) targets.push(g); } else targets.push(child);
    }
    const run=()=>{ targets.forEach((node,i)=>{
      try{ node.animate([{opacity:0,transform:'translateX(40px)'},{opacity:1,transform:'translateX(0)'}],
        {duration:560,delay:60+i*85,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}); }catch(_){}
    }); };
    requestAnimationFrame(run);
  },[revealed]);
  return <div style={{minHeight:'100vh',background:C.bg,maxWidth:440,margin:'0 auto',position:'relative'}}><div ref={ref} style={{overflowY:'auto',paddingBottom:100}}>{children}</div></div>;
}
function StatusPill({level,t}){const map={quiet:[C.green,'#f0fdf4',t('quiet')],medium:[C.orange,'#fff7ed',t('medium')],busy:[C.red,'#fef2f2',t('busy')]};const[col,bg,lbl]=map[level]||map.quiet;return <span style={{background:bg,color:col,fontSize:11,fontWeight:700,padding:'5px 12px',borderRadius:100}}>{lbl}</span>;}
function Prog({pct,color,bg='#eef2f7',h=6}){return <div style={{background:bg,borderRadius:100,height:h,overflow:'hidden'}}><div style={{width:Math.max(0,Math.min(100,pct))+'%',height:'100%',background:color,borderRadius:100,transition:'width .8s cubic-bezier(.22,1,.36,1)'}}/></div>;}

// ═══════════════════════ HOME ═══════════════════════
// Rotating QR access card. Fetches a server-minted token (HMAC secret stays on
// the server) and re-fetches at each ~30s window rollover. Falls back to the
// static qr_code when the C3 bridge secret isn't configured yet.
function AccessCard({user,access}){
  const{t,ar}=useApp();
  const[tk,sTk]=useState(null);
  const timer=useRef(null);
  const load=useCallback(async()=>{
    try{
      const r=await api.get('/api/pwa/member/access/token');
      sTk(r.data||{configured:false});
      const ms=Math.max(2000,Number(r.data&&r.data.refreshInMs||30000)+600);
      clearTimeout(timer.current);timer.current=setTimeout(load,ms);
    }catch(_){clearTimeout(timer.current);timer.current=setTimeout(load,15000);}
  },[]);
  useEffect(()=>{load();return()=>clearTimeout(timer.current);},[load]);

  const rotating=!!(tk&&tk.configured);
  const qrValue=rotating?tk.qrValue:(user&&user.qr_code)||'';
  if(!qrValue)return null;
  const eligible=rotating?tk.eligible!==false:true;
  const label=rotating?(tk.mode==='code24'?String(tk.code24):tk.token):qrValue;
  const lastLog=access&&access.logs&&access.logs[0];
  return <div style={{...card,borderRadius:24,padding:20}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
      <div><p style={{fontSize:15,fontWeight:700,color:C.t1}}>{t('accessCard')}</p><p style={{fontSize:11.5,color:C.t3,marginTop:2}}>{t('scanToOpen')}</p></div>
      {eligible
        ? <span style={{display:'flex',alignItems:'center',gap:6,background:'#f0fdfa',color:C.teal,fontSize:11,fontWeight:700,padding:'5px 12px',borderRadius:100}}><span style={{width:6,height:6,borderRadius:50,background:C.teal}}/>{t('active')}</span>
        : <span style={{display:'flex',alignItems:'center',gap:6,background:'#fef2f2',color:C.red,fontSize:11,fontWeight:700,padding:'5px 12px',borderRadius:100}}><span style={{width:6,height:6,borderRadius:50,background:C.red}}/>{t('inactive')}</span>}
    </div>
    <div style={{background:'#fff',borderRadius:16,padding:16,display:'flex',justifyContent:'center',border:'1px solid '+C.sub,position:'relative'}}>
      <QrCanvas value={qrValue} size={160}/>
    </div>
    <p style={{textAlign:'center',fontFamily:'monospace',fontSize:11,color:C.t3,marginTop:10,letterSpacing:'0.05em'}}>{label}</p>
    {rotating&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:6,color:C.teal,fontSize:11,fontWeight:600}}><Icon name="refresh" size={12} color={C.teal}/><span>{t('autoRefresh')}</span></div>}
    <div style={{display:'flex',alignItems:'center',gap:7,marginTop:8,color:C.t3,fontSize:12}}><Icon name="clock" size={14} color={C.t3}/><span>{t('lastEntry')}: {lastLog?(fmtD(lastLog.check_in)+' '+(String(lastLog.check_in).split(' ')[1]||'').slice(0,5)):t('never')}</span></div>
  </div>;
}

function Home(){
  const{t,ar,user,sPg,cfg,refreshDashboard}=useApp();
  const[gym,sGym]=useState(null);const[water,sWater]=useState(null);const[wt,sWt]=useState(null);const[streak,sStreak]=useState(0);const[unread,sUnread]=useState(0);const[showSched,sSched]=useState(false);const[access,sAccess]=useState(null);
  const[notifPerm,sNotifPerm]=useState(typeof Notification!=='undefined'?Notification.permission:'denied');
  const reqNotif=async()=>{try{const r=await enablePush();if(typeof Notification!=='undefined')sNotifPerm(Notification.permission);if(r&&r.ok){try{await api.post('/api/pwa/member/push/test',{});}catch(_){}}}catch(_){}};
  useEffect(()=>{
    api.get('/api/pwa/member/gym-status').then(r=>sGym(r.data)).catch(()=>{});
    api.get('/api/pwa/member/water').then(r=>sWater(r.data)).catch(()=>{});
    api.get('/api/pwa/member/weight').then(r=>sWt(r.data)).catch(()=>{});
    api.get('/api/pwa/member/notifications/unread-count').then(r=>sUnread(r.data.count||0)).catch(()=>{});
    api.get('/api/pwa/member/access').then(r=>sAccess(r.data)).catch(()=>{});
    api.get('/api/pwa/member/workout-log?days=90').then(r=>sStreak(calcStreak(r.data||[]))).catch(()=>{});
    // If the member already granted notifications, make sure this device is subscribed for push.
    if(typeof Notification!=='undefined'&&Notification.permission==='granted')enablePush().catch(()=>{});
  },[]);
  const m=user?.member||user||{};const ms=user?.membership||{};
  const daysLeft=Number(user?.daysLeft??ms.days_remaining??0);
  const totalDays=Number(ms.total_days|| (ms.start_date&&ms.end_date? Math.round((new Date(fmtD(ms.end_date))-new Date(fmtD(ms.start_date)))/86400000):90))||90;
  const elapsed=Math.max(0,totalDays-daysLeft);const pct=totalDays?Math.round(elapsed/totalDays*100):0;
  const fn=[m.first_name,m.middle_name,m.last_name].filter(Boolean).join(' ')||m.full_name||'';
  const gymLevel=gym?.level||'quiet';
  const openDoor=async()=>{try{await api.post('/api/pwa/member/access/open',{});toast(t('doorOpened'));sAccess(a=>({...a}));api.get('/api/pwa/member/access').then(r=>sAccess(r.data)).catch(()=>{});}catch(e){toast(e.message||t('doorFailed'),'e')}};
  return <Screen>
    {/* Header */}
    <div style={{padding:'16px 20px 0',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
      <div><p style={{fontSize:13,color:C.t3,fontWeight:500,marginBottom:3}}>{greetingText(ar)}</p><h1 style={{fontSize:21,fontWeight:800,color:C.t1,lineHeight:1.2,letterSpacing:'-0.02em'}}>{splitName(fn)[0]}{splitName(fn)[1]?<><br/>{splitName(fn)[1]}</>:null}</h1></div>
      <div style={{display:'flex',gap:9,marginTop:4}}>
        <button onClick={()=>sPg('notifs')} style={{width:40,height:40,borderRadius:14,background:C.surf,border:'none',boxShadow:'0 2px 10px rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',cursor:'pointer'}}><Icon name="bell" size={17} color={C.t2}/>{unread>0&&<span style={{position:'absolute',top:7,right:7,minWidth:8,height:8,background:C.red,borderRadius:50,border:'2px solid '+C.bg}}/>}</button>
        <div style={{width:40,height:40,borderRadius:14,background:'linear-gradient(135deg,#14b8a6,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:17,color:'#fff',boxShadow:'0 4px 14px rgba(59,130,246,0.35)',animation:'floatY 3s ease-in-out infinite'}}>{(fn[0]||'؟')}</div>
      </div>
    </div>
    <div style={{padding:'0 16px',display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#1d4ed8 0%,#3b82f6 50%,#60a5fa 100%)',borderRadius:26,padding:22,position:'relative',overflow:'hidden',boxShadow:'0 8px 28px rgba(59,130,246,0.35)'}}>
        <div style={{position:'absolute',top:-30,insetInlineStart:-30,width:130,height:130,borderRadius:'50%',background:'rgba(255,255,255,0.07)'}}/>
        <div style={{position:'relative'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}><span style={{width:6,height:6,borderRadius:50,background:'#4ade80',animation:'beat 1.8s infinite'}}/><span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.85)'}}>{t('activeSub')}</span></div>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:18}}>
            <div><p style={{fontSize:13,color:'rgba(255,255,255,0.65)',marginBottom:4}}>{t('daysLeft')}</p><div style={{display:'flex',alignItems:'baseline',gap:6}}><span style={{fontSize:64,fontWeight:900,color:'#fff',lineHeight:1,letterSpacing:'-0.05em',animation:'numIn 0.6s cubic-bezier(0.22,1,0.36,1) both'}}>{daysLeft}</span><span style={{fontSize:16,color:'rgba(255,255,255,0.65)'}}>{t('day')}</span></div></div>
            <div style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:12,padding:'10px 16px',textAlign:'center'}}><p style={{fontSize:10,color:'rgba(255,255,255,0.6)',marginBottom:2}}>{t('status')}</p><p style={{fontSize:18,fontWeight:800,color:'#4ade80'}}>{t('active')}</p></div>
          </div>
          <Prog pct={pct} color="linear-gradient(90deg,rgba(255,255,255,0.9),rgba(255,255,255,0.6))" bg="rgba(255,255,255,0.12)" h={5}/>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}><span style={{fontSize:10.5,color:'rgba(255,255,255,0.6)'}}>{arN(elapsed,ar)} {t('day')} {ar?'مضى':'elapsed'}</span><span style={{fontSize:10.5,color:'rgba(255,255,255,0.9)',fontWeight:700}}>{arN(totalDays,ar)} {t('day')} {ar?'إجمالاً':'total'}</span></div>
        </div>
      </div>
      {/* Notification enable banner */}
      {notifPerm==='default'&&<div style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)',borderRadius:18,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 4px 14px rgba(99,102,241,0.3)'}}>
        <div style={{width:38,height:38,borderRadius:12,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="bell" size={18} color="#fff" w={2.5}/></div>
        <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700,color:'#fff',marginBottom:2}}>{t('enableNotifs')}</p><p style={{fontSize:11,color:'rgba(255,255,255,0.75)'}}>{t('enableNotifsSub')}</p></div>
        <button onClick={reqNotif} style={{background:'#fff',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:'#6366f1',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>{t('enable')}</button>
      </div>}
      {/* Gym capacity */}
      {gym&&<div style={{...card,padding:'14px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
          <div style={{width:44,height:44,borderRadius:14,background:C.sub,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="users" size={20} color={C.t2}/></div>
          <div style={{flex:1}}><p style={{fontSize:11,color:C.t3,fontWeight:600,marginBottom:3}}>{t('gymNow')}</p><p style={{fontSize:16,fontWeight:800,color:C.t1}}>{gym.currentIn} {t('person')}</p></div>
          <StatusPill level={gymLevel} t={t}/>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:C.sub,borderRadius:12,padding:'10px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flex:1}}><span style={{width:8,height:8,borderRadius:50,background:gym.isOpen?C.green:C.red,flexShrink:0}}/><span style={{fontSize:13,fontWeight:700,color:gym.isOpen?C.green:C.red}}>{gym.isOpen?(ar?'مفتوح الآن':'Open now'):(ar?'مغلق الآن':'Closed now')}</span><span style={{fontSize:12,color:C.t3}}>· {gym.isOpen?(ar?'يغلق الساعة':'closes at'):(ar?'يفتح الساعة':'opens at')} {to12(gym.isOpen?gym.closeTime:gym.openTime,ar)}</span></div>
          <button onClick={()=>sSched(true)} style={{background:'#fff',border:'1px solid '+C.line,borderRadius:10,padding:'6px 12px',fontSize:11.5,fontWeight:600,color:C.t2,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}><Icon name="clock" size={13} color={C.t2}/>{t('schedule')}</button>
        </div>
      </div>}
      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
        <StatTile icon="flame" color="#eab308" bg="#fefce8" val={streak} label={t('streak')} onClick={()=>sPg('train')}/>
        <StatTile icon="drop" color={C.blue} bg="#eff6ff" val={(water?.glasses??0)} label={t('water')} onClick={()=>sPg('nutrition')}/>
        <StatTile icon="shield" color={C.green} bg="#f0fdf4" val={wt?.current?wt.current+'':'—'} label={t('weight')} onClick={()=>sPg('more')}/>
      </div>
      {/* Member ID + details */}
      <div style={{...card,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',paddingBottom:12,borderBottom:'1px solid '+C.sub}}>
          <div><p style={{fontSize:11,color:C.t3,marginBottom:3}}>{t('memberNo')}</p><p style={{fontSize:15,fontWeight:800,color:C.t1}}>{m.member_no||'—'}</p></div>
          <div style={{textAlign:'end'}}><p style={{fontSize:11,color:C.t3,marginBottom:3}}>{t('subType')}</p><span style={{background:'#eef2ff',color:C.indigo,fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:10}}>{ms.plan_name||ms.plan_display||'—'}</span></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
          <Detail icon="check" color={C.green} label={t('start')} val={fmtNiceDate(ms.start_date,ar)}/>
          <Detail icon="clock" color={C.orange} label={t('end')} val={fmtNiceDate(ms.end_date,ar)}/>
          <Detail icon="cal" color={C.teal} label={t('paid')} val={Number(ms.paid_amount||ms.total_paid||0).toFixed(2)}/>
          <Detail icon="cal" color={C.t3} label={t('remaining')} val={Number(ms.balance_amount||ms.balance_due||0).toFixed(2)}/>
        </div>
      </div>
      {/* QR access — rotating token, server-minted */}
      {cfg.showQr&&user&&<AccessCard user={user} access={access}/>}
      {/* Quick tiles */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
        <QuickTile grad="linear-gradient(135deg,#2563eb,#3b82f6)" icon="cal" label={t('subscriptions')} onClick={()=>sPg('subs')}/>
        <QuickTile grad="linear-gradient(135deg,#7c3aed,#8b5cf6)" icon="dumbbell" label={t('training')} onClick={()=>sPg('train')}/>
        <QuickTile grad="linear-gradient(135deg,#ea580c,#f97316)" icon="utensils" label={t('nutrition')} onClick={()=>sPg('nutrition')}/>
      </div>
    </div>
    {showSched&&gym&&<SheetModal onClose={()=>sSched(false)} title={t('schedule')}>
      <div style={{display:'grid',gap:8}}>{(gym.weekly||[]).map((r,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'12px 14px',background:C.sub,borderRadius:12}}><span style={{fontSize:13,fontWeight:700,color:C.t1}}>{r.days}</span><span dir="ltr" style={{fontSize:13,color:C.t2,fontWeight:600}}>{r.open} – {r.close}</span></div>)}</div>
    </SheetModal>}
  </Screen>;
}
function StatTile({icon,color,bg,val,label,onClick}){return <div onClick={onClick} style={{...card,padding:'14px 8px',textAlign:'center',cursor:'pointer'}}><div style={{width:36,height:36,borderRadius:11,background:bg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px'}}><Icon name={icon} size={18} color={color}/></div><p style={{fontSize:19,fontWeight:900,color:C.t1,lineHeight:1}}>{val}</p><p style={{fontSize:10.5,color:C.t3,marginTop:3}}>{label}</p></div>;}
function Detail({icon,color,label,val}){return <div style={{background:C.sub,borderRadius:14,padding:'11px 12px',display:'flex',alignItems:'center',gap:9}}><div style={{width:28,height:28,borderRadius:9,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={icon} size={14} color={color}/></div><div><p style={{fontSize:10,color:C.t3}}>{label}</p><p dir="ltr" style={{fontSize:13,fontWeight:700,color:C.t1,textAlign:'start'}}>{val}</p></div></div>;}
function QuickTile({grad,icon,label,onClick}){return <button onClick={onClick} style={{background:grad,border:'none',borderRadius:20,padding:'18px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:10,cursor:'pointer',color:'#fff',fontFamily:'inherit',boxShadow:'0 4px 14px rgba(0,0,0,0.12)'}}><Icon name={icon} size={22} color="#fff"/><span style={{fontSize:12,fontWeight:700}}>{label}</span></button>;}
function SheetModal({children,title,onClose}){return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.55)',backdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}><div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:440,background:C.bg,borderRadius:'26px 26px 0 0',padding:'20px 18px calc(24px + env(safe-area-inset-bottom))',animation:'sheetUp .35s cubic-bezier(.22,1,.36,1)'}}><div style={{width:40,height:4,background:C.t4,borderRadius:100,margin:'0 auto 16px'}}/><h3 style={{fontSize:17,fontWeight:800,color:C.t1,marginBottom:14}}>{title}</h3>{children}</div></div>;}

function calcStreak(logs){if(!logs.length)return 0;const days=new Set(logs.map(l=>fmtD(l.completed_at||l.created_at)));let s=0;let d=new Date();for(let i=0;i<400;i++){const key=d.toISOString().slice(0,10);if(days.has(key)){s++;}else if(i>0){break;}d.setDate(d.getDate()-1);}return s;}

// ═══════════════════════ SUBSCRIPTIONS ═══════════════════════
function Subs(){
  const{t,ar,sPg}=useApp();const[subs,sSubs]=useState(null);const[pays,sPays]=useState([]);const[plans,sPlans]=useState([]);const[unread,sUnread]=useState(0);
  useEffect(()=>{api.get('/api/pwa/member/subscriptions').then(r=>sSubs(r.data||[])).catch(()=>sSubs([]));api.get('/api/pwa/member/payments').then(r=>sPays(r.data||[])).catch(()=>{});api.get('/api/pwa/member/plans').then(r=>sPlans(r.data||[])).catch(()=>{});api.get('/api/pwa/member/notifications/unread-count').then(r=>sUnread(r.data.count||0)).catch(()=>{});},[]);
  if(!subs)return <div style={{minHeight:'100vh',background:C.bg}}><Loader/></div>;
  const cur=ar?'د.أ':'JOD';
  const s=subs[0]||{};
  const parseD=v=>v?new Date(String(v).slice(0,10)+'T00:00:00'):null;
  const start=parseD(s.start_date),end=parseD(s.end_date),today=new Date();today.setHours(0,0,0,0);
  const days=end?Math.max(0,Math.round((end-today)/86400000)):Number(s.days_remaining||0);
  const totalDays=(start&&end)?Math.max(1,Math.round((end-start)/86400000)):Number(s.total_days||90);
  const pct=Math.min(100,Math.round((totalDays-days)/totalDays*100));
  const R=32,CIRC=Math.round(2*Math.PI*R);const isActive=(s.effective_status||s.status)==='active';
  const upgrades=(plans||[]).filter(p=>p.plan_type!=='trial'&&p.is_trial!==1).slice(0,3);
  const benefits=[];
  (s.plan_features||[]).forEach(fx=>{const lbl=featLabel(fx,ar);if(lbl&&lbl.trim())benefits.push(['check',C.green,'#f0fdf4',lbl.trim(),'',true]);});
  if(s.billing_type==='period'||!s.total_sessions)benefits.push(['door',C.blue,'#eff6ff',ar?'دخول غير محدود':'Unlimited access',ar?'طوال مدة الاشتراك':'For your whole plan',true]);
  else benefits.push(['cal',C.blue,'#eff6ff',ar?'جلسات محدودة':'Session pass',`${arN((s.total_sessions||0)-(s.used_sessions||0),ar)} / ${arN(s.total_sessions||0,ar)}`,true]);
  benefits.push(['dumbbell',C.purple,'#faf5ff',ar?'برامج تدريبية':'Training programs',ar?'وصول لجميع البرامج':'Access to all programs',true]);
  benefits.push(['clock',C.orange,'#fff7ed',ar?'أيام التجميد':'Freeze days',`${arN(Math.max(0,(s.freeze_days_allowed||0)-(s.freeze_days_used||0)),ar)} / ${arN(s.freeze_days_allowed||0,ar)} ${ar?'يوم':'days'}`,(s.freeze_days_allowed||0)>0]);
  benefits.push(['users',C.green,'#f0fdf4',ar?'المدرب الشخصي':'Personal trainer',s.trainer_id?(ar?'مخصص لك':'Assigned'):(ar?'غير مفعّل':'Not included'),!!s.trainer_id]);
  return <Screen>
    <div style={{padding:'16px 20px 4px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <h1 style={{fontSize:24,fontWeight:900,color:C.t1,letterSpacing:'-0.03em'}}>{t('subscriptions')}</h1>
      <button onClick={()=>sPg('notifs')} style={{width:38,height:38,borderRadius:12,background:C.surf,border:'none',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',cursor:'pointer'}}><Icon name="bell" size={17} color={C.t2}/>{unread>0&&<span style={{position:'absolute',top:7,insetInlineStart:7,width:7,height:7,background:C.red,borderRadius:50,border:'2px solid #e8f0f8'}}/>}</button>
    </div>
    <div style={{padding:'0 16px',display:'flex',flexDirection:'column',gap:12,marginTop:8}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#1d4ed8 0%,#3b82f6 50%,#60a5fa 100%)',borderRadius:26,padding:22,color:'#fff',boxShadow:'0 10px 32px rgba(59,130,246,0.4)',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-30,insetInlineStart:-30,width:130,height:130,borderRadius:'50%',background:'rgba(255,255,255,0.07)'}}/>
        <div style={{position:'relative'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:100,padding:'5px 12px'}}><span style={{width:6,height:6,borderRadius:50,background:isActive?'#4ade80':'#f87171',animation:isActive?'beat 1.8s infinite':'none'}}/><span style={{fontSize:11,fontWeight:700}}>{isActive?t('activeSub'):(s.effective_status||s.status)}</span></div>
            <span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.8)'}}>{durLabel(totalDays,ar)}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
            <div><p style={{fontSize:12,color:'rgba(255,255,255,0.65)',marginBottom:4}}>{ar?'الأيام المتبقية':'Days left'}</p><div style={{display:'flex',alignItems:'baseline',gap:6}}><span style={{fontSize:52,fontWeight:900,lineHeight:1,letterSpacing:'-0.05em'}}>{arN(days,ar)}</span><span style={{fontSize:15,color:'rgba(255,255,255,0.65)',fontWeight:600}}>{t('day')}</span></div></div>
            <svg width="76" height="76" viewBox="0 0 76 76" style={{transform:'rotate(-90deg)'}}><circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6"/><circle cx="38" cy="38" r={R} fill="none" stroke="#fff" strokeWidth="6" strokeDasharray={CIRC} strokeDashoffset={Math.round(CIRC*(1-pct/100))} strokeLinecap="round"/></svg>
          </div>
          <div style={{background:'rgba(255,255,255,0.12)',borderRadius:100,height:6,overflow:'hidden',marginBottom:6}}><div style={{height:'100%',background:'#fff',borderRadius:100,width:pct+'%'}}/></div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:10.5,color:'rgba(255,255,255,0.6)'}}>{fmtNiceDate(s.start_date,ar)}</span><span style={{fontSize:10.5,color:'rgba(255,255,255,0.9)',fontWeight:600}}>{arN(pct,ar)}% {ar?'مكتمل':'done'}</span><span style={{fontSize:10.5,color:'rgba(255,255,255,0.6)'}}>{fmtNiceDate(s.end_date,ar)}</span></div>
        </div>
      </div>
      {/* Payment summary */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div style={{...card,padding:16}}><div style={{width:36,height:36,borderRadius:12,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10}}><Icon name="card" size={16} color={C.green} w={2.5}/></div><p style={{fontSize:10,color:C.t3,fontWeight:600,marginBottom:4}}>{t('paid')}</p><p style={{fontSize:18,fontWeight:800,color:C.green}}>{Number(s.total_paid||s.paid_amount||0).toFixed(2)}<span style={{fontSize:11,color:C.t3,fontWeight:500}}> {cur}</span></p></div>
        <div style={{...card,padding:16}}><div style={{width:36,height:36,borderRadius:12,background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10}}><Icon name="dollar" size={16} color={C.t3} w={2.5}/></div><p style={{fontSize:10,color:C.t3,fontWeight:600,marginBottom:4}}>{t('balance')}</p><p style={{fontSize:18,fontWeight:800,color:Number(s.balance_due||0)>0?C.orange:C.t1}}>{Number(s.balance_due||s.balance_amount||0).toFixed(2)}<span style={{fontSize:11,color:C.t3,fontWeight:500}}> {cur}</span></p></div>
      </div>
      {/* Renew CTA */}
      <div style={{...card,padding:18,display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:50,height:50,borderRadius:16,background:'linear-gradient(135deg,#3b82f6,#2563eb)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 14px rgba(59,130,246,0.35)'}}><Icon name="refresh" size={22} color="#fff" w={2.5}/></div>
        <div style={{flex:1}}><p style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:2}}>{t('renew')}</p><p style={{fontSize:11.5,color:C.t3}}>{ar?'ينتهي اشتراكك في':'Ends on'} {fmtNiceDate(s.end_date,ar)}</p></div>
        <Icon name="chevron" size={16} color={C.t3} w={2.5}/>
      </div>
      {/* Benefits */}
      <div style={{...card,padding:18}}>
        <p style={{fontSize:15,fontWeight:800,color:C.t1,marginBottom:14}}>{t('benefits')}</p>
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
        {benefits.map(([ic,col,bg,title,sub,on],i)=><div key={i}>{i>0&&<div style={{height:1,background:'#f1f5f9',margin:'12px 0'}}/>}<div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,borderRadius:11,background:bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name={ic} size={16} color={col} w={2.5}/></div>
          <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600,color:C.t1}}>{title}</p><p style={{fontSize:11,color:C.t3}}>{sub}</p></div>
          <div style={{width:20,height:20,borderRadius:'50%',background:on?'#f0fdf4':'#fff7ed',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={on?'check':'minus'} size={10} color={on?C.green:C.orange} w={3}/></div>
        </div></div>)}</div>
      </div>
      {/* Upgrade */}
      {!!upgrades.length&&<div>
        <p style={{fontSize:15,fontWeight:800,color:C.t1,margin:'2px 4px 12px'}}>{t('upgradePlans')}</p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>{upgrades.map((p,i)=>{const best=i===upgrades.length-1&&upgrades.length>1;return <div key={p.id} style={{borderRadius:18,padding:'16px 18px',display:'flex',alignItems:'center',gap:14,position:'relative',overflow:'hidden',...(best?{background:'linear-gradient(135deg,#0f172a,#1e3a5f)',boxShadow:'0 6px 20px rgba(15,23,42,0.25)'}:{...card})}}>
          {best&&<div style={{position:'absolute',top:8,insetInlineEnd:12,background:'#3b82f6',borderRadius:6,padding:'2px 8px'}}><span style={{fontSize:9.5,fontWeight:700,color:'#fff'}}>{t('bestValue')}</span></div>}
          <div style={{width:44,height:44,borderRadius:14,background:best?'rgba(255,255,255,0.1)':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:best?8:0}}><Icon name={best?'trophy':'cal'} size={20} color={best?'#60a5fa':C.blue} w={2.5}/></div>
          <div style={{flex:1,marginTop:best?8:0}}><p style={{fontSize:14,fontWeight:700,color:best?'#fff':C.t1}}>{ar?(p.name_ar||p.name):p.name}</p><p style={{fontSize:11,color:best?'rgba(255,255,255,0.55)':C.t3,marginTop:1}}>{durLabel(p.duration_days,ar)}</p>{!!(p.features&&p.features.length)&&<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>{p.features.slice(0,4).map((fx,fi)=><div key={fi} style={{display:'flex',alignItems:'center',gap:6}}><Icon name="check" size={11} color={best?'#60a5fa':C.green} w={3}/><span style={{fontSize:11,color:best?'rgba(255,255,255,0.8)':C.t2}}>{featLabel(fx,ar)}</span></div>)}</div>}</div>
          <div style={{textAlign:'end',marginTop:best?8:0,alignSelf:'flex-start'}}><p style={{fontSize:16,fontWeight:800,color:best?'#60a5fa':C.blue}}>{Number(p.price||0).toFixed(0)} <span style={{fontSize:11,fontWeight:500,color:best?'rgba(255,255,255,0.5)':C.t3}}>{cur}</span></p></div>
        </div>;})}</div>
      </div>}
      {/* Payment history */}
      <div style={{...card,padding:18}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}><p style={{fontSize:15,fontWeight:800,color:C.t1}}>{t('paymentHistory')}</p></div>
        {pays.length?pays.slice(0,6).map((p,i)=><div key={i}>{i>0&&<div style={{height:1,background:'#f1f5f9',margin:'12px 0'}}/>}<div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:40,height:40,borderRadius:13,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="check" size={16} color={C.green} w={2.5}/></div>
          <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600,color:C.t1}}>{ar?'دفعة اشتراك':'Subscription payment'}</p><p style={{fontSize:11,color:C.t3}}>{fmtNiceDate(p.payment_date,ar)}</p></div>
          <span style={{fontSize:14,fontWeight:700,color:C.green}}>{Number(p.amount||0).toFixed(2)} {cur}</span>
        </div></div>):<Empty icon="cal" label={t('noPayments')}/>}
      </div>
    </div>
  </Screen>;
}

// ═══════════════════════ TRAINING ═══════════════════════
function Train(){
  const{t,ar,sPg}=useApp();
  const[d,sD]=useState(null);const[done,sDone]=useState([]);const[timer,sTimer]=useState(null);const[celebrate,sCel]=useState(false);const[unread,sUnread]=useState(0);
  useEffect(()=>{
    api.get('/api/pwa/member/training').then(r=>sD(r.data||{})).catch(()=>sD({}));
    api.get('/api/pwa/member/workout-log?days=1').then(r=>{const today=new Date().toISOString().slice(0,10);sDone((r.data||[]).filter(l=>fmtD(l.completed_at)===today).map(l=>l.exercise_id));}).catch(()=>{});
    api.get('/api/pwa/member/notifications/unread-count').then(r=>sUnread(r.data.count||0)).catch(()=>{});
  },[]);
  if(!d)return <div style={{minHeight:'100vh',background:C.bg}}><Loader/></div>;
  const en=d.enrollment||{};const plan={id:en.assigned_program_id||null};
  const exercises=(d.exercises||[]).slice(0,8);
  const total=exercises.length;const completed=exercises.filter(e=>done.includes(e.exercise_id||e.id)).length;
  const estMin=Math.max(15,Math.round(exercises.reduce((a,e)=>a+(Number(e.sets)||3)*((Number(e.rest_seconds)||60)+40),0)/60));
  const grads=['linear-gradient(135deg,#1e3a5f,#2563eb)','linear-gradient(135deg,#1a1a3e,#7c3aed)','linear-gradient(135deg,#0f4c3a,#14b8a6)','linear-gradient(135deg,#7c2d12,#f97316)','linear-gradient(135deg,#831843,#ec4899)'];
  const statCols=[C.blue,'#8b5cf6','#14b8a6','#f97316','#ec4899'];
  const now=new Date();const dow=now.getDay();const weekStart=new Date(now);weekStart.setDate(now.getDate()-dow);
  const week=Array.from({length:7}).map((_,i)=>{const dt=new Date(weekStart);dt.setDate(weekStart.getDate()+i);return{d:dt.getDate(),wd:i,today:i===dow};});
  const monthLabel=ar?`${AR_MONTHS[now.getMonth()]} ${now.getFullYear()}`:`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]} ${now.getFullYear()}`;
  const complete=async(ex,idx)=>{
    const eid=ex.exercise_id||ex.id;if(done.includes(eid))return;
    try{await api.post('/api/pwa/member/workout-log',{plan_id:plan?.id,exercise_id:eid,exercise_name:ex.name||ex.exercise_name,sets_completed:ex.sets||ex.sets_default||3});}catch(_){}
    const nd=[...done,eid];sDone(nd);
    const isLast=nd.filter(x=>exercises.some(e=>(e.exercise_id||e.id)===x)).length>=total&&total>0;
    if(isLast){setTimeout(()=>sCel(true),400);}else{const restS=Number(ex.rest_seconds||ex.rest||60);sTimer({sec:restS,total:restS});}
  };
  const programName=ar?(en.program_name_ar||en.program_name):en.program_name;
  return <Screen>
    <div style={{padding:'16px 20px 4px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
      <div><h1 style={{fontSize:24,fontWeight:900,color:C.t1,letterSpacing:'-0.03em'}}>{t('training')}</h1><p style={{fontSize:11.5,color:C.t3,marginTop:2}}>{ar?'مستوى':'Level'} {levelLabel(en.experience_level,ar)} · {monthLabel}</p></div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <button onClick={()=>sPg('notifs')} style={{width:36,height:36,borderRadius:12,background:C.surf,border:'none',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',cursor:'pointer'}}><Icon name="bell" size={16} color={C.t2}/>{unread>0&&<span style={{position:'absolute',top:7,insetInlineStart:7,width:7,height:7,background:C.red,borderRadius:50,border:'2px solid #e8f0f8'}}/>}</button>
        {en.experience_level&&<div style={{background:'#dbeafe',borderRadius:10,padding:'5px 10px'}}><span style={{fontSize:11,fontWeight:700,color:'#2563eb'}}>{levelLabel(en.experience_level,ar)}</span></div>}
      </div>
    </div>
    <div style={{padding:'0 16px',display:'flex',flexDirection:'column',gap:10,marginTop:8}}>
      {/* Program tab */}
      {programName&&<div style={{background:'#e2eaf4',borderRadius:16,padding:5,display:'flex'}}><button style={{flex:1,padding:'9px 4px',border:'none',borderRadius:12,fontFamily:'inherit',fontSize:12.5,fontWeight:700,background:'#fff',color:C.t1,boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>{programName}</button></div>}
      {/* Progress card */}
      <div style={{...card,padding:'14px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:13,fontWeight:700,color:C.t1}}>{t('todayProgress')}</span><span style={{fontSize:13,fontWeight:800,color:'#8b5cf6'}}>{completed} / {total} {t('exercises')}</span></div>
        <div style={{background:'#f1f5f9',borderRadius:100,height:8,overflow:'hidden'}}><div style={{height:'100%',background:'linear-gradient(90deg,#8b5cf6,#6366f1)',borderRadius:100,width:(total?completed/total*100:0)+'%',transition:'width 0.5s ease'}}/></div>
      </div>
      {/* Week strip + summary */}
      <div style={{...card,padding:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,padding:'0 2px'}}>
          <div><span style={{fontSize:13,fontWeight:800,color:C.t1}}>{AR_DAYS[now.getDay()]}</span><span style={{fontSize:12,color:C.t3,fontWeight:500,marginInlineStart:6}}>{arN(now.getDate(),ar)} {AR_MONTHS[now.getMonth()]}</span></div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>{week.map((w,i)=><div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,minWidth:38}}>
          <div style={{width:38,height:38,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,background:w.today?C.blue:'#fff',color:w.today?'#fff':C.t2,boxShadow:w.today?'0 5px 14px rgba(59,130,246,0.45)':'0 1px 4px rgba(0,0,0,0.06)',transform:w.today?'scale(1.1)':'none'}}>{arN(w.d,ar)}</div>
          <span style={{fontSize:9.5,fontWeight:600,color:w.today?C.blue:C.t3}}>{AR_DAYS_SHORT[w.wd]}</span>
        </div>)}</div>
        {total>0&&<div style={{marginTop:10,background:'#eff6ff',borderRadius:10,padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
          <Icon name="activity" size={14} color={C.blue} w={2.5}/>
          <span style={{fontSize:12,fontWeight:700,color:'#2563eb'}}>{programName||t('training')}</span>
          <span style={{fontSize:11,color:C.t2,marginInlineStart:'auto'}}>{arN(total,ar)} {t('exercises')} · {arN(estMin,ar)} {ar?'د':'min'}</span>
        </div>}
      </div>
      {/* Exercises */}
      {total?exercises.map((ex,i)=>{const eid=ex.exercise_id||ex.id;const isDone=done.includes(eid);const col=statCols[i%statCols.length];return <div key={eid||i} style={{...card,overflow:'hidden',opacity:isDone?0.65:1,transition:'opacity 0.3s'}}>
        <div style={{height:130,background:grads[i%grads.length],display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
          <Icon name={i%2?'activity':'dumbbell'} size={46} color="rgba(255,255,255,0.5)" w={1.5}/>
          <span style={{position:'absolute',top:10,insetInlineStart:10,borderRadius:8,padding:'3px 10px',fontSize:11,fontWeight:700,color:'#fff',background:isDone?'rgba(34,197,94,0.85)':'rgba(0,0,0,0.4)'}}>{isDone?t('done'):`${i+1} / ${total}`}</span>
          {ex.video_url&&<a href={ex.video_url} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.18)',border:'2px solid rgba(255,255,255,0.4)',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg></a>}
        </div>
        <div style={{padding:'14px 16px'}}>
          <p style={{fontSize:15,fontWeight:800,color:C.t1,marginBottom:3}}>{ar?(ex.name_ar||ex.name):ex.name}</p>
          <p style={{fontSize:11.5,color:C.t2,marginBottom:10}}>{muscleAr(ex.muscle_group||ex.category,ar)||'—'}</p>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <MiniStat val={arN(ex.sets||3,ar)} label={t('sets')} color={col}/>
            <MiniStat val={ar?String(ex.reps||ex.reps_default||12).replace(/\d/g,x=>'٠١٢٣٤٥٦٧٨٩'[x]):(ex.reps||ex.reps_default||12)} label={t('reps')}/>
            <MiniStat val={arN(ex.rest_seconds||ex.rest||60,ar)} label={t('restSec')}/>
          </div>
          <button onClick={()=>complete(ex,i)} disabled={isDone} style={{width:'100%',border:'none',borderRadius:12,padding:'11px',fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:isDone?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,background:isDone?'#f0fdf4':'#eff6ff',color:isDone?'#16a34a':'#3b82f6'}}><Icon name={isDone?'check':'clock'} size={15} color={isDone?'#16a34a':'#3b82f6'} w={2.5}/>{isDone?t('done'):t('tapDone')}</button>
        </div>
      </div>}):<div style={{...card,padding:'40px 20px',textAlign:'center'}}><div style={{width:56,height:56,borderRadius:16,background:'#faf5ff',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}><Icon name="dumbbell" size={26} color="#8b5cf6"/></div><p style={{fontSize:14,color:C.t2}}>{t('noPlan')}</p></div>}
    </div>
    {timer&&<RestTimer timer={timer} setTimer={sTimer} t={t}/>}
    {celebrate&&<Celebrate onClose={()=>{sCel(false);sPg('home');}} t={t} ar={ar} count={total} minutes={estMin}/>}
  </Screen>;
}
function MiniStat({val,label,color}){return <div style={{flex:1,background:'#f8fafc',borderRadius:10,padding:'8px 4px',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><span style={{fontSize:18,fontWeight:800,color:color||C.t1}}>{val}</span><span style={{fontSize:10,color:C.t3,fontWeight:600}}>{label}</span></div>;}
function RestTimer({timer,setTimer,t}){
  const[sec,sSec]=useState(timer.sec);const ref=useRef();
  useEffect(()=>{ref.current=setInterval(()=>sSec(s=>{if(s<=1){clearInterval(ref.current);setTimeout(()=>setTimer(null),200);return 0;}return s-1;}),1000);return()=>clearInterval(ref.current);},[]);
  const pct=timer.total?(timer.total-sec)/timer.total:0;const R=50,CIRC=2*Math.PI*R;
  const mm=String(Math.floor(sec/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');
  return <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}><div style={{width:'100%',maxWidth:440,background:C.bg,borderRadius:'26px 26px 0 0',padding:'26px 20px calc(30px + env(safe-area-inset-bottom))',textAlign:'center'}}>
    <div style={{width:40,height:4,background:C.t4,borderRadius:100,margin:'0 auto 18px'}}/>
    <p style={{fontSize:13,color:C.t3,fontWeight:600,marginBottom:14}}>{t('rest')}</p>
    <div style={{position:'relative',width:140,height:140,margin:'0 auto 20px'}}>
      <svg width="140" height="140" viewBox="0 0 120 120"><circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="8"/><circle cx="60" cy="60" r={R} fill="none" stroke="#8b5cf6" strokeWidth="8" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC*(1-pct)} transform="rotate(-90 60 60)" style={{transition:'stroke-dashoffset 1s linear'}}/></svg>
      <div dir="ltr" style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,fontWeight:900,color:C.t1}}>{mm}:{ss}</div>
    </div>
    <div style={{display:'flex',gap:10}}><button onClick={()=>setTimer(null)} style={{flex:1,background:C.surf,border:'1px solid '+C.line,borderRadius:14,padding:'13px',fontSize:14,fontWeight:700,color:C.t2,fontFamily:'inherit',cursor:'pointer'}}>{t('skip')}</button><button onClick={()=>sSec(s=>s+30)} style={{flex:1,background:'#8b5cf6',border:'none',borderRadius:14,padding:'13px',fontSize:14,fontWeight:700,color:'#fff',fontFamily:'inherit',cursor:'pointer'}}>{t('add30')}</button></div>
  </div></div>;
}
function Celebrate({onClose,t,ar,count,minutes}){const isAr=ar!==false;return <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.7)',zIndex:210,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
  <div style={{background:'#fff',borderRadius:28,padding:'36px 28px',textAlign:'center',maxWidth:360,width:'100%',animation:'numIn 0.4s cubic-bezier(0.34,1.56,0.64,1)'}}>
    <div style={{width:80,height:80,borderRadius:'50%',background:'linear-gradient(135deg,#22c55e,#16a34a)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 8px 24px rgba(34,197,94,0.4)'}}><Icon name="check" size={36} color="#fff" w={3}/></div>
    <p style={{fontSize:22,fontWeight:900,color:C.t1,marginBottom:8}}>{t('greatJob')}</p>
    <p style={{fontSize:14,color:C.t2,marginBottom:4}}>{isAr?'أكملت جميع التمارين':'All exercises done'}</p>
    <p style={{fontSize:13,color:C.t3,marginBottom:24}}>{isAr?'تم تسجيل تمرين اليوم في سجلك':'Today\'s workout saved to your log'}</p>
    <div style={{background:'#f0fdf4',borderRadius:14,padding:14,marginBottom:20,display:'flex',justifyContent:'space-around'}}>
      <div><p style={{fontSize:22,fontWeight:800,color:'#22c55e'}}>{arN(count||0,isAr)}</p><p style={{fontSize:11,color:C.t3}}>{t('exercises')}</p></div>
      <div><p style={{fontSize:22,fontWeight:800,color:'#22c55e'}}>{arN(minutes||0,isAr)}</p><p style={{fontSize:11,color:C.t3}}>{isAr?'دقيقة':'min'}</p></div>
    </div>
    <button onClick={onClose} style={{width:'100%',background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',border:'none',borderRadius:14,padding:'14px',fontSize:15,fontWeight:700,fontFamily:'inherit',cursor:'pointer',boxShadow:'0 6px 20px rgba(34,197,94,0.35)'}}>{isAr?'رائع! العودة للرئيسية':'Back to home'}</button>
  </div>
</div>;}

// ═══════════════════════ NUTRITION ═══════════════════════
function Nutrition(){
  const{t,ar,sPg}=useApp();const[d,sD]=useState(null);const[busy,sBusy]=useState(false);const[unread,sUnread]=useState(0);
  useEffect(()=>{api.get('/api/pwa/member/nutrition').then(r=>sD(r.data)).catch(()=>{});api.get('/api/pwa/member/notifications/unread-count').then(r=>sUnread(r.data.count||0)).catch(()=>{});},[]);
  if(!d)return <div style={{minHeight:'100vh',background:C.bg}}><Loader/></div>;
  const cal=d.calories||{};const w=d.water||{};
  const changeWater=async(delta)=>{sBusy(true);try{const r=await api.post('/api/pwa/member/water',{delta});sD(p=>({...p,water:{...p.water,glasses:r.data.glasses}}));}catch(e){toast(e.message,'e')}sBusy(false)};
  const macroRows=[[t('protein'),d.macros?.protein,C.blue],[t('carbs'),d.macros?.carbs,C.orange],[t('fat'),d.macros?.fat,C.green]];
  const cpct=cal.target?Math.round((cal.consumed||0)/cal.target*100):0;const ml=(w.glasses||0)*(w.ml_per_glass||250),goalMl=(w.goal||8)*(w.ml_per_glass||250);
  const planLabel=d.goal?('خطة '+goalLabel(d.goal,ar)):(ar?d.planNameAr:d.planName);
  return <Screen>
    <div style={{padding:'16px 20px 6px',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
      <div><h1 style={{fontSize:22,fontWeight:900,color:C.t1}}>{t('nutrition')}</h1><p style={{fontSize:12,color:C.t3,marginTop:3}}>{planLabel?planLabel+' · ':''}{arFullDate(ar)}</p></div>
      <div style={{display:'flex',gap:9,alignItems:'center'}}>
        {d.goal&&<span style={{background:'#fffbeb',color:C.orange,fontSize:11.5,fontWeight:700,padding:'6px 12px',borderRadius:10}}>{goalLabel(d.goal,ar)}</span>}
        <button onClick={()=>sPg('notifs')} style={{width:38,height:38,borderRadius:12,background:C.surf,border:'none',boxShadow:'0 2px 10px rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',cursor:'pointer'}}><Icon name="bell" size={16} color={C.t2}/>{unread>0&&<span style={{position:'absolute',top:6,right:6,width:7,height:7,background:C.red,borderRadius:50}}/>}</button>
      </div>
    </div>
    <div style={{padding:'0 16px',display:'flex',flexDirection:'column',gap:12,marginTop:8}}>
      {/* Calories */}
      <div style={{background:'linear-gradient(135deg,#ea580c,#f97316)',borderRadius:22,padding:20,color:'#fff',boxShadow:'0 8px 28px rgba(249,115,22,0.35)',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-30,insetInlineStart:-30,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.08)'}}/>
        <div style={{position:'relative'}}>
          <p style={{fontSize:13,color:'rgba(255,255,255,0.8)',marginBottom:10,textAlign:'end'}}>{t('dailyCalories')}</p>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'baseline',gap:6}}><span style={{fontSize:44,fontWeight:900,lineHeight:1}}>{cal.consumed||0}</span><span style={{fontSize:15,color:'rgba(255,255,255,0.7)'}}>/ {cal.target||0}</span></div>
            <div style={{textAlign:'start'}}><p style={{fontSize:10,color:'rgba(255,255,255,0.6)'}}>{ar?'متبقي':'Remaining'}</p><p style={{fontSize:20,fontWeight:800}}>{cal.remaining||0}</p></div>
          </div>
          <Prog pct={cpct} color="rgba(255,255,255,0.9)" bg="rgba(255,255,255,0.2)" h={6}/>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}><span style={{fontSize:10.5,color:'rgba(255,255,255,0.7)'}}>{cal.consumed||0} {t('mealDone')}</span><span style={{fontSize:10.5,fontWeight:700}}>{cpct}% {ar?'من الهدف':'of goal'}</span></div>
        </div>
      </div>
      {/* Water */}
      <div style={{...card,padding:16}}>
        <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="drop" size={19} color={C.blue}/></div>
          <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700,color:C.t1}}>{ar?'الماء اليومي':'Daily water'}</p><p style={{fontSize:11.5,color:C.t3}}>{ml} {t('ml')} {ar?'من أصل':'of'} {goalMl} {t('ml')}</p></div>
          <div style={{textAlign:'start'}}><span style={{fontSize:18,fontWeight:900,color:C.blue}}>{w.glasses||0}</span><span style={{fontSize:12,color:C.t3}}> / {w.goal||8} {t('glass')}</span></div>
        </div>
        <div style={{display:'flex',gap:5,marginBottom:12,flexWrap:'wrap'}}>{Array.from({length:w.goal||8}).map((_,i)=><div key={i} style={{flex:'1 1 8%',minWidth:22,height:34,borderRadius:7,background:i<(w.glasses||0)?C.blue:'#eef2f7',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="drop" size={13} color={i<(w.glasses||0)?'#fff':C.t4}/></div>)}</div>
        <Prog pct={w.goal?(w.glasses||0)/w.goal*100:0} color={C.blue}/>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button onClick={()=>changeWater(1)} disabled={busy} style={{flex:1,background:'linear-gradient(135deg,#2563eb,#3b82f6)',color:'#fff',border:'none',borderRadius:12,padding:'11px',fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>+ {t('addGlass')}</button>
          <button onClick={()=>changeWater(-1)} disabled={busy} style={{width:48,background:C.sub,color:C.t2,border:'none',borderRadius:12,fontSize:18,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>−</button>
        </div>
      </div>
      {/* Macros */}
      <div style={{...card,padding:16}}>
        <p style={{fontSize:14,fontWeight:800,color:C.t1,marginBottom:14}}>{t('macros')}</p>
        {macroRows.map(([label,mo,col],i)=>{const cons=mo?.consumed||0,tar=mo?.target||0;return <div key={i} style={{marginBottom:i<2?14:0}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{fontSize:12.5,color:C.t2,fontWeight:600}}>{label}</span><span dir="ltr" style={{fontSize:12,color:C.t3}}>{cons} / {tar}g</span></div><Prog pct={tar?cons/tar*100:0} color={col}/></div>;})}
      </div>
      {/* Meals */}
      <div>
        <p style={{fontSize:14,fontWeight:800,color:C.t1,margin:'2px 4px 10px'}}>{t('meals')} {d.planNameAr?<span style={{fontSize:11,color:C.t3,fontWeight:500}}>· {ar?d.planNameAr:d.planName}</span>:null}</p>
        <div style={{display:'grid',gap:10}}>{(d.meals||[]).map(m=><div key={m.id} style={{...card,padding:14,display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:m.completed?'#f0fdf4':'#fffbeb',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="utensils" size={18} color={m.completed?C.green:C.orange}/></div>
          <div style={{flex:1}}><p style={{fontSize:14,fontWeight:700,color:C.t1}}>{ar?(m.title_ar||m.title):m.title}</p><p style={{fontSize:11.5,color:C.t3}}>{m.time_label} · {m.calories} {t('calories')}</p></div>
          <span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:8,background:m.completed?'#f0fdf4':'#fffbeb',color:m.completed?C.green:C.orange}}>{m.completed?t('mealDone'):t('mealUpcoming')}</span>
        </div>)}</div>
      </div>
    </div>
  </Screen>;
}

// ═══════════════════════ NOTIFICATIONS ═══════════════════════
function Notifs(){
  const{t,ar,sPg}=useApp();const[items,sItems]=useState(null);const[filter,sFilter]=useState('');const[open,sOpen]=useState(null);
  const load=(cat)=>api.get('/api/pwa/member/notifications'+(cat?('?category='+cat):'')).then(r=>sItems(r.data||[])).catch(()=>sItems([]));
  useEffect(()=>{load(filter)},[filter]);
  const markRead=async(n)=>{if(!n.is_read){try{await api.post('/api/pwa/member/notifications/'+n.id+'/read',{});sItems(list=>list.map(x=>x.id===n.id?{...x,is_read:1}:x));}catch(_){}}};
  const readAll=async()=>{try{await api.post('/api/pwa/member/notifications/read-all',{});sItems(list=>list.map(x=>({...x,is_read:1})));}catch(_){}};
  const cats=[['',t('all')],['subscription',t('subscription')],['training',t('training')],['nutrition',t('nutrition')],['general',t('general')]];
  const catColor={subscription:C.blue,training:C.purple,nutrition:C.orange,general:'#64748b'};
  const catBg={subscription:'#eff6ff',training:'#faf5ff',nutrition:'#fff7ed',general:'#f1f5f9'};
  const catIcon={subscription:'cal',training:'dumbbell',nutrition:'utensils',general:'help'};
  const unread=(items||[]).filter(n=>!n.is_read).length;
  return <Screen>
    <div style={{padding:'16px 16px 8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}><button onClick={()=>sPg('home')} style={{width:36,height:36,borderRadius:12,background:C.surf,border:'none',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon name="back" size={18} color={C.t2}/></button><h1 style={{fontSize:22,fontWeight:900,color:C.t1,letterSpacing:'-0.03em'}}>{t('notifications')}</h1></div>
      <button onClick={readAll} style={{background:'none',border:'none',fontSize:12,fontWeight:600,color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>{t('markAllRead')}</button>
    </div>
    <p style={{padding:'0 20px 8px',fontSize:12,color:C.t3,fontWeight:500}}>{ar?`${unread} إشعار غير مقروء`:`${unread} unread`}</p>
    <div style={{display:'flex',gap:6,padding:'0 16px 12px',overflowX:'auto'}}>{cats.map(([v,l])=><button key={v} onClick={()=>sFilter(v)} style={{whiteSpace:'nowrap',border:'none',borderRadius:100,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:filter===v?C.t1:C.surf,color:filter===v?'#fff':'#64748b',boxShadow:filter===v?'none':'0 1px 4px rgba(0,0,0,0.07)'}}>{l}</button>)}</div>
    <div style={{padding:'0 16px',display:'flex',flexDirection:'column',gap:8}}>
      {items===null?<Loader/>:items.length?items.map(n=>{const col=catColor[n.category]||'#64748b';const isOpen=open===n.id;return <div key={n.id} onClick={()=>{sOpen(isOpen?null:n.id);markRead(n);}} style={{background:n.is_read?'#f8fafc':'#fff',border:'1.5px solid '+(n.is_read?'#f1f5f9':'#dbeafe'),borderRadius:18,padding:'15px 16px',cursor:'pointer',boxShadow:'0 2px 10px rgba(0,0,0,0.05)'}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          <div style={{position:'relative',flexShrink:0}}><div style={{width:44,height:44,borderRadius:14,background:catBg[n.category]||'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={catIcon[n.category]||'bell'} size={20} color={col}/></div>{!n.is_read&&<span style={{position:'absolute',top:-3,insetInlineStart:-3,width:10,height:10,background:C.blue,borderRadius:50,border:'2px solid #e8f0f8'}}/>}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:3}}><p style={{fontSize:13.5,fontWeight:n.is_read?600:700,color:C.t1,lineHeight:1.3}}>{ar?(n.title_ar||n.title):n.title}</p><span style={{fontSize:10.5,color:C.t3,whiteSpace:'nowrap',flexShrink:0}}>{relTime(n.created_at,ar)}</span></div>
            <p style={{fontSize:12,color:C.t2,lineHeight:1.5,...(isOpen?{whiteSpace:'pre-line'}:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'})}}>{ar?(n.body_ar||n.body):n.body}</p>
            {isOpen&&n.action_type&&<button onClick={e=>{e.stopPropagation();sPg(n.action_type==='subscriptions'?'subs':n.action_type);}} style={{marginTop:12,background:col,color:'#fff',border:'none',borderRadius:12,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{ar?(n.action_label_ar||n.action_label):n.action_label}</button>}
          </div>
          <Icon name="chevronD" size={14} color={C.t3} style={{flexShrink:0,marginTop:2,transition:'transform 0.25s ease',transform:isOpen?'rotate(180deg)':'rotate(0deg)'}}/>
        </div>
      </div>;}):<Empty icon="bell" label={t('noNotifs')}/>}
    </div>
  </Screen>;
}

// ═══════════════════════ MORE ═══════════════════════
function More(){
  const{t,ar,user,cfg,toggleLc,logout,lc,sPg}=useApp();
  const[sub,sSub]=useState('profile');const m=user?.member||user||{};const[unread,sUnread]=useState(0);
  useEffect(()=>{api.get('/api/pwa/member/notifications/unread-count').then(r=>sUnread(r.data.count||0)).catch(()=>{});},[]);
  const fn=[m.first_name,m.middle_name,m.last_name].filter(Boolean).join(' ')||m.full_name||m.name||'';
  const tabs=[['profile',t('profile')],['weight',t('weightTab')],['freeze',t('freeze')],['settings',t('settings')]];
  return <Screen>
    <div style={{padding:'16px 20px 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <h1 style={{fontSize:24,fontWeight:900,color:C.t1,letterSpacing:'-0.03em'}}>{t('more')}</h1>
      <button onClick={()=>sPg('notifs')} style={{width:38,height:38,borderRadius:12,background:C.surf,border:'none',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',cursor:'pointer'}}><Icon name="bell" size={17} color={C.t2}/>{unread>0&&<span style={{position:'absolute',top:7,insetInlineStart:7,width:7,height:7,background:C.red,borderRadius:50,border:'2px solid #e8f0f8'}}/>}</button>
    </div>
    <div style={{padding:'14px 22px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#14b8a6,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:28,boxShadow:'0 6px 20px rgba(59,130,246,0.35)'}}>{fn[0]||'؟'}</div>
      <div style={{textAlign:'center'}}><p style={{fontSize:18,fontWeight:800,color:C.t1,letterSpacing:'-0.02em'}}>{fn||'—'}</p><p style={{fontSize:12,color:C.t3,fontWeight:500,marginTop:2}}>{m.member_no||''}</p></div>
    </div>
    <div style={{margin:'12px 16px 0',background:'#e2eaf4',borderRadius:16,padding:5,display:'flex',gap:3}}>{tabs.map(([k,l])=><button key={k} onClick={()=>sSub(k)} style={{flex:1,padding:'9px 4px',border:'none',borderRadius:12,fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer',background:sub===k?'#fff':'transparent',color:sub===k?C.t1:'#64748b',boxShadow:sub===k?'0 2px 8px rgba(0,0,0,0.1)':'none'}}>{l}</button>)}</div>
    <div style={{padding:'12px 16px 0'}}>
      {sub==='profile'&&<ProfileTab m={m} fn={fn} t={t} ar={ar}/>}
      {sub==='weight'&&<WeightTab t={t} ar={ar}/>}
      {sub==='freeze'&&<FreezeTab t={t} ar={ar}/>}
      {sub==='settings'&&<SettingsTab t={t} ar={ar} lc={lc} toggleLc={toggleLc} logout={logout}/>}
    </div>
  </Screen>;
}
function ProfileTab({m,fn,t,ar}){
  const[ex,sEx]=useState(null);const[edit,sEdit]=useState(false);const[f,sF]=useState({height_cm:'',initial_weight_kg:'',fitness_goal:''});const[busy,sBusy]=useState(false);
  useEffect(()=>{api.get('/api/pwa/member/profile-extra').then(r=>{sEx(r.data);sF({height_cm:r.data?.height_cm||'',initial_weight_kg:r.data?.initial_weight_kg||'',fitness_goal:r.data?.fitness_goal||''});}).catch(()=>sEx({}));},[]);
  const save=async()=>{sBusy(true);try{await api.put('/api/pwa/member/profile-extra',f);sEx(p=>({...p,...f}));sEdit(false);toast(t('saved'));}catch(e){toast(e.message,'e');}sBusy(false);};
  const rows=[[t('name'),fn||'—',C.t1],[t('memberNo'),m.member_no||'—',C.blue],[t('mobile'),m.phone||'—',C.t1],[t('email'),m.email||'—',C.t3],[t('gender'),genderLabel(m.gender,ar),C.t1],[t('joined'),fmtD(m.joined_date||m.created_at),C.t1],[t('height'),ex?.height_cm?ex.height_cm+' '+t('cm'):'—',C.t1],[t('initialWeight'),ex?.initial_weight_kg?ex.initial_weight_kg+' '+t('kg'):'—',C.t1]];
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{...card,padding:'6px 18px'}}>{rows.map(([l,v,col],i)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 0',borderBottom:i<rows.length-1?'1px solid #f1f5f9':'none'}}><span style={{fontSize:11.5,color:C.t3}}>{l}</span><span dir="ltr" style={{fontSize:13,fontWeight:i===0?800:700,color:col}}>{v}</span></div>)}</div>
    {!edit?<button onClick={()=>sEdit(true)} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:16,padding:13,width:'100%',fontFamily:'inherit',fontSize:14,fontWeight:700,color:C.blue,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 2px 8px rgba(0,0,0,0.05)'}}><Icon name="edit" size={16} color={C.blue} w={2.5}/>{ar?'تعديل الملف الشخصي':'Edit profile'}</button>
    :<div style={{...card,padding:16}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        <div><label style={lbl}>{t('height')} ({t('cm')})</label><input type="number" value={f.height_cm} onChange={e=>sF(p=>({...p,height_cm:e.target.value}))} style={inp} dir="ltr"/></div>
        <div><label style={lbl}>{t('initialWeight')} ({t('kg')})</label><input type="number" value={f.initial_weight_kg} onChange={e=>sF(p=>({...p,initial_weight_kg:e.target.value}))} style={inp} dir="ltr"/></div>
      </div>
      <div style={{marginBottom:12}}><label style={lbl}>{ar?'الهدف':'Goal'}</label><select value={f.fitness_goal} onChange={e=>sF(p=>({...p,fitness_goal:e.target.value}))} style={inp}><option value="">—</option><option value="bulk">{ar?'تضخيم':'Bulk'}</option><option value="cut">{ar?'تنشيف':'Cut'}</option><option value="maintain">{ar?'محافظة':'Maintain'}</option></select></div>
      <div style={{display:'flex',gap:8}}><button onClick={save} disabled={busy} style={{flex:1,background:'linear-gradient(135deg,#2563eb,#3b82f6)',color:'#fff',border:'none',borderRadius:12,padding:'12px',fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>{t('save')}</button><button onClick={()=>sEdit(false)} style={{background:C.sub,color:C.t2,border:'none',borderRadius:12,padding:'12px 20px',fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>{ar?'إلغاء':'Cancel'}</button></div>
    </div>}
  </div>;
}
function WeightTab({t,ar}){
  const[d,sD]=useState(null);const[val,sVal]=useState('');const[busy,sBusy]=useState(false);
  const load=()=>api.get('/api/pwa/member/weight').then(r=>sD(r.data)).catch(()=>sD({logs:[]}));
  useEffect(()=>{load()},[]);
  const save=async()=>{const w=Number(val);if(!(w>0)){toast(t('errGeneric'),'e');return}sBusy(true);try{await api.post('/api/pwa/member/weight',{weight_kg:w});sVal('');toast(t('saved'));load();}catch(e){toast(e.message,'e')}sBusy(false)};
  if(!d)return <Loader/>;
  const logs=d.logs||[];const chg=Number(d.change||0);
  return <>
    <div style={{background:'linear-gradient(135deg,#16a34a,#22c55e)',borderRadius:20,padding:20,color:'#fff',marginBottom:12,boxShadow:'0 8px 24px rgba(34,197,94,0.3)'}}>
      <p style={{fontSize:13,color:'rgba(255,255,255,0.8)',marginBottom:6}}>{t('currentWeight')}</p>
      <div style={{display:'flex',alignItems:'baseline',gap:6}}><span style={{fontSize:44,fontWeight:900,lineHeight:1}}>{d.current||'—'}</span><span style={{fontSize:15,color:'rgba(255,255,255,0.75)'}}>{t('kg')}</span></div>
      {logs.length>1&&<p style={{fontSize:12,color:'rgba(255,255,255,0.85)',marginTop:8}}>{t('change')}: <span dir="ltr">{chg>0?'+':''}{chg} {t('kg')}</span></p>}
    </div>
    <div style={{...card,padding:14,marginBottom:12}}>
      <label style={{fontSize:12,fontWeight:600,color:C.t2,marginBottom:6,display:'block'}}>{t('logWeight')}</label>
      <div style={{display:'flex',gap:8}}><input value={val} onChange={e=>sVal(e.target.value)} type="number" inputMode="decimal" dir="ltr" placeholder="78.5" style={{...inp,flex:1}}/><button onClick={save} disabled={busy} style={{background:C.green,color:'#fff',border:'none',borderRadius:14,padding:'0 24px',fontSize:14,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>{t('save')}</button></div>
    </div>
    <div style={{...card,padding:14}}>
      <p style={{fontSize:14,fontWeight:800,color:C.t1,marginBottom:10}}>{t('weightHistory')}</p>
      {logs.length?logs.map((l,i)=>{const prev=logs[i+1];const dc=prev?+(l.weight_kg-prev.weight_kg).toFixed(1):0;return <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderTop:i?'1px solid '+C.sub:'none'}}><div><span dir="ltr" style={{fontSize:14,fontWeight:700,color:C.t1}}>{l.weight_kg} {t('kg')}</span></div><div style={{display:'flex',alignItems:'center',gap:10}}>{prev&&<span dir="ltr" style={{fontSize:11.5,fontWeight:700,color:dc>0?C.red:dc<0?C.green:C.t3}}>{dc>0?'+':''}{dc}</span>}<span dir="ltr" style={{fontSize:11.5,color:C.t3}}>{fmtD(l.logged_on)}</span></div></div>;}):<Empty icon="shield" label="—"/>}
    </div>
  </>;
}
function FreezeTab({t,ar}){
  const[d,sD]=useState(null);const[subs,sSubs]=useState([]);const[f,sF]=useState({membership_id:'',start_date:new Date().toISOString().split('T')[0],days:7,reason:''});
  const load=()=>api.get('/api/pwa/member/freezes').then(r=>sD(r.data||[])).catch(()=>sD([]));
  useEffect(()=>{load();api.get('/api/pwa/member/subscriptions').then(r=>{sSubs(r.data||[]);if(r.data?.[0])sF(p=>({...p,membership_id:r.data[0].id}))}).catch(()=>{});},[]);
  const req=async()=>{try{const dt=new Date(f.start_date);dt.setDate(dt.getDate()+Number(f.days||0));await api.post('/api/pwa/member/freezes/request',{membership_id:f.membership_id,start_date:f.start_date,end_date:dt.toISOString().split('T')[0],reason:f.reason});toast(t('saved'));load();}catch(e){toast(e.message,'e')}};
  if(!d)return <Loader/>;
  return <>
    <div style={{...card,padding:16,marginBottom:12}}>
      <p style={{fontSize:14,fontWeight:800,color:C.t1,marginBottom:12}}>{t('requestFreeze')}</p>
      <div style={{marginBottom:10}}><label style={lbl}>{t('subscriptions')}</label><select value={f.membership_id} onChange={e=>sF(p=>({...p,membership_id:e.target.value}))} style={inp}>{subs.map(s=><option key={s.id} value={s.id}>{s.plan_name||('#'+s.id)}</option>)}</select></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}><div><label style={lbl}>{t('start')}</label><input type="date" value={f.start_date} onChange={e=>sF(p=>({...p,start_date:e.target.value}))} style={inp}/></div><div><label style={lbl}>{t('day')}</label><input type="number" value={f.days} onChange={e=>sF(p=>({...p,days:e.target.value}))} style={inp}/></div></div>
      <div style={{marginBottom:12}}><label style={lbl}>{t('freezeReason')}</label><textarea rows="3" value={f.reason} onChange={e=>sF(p=>({...p,reason:e.target.value}))} style={{...inp,resize:'none'}}/></div>
      <button onClick={req} style={{width:'100%',background:'linear-gradient(135deg,#4f46e5,#6366f1)',color:'#fff',border:'none',borderRadius:14,padding:'13px',fontSize:14,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>{t('requestFreeze')}</button>
    </div>
    <div style={{...card,padding:16}}>
      <p style={{fontSize:14,fontWeight:800,color:C.t1,marginBottom:10}}>{t('freezeHistory')}</p>
      {d.length?d.map((x,i)=><div key={x.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderTop:i?'1px solid '+C.sub:'none'}}><div><p style={{fontSize:13,fontWeight:700,color:C.t1}}>{x.plan_name||'—'}</p><p dir="ltr" style={{fontSize:11,color:C.t3}}>{fmtD(x.start_date)} → {fmtD(x.end_date)}</p></div><span style={{fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:8,background:x.status==='completed'?'#f0fdf4':'#eef2ff',color:x.status==='completed'?C.green:C.indigo}}>{L[ar?'ar':'en'][x.status]||x.status}</span></div>):<Empty icon="lock" label="—"/>}
    </div>
  </>;
}
function SettingsTab({t,ar,lc,toggleLc,logout}){
  const[prefs,sPrefs]=useState(null);
  useEffect(()=>{api.get('/api/pwa/member/notification-prefs').then(r=>sPrefs(r.data)).catch(()=>sPrefs({}));},[]);
  const toggle=async(k)=>{const next={...prefs,[k]:prefs[k]?0:1};sPrefs(next);try{await api.put('/api/pwa/member/notification-prefs',{prefs:next});}catch(_){load();}};
  const keys=[['subscription',t('prefSub')],['workouts',t('prefWorkout')],['meals',t('prefMeals')],['water',t('prefWater')],['offers',t('prefOffers')],['trainer',t('prefTrainer')]];
  return <>
    <div style={{...card,padding:16,marginBottom:12}}>
      <p style={{fontSize:14,fontWeight:800,color:C.t1,marginBottom:8}}>{t('notifPrefs')}</p>
      {prefs?keys.map(([k,l],i)=><div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderTop:i?'1px solid '+C.sub:'none'}}><span style={{fontSize:13,color:C.t2,fontWeight:600}}>{l}</span><Toggle on={!!prefs[k]} onClick={()=>toggle(k)}/></div>):<Loader/>}
    </div>
    <div style={{...card,padding:16,marginBottom:12}}>
      <p style={{fontSize:14,fontWeight:800,color:C.t1,marginBottom:8}}>{t('appSettings')}</p>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0'}}><span style={{fontSize:13,color:C.t2,fontWeight:600}}>{t('language')}</span><button onClick={toggleLc} style={{background:C.sub,border:'none',borderRadius:10,padding:'6px 14px',fontSize:12.5,fontWeight:700,color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>{lc==='ar'?'English':'العربية'}</button></div>
    </div>
    <div style={{...card,overflow:'hidden'}}>
      <Link icon="help" label={t('support')}/>
      <Link icon="lock" label={t('privacy')} border/>
      <div onClick={logout} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderTop:'1px solid '+C.sub,cursor:'pointer'}}><Icon name="logout" size={18} color={C.red}/><span style={{fontSize:14,fontWeight:700,color:C.red}}>{t('logout')}</span></div>
    </div>
    <p style={{textAlign:'center',fontSize:11,color:'#cbd5e1',fontWeight:500,padding:'14px 0'}}>{ar?'الإصدار':'Version'} 1.0.0 · Gram Gym</p>
  </>;
}
function Toggle({on,onClick}){return <button onClick={onClick} style={{width:46,height:26,borderRadius:100,border:'none',background:on?C.blue:'#e2e8f0',position:'relative',cursor:'pointer',transition:'background .2s',flexShrink:0}}><span style={{position:'absolute',top:3,insetInlineStart:on?23:3,width:20,height:20,borderRadius:50,background:'#fff',transition:'inset-inline-start .2s',boxShadow:'0 2px 4px rgba(0,0,0,0.15)'}}/></button>;}
function Link({icon,label,border}){return <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',...(border?{borderTop:'1px solid '+C.sub}:{}),cursor:'pointer'}}><Icon name={icon} size={18} color={C.t2}/><span style={{flex:1,fontSize:14,fontWeight:600,color:C.t1}}>{label}</span><Icon name="chevron" size={16} color={C.t3}/></div>;}
const lbl={fontSize:11,fontWeight:600,color:C.t2,marginBottom:5,display:'block'};

// ── shared ──
function Head({title}){return <div style={{padding:'18px 20px 14px'}}><h1 style={{fontSize:22,fontWeight:900,color:C.t1,textAlign:'center'}}>{title}</h1></div>;}
function Loader(){return <div style={{display:'flex',justifyContent:'center',padding:'50px 0'}}><div style={{width:28,height:28,border:'3px solid '+C.line,borderTopColor:C.blue,borderRadius:'50%',animation:'spin .8s linear infinite'}}/></div>;}
function Empty({icon,label}){return <div style={{padding:'34px 20px',textAlign:'center'}}><div style={{width:52,height:52,borderRadius:16,background:C.sub,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}><Icon name={icon} size={24} color={C.t4}/></div><p style={{fontSize:13,color:C.t3}}>{label}</p></div>;}

// simple toast
function toast(msg,type){let el=document.getElementById('mtoast');if(!el){el=document.createElement('div');el.id='mtoast';el.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:110px;z-index:400;max-width:360px;width:calc(100% - 40px);text-align:center;';document.body.appendChild(el);}const b=document.createElement('div');b.textContent=msg;b.style.cssText=`background:${type==='e'?'#ef4444':'#0f172a'};color:#fff;padding:12px 18px;border-radius:14px;font-size:13px;font-weight:600;margin-top:8px;box-shadow:0 8px 24px rgba(0,0,0,0.25);animation:slideUp .3s;`;el.appendChild(b);setTimeout(()=>b.remove(),2600);}

// ── bottom nav ──
function NavIcon({name,active,size=20}){
  const stroke=active?'#fff':'#64748b';const sw=active?2.5:2;
  const svg=(children,fill)=><svg width={size} height={size} viewBox="0 0 24 24" fill={fill||'none'} stroke={fill?'none':stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
  if(name==='home')return svg(<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>, active?'#fff':null);
  if(name==='subs')return svg(<React.Fragment><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></React.Fragment>);
  if(name==='train')return svg(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>);
  if(name==='nutrition')return svg(<React.Fragment><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/></React.Fragment>);
  return svg(<React.Fragment><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></React.Fragment>);
}
function Tabs(){const{pg,sPg,t}=useApp();
  const items=[['home',C.blue],['subs',C.blue],['train','#8b5cf6'],['nutrition',C.blue],['more','#6366f1']];
  const labels={home:t('home'),subs:t('subscriptions'),train:t('training'),nutrition:t('nutrition'),more:t('more')};
  return <div style={{position:'fixed',bottom:0,left:0,right:0,display:'flex',justifyContent:'center',padding:'0 16px calc(14px + env(safe-area-inset-bottom))',pointerEvents:'none',zIndex:100}}>
    <div style={{width:'100%',maxWidth:408,background:C.nav,borderRadius:100,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-around',boxShadow:'0 12px 40px rgba(15,23,42,0.35)',pointerEvents:'auto'}}>
      {items.map(([k,acc])=>{const active=pg===k||(k==='home'&&pg==='notifs');return active?
        <button key={k} onClick={()=>sPg(k)} style={{display:'flex',alignItems:'center',gap:7,background:acc,border:'none',borderRadius:100,padding:'10px 18px',cursor:'pointer',boxShadow:'0 4px 14px '+acc+'73'}}><NavIcon name={k} active size={18}/><span style={{fontSize:12,fontWeight:700,color:'#fff'}}>{labels[k]}</span></button>
        :<button key={k} onClick={()=>sPg(k)} style={{width:44,height:44,borderRadius:'50%',background:'none',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><NavIcon name={k} size={20}/></button>;})}
    </div>
  </div>;
}

// ── error boundary ──
class ErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={err:null,key:p.resetKey};}
  static getDerivedStateFromError(err){return{err};}
  static getDerivedStateFromProps(props,state){if(props.resetKey!==state.key)return{err:null,key:props.resetKey};return null;}
  componentDidCatch(err,info){try{console.error('[member-pwa]',err,info);}catch(_){}}
  render(){if(this.state.err){const ar=(localStorage.getItem('mem_lc')||'ar')==='ar';return <div style={{minHeight:'60vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}><div style={{fontSize:44,marginBottom:12}}>⚠️</div><h3 style={{fontSize:16,fontWeight:800,color:C.t1,marginBottom:8}}>{ar?'حدث خطأ غير متوقع':'Something went wrong'}</h3><button onClick={()=>window.location.reload()} style={{...btnP,maxWidth:200}}>{ar?'إعادة المحاولة':'Reload'}</button></div>;}return this.props.children;}
}

function Shell(){const{pg}=useApp();return <div style={{background:C.bg,minHeight:'100vh'}}><ErrorBoundary resetKey={pg}>
  {pg==='home'&&<Home/>}{pg==='subs'&&<Subs/>}{pg==='train'&&<Train/>}{pg==='nutrition'&&<Nutrition/>}{pg==='notifs'&&<Notifs/>}{pg==='more'&&<More/>}
</ErrorBoundary><Tabs/></div>;}
// Dark GRAMS-GYM reveal that plays once right AFTER login, then hands off to the app.
function Splash({onDone}){
  const ref=React.useRef(null);
  React.useEffect(()=>{
    const root=ref.current; if(!root){onDone&&onDone();return;}
    const q=s=>root.querySelector(s), qa=s=>root.querySelectorAll(s);
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gL=q('.gy-gL'),gR=q('.gy-gR'),flash=q('.gy-flash'),shock=q('.gy-shock'),mark=q('.gy-mark'),uline=q('.gy-uline'),tag=q('.gy-tag'),words=qa('.gy-w');
    const SPRING='cubic-bezier(.16,1,.3,1)',IMPACT='cubic-bezier(.2,.9,.25,1.3)';
    const timers=[]; const T=(ms,fn)=>timers.push(setTimeout(fn,ms));
    const A=(el,kf,o)=>{try{el&&el.animate(kf,o)}catch(_){}};
    const finish=()=>{ root.style.opacity='0'; T(560,()=>onDone&&onDone()); };
    if(reduce){ T(750,finish); return ()=>timers.forEach(clearTimeout); }
    A(gL,[{opacity:0,transform:'translateX(-170px) rotate(-14deg)'},{opacity:1,transform:'translateX(0) rotate(0)'}],{duration:720,easing:IMPACT,fill:'forwards'});
    A(gR,[{opacity:0,transform:'translateX(170px) rotate(14deg)'},{opacity:1,transform:'translateX(0) rotate(0)'}],{duration:720,easing:IMPACT,fill:'forwards'});
    T(560,()=>{
      A(flash,[{opacity:0,transform:'scale(.2)'},{opacity:1,transform:'scale(1)',offset:.25},{opacity:0,transform:'scale(1.6)'}],{duration:560,easing:'ease-out',fill:'forwards'});
      A(shock,[{opacity:.9,transform:'scale(.3)'},{opacity:0,transform:'scale(3.4)'}],{duration:620,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
      A(mark,[{transform:'translateX(0) scale(1)',filter:'brightness(1)'},{transform:'translateX(-5px) scale(1.06)',filter:'brightness(2.2)',offset:.2},{transform:'translateX(5px) scale(1.04)',offset:.45},{transform:'translateX(-2px) scale(1.01)',offset:.7},{transform:'translateX(0) scale(1)',filter:'brightness(1)'}],{duration:460,easing:'ease-out',fill:'forwards'});
    });
    words.forEach((w,i)=>T(820+i*140,()=>A(w,[{opacity:0,transform:'translateY(18px)',filter:'blur(10px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:520,easing:SPRING,fill:'forwards'})));
    T(1200,()=>A(uline,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:520,easing:SPRING,fill:'forwards'}));
    T(1500,()=>A(tag,[{opacity:0},{opacity:1}],{duration:480,fill:'forwards'}));
    T(2650,finish);
    return ()=>timers.forEach(clearTimeout);
  },[]);
  return <div id="gy-splash" ref={ref} aria-hidden="true" style={{position:'fixed',inset:0,zIndex:99999,display:'grid',placeItems:'center',direction:'ltr',background:'radial-gradient(120% 90% at 50% 42%,#131313 0%,#060607 72%)',transition:'opacity .5s ease'}}>
    <div className="gy-lockup">
      <div className="gy-mark">
        <svg className="gy-g gy-gL" viewBox="0 0 116 120"><path d="M90 22 L40 22 L26 36 L26 84 L40 98 L90 98 L90 74 L58 74"/></svg>
        <svg className="gy-g gy-gR" viewBox="0 0 116 120"><g transform="translate(116,0) scale(-1,1)"><path d="M90 22 L40 22 L26 36 L26 84 L40 98 L90 98 L90 74 L58 74"/></g></svg>
        <div className="gy-flash"></div><div className="gy-shock"></div>
      </div>
      <div className="gy-word" aria-label="GRAMS GYM"><span className="gy-w gy-grams">GRAMS</span><span className="gy-w gy-gym">GYM</span></div>
      <div className="gy-uline"></div>
      <div className="gy-tag">Strength in numbers</div>
    </div>
  </div>;
}
function App(){
  const{user,ld,setRevealed}=useApp();
  const[splash,setSplash]=React.useState(true); // GRAMS reveal plays on every app open
  const content = ld
    ? <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}><Loader/></div>
    : (!user ? <Login/> : <Shell/>);
  return <React.Fragment>{content}{splash&&<Splash onDone={()=>{setSplash(false);setRevealed&&setRevealed(true);}}/>}</React.Fragment>;
}

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
ReactDOM.createRoot(document.getElementById('app')).render(<Provider><App/></Provider>);

const { useState, useEffect, useCallback } = React;
const { api, useI18n, useRouter, Modal, Ic, toast, formatMoney } = shared;

function FreezePage(){
  const{t,formatDateTime}=useI18n();
  const[items,sI]=useState([]);const[meta,sMeta]=useState({total:0,page:1});const[sf,sSf]=useState('');const[search,sSrch]=useState('');
  const[showCreate,sSC]=useState(false);const[viewing,sView]=useState(null);const[rules,sRules]=useState(null);const[stats,sStats]=useState(null);
  const{param}=useRouter();const filterStatus=param('status')||'';
  const load=useCallback((page=1)=>{const p=new URLSearchParams({page,limit:20,status:sf||filterStatus,search});api.get('/api/freeze?'+p).then(r=>{sI(r.data);sMeta(r.meta)}).catch(()=>{})},[sf,search,filterStatus]);
  useEffect(()=>{load();api.get('/api/freeze/rules').then(r=>sRules(r.data)).catch(()=>{});api.get('/api/freeze/stats').then(r=>sStats(r.data)).catch(()=>{})},[load]);
  return <div>
    <div className="ph"><h1>{t('freeze.title','Freeze')}</h1><p>{t('freeze.desc','Freeze requests, approvals, payments and receipts.')}</p><div className="acts"><button className="btn btn-p" onClick={()=>sSC(true)}><Ic name="snowflake" size={14}/>{t('freeze.newFreeze','New Freeze')}</button></div></div>
    <div className="pb">
      {stats&&<div className="sg" style={{gridTemplateColumns:'repeat(5,1fr)'}}>{[['requested',stats.requested],['pending',stats.pending],['active',stats.active],['completed',stats.completed],['revenueMonth',stats.revenueMonth]].map(([k,v])=><div className="sc" key={k}><div className="sl">{k==='revenueMonth'?t('freeze.revenueMonth','Revenue'):t('status.'+k,k)}</div><div className="sv">{k==='revenueMonth'?formatMoney(v||0,rules?.currency||'JOD'):v||0}</div></div>)}</div>}
      <div className="fb"><input className="fi" placeholder={(t('btn.search','Search'))+'...'} value={search} onChange={e=>sSrch(e.target.value)}/>
        <select className="fi" value={sf||filterStatus} onChange={e=>sSf(e.target.value)}>
          <option value="">{t('common.all','All')}</option><option value="requested">{t('status.requested','Requested')}</option><option value="pending">{t('status.pending','Pending')}</option><option value="active">{t('status.active','Active')}</option><option value="completed">{t('status.completed','Completed')}</option><option value="cancelled">{t('status.cancelled','Cancelled')}</option>
        </select>
        <button className="btn btn-s" onClick={()=>load(1)}>{t('common.refresh','Refresh')}</button></div>
      <div className="card"><table><thead><tr><th>{t('memberships.member','Member')}</th><th>{t('memberships.plan','Plan')}</th><th>{t('freeze.period','Period')}</th><th>{t('freeze.days','Days')}</th><th>{t('common.price','Price')}</th><th>{t('freeze.payment','Payment')}</th><th>{t('common.status','Status')}</th><th>{t('common.actions','Actions')}</th></tr></thead>
        <tbody>{items.length?items.map(f=><tr key={f.id}>
          <td><strong style={{fontSize:12}}>{f.first_name} {f.last_name}</strong><div style={{fontSize:11,color:'var(--t4)'}}>{f.member_no} · {f.phone||'—'}<br/>{f.receipt_no||''}</div></td>
          <td style={{fontSize:12}}>{f.plan_name||'—'}</td><td style={{fontSize:11,color:'var(--t3)'}}>{f.start_date} → {f.end_date}</td><td style={{fontSize:12}}>{f.total_days}</td>
          <td style={{fontSize:12}}>{f.price>0?formatMoney(f.price,rules?.currency||'JOD'):t('common.free','Free')}</td>
          <td><span className={'badge b-'+(f.payment_status||'unpaid')}>{t('status.'+(f.payment_status||'unpaid'),f.payment_status||'unpaid')}</span></td>
          <td><span className={'badge b-'+f.status}>{t('status.'+f.status,f.status)}</span></td>
          <td><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {f.status==='requested'&&<button className="btn btn-g btn-sm" onClick={async()=>{try{await api.post('/api/freeze/'+f.id+'/approve',{});toast(t('freeze.approved','Approved'));load()}catch(e){toast(e.message,'e')}}}>{t('freeze.approve','Approve')}</button>}
            {['pending','requested'].includes(f.status)&&f.price>0&&<button className="btn btn-p btn-sm" onClick={()=>sView(f.id)}>{t('btn.pay','Pay')}</button>}
            {f.unfreeze_requested_at&&f.status==='active'&&<button className="btn btn-p btn-sm" onClick={async()=>{try{await api.post('/api/freeze/'+f.id+'/approve-unfreeze',{});toast(t('freeze.unfreezeApproved','Unfreeze approved'));load()}catch(e){toast(e.message,'e')}}}>{t('freeze.unfreezeApprove','Approve Unfreeze')}</button>}
            {(f.payment_status==='paid'||f.payment_status==='partial')&&<button className="btn btn-s btn-sm" onClick={()=>sView({id:f.id,mode:'refund'})}>{t('common.refund','Refund')}</button>}
            <button className="btn btn-s btn-sm" onClick={()=>sView(f.id)}><Ic name="eye" size={13}/></button>
          </div></td>
        </tr>):<tr><td colSpan="8"><div className="empty"><h3>{t('freeze.noFreezes','No freezes')}</h3></div></td></tr>}</tbody></table></div>
    </div>
    {showCreate&&<CreateFreezeModal onClose={()=>sSC(false)} onCreated={()=>{sSC(false);load()}} rules={rules}/>}
    {viewing&&<FreezeDetailModal id={typeof viewing==='object'?viewing.id:viewing} mode={typeof viewing==='object'?viewing.mode:'view'} onClose={()=>sView(null)} onAction={()=>{sView(null);load()}}/>}
  </div>;
}

function CreateFreezeModal({onClose,onCreated,rules}){
  const{t}=useI18n();const[f,sF]=useState({membership_id:'',start_date:new Date().toISOString().split('T')[0],end_date:'',days:7,reason:''});
  const[mSearch,sMSearch]=useState('');const[mResults,sMR]=useState([]);const[selMs,sSelMs]=useState(null);const[preview,sPrev]=useState(null);const[elig,sElig]=useState(null);const[step,sStep]=useState('select');
  const s=(k,v)=>sF(p=>({...p,[k]:v}));
  useEffect(()=>{if(mSearch.length<1)return sMR([]);const tm=setTimeout(()=>{api.get('/api/freeze/search-memberships?search='+encodeURIComponent(mSearch)).then(r=>sMR(r.data)).catch(()=>{})},250);return()=>clearTimeout(tm)},[mSearch]);
  useEffect(()=>{if(f.start_date&&f.days>0){const d=new Date(f.start_date);d.setDate(d.getDate()+Number(f.days));s('end_date',d.toISOString().split('T')[0])}},[f.start_date,f.days]);
  const selectMs=async(ms)=>{sSelMs(ms);s('membership_id',ms.id);try{const r=await api.get('/api/freeze/eligibility/'+ms.id);sElig(r.data);if(r.data.eligible)sStep('dates')}catch(_){} };
  const doPreview=async()=>{try{const r=await api.post('/api/freeze/preview',{membership_id:f.membership_id,start_date:f.start_date,end_date:f.end_date});sPrev(r.data);if(r.data.valid)sStep('confirm')}catch(_){} };
  const submit=async()=>{try{const r=await api.post('/api/freeze',{membership_id:f.membership_id,start_date:f.start_date,end_date:f.end_date,reason:f.reason});toast(r.requiresApproval?t('freeze.sentForApproval','Sent for approval'):(r.requiresPayment?t('freeze.createPending','Pending payment'):t('freeze.freezeNow','Frozen')));onCreated()}catch(e){toast(e.message,'e')}};
  return<Modal title={t('freeze.createFreeze','Create Freeze')} onClose={onClose} wide><div className="mdl-b">
    {step==='select'&&<div><div className="fg"><label>{t('freeze.searchMembership','Search membership')}</label><input className="fi" placeholder={t('freeze.searchPlaceholder','Search by phone, name, member no, or plan')} value={mSearch} onChange={e=>sMSearch(e.target.value)}/>
      {mResults.length>0&&<div style={{border:'1px solid var(--border)',borderRadius:6,marginTop:4,maxHeight:260,overflow:'auto'}}>{mResults.map(ms=><div key={ms.id} style={{padding:'10px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',gap:10}} onClick={()=>selectMs(ms)}><span>{ms.first_name} {ms.middle_name||''} {ms.last_name}</span><span style={{color:'var(--t3)',fontSize:12}}>{ms.phone||ms.member_no} · {ms.plan_name}</span></div>)}</div>}</div>
      {selMs&&elig&&<div className="card" style={{background:'var(--bg-1)'}}><div style={{fontWeight:600,fontSize:13}}>{selMs.first_name} {selMs.last_name} — {selMs.plan_name}</div>
      {elig.eligible?<div style={{marginTop:6}}><span className="badge b-active">{t('freeze.eligible','Eligible')}</span><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{t('freeze.remaining','Remaining')}: {elig.remainingDays} {t('freeze.days','days')}</div><button className="btn btn-p btn-sm" onClick={()=>sStep('dates')} style={{marginTop:8}}>{t('freeze.continue','Continue')}</button></div>:<div style={{marginTop:6,color:'var(--red)'}}>{elig.reason}</div>}</div>}</div>}
    {step==='dates'&&<div><div className="fr3"><div className="fg"><label>{t('memberships.startDate','Start')}</label><input className="fi" type="date" value={f.start_date} onChange={e=>s('start_date',e.target.value)}/></div><div className="fg"><label>{t('freeze.days','Days')}</label><input className="fi" type="number" value={f.days} min={rules?.minDays||1} onChange={e=>s('days',Number(e.target.value)||0)}/></div><div className="fg"><label>{t('memberships.endDate','End')}</label><input className="fi" type="date" readOnly value={f.end_date}/></div></div><div className="fg"><label>{t('common.reason','Reason')}</label><textarea className="fi" rows="3" value={f.reason} onChange={e=>s('reason',e.target.value)}/></div><div style={{display:'flex',gap:8}}><button className="btn btn-s" onClick={()=>sStep('select')}>{t('btn.back','Back')}</button><button className="btn btn-p" onClick={doPreview}>{t('freeze.previewContinue','Preview')}</button></div>{preview&&!preview.valid&&<div style={{marginTop:8}}>{(preview.errors||[]).map((e,i)=><div key={i} style={{color:'var(--red)'}}>• {e}</div>)}</div>}</div>}
    {step==='confirm'&&preview&&<div className="card" style={{padding:16}}><div className="ct">{t('freeze.summary','Summary')}</div><div className="dg"><div className="di"><div className="dl">{t('memberships.member','Member')}</div><div className="dv">{selMs?.first_name} {selMs?.last_name}</div></div><div className="di"><div className="dl">{t('memberships.plan','Plan')}</div><div className="dv">{selMs?.plan_name}</div></div><div className="di"><div className="dl">{t('freeze.duration','Duration')}</div><div className="dv">{preview.totalDays} {t('freeze.days','Days')}</div></div><div className="di"><div className="dl">{t('common.price','Price')}</div><div className="dv">{formatMoney(preview.price||0,preview.currency||'JOD')}</div></div></div><div style={{display:'flex',gap:8,marginTop:12}}><button className="btn btn-s" onClick={()=>sStep('dates')}>{t('btn.back','Back')}</button><button className="btn btn-p" onClick={submit}>{t('btn.confirm','Confirm')}</button></div></div>}
  </div></Modal>
}

function FreezeDetailModal({id,mode,onClose,onAction}){
  const{t,formatDateTime}=useI18n();const[f,sF]=useState(null);const[pays,sPays]=useState([{method:'cash',amount:'',reference:''}]);const[refund,setRefund]=useState({amount:'',reason:''});
  useEffect(()=>{api.get('/api/freeze/'+id).then(r=>{sF(r.data);if(r.data?.price) setRefund({amount:String(r.data.price||''),reason:''})}).catch(()=>{})},[id]);
  const addLine=()=>sPays(p=>[...p,{method:'cash',amount:'',reference:''}]);
  const upd=(idx,key,val)=>sPays(p=>p.map((x,i)=>i===idx?{...x,[key]:val}:x));
  if(!f)return<Modal title={t('common.loading','Loading')} onClose={onClose}><div className="mdl-b"><div className="pld"><span className="spinner"/></div></div></Modal>;
  const receipt=async()=>{try{const r=await api.get('/api/freeze/'+id+'/receipt');const rt=r.data;alert([`Receipt: ${rt.freeze.receipt_no||rt.freeze.id}`,`Member: ${rt.freeze.first_name} ${rt.freeze.last_name}`,`Plan: ${rt.freeze.plan_name||''}`,`Total: ${rt.totals.total}`,`Paid: ${rt.totals.paid}`,`Refunded: ${rt.totals.refunded}`,`Balance: ${rt.totals.balance}`].join('\n'))}catch(e){toast(e.message,'e')}};
  return<Modal title={mode==='refund'?t('common.refund','Refund'):t('freeze.details','Details')} onClose={onClose} wide><div className="mdl-b">
    <div className="dg"><div className="di"><div className="dl">{t('memberships.member','Member')}</div><div className="dv">{f.first_name} {f.last_name}</div></div><div className="di"><div className="dl">{t('memberships.plan','Plan')}</div><div className="dv">{f.plan_name||'—'}</div></div><div className="di"><div className="dl">{t('freeze.period','Period')}</div><div className="dv">{f.start_date} → {f.end_date}</div></div><div className="di"><div className="dl">{t('common.status','Status')}</div><div className="dv">{f.status}</div></div><div className="di"><div className="dl">{t('common.price','Price')}</div><div className="dv">{formatMoney(f.price||0,'JOD')}</div></div><div className="di"><div className="dl">{t('common.date','Date')}</div><div className="dv">{formatDateTime(f.created_at)}</div></div></div>
    <div className="card" style={{padding:14,marginTop:12}}>
      <div className="ct">{t('freeze.receipt','Receipt / POS')}</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        <button className="btn btn-s" onClick={receipt}>{t('freeze.viewReceipt','View receipt')}</button>
        {f.status==='requested'&&<button className="btn btn-g" onClick={async()=>{try{await api.post('/api/freeze/'+f.id+'/approve',{});toast(t('freeze.approved','Approved'));onAction()}catch(e){toast(e.message,'e')}}}>{t('freeze.approve','Approve')}</button>}
        {f.status==='active'&&f.unfreeze_requested_at&&<button className="btn btn-p" onClick={async()=>{try{await api.post('/api/freeze/'+f.id+'/approve-unfreeze',{});toast(t('freeze.unfreezeApproved','Unfreeze approved'));onAction()}catch(e){toast(e.message,'e')}}}>{t('freeze.unfreezeApprove','Approve Unfreeze')}</button>}
      </div>
      {mode!=='refund'&&['requested','pending','active'].includes(f.status)&&Number(f.price||0)>0&&<div>
        <div style={{fontWeight:700,marginBottom:8}}>{t('freeze.recordPayment','Record payment')}</div>
        {pays.map((p,idx)=><div className="fr3" key={idx} style={{marginBottom:8}}><select className="fi" value={p.method} onChange={e=>upd(idx,'method',e.target.value)}><option value="cash">Cash</option><option value="click">Click</option><option value="visa">Visa</option><option value="bank">Bank</option></select><input className="fi" type="number" placeholder={t('common.amount','Amount')} value={p.amount} onChange={e=>upd(idx,'amount',e.target.value)}/><input className="fi" placeholder={t('freeze.ref','Reference')} value={p.reference} onChange={e=>upd(idx,'reference',e.target.value)}/></div>)}
        <div style={{display:'flex',gap:8}}><button className="btn btn-s" onClick={addLine}>{t('common.add','Add line')}</button><button className="btn btn-p" onClick={async()=>{try{await api.post('/api/freeze/'+f.id+'/pay',{payments:pays});toast(t('freeze.recordPayment','Paid'));onAction()}catch(e){toast(e.message,'e')}}}>{t('btn.pay','Pay')}</button></div>
      </div>}
      {(mode==='refund' || (f.payment_status==='paid'||f.payment_status==='partial'))&&<div style={{marginTop:16}}>
        <div style={{fontWeight:700,marginBottom:8}}>{t('common.refund','Refund / cancel payment')}</div>
        <div className="fr"><input className="fi" type="number" placeholder={t('common.amount','Amount')} value={refund.amount} onChange={e=>setRefund(p=>({...p,amount:e.target.value}))}/><input className="fi" placeholder={t('common.reason','Reason')} value={refund.reason} onChange={e=>setRefund(p=>({...p,reason:e.target.value}))}/></div>
        <button className="btn btn-d" style={{marginTop:8}} onClick={async()=>{try{await api.post('/api/freeze/'+f.id+'/refund',refund);toast(t('common.refund','Refunded'));onAction()}catch(e){toast(e.message,'e')}}}>{t('common.refund','Refund')}</button>
      </div>}
      {f.payments?.length>0&&<table style={{marginTop:14}}><thead><tr><th>{t('common.date','Date')}</th><th>{t('common.method','Method')}</th><th>{t('common.amount','Amount')}</th><th>{t('common.status','Status')}</th><th>{t('freeze.ref','Reference')}</th></tr></thead><tbody>{f.payments.map(p=><tr key={p.id}><td>{formatDateTime(p.created_at)}</td><td>{p.method}</td><td>{formatMoney(p.amount||0,'JOD')}</td><td>{p.status}</td><td>{p.reference||p.payment_no||'—'}</td></tr>)}</tbody></table>}
    </div>
  </div></Modal>
}
GymOS.registerPage({ path:'/freeze', component:FreezePage, module:'membership-freeze', label:'Freeze Mgmt', labelAr:'إدارة التجميد', order:22 });
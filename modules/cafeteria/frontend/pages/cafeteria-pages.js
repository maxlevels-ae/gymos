// ═══════════════════════════════════════════════════════════
// GymOS Cafeteria V2 — Odoo-style POS + Management Workspace
// Full top-nav workspace with improved Odoo-style POS
// All GymOS native classes preserved throughout
// ═══════════════════════════════════════════════════════════
(function(){
  const { useState, useEffect, useMemo, useCallback, useRef } = React;
  const { api, useI18n, useRouter, Modal, Ic, toast, formatMoney } = shared;

  // ── Helpers ──────────────────────────────────────────────
  function fmt(v,c){ return formatMoney ? formatMoney(v||0,c) : Number(v||0).toFixed(2); }

  function useLoad(url, deps=[], fallback=[]){
    const [data,setData]=useState(fallback);
    const [loading,setLoading]=useState(true);
    const reload=useCallback(()=>{
      let live=true; setLoading(true);
      api.get(url)
        .then(r=>{ if(live) setData(r.data??fallback); })
        .catch(()=>{ if(live) setData(Array.isArray(fallback)?[]:fallback); })
        .finally(()=>{ if(live) setLoading(false); });
      return ()=>{live=false;};
    },[url]);
    useEffect(()=>reload(),[...deps,url]);
    return [data,loading,setData,reload];
  }

  function useCafMeta(){
    const [meta,setMeta]=useState({categories:[],warehouses:[],paymentMethods:[],openSession:null,currency:'JOD'});
    const load=useCallback(()=>api.get('/api/cafeteria/meta').then(r=>setMeta(r.data)).catch(()=>{}),[]);
    useEffect(()=>{load();},[]);
    return [meta,load];
  }

  // Product emoji based on category / name
  function productEmoji(p){
    const n=(p.name||'').toLowerCase();
    const c=(p.category_name||'').toLowerCase();
    if(n.includes('coffee')||n.includes('كوفي')||n.includes('قهوة')) return '☕';
    if(n.includes('tea')||n.includes('شاي')) return '🍵';
    if(n.includes('juice')||n.includes('عصير')) return '🧃';
    if(n.includes('water')||n.includes('ماء')) return '💧';
    if(n.includes('milk')||n.includes('حليب')) return '🥛';
    if(n.includes('sandwich')||n.includes('ساندويش')) return '🥪';
    if(n.includes('burger')||n.includes('برغر')) return '🍔';
    if(n.includes('pizza')||n.includes('بيتزا')) return '🍕';
    if(n.includes('salad')||n.includes('سلطة')) return '🥗';
    if(n.includes('cake')||n.includes('كيك')) return '🍰';
    if(n.includes('cookie')||n.includes('كوكيز')) return '🍪';
    if(n.includes('chocolate')||n.includes('شوكولا')) return '🍫';
    if(n.includes('protein')||n.includes('بروتين')) return '💪';
    if(n.includes('energy')||n.includes('طاقة')) return '⚡';
    if(n.includes('snack')||n.includes('وجبة خفيفة')) return '🍿';
    if(c.includes('drink')||c.includes('beverage')||c.includes('مشروب')) return '🥤';
    if(c.includes('food')||c.includes('meal')||c.includes('طعام')) return '🍽️';
    if(c.includes('sweet')||c.includes('dessert')||c.includes('حلو')) return '🍬';
    return '🛒';
  }

  // White line-icon for a product's teal tile (matches design handoff)
  function prodIcon(p){
    const s={width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'white',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'};
    const n=((p.name||'')+' '+(p.name_ar||'')).toLowerCase();
    const c=((p.category_name||'')+' '+(p.category_name_ar||'')).toLowerCase();
    const has=(...k)=>k.some(w=>n.includes(w)||c.includes(w));
    if(has('coffee','قهوة','tea','شاي','كوفي','ساخن','hot'))
      return <svg {...s}><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>;
    if(has('protein','بروتين','energy','طاقة','shake'))
      return <svg {...s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    if(has('water','ماء','juice','عصير','بارد','cold','drink','beverage','مشروب','milk','حليب'))
      return <svg {...s}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>;
    if(has('sandwich','ساندويتش','burger','برغر','food','meal','طعام','وجبة','snack','خفيف','pizza','بيتزا','salad','سلطة'))
      return <svg {...s}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
    return <svg {...s}><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/></svg>;
  }

  // Line-icon for a payment-method tile (inherits currentColor)
  function pmIcon(pm){
    const s={width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'};
    if(pm==='card')  return <svg {...s}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;
    if(pm==='cliq')  return <svg {...s}><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/></svg>;
    if(pm==='debt')  return <svg {...s}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>;
    return <svg {...s}><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
  }

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════
  function DashboardSection(){
    const {t,locale}=useI18n();
    const [data,loading]=useLoad('/api/cafeteria/dashboard',[],null);
    const [meta]=useCafMeta();
    const cur=data?.currency||meta.currency||'JOD';
    if(loading||!data) return <div className='pb'><div className='pld'><span className='spinner'/></div></div>;
    return(
      <div className='pb'>
        <div className='sg' style={{gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))'}}>
          {[
            [t('cafeteria.todaySales'),          fmt(data.todaySales,cur),        null],
            [t('cafeteria.openSessions'),         data.openSessions||0,             null],
            [t('cafeteria.avgOrderValue'),        fmt(data.avgOrderValue,cur),     null],
            [t('cafeteria.grossProfitToday'),     fmt(data.grossProfitToday,cur),  null],
          ].map(([label,value],i)=>(
            <div className='sc' key={i}><div className='sl'>{label}</div><div className='sv' style={{fontSize:20}}>{value}</div></div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr',gap:14,marginTop:4}}>
          <div className='card'>
            <div className='ct'>{t('cafeteria.recentOrders')}</div>
            <table><thead><tr><th>{t('cafeteria.order')}</th><th>{t('common.name')}</th><th>{t('common.price')}</th><th>{t('common.status')}</th></tr></thead>
            <tbody>{(data.recentOrders||[]).map(o=>(
              <tr key={o.id}>
                <td style={{fontSize:12,fontFamily:'monospace'}}>{o.order_no}</td>
                <td style={{fontSize:12}}>{o.customer_name||o.cashier_name}</td>
                <td>{fmt(o.total,cur)}</td>
                <td><span className={`badge b-${o.status}`}>{t('status.'+o.status,o.status)}</span></td>
              </tr>
            ))}</tbody></table>
          </div>
          <div className='card'>
            <div className='ct'>{t('cafeteria.topItems')}</div>
            {(data.topItems||[]).length?data.topItems.map((row,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{locale==='ar'&&row.product_name_ar?row.product_name_ar:row.product_name}</span>
                <strong>{row.qty}</strong>
              </div>
            )):<div className='empty'><h3>{t('common.noData')}</h3></div>}
          </div>
          <div className='card'>
            <div className='ct'>{t('cafeteria.lowStock')}</div>
            {(data.lowStock||[]).length?data.lowStock.map((row)=>(
              <div key={row.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{locale==='ar'&&row.name_ar?row.name_ar:row.name}</span>
                <strong style={{color:'var(--amber)'}}>{row.qty_on_hand}</strong>
              </div>
            )):<div className='empty'><h3>{t('cafeteria.noLowStock','All stock levels OK')}</h3></div>}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14}}>
          <div className='card'>
            <div className='ct'>{t('cafeteria.paymentMethods')}</div>
            {(data.paymentMix||[]).map((row,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{t('cafeteria.pm.'+row.payment_method,row.payment_method)}</span>
                <strong>{fmt(row.total,cur)}</strong>
              </div>
            ))}
          </div>
          <div className='card'>
            <div className='ct'>{t('cafeteria.salesByCategory')}</div>
            {(data.byCategory||[]).map((row,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{locale==='ar'&&row.name_ar?row.name_ar:(row.name||'—')}</span>
                <strong>{fmt(row.total,cur)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // SESSION GATE — Odoo-style open session screen
  // ══════════════════════════════════════════════════════════
  function SessionGate({meta,onOpened}){
    const {t,locale}=useI18n();
    const cur=meta.currency||'JOD';
    const [f,setF]=useState({warehouse_id:meta.warehouses?.[0]?.id||1,opening_cash:0,notes:''});
    const [loading,setLoading]=useState(false);
    const sf=k=>e=>setF(p=>({...p,[k]:typeof e==='object'?e.target.value:e}));
    const open=async()=>{
      try{
        setLoading(true);
        await api.post('/api/cafeteria/sessions/open',{...f,warehouse_id:Number(f.warehouse_id)});
        toast(t('cafeteria.sessionOpened'));
        onOpened();
      }catch(e){toast(e.message,'e');}finally{setLoading(false);}
    };
    return(
      <div className='pos-gate'>
        <div className='pos-gate-card'>
          <div className='pos-gate-left'>
            <div className='pos-gate-title'><Ic name='coffee' size={20}/> {locale==='ar'?'جاهز للبيع':'Ready to Sell'}</div>
            <div className='pos-gate-desc'>
              {locale==='ar'
                ?'افتح جلسة الصراف لبدء قبول الطلبات. ستُسجَّل جميع المبيعات تحت الجلسة الحالية وتُغلق عند نهاية الوردية.'
                :'Open a cashier session to start accepting orders. All sales are recorded under the active session and closed at end of shift.'}
            </div>
            <div className='sg' style={{gridTemplateColumns:'1fr 1fr',marginTop:'auto'}}>
              <div className='sc'><div className='sl'>{locale==='ar'?'الصراف':'Cashier'}</div><div className='sv' style={{fontSize:14}}>{meta.currentUser?.full_name||meta.currentUser?.username||'—'}</div></div>
              <div className='sc'><div className='sl'>{locale==='ar'?'العملة':'Currency'}</div><div className='sv' style={{fontSize:14}}>{cur}</div></div>
            </div>
          </div>
          <div className='pos-gate-right'>
            <div style={{fontSize:18,fontWeight:700,marginBottom:20,color:'var(--t1)'}}>{locale==='ar'?'فتح جلسة نقطة البيع':'Open POS Session'}</div>
            <div className='fg'>
              <label>{t('cafeteria.warehouse')}</label>
              <select className='fi' value={f.warehouse_id} onChange={sf('warehouse_id')}>
                {(meta.warehouses||[]).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className='fg'>
              <label>{t('cafeteria.openingCash')} ({cur})</label>
              <input className='fi' type='number' min='0' step='0.01' value={f.opening_cash} onChange={e=>setF(p=>({...p,opening_cash:Number(e.target.value)}))}/>
            </div>
            <div className='fg'>
              <label>{t('common.notes')}</label>
              <textarea className='fi' rows={3} value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))}/>
            </div>
            <button className='btn btn-p btn-lg' style={{marginTop:8}} onClick={open} disabled={loading}>
              {loading?'...':locale==='ar'?'ابدأ البيع ▶':'Start Selling ▶'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // CUSTOMER PICKER MODAL
  // ══════════════════════════════════════════════════════════
  function CustomerPickerModal({initialSearch='',onClose,onWalkIn,onSelect}){
    const {t}=useI18n();
    const [search,setSearch]=useState(initialSearch);
    const [members,setMembers]=useState([]);
    useEffect(()=>{
      if(search.length<2){setMembers([]);return;}
      const tm=setTimeout(()=>{
        api.get('/api/members?search='+encodeURIComponent(search)+'&limit=12').then(r=>setMembers(r.data||[])).catch(()=>{});
      },250);
      return ()=>clearTimeout(tm);
    },[search]);
    return(
      <Modal title={t('cafeteria.chooseCustomer','Choose Customer')} onClose={onClose}>
        <div className='mdl-b'>
          <button className='btn btn-s btn-lg' style={{marginBottom:12}} onClick={onWalkIn}>
<Ic name='user' size={16}/> {t('cafeteria.walkInCustomer','Walk-in Customer')}
          </button>
          <div className='fg'><label>{t('cafeteria.searchMember')}</label>
            <input className='fi' value={search} autoFocus onChange={e=>setSearch(e.target.value)} placeholder={t('cafeteria.searchMember')}/>
          </div>
          <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',maxHeight:320,overflowY:'auto'}}>
            {members.length?members.map(m=>(
              <button key={m.id} onClick={()=>onSelect(m)} style={{display:'flex',width:'100%',justifyContent:'space-between',padding:'12px 14px',background:'transparent',border:0,borderBottom:'1px solid var(--border)',cursor:'pointer',color:'var(--t1)',fontSize:13}}>
                <span>{m.first_name} {m.last_name}</span>
                <span style={{fontSize:11,color:'var(--t4)'}}>{m.membership_no||m.phone||''}</span>
              </button>
            )):<div style={{padding:16,color:'var(--t4)',textAlign:'center',fontSize:13}}>{search.length<2?t('cafeteria.typeToSearchCustomer','Type 2+ letters'):t('common.noData')}</div>}
          </div>
        </div>
        <div className='mdl-f'><button className='btn btn-s' onClick={onClose}>{t('btn.cancel')}</button></div>
      </Modal>
    );
  }

  // ══════════════════════════════════════════════════════════
  // CLOSE SESSION MODAL
  // ══════════════════════════════════════════════════════════
  function CloseSessionModal({session,currency,onClose,onClosed}){
    const {t}=useI18n();
    const [f,setF]=useState({counted_cash:session?.expected_cash||0,notes:''});
    const [loading,setLoading]=useState(false);
    const close=async()=>{
      try{
        setLoading(true);
        await api.post(`/api/cafeteria/sessions/${session.id}/close`,f);
        toast(t('cafeteria.sessionClosed'));
        onClosed();
      }catch(e){toast(e.message,'e');}finally{setLoading(false);}
    };
    return(
      <Modal title={t('cafeteria.closeSession')} onClose={onClose}>
        <div className='mdl-b'>
          <div className='dg'>
            <div className='di'><div className='dl'>{t('cafeteria.openingCash')}</div><div className='dv'>{fmt(session?.opening_cash,currency)}</div></div>
            <div className='di'><div className='dl'>{t('cafeteria.expectedCash')}</div><div className='dv'>{fmt(session?.expected_cash,currency)}</div></div>
            <div className='di'><div className='dl'>{t('cafeteria.sales','Sales')}</div><div className='dv'>{fmt(session?.sales_total,currency)}</div></div>
            <div className='di'><div className='dl'>{t('cafeteria.orders','Orders')}</div><div className='dv'>{session?.orders_count||0}</div></div>
          </div>
          <div className='fg'><label>{t('cafeteria.countedCash')} ({currency})</label><input className='fi' type='number' value={f.counted_cash} onChange={e=>setF(p=>({...p,counted_cash:Number(e.target.value)}))}/></div>
          <div className='fg'><label>{t('common.notes')}</label><textarea className='fi' value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))}/></div>
        </div>
        <div className='mdl-f'>
          <button className='btn btn-s' onClick={onClose}>{t('btn.cancel')}</button>
          <button className='btn btn-d' onClick={close} disabled={loading}>{loading?'...':t('cafeteria.closeSession')}</button>
        </div>
      </Modal>
    );
  }


  function PasswordPromptModal({title,locale,onClose,onConfirm}){
    const [password,setPassword]=useState('');
    const [loading,setLoading]=useState(false);
    const submit=async()=>{
      try{
        setLoading(true);
        await onConfirm(password);
      }finally{ setLoading(false); }
    };
    return(
      <Modal title={title} onClose={onClose}>
        <div className='mdl-b'>
          <div className='fg'>
            <label>{locale==='ar'?'كلمة مرور السوبر أدمن':'Super Admin Password'}</label>
            <input className='fi' type='password' autoFocus value={password} onChange={e=>setPassword(e.target.value)} placeholder={locale==='ar'?'أدخل كلمة المرور':'Enter password'}/>
          </div>
        </div>
        <div className='mdl-f'>
          <button className='btn btn-s' onClick={onClose}>{locale==='ar'?'إلغاء':'Cancel'}</button>
          <button className='btn btn-p' disabled={loading||!password} onClick={submit}>{loading?'...':(locale==='ar'?'تأكيد':'Confirm')}</button>
        </div>
      </Modal>
    );
  }

  function LastOrderModal({order,paymentMethods,locale,currency,password,onClose,onRefunded,onAdjusted}){
    const [selected,setSelected]=useState(()=>Object.fromEntries((order?.lines||[]).map(l=>[l.id,true])));
    const [qtyMap,setQtyMap]=useState(()=>Object.fromEntries((order?.lines||[]).map(l=>[l.id,Math.abs(Number(l.qty||0))])));
    const [refundMethod,setRefundMethod]=useState('cash');
    const [adjustMethod,setAdjustMethod]=useState((order?.payments||[])[0]?.payment_method || 'cash');
    const [reason,setReason]=useState('');
    const [loading,setLoading]=useState(false);
    const lines=(order?.lines||[]).filter(l=>Number(l.qty||0)>0);
    const toggle=(id)=>setSelected(prev=>({...prev,[id]:!prev[id]}));
    const doRefund=async(all=false)=>{
      const payloadLines=(all?lines:lines.filter(l=>selected[l.id])).map(l=>({line_id:l.id,qty:Math.max(1,Math.min(Math.abs(Number(l.qty||0)),Number(qtyMap[l.id]||1)))}));
      if(!payloadLines.length){ toast(locale==='ar'?'اختر عنصر واحد على الأقل':'Select at least one item','e'); return; }
      try{
        setLoading(true);
        await api.post(`/api/cafeteria/orders/${order.id}/refund`,{password,reason,refund_payment_method:refundMethod,lines:payloadLines});
        toast(locale==='ar'?'تم إنشاء طلب استرجاع':'Refund order created');
        onRefunded&&onRefunded();
      }catch(e){toast(e.message,'e');}finally{setLoading(false);}
    };
    const doAdjust=async()=>{
      try{
        setLoading(true);
        await api.post(`/api/cafeteria/orders/${order.id}/payment-method`,{password,payment_method:adjustMethod,reason});
        toast(locale==='ar'?'تم تعديل طريقة الدفع':'Payment method adjusted');
        onAdjusted&&onAdjusted();
      }catch(e){toast(e.message,'e');}finally{setLoading(false);}
    };
    return(
      <Modal title={locale==='ar'?'آخر طلب':'Last Order'} onClose={onClose}>
        <div className='mdl-b'>
          <div className='dg' style={{marginBottom:12}}>
            <div className='di'><div className='dl'>{locale==='ar'?'رقم الطلب':'Order No'}</div><div className='dv'>{order.order_no}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'العميل':'Customer'}</div><div className='dv'>{order.customer_name||'—'}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'الإجمالي':'Total'}</div><div className='dv'>{fmt(order.total,currency)}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'الدفع':'Payment'}</div><div className='dv'>{(order.payments||[]).map(p=>p.payment_method).join(', ')||'—'}</div></div>
          </div>
          <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',marginBottom:12}}>
            {(lines||[]).map(line=>(
              <div key={line.id} style={{display:'grid',gridTemplateColumns:'28px 1fr 80px 96px',gap:10,alignItems:'center',padding:'10px 12px',borderBottom:'1px solid var(--border)'}}>
                <input type='checkbox' checked={!!selected[line.id]} onChange={()=>toggle(line.id)}/>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{locale==='ar'&&line.product_name_ar?line.product_name_ar:line.product_name}</div>
                  <div style={{fontSize:11,color:'var(--t4)'}}>{fmt(line.unit_price,currency)}</div>
                </div>
                <input className='fi' type='number' min='1' max={Math.abs(Number(line.qty||0))} value={qtyMap[line.id]} onChange={e=>setQtyMap(prev=>({...prev,[line.id]:Math.max(1,Math.min(Math.abs(Number(line.qty||0)),Number(e.target.value||1)))}))}/>
                <div style={{textAlign:'end',fontWeight:700}}>{fmt(line.total,currency)}</div>
              </div>
            ))}
          </div>
          <div className='fg'>
            <label>{locale==='ar'?'طريقة رد المبلغ':'Refund Payment Method'}</label>
            <select className='fi' value={refundMethod} onChange={e=>setRefundMethod(e.target.value)}>
              {(paymentMethods||[]).map(pm=><option key={pm} value={pm}>{pm==='cash'?(locale==='ar'?'نقدي':'Cash'):pm==='card'?(locale==='ar'?'فيزا / بطاقة':'Visa / Card'):pm==='cliq'?'CliQ':pm}</option>)}
            </select>
          </div>
          <div className='fg'>
            <label>{locale==='ar'?'السبب / ملاحظة':'Reason / Note'}</label>
            <textarea className='fi' rows={2} value={reason} onChange={e=>setReason(e.target.value)}/>
          </div>
          <div className='fg'>
            <label>{locale==='ar'?'تعديل طريقة دفع الطلب الأصلي':'Adjust Original Payment Method'}</label>
            <div style={{display:'flex',gap:8}}>
              <select className='fi' value={adjustMethod} onChange={e=>setAdjustMethod(e.target.value)}>
                {(paymentMethods||[]).map(pm=><option key={pm} value={pm}>{pm==='cash'?(locale==='ar'?'نقدي':'Cash'):pm==='card'?(locale==='ar'?'فيزا / بطاقة':'Visa / Card'):pm==='cliq'?'CliQ':pm}</option>)}
              </select>
              <button className='btn btn-s' disabled={loading} onClick={doAdjust}>{locale==='ar'?'تعديل الدفع':'Adjust Payment'}</button>
            </div>
          </div>
        </div>
        <div className='mdl-f' style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className='btn btn-s' onClick={onClose}>{locale==='ar'?'إغلاق':'Close'}</button>
          <button className='btn btn-d' disabled={loading} onClick={()=>doRefund(false)}>{locale==='ar'?'استرجاع المحدد':'Refund Selected'}</button>
          <button className='btn btn-p' disabled={loading} onClick={()=>doRefund(true)}>{locale==='ar'?'استرجاع الكل':'Refund All'}</button>
        </div>
      </Modal>
    );
  }

  // ══════════════════════════════════════════════════════════
  // POS PAGE — Odoo-style full screen
  // ══════════════════════════════════════════════════════════
  function CafeteriaPOSPage(){
    const {t,locale}=useI18n();
    const [meta,reloadMeta]=useCafMeta();
    const [products,setProducts]=useState([]);
    const [search,setSearch]=useState('');
    const [category,setCategory]=useState('');
    const [cart,setCart]=useState([]);
    const [orderType,setOrderType]=useState('dine_in'); // dine_in | takeaway | delivery
    const [orderInfo,setOrderInfo]=useState({member_id:'',customer_name:'',notes:'',warehouse_id:1});
    const [memberDiscPct,setMemberDiscPct]=useState(0);
    const [payments,setPayments]=useState([{payment_method:'cash',amount:0,reference:''}]);
    const [showCustomer,setShowCustomer]=useState(false);
    const [showCloseSession,setShowCloseSession]=useState(false);
    const [showPasswordPrompt,setShowPasswordPrompt]=useState(false);
    const [lastOrder,setLastOrder]=useState(null);
    const [superAdminPassword,setSuperAdminPassword]=useState('');
    const [heldOrders,setHeldOrders]=useState([]);
    const [showHeld,setShowHeld]=useState(false);
    const [submitting,setSubmitting]=useState(false);
    const [openingForm,setOpeningForm]=useState({warehouse_id:1,opening_cash:0,notes:''});
    const [now,setNow]=useState(new Date());
    const searchRef=useRef(null);
    useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return ()=>clearInterval(id);},[]);
    const clockStr=(()=>{const p=n=>String(n).padStart(2,'0');return `${p(now.getDate())}-${p(now.getMonth()+1)}-${now.getFullYear()} · ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;})();

    const session=meta.openSession||null;
    const cur=meta.currency||'JOD';
    const pms=meta.paymentMethods||['cash','card','cliq'];

    const loadProducts=useCallback(()=>{
      api.get('/api/cafeteria/products?search='+encodeURIComponent(search)+'&category_id='+encodeURIComponent(category)+'&active=1')
        .then(r=>setProducts(r.data||[])).catch(()=>{});
    },[search,category]);

    const loadHeld=useCallback(()=>{
      api.get('/api/cafeteria/orders?status=held').then(r=>setHeldOrders(r.data||[])).catch(()=>{});
    },[]);

    useEffect(()=>{loadProducts();},[search,category]);
    useEffect(()=>{loadHeld();},[]);
    useEffect(()=>{
      const wid=Number(session?.warehouse_id||meta.warehouses?.[0]?.id||1);
      setOrderInfo(p=>({...p,warehouse_id:wid,customer_name:p.member_id?p.customer_name:(locale==='ar'?'عميل عابر':'Walk-in Customer')}));
      setOpeningForm(p=>({...p,warehouse_id:p.warehouse_id||wid}));
    },[session,meta.warehouses,locale]);

    // Fetch the selected member's plan cafeteria discount (%) so the POS previews it live.
    useEffect(()=>{
      if(!orderInfo.member_id){setMemberDiscPct(0);return;}
      let alive=true;
      api.get('/api/cafeteria/member-discount/'+orderInfo.member_id).then(r=>{if(alive)setMemberDiscPct(Number(r.data?.percent||0));}).catch(()=>{if(alive)setMemberDiscPct(0);});
      return ()=>{alive=false;};
    },[orderInfo.member_id]);

    // Totals — includes the member's plan discount per line (matches the server calc).
    const totals=useMemo(()=>{
      let subtotal=0,discount=0,tax=0;
      cart.forEach(l=>{
        const qty=Number(l.qty||0),price=Number(l.unit_price||0);
        const lineSub=qty*price;
        const planDisc=memberDiscPct>0?Math.round(lineSub*(memberDiscPct/100)*1000)/1000:0;
        const lineDisc=Number(l.discount_amount||0)+planDisc;
        const taxable=Math.max(0,lineSub-lineDisc);
        subtotal+=lineSub;discount+=lineDisc;tax+=taxable*(Number(l.tax_rate||0)/100);
      });
      const total=subtotal-discount+tax;
      const paid=payments.reduce((s,p)=>s+Number(p.amount||0),0);
      return {subtotal,discount,tax,total,paid,due:total-paid,change:Math.max(0,paid-total),planDiscPct:memberDiscPct};
    },[cart,payments,memberDiscPct]);

    // Auto-set first payment amount to total
    useEffect(()=>{
      setPayments(prev=>{
        if(!prev.length) return [{payment_method:'cash',amount:Number(totals.total.toFixed(3)),reference:''}];
        const other=prev.slice(1).reduce((s,l)=>s+Number(l.amount||0),0);
        const cash=Math.max(0,Number((totals.total-other).toFixed(3)));
        return prev.map((l,i)=>i===0?{...l,amount:cash}:l);
      });
    },[totals.total]);

    const addProduct=p=>{
      if(p.product_type==='stockable'&&Number(p.qty_on_hand||0)<=0){
        toast(locale==='ar'?'المنتج غير متوفر في المخزون':'Out of stock','e'); return;
      }
      setCart(prev=>{
        const ex=prev.find(x=>x.product_id===p.id);
        if(ex) return prev.map(x=>x.product_id===p.id?{...x,qty:Number(x.qty||0)+1}:x);
        return [...prev,{product_id:p.id,name:p.name,name_ar:p.name_ar,qty:1,unit_price:Number(p.selling_price||0),discount_amount:0,tax_rate:Number(p.tax_rate||0),note:'',product_type:p.product_type,qty_on_hand:p.qty_on_hand,_emoji:productEmoji(p)}];
      });
    };

    const updateLine=(pid,patch)=>setCart(prev=>prev.map(x=>x.product_id===pid?{...x,...patch}:x));
    const removeLine=pid=>setCart(prev=>prev.filter(x=>x.product_id!==pid));
    const resetOrder=()=>{
      setCart([]);
      setPayments([{payment_method:'cash',amount:0,reference:''}]);
      const cname=locale==='ar'?'عميل عابر':'Walk-in Customer';
      setOrderInfo({member_id:'',customer_name:cname,notes:'',warehouse_id:session?.warehouse_id||meta.warehouses?.[0]?.id||1});
    };

    const payExact=()=>setPayments([{payment_method:payments[0]?.payment_method||'cash',amount:Number(totals.total.toFixed(3)),reference:''}]);
    const addSplit=()=>setPayments(p=>[...p,{payment_method:pms[0],amount:0,reference:''}]);

    const openLastOrderFlow=()=>setShowPasswordPrompt(true);
    const loadLastOrder=async(password)=>{
      try{
        await api.post('/api/cafeteria/super-admin/validate',{password});
        const r=await api.get('/api/cafeteria/orders/last'+(session?.id?`?session_id=${session.id}`:''));
        if(!r.data){ toast(locale==='ar'?'لا يوجد طلب مدفوع في هذه الجلسة':'No paid order found in this session','e'); return; }
        setSuperAdminPassword(password);
        setLastOrder(r.data);
        setShowPasswordPrompt(false);
      }catch(e){toast(e.message,'e');}
    };

    const resumeHeld=async id=>{
      try{
        const r=await api.get('/api/cafeteria/orders/'+id);
        const d=r.data;
        setCart((d.lines||[]).map(l=>({product_id:l.product_id,name:l.product_name,name_ar:l.product_name_ar,qty:Math.abs(Number(l.qty||0)),unit_price:Number(l.unit_price||0),discount_amount:Number(l.discount_amount||0),tax_rate:Number(l.tax_rate||0),note:l.note||'',_emoji:'🛒'})));
        setOrderInfo({member_id:d.member_id||'',customer_name:d.customer_name||(locale==='ar'?'عميل عابر':'Walk-in Customer'),notes:d.notes||'',warehouse_id:d.warehouse_id||session?.warehouse_id||1});
        setPayments([{payment_method:'cash',amount:Number(d.total||0),reference:''}]);
        setShowHeld(false);
        toast(locale==='ar'?'تم استئناف الطلب':'Order resumed');
      }catch(e){toast(e.message,'e');}
    };

    const doSubmit=async(status='paid')=>{
      if(!session&&status!=='held'){toast(locale==='ar'?'افتح جلسة أولاً':'Open session first','e');return;}
      if(!cart.length){toast(locale==='ar'?'السلة فارغة':'Cart is empty','e');return;}
      if(status==='paid'&&Math.abs(totals.due)>0.009){toast(locale==='ar'?'المبلغ المدفوع غير مطابق':'Payment amount mismatch','e');return;}
      try{
        setSubmitting(true);
        const cname=orderInfo.customer_name||(locale==='ar'?'عميل عابر':'Walk-in Customer');
        const payload={
          order:{...orderInfo,customer_name:cname,warehouse_id:session?.warehouse_id||orderInfo.warehouse_id||1,status,source:'pos',order_type:orderType},
          lines:cart,
          payment_lines:status==='held'?[]:payments
        };
        await api.post('/api/cafeteria/orders',payload);
        toast(status==='held'?(locale==='ar'?'تم تعليق الطلب':'Order held'):(locale==='ar'?'تم إتمام البيع ✓':'Sale completed ✓'));
        resetOrder();
        reloadMeta();
        loadHeld();
        if(searchRef.current) searchRef.current.focus();
      }catch(e){toast(e.message,'e');}finally{setSubmitting(false);}
    };

    // Session gate
    if(!session){
      return <SessionGate meta={meta} onOpened={()=>{reloadMeta();}}/>;
    }

    const orderTypeLabels={
      dine_in:  locale==='ar'?'داخلي':'Dine In',
      takeaway: locale==='ar'?'خارجي':'Takeaway',
      delivery: locale==='ar'?'توصيل':'Delivery',
    };
    const pmLabels={cash:locale==='ar'?'نقدي':'Cash',card:locale==='ar'?'بطاقة':'Card',cliq:'CliQ',bank:locale==='ar'?'بنك':'Bank',transfer:locale==='ar'?'تحويل':'Transfer',voucher:locale==='ar'?'قسيمة':'Voucher',debt:locale==='ar'?'دين':'Debt'};

    const matched=Math.abs(totals.due)<0.005;
    const activePm=payments.length===1?payments[0]?.payment_method:null;

    return(
      <div className='pos-root'>
        {/* ── Top bar ── */}
        <div className='pos-tbar'>
          <button className='pos-tbar-close' onClick={()=>setShowCloseSession(true)}>{locale==='ar'?'إغلاق الجلسة':'Close Session'}</button>
          <button className='pos-tbar-last' onClick={openLastOrderFlow}>{locale==='ar'?'آخر طلب':'Last Order'}</button>
          <div className='pos-tbar-spacer'/>
          <div className='pos-tbar-meta'>
            <span className='pos-tbar-live'><span className='pos-tbar-dot'/>{locale==='ar'?'جلسة مفتوحة':'Active Session'}</span>
            <span>·</span><span>{clockStr}</span>
            <span>·</span><span>{locale==='ar'?'الصراف':'Cashier'}: <strong>{session.username||'—'}</strong></span>
            <span>·</span><span>{locale==='ar'?'المتوقع':'Expected'}: <strong>{fmt(session.expected_cash,cur)}</strong></span>
          </div>
        </div>

        {/* ── Main split (RTL: order panel on the right, products on the left) ── */}
        <div className='pos-main'>

          {/* ── Order panel (dark) ── */}
          <div className='pos-order'>

            {/* Order type + new */}
            <div className='pos-otype'>
              <div className='pos-oseg'>
                {Object.entries(orderTypeLabels).map(([key,label])=>(
                  <button key={key} className={`pos-oseg-btn ${orderType===key?'active':''}`} onClick={()=>setOrderType(key)}>{label}</button>
                ))}
              </div>
              <button className='pos-new' onClick={resetOrder}>{locale==='ar'?'جديد':'New'}</button>
            </div>

            {/* Customer */}
            <div className='pos-cust-wrap'>
              <button className='pos-cust' onClick={()=>setShowCustomer(true)}>
                <span className='pos-cust-av'>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8888aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <span className='pos-cust-name'>{orderInfo.customer_name||(locale==='ar'?'عميل عابر':'Walk-in Customer')}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {orderInfo.member_id&&(
                <button className='pos-cust-x' onClick={()=>setOrderInfo(p=>({...p,member_id:'',customer_name:locale==='ar'?'عميل عابر':'Walk-in Customer'}))}><Ic name='x' size={14}/></button>
              )}
            </div>

            {/* Cart */}
            <div className='pos-cart'>
              {cart.length===0?(
                <div className='pos-cart-empty'>
                  <div className='pos-cart-empty-ic'>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#444466" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  </div>
                  <p className='pos-cart-empty-txt'>{locale==='ar'?'لا توجد منتجات في السلة':'No products in cart'}</p>
                </div>
              ):cart.map(line=>{
                const lineTotal=(Number(line.qty||0)*Number(line.unit_price||0))-Number(line.discount_amount||0);
                return(
                  <div key={line.product_id} className='pos-item'>
                    <span className='pos-item-ic'>{prodIcon(line)}</span>
                    <div className='pos-item-info'>
                      <div className='pos-item-name'>{locale==='ar'&&line.name_ar?line.name_ar:line.name}</div>
                      <div className='pos-item-price'>{fmt(line.unit_price,cur)} × {line.qty}</div>
                      <div className='pos-item-ctl'>
                        <button className='pos-qbtn' onClick={()=>line.qty>1?updateLine(line.product_id,{qty:line.qty-1}):removeLine(line.product_id)}>−</button>
                        <input className='pos-qinput' type='number' min='1' value={line.qty} onChange={e=>updateLine(line.product_id,{qty:Math.max(1,Number(e.target.value||1))})}/>
                        <button className='pos-qbtn' onClick={()=>updateLine(line.product_id,{qty:Number(line.qty||0)+1})}>+</button>
                        <input className='pos-dinput' type='number' min='0' value={line.discount_amount||0} onChange={e=>updateLine(line.product_id,{discount_amount:Number(e.target.value||0)})} placeholder={locale==='ar'?'خصم':'Disc'}/>
                      </div>
                    </div>
                    <div className='pos-item-right'>
                      <div className='pos-item-total'>{fmt(lineTotal,cur)}</div>
                      <button className='pos-item-x' onClick={()=>removeLine(line.product_id)}><Ic name='x' size={14}/></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className='pos-sum'>
              <div className='pos-sum-row'><span>{locale==='ar'?'الإجمالي الفرعي':'Subtotal'}</span><span>{fmt(totals.subtotal,cur)}</span></div>
              {totals.discount>0&&<div className='pos-sum-row'><span>{locale==='ar'?'الخصم':'Discount'}{totals.planDiscPct>0?<span style={{fontSize:11,color:'#16a34a',fontWeight:700,marginInlineStart:6}}>{locale==='ar'?`خصم الباقة ${totals.planDiscPct}%`:`Plan ${totals.planDiscPct}%`}</span>:null}</span><span>−{fmt(totals.discount,cur)}</span></div>}
              {totals.tax>0&&<div className='pos-sum-row'><span>{locale==='ar'?'الضريبة':'Tax'}</span><span>{fmt(totals.tax,cur)}</span></div>}
              <div className='pos-sum-row grand'><span>{locale==='ar'?'الإجمالي':'Total'}</span><span>{fmt(totals.total,cur)}</span></div>
            </div>

            {/* Payment methods */}
            <div className='pos-pm-wrap'>
              <div className='pos-pm-grid'>
                {pms.map(pm=>(
                  <button key={pm} className={`pos-pm ${activePm===pm?'active':''}`}
                    onClick={()=>{setPayments([{payment_method:pm,amount:Number(totals.total.toFixed(3)),reference:''}]);if(pm==='debt'&&!orderInfo.member_id){setShowCustomer(true);}}}>
                    {pmIcon(pm)}
                    <span className='pos-pm-lbl'>{pmLabels[pm]||pm}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Split payment lines */}
            {payments.length>1&&(
              <div className='pos-split'>
                {payments.map((p,idx)=>(
                  <div key={idx} className='pos-split-row'>
                    <select value={p.payment_method} onChange={e=>setPayments(prev=>prev.map((x,i)=>i===idx?{...x,payment_method:e.target.value}:x))}>
                      {pms.map(pm=><option key={pm} value={pm}>{pmLabels[pm]||pm}</option>)}
                    </select>
                    <input type='number' style={{textAlign:'end'}} value={p.amount} onChange={e=>setPayments(prev=>prev.map((x,i)=>i===idx?{...x,amount:Number(e.target.value||0)}:x))}/>
                    <button className='pos-split-x' onClick={()=>payments.length>1&&setPayments(prev=>prev.filter((_,i)=>i!==idx))}><Ic name='x' size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            {/* Amount match */}
            <div className='pos-match'>
              <div className={`pos-match-box ${matched?'':'off'}`}>
                {matched&&<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span className='pos-match-lbl'>
                {matched?(locale==='ar'?'المبلغ متطابق':'Exact amount')
                  :totals.due>0?(locale==='ar'?'المبلغ المتبقي':'Balance due')
                  :(locale==='ar'?'الباقي (صرف)':'Change')}
              </span>
              <span className='pos-match-amt'>{fmt(matched?totals.total:Math.abs(totals.due),cur)}</span>
            </div>

            {/* Complete sale */}
            <div className='pos-cta-wrap'>
              <button className='pos-cta' disabled={!cart.length||Math.abs(totals.due)>0.009||submitting} onClick={()=>doSubmit('paid')}>
                {submitting?'...':`${locale==='ar'?'إتمام البيع':'Complete Sale'} — ${fmt(totals.total,cur)}`}
              </button>
            </div>

            {/* Secondary actions */}
            <div className='pos-sec'>
              <button className='pos-sec-btn' onClick={resetOrder}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                {locale==='ar'?'مسح':'Clear'}
              </button>
              <button className='pos-sec-btn' onClick={()=>doSubmit('held')} disabled={!cart.length||submitting}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {locale==='ar'?'تعليق':'Hold'}
              </button>
              <button className='pos-sec-btn' onClick={addSplit}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="m21 3-7.536 7.536"/><path d="m3 21 7.536-7.536"/><path d="M21 21v-5h-5"/><path d="M3 21h5v-5"/></svg>
                {locale==='ar'?'منقسم':'Split'}
              </button>
              <button className='pos-sec-btn' onClick={payExact}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                {locale==='ar'?'إعادة':'Reset'}
              </button>
            </div>

            {/* Pending orders footer */}
            <div className='pos-pend' onClick={()=>setShowHeld(p=>!p)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666688" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className='pos-pend-lbl'>{locale==='ar'?'الطلبات المعلقة':'Held Orders'}</span>
              <span className='pos-pend-badge'>{heldOrders.length}</span>
            </div>
            {showHeld&&(
              <div className='pos-pend-list'>
                {heldOrders.length===0&&<div style={{padding:'10px 12px',fontSize:11.5,color:'#666688'}}>{locale==='ar'?'لا توجد طلبات معلقة':'No held orders'}</div>}
                {heldOrders.map(o=>(
                  <div key={o.id} className='pos-pend-item'>
                    <div>
                      <div className='n'>{o.order_no}</div>
                      <div className='c'>{o.customer_name||'—'}</div>
                    </div>
                    <strong style={{fontSize:12,color:'#c4c4d4'}}>{fmt(o.total,cur)}</strong>
                    <button className='pos-pend-resume' onClick={()=>resumeHeld(o.id)}>{locale==='ar'?'استئناف':'Resume'}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Products panel (light) ── */}
          <div className='pos-products'>

            {/* Search + refresh */}
            <div className='pos-psearch-row'>
              <div className='pos-psearch'>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input ref={searchRef} type='text' value={search} onChange={e=>setSearch(e.target.value)} placeholder={locale==='ar'?'بحث عن منتج أو باركود...':'Search product or barcode...'}/>
              </div>
              <button className='pos-prefresh' onClick={loadProducts}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                {locale==='ar'?'تحديث':'Refresh'}
              </button>
            </div>

            {/* Category tabs */}
            <div className='pos-cats'>
              <button className={`pos-cat ${!category?'active':''}`} onClick={()=>setCategory('')}>{locale==='ar'?'الكل':'All'}</button>
              {(meta.categories||[]).map(c=>(
                <button key={c.id} className={`pos-cat ${String(category)===String(c.id)?'active':''}`} onClick={()=>setCategory(String(c.id))}>
                  {locale==='ar'&&c.name_ar?c.name_ar:c.name}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className='pos-pgrid'>
              {products.length===0&&<div className='pos-empty-products'>{locale==='ar'?'لا توجد منتجات':'No products found'}</div>}
              {products.map(p=>{
                const outOfStock=p.product_type==='stockable'&&Number(p.qty_on_hand||0)<=0;
                const low=p.product_type==='stockable'&&!outOfStock&&Number(p.qty_on_hand)<=Number(p.low_stock_threshold||5);
                return(
                  <button key={p.id} className={`pos-card ${outOfStock?'out':''}`} onClick={()=>!outOfStock&&addProduct(p)} disabled={outOfStock}>
                    {p.product_type==='stockable'&&(
                      <span className={`pos-card-stock ${outOfStock?'out':low?'low':''}`}>{outOfStock?(locale==='ar'?'نفد':'Out'):Number(p.qty_on_hand||0)}</span>
                    )}
                    {p.product_type==='service'&&<span className='pos-card-stock'>∞</span>}
                    <div className='pos-card-ic'>{prodIcon(p)}</div>
                    <div className='pos-card-txt'>
                      <div className='pos-card-name'>{locale==='ar'&&p.name_ar?p.name_ar:p.name}</div>
                      <div className='pos-card-cat'>{(locale==='ar'&&p.category_name_ar?p.category_name_ar:p.category_name)||''}</div>
                      <div className='pos-card-price'>{fmt(p.selling_price,cur)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>


        {/* Modals */}
        {showCustomer&&<CustomerPickerModal initialSearch='' onClose={()=>setShowCustomer(false)} onWalkIn={()=>{setOrderInfo(p=>({...p,member_id:'',customer_name:locale==='ar'?'عميل عابر':'Walk-in Customer'}));setShowCustomer(false);}} onSelect={m=>{setOrderInfo(p=>({...p,member_id:m.id,customer_name:`${m.first_name} ${m.last_name}`}));setShowCustomer(false);}}/>}
        {showCloseSession&&<CloseSessionModal session={session} currency={cur} onClose={()=>setShowCloseSession(false)} onClosed={()=>{setShowCloseSession(false);reloadMeta();}}/>}
        {showPasswordPrompt&&<PasswordPromptModal title={locale==='ar'?'صلاحية السوبر أدمن':'Super Admin Approval'} locale={locale} onClose={()=>setShowPasswordPrompt(false)} onConfirm={loadLastOrder}/>}
        {lastOrder&&<LastOrderModal order={lastOrder} paymentMethods={pms} locale={locale} currency={cur} password={superAdminPassword} onClose={()=>setLastOrder(null)} onRefunded={()=>{setLastOrder(null); reloadMeta(); loadHeld();}} onAdjusted={()=>{setLastOrder(null); reloadMeta();}}/>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // PRODUCTS SECTION
  // ══════════════════════════════════════════════════════════
  function ProductsSection(){
    const {t,locale}=useI18n();
    const [sub,setSub]=useState('products');
    const [items,loading,,reloadP]=useLoad('/api/cafeteria/products',[],[]);
    const [cats,loadingC,,reloadC]=useLoad('/api/cafeteria/categories',[],[]);
    const [show,setShow]=useState(false);
    const [editing,setEditing]=useState(null);
    const [catShow,setCatShow]=useState(false);
    const [catEdit,setCatEdit]=useState(null);
    const [catForm,setCatForm]=useState({});

    const saveCategory=async()=>{
      try{
        catEdit?.id?await api.put('/api/cafeteria/categories/'+catEdit.id,catForm):await api.post('/api/cafeteria/categories',catForm);
        toast(locale==='ar'?'تم الحفظ':'Saved');setCatShow(false);setCatEdit(null);reloadC();
      }catch(e){toast(e.message,'e');}
    };

    return(
      <div className='pb'>
        <div className='caf-sub-tabs'>
          <button className={`caf-sub-tab ${sub==='products'?'active':''}`} onClick={()=>setSub('products')}>{t('cafeteria.products')}</button>
          <button className={`caf-sub-tab ${sub==='categories'?'active':''}`} onClick={()=>setSub('categories')}>{t('cafeteria.categories','Categories')}</button>
        </div>

        {sub==='products'&&<>
          <div className='caf-section-bar'>
            <span style={{color:'var(--t3)',fontSize:13}}>{items.length} {locale==='ar'?'منتج':'products'}</span>
            <button className='btn btn-p' onClick={()=>{setEditing(null);setShow(true);}}><Ic name='plus' size={14}/> {t('btn.add')}</button>
          </div>
          <div className='card' style={{padding:0,overflow:'hidden'}}>
            <table><thead><tr>
              <th>{t('common.name')}</th><th>SKU</th><th>{t('cafeteria.category')}</th>
              <th>{t('common.price')}</th><th>{t('cafeteria.cost')}</th>
              <th>{t('cafeteria.stock')}</th><th>{t('cafeteria.taxSummary','Tax')}</th>
              <th>{t('common.status')}</th><th></th>
            </tr></thead>
            <tbody>{items.length===0?<tr><td colSpan={9}><div className='empty'><h3>{t('common.noData')}</h3></div></td></tr>:items.map(p=>(
              <tr key={p.id}>
                <td><strong style={{fontSize:13}}>{locale==='ar'&&p.name_ar?p.name_ar:p.name}</strong>{p.name_ar&&locale!=='ar'&&<div style={{fontSize:11,color:'var(--t4)'}}>{p.name_ar}</div>}</td>
                <td style={{fontSize:11,fontFamily:'monospace'}}>{p.sku||'—'}</td>
                <td>{locale==='ar'&&p.category_name_ar?p.category_name_ar:p.category_name||'—'}</td>
                <td><strong>{p.selling_price}</strong></td>
                <td>{p.average_cost||p.standard_cost||0}</td>
                <td>
                  {p.product_type==='service'?<span className='badge b-info'>{locale==='ar'?'خدمة':'Service'}</span>
                    :<span className={`badge ${Number(p.qty_on_hand||0)<=0?'b-danger':Number(p.qty_on_hand)<=Number(p.low_stock_threshold||5)?'b-warning':'b-active'}`}>{p.qty_on_hand??0}</span>}
                </td>
                <td>{p.tax_rate||0}%</td>
                <td><span className={`badge ${p.is_active?'b-active':'b-inactive'}`}>{p.is_active?t('status.active'):t('status.inactive')}</span></td>
                <td><button className='btn btn-s btn-sm' onClick={()=>{setEditing(p);setShow(true);}}><Ic name='edit' size={13}/></button></td>
              </tr>
            ))}</tbody></table>
          </div>
        </>}

        {sub==='categories'&&<>
          <div className='caf-section-bar'>
            <span style={{color:'var(--t3)',fontSize:13}}>{cats.length} {locale==='ar'?'فئة':'categories'}</span>
            <button className='btn btn-p' onClick={()=>{setCatEdit(null);setCatForm({name:'',name_ar:'',sort_order:0,color:'',description:''});setCatShow(true);}}><Ic name='plus' size={14}/> {t('btn.add')}</button>
          </div>
          <div className='card' style={{padding:0,overflow:'hidden'}}>
            <table><thead><tr><th>{t('common.name')}</th><th>{t('common.name')} AR</th><th>{locale==='ar'?'الترتيب':'Sort Order'}</th><th></th></tr></thead>
            <tbody>{cats.length===0?<tr><td colSpan={4}><div className='empty'><h3>{t('common.noData')}</h3></div></td></tr>:cats.map(c=>(
              <tr key={c.id} onClick={()=>{setCatEdit(c);setCatForm({...c});setCatShow(true);}} style={{cursor:'pointer'}}>
                <td><strong>{c.name}</strong></td><td>{c.name_ar||'—'}</td><td>{c.sort_order||0}</td>
                <td><button className='btn btn-s btn-sm' onClick={e=>{e.stopPropagation();setCatEdit(c);setCatForm({...c});setCatShow(true);}}><Ic name='edit' size={13}/></button></td>
              </tr>
            ))}</tbody></table>
          </div>
        </>}

        {show&&<ProductModal cats={cats} item={editing} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);reloadP();}}/>}
        {catShow&&(
          <Modal title={catEdit?t('btn.edit'):t('btn.add')} onClose={()=>setCatShow(false)}>
            <div className='mdl-b'>
              <div className='fg'><label>{t('common.name')} (EN)</label><input className='fi' value={catForm.name||''} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))}/></div>
              <div className='fg'><label>{t('common.name')} (AR)</label><input className='fi' value={catForm.name_ar||''} onChange={e=>setCatForm(p=>({...p,name_ar:e.target.value}))}/></div>
              <div className='fg'><label>{locale==='ar'?'الترتيب':'Sort Order'}</label><input className='fi' type='number' value={catForm.sort_order||0} onChange={e=>setCatForm(p=>({...p,sort_order:Number(e.target.value)}))}/></div>
              <div className='fg'><label>{locale==='ar'?'الوصف':'Description'}</label><textarea className='fi' value={catForm.description||''} onChange={e=>setCatForm(p=>({...p,description:e.target.value}))}/></div>
            </div>
            <div className='mdl-f'><button className='btn btn-s' onClick={()=>setCatShow(false)}>{t('btn.cancel')}</button><button className='btn btn-p' onClick={saveCategory}>{t('btn.save')}</button></div>
          </Modal>
        )}
      </div>
    );
  }

  // Product modal — full featured
  function ProductModal({cats,item,onClose,onSaved}){
    const {t,locale}=useI18n();
    const [f,setF]=useState(item||{name:'',name_ar:'',sku:'',barcode:'',category_id:'',selling_price:0,standard_cost:0,average_cost:0,tax_rate:0,product_type:'stockable',uom:'Unit',low_stock_threshold:5,is_active:true,notes:''});
    const s=(k,v)=>setF(p=>({...p,[k]:v}));
    const [saving,setSaving]=useState(false);
    const save=async()=>{
      try{setSaving(true);item?.id?await api.put('/api/cafeteria/products/'+item.id,f):await api.post('/api/cafeteria/products',f);toast(t('btn.save'));onSaved();}
      catch(e){toast(e.message,'e');}finally{setSaving(false);}
    };
    return(
      <Modal title={item?(locale==='ar'?'تعديل المنتج':'Edit Product'):(locale==='ar'?'منتج جديد':'New Product')} onClose={onClose} wide>
        <div className='mdl-b'>
          <div className='fr'><div className='fg'><label>{t('common.name')} (EN) *</label><input className='fi' value={f.name} onChange={e=>s('name',e.target.value)}/></div><div className='fg'><label>{t('common.name')} (AR)</label><input className='fi' value={f.name_ar} onChange={e=>s('name_ar',e.target.value)}/></div></div>
          <div className='fr3'><div className='fg'><label>SKU</label><input className='fi' value={f.sku} onChange={e=>s('sku',e.target.value)}/></div><div className='fg'><label>{t('common.barcode','Barcode')}</label><input className='fi' value={f.barcode} onChange={e=>s('barcode',e.target.value)}/></div><div className='fg'><label>{t('cafeteria.category')}</label><select className='fi' value={f.category_id} onChange={e=>s('category_id',e.target.value)}><option value=''>{t('common.select','Select')}</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
          <div className='fr3'><div className='fg'><label>{t('common.price')} *</label><input className='fi' type='number' value={f.selling_price} onChange={e=>s('selling_price',Number(e.target.value))}/></div><div className='fg'><label>{t('cafeteria.cost')}</label><input className='fi' type='number' value={f.standard_cost} onChange={e=>s('standard_cost',Number(e.target.value))}/></div><div className='fg'><label>{t('cafeteria.tax')} %</label><input className='fi' type='number' value={f.tax_rate} onChange={e=>s('tax_rate',Number(e.target.value))}/></div></div>
          <div className='fr3'><div className='fg'><label>{t('common.type')}</label><select className='fi' value={f.product_type} onChange={e=>s('product_type',e.target.value)}><option value='stockable'>{t('cafeteria.stockable','Storable')}</option><option value='consumable'>{t('cafeteria.consumable','Consumable')}</option><option value='service'>{t('cafeteria.service','Service')}</option></select></div><div className='fg'><label>{t('cafeteria.uom','UoM')}</label><input className='fi' value={f.uom} onChange={e=>s('uom',e.target.value)}/></div><div className='fg'><label>{t('cafeteria.lowStockThreshold','Low Stock Alert')}</label><input className='fi' type='number' value={f.low_stock_threshold} onChange={e=>s('low_stock_threshold',Number(e.target.value))}/></div></div>
          <div className='fg'><label style={{display:'flex',gap:8,alignItems:'center',marginTop:8,cursor:'pointer'}}><input type='checkbox' checked={!!f.is_active} onChange={e=>s('is_active',e.target.checked)} style={{width:15,height:15}}/>{t('status.active')}</label></div>
          <div className='fg'><label>{t('common.notes')}</label><textarea className='fi' value={f.notes} onChange={e=>s('notes',e.target.value)}/></div>
        </div>
        <div className='mdl-f'><button className='btn btn-s' onClick={onClose}>{t('btn.cancel')}</button><button className='btn btn-p' onClick={save} disabled={saving}>{saving?'...':t('btn.save')}</button></div>
      </Modal>
    );
  }

  // ══════════════════════════════════════════════════════════
  // STOCK SECTION
  // ══════════════════════════════════════════════════════════
  function StockSection(){
    const {t,locale}=useI18n();
    const [sub,setSub]=useState('overview');
    const [products,pL]=useLoad('/api/cafeteria/products',[],[]);
    const [moves,mL,,reloadM]=useLoad('/api/cafeteria/stock-moves',[],[]);
    const [warehouses,wL]=useLoad('/api/cafeteria/warehouses',[],[]);
    const [show,setShow]=useState(false);
    const [whShow,setWhShow]=useState(false);
    const [whEdit,setWhEdit]=useState(null);
    const [whForm,setWhForm]=useState({});
    const saveWh=async()=>{
      try{whEdit?.id?await api.put('/api/cafeteria/warehouses/'+whEdit.id,whForm):await api.post('/api/cafeteria/warehouses',whForm);toast(locale==='ar'?'تم الحفظ':'Saved');setWhShow(false);setWhEdit(null);}
      catch(e){toast(e.message,'e');}
    };
    return(
      <div className='pb'>
        <div className='caf-sub-tabs'>
          <button className={`caf-sub-tab ${sub==='overview'?'active':''}`} onClick={()=>setSub('overview')}>{locale==='ar'?'نظرة عامة':'Overview'}</button>
          <button className={`caf-sub-tab ${sub==='moves'?'active':''}`} onClick={()=>setSub('moves')}>{t('cafeteria.stockMoves','Stock Moves')}</button>
          <button className={`caf-sub-tab ${sub==='warehouses'?'active':''}`} onClick={()=>setSub('warehouses')}>{t('cafeteria.warehouses','Warehouses')}</button>
        </div>

        {sub==='overview'&&<>
          <div className='caf-section-bar'><span/><button className='btn btn-p' onClick={()=>setShow(true)}><Ic name='plus' size={14}/> {t('cafeteria.stockAdjustment','Stock Adjustment')}</button></div>
          <div className='card' style={{padding:0,overflow:'hidden'}}>
            <table><thead><tr>
              <th>{t('cafeteria.product')}</th><th>SKU</th>
              <th>{locale==='ar'?'المتوفر':'On Hand'}</th>
              <th>{locale==='ar'?'الحد الأدنى':'Low Alert'}</th>
              <th>{locale==='ar'?'الحالة':'Status'}</th>
            </tr></thead>
            <tbody>{products.filter(p=>p.product_type!=='service').map(p=>{
              const low=Number(p.qty_on_hand||0)<=Number(p.low_stock_threshold||5);
              const out=Number(p.qty_on_hand||0)<=0;
              return <tr key={p.id}>
                <td><strong style={{fontSize:13}}>{locale==='ar'&&p.name_ar?p.name_ar:p.name}</strong></td>
                <td style={{fontSize:11,fontFamily:'monospace'}}>{p.sku||'—'}</td>
                <td style={{fontWeight:700,color:out?'var(--red)':low?'var(--amber)':'var(--green)'}}>{p.qty_on_hand??0}</td>
                <td>{p.low_stock_threshold||5}</td>
                <td><span className={`badge ${out?'b-danger':low?'b-warning':'b-active'}`}>{out?(locale==='ar'?'نفد':'Out of Stock'):low?(locale==='ar'?'مخزون منخفض':'Low Stock'):(locale==='ar'?'متوفر':'In Stock')}</span></td>
              </tr>;
            })}</tbody></table>
          </div>
        </>}

        {sub==='moves'&&(
          <div className='card' style={{padding:0,overflow:'hidden'}}>
            <table><thead><tr>
              <th>{t('cafeteria.product')}</th><th>{t('cafeteria.moveType')}</th>
              <th>{t('cafeteria.qty')}</th><th>{locale==='ar'?'بعد الحركة':'After Qty'}</th>
              <th>{t('common.date')}</th>
            </tr></thead>
            <tbody>{moves.map(m=>(
              <tr key={m.id}>
                <td>{locale==='ar'&&m.product_name_ar?m.product_name_ar:m.product_name}</td>
                <td><span className={`badge ${m.move_type==='receipt'?'b-active':m.move_type==='waste'?'b-danger':'b-info'}`}>{t('cafeteria.move.'+m.move_type,m.move_type)}</span></td>
                <td style={{fontWeight:600}}>{m.qty}</td>
                <td>{m.after_qty}</td>
                <td style={{fontSize:11,color:'var(--t3)'}}>{m.created_at}</td>
              </tr>
            ))}</tbody></table>
          </div>
        )}

        {sub==='warehouses'&&<>
          <div className='caf-section-bar'><span/><button className='btn btn-p' onClick={()=>{setWhEdit(null);setWhForm({name:'',name_ar:'',code:'',address:'',is_active:true});setWhShow(true);}}><Ic name='plus' size={14}/> {locale==='ar'?'مستودع جديد':'New Warehouse'}</button></div>
          <div className='card' style={{padding:0,overflow:'hidden'}}>
            <table><thead><tr><th>{t('common.name')}</th><th>{locale==='ar'?'الرمز':'Code'}</th><th>{locale==='ar'?'الحالة':'Status'}</th><th></th></tr></thead>
            <tbody>{warehouses.map(w=>(
              <tr key={w.id}>
                <td><strong>{locale==='ar'&&w.name_ar?w.name_ar:w.name}</strong></td>
                <td style={{fontFamily:'monospace',fontSize:11}}>{w.code}</td>
                <td><span className={`badge ${w.is_active?'b-active':'b-inactive'}`}>{w.is_active?t('status.active'):t('status.inactive')}</span></td>
                <td><button className='btn btn-s btn-sm' onClick={()=>{setWhEdit(w);setWhForm({...w});setWhShow(true);}}><Ic name='edit' size={13}/></button></td>
              </tr>
            ))}</tbody></table>
          </div>
        </>}

        {show&&<StockMoveModal products={products} warehouses={warehouses} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);reloadM();}}/>}
        {whShow&&<Modal title={whEdit?t('btn.edit'):locale==='ar'?'مستودع جديد':'New Warehouse'} onClose={()=>setWhShow(false)}>
          <div className='mdl-b'>
            <div className='fg'><label>{t('common.name')} *</label><input className='fi' value={whForm.name||''} onChange={e=>setWhForm(p=>({...p,name:e.target.value}))}/></div>
            <div className='fg'><label>{t('common.name')} AR</label><input className='fi' value={whForm.name_ar||''} onChange={e=>setWhForm(p=>({...p,name_ar:e.target.value}))}/></div>
            <div className='fg'><label>{locale==='ar'?'الرمز':'Code'}</label><input className='fi' value={whForm.code||''} onChange={e=>setWhForm(p=>({...p,code:e.target.value}))}/></div>
          </div>
          <div className='mdl-f'><button className='btn btn-s' onClick={()=>setWhShow(false)}>{t('btn.cancel')}</button><button className='btn btn-p' onClick={saveWh}>{t('btn.save')}</button></div>
        </Modal>}
      </div>
    );
  }

  // Stock move modal
  function StockMoveModal({products,warehouses,onClose,onSaved}){
    const {t,locale}=useI18n();
    const [f,setF]=useState({product_id:'',warehouse_id:warehouses?.[0]?.id||1,move_type:'receipt',qty:1,unit_cost:0,notes:''});
    const s=(k,v)=>setF(p=>({...p,[k]:v}));
    const [saving,setSaving]=useState(false);
    const save=async()=>{
      try{setSaving(true);await api.post('/api/cafeteria/stock-moves',f);toast(t('btn.save'));onSaved();}
      catch(e){toast(e.message,'e');}finally{setSaving(false);}
    };
    return(
      <Modal title={t('cafeteria.stockAdjustment','Stock Adjustment')} onClose={onClose}>
        <div className='mdl-b'>
          <div className='fg'><label>{t('cafeteria.product')} *</label><select className='fi' value={f.product_id} onChange={e=>s('product_id',e.target.value)}><option value=''>{t('common.select','Select')}</option>{products.filter(p=>p.product_type!=='service').map(p=><option key={p.id} value={p.id}>{locale==='ar'&&p.name_ar?p.name_ar:p.name}</option>)}</select></div>
          <div className='fg'><label>{t('cafeteria.warehouse')}</label><select className='fi' value={f.warehouse_id} onChange={e=>s('warehouse_id',e.target.value)}>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className='fr3'>
            <div className='fg'><label>{t('cafeteria.moveType')}</label><select className='fi' value={f.move_type} onChange={e=>s('move_type',e.target.value)}><option value='receipt'>{t('cafeteria.move.receipt','Receipt')}</option><option value='adjustment'>{t('cafeteria.move.adjustment','Adjustment')}</option><option value='waste'>{t('cafeteria.move.waste','Waste')}</option><option value='issue'>{t('cafeteria.move.issue','Issue')}</option></select></div>
            <div className='fg'><label>{t('cafeteria.qty')} *</label><input className='fi' type='number' value={f.qty} onChange={e=>s('qty',Number(e.target.value))}/></div>
            <div className='fg'><label>{t('cafeteria.cost')}</label><input className='fi' type='number' value={f.unit_cost} onChange={e=>s('unit_cost',Number(e.target.value))}/></div>
          </div>
          <div className='fg'><label>{t('common.notes')}</label><textarea className='fi' value={f.notes} onChange={e=>s('notes',e.target.value)}/></div>
        </div>
        <div className='mdl-f'><button className='btn btn-s' onClick={onClose}>{t('btn.cancel')}</button><button className='btn btn-p' onClick={save} disabled={saving}>{saving?'...':t('btn.save')}</button></div>
      </Modal>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ORDERS SECTION (order history + void/refund)
  // ══════════════════════════════════════════════════════════
  function OrdersSection(){
    const {t,locale}=useI18n();
    const [statusF,setStatusF]=useState('');
    const [items,loading,,reload]=useLoad(`/api/cafeteria/orders${statusF?'?status='+statusF:''}`, [statusF], []);
    const [meta]=useCafMeta();
    const cur=meta.currency||'JOD';
    const [acting,setActing]=useState(null);

    const voidOrder=async id=>{
      if(!window.confirm(locale==='ar'?'إلغاء هذا الطلب؟':'Void this order?')) return;
      try{setActing(id);await api.post(`/api/cafeteria/orders/${id}/void`,{});toast(locale==='ar'?'تم الإلغاء':'Voided');reload();}
      catch(e){toast(e.message,'e');}finally{setActing(null);}
    };

    return(
      <div className='pb'>
        <div className='caf-section-bar'>
          <div className='fb' style={{margin:0}}>
            <select className='fi' style={{minWidth:140}} value={statusF} onChange={e=>setStatusF(e.target.value)}>
              <option value=''>{locale==='ar'?'كل الحالات':'All Statuses'}</option>
              <option value='paid'>{locale==='ar'?'مكتمل':'Paid'}</option>
              <option value='held'>{locale==='ar'?'معلق':'Held'}</option>
              <option value='refunded'>{locale==='ar'?'مُسترد':'Refunded'}</option>
              <option value='voided'>{locale==='ar'?'ملغى':'Voided'}</option>
            </select>
          </div>
          <button className='btn btn-s btn-sm' onClick={reload}>{locale==='ar'?'تحديث':'Refresh'}</button>
        </div>
        {loading?<div className='pld'><span className='spinner'/></div>:(
          <div className='card' style={{padding:0,overflow:'hidden'}}>
            <table><thead><tr>
              <th>{t('cafeteria.order')}</th><th>{t('common.name')}</th>
              <th>{locale==='ar'?'الوردة':'Cashier'}</th>
              <th>{locale==='ar'?'التاريخ':'Date'}</th>
              <th>{locale==='ar'?'الطريقة':'Method'}</th>
              <th>{t('common.total','Total')}</th>
              <th>{t('common.status')}</th>
              <th></th>
            </tr></thead>
            <tbody>{items.length===0?<tr><td colSpan={8}><div className='empty'><h3>{t('common.noData')}</h3></div></td></tr>:items.map(o=>(
              <tr key={o.id}>
                <td style={{fontFamily:'monospace',fontSize:12}}>{o.order_no}</td>
                <td>{o.customer_name||'—'}</td>
                <td>{o.cashier_name||'—'}</td>
                <td style={{fontSize:11,color:'var(--t3)'}}>{o.created_at}</td>
                <td><span className='badge b-info'>{o.payment_method||'—'}</span></td>
                <td><strong>{fmt(o.total,cur)}</strong></td>
                <td><span className={`badge b-${o.status}`}>{t('status.'+o.status,o.status)}</span></td>
                <td>{o.status==='paid'&&<button className='btn btn-s btn-sm' onClick={()=>voidOrder(o.id)} disabled={acting===o.id}>{acting===o.id?'...':locale==='ar'?'إلغاء':'Void'}</button>}</td>
              </tr>
            ))}</tbody></table>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // SESSIONS SECTION
  // ══════════════════════════════════════════════════════════
  function SessionsSection(){
    const {t,locale}=useI18n();
    const [rows,loading]=useLoad('/api/cafeteria/sessions',[],[]);
    const [meta]=useCafMeta();
    const cur=meta.currency||'JOD';
    return(
      <div className='pb'>
        {meta.openSession&&(
          <div style={{background:'var(--green-g)',border:'1px solid var(--green)',borderRadius:'var(--rs)',padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
            <span style={{color:'var(--green)',fontWeight:600,fontSize:13}}>● {locale==='ar'?'جلسة مفتوحة الآن':'Active Session Now'}</span>
            <span style={{fontSize:12,color:'var(--t3)'}}>
              {locale==='ar'?'الصراف:':'Cashier:'} {meta.openSession.username||'—'} · {locale==='ar'?'فُتحت في:':'Opened at:'} {meta.openSession.opened_at}
            </span>
          </div>
        )}
        <div className='card' style={{padding:0,overflow:'hidden'}}>
          <table><thead><tr>
            <th>{locale==='ar'?'الصراف':'Cashier'}</th>
            <th>{t('common.status')}</th>
            <th>{t('cafeteria.openingCash')}</th>
            <th>{t('cafeteria.expectedCash')}</th>
            <th>{t('cafeteria.countedCash')}</th>
            <th>{locale==='ar'?'الفارق':'Difference'}</th>
            <th>{locale==='ar'?'إجمالي المبيعات':'Sales Total'}</th>
            <th>{locale==='ar'?'عدد الطلبات':'Orders'}</th>
          </tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={8}><div className='empty'><h3>{t('common.noData')}</h3></div></td></tr>:rows.map(r=>(
            <tr key={r.id}>
              <td><strong style={{fontSize:13}}>{r.username||'—'}</strong></td>
              <td><span className={`badge ${r.status==='open'?'b-active':'b-inactive'}`}>{t('status.'+r.status,r.status)}</span></td>
              <td>{fmt(r.opening_cash,cur)}</td>
              <td>{fmt(r.expected_cash,cur)}</td>
              <td>{r.counted_cash!=null?fmt(r.counted_cash,cur):'—'}</td>
              <td style={{color:Number(r.discrepancy||0)===0?'var(--green)':Number(r.discrepancy||0)>0?'var(--amber)':'var(--red)',fontWeight:600}}>{r.discrepancy!=null?fmt(r.discrepancy,cur):'—'}</td>
              <td><strong>{fmt(r.sales_total,cur)}</strong></td>
              <td>{r.orders_count||0}</td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // REPORTS SECTION
  // ══════════════════════════════════════════════════════════
  function ReportsSection(){
    const {t,locale}=useI18n();
    const [filters,setFilters]=useState({date_from:'',date_to:''});
    const [data,loading,setData]=useLoad('/api/cafeteria/reports/summary?'+new URLSearchParams(filters),[],null);
    const [meta]=useCafMeta();
    const cur=data?.currency||meta.currency||'JOD';
    const sf=k=>e=>setFilters(p=>({...p,[k]:e.target.value}));

    if(loading) return <div className='pb'><div className='pld'><span className='spinner'/></div></div>;
    if(!data) return <div className='pb'><div className='empty'><h3>{t('common.noData')}</h3></div></div>;

    return(
      <div className='pb'>
        <div className='fb' style={{marginBottom:14}}>
          <input className='fi' type='date' value={filters.date_from} onChange={sf('date_from')}/>
          <input className='fi' type='date' value={filters.date_to} onChange={sf('date_to')}/>
          <button className='btn btn-p' onClick={()=>api.get('/api/cafeteria/reports/summary?'+new URLSearchParams(filters)).then(r=>setData(r.data)).catch(e=>toast(e.message,'e'))}>{t('btn.search')}</button>
        </div>
        <div className='sg' style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          {[
            [t('cafeteria.grossSales'),  fmt(data.totals?.gross_sales,cur)],
            [t('cafeteria.refunds'),     fmt(data.totals?.refunded_total,cur)],
            [t('cafeteria.cogs'),        fmt(data.totals?.cogs_total,cur)],
            [t('cafeteria.grossProfit'), fmt(data.totals?.gross_profit,cur)],
          ].map(([label,val],i)=><div className='sc' key={i}><div className='sl'>{label}</div><div className='sv' style={{fontSize:18}}>{val}</div></div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14}}>
          <div className='card'>
            <div className='ct'>{t('cafeteria.salesByProduct')}</div>
            {(data.salesByProduct||[]).map((r,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{locale==='ar'&&r.product_name_ar?r.product_name_ar:r.product_name}</span>
                <strong>{fmt(r.total,cur)}</strong>
              </div>
            ))}
            {!(data.salesByProduct||[]).length&&<div className='empty'><h3>{t('common.noData')}</h3></div>}
          </div>
          <div className='card'>
            <div className='ct'>{t('cafeteria.salesByCashier')}</div>
            {(data.salesByCashier||[]).map((r,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{r.cashier_name}</span>
                <strong>{fmt(r.total,cur)}</strong>
              </div>
            ))}
            {!(data.salesByCashier||[]).length&&<div className='empty'><h3>{t('common.noData')}</h3></div>}
          </div>
          <div className='card'>
            <div className='ct'>{t('cafeteria.salesByPaymentMethod')}</div>
            {(data.salesByPaymentMethod||[]).map((r,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{t('cafeteria.pm.'+r.payment_method,r.payment_method)}</span>
                <strong>{fmt(r.total,cur)}</strong>
              </div>
            ))}
          </div>
          <div className='card'>
            <div className='ct'>{t('cafeteria.profitabilityByCategory')}</div>
            {(data.profitabilityByCategory||[]).map((r,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span>{locale==='ar'&&r.name_ar?r.name_ar:r.name}</span>
                <strong style={{color:'var(--green)'}}>{fmt((r.sales||0)-(r.cost||0),cur)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MAIN CAFETERIA WORKSPACE (top-nav hub)
  // ══════════════════════════════════════════════════════════
  // ─── Debts Section ────────────────────────────────
  function DebtsSection(){
    const {locale,formatCurrency}=useI18n();const isAr=locale==='ar';
    const [data,setData]=useState({orders:[],totalDebt:0,byMember:[]});
    const [loading,setLoading]=useState(true);
    const [settling,setSettling]=useState(null);
    const [settleMethod,setSettleMethod]=useState('cash');
    const money=v=>formatCurrency?formatCurrency(Number(v||0)):`${Number(v||0).toFixed(2)}`;
    const load=()=>{setLoading(true);api.get('/api/cafeteria/debts').then(r=>{setData(r.data||{orders:[],totalDebt:0,byMember:[]});setLoading(false)}).catch(()=>setLoading(false))};
    useEffect(()=>{load()},[]);
    const settle=async(orderId)=>{try{await api.post(`/api/cafeteria/debts/${orderId}/settle`,{method:settleMethod});toast(isAr?'تم تسديد الدين':'Debt settled');setSettling(null);load()}catch(e){toast(e.message,'e')}};
    if(loading)return <div className='pld'><span className='spinner'/></div>;
    return <div className='pb'>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(180px,1fr))',gap:12,marginBottom:20}}>
        <div className='card' style={{margin:0,padding:16,textAlign:'center'}}><div style={{fontSize:12,color:'var(--t3)'}}>{isAr?'إجمالي الديون':'Total Debts'}</div><div style={{fontSize:24,fontWeight:800,color:'#ef4444'}}>{money(data.totalDebt)}</div></div>
        <div className='card' style={{margin:0,padding:16,textAlign:'center'}}><div style={{fontSize:12,color:'var(--t3)'}}>{isAr?'عدد الطلبات':'Orders'}</div><div style={{fontSize:24,fontWeight:800}}>{data.orders?.length||0}</div></div>
        <div className='card' style={{margin:0,padding:16,textAlign:'center'}}><div style={{fontSize:12,color:'var(--t3)'}}>{isAr?'عدد المدينين':'Debtors'}</div><div style={{fontSize:24,fontWeight:800}}>{data.byMember?.length||0}</div></div>
      </div>
      {data.byMember?.length>0&&<div className='card' style={{margin:'0 0 16px'}}><div className='ct'>{isAr?'ملخص حسب العضو':'By Member'}</div><table><thead><tr><th>{isAr?'العضو':'Member'}</th><th>{isAr?'الرقم':'No.'}</th><th>{isAr?'الهاتف':'Phone'}</th><th>{isAr?'عدد الطلبات':'Orders'}</th><th>{isAr?'المبلغ':'Amount'}</th></tr></thead><tbody>
        {data.byMember.map(m=><tr key={m.member_id}><td style={{fontWeight:700}}>{m.name}</td><td>{m.member_no}</td><td>{m.phone}</td><td>{m.count}</td><td style={{color:'#ef4444',fontWeight:700}}>{money(m.total)}</td></tr>)}
      </tbody></table></div>}
      <div className='card' style={{margin:0}}><div className='ct'>{isAr?'طلبات الديون':'Debt Orders'}</div>{data.orders?.length?<table><thead><tr><th>{isAr?'رقم الطلب':'Order'}</th><th>{isAr?'العضو':'Member'}</th><th>{isAr?'المبلغ':'Amount'}</th><th>{isAr?'التاريخ':'Date'}</th><th>{isAr?'الإجراء':'Action'}</th></tr></thead><tbody>
        {data.orders.map(o=><tr key={o.id}><td>{o.order_no}</td><td>{[o.first_name,o.middle_name,o.last_name].filter(Boolean).join(' ')||o.customer_name}</td><td style={{fontWeight:700,color:'#ef4444'}}>{money(o.total)}</td><td style={{fontSize:12}}>{o.created_at?.split(' ')[0]}</td><td>
          {settling===o.id?<div style={{display:'flex',gap:6,alignItems:'center'}}><select className='fi' style={{fontSize:12,padding:'4px 8px',width:100}} value={settleMethod} onChange={e=>setSettleMethod(e.target.value)}><option value='cash'>{isAr?'نقدي':'Cash'}</option><option value='card'>{isAr?'بطاقة':'Card'}</option><option value='cliq'>CliQ</option></select><button className='btn btn-p btn-sm' onClick={()=>settle(o.id)}><Ic name='check' size={14}/></button><button className='btn btn-s btn-sm' onClick={()=>setSettling(null)}><Ic name='x' size={14}/></button></div>
          :<button className='btn btn-p btn-sm' onClick={()=>setSettling(o.id)}>{isAr?'تسديد':'Settle'}</button>}
        </td></tr>)}
      </tbody></table>:<div className='empty'><h3>{isAr?'لا توجد ديون':'No debts'}</h3></div>}</div>
    </div>;
  }

  function CafeteriaWorkspace({path}){
    const {t,locale}=useI18n();
    const pathToTab={
      '/cafeteria':'dashboard',
      '/cafeteria-products':'products',
      '/cafeteria-stock':'stock',
      '/cafeteria-sessions':'sessions',
      '/cafeteria-reports':'reports',
      '/cafeteria-debts':'debts',
    };
    const [tab,setTab]=useState(pathToTab[path]||'dashboard');
    const [meta,reloadMeta]=useCafMeta();
    const cur=meta.currency||'JOD';

    const tabs=[
      ['dashboard','Dashboard','لوحة التحكم',<Ic name='coffee' size={14}/>],
      ['products', 'Products',  'المنتجات',   <Ic name='package' size={14}/>],
      ['stock',    'Stock',     'المخزون',    <Ic name='archive' size={14}/>],
      ['orders',   'Orders',    'الطلبات',    <Ic name='file-text' size={14}/>],
      ['debts',    'Debts',     'الديون',     <Ic name='clipboard' size={14}/>],
      ['sessions', 'Sessions',  'الجلسات',    <Ic name='briefcase' size={14}/>],
      ['reports',  'Reports',   'التقارير',   <Ic name='bar-chart' size={14}/>],
    ];

    const openPOS=()=>window.open(`${window.location.origin}${window.location.pathname}#/cafeteria-pos`,'_blank','noopener,noreferrer');

    useEffect(()=>{
      if(pathToTab[path] && pathToTab[path]!==tab) setTab(pathToTab[path]);
    },[path]);

    return(
      <div>
        <div className='caf-top-nav'>
          <div className='caf-top-nav-brand'><Ic name='coffee' size={18}/> {locale==='ar'?'الكافتيريا':'Cafeteria'}</div>
          <div className='caf-top-nav-tabs'>
            {tabs.map(([k,en,ar,icon])=>(
              <button key={k} className={`caf-nav-tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>
                <span style={{fontSize:13}}>{icon}</span>
                <span>{locale==='ar'?ar:en}</span>
              </button>
            ))}
          </div>
          <div className='caf-top-nav-actions'>
            {meta.openSession&&<span className='badge b-active' style={{fontSize:11}}>● {locale==='ar'?'جلسة مفتوحة':'Session Open'}</span>}
            <button className='btn btn-p btn-sm' onClick={openPOS}>
<Ic name='monitor' size={16}/> {locale==='ar'?'فتح نقطة البيع':'Open POS'}
            </button>
          </div>
        </div>
        <div className='ph'>
          <h1>{locale==='ar'?tabs.find(t=>t[0]===tab)?.[2]:tabs.find(t=>t[0]===tab)?.[1]}</h1>
        </div>
        {tab==='dashboard' &&<DashboardSection/>}
        {tab==='products'  &&<ProductsSection/>}
        {tab==='stock'     &&<StockSection/>}
        {tab==='orders'    &&<OrdersSection/>}
        {tab==='debts'     &&<DebtsSection/>}
        {tab==='sessions'  &&<SessionsSection/>}
        {tab==='reports'   &&<ReportsSection/>}
      </div>
    );
  }

  // ── Page registrations ────────────────────────────────────
  // Main workspace and tab aliases for backend menu entries
  GymOS.registerPage({ path:'/cafeteria', component:CafeteriaWorkspace, module:'cafeteria', label:'Cafeteria', labelAr:'الكافتيريا', order:60 });
  GymOS.registerPage({ path:'/cafeteria-products', component:CafeteriaWorkspace, module:'cafeteria', label:'Cafeteria Products', labelAr:'منتجات الكافتيريا', order:62 });
  GymOS.registerPage({ path:'/cafeteria-stock', component:CafeteriaWorkspace, module:'cafeteria', label:'Cafeteria Stock', labelAr:'مخزون الكافتيريا', order:63 });
  GymOS.registerPage({ path:'/cafeteria-sessions', component:CafeteriaWorkspace, module:'cafeteria', label:'Cafeteria Sessions', labelAr:'جلسات نقطة البيع', order:64 });
  GymOS.registerPage({ path:'/cafeteria-reports', component:CafeteriaWorkspace, module:'cafeteria', label:'Cafeteria Reports', labelAr:'تقارير الكافتيريا', order:65 });
  GymOS.registerPage({ path:'/cafeteria-debts', component:CafeteriaWorkspace, module:'cafeteria', label:'Cafeteria Debts', labelAr:'ديون الكافتيريا', order:66 });
  // POS — full screen standalone (opens in new tab from workspace or sidebar)
  GymOS.registerPage({ path:'/cafeteria-pos', component:CafeteriaPOSPage, module:'cafeteria', label:'Cafeteria POS', labelAr:'نقطة البيع', order:61, standalone:true });

})();

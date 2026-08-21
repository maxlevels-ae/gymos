// ═══════════════════════════════════════════════════════════
// GymOS Purchase Module V1 — Odoo-style PO Workspace
// Top header nav · RFQ → PO → Receive → Bill flow
// All GymOS native classes: card, sc, sg, btn, fi, fg, badge, etc.
// ═══════════════════════════════════════════════════════════
// NO IIFE — top-level scope
const { useState, useEffect, useCallback, useMemo } = React;
const { api, useI18n, Modal, Ic, toast, formatMoney } = shared;

// ── Helpers ──────────────────────────────────────────────
function fmt(v,c){ return formatMoney ? formatMoney(v||0,c) : Number(v||0).toFixed(3); }
function today(){ return new Date().toISOString().slice(0,10); }
function addDays(d,n){ const dt=new Date(d||Date.now()); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); }

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

function useBootstrap(){
  return useLoad('/api/purchase/bootstrap',[],{currency:'JOD',settings:{},vendors:[],products:[],branches:[]});
}

// ── Status badge ─────────────────────────────────────────
function SBadge({state}){
  const {locale}=useI18n();
  const map={
    draft:     {en:'RFQ',          ar:'طلب عرض سعر', cls:'b-pending'},
    sent:      {en:'RFQ Sent',     ar:'أُرسل',       cls:'b-info'},
    confirmed: {en:'To Approve',   ar:'بانتظار موافقة',cls:'b-warning'},
    approved:  {en:'Purchase Order',ar:'أمر شراء',   cls:'b-active'},
    done:      {en:'Done',         ar:'منجز',         cls:'b-paid'},
    cancelled: {en:'Cancelled',    ar:'ملغى',         cls:'b-cancelled'},
    pending:   {en:'Pending',      ar:'معلق',         cls:'b-warning'},
    partial:   {en:'Partial',      ar:'جزئي',         cls:'b-partial'},
    full:      {en:'Received',     ar:'مستلم',        cls:'b-active'},
    nothing:   {en:'Not Billed',   ar:'غير مفوتر',   cls:'b-inactive'},
    billed:    {en:'Billed',       ar:'مفوتر',        cls:'b-paid'},
    posted:    {en:'Posted',       ar:'مرحّل',        cls:'b-active'},
    paid:      {en:'Paid',         ar:'مدفوع',        cls:'b-paid'},
  };
  const s=map[state]||{en:state||'—',ar:state||'—',cls:'b-inactive'};
  return <span className={`badge ${s.cls}`}>{locale==='ar'?s.ar:s.en}</span>;
}

// ── State flow progress bar ───────────────────────────────
function StateFlow({state,type}){
  const {locale}=useI18n();
  const steps = type==='rfq'
    ? [{k:'draft',en:'RFQ',ar:'طلب عرض سعر'},{k:'sent',en:'RFQ Sent',ar:'أُرسل'},{k:'confirmed',en:'Purchase Order',ar:'أمر شراء'}]
    : [{k:'approved',en:'Purchase Order',ar:'أمر شراء'},{k:'done',en:'Goods Received',ar:'استُلم'},{k:'billed',en:'Billed',ar:'مفوتر'}];
  const order=['draft','sent','confirmed','approved','done'];
  const idx=order.indexOf(state);
  return(
    <div className='po-state-flow'>
      {steps.map((s,i)=>{
        const stepIdx=order.indexOf(s.k);
        const cls = stepIdx<idx?'done':stepIdx===idx?'active':'';
        return <div key={s.k} className={`po-state-step ${cls}`}>{locale==='ar'?s.ar:s.en}</div>;
      })}
    </div>
  );
}

// ── Generic Table ─────────────────────────────────────────
function Tbl({rows=[],cols=[],loading,onRow,emptyLabel,emptyAction,onEmptyAction}){
  const {locale}=useI18n();
  if(loading) return <div className='pld'><span className='spinner'/></div>;
  return(
    <div className='card' style={{padding:0,overflow:'hidden'}}>
      <table>
        <thead><tr>{cols.map(c=><th key={c.key}>{locale==='ar'&&c.ar?c.ar:c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length===0
            ?<tr><td colSpan={cols.length}>
              <div className='empty'><h3>{emptyLabel||(locale==='ar'?'لا توجد بيانات':'No records')}</h3>
                {emptyAction&&<button className='btn btn-p btn-sm' style={{marginTop:8}} onClick={onEmptyAction}>{emptyAction}</button>}
              </div></td></tr>
            :rows.map((row,i)=>(
              <tr key={row.id||i} onClick={()=>onRow&&onRow(row)} style={onRow?{cursor:'pointer'}:{}}>
                {cols.map(c=><td key={c.key}>{c.render?c.render(row,locale):String(row[c.key]??'—')}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

// ── Form field ────────────────────────────────────────────
function F({label,children,span}){
  return <div className='fg' style={span?{gridColumn:'1 / -1'}:{}}><label>{label}</label>{children}</div>;
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function DashboardSection({cur}){
  const {locale}=useI18n();
  const [stats,loading]=useLoad('/api/purchase/dashboard',[],{});
  if(loading) return <div className='pb'><div className='pld'><span className='spinner'/></div></div>;
  const kpis=[
    ['طلبات عروض الأسعار','RFQs to Process',stats.rfqCount,'var(--amber)'],
    ['أوامر شراء','Purchase Orders',stats.poCount,'var(--accent-h)'],
    ['بانتظار الاستلام','To Receive',stats.toReceive,'var(--cyan)'],
    ['بانتظار الفوترة','To Bill',stats.toBill,'var(--purple)'],
    ['مصروفات الشهر','MTD Spend',fmt(stats.mtdSpend,cur),'var(--green)'],
    ['مصروفات السنة','YTD Spend',fmt(stats.ytdSpend,cur),'var(--t2)'],
    ['فواتير معلقة','Pending Bills',fmt(stats.pendingBillAmount,cur),'var(--red)'],
    ['أوامر منجزة','Done Orders',stats.doneCount,'var(--green)'],
  ];
  return(
    <div className='pb'>
      <div className='sg' style={{gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))'}}>
        {kpis.map(([ar,en,val],i)=>(
          <div className='sc' key={i}>
            <div className='sl'>{locale==='ar'?ar:en}</div>
            <div className='sv' style={{fontSize:typeof val==='string'?16:24}}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14,marginTop:4}}>
        <div className='card'>
          <div className='ct'>{locale==='ar'?'آخر الطلبات':'Recent Orders'}</div>
          <table><thead><tr>
            <th>{locale==='ar'?'الرقم':'Number'}</th>
            <th>{locale==='ar'?'المورد':'Vendor'}</th>
            <th>{locale==='ar'?'التاريخ':'Date'}</th>
            <th>{locale==='ar'?'الحالة':'Status'}</th>
            <th>{locale==='ar'?'الإجمالي':'Total'}</th>
          </tr></thead>
          <tbody>{(stats.recentOrders||[]).map((r,i)=>(
            <tr key={i}>
              <td style={{fontSize:12,fontFamily:'monospace'}}>{r.po_number}</td>
              <td>{r.vendor_name||'—'}</td>
              <td>{r.order_date}</td>
              <td><SBadge state={r.state}/></td>
              <td>{fmt(r.total_amount,cur)}</td>
            </tr>
          ))}</tbody>
          </table>
        </div>
        <div className='card'>
          <div className='ct'>{locale==='ar'?'أفضل الموردين':'Top Vendors'}</div>
          {(stats.topVendors||[]).map((v,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
              <span>{v.vendor_name||'—'}</span>
              <strong>{fmt(v.spend,cur)}</strong>
            </div>
          ))}
          {!(stats.topVendors||[]).length&&<div className='empty'><h3>{locale==='ar'?'لا بيانات':'No data yet'}</h3></div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER FORM — RFQ / PO create and edit
// ══════════════════════════════════════════════════════════
function OrderForm({initial,bootstrap,onClose,onSaved}){
  const {locale}=useI18n();
  const cur=bootstrap?.currency||'JOD';
  const vendors=bootstrap?.vendors||[];
  const products=bootstrap?.products||[];
  const branches=bootstrap?.branches||[];
  const defaultLeadDays=Number(bootstrap?.settings?.default_lead_days||7);

  const [form,setForm]=useState({
    vendor_id:'', vendor_name:'', branch_id:'', order_date:today(),
    expected_date:addDays(today(),defaultLeadDays),
    currency:cur, payment_terms:30,
    notes:'', internal_notes:'', source_reference:'',
    ...(initial||{})
  });
  const [lines,setLines]=useState((initial?.lines||[{product_id:'',description:'',uom:'unit',qty_ordered:1,unit_price:0,discount_pct:0,tax_rate:0}]));
  const [saving,setSaving]=useState(false);
  const sf=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const sl=(i,k,v)=>setLines(p=>p.map((l,idx)=>idx===i?{...l,[k]:v}:l));

  // Auto-fill vendor details when vendor selected
  const onVendorChange=e=>{
    const vid=e.target.value;
    const v=vendors.find(x=>String(x.id)===String(vid));
    setForm(p=>({...p,vendor_id:vid,vendor_name:v?.name||'',payment_terms:v?.payment_terms||30,currency:v?.currency||cur}));
  };

  // Auto-fill product price when product selected
  const onProductChange=(i,pid)=>{
    const p=products.find(x=>String(x.id)===String(pid));
    setLines(prev=>prev.map((l,idx)=>idx===i?{...l,product_id:pid,description:p?p.name:'',uom:p?.uom||'unit',unit_price:p?.last_purchase_price||p?.standard_price||0,tax_rate:p?.tax_rate||0}:l));
  };

  const subtotal=lines.reduce((s,l)=>s+Number(l.qty_ordered||1)*Number(l.unit_price||0)*(1-Number(l.discount_pct||0)/100),0);
  const taxTotal=lines.reduce((s,l)=>{const base=Number(l.qty_ordered||1)*Number(l.unit_price||0)*(1-Number(l.discount_pct||0)/100);return s+base*(Number(l.tax_rate||0)/100);},0);
  const total=subtotal+taxTotal;

  const save=async()=>{
    if(!form.order_date){toast(locale==='ar'?'التاريخ مطلوب':'Date required','e');return;}
    if(!form.vendor_id&&!form.vendor_name){toast(locale==='ar'?'اختر مورداً':'Select a vendor','e');return;}
    try{
      setSaving(true);
      const payload={...form,lines:lines.map(l=>({...l,qty_ordered:Number(l.qty_ordered||1),unit_price:Number(l.unit_price||0),discount_pct:Number(l.discount_pct||0),tax_rate:Number(l.tax_rate||0)}))};
      if(initial?.id){ await api.put(`/api/purchase/orders/${initial.id}`,payload); toast(locale==='ar'?'تم الحفظ':'Saved'); }
      else { const r=await api.post('/api/purchase/orders',payload); toast(locale==='ar'?'تم الإنشاء':'Created'); }
      onSaved();
    }catch(e){toast(e.message||'Error','e');}finally{setSaving(false);}
  };

  const uoms=['unit','kg','g','litre','ml','box','carton','pack','pair','piece','set','hour'];
  const isEdit=!!initial?.id;

  return(
    <div>
      <div className='po-form-hdr'>
        <div>
          <h2>{isEdit?(locale==='ar'?`تعديل ${initial.po_number}`:`Edit ${initial.po_number}`):(locale==='ar'?'طلب عرض سعر جديد':'New Request for Quotation')}</h2>
          {isEdit&&<div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{initial.vendor_name}</div>}
        </div>
        <div className='po-form-acts'>
          <button className='btn btn-s' onClick={onClose} disabled={saving}>{locale==='ar'?'إلغاء':'Discard'}</button>
          <button className='btn btn-p' onClick={save} disabled={saving}>{saving?'...':locale==='ar'?'حفظ':'Save'}</button>
        </div>
      </div>
      <div className='po-form-body'>
        <div className='fr3'>
          <F label={locale==='ar'?'المورد':'Vendor'}>
            <select className='fi' value={form.vendor_id} onChange={onVendorChange}>
              <option value=''>{locale==='ar'?'— اختر —':'— Select —'}</option>
              {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </F>
          {!form.vendor_id&&<F label={locale==='ar'?'اسم المورد (يدوي)':'Vendor Name (manual)'}>
            <input className='fi' value={form.vendor_name} onChange={sf('vendor_name')} placeholder='Enter vendor name...'/>
          </F>}
          <F label={locale==='ar'?'تاريخ الطلب':'Order Date'}>
            <input className='fi' type='date' value={form.order_date} onChange={sf('order_date')}/>
          </F>
          <F label={locale==='ar'?'التاريخ المتوقع':'Expected Date'}>
            <input className='fi' type='date' value={form.expected_date} onChange={sf('expected_date')}/>
          </F>
          <F label={locale==='ar'?'الفرع':'Branch'}>
            <select className='fi' value={form.branch_id} onChange={sf('branch_id')}>
              <option value=''>{locale==='ar'?'كل الفروع':'All Branches'}</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </F>
          <F label={locale==='ar'?'العملة':'Currency'}>
            <input className='fi' value={form.currency} onChange={sf('currency')}/>
          </F>
          <F label={locale==='ar'?'شروط الدفع (أيام)':'Payment Terms (days)'}>
            <input className='fi' type='number' value={form.payment_terms} onChange={sf('payment_terms')}/>
          </F>
          <F label={locale==='ar'?'المرجع':'Source Reference'}>
            <input className='fi' value={form.source_reference} onChange={sf('source_reference')} placeholder='e.g. PR-2024-001'/>
          </F>
          <F label={locale==='ar'?'ملاحظات للمورد':'Notes to Vendor'} span>
            <input className='fi' value={form.notes} onChange={sf('notes')} placeholder='Delivery instructions, terms...'/>
          </F>
        </div>

        <div style={{fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--t4)',margin:'16px 0 8px'}}>
          {locale==='ar'?'بنود الطلب':'Order Lines'}
        </div>
        <table>
          <thead><tr>
            <th>{locale==='ar'?'المنتج / الوصف':'Product / Description'}</th>
            <th style={{width:80}}>{locale==='ar'?'الوحدة':'UoM'}</th>
            <th style={{width:80}}>{locale==='ar'?'الكمية':'Qty'}</th>
            <th style={{width:110}}>{locale==='ar'?'سعر الوحدة':'Unit Price'}</th>
            <th style={{width:80}}>{locale==='ar'?'خصم %':'Disc %'}</th>
            <th style={{width:80}}>{locale==='ar'?'ضريبة %':'Tax %'}</th>
            <th style={{width:110}}>{locale==='ar'?'المجموع':'Total'}</th>
            <th style={{width:36}}></th>
          </tr></thead>
          <tbody>
            {lines.map((l,i)=>{
              const base=Number(l.qty_ordered||1)*Number(l.unit_price||0)*(1-Number(l.discount_pct||0)/100);
              const lineTot=base*(1+Number(l.tax_rate||0)/100);
              return(
                <tr key={i}>
                  <td>
                    <select className='fi' style={{padding:'4px 6px',fontSize:12,marginBottom:4,width:'100%'}} value={l.product_id||''} onChange={e=>onProductChange(i,e.target.value)}>
                      <option value=''>{locale==='ar'?'— اختر منتجاً —':'— Select product —'}</option>
                      {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className='fi' style={{padding:'4px 6px',fontSize:12}} value={l.description} onChange={e=>sl(i,'description',e.target.value)} placeholder='Description...'/>
                  </td>
                  <td><select className='fi' style={{padding:'4px 6px',fontSize:12}} value={l.uom||'unit'} onChange={e=>sl(i,'uom',e.target.value)}>{uoms.map(u=><option key={u} value={u}>{u}</option>)}</select></td>
                  <td><input className='fi' style={{padding:'4px 6px',fontSize:12}} type='number' min='0' step='.001' value={l.qty_ordered} onChange={e=>sl(i,'qty_ordered',e.target.value)}/></td>
                  <td><input className='fi' style={{padding:'4px 6px',fontSize:12}} type='number' min='0' step='.001' value={l.unit_price} onChange={e=>sl(i,'unit_price',e.target.value)}/></td>
                  <td><input className='fi' style={{padding:'4px 6px',fontSize:12}} type='number' min='0' max='100' step='.1' value={l.discount_pct||0} onChange={e=>sl(i,'discount_pct',e.target.value)}/></td>
                  <td><input className='fi' style={{padding:'4px 6px',fontSize:12}} type='number' min='0' step='.1' value={l.tax_rate||0} onChange={e=>sl(i,'tax_rate',e.target.value)}/></td>
                  <td style={{fontVariantNumeric:'tabular-nums',fontSize:12}}>{fmt(lineTot,form.currency)}</td>
                  <td><button className='po-del-btn' onClick={()=>setLines(p=>p.filter((_,idx)=>idx!==i))}>×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className='btn btn-s btn-sm' style={{marginTop:8}} onClick={()=>setLines(p=>[...p,{product_id:'',description:'',uom:'unit',qty_ordered:1,unit_price:0,discount_pct:0,tax_rate:0}])}>
          + {locale==='ar'?'إضافة بند':'Add Line'}
        </button>
        <div className='po-totals'>
          <div className='po-total-row'><span>{locale==='ar'?'المجموع الفرعي':'Subtotal'}</span><strong>{fmt(subtotal,form.currency)}</strong></div>
          <div className='po-total-row'><span>{locale==='ar'?'الضريبة':'Tax'}</span><strong>{fmt(taxTotal,form.currency)}</strong></div>
          <div className='po-total-row po-total-final'><span>{locale==='ar'?'الإجمالي':'Total'}</span><strong>{fmt(total,form.currency)}</strong></div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDER DETAIL VIEW — with all actions
// ══════════════════════════════════════════════════════════
function OrderDetail({orderId,bootstrap,onClose,onRefresh}){
  const {locale}=useI18n();
  const cur=bootstrap?.currency||'JOD';
  const [order,loading,,reload]=useLoad(`/api/purchase/orders/${orderId}`,[orderId],null);
  const [view,setView]=useState('detail'); // detail | edit | receive | bill
  const [acting,setActing]=useState(false);
  const [showCancel,setShowCancel]=useState(false);
  const [cancelReason,setCancelReason]=useState('');
  const [receiveLines,setReceiveLines]=useState([]);
  const [receiveDate,setReceiveDate]=useState(today());
  const [billForm,setBillForm]=useState({invoice_date:today(),notes:''});

  useEffect(()=>{
    if(order?.lines) setReceiveLines(order.lines.map(l=>({...l,qty_done:Math.max(0,Number(l.qty_ordered||0)-Number(l.qty_received||0))})));
  },[order?.id]);

  if(loading||!order) return <div className='pb'><div className='pld'><span className='spinner'/></div></div>;
  if(view==='edit') return <OrderForm initial={order} bootstrap={bootstrap} onClose={()=>setView('detail')} onSaved={()=>{setView('detail');reload();}}/>;

  const canEdit=['draft','sent'].includes(order.state);
  const canConfirm=['draft','sent'].includes(order.state);
  const canApprove=order.state==='confirmed';
  const canReceive=['confirmed','approved'].includes(order.state);
  const canBill=['confirmed','approved','done'].includes(order.state)&&['nothing','partial'].includes(order.billing_status);
  const canCancel=!['done','cancelled'].includes(order.state);
  const isCancelled=order.state==='cancelled';

  const act=async(fn,successMsg)=>{
    try{ setActing(true); await fn(); toast(successMsg); onRefresh(); reload(); }
    catch(e){ toast(e.message||'Error','e'); } finally{ setActing(false); }
  };

  const confirm=()=>act(()=>api.post(`/api/purchase/orders/${orderId}/confirm`,{}),locale==='ar'?'تم تأكيد الطلب':'Order confirmed');
  const approve=()=>act(()=>api.post(`/api/purchase/orders/${orderId}/approve`,{}),locale==='ar'?'تمت الموافقة':'Approved');
  const send=()=>act(()=>api.post(`/api/purchase/orders/${orderId}/send`,{}),locale==='ar'?'تم الإرسال':'RFQ Sent');
  const cancelOrder=()=>act(()=>api.post(`/api/purchase/orders/${orderId}/cancel`,{reason:cancelReason}),locale==='ar'?'تم الإلغاء':'Cancelled');
  const reset=()=>act(()=>api.post(`/api/purchase/orders/${orderId}/reset`,{}),locale==='ar'?'تمت إعادة التعيين':'Reset to draft');

  const doReceive=async()=>{
    const validLines=receiveLines.filter(l=>Number(l.qty_done||0)>0).map(l=>({order_line_id:l.id,product_id:l.product_id,description:l.description,qty_done:Number(l.qty_done),uom:l.uom}));
    if(!validLines.length){toast(locale==='ar'?'أدخل كمية مستلمة':'Enter qty to receive','e');return;}
    await act(()=>api.post('/api/purchase/receipts',{order_id:orderId,receipt_date:receiveDate,lines:validLines}),locale==='ar'?'تم تسجيل الاستلام':'Goods received');
    setView('detail');
  };

  const doBill=async()=>{
    await act(()=>api.post(`/api/purchase/bills/create-from-order/${orderId}`,{}),locale==='ar'?'تم إنشاء الفاتورة':'Bill created');
    setView('detail');
  };

  if(view==='receive'){
    return(
      <div>
        <div className='po-form-hdr'>
          <h2>{locale==='ar'?`استلام البضاعة — ${order.po_number}`:`Receive Goods — ${order.po_number}`}</h2>
          <div className='po-form-acts'>
            <button className='btn btn-s' onClick={()=>setView('detail')}>{locale==='ar'?'رجوع':'Back'}</button>
            <button className='btn btn-p' onClick={doReceive} disabled={acting}>{acting?'...':locale==='ar'?'تأكيد الاستلام':'Validate Receipt'}</button>
          </div>
        </div>
        <div className='po-form-body'>
          <div className='fr'>
            <div className='fg'><label>{locale==='ar'?'تاريخ الاستلام':'Receipt Date'}</label><input className='fi' type='date' value={receiveDate} onChange={e=>setReceiveDate(e.target.value)}/></div>
          </div>
          <table style={{marginTop:14}}>
            <thead><tr>
              <th>{locale==='ar'?'المنتج / البيان':'Product / Description'}</th>
              <th>{locale==='ar'?'الوحدة':'UoM'}</th>
              <th>{locale==='ar'?'الكمية المطلوبة':'Ordered'}</th>
              <th>{locale==='ar'?'المستلم سابقاً':'Received'}</th>
              <th>{locale==='ar'?'الكمية المستلمة الآن':'Done (Now)'}</th>
            </tr></thead>
            <tbody>
              {receiveLines.map((l,i)=>(
                <tr key={l.id}>
                  <td>{l.description}</td>
                  <td>{l.uom}</td>
                  <td>{l.qty_ordered}</td>
                  <td className='po-receipt-qty'>{l.qty_received||0}</td>
                  <td><input className='fi' style={{padding:'4px 8px',fontSize:13,width:90}} type='number' min='0' step='.001' value={l.qty_done||0} onChange={e=>setReceiveLines(prev=>prev.map((r,idx)=>idx===i?{...r,qty_done:e.target.value}:r))}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Detail view
  return(
    <div>
      <div className='po-form-hdr'>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <span className='po-doc-no'>{order.po_number}</span>
            <SBadge state={order.state}/>
            {order.receipt_status!=='pending'&&<SBadge state={order.receipt_status}/>}
            {order.billing_status!=='nothing'&&<SBadge state={order.billing_status}/>}
          </div>
          <div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{order.vendor_name} · {order.order_date}</div>
        </div>
        <div className='po-form-acts' style={{flexWrap:'wrap'}}>
          <button className='btn btn-s' onClick={onClose}>{locale==='ar'?'رجوع':'Back'}</button>
          {canEdit&&<button className='btn btn-s' onClick={()=>setView('edit')}>{locale==='ar'?'تعديل':'Edit'}</button>}
          {order.state==='draft'&&<button className='btn btn-s' onClick={send} disabled={acting}>{locale==='ar'?'إرسال للمورد':'Send RFQ'}</button>}
          {canConfirm&&<button className='btn btn-p' onClick={confirm} disabled={acting}>{acting?'...':locale==='ar'?'تأكيد أمر الشراء':'Confirm Order'}</button>}
          {canApprove&&<button className='btn btn-p' onClick={approve} disabled={acting}>{acting?'...':locale==='ar'?'اعتماد':'Approve'}</button>}
          {canReceive&&<button className='btn btn-g' onClick={()=>setView('receive')}>{locale==='ar'?'استلام البضاعة':'Receive Goods'}</button>}
          {canBill&&<button className='btn btn-s' onClick={doBill} disabled={acting}>{acting?'...':locale==='ar'?'إنشاء فاتورة':'Create Bill'}</button>}
          {canCancel&&<button className='btn btn-d btn-sm' onClick={()=>setShowCancel(true)}>{locale==='ar'?'إلغاء':'Cancel'}</button>}
          {isCancelled&&<button className='btn btn-s btn-sm' onClick={reset}>{locale==='ar'?'إعادة تعيين':'Reset'}</button>}
        </div>
      </div>

      <div className='po-form-body'>
        <StateFlow state={order.state} type={order.order_type==='rfq'?'rfq':'po'}/>

        <div className='dg'>
          <div className='di'><div className='dl'>{locale==='ar'?'المورد':'Vendor'}</div><div className='dv' style={{fontWeight:600}}>{order.vendor_name||'—'}</div></div>
          <div className='di'><div className='dl'>{locale==='ar'?'تاريخ الطلب':'Order Date'}</div><div className='dv'>{order.order_date}</div></div>
          <div className='di'><div className='dl'>{locale==='ar'?'التاريخ المتوقع':'Expected Date'}</div><div className='dv'>{order.expected_date||'—'}</div></div>
          <div className='di'><div className='dl'>{locale==='ar'?'العملة':'Currency'}</div><div className='dv'>{order.currency}</div></div>
          <div className='di'><div className='dl'>{locale==='ar'?'المرجع':'Reference'}</div><div className='dv'>{order.source_reference||'—'}</div></div>
          <div className='di'><div className='dl'>{locale==='ar'?'شروط الدفع':'Payment Terms'}</div><div className='dv'>{order.payment_terms} {locale==='ar'?'يوم':'days'}</div></div>
          <div className='di'><div className='dl'>{locale==='ar'?'الإجمالي':'Total'}</div><div className='dv' style={{fontSize:18,fontWeight:700,color:'var(--accent-h)'}}>{fmt(order.total_amount,order.currency)}</div></div>
          <div className='di'><div className='dl'>{locale==='ar'?'المُفوتر':'Billed'}</div><div className='dv'>{fmt(order.amount_billed,order.currency)}</div></div>
        </div>
        {order.notes&&<div className='po-note' style={{marginTop:12}}>{order.notes}</div>}

        {/* Order lines */}
        <div style={{fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--t4)',margin:'16px 0 8px'}}>{locale==='ar'?'بنود الطلب':'Order Lines'}</div>
        <div className='card' style={{padding:0,overflow:'hidden',marginBottom:14}}>
          <table><thead><tr>
            <th>{locale==='ar'?'البيان':'Description'}</th>
            <th>{locale==='ar'?'الوحدة':'UoM'}</th>
            <th>{locale==='ar'?'الكمية':'Ordered'}</th>
            <th>{locale==='ar'?'المستلم':'Received'}</th>
            <th>{locale==='ar'?'المُفوتر':'Billed'}</th>
            <th>{locale==='ar'?'سعر الوحدة':'Unit Price'}</th>
            <th>{locale==='ar'?'الضريبة':'Tax'}</th>
            <th>{locale==='ar'?'الإجمالي':'Total'}</th>
          </tr></thead>
          <tbody>{(order.lines||[]).map((l,i)=>(
            <tr key={i}>
              <td>{l.description}</td>
              <td>{l.uom}</td>
              <td>{l.qty_ordered}</td>
              <td style={{color:'var(--green)',fontWeight:600}}>{l.qty_received||0}</td>
              <td>{l.qty_billed||0}</td>
              <td>{fmt(l.unit_price,order.currency)}</td>
              <td>{l.tax_rate||0}%</td>
              <td style={{fontWeight:600}}>{fmt(l.line_total,order.currency)}</td>
            </tr>
          ))}</tbody>
          </table>
        </div>

        {/* Receipts */}
        {(order.receipts||[]).length>0&&<>
          <div style={{fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--t4)',margin:'16px 0 8px'}}>{locale==='ar'?'سجلات الاستلام':'Receipts'}</div>
          <div className='card' style={{padding:0,overflow:'hidden',marginBottom:14}}>
            <table><thead><tr>
              <th>{locale==='ar'?'الرقم':'Receipt'}</th>
              <th>{locale==='ar'?'التاريخ':'Date'}</th>
              <th>{locale==='ar'?'الحالة':'State'}</th>
              <th>{locale==='ar'?'إجمالي مستلم':'Total Received'}</th>
            </tr></thead>
            <tbody>{order.receipts.map((r,i)=>(
              <tr key={i}>
                <td style={{fontFamily:'monospace',fontSize:12}}>{r.receipt_number}</td>
                <td>{r.receipt_date}</td>
                <td><SBadge state={r.state}/></td>
                <td>{r.total_received||0}</td>
              </tr>
            ))}</tbody>
            </table>
          </div>
        </>}

        {/* Bills */}
        {(order.bills||[]).length>0&&<>
          <div style={{fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--t4)',margin:'16px 0 8px'}}>{locale==='ar'?'الفواتير':'Vendor Bills'}</div>
          <div className='card' style={{padding:0,overflow:'hidden'}}>
            <table><thead><tr>
              <th>{locale==='ar'?'رقم الفاتورة':'Bill Number'}</th>
              <th>{locale==='ar'?'التاريخ':'Date'}</th>
              <th>{locale==='ar'?'الاستحقاق':'Due'}</th>
              <th>{locale==='ar'?'الحالة':'Status'}</th>
              <th>{locale==='ar'?'الإجمالي':'Total'}</th>
              <th>{locale==='ar'?'المتبقي':'Residual'}</th>
            </tr></thead>
            <tbody>{order.bills.map((b,i)=>(
              <tr key={i}>
                <td style={{fontFamily:'monospace',fontSize:12}}>{b.bill_number}</td>
                <td>{b.invoice_date}</td>
                <td>{b.due_date||'—'}</td>
                <td><SBadge state={b.state}/></td>
                <td>{fmt(b.total_amount,order.currency)}</td>
                <td style={{color:'var(--amber)',fontWeight:600}}>{fmt(b.residual_amount,order.currency)}</td>
              </tr>
            ))}</tbody>
            </table>
          </div>
        </>}
      </div>

      {/* Cancel modal */}
      {showCancel&&(
        <Modal title={locale==='ar'?'إلغاء الطلب':'Cancel Order'} onClose={()=>setShowCancel(false)}>
          <div className='mdl-b'>
            <div className='fg'><label>{locale==='ar'?'سبب الإلغاء':'Cancel Reason'}</label><textarea className='fi' value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder='Optional reason...'/></div>
          </div>
          <div className='mdl-f'>
            <button className='btn btn-s' onClick={()=>setShowCancel(false)}>{locale==='ar'?'تراجع':'Back'}</button>
            <button className='btn btn-d' onClick={()=>{cancelOrder();setShowCancel(false);}}>{locale==='ar'?'تأكيد الإلغاء':'Confirm Cancel'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ORDERS LIST (RFQ + PO combined with filter tabs)
// ══════════════════════════════════════════════════════════
function OrdersSection({bootstrap}){
  const {locale}=useI18n();
  const cur=bootstrap?.currency||'JOD';
  const [stateF,setStateF]=useState('');
  const [search,setSearch]=useState('');
  const [view,setView]=useState('list'); // list | create | detail
  const [selId,setSelId]=useState(null);
  const [items,loading,,reload]=useLoad('/api/purchase/orders',[],[] );
  const [sub,setSub]=useState('all'); // all | rfq | po | done

  const stateGroups={
    all: null,
    rfq: ['draft','sent'],
    po:  ['confirmed','approved'],
    done:['done'],
    cancelled:['cancelled'],
  };

  const filtered=useMemo(()=>{
    let r=items;
    const grp=stateGroups[sub];
    if(grp) r=r.filter(o=>grp.includes(o.state));
    if(search) r=r.filter(o=>(o.po_number+o.vendor_name).toLowerCase().includes(search.toLowerCase()));
    return r;
  },[items,sub,search]);

  const cols=[
    {key:'po_number',label:'Number',ar:'الرقم',render:r=><span style={{fontFamily:'monospace',fontSize:12}}>{r.po_number}</span>},
    {key:'vendor_name',label:'Vendor',ar:'المورد'},
    {key:'order_date',label:'Date',ar:'التاريخ'},
    {key:'expected_date',label:'Expected',ar:'المتوقع'},
    {key:'state',label:'Status',ar:'الحالة',render:r=><SBadge state={r.state}/>},
    {key:'receipt_status',label:'Receipt',ar:'الاستلام',render:r=><SBadge state={r.receipt_status}/>},
    {key:'billing_status',label:'Billing',ar:'الفوترة',render:r=><SBadge state={r.billing_status}/>},
    {key:'total_amount',label:'Total',ar:'الإجمالي',render:r=>fmt(r.total_amount,cur)},
  ];

  if(view==='create') return <OrderForm bootstrap={bootstrap} onClose={()=>setView('list')} onSaved={()=>{setView('list');reload();}}/>;
  if(view==='detail'&&selId) return <OrderDetail orderId={selId} bootstrap={bootstrap} onClose={()=>{setView('list');setSelId(null);}} onRefresh={()=>reload()}/>;

  return(
    <div className='pb'>
      <div className='po-sub-tabs'>
        {[['all','All','الكل'],['rfq','RFQs','طلبات الأسعار'],['po','Purchase Orders','أوامر الشراء'],['done','Done','منجز'],['cancelled','Cancelled','ملغى']].map(([k,en,ar])=>(
          <button key={k} className={`po-sub-tab ${sub===k?'active':''}`} onClick={()=>setSub(k)}>{locale==='ar'?ar:en}</button>
        ))}
      </div>
      <div className='po-bar'>
        <div className='fb' style={{margin:0}}>
          <input className='fi' style={{minWidth:200}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={locale==='ar'?'بحث في الطلبات...':'Search orders...'}/>
        </div>
        <button className='btn btn-p' onClick={()=>setView('create')}><Ic name='plus' size={14}/> {locale==='ar'?'طلب عرض سعر':'New RFQ'}</button>
      </div>
      <Tbl rows={filtered} cols={cols} loading={loading}
        onRow={r=>{setSelId(r.id);setView('detail');}}
        emptyLabel={locale==='ar'?'لا توجد طلبات':'No orders'}
        emptyAction={locale==='ar'?'طلب عرض سعر جديد':'New RFQ'} onEmptyAction={()=>setView('create')}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// RECEIPTS LIST
// ══════════════════════════════════════════════════════════
function ReceiptsSection({bootstrap}){
  const {locale}=useI18n();
  const [items,loading]=useLoad('/api/purchase/receipts',[],[]);
  const cols=[
    {key:'receipt_number',label:'Receipt No.',ar:'رقم الاستلام',render:r=><span style={{fontFamily:'monospace',fontSize:12}}>{r.receipt_number}</span>},
    {key:'po_number',label:'PO',ar:'أمر الشراء'},
    {key:'vendor_name',label:'Vendor',ar:'المورد'},
    {key:'receipt_date',label:'Date',ar:'التاريخ'},
    {key:'state',label:'Status',ar:'الحالة',render:r=><SBadge state={r.state}/>},
    {key:'notes',label:'Notes',ar:'ملاحظات'},
  ];
  return(
    <div className='pb'>
      <div className='po-note'>{locale==='ar'?'سجلات استلام البضاعة — تُنشأ تلقائياً عند تسجيل الاستلام من أمر الشراء.':'Goods receipt records — created from the Purchase Order detail view when receiving goods.'}</div>
      <Tbl rows={items} cols={cols} loading={loading} emptyLabel={locale==='ar'?'لا توجد سجلات استلام':'No receipts yet'}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// BILLS SECTION
// ══════════════════════════════════════════════════════════
function BillsSection({bootstrap}){
  const {locale}=useI18n();
  const cur=bootstrap?.currency||'JOD';
  const [stateF,setStateF]=useState('');
  const [items,loading,,reload]=useLoad(`/api/purchase/bills${stateF?'?state='+stateF:''}`, [stateF], []);
  const [acting,setActing]=useState(null);

  const postBill=async(id)=>{
    try{ setActing(id); await api.post(`/api/purchase/bills/${id}/post`,{}); toast(locale==='ar'?'تم الترحيل':'Posted'); reload(); }
    catch(e){toast(e.message||'Error','e');}finally{setActing(null);}
  };

  const cols=[
    {key:'bill_number',label:'Bill No.',ar:'رقم الفاتورة',render:r=><span style={{fontFamily:'monospace',fontSize:12}}>{r.bill_number}</span>},
    {key:'vendor_name',label:'Vendor',ar:'المورد'},
    {key:'invoice_date',label:'Invoice Date',ar:'تاريخ الفاتورة'},
    {key:'due_date',label:'Due Date',ar:'الاستحقاق'},
    {key:'state',label:'Status',ar:'الحالة',render:r=><SBadge state={r.state}/>},
    {key:'total_amount',label:'Total',ar:'الإجمالي',render:r=>fmt(r.total_amount,cur)},
    {key:'residual_amount',label:'Balance Due',ar:'المتبقي',render:r=><span style={{color:Number(r.residual_amount)>0?'var(--amber)':'var(--green)',fontWeight:600}}>{fmt(r.residual_amount,cur)}</span>},
    {key:'actions',label:'',ar:'',render:r=>r.state==='draft'
      ?<button className='btn btn-p btn-sm' onClick={e=>{e.stopPropagation();postBill(r.id);}} disabled={acting===r.id}>{acting===r.id?'...':locale==='ar'?'ترحيل':'Post'}</button>
      :null
    },
  ];

  return(
    <div className='pb'>
      <div className='po-bar'>
        <div className='fb' style={{margin:0}}>
          <select className='fi' style={{minWidth:140}} value={stateF} onChange={e=>setStateF(e.target.value)}>
            <option value=''>{locale==='ar'?'كل الحالات':'All'}</option>
            <option value='draft'>{locale==='ar'?'مسودة':'Draft'}</option>
            <option value='posted'>{locale==='ar'?'مرحّل':'Posted'}</option>
            <option value='paid'>{locale==='ar'?'مدفوع':'Paid'}</option>
          </select>
        </div>
      </div>
      <Tbl rows={items} cols={cols} loading={loading} emptyLabel={locale==='ar'?'لا توجد فواتير':'No bills'}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// VENDORS SECTION
// ══════════════════════════════════════════════════════════
function VendorsSection({bootstrap}){
  const {locale}=useI18n();
  const [search,setSearch]=useState('');
  const [items,loading,,reload]=useLoad(`/api/purchase/vendors${search?'?search='+encodeURIComponent(search):''}`, [search], []);
  const [show,setShow]=useState(false);
  const [edit,setEdit]=useState(null);
  const [form,setForm]=useState({});
  const sf=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const [saving,setSaving]=useState(false);

  const openNew=()=>{setEdit(null);setForm({currency:bootstrap?.currency||'JOD',payment_terms:30,is_active:true});setShow(true);};
  const openEdit=r=>{setEdit(r);setForm({...r});setShow(true);};
  const save=async()=>{
    if(!form.name){toast(locale==='ar'?'الاسم مطلوب':'Name required','e');return;}
    try{
      setSaving(true);
      if(edit?.id) await api.put(`/api/purchase/vendors/${edit.id}`,form);
      else await api.post('/api/purchase/vendors',form);
      toast(locale==='ar'?'تم الحفظ':'Saved'); setShow(false); reload();
    }catch(e){toast(e.message||'Error','e');}finally{setSaving(false);}
  };

  const cols=[
    {key:'code',label:'Code',ar:'الرمز'},
    {key:'name',label:'Vendor',ar:'المورد'},
    {key:'email',label:'Email',ar:'البريد'},
    {key:'phone',label:'Phone',ar:'الهاتف'},
    {key:'city',label:'City',ar:'المدينة'},
    {key:'currency',label:'Currency',ar:'العملة'},
    {key:'payment_terms',label:'Terms',ar:'الشروط',render:r=>`${r.payment_terms} ${locale==='ar'?'يوم':'d'}`},
    {key:'is_active',label:'Status',ar:'الحالة',render:r=><span className={`badge ${r.is_active?'b-active':'b-inactive'}`}>{r.is_active?(locale==='ar'?'نشط':'Active'):(locale==='ar'?'غير نشط':'Inactive')}</span>},
  ];

  const fields=[
    ['name',locale==='ar'?'اسم المورد':'Vendor Name','text',true],
    ['name_ar',locale==='ar'?'الاسم بالعربي':'Arabic Name','text'],
    ['email',locale==='ar'?'البريد الإلكتروني':'Email','email'],
    ['phone',locale==='ar'?'الهاتف':'Phone','text'],
    ['mobile',locale==='ar'?'الجوال':'Mobile','text'],
    ['contact_name',locale==='ar'?'جهة الاتصال':'Contact Person','text'],
    ['address',locale==='ar'?'العنوان':'Address','text'],
    ['city',locale==='ar'?'المدينة':'City','text'],
    ['country',locale==='ar'?'الدولة':'Country','text'],
    ['tax_number',locale==='ar'?'الرقم الضريبي':'Tax Number','text'],
    ['currency',locale==='ar'?'العملة':'Currency','text'],
    ['payment_terms',locale==='ar'?'شروط الدفع (أيام)':'Payment Terms (days)','number'],
    ['bank_name',locale==='ar'?'البنك':'Bank Name','text'],
    ['bank_account',locale==='ar'?'رقم الحساب':'Account Number','text'],
    ['bank_iban',locale==='ar'?'IBAN':'IBAN','text'],
  ];

  return(
    <div className='pb'>
      <div className='po-bar'>
        <input className='fi' style={{minWidth:220}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={locale==='ar'?'بحث في الموردين...':'Search vendors...'}/>
        <button className='btn btn-p' onClick={openNew}><Ic name='plus' size={14}/> {locale==='ar'?'مورد جديد':'New Vendor'}</button>
      </div>
      <Tbl rows={items} cols={cols} loading={loading} onRow={openEdit}
        emptyLabel={locale==='ar'?'لا يوجد موردون':'No vendors'}
        emptyAction={locale==='ar'?'مورد جديد':'New Vendor'} onEmptyAction={openNew}/>
      {show&&(
        <Modal title={locale==='ar'?(edit?'تعديل المورد':'مورد جديد'):(edit?'Edit Vendor':'New Vendor')} onClose={()=>setShow(false)} wide>
          <div className='mdl-b'>
            <div className='fr3'>
              {fields.map(([key,label,type,req])=>(
                <div className='fg' key={key}>
                  <label>{label}{req&&<span style={{color:'var(--red)'}}> *</span>}</label>
                  <input className='fi' type={type||'text'} value={form[key]||''} onChange={sf(key)}/>
                </div>
              ))}
              <div className='fg'><label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginTop:22}}>
                <input type='checkbox' checked={!!form.is_active} onChange={e=>setForm(p=>({...p,is_active:e.target.checked}))} style={{width:15,height:15}}/>
                {locale==='ar'?'نشط':'Active'}
              </label></div>
            </div>
          </div>
          <div className='mdl-f'>
            <button className='btn btn-s' onClick={()=>setShow(false)}>{locale==='ar'?'إلغاء':'Cancel'}</button>
            <button className='btn btn-p' onClick={save} disabled={saving}>{saving?'...':locale==='ar'?'حفظ':'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PRODUCTS SECTION
// ══════════════════════════════════════════════════════════
function ProductsSection(){
  const {locale}=useI18n();
  const [search,setSearch]=useState('');
  const [catF,setCatF]=useState('');
  const [items,loading,,reload]=useLoad(`/api/purchase/products${search||catF?'?search='+encodeURIComponent(search)+(catF?'&category='+catF:''):''}`, [search,catF], []);
  const [show,setShow]=useState(false);
  const [edit,setEdit]=useState(null);
  const [form,setForm]=useState({});
  const sf=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const [saving,setSaving]=useState(false);
  const cats=['general','equipment','supplies','cleaning','food','uniforms','electronics','furniture','other'];

  const openNew=()=>{setEdit(null);setForm({category:'general',uom:'unit',tax_rate:0,is_active:true});setShow(true);};
  const openEdit=r=>{setEdit(r);setForm({...r});setShow(true);};
  const save=async()=>{
    if(!form.name){toast(locale==='ar'?'الاسم مطلوب':'Name required','e');return;}
    try{
      setSaving(true);
      if(edit?.id) await api.put(`/api/purchase/products/${edit.id}`,form);
      else await api.post('/api/purchase/products',form);
      toast(locale==='ar'?'تم الحفظ':'Saved'); setShow(false); reload();
    }catch(e){toast(e.message||'Error','e');}finally{setSaving(false);}
  };

  const cols=[
    {key:'code',label:'Code',ar:'الرمز'},
    {key:'name',label:'Product',ar:'المنتج'},
    {key:'category',label:'Category',ar:'الفئة'},
    {key:'uom',label:'UoM',ar:'الوحدة'},
    {key:'standard_price',label:'Std Price',ar:'السعر المعياري',render:r=>fmt(r.standard_price)},
    {key:'last_purchase_price',label:'Last Price',ar:'آخر سعر شراء',render:r=>fmt(r.last_purchase_price)},
    {key:'on_hand_qty',label:'On Hand',ar:'المخزون'},
    {key:'reorder_qty',label:'Reorder',ar:'نقطة إعادة الطلب'},
    {key:'tax_rate',label:'Tax',ar:'الضريبة',render:r=>`${r.tax_rate||0}%`},
    {key:'is_active',label:'Status',ar:'الحالة',render:r=><span className={`badge ${r.is_active?'b-active':'b-inactive'}`}>{r.is_active?(locale==='ar'?'نشط':'Active'):(locale==='ar'?'غير نشط':'Inactive')}</span>},
  ];

  return(
    <div className='pb'>
      <div className='po-bar'>
        <div className='fb' style={{margin:0}}>
          <input className='fi' style={{minWidth:200}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={locale==='ar'?'بحث...':'Search...'}/>
          <select className='fi' style={{minWidth:130}} value={catF} onChange={e=>setCatF(e.target.value)}>
            <option value=''>{locale==='ar'?'كل الفئات':'All Categories'}</option>
            {cats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className='btn btn-p' onClick={openNew}><Ic name='plus' size={14}/> {locale==='ar'?'منتج جديد':'New Product'}</button>
      </div>
      <Tbl rows={items} cols={cols} loading={loading} onRow={openEdit}
        emptyLabel={locale==='ar'?'لا توجد منتجات':'No products'}
        emptyAction={locale==='ar'?'منتج جديد':'New Product'} onEmptyAction={openNew}/>
      {show&&(
        <Modal title={locale==='ar'?(edit?'تعديل المنتج':'منتج جديد'):(edit?'Edit Product':'New Product')} onClose={()=>setShow(false)} wide>
          <div className='mdl-b'><div className='fr3'>
            <div className='fg'><label>{locale==='ar'?'اسم المنتج':'Product Name'} <span style={{color:'var(--red)'}}>*</span></label><input className='fi' value={form.name||''} onChange={sf('name')}/></div>
            <div className='fg'><label>{locale==='ar'?'الاسم بالعربي':'Arabic Name'}</label><input className='fi' value={form.name_ar||''} onChange={sf('name_ar')}/></div>
            <div className='fg'><label>{locale==='ar'?'الرمز':'Code'}</label><input className='fi' value={form.code||''} onChange={sf('code')}/></div>
            <div className='fg'><label>{locale==='ar'?'الفئة':'Category'}</label><select className='fi' value={form.category||'general'} onChange={sf('category')}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className='fg'><label>{locale==='ar'?'وحدة القياس':'Unit of Measure'}</label><select className='fi' value={form.uom||'unit'} onChange={sf('uom')}>{['unit','kg','g','litre','ml','box','carton','pack','pair','piece','set'].map(u=><option key={u} value={u}>{u}</option>)}</select></div>
            <div className='fg'><label>{locale==='ar'?'السعر المعياري':'Standard Price'}</label><input className='fi' type='number' min='0' step='.001' value={form.standard_price||0} onChange={sf('standard_price')}/></div>
            <div className='fg'><label>{locale==='ar'?'الحد الأدنى للطلب':'Min Order Qty'}</label><input className='fi' type='number' min='0' value={form.min_qty||0} onChange={sf('min_qty')}/></div>
            <div className='fg'><label>{locale==='ar'?'نقطة إعادة الطلب':'Reorder Qty'}</label><input className='fi' type='number' min='0' value={form.reorder_qty||0} onChange={sf('reorder_qty')}/></div>
            <div className='fg'><label>{locale==='ar'?'المخزون الحالي':'On Hand Qty'}</label><input className='fi' type='number' min='0' step='.001' value={form.on_hand_qty||0} onChange={sf('on_hand_qty')}/></div>
            <div className='fg'><label>{locale==='ar'?'نسبة الضريبة %':'Tax Rate %'}</label><input className='fi' type='number' min='0' step='.1' value={form.tax_rate||0} onChange={sf('tax_rate')}/></div>
            <div className='fg' style={{gridColumn:'1 / -1'}}><label>{locale==='ar'?'الوصف':'Description'}</label><textarea className='fi' value={form.description||''} onChange={sf('description')}/></div>
          </div></div>
          <div className='mdl-f'>
            <button className='btn btn-s' onClick={()=>setShow(false)}>{locale==='ar'?'إلغاء':'Cancel'}</button>
            <button className='btn btn-p' onClick={save} disabled={saving}>{saving?'...':locale==='ar'?'حفظ':'Save'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// REPORTS SECTION
// ══════════════════════════════════════════════════════════
function ReportsSection({bootstrap}){
  const {locale}=useI18n();
  const cur=bootstrap?.currency||'JOD';
  const [active,setActive]=useState('analysis');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [analysis,aL]=useLoad(`/api/purchase/reports/purchase-analysis${dateFrom||dateTo?'?date_from='+dateFrom+'&date_to='+dateTo:''}`,[dateFrom,dateTo],{orders:[],byVendor:[],byMonth:[],byCategory:[]});
  const [vendPerf,vL]=useLoad('/api/purchase/reports/vendor-performance',[],[]);
  const [stock,sL]=useLoad('/api/purchase/reports/stock-status',[],[]);

  const reps=[['analysis','Purchase Analysis','تحليل المشتريات'],['vendor','Vendor Performance','أداء الموردين'],['stock','Stock Status','حالة المخزون']];

  return(
    <div className='pb'>
      <div className='tabs' style={{flexWrap:'wrap'}}>
        {reps.map(([k,en,ar])=>(
          <div key={k} className={`tab ${active===k?'ac':''}`} onClick={()=>setActive(k)}>{locale==='ar'?ar:en}</div>
        ))}
      </div>

      {active==='analysis'&&<>
        <div className='fb' style={{marginBottom:14}}>
          <input className='fi' type='date' value={dateFrom} onChange={e=>setDateFrom(e.target.value)} placeholder='From'/>
          <input className='fi' type='date' value={dateTo} onChange={e=>setDateTo(e.target.value)} placeholder='To'/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div className='card'>
            <div className='ct'>{locale==='ar'?'حسب المورد':'By Vendor'}</div>
            <Tbl rows={analysis.byVendor||[]} cols={[
              {key:'vendor_name',label:'Vendor',ar:'المورد'},
              {key:'orders',label:'Orders',ar:'الطلبات'},
              {key:'total',label:'Total',ar:'الإجمالي',render:r=>fmt(r.total,cur)},
            ]} loading={aL} emptyLabel={locale==='ar'?'لا بيانات':'No data'}/>
          </div>
          <div className='card'>
            <div className='ct'>{locale==='ar'?'حسب الشهر':'By Month'}</div>
            <Tbl rows={analysis.byMonth||[]} cols={[
              {key:'month',label:'Month',ar:'الشهر'},
              {key:'orders',label:'Orders',ar:'الطلبات'},
              {key:'total',label:'Total',ar:'الإجمالي',render:r=>fmt(r.total,cur)},
            ]} loading={aL} emptyLabel={locale==='ar'?'لا بيانات':'No data'}/>
          </div>
        </div>
        <div className='card' style={{marginTop:14}}>
          <div className='ct'>{locale==='ar'?'حسب الفئة':'By Category'}</div>
          <Tbl rows={analysis.byCategory||[]} cols={[
            {key:'category',label:'Category',ar:'الفئة'},
            {key:'lines',label:'Lines',ar:'البنود'},
            {key:'total',label:'Total',ar:'الإجمالي',render:r=>fmt(r.total,cur)},
          ]} loading={aL} emptyLabel={locale==='ar'?'لا بيانات':'No data'}/>
        </div>
      </>}

      {active==='vendor'&&(
        <Tbl rows={vendPerf} cols={[
          {key:'name',label:'Vendor',ar:'المورد'},
          {key:'total_orders',label:'Orders',ar:'الطلبات'},
          {key:'total_spend',label:'Total Spend',ar:'إجمالي الإنفاق',render:r=>fmt(r.total_spend,cur)},
          {key:'avg_order',label:'Avg Order',ar:'متوسط الطلب',render:r=>fmt(r.avg_order,cur)},
          {key:'payment_terms',label:'Terms',ar:'الشروط',render:r=>`${r.payment_terms}d`},
          {key:'currency',label:'Currency',ar:'العملة'},
        ]} loading={vL} emptyLabel={locale==='ar'?'لا بيانات':'No data'}/>
      )}

      {active==='stock'&&(
        <Tbl rows={stock} cols={[
          {key:'code',label:'Code',ar:'الرمز'},
          {key:'name',label:'Product',ar:'المنتج'},
          {key:'category',label:'Category',ar:'الفئة'},
          {key:'on_hand_qty',label:'On Hand',ar:'المخزون'},
          {key:'reorder_qty',label:'Reorder Pt.',ar:'نقطة الطلب'},
          {key:'min_qty',label:'Min Qty',ar:'الحد الأدنى'},
          {key:'last_purchase_price',label:'Last Price',ar:'آخر سعر',render:r=>fmt(r.last_purchase_price)},
          {key:'is_active',label:'Status',ar:'الحالة',render:r=><span className={`badge ${Number(r.on_hand_qty||0)<=Number(r.reorder_qty||0)?'b-warning':'b-active'}`}>{Number(r.on_hand_qty||0)<=Number(r.reorder_qty||0)?(locale==='ar'?'أعد الطلب':'Reorder'):(locale==='ar'?'كافٍ':'OK')}</span>},
        ]} loading={sL} emptyLabel={locale==='ar'?'لا منتجات':'No products'}/>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SETTINGS SECTION
// ══════════════════════════════════════════════════════════
function SettingsSection(){
  const {locale}=useI18n();
  const [settings,sL,setSettings]=useLoad('/api/purchase/settings',[],{});
  const [saving,setSaving]=useState(false);
  const sf=k=>e=>setSettings(p=>({...p,[k]:e.target.value}));
  const save=async()=>{
    try{setSaving(true);await api.put('/api/purchase/settings',settings);toast(locale==='ar'?'تم الحفظ':'Saved');}
    catch(e){toast(e.message||'Error','e');}finally{setSaving(false);}
  };
  return(
    <div className='pb'>
      <div className='card'>
        <div className='ct'>{locale==='ar'?'إعدادات المشتريات':'Purchase Settings'}
          <button className='btn btn-p btn-sm' onClick={save} disabled={saving}>{saving?'...':locale==='ar'?'حفظ':'Save'}</button>
        </div>
        {sL?<div className='pld'><span className='spinner'/></div>:<div className='fr3'>
          <div className='fg'><label>{locale==='ar'?'بادئة طلب عرض السعر':'RFQ Prefix'}</label><input className='fi' value={settings.rfq_prefix||''} onChange={sf('rfq_prefix')}/></div>
          <div className='fg'><label>{locale==='ar'?'بادئة أمر الشراء':'PO Prefix'}</label><input className='fi' value={settings.po_prefix||''} onChange={sf('po_prefix')}/></div>
          <div className='fg'><label>{locale==='ar'?'العملة الافتراضية':'Default Currency'}</label><input className='fi' value={settings.default_currency||''} onChange={sf('default_currency')}/></div>
          <div className='fg'><label>{locale==='ar'?'وقت الاستجابة (أيام)':'Default Lead Days'}</label><input className='fi' type='number' value={settings.default_lead_days||7} onChange={sf('default_lead_days')}/></div>
          <div className='fg'><label>{locale==='ar'?'حد مبلغ الموافقة':'Approval Threshold'}</label><input className='fi' type='number' value={settings.approval_min_amount||5000} onChange={sf('approval_min_amount')}/></div>
          <div className='fg'><label style={{display:'flex',gap:8,alignItems:'center',marginTop:22,cursor:'pointer'}}>
            <input type='checkbox' checked={!!settings.require_approval} onChange={e=>setSettings(p=>({...p,require_approval:e.target.checked}))} style={{width:15,height:15}}/>
            {locale==='ar'?'طلب موافقة على أوامر الشراء':'Require PO Approval'}
          </label></div>
          <div className='fg'><label style={{display:'flex',gap:8,alignItems:'center',marginTop:22,cursor:'pointer'}}>
            <input type='checkbox' checked={!!settings.auto_create_bill} onChange={e=>setSettings(p=>({...p,auto_create_bill:e.target.checked}))} style={{width:15,height:15}}/>
            {locale==='ar'?'إنشاء فاتورة تلقائياً عند الاستلام':'Auto-create Bill on Receipt'}
          </label></div>
          <div className='fg'><label style={{display:'flex',gap:8,alignItems:'center',marginTop:22,cursor:'pointer'}}>
            <input type='checkbox' checked={!!settings.lock_confirmed_po} onChange={e=>setSettings(p=>({...p,lock_confirmed_po:e.target.checked}))} style={{width:15,height:15}}/>
            {locale==='ar'?'قفل أوامر الشراء المؤكدة':'Lock Confirmed POs'}
          </label></div>
        </div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN PURCHASE WORKSPACE
// ══════════════════════════════════════════════════════════
function PurchaseWorkspace(){
  const {locale}=useI18n();
  const [tab,setTab]=useState('dashboard');
  const [bootstrap,bL]=useBootstrap();

  const tabs=[
    ['dashboard','Dashboard',    'لوحة التحكم', <Ic name='grid' size={14}/>],
    ['orders',   'Orders',       'الطلبات',     <Ic name='clipboard' size={14}/>],
    ['receipts', 'Receipts',     'الاستلام',    <Ic name='package' size={14}/>],
    ['bills',    'Vendor Bills', 'الفواتير',    <Ic name='file-text' size={14}/>],
    ['vendors',  'Vendors',      'الموردون',    <Ic name='factory' size={14}/>],
    ['products', 'Products',     'المنتجات',    <Ic name='package' size={14}/>],
    ['reports',  'Reports',      'التقارير',    <Ic name='bar-chart' size={14}/>],
    ['settings', 'Settings',     'الإعدادات',  <Ic name='settings' size={14}/>],
  ];

  return(
    <div>
      {/* Top Navigation */}
      <div className='po-top-nav'>
        <div className='po-top-nav-brand'>
          <Ic name='shopping-cart' size={18}/> {locale==='ar'?'المشتريات':'Purchase'}
        </div>
        <div className='po-top-nav-tabs'>
          {tabs.map(([k,en,ar,icon])=>(
            <button key={k} className={`po-nav-tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>
              <span style={{fontSize:13}}>{icon}</span>
              <span>{locale==='ar'?ar:en}</span>
            </button>
          ))}
        </div>
        {bootstrap?.currency&&<div style={{display:'flex',alignItems:'center',padding:'0 14px',borderInlineStart:'1px solid var(--border)',flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:10,background:'var(--bg-3)',color:'var(--t2)'}}>{bootstrap.currency}</span>
        </div>}
      </div>

      {/* Page title */}
      <div className='ph'>
        <h1>{locale==='ar'?tabs.find(t=>t[0]===tab)?.[2]:tabs.find(t=>t[0]===tab)?.[1]}</h1>
        <p style={{color:'var(--t3)',fontSize:13}}>{locale==='ar'?'إدارة المشتريات على نمط أودو':'Odoo-style purchase management'}</p>
      </div>

      {/* Sections */}
      {bL&&tab!=='dashboard'?<div className='pb'><div className='pld'><span className='spinner'/></div></div>:<>
        {tab==='dashboard' &&<DashboardSection cur={bootstrap?.currency||'JOD'}/>}
        {tab==='orders'    &&<OrdersSection bootstrap={bootstrap}/>}
        {tab==='receipts'  &&<ReceiptsSection bootstrap={bootstrap}/>}
        {tab==='bills'     &&<BillsSection bootstrap={bootstrap}/>}
        {tab==='vendors'   &&<VendorsSection bootstrap={bootstrap}/>}
        {tab==='products'  &&<ProductsSection/>}
        {tab==='reports'   &&<ReportsSection bootstrap={bootstrap}/>}
        {tab==='settings'  &&<SettingsSection/>}
      </>}
    </div>
  );
}

GymOS.registerPage({
  path:'/purchase',
  component:PurchaseWorkspace,
  module:'purchase',
  label:'Purchase',
  labelAr:'المشتريات',
  order:65
});


// ═══════════════════════════════════════════════════════════
// GymOS Accounting V2 — Odoo-style workspace
// Uses GymOS native design system: card, sc, sg, btn, fi, fg,
// tabs/tab, mo/mdl, badge, spinner/pld, ph, pb, empty
// ═══════════════════════════════════════════════════════════
(function () {
  const { useState, useEffect, useCallback } = React;
  const { api, useI18n, Modal, Ic, toast, formatMoney } = shared;

  // ── helpers ──────────────────────────────────────────────
  function fmt(v, c) { return formatMoney ? formatMoney(v, c || 'JOD') : new Intl.NumberFormat(undefined,{style:'currency',currency:c||'JOD'}).format(Number(v||0)); }
  function today() { return new Date().toISOString().slice(0,10); }
  function lx(row, locale, en='name', ar='name_ar') { return locale==='ar' && row?.[ar] ? row[ar] : (row?.[en] || '—'); }

  function useLoad(url, deps=[], fallback=[]) {
    const [data, setData] = useState(fallback);
    const [loading, setLoading] = useState(true);
    const reload = useCallback(() => {
      let live = true;
      setLoading(true);
      api.get(url)
        .then(r => { if (live) setData(r.data ?? fallback); })
        .catch(() => { if (live) setData(Array.isArray(fallback) ? [] : fallback); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }, [url]);
    useEffect(() => reload(), [...deps, url]);
    return [data, loading, setData, reload];
  }

  function useBootstrap() {
    return useLoad('/api/accounting/bootstrap', [], {
      settings:{}, countries:[], journals:[], accounts:[],
      taxes:[], paymentMethods:[], localization_installed:false
    });
  }

  // ── Status badge (uses GymOS badge classes) ──────────────
  function SBadge({ state }) {
    const { locale } = useI18n();
    const map = {
      draft:   { en:'Draft',     ar:'مسودة',  cls:'b-pending'  },
      posted:  { en:'Posted',    ar:'مرحّل',  cls:'b-active'   },
      paid:    { en:'Paid',      ar:'مدفوع',  cls:'b-paid'     },
      partial: { en:'Partial',   ar:'جزئي',   cls:'b-partial'  },
      cancelled:{ en:'Cancelled',ar:'ملغى',   cls:'b-cancelled'},
    };
    const s = map[state] || { en: state, ar: state, cls:'b-inactive' };
    return <span className={`badge ${s.cls}`}>{locale==='ar' ? s.ar : s.en}</span>;
  }

  // ── Table ────────────────────────────────────────────────
  function Tbl({ rows=[], cols=[], loading, onRow, emptyLabel, emptyAction, onEmptyAction }) {
    const { locale } = useI18n();
    if (loading) return <div className='pld'><span className='spinner'/></div>;
    return (
      <div className='card' style={{padding:0,overflow:'hidden'}}>
        <table>
          <thead><tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length}>
                  <div className='empty'>
                    <h3>{emptyLabel || (locale==='ar'?'لا توجد بيانات':'No records')}</h3>
                    {emptyAction && <button className='btn btn-p btn-sm' style={{marginTop:8}} onClick={onEmptyAction}>{emptyAction}</button>}
                  </div>
                </td></tr>
              : rows.map((row,i) => (
                <tr key={row.id||i} onClick={() => onRow && onRow(row)} style={onRow?{cursor:'pointer'}:{}}>
                  {cols.map(c => <td key={c.key}>{c.render ? c.render(row,locale) : String(row[c.key]??'—')}</td>)}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    );
  }

  // ── Field wrapper using GymOS fg/fi pattern ──────────────
  function F({ label, children, span }) {
    return (
      <div className='fg' style={span ? {gridColumn:'1 / -1'} : {}}>
        <label>{label}</label>
        {children}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════
  function DashboardSection({ cur, bootstrap }) {
    const { locale } = useI18n();
    const [stats, loading] = useLoad('/api/accounting/dashboard', [], {});

    const cards = [
      ['النقد والبنك','Cash & Bank',         stats.cashBankBalance,    '#06b6d4'],
      ['الذمم المدينة','Receivables',         stats.openReceivables,    '#6366f1'],
      ['الذمم الدائنة','Payables',            stats.openPayables,       '#f59e0b'],
      ['الإيراد (الشهر)','Revenue (MTD)',     stats.monthlyRevenue,     '#10b981'],
      ['المصاريف (الشهر)','Expenses (MTD)',   stats.monthlyExpenses,    '#ef4444'],
      ['صافي الربح','Net Profit',             (stats.monthlyRevenue||0)-(stats.monthlyExpenses||0), '#a855f7'],
      ['قيود مسودة','Draft Moves',            stats.draftEntries,       '#f59e0b'],
      ['فواتير متأخرة','Overdue Invoices',    stats.overdueReceivables, '#ef4444'],
    ];

    const highlights = [
      { l:'فواتير عملاء غير مدفوعة', en:'Unpaid Customer Invoices', v: stats.unpaidCustomerInvoices||0 },
      { l:'فواتير موردين غير مدفوعة', en:'Unpaid Vendor Bills',     v: stats.unpaidVendorBills||0 },
      { l:'قيود مرحّلة',             en:'Posted Entries',           v: stats.postedEntries||0 },
      { l:'وضع الكافتيريا',          en:'Cafeteria Scope',          v: bootstrap?.settings?.include_cafeteria ? (locale==='ar'?'مفعّل':'Enabled') : (locale==='ar'?'معطّل':'Disabled') },
    ];

    if (loading) return <div className='pb'><div className='pld'><span className='spinner'/></div></div>;

    return (
      <div className='pb'>
        <div className='sg' style={{gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))'}}>
          {cards.map(([ar,en,val],i) => (
            <div className='sc' key={i} style={{'--card-color': cards[i][3]}}>
              <div className='sl'>{locale==='ar'?ar:en}</div>
              <div className='sv' style={{fontSize:20}}>{typeof val==='number' ? fmt(val,cur) : String(val||0)}</div>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14,marginTop:4}}>
          <div className='card'>
            <div className='ct'>{locale==='ar'?'سير العمل اليومي':'Daily Bookkeeping Flow'}</div>
            <ol style={{paddingInlineStart:18,lineHeight:2,fontSize:13,color:'var(--t2)'}}>
              {(locale==='ar'
                ?['مراجعة الإعدادات والتوطين','مراجعة دليل الحسابات واليوميات','إنشاء وترحيل الفواتير','تسجيل المدفوعات أو التحويلات','ترحيل القيود اليومية عند الحاجة','تشغيل التقارير وكشوف الحسابات']
                :['Review settings & localization','Review chart of accounts & journals','Create and post invoices / bills','Register payments or transfers','Post manual journal entries as needed','Run reports and ledgers']
              ).map((s,i)=><li key={i}>{s}</li>)}
            </ol>
          </div>
          <div className='card'>
            <div className='ct'>{locale==='ar'?'لمحة سريعة':'Quick Snapshot'}</div>
            <div className='dg'>
              {highlights.map(item=>(
                <div className='di' key={item.en}>
                  <div className='dl'>{locale==='ar'?item.l:item.en}</div>
                  <div className='dv'>{item.v}</div>
                </div>
              ))}
            </div>
            <div className='acc-loc-note'>
              {bootstrap?.localization_installed
                ?(locale==='ar'?'التوطين مثبّت. يمكن تعديله من الإعداد › التوطين.':'Localization installed. Update from Configuration › Localization.')
                :(locale==='ar'?'التوطين لم يُثبَّت بعد. أكمله من الإعداد › التوطين.':'Localization not installed. Complete from Configuration › Localization.')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // INVOICE / BILL FORM
  // ══════════════════════════════════════════════════════════
  function InvoiceForm({ type, docKind, bootstrap, onClose, onSaved }) {
    const { locale } = useI18n();
    const cur = bootstrap?.settings?.display_currency || bootstrap?.settings?.default_currency || 'JOD';
    const journals = (bootstrap?.journals||[]).filter(j=>type==='customer'?['sale','general'].includes(j.journal_type):['purchase','general'].includes(j.journal_type));
    const taxes = bootstrap?.taxes||[];
    const bizLines = ['memberships','packages','personal_training','sessions','freeze_fees','retail','other'];
    const isCredit = docKind==='credit_note';

    const [form, setForm] = useState({ partner_name:'', invoice_date:today(), due_date:'', notes:'', journal_id:journals[0]?.id||'', business_line:'memberships', document_kind:docKind||(type==='customer'?'invoice':'bill') });
    const [lines, setLines] = useState([{description:'',quantity:1,unit_price:0,tax_rate:0}]);
    const [saving, setSaving] = useState(false);
    const sf = k => e => setForm(p=>({...p,[k]:e.target.value}));
    const sl = (i,k,v) => setLines(p=>p.map((l,idx)=>idx===i?{...l,[k]:v}:l));

    const subtotal = lines.reduce((s,l)=>s+Number(l.quantity||1)*Number(l.unit_price||0),0);
    const taxTotal = lines.reduce((s,l)=>s+(Number(l.quantity||1)*Number(l.unit_price||0))*(Number(l.tax_rate||0)/100),0);
    const total = subtotal+taxTotal;

    const save = async (post) => {
      if (!form.partner_name||!form.invoice_date) { toast(locale==='ar'?'اسم الشريك والتاريخ مطلوبان':'Partner and date required','e'); return; }
      try {
        setSaving(true);
        await api.post('/api/accounting/invoices',{...form,invoice_type:type,lines,state:post?'posted':'draft'});
        toast(post?(locale==='ar'?'تم الترحيل':'Posted'):(locale==='ar'?'تم الحفظ':'Saved'));
        onSaved();
      } catch(e){ toast(e.message||'Failed','e'); } finally { setSaving(false); }
    };

    const titleMap = {
      customer_invoice: locale==='ar'?'فاتورة عميل جديدة':'New Customer Invoice',
      customer_credit_note: locale==='ar'?'إشعار دائن للعميل':'Customer Credit Note',
      vendor_bill: locale==='ar'?'فاتورة مورد جديدة':'New Vendor Bill',
      vendor_credit_note: locale==='ar'?'إشعار دائن للمورد':'Vendor Credit Note',
    };
    const titleKey = `${type}_${isCredit?'credit_note':(type==='customer'?'invoice':'bill')}`;

    return (
      <div>
        <div className='acc-form-hdr'>
          <h2>{titleMap[titleKey]}</h2>
          <div className='acc-form-acts'>
            <button className='btn btn-s' onClick={onClose} disabled={saving}>{locale==='ar'?'إلغاء':'Discard'}</button>
            <button className='btn btn-s' onClick={()=>save(false)} disabled={saving}>{saving?'...':locale==='ar'?'حفظ مسودة':'Save Draft'}</button>
            <button className='btn btn-p' onClick={()=>save(true)} disabled={saving}>{saving?'...':locale==='ar'?'ترحيل':'Post'}</button>
          </div>
        </div>
        <div className='acc-form-body'>
          <div className='fr'>
            <F label={type==='customer'?(locale==='ar'?'اسم العميل':'Customer Name'):(locale==='ar'?'اسم المورد':'Vendor Name')}>
              <input className='fi' value={form.partner_name} onChange={sf('partner_name')} placeholder={type==='customer'?'e.g. Ahmed Al-Hassan':'e.g. Al-Rasheed Supplies'} />
            </F>
            <F label={locale==='ar'?'التاريخ':'Invoice Date'}>
              <input className='fi' type='date' value={form.invoice_date} onChange={sf('invoice_date')} />
            </F>
            <F label={locale==='ar'?'تاريخ الاستحقاق':'Due Date'}>
              <input className='fi' type='date' value={form.due_date} onChange={sf('due_date')} />
            </F>
            {journals.length>0 && <F label={locale==='ar'?'اليومية':'Journal'}>
              <select className='fi' value={form.journal_id} onChange={sf('journal_id')}>
                {journals.map(j=><option key={j.id} value={j.id}>{lx(j,locale)}</option>)}
              </select>
            </F>}
            {type==='customer' && <F label={locale==='ar'?'خط العمل':'Business Line'}>
              <select className='fi' value={form.business_line} onChange={sf('business_line')}>
                {bizLines.map(b=><option key={b} value={b}>{b.replace(/_/g,' ')}</option>)}
              </select>
            </F>}
            <F label={locale==='ar'?'ملاحظات':'Notes'}>
              <input className='fi' value={form.notes} onChange={sf('notes')} placeholder='Reference or memo...' />
            </F>
          </div>

          <div style={{fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--t4)',margin:'16px 0 8px'}}>
            {locale==='ar'?'بنود الفاتورة':'Invoice Lines'}
          </div>
          <table>
            <thead><tr>
              <th>{locale==='ar'?'الوصف':'Description'}</th>
              <th style={{width:70}}>{locale==='ar'?'الكمية':'Qty'}</th>
              <th style={{width:110}}>{locale==='ar'?'سعر الوحدة':'Unit Price'}</th>
              <th style={{width:90}}>{locale==='ar'?'ضريبة %':'Tax %'}</th>
              <th style={{width:110}}>{locale==='ar'?'المجموع':'Total'}</th>
              <th style={{width:36}}></th>
            </tr></thead>
            <tbody>
              {lines.map((l,i)=>{
                const sub=Number(l.quantity||1)*Number(l.unit_price||0);
                const tx=sub*(Number(l.tax_rate||0)/100);
                return <tr key={i}>
                  <td><input className='fi' style={{padding:'5px 8px',fontSize:12}} value={l.description} onChange={e=>sl(i,'description',e.target.value)} placeholder='Service or item...' /></td>
                  <td><input className='fi' style={{padding:'5px 8px',fontSize:12}} type='number' min='0' value={l.quantity} onChange={e=>sl(i,'quantity',e.target.value)} /></td>
                  <td><input className='fi' style={{padding:'5px 8px',fontSize:12}} type='number' min='0' step='.001' value={l.unit_price} onChange={e=>sl(i,'unit_price',e.target.value)} /></td>
                  <td><select className='fi' style={{padding:'5px 8px',fontSize:12}} value={l.tax_rate} onChange={e=>sl(i,'tax_rate',e.target.value)}>
                    <option value='0'>0%</option>
                    {taxes.map(t=><option key={t.id} value={t.rate}>{t.rate}%</option>)}
                  </select></td>
                  <td style={{fontVariantNumeric:'tabular-nums'}}>{fmt(sub+tx,cur)}</td>
                  <td><button className='acc-del-btn' onClick={()=>setLines(p=>p.filter((_,idx)=>idx!==i))}>×</button></td>
                </tr>;
              })}
            </tbody>
          </table>
          <button className='btn btn-s btn-sm' style={{marginTop:8}} onClick={()=>setLines(p=>[...p,{description:'',quantity:1,unit_price:0,tax_rate:0}])}>
            + {locale==='ar'?'إضافة بند':'Add Line'}
          </button>
          <div className='acc-totals'>
            <div className='acc-total-row'><span>{locale==='ar'?'المجموع الفرعي':'Subtotal'}</span><strong>{fmt(subtotal,cur)}</strong></div>
            <div className='acc-total-row'><span>{locale==='ar'?'الضريبة':'Tax'}</span><strong>{fmt(taxTotal,cur)}</strong></div>
            <div className='acc-total-row acc-total-final'><span>{locale==='ar'?'الإجمالي':'Total'}</span><strong>{fmt(total,cur)}</strong></div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // INVOICE DETAIL
  // ══════════════════════════════════════════════════════════
  function InvoiceDetail({ inv, cur, bootstrap, onClose, onRefresh }) {
    const { locale } = useI18n();
    const [posting, setPosting] = useState(false);
    const [showPay, setShowPay] = useState(false);
    const [pf, setPf] = useState({ amount: inv.residual_amount||inv.total_amount||0, payment_date:today(), method:'cash', journal_id:'' });
    const [paying, setPaying] = useState(false);
    const journals = (bootstrap?.journals||[]).filter(j=>['cash','bank'].includes(j.journal_type));

    const post = async () => {
      if (!window.confirm(locale==='ar'?'ترحيل هذه الفاتورة؟ ستصبح للقراءة فقط.':'Post this invoice? It becomes read-only.')) return;
      try { setPosting(true); await api.post(`/api/accounting/invoices/${inv.id}/post`); toast(locale==='ar'?'تم الترحيل':'Posted'); onRefresh(); }
      catch(e){ toast(e.message||'Failed','e'); } finally { setPosting(false); }
    };

    const pay = async () => {
      try {
        setPaying(true);
        const dir = inv.invoice_type==='customer'?'inbound':'outbound';
        await api.post('/api/accounting/payments',{
          payment_direction:dir, payment_category:inv.invoice_type,
          partner_name:inv.partner_name, journal_id:pf.journal_id||journals[0]?.id,
          payment_date:pf.payment_date, amount:pf.amount, method:pf.method, invoice_id:inv.id,
          memo:`Payment for ${inv.invoice_no}`
        });
        toast(locale==='ar'?'تم تسجيل الدفعة':'Payment registered');
        setShowPay(false); onRefresh();
      } catch(e){ toast(e.message||'Failed','e'); } finally { setPaying(false); }
    };

    return (
      <div>
        <div className='acc-form-hdr'>
          <div className='acc-doc-meta'>
            <span className='acc-doc-no'>{inv.invoice_no}</span>
            <SBadge state={inv.state}/>
            <span style={{fontSize:13,color:'var(--t3)'}}>{inv.partner_name}</span>
          </div>
          <div className='acc-form-acts'>
            <button className='btn btn-s' onClick={onClose}>{locale==='ar'?'رجوع':'Back'}</button>
            {inv.state==='draft' && <button className='btn btn-p' onClick={post} disabled={posting}>{posting?'...':locale==='ar'?'ترحيل':'Post'}</button>}
            {['posted','partial'].includes(inv.state) && Number(inv.residual_amount)>0.001 &&
              <button className='btn btn-g' onClick={()=>setShowPay(true)}>{locale==='ar'?'تسجيل دفعة':'Register Payment'}</button>}
          </div>
        </div>
        <div className='acc-form-body'>
          <div className='dg'>
            <div className='di'><div className='dl'>{locale==='ar'?'الشريك':'Partner'}</div><div className='dv'>{inv.partner_name}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'التاريخ':'Date'}</div><div className='dv'>{inv.invoice_date}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'الاستحقاق':'Due'}</div><div className='dv'>{inv.due_date||'—'}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'خط العمل':'Business Line'}</div><div className='dv'>{(inv.business_line||'—').replace(/_/g,' ')}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'الإجمالي':'Total'}</div><div className='dv' style={{fontWeight:700,fontSize:16}}>{fmt(inv.total_amount,cur)}</div></div>
            <div className='di'><div className='dl'>{locale==='ar'?'المتبقي':'Residual'}</div><div className='dv' style={{fontWeight:700,fontSize:16,color:'var(--accent-h)'}}>{fmt(inv.residual_amount,cur)}</div></div>
          </div>
          {inv.notes && <div className='acc-loc-note' style={{marginTop:0}}>{inv.notes}</div>}
        </div>
        {showPay && (
          <Modal title={locale==='ar'?'تسجيل دفعة':'Register Payment'} onClose={()=>setShowPay(false)}>
            <div className='mdl-b'>
              <div className='fg'><label>{locale==='ar'?'المبلغ':'Amount'}</label><input className='fi' type='number' min='0' step='.001' value={pf.amount} onChange={e=>setPf(p=>({...p,amount:e.target.value}))}/></div>
              <div className='fg'><label>{locale==='ar'?'التاريخ':'Date'}</label><input className='fi' type='date' value={pf.payment_date} onChange={e=>setPf(p=>({...p,payment_date:e.target.value}))}/></div>
              <div className='fg'><label>{locale==='ar'?'الطريقة':'Method'}</label>
                <select className='fi' value={pf.method} onChange={e=>setPf(p=>({...p,method:e.target.value}))}>
                  <option value='cash'>{locale==='ar'?'نقدي':'Cash'}</option>
                  <option value='bank'>{locale==='ar'?'تحويل بنكي':'Bank Transfer'}</option>
                  <option value='card'>{locale==='ar'?'بطاقة':'Card'}</option>
                  <option value='cliq'>CliQ</option>
                </select>
              </div>
              {journals.length>0 && <div className='fg'><label>{locale==='ar'?'اليومية':'Journal'}</label>
                <select className='fi' value={pf.journal_id} onChange={e=>setPf(p=>({...p,journal_id:e.target.value}))}>
                  {journals.map(j=><option key={j.id} value={j.id}>{lx(j,locale)}</option>)}
                </select>
              </div>}
            </div>
            <div className='mdl-f'>
              <button className='btn btn-s' onClick={()=>setShowPay(false)}>{locale==='ar'?'إلغاء':'Cancel'}</button>
              <button className='btn btn-p' onClick={pay} disabled={paying}>{paying?'...':locale==='ar'?'تأكيد':'Confirm'}</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // CUSTOMERS SECTION
  // ══════════════════════════════════════════════════════════
  function CustomersSection({ cur, bootstrap }) {
    const { locale } = useI18n();
    const [sub, setSub] = useState('invoices');
    const [view, setView] = useState('list');
    const [sel, setSel] = useState(null);
    const [statusF, setStatusF] = useState('all');
    const ep = sub==='invoices'?'/api/accounting/customer-invoices':'/api/accounting/customer-credit-notes';
    const [items, loading,, reload] = useLoad(ep, [ep], []);
    const rows = statusF==='all'?items:items.filter(i=>i.state===statusF);
    const cols = [
      {key:'invoice_no',label:locale==='ar'?'رقم الوثيقة':'Document No.'},
      {key:'partner_name',label:locale==='ar'?'العميل':'Customer'},
      {key:'business_line',label:locale==='ar'?'خط العمل':'Business Line',render:r=>(r.business_line||'—').replace(/_/g,' ')},
      {key:'invoice_date',label:locale==='ar'?'التاريخ':'Date'},
      {key:'state',label:locale==='ar'?'الحالة':'Status',render:r=><SBadge state={r.state}/>},
      {key:'total_amount',label:locale==='ar'?'الإجمالي':'Total',render:r=>fmt(r.total_amount,cur)},
      {key:'residual_amount',label:locale==='ar'?'المتبقي':'Residual',render:r=>fmt(r.residual_amount,cur)},
    ];
    if (view==='create') return <InvoiceForm type='customer' docKind={sub==='invoices'?'invoice':'credit_note'} bootstrap={bootstrap} onClose={()=>setView('list')} onSaved={()=>{setView('list');reload();}}/>;
    if (view==='detail'&&sel) return <InvoiceDetail inv={sel} cur={cur} bootstrap={bootstrap} onClose={()=>{setView('list');setSel(null);}} onRefresh={()=>{reload();setSel(null);setView('list');}}/>;
    return (
      <div className='pb'>
        <div className='acc-sub-tabs'>
          <button className={`acc-sub-tab ${sub==='invoices'?'active':''}`} onClick={()=>setSub('invoices')}>{locale==='ar'?'الفواتير':'Invoices'}</button>
          <button className={`acc-sub-tab ${sub==='credit-notes'?'active':''}`} onClick={()=>setSub('credit-notes')}>{locale==='ar'?'إشعارات دائنة':'Credit Notes'}</button>
        </div>
        <div className='acc-bar'>
          <div className='fb' style={{margin:0}}>
            <select className='fi' style={{minWidth:140}} value={statusF} onChange={e=>setStatusF(e.target.value)}>
              <option value='all'>{locale==='ar'?'كل الحالات':'All Statuses'}</option>
              <option value='draft'>{locale==='ar'?'مسودة':'Draft'}</option>
              <option value='posted'>{locale==='ar'?'مرحّل':'Posted'}</option>
              <option value='partial'>{locale==='ar'?'جزئي':'Partial'}</option>
              <option value='paid'>{locale==='ar'?'مدفوع':'Paid'}</option>
            </select>
          </div>
          <button className='btn btn-p' onClick={()=>setView('create')}>
            + {locale==='ar'?(sub==='invoices'?'فاتورة جديدة':'إشعار دائن'):(sub==='invoices'?'New Invoice':'New Credit Note')}
          </button>
        </div>
        <Tbl rows={rows} cols={cols} loading={loading} onRow={r=>{setSel(r);setView('detail');}}
          emptyLabel={locale==='ar'?'لا توجد فواتير':'No invoices found'}
          emptyAction={locale==='ar'?'إنشاء فاتورة':'Create Invoice'} onEmptyAction={()=>setView('create')} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VENDORS SECTION
  // ══════════════════════════════════════════════════════════
  function VendorsSection({ cur, bootstrap }) {
    const { locale } = useI18n();
    const [sub, setSub] = useState('bills');
    const [view, setView] = useState('list');
    const [sel, setSel] = useState(null);
    const [statusF, setStatusF] = useState('all');
    const ep = sub==='bills'?'/api/accounting/vendor-bills':'/api/accounting/vendor-credit-notes';
    const [items, loading,, reload] = useLoad(ep, [ep], []);
    const rows = statusF==='all'?items:items.filter(i=>i.state===statusF);
    const cols = [
      {key:'invoice_no',label:locale==='ar'?'رقم الوثيقة':'Document No.'},
      {key:'partner_name',label:locale==='ar'?'المورد':'Vendor'},
      {key:'invoice_date',label:locale==='ar'?'التاريخ':'Date'},
      {key:'state',label:locale==='ar'?'الحالة':'Status',render:r=><SBadge state={r.state}/>},
      {key:'total_amount',label:locale==='ar'?'الإجمالي':'Total',render:r=>fmt(r.total_amount,cur)},
      {key:'residual_amount',label:locale==='ar'?'المتبقي':'Residual',render:r=>fmt(r.residual_amount,cur)},
    ];
    if (view==='create') return <InvoiceForm type='vendor' docKind={sub==='bills'?'bill':'credit_note'} bootstrap={bootstrap} onClose={()=>setView('list')} onSaved={()=>{setView('list');reload();}}/>;
    if (view==='detail'&&sel) return <InvoiceDetail inv={sel} cur={cur} bootstrap={bootstrap} onClose={()=>{setView('list');setSel(null);}} onRefresh={()=>{reload();setSel(null);setView('list');}}/>;
    return (
      <div className='pb'>
        <div className='acc-sub-tabs'>
          <button className={`acc-sub-tab ${sub==='bills'?'active':''}`} onClick={()=>setSub('bills')}>{locale==='ar'?'فواتير الموردين':'Vendor Bills'}</button>
          <button className={`acc-sub-tab ${sub==='credit-notes'?'active':''}`} onClick={()=>setSub('credit-notes')}>{locale==='ar'?'إشعارات دائنة':'Credit Notes'}</button>
        </div>
        <div className='acc-bar'>
          <div className='fb' style={{margin:0}}>
            <select className='fi' style={{minWidth:140}} value={statusF} onChange={e=>setStatusF(e.target.value)}>
              <option value='all'>{locale==='ar'?'كل الحالات':'All Statuses'}</option>
              <option value='draft'>{locale==='ar'?'مسودة':'Draft'}</option>
              <option value='posted'>{locale==='ar'?'مرحّل':'Posted'}</option>
              <option value='partial'>{locale==='ar'?'جزئي':'Partial'}</option>
              <option value='paid'>{locale==='ar'?'مدفوع':'Paid'}</option>
            </select>
          </div>
          <button className='btn btn-p' onClick={()=>setView('create')}>
            + {locale==='ar'?(sub==='bills'?'فاتورة جديدة':'إشعار دائن'):(sub==='bills'?'New Bill':'New Credit Note')}
          </button>
        </div>
        <Tbl rows={rows} cols={cols} loading={loading} onRow={r=>{setSel(r);setView('detail');}}
          emptyLabel={locale==='ar'?'لا توجد فواتير':'No bills found'}
          emptyAction={locale==='ar'?'إنشاء فاتورة':'Create Bill'} onEmptyAction={()=>setView('create')} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // JOURNAL ENTRY FORM
  // ══════════════════════════════════════════════════════════
  function JournalEntryForm({ bootstrap, onClose, onSaved }) {
    const { locale } = useI18n();
    const journals = bootstrap?.journals||[];
    const accounts = bootstrap?.accounts||[];
    const [form, setForm] = useState({ entry_date:today(), journal_id:journals[0]?.id||'', reference:'', memo:'' });
    const [lines, setLines] = useState([{account_id:'',label:'',debit:0,credit:0},{account_id:'',label:'',debit:0,credit:0}]);
    const [saving, setSaving] = useState(false);
    const sf = k=>e=>setForm(p=>({...p,[k]:e.target.value}));
    const sl = (i,k,v)=>setLines(p=>p.map((l,idx)=>idx===i?{...l,[k]:v}:l));
    const tD = lines.reduce((s,l)=>s+Number(l.debit||0),0);
    const tC = lines.reduce((s,l)=>s+Number(l.credit||0),0);
    const balanced = Math.abs(tD-tC)<0.001;
    const save = async (post) => {
      if(!form.journal_id||!form.entry_date){toast(locale==='ar'?'اليومية والتاريخ مطلوبان':'Journal and date required','e');return;}
      if(!balanced){toast(locale==='ar'?'القيد غير متوازن':'Entry not balanced','e');return;}
      if(lines.some(l=>!l.account_id)){toast(locale==='ar'?'كل السطور تحتاج حساباً':'All lines need an account','e');return;}
      try{setSaving(true);await api.post('/api/accounting/journal-entries',{...form,lines,state:post?'posted':'draft'});toast(post?(locale==='ar'?'تم الترحيل':'Posted'):(locale==='ar'?'تم الحفظ':'Saved'));onSaved();}
      catch(e){toast(e.message||'Failed','e');}finally{setSaving(false);}
    };
    return (
      <div>
        <div className='acc-form-hdr'>
          <h2>{locale==='ar'?'قيد يومية جديد':'New Journal Entry'}</h2>
          <div className='acc-form-acts'>
            <button className='btn btn-s' onClick={onClose} disabled={saving}>{locale==='ar'?'إلغاء':'Discard'}</button>
            <button className='btn btn-s' onClick={()=>save(false)} disabled={saving}>{saving?'...':locale==='ar'?'حفظ مسودة':'Save Draft'}</button>
            <button className='btn btn-p' onClick={()=>save(true)} disabled={saving||!balanced}>{saving?'...':locale==='ar'?'ترحيل':'Post'}</button>
          </div>
        </div>
        <div className='acc-form-body'>
          <div className='fr3'>
            <F label={locale==='ar'?'التاريخ':'Date'}><input className='fi' type='date' value={form.entry_date} onChange={sf('entry_date')}/></F>
            <F label={locale==='ar'?'اليومية':'Journal'}>
              <select className='fi' value={form.journal_id} onChange={sf('journal_id')}>
                {journals.map(j=><option key={j.id} value={j.id}>{lx(j,locale)}</option>)}
              </select>
            </F>
            <F label={locale==='ar'?'المرجع':'Reference'}><input className='fi' value={form.reference} onChange={sf('reference')} placeholder='e.g. Contract #123'/></F>
          </div>
          <div className='fg'><label>{locale==='ar'?'البيان':'Memo'}</label><input className='fi' value={form.memo} onChange={sf('memo')} placeholder='Description...'/></div>

          <div style={{fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--t4)',margin:'16px 0 8px'}}>
            {locale==='ar'?'بنود القيد':'Journal Lines'}
          </div>
          <table>
            <thead><tr>
              <th>{locale==='ar'?'الحساب':'Account'}</th>
              <th>{locale==='ar'?'البيان':'Label'}</th>
              <th style={{width:120}}>{locale==='ar'?'مدين':'Debit'}</th>
              <th style={{width:120}}>{locale==='ar'?'دائن':'Credit'}</th>
              <th style={{width:36}}></th>
            </tr></thead>
            <tbody>
              {lines.map((l,i)=>(
                <tr key={i}>
                  <td><select className='fi' style={{padding:'5px 8px',fontSize:12}} value={l.account_id} onChange={e=>sl(i,'account_id',e.target.value)}>
                    <option value=''>— {locale==='ar'?'اختر':'Select'} —</option>
                    {accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {lx(a,locale)}</option>)}
                  </select></td>
                  <td><input className='fi' style={{padding:'5px 8px',fontSize:12}} value={l.label} onChange={e=>sl(i,'label',e.target.value)} placeholder='...' /></td>
                  <td><input className='fi' style={{padding:'5px 8px',fontSize:12}} type='number' min='0' step='.001' value={l.debit} onChange={e=>sl(i,'debit',e.target.value)}/></td>
                  <td><input className='fi' style={{padding:'5px 8px',fontSize:12}} type='number' min='0' step='.001' value={l.credit} onChange={e=>sl(i,'credit',e.target.value)}/></td>
                  <td><button className='acc-del-btn' onClick={()=>setLines(p=>p.filter((_,idx)=>idx!==i))}>×</button></td>
                </tr>
              ))}
              <tr style={{background:'var(--bg-3)'}}>
                <td colSpan={2} style={{fontWeight:600,fontSize:12}}>{locale==='ar'?'المجموع':'Totals'}</td>
                <td style={{fontWeight:600}}>{tD.toFixed(3)}</td>
                <td style={{fontWeight:600}}>{tC.toFixed(3)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          {!balanced && <div className='acc-bal-err'>{locale==='ar'?'القيد غير متوازن — مجموع المدين يجب أن يساوي مجموع الدائن':'Entry not balanced — debit must equal credit'}</div>}
          <button className='btn btn-s btn-sm' style={{marginTop:10}} onClick={()=>setLines(p=>[...p,{account_id:'',label:'',debit:0,credit:0}])}>
            + {locale==='ar'?'إضافة سطر':'Add Line'}
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ACCOUNTING SECTION (Entries / Journals / CoA / Taxes)
  // ══════════════════════════════════════════════════════════
  function AccountingSection({ cur, bootstrap }) {
    const { locale } = useI18n();
    const [sub, setSub] = useState('entries');
    const [view, setView] = useState('list');
    const [stF, setStF] = useState('all');
    const [entries, eL,, reloadE] = useLoad('/api/accounting/journal-entries',[],[]);
    const [journals, jL] = useLoad('/api/accounting/journals',[],[]);
    const [accounts, aL] = useLoad('/api/accounting/accounts',[],[]);
    const [taxes, tL] = useLoad('/api/accounting/taxes',[],[]);
    const filtE = stF==='all'?entries:entries.filter(e=>e.state===stF);
    const typeOrder=['asset','liability','equity','income','expense'];
    const typeLabel={asset:locale==='ar'?'الأصول':'Assets',liability:locale==='ar'?'الخصوم':'Liabilities',equity:locale==='ar'?'حقوق الملكية':'Equity',income:locale==='ar'?'الإيرادات':'Revenue',expense:locale==='ar'?'المصاريف':'Expenses'};
    if (view==='create-entry') return <JournalEntryForm bootstrap={bootstrap} onClose={()=>setView('list')} onSaved={()=>{setView('list');reloadE();}}/>;
    return (
      <div className='pb'>
        <div className='acc-sub-tabs'>
          {[['entries','Journal Entries','القيود اليومية'],['journals','Journals','اليوميات'],['coa','Chart of Accounts','دليل الحسابات'],['taxes','Taxes','الضرائب']].map(([k,en,ar])=>(
            <button key={k} className={`acc-sub-tab ${sub===k?'active':''}`} onClick={()=>setSub(k)}>{locale==='ar'?ar:en}</button>
          ))}
        </div>
        {sub==='entries' && <>
          <div className='acc-bar'>
            <div className='fb' style={{margin:0}}>
              <select className='fi' style={{minWidth:130}} value={stF} onChange={e=>setStF(e.target.value)}>
                <option value='all'>{locale==='ar'?'الكل':'All'}</option>
                <option value='draft'>{locale==='ar'?'مسودة':'Draft'}</option>
                <option value='posted'>{locale==='ar'?'مرحّل':'Posted'}</option>
              </select>
            </div>
            <button className='btn btn-p' onClick={()=>setView('create-entry')}>+ {locale==='ar'?'قيد جديد':'New Entry'}</button>
          </div>
          <Tbl rows={filtE} cols={[
            {key:'entry_no',label:locale==='ar'?'رقم القيد':'Entry No.'},
            {key:'entry_date',label:locale==='ar'?'التاريخ':'Date'},
            {key:'journal_code',label:locale==='ar'?'اليومية':'Journal'},
            {key:'reference',label:locale==='ar'?'المرجع':'Reference'},
            {key:'state',label:locale==='ar'?'الحالة':'Status',render:r=><SBadge state={r.state}/>},
            {key:'total_debit',label:locale==='ar'?'مدين':'Debit',render:r=>fmt(r.total_debit,cur)},
            {key:'total_credit',label:locale==='ar'?'دائن':'Credit',render:r=>fmt(r.total_credit,cur)},
          ]} loading={eL}
            emptyLabel={locale==='ar'?'لا توجد قيود':'No journal entries'}
            emptyAction={locale==='ar'?'قيد جديد':'New Entry'} onEmptyAction={()=>setView('create-entry')} />
        </>}
        {sub==='journals' && <Tbl rows={journals} cols={[
          {key:'code',label:locale==='ar'?'الرمز':'Code'},
          {key:'name',label:locale==='ar'?'الاسم':'Name',render:r=>lx(r,locale)},
          {key:'journal_type',label:locale==='ar'?'النوع':'Type'},
          {key:'debit_code',label:locale==='ar'?'الحساب المدين':'Default Debit'},
          {key:'credit_code',label:locale==='ar'?'الحساب الدائن':'Default Credit'},
        ]} loading={jL} emptyLabel={locale==='ar'?'لا توجد يوميات — ثبّت التوطين أولاً':'No journals — install localization first'} />}
        {sub==='coa' && (
          aL ? <div className='pld'><span className='spinner'/></div> :
          accounts.length===0 ? <div className='empty'><h3>{locale==='ar'?'لا توجد حسابات — ثبّت التوطين أولاً':'No accounts — install localization first'}</h3></div> :
          <div>
            {typeOrder.map(type=>{
              const grp=accounts.filter(a=>a.account_type===type);
              if(!grp.length)return null;
              return <div className='card' key={type} style={{padding:0,overflow:'hidden',marginBottom:10}}>
                <div className='acc-coa-grp-hdr'>{typeLabel[type]}</div>
                <table><thead><tr>
                  <th>{locale==='ar'?'الكود':'Code'}</th>
                  <th>{locale==='ar'?'الاسم':'Name'}</th>
                  <th>{locale==='ar'?'النوع':'Type'}</th>
                  <th>{locale==='ar'?'مطابقة':'Reconcile'}</th>
                  <th>{locale==='ar'?'الحالة':'Status'}</th>
                </tr></thead>
                <tbody>{grp.map(a=><tr key={a.id}>
                  <td><span className='acc-coa-code'>{a.code}</span></td>
                  <td>{lx(a,locale)}</td>
                  <td>{a.account_type}</td>
                  <td>{a.allow_reconcile?<Ic name='check' size={14}/>:'—'}</td>
                  <td><span className={`badge ${a.is_active?'b-active':'b-inactive'}`}>{a.is_active?(locale==='ar'?'نشط':'Active'):(locale==='ar'?'غير نشط':'Inactive')}</span></td>
                </tr>)}</tbody></table>
              </div>;
            })}
          </div>
        )}
        {sub==='taxes' && <Tbl rows={taxes} cols={[
          {key:'name',label:locale==='ar'?'الاسم':'Name',render:r=>lx(r,locale)},
          {key:'rate',label:locale==='ar'?'النسبة':'Rate',render:r=>`${r.rate}%`},
          {key:'tax_scope',label:locale==='ar'?'النطاق':'Scope'},
          {key:'price_include',label:locale==='ar'?'شامل السعر':'Incl. Price',render:r=>r.price_include?<Ic name='check' size={14}/>:'—'},
        ]} loading={tL} emptyLabel={locale==='ar'?'لا توجد ضرائب — ثبّت التوطين':'No taxes — install localization'} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // PAYMENTS SECTION
  // ══════════════════════════════════════════════════════════
  function PaymentsSection({ cur, bootstrap }) {
    const { locale } = useI18n();
    const [sub, setSub] = useState('customer');
    const [showForm, setShowForm] = useState(false);
    const [pf, setPf] = useState({ partner_name:'', payment_date:today(), amount:'', method:'cash', journal_id:'', memo:'' });
    const [saving, setSaving] = useState(false);
    const epMap = { customer:'/api/accounting/customer-payments', vendor:'/api/accounting/vendor-payments', transfer:'/api/accounting/transfers' };
    const [items, loading,, reload] = useLoad(epMap[sub], [sub], []);
    const journals = (bootstrap?.journals||[]).filter(j=>['cash','bank'].includes(j.journal_type));
    const sf=k=>e=>setPf(p=>({...p,[k]:e.target.value}));

    const save = async () => {
      if(!pf.amount||!pf.payment_date){toast(locale==='ar'?'المبلغ والتاريخ مطلوبان':'Amount and date required','e');return;}
      try {
        setSaving(true);
        const jid = pf.journal_id||journals[0]?.id;
        if(sub==='transfer'){
          const toJ=journals.find(j=>String(j.id)!==String(jid));
          await api.post('/api/accounting/transfers',{from_journal_id:jid,to_journal_id:toJ?.id||jid,payment_date:pf.payment_date,amount:pf.amount,method:pf.method,memo:pf.memo});
        } else {
          await api.post('/api/accounting/payments',{
            payment_direction:sub==='customer'?'inbound':'outbound', payment_category:sub,
            partner_name:pf.partner_name, journal_id:jid,
            payment_date:pf.payment_date, amount:pf.amount, method:pf.method, memo:pf.memo
          });
        }
        toast(locale==='ar'?'تم التسجيل':'Registered');
        setShowForm(false); reload();
      } catch(e){toast(e.message||'Failed','e');}finally{setSaving(false);}
    };

    const tCols = sub==='transfer'
      ?[{key:'payment_no',label:locale==='ar'?'رقم التحويل':'Transfer No.'},{key:'payment_date',label:locale==='ar'?'التاريخ':'Date'},{key:'journal_code',label:locale==='ar'?'من':'From'},{key:'amount',label:locale==='ar'?'المبلغ':'Amount',render:r=>fmt(r.amount,cur)}]
      :[{key:'payment_no',label:locale==='ar'?'رقم الدفعة':'Payment No.'},{key:'partner_name',label:locale==='ar'?'الشريك':'Partner'},{key:'payment_date',label:locale==='ar'?'التاريخ':'Date'},{key:'method',label:locale==='ar'?'الطريقة':'Method'},{key:'journal_code',label:locale==='ar'?'اليومية':'Journal'},{key:'amount',label:locale==='ar'?'المبلغ':'Amount',render:r=>fmt(r.amount,cur)}];

    return (
      <div className='pb'>
        <div className='acc-sub-tabs'>
          {[['customer','Customer Payments','مدفوعات العملاء'],['vendor','Vendor Payments','مدفوعات الموردين'],['transfer','Transfers','التحويلات']].map(([k,en,ar])=>(
            <button key={k} className={`acc-sub-tab ${sub===k?'active':''}`} onClick={()=>{setSub(k);setShowForm(false);}}>{locale==='ar'?ar:en}</button>
          ))}
        </div>
        <div className='acc-bar'>
          <span/>
          <button className='btn btn-p' onClick={()=>setShowForm(true)}>
            + {locale==='ar'?(sub==='transfer'?'تحويل جديد':'دفعة جديدة'):(sub==='transfer'?'New Transfer':'New Payment')}
          </button>
        </div>
        {showForm && (
          <div className='acc-pay-inline card' style={{marginBottom:14}}>
            <div className='fr3'>
              {sub!=='transfer' && <F label={locale==='ar'?'الشريك':'Partner'}><input className='fi' value={pf.partner_name} onChange={sf('partner_name')} placeholder='Name...'/></F>}
              <F label={locale==='ar'?'التاريخ':'Date'}><input className='fi' type='date' value={pf.payment_date} onChange={sf('payment_date')}/></F>
              <F label={locale==='ar'?'المبلغ':'Amount'}><input className='fi' type='number' min='0' step='.001' value={pf.amount} onChange={sf('amount')}/></F>
              <F label={locale==='ar'?'الطريقة':'Method'}>
                <select className='fi' value={pf.method} onChange={sf('method')}>
                  <option value='cash'>{locale==='ar'?'نقدي':'Cash'}</option>
                  <option value='bank'>{locale==='ar'?'تحويل بنكي':'Bank Transfer'}</option>
                  <option value='card'>{locale==='ar'?'بطاقة':'Card'}</option>
                  <option value='cliq'>CliQ</option>
                </select>
              </F>
              {journals.length>0 && <F label={locale==='ar'?'اليومية':'Journal'}><select className='fi' value={pf.journal_id} onChange={sf('journal_id')}>{journals.map(j=><option key={j.id} value={j.id}>{lx(j,locale)}</option>)}</select></F>}
              <F label={locale==='ar'?'ملاحظات':'Memo'}><input className='fi' value={pf.memo} onChange={sf('memo')} placeholder='Optional...'/></F>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className='btn btn-s' onClick={()=>setShowForm(false)}>{locale==='ar'?'إلغاء':'Cancel'}</button>
              <button className='btn btn-p' onClick={save} disabled={saving}>{saving?'...':locale==='ar'?'تسجيل':'Register'}</button>
            </div>
          </div>
        )}
        <Tbl rows={items} cols={tCols} loading={loading}
          emptyLabel={locale==='ar'?'لا توجد مدفوعات':'No payments'}
          emptyAction={locale==='ar'?'دفعة جديدة':'New Payment'} onEmptyAction={()=>setShowForm(true)} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // REPORTING SECTION
  // ══════════════════════════════════════════════════════════
  function ReportingSection({ cur }) {
    const { locale } = useI18n();
    const [active, setActive] = useState('pl');
    const [pl] = useLoad('/api/accounting/reports/profit-loss',[],{});
    const [bs] = useLoad('/api/accounting/reports/balance-sheet',[],{});
    const [tb, tbL] = useLoad('/api/accounting/reports/trial-balance',[],[]);
    const [gl, glL] = useLoad('/api/accounting/reports/general-ledger',[],[]);
    const [agR, agRL] = useLoad('/api/accounting/reports/aged-receivables',[],[]);
    const [agP, agPL] = useLoad('/api/accounting/reports/aged-payables',[],[]);
    const [biz, bizL] = useLoad('/api/accounting/reports/revenue-business-line',[],[]);
    const [cL, cLL] = useLoad('/api/accounting/reports/customer-ledger',[],[]);
    const [vL, vLL] = useLoad('/api/accounting/reports/vendor-ledger',[],[]);

    const reps = [['pl','Profit & Loss','الأرباح والخسائر'],['bs','Balance Sheet','الميزانية العمومية'],['tb','Trial Balance','ميزان المراجعة'],['gl','General Ledger','دفتر الأستاذ'],['custledger','Customer Ledger','كشف العملاء'],['vendledger','Vendor Ledger','كشف الموردين'],['agedr','Aged Receivables','الذمم المدينة المتقادمة'],['agedp','Aged Payables','الذمم الدائنة المتقادمة'],['biz','Revenue by Business Line','الإيراد حسب خط العمل']];

    return (
      <div className='pb'>
        <div className='tabs' style={{flexWrap:'wrap'}}>
          {reps.map(([k,en,ar])=>(
            <div key={k} className={`tab ${active===k?'ac':''}`} onClick={()=>setActive(k)}>{locale==='ar'?ar:en}</div>
          ))}
        </div>

        {active==='pl' && <div className='card' style={{maxWidth:560,padding:0,overflow:'hidden'}}>
          <div className='acc-report-section'>{locale==='ar'?'الإيرادات':'Revenue'}</div>
          <div className='acc-report-row'><span>{locale==='ar'?'إجمالي الإيرادات':'Total Revenue'}</span><strong>{fmt(pl.revenue,cur)}</strong></div>
          <div className='acc-report-section'>{locale==='ar'?'المصاريف':'Expenses'}</div>
          <div className='acc-report-row'><span>{locale==='ar'?'إجمالي المصاريف':'Total Expenses'}</span><strong>{fmt(pl.expense,cur)}</strong></div>
          <div className='acc-report-total'><span>{locale==='ar'?'صافي الربح / الخسارة':'Net Profit / (Loss)'}</span><strong style={{color:pl.profit>=0?'var(--green)':'var(--red)'}}>{fmt(pl.profit,cur)}</strong></div>
        </div>}

        {active==='bs' && <div className='card' style={{maxWidth:560,padding:0,overflow:'hidden'}}>
          <div className='acc-report-section'>{locale==='ar'?'الأصول':'Assets'}</div>
          <div className='acc-report-row'><span>{locale==='ar'?'إجمالي الأصول':'Total Assets'}</span><strong>{fmt(bs.assets,cur)}</strong></div>
          <div className='acc-report-section'>{locale==='ar'?'الخصوم':'Liabilities'}</div>
          <div className='acc-report-row'><span>{locale==='ar'?'إجمالي الخصوم':'Total Liabilities'}</span><strong>{fmt(bs.liabilities,cur)}</strong></div>
          <div className='acc-report-section'>{locale==='ar'?'حقوق الملكية':'Equity'}</div>
          <div className='acc-report-row'><span>{locale==='ar'?'إجمالي حقوق الملكية':'Total Equity'}</span><strong>{fmt(bs.equity,cur)}</strong></div>
          <div className='acc-report-total'><span>{locale==='ar'?'المجموع':'Total L+E'}</span><strong>{fmt((bs.liabilities||0)+(bs.equity||0),cur)}</strong></div>
        </div>}

        {active==='tb' && <Tbl rows={tb} cols={[
          {key:'code',label:locale==='ar'?'الكود':'Code'},
          {key:'name',label:locale==='ar'?'الحساب':'Account',render:r=>lx(r,locale)},
          {key:'account_type',label:locale==='ar'?'النوع':'Type'},
          {key:'debit',label:locale==='ar'?'مدين':'Debit',render:r=>fmt(r.debit,cur)},
          {key:'credit',label:locale==='ar'?'دائن':'Credit',render:r=>fmt(r.credit,cur)},
          {key:'balance',label:locale==='ar'?'الرصيد':'Balance',render:r=>fmt(r.balance,cur)},
        ]} loading={tbL} emptyLabel={locale==='ar'?'لا توجد بيانات — رحّل بعض القيود أولاً':'No data — post entries first'}/>}

        {active==='gl' && <Tbl rows={gl} cols={[
          {key:'entry_date',label:locale==='ar'?'التاريخ':'Date'},
          {key:'entry_no',label:locale==='ar'?'القيد':'Entry'},
          {key:'account_code',label:locale==='ar'?'الحساب':'Account'},
          {key:'account_name',label:locale==='ar'?'اسم الحساب':'Account Name'},
          {key:'label',label:locale==='ar'?'البيان':'Label'},
          {key:'debit',label:locale==='ar'?'مدين':'Debit',render:r=>fmt(r.debit,cur)},
          {key:'credit',label:locale==='ar'?'دائن':'Credit',render:r=>fmt(r.credit,cur)},
        ]} loading={glL} emptyLabel={locale==='ar'?'لا توجد حركات مرحّلة':'No posted movements'}/>}

        {active==='custledger' && <Tbl rows={cL} cols={[
          {key:'partner_name',label:locale==='ar'?'العميل':'Customer'},
          {key:'document_no',label:locale==='ar'?'الوثيقة':'Document'},
          {key:'entry_date',label:locale==='ar'?'التاريخ':'Date'},
          {key:'debit',label:locale==='ar'?'مدين':'Debit',render:r=>fmt(r.debit,cur)},
          {key:'credit',label:locale==='ar'?'دائن':'Credit',render:r=>fmt(r.credit,cur)},
        ]} loading={cLL} emptyLabel={locale==='ar'?'لا توجد حركات':'No movements'}/>}

        {active==='vendledger' && <Tbl rows={vL} cols={[
          {key:'partner_name',label:locale==='ar'?'المورد':'Vendor'},
          {key:'document_no',label:locale==='ar'?'الوثيقة':'Document'},
          {key:'entry_date',label:locale==='ar'?'التاريخ':'Date'},
          {key:'debit',label:locale==='ar'?'مدين':'Debit',render:r=>fmt(r.debit,cur)},
          {key:'credit',label:locale==='ar'?'دائن':'Credit',render:r=>fmt(r.credit,cur)},
        ]} loading={vLL} emptyLabel={locale==='ar'?'لا توجد حركات':'No movements'}/>}

        {active==='agedr' && <Tbl rows={agR} cols={[
          {key:'invoice_no',label:locale==='ar'?'الفاتورة':'Invoice'},
          {key:'partner_name',label:locale==='ar'?'العميل':'Customer'},
          {key:'due_date',label:locale==='ar'?'الاستحقاق':'Due Date'},
          {key:'aging_bucket',label:locale==='ar'?'الفئة':'Bucket'},
          {key:'residual_amount',label:locale==='ar'?'المتبقي':'Balance Due',render:r=>fmt(r.residual_amount,cur)},
        ]} loading={agRL} emptyLabel={locale==='ar'?'لا توجد ذمم مدينة متأخرة':'No aged receivables'}/>}

        {active==='agedp' && <Tbl rows={agP} cols={[
          {key:'invoice_no',label:locale==='ar'?'الفاتورة':'Bill'},
          {key:'partner_name',label:locale==='ar'?'المورد':'Vendor'},
          {key:'due_date',label:locale==='ar'?'الاستحقاق':'Due Date'},
          {key:'aging_bucket',label:locale==='ar'?'الفئة':'Bucket'},
          {key:'residual_amount',label:locale==='ar'?'المتبقي':'Balance Due',render:r=>fmt(r.residual_amount,cur)},
        ]} loading={agPL} emptyLabel={locale==='ar'?'لا توجد ذمم دائنة متأخرة':'No aged payables'}/>}

        {active==='biz' && <Tbl rows={biz} cols={[
          {key:'business_line',label:locale==='ar'?'خط العمل':'Business Line',render:r=>(r.business_line||'—').replace(/_/g,' ')},
          {key:'revenue',label:locale==='ar'?'الإيراد':'Revenue',render:r=>fmt(r.revenue,cur)},
        ]} loading={bizL} emptyLabel={locale==='ar'?'لا توجد إيرادات مرحّلة':'No posted revenue'}/>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // CONFIGURATION SECTION
  // ══════════════════════════════════════════════════════════
  function ConfigurationSection({ bootstrap, onRefresh }) {
    const { locale } = useI18n();
    const [sub, setSub] = useState('settings');
    const [settings, sL, setSettings] = useLoad('/api/accounting/settings',[],{});
    const [saving, setSaving] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [pm, pmL] = useLoad('/api/accounting/payment-methods',[],[]);
    const countries = bootstrap?.countries||[];
    const installed = !!bootstrap?.localization_installed;
    const sf=k=>e=>setSettings(p=>({...p,[k]:e.target.value}));

    const saveSettings = async () => {
      try{setSaving(true);await api.put('/api/accounting/settings',settings);toast(locale==='ar'?'تم الحفظ':'Saved');if(onRefresh)onRefresh();}
      catch(e){toast(e.message||'Failed','e');}finally{setSaving(false);}
    };
    const installLoc = async () => {
      try{setInstalling(true);await api.post('/api/accounting/settings/localization/install',{country:settings.localization_country||'JO'});toast(locale==='ar'?'تم تثبيت التوطين':'Localization installed');if(onRefresh)onRefresh();}
      catch(e){toast(e.message||'Failed','e');}finally{setInstalling(false);}
    };

    return (
      <div className='pb'>
        <div className='acc-sub-tabs'>
          {[['settings','Settings','الإعدادات'],['localization','Localization','التوطين'],['payment-methods','Payment Methods','طرق الدفع']].map(([k,en,ar])=>(
            <button key={k} className={`acc-sub-tab ${sub===k?'active':''}`} onClick={()=>setSub(k)}>{locale==='ar'?ar:en}</button>
          ))}
        </div>

        {sub==='settings' && (
          <div className='card'>
            <div className='ct' style={{marginBottom:16}}>{locale==='ar'?'الإعدادات العامة':'General Settings'}
              <button className='btn btn-p btn-sm' onClick={saveSettings} disabled={saving}>{saving?'...':locale==='ar'?'حفظ':'Save'}</button>
            </div>
            {sL ? <div className='pld'><span className='spinner'/></div> :
            <div className='fr'>
              <div className='fg'><label>{locale==='ar'?'الدولة':'Country'}</label>
                <select className='fi' value={settings.localization_country||'JO'} onChange={sf('localization_country')}>
                  {countries.map(c=><option key={c.code} value={c.code}>{locale==='ar'?(c.name_ar||c.name):c.name} — {c.currency}</option>)}
                </select>
              </div>
              <div className='fg'><label>{locale==='ar'?'العملة الافتراضية':'Default Currency'}</label><input className='fi' value={settings.default_currency||''} onChange={sf('default_currency')} placeholder='JOD'/></div>
              <div className='fg'><label>{locale==='ar'?'بداية السنة المالية':'Fiscal Year Start'}</label><input className='fi' value={settings.fiscal_year_start||'01-01'} onChange={sf('fiscal_year_start')} placeholder='01-01'/></div>
              <div className='fg'><label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                <input type='checkbox' checked={!!settings.include_cafeteria} onChange={e=>setSettings(p=>({...p,include_cafeteria:e.target.checked}))} style={{width:16,height:16}}/>
                {locale==='ar'?'شمول الكافتيريا في المحاسبة':'Include Cafeteria in Accounting'}
              </label>
              <div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>
                {settings.include_cafeteria?(locale==='ar'?'مفعّل — حركات الكافتيريا الجديدة ستُرحَّل':'Enabled — new cafeteria transactions will be posted'):(locale==='ar'?'معطّل — الكافتيريا مستثناة من المحاسبة':'Disabled — cafeteria excluded from accounting')}
              </div></div>
            </div>}
          </div>
        )}

        {sub==='localization' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className='card'>
              <div className='ct'>{locale==='ar'?'حالة التوطين':'Localization Status'}
                <button className='btn btn-p btn-sm' onClick={installLoc} disabled={installing}>
                  {installing?'...':installed?(locale==='ar'?'إعادة تثبيت':'Reinstall'):(locale==='ar'?'تثبيت التوطين':'Install Localization')}
                </button>
              </div>
              <div className='dg'>
                <div className='di'><div className='dl'>{locale==='ar'?'الحالة':'Status'}</div><div className='dv'>{installed?<span className='badge b-active'><Ic name='check' size={14}/> {locale==='ar'?'مثبّت':'Installed'}</span>:<span className='badge b-warning'><Ic name='alert-triangle' size={14}/> {locale==='ar'?'غير مثبّت':'Not Installed'}</span>}</div></div>
                <div className='di'><div className='dl'>{locale==='ar'?'الدولة':'Country'}</div><div className='dv'>{settings.localization_country||'JO'}</div></div>
                <div className='di'><div className='dl'>{locale==='ar'?'العملة':'Currency'}</div><div className='dv'>{settings.display_currency||settings.default_currency||'JOD'}</div></div>
                <div className='di'><div className='dl'>{locale==='ar'?'المنطقة':'Region'}</div><div className='dv'>{settings.localization_region||'Middle East'}</div></div>
              </div>
              <div className='acc-loc-note'>
                {locale==='ar'?'سيقوم التثبيت بإنشاء دليل الحسابات والضرائب واليوميات للدولة المختارة. القيود المرحّلة مسبقاً لا تتأثر.':'Installation creates the chart of accounts, taxes, and journals for the selected country. Previously posted entries are unaffected.'}
              </div>
            </div>
            <div className='card'>
              <div className='ct'>{locale==='ar'?'الدول المتاحة':'Available Countries'}</div>
              {countries.map(c=>(
                <div className='acc-country-row' key={c.code}>
                  <div><div style={{fontSize:13,fontWeight:500}}>{locale==='ar'?(c.name_ar||c.name):c.name}</div><div style={{fontSize:11,color:'var(--t4)'}}>{c.code}</div></div>
                  <span className='badge b-info'>{c.currency}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sub==='payment-methods' && <Tbl rows={pm} cols={[
          {key:'code',label:locale==='ar'?'الرمز':'Code'},
          {key:'name',label:locale==='ar'?'الاسم':'Name',render:r=>lx(r,locale)},
          {key:'payment_type',label:locale==='ar'?'النوع':'Type'},
          {key:'is_split_allowed',label:locale==='ar'?'تقسيم':'Split',render:r=>r.is_split_allowed?<Ic name='check' size={14}/>:'—'},
          {key:'is_active',label:locale==='ar'?'الحالة':'Status',render:r=><span className={`badge ${r.is_active?'b-active':'b-inactive'}`}>{r.is_active?(locale==='ar'?'نشط':'Active'):(locale==='ar'?'غير نشط':'Inactive')}</span>},
        ]} loading={pmL} emptyLabel={locale==='ar'?'لا توجد طرق دفع':'No payment methods'}/>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MAIN ACCOUNTING WORKSPACE
  // ══════════════════════════════════════════════════════════
  function AccountingWorkspace() {
    const { locale } = useI18n();
    const [tab, setTab] = useState('dashboard');
    const [bootstrap, bL,, reloadBootstrap] = useBootstrap();
    const cur = bootstrap?.settings?.display_currency || bootstrap?.settings?.default_currency || 'JOD';

    const tabs = [
      ['dashboard','Dashboard','لوحة التحكم',<Ic name='grid' size={14}/>],
      ['customers','Customers','العملاء',<Ic name='file-text' size={14}/>],
      ['vendors','Vendors','الموردون',<Ic name='package' size={14}/>],
      ['accounting','Accounting','المحاسبة',<Ic name='book' size={14}/>],
      ['payments','Payments','المدفوعات',<Ic name='credit-card' size={14}/>],
      ['reporting','Reporting','التقارير',<Ic name='bar-chart' size={14}/>],
      ['configuration','Configuration','الإعداد',<Ic name='settings' size={14}/>],
    ];

    return (
      <div>
        {/* Top nav — uses acc-top-nav with GymOS color variables */}
        <div className='acc-top-nav'>
          <div className='acc-top-nav-brand'>
            <Ic name='bar-chart' size={13}/> {locale==='ar'?'المحاسبة':'Accounting'}
          </div>
          <div className='acc-top-nav-tabs'>
            {tabs.map(([k,en,ar,icon])=>(
              <button key={k} className={`acc-nav-tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>
                <span style={{fontSize:13}}>{icon}</span>
                <span>{locale==='ar'?ar:en}</span>
              </button>
            ))}
          </div>
          <div className='acc-top-nav-meta'>
            <span className='acc-pill'>{cur}</span>
            {bootstrap?.localization_installed && <span className='acc-pill acc-pill-green'><Ic name='check' size={14}/> {bootstrap?.settings?.localization_country||'JO'}</span>}
          </div>
        </div>

        {/* Page header */}
        <div className='ph'>
          <h1>{locale==='ar' ? tabs.find(t=>t[0]===tab)?.[2] : tabs.find(t=>t[0]===tab)?.[1]}</h1>
        </div>

        {/* Content */}
        {bL && tab!=='dashboard'
          ? <div className='pb'><div className='pld'><span className='spinner'/></div></div>
          : <>
            {tab==='dashboard'    && <DashboardSection cur={cur} bootstrap={bootstrap}/>}
            {tab==='customers'    && <CustomersSection cur={cur} bootstrap={bootstrap}/>}
            {tab==='vendors'      && <VendorsSection cur={cur} bootstrap={bootstrap}/>}
            {tab==='accounting'   && <AccountingSection cur={cur} bootstrap={bootstrap}/>}
            {tab==='payments'     && <PaymentsSection cur={cur} bootstrap={bootstrap}/>}
            {tab==='reporting'    && <ReportingSection cur={cur}/>}
            {tab==='configuration'&& <ConfigurationSection bootstrap={bootstrap} onRefresh={reloadBootstrap}/>}
          </>
        }
      </div>
    );
  }

  // Single page registration — no left sidebar sub-items
  GymOS.registerPage({
    path: '/accounting',
    component: AccountingWorkspace,
    module: 'accounting',
    label: 'Accounting',
    labelAr: 'المحاسبة',
    order: 70
  });

})();

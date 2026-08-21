const { useState, useEffect, useCallback } = React;
const { api, useI18n, Modal, Ic, toast, formatMoney } = shared;

function mfmt(v, c){ return formatMoney ? formatMoney(v || 0, c || 'JOD') : `${Number(v || 0).toFixed(3)} ${c || 'JOD'}`; }
function fdt(v){ return v ? String(v).replace('T', ' ').slice(0, 16) : '—'; }
// Localized label for campaign/message statuses (module uses inline locale ternaries, not t()).
function mstatus(s, ar){ const M={draft:['مسودة','Draft'],scheduled:['مجدول','Scheduled'],running:['قيد التشغيل','Running'],sent:['تم الإرسال','Sent'],queued:['في الانتظار','Queued'],failed:['فشل','Failed'],cancelled:['ملغي','Cancelled'],completed:['مكتمل','Completed'],paid:['مدفوع','Paid'],pending:['معلق','Pending']}; const v=M[s]; return v?(ar?v[0]:v[1]):(s||''); }
function useMkt(url, fallback){
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.get(url).then(r => setData(r.data ?? fallback)).catch(() => setData(fallback)).finally(() => setLoading(false));
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return [data, loading, load, setData];
}

function Kpi({label, value}){ return <div className='mkt-kpi'><div className='l'>{label}</div><div className='v'>{value}</div></div>; }

function DashboardTab({ bootstrap, refreshAll }){
  const { locale } = useI18n();
  const [data, loading, reload] = useMkt('/api/marketing/dashboard', { stats:{}, recentCampaigns:[], recentMessages:[], segments:[] });
  useEffect(() => { if (refreshAll) reload(); }, [refreshAll]);
  if (loading) return <div className='pb'><div className='pld'><span className='spinner'/></div></div>;
  const s = data.stats || {};
  return <div className='pb'>
    <div className='mkt-hero'>
      <Kpi label={locale==='ar'?'جهات الاتصال':'Contacts'} value={s.contactsCount || 0} />
      <Kpi label={locale==='ar'?'الحملات':'Campaigns'} value={s.campaignCount || 0} />
      <Kpi label={locale==='ar'?'رسائل اليوم':'Sent Today'} value={s.sentToday || 0} />
      <Kpi label={locale==='ar'?'رسائل معلقة':'Pending'} value={s.pendingMessages || 0} />
      <Kpi label={locale==='ar'?'تنتهي قريباً':'Expiring Soon'} value={s.expiringSoon || 0} />
      <Kpi label={locale==='ar'?'دفعات مستحقة':'Payment Due'} value={s.paymentDue || 0} />
      <Kpi label={locale==='ar'?'أعياد الميلاد اليوم':'Birthdays Today'} value={s.birthdayToday || 0} />
    </div>
    <div className='mkt-grid'>
      <div className='card'>
        <div className='ct'>{locale==='ar'?'آخر الحملات':'Recent Campaigns'}</div>
        <div className='mkt-list'>
          {(data.recentCampaigns || []).length ? data.recentCampaigns.map(c => <div className='mkt-row' key={c.id}><div><div className='mkt-row-title'>{c.name}</div><div className='mkt-row-sub'>{c.campaign_type} • {c.target_segment} • {fdt(c.scheduled_at || c.created_at)}</div></div><span className={'badge b-'+(c.status==='draft'?'inactive':c.status==='scheduled'?'info':c.status==='running'?'active':'paid')}>{mstatus(c.status,locale==='ar')}</span></div>) : <div className='empty'><h3>{locale==='ar'?'لا توجد حملات':'No campaigns yet'}</h3></div>}
        </div>
      </div>
      <div className='card'>
        <div className='ct'>{locale==='ar'?'آخر الرسائل':'Recent Messages'}</div>
        <div className='mkt-list'>
          {(data.recentMessages || []).length ? data.recentMessages.map(m => <div className='mkt-row' key={m.id}><div><div className='mkt-row-title'>{m.phone}</div><div className='mkt-row-sub'>{(m.message_text || '').slice(0, 72)}</div></div><span className={'badge b-'+(m.status==='sent'?'paid':m.status==='queued'?'pending':'cancelled')}>{mstatus(m.status,locale==='ar')}</span></div>) : <div className='empty'><h3>{locale==='ar'?'لا توجد رسائل':'No messages yet'}</h3></div>}
        </div>
      </div>
    </div>
  </div>;
}

function ContactsTab(){
  const { locale } = useI18n();
  const [search, setSearch] = useState('');
  const [contacts, loading, load] = useMkt('/api/marketing/contacts?search=', []);
  useEffect(() => { const t=setTimeout(() => load(), 100); return ()=>clearTimeout(t); }, []);
  const refresh = () => api.get('/api/marketing/contacts?search=' + encodeURIComponent(search)).then(r => {}).catch(()=>{});
  useEffect(() => { const tm = setTimeout(() => api.get('/api/marketing/contacts?search=' + encodeURIComponent(search)).then(r => window.__mcontacts = r.data).catch(()=>{}), 250); return () => clearTimeout(tm); }, [search]);
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/api/marketing/contacts?search=' + encodeURIComponent(search)).then(r => setRows(r.data || [])).catch(() => setRows([])); }, [search]);
  const sync = async () => { try { const r = await api.post('/api/marketing/contacts/sync-members', {}); toast((locale==='ar'?'تمت المزامنة: ':'Synced: ') + (r.data?.upserted || 0)); api.get('/api/marketing/contacts?search=' + encodeURIComponent(search)).then(rr => setRows(rr.data || [])); } catch(e){ toast(e.message,'e'); } };
  return <div className='pb'>
    <div className='mkt-toolbar'>
      <div className='fb' style={{flex:1}}><input className='fi' value={search} onChange={e => setSearch(e.target.value)} placeholder={locale==='ar'?'بحث بالاسم / الهاتف / البريد':'Search name / phone / email'} /></div>
      <div className='mkt-actions'><button className='btn btn-p' onClick={sync}><Ic name='refreshCw' size={14} />{locale==='ar'?'مزامنة الأعضاء':'Sync Members'}</button></div>
    </div>
    <div className='card' style={{padding:0,overflow:'hidden'}}>
      <table><thead><tr><th>{locale==='ar'?'الاسم':'Name'}</th><th>{locale==='ar'?'الهاتف':'Phone'}</th><th>{locale==='ar'?'البريد':'Email'}</th><th>{locale==='ar'?'العلامات':'Tags'}</th><th>{locale==='ar'?'آخر مزامنة':'Last Sync'}</th></tr></thead>
      <tbody>{rows.length ? rows.map(c => <tr key={c.id}><td>{c.full_name}</td><td>{c.phone}</td><td>{c.email || '—'}</td><td style={{fontSize:11}}>{(c.tags || []).join(', ') || '—'}</td><td>{fdt(c.last_sync_at)}</td></tr>) : <tr><td colSpan='5'><div className='empty'><h3>{locale==='ar'?'لا توجد جهات اتصال':'No contacts'}</h3></div></td></tr>}</tbody></table>
    </div>
  </div>;
}

function SegmentsTab(){
  const { locale } = useI18n();
  const [segments, loading, load] = useMkt('/api/marketing/segments', []);
  const [preview, setPreview] = useState([]);
  const [active, setActive] = useState('');
  const showPreview = async (code) => { setActive(code); try { const r = await api.get('/api/marketing/segments/' + code + '/preview'); setPreview(r.data || []); } catch { setPreview([]); } };
  return <div className='pb'><div className='mkt-grid'><div className='card'><div className='ct'>{locale==='ar'?'الشرائح':'Segments'}</div><div className='mkt-list'>{segments.map(s => <div className='mkt-row' key={s.code}><div><div className='mkt-row-title'>{locale==='ar'?s.nameAr:s.name}</div><div className='mkt-row-sub'>{s.code}</div></div><div className='mkt-actions'><span className='badge b-info'>{s.count}</span><button className='btn btn-s btn-sm' onClick={() => showPreview(s.code)}>{locale==='ar'?'معاينة':'Preview'}</button></div></div>)}</div></div><div className='card'><div className='ct'>{locale==='ar'?'معاينة الشريحة':'Segment Preview'} {active ? <span className='mkt-small'>({active})</span> : null}</div><div className='mkt-list'>{preview.length ? preview.map(r => <div className='mkt-row' key={r.id}><div><div className='mkt-row-title'>{r.full_name}</div><div className='mkt-row-sub'>{r.phone} {r.end_date ? `• ${r.end_date}` : ''} {r.residual_amount ? `• ${mfmt(r.residual_amount, bootstrap?.currency || 'JOD')}` : ''}</div></div></div>) : <div className='empty'><h3>{locale==='ar'?'اختر شريحة للمعاينة':'Select a segment to preview'}</h3></div>}</div></div></div></div>;
}

function TemplateModal({ onClose, onSaved, current }){
  const { locale } = useI18n();
  const [f, setF] = useState(current || { name:'', name_ar:'', category:'general', language:'ar', content:'', variables_json:[] });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    try {
      const payload = { ...f, variables_json: String(f.variables_json || '').split(',').map(v => v.trim()).filter(Boolean) };
      if (current?.id) await api.put('/api/marketing/templates/' + current.id, payload);
      else await api.post('/api/marketing/templates', payload);
      toast(locale==='ar'?'تم الحفظ':'Saved');
      onSaved();
    } catch (e) { toast(e.message, 'e'); }
  };
  return <Modal title={locale==='ar'?'قالب واتساب':'WhatsApp Template'} onClose={onClose} wide><div className='mdl-b'><div className='fr'><div className='fg'><label>{locale==='ar'?'الاسم':'Name'}</label><input className='fi' value={f.name} onChange={e => s('name', e.target.value)} /></div><div className='fg'><label>{locale==='ar'?'الاسم العربي':'Arabic Name'}</label><input className='fi' value={f.name_ar} onChange={e => s('name_ar', e.target.value)} /></div></div><div className='fr'><div className='fg'><label>{locale==='ar'?'الفئة':'Category'}</label><select className='fi' value={f.category} onChange={e => s('category', e.target.value)}><option value='general'>general</option><option value='offer'>offer</option><option value='expiry'>expiry</option><option value='payment'>payment</option><option value='birthday'>birthday</option></select></div><div className='fg'><label>{locale==='ar'?'اللغة':'Language'}</label><select className='fi' value={f.language} onChange={e => s('language', e.target.value)}><option value='ar'>Arabic</option><option value='en'>English</option></select></div></div><div className='fg'><label>{locale==='ar'?'المتغيرات مفصولة بفاصلة':'Variables comma separated'}</label><input className='fi' value={Array.isArray(f.variables_json) ? f.variables_json.join(', ') : f.variables_json} onChange={e => s('variables_json', e.target.value)} placeholder='name, expiry_date, amount' /></div><div className='fg'><label>{locale==='ar'?'النص':'Content'}</label><textarea className='fi' rows='8' value={f.content} onChange={e => s('content', e.target.value)} /></div></div><div className='mdl-f'><button className='btn btn-s' onClick={onClose}>{locale==='ar'?'إلغاء':'Cancel'}</button><button className='btn btn-p' onClick={save}>{locale==='ar'?'حفظ':'Save'}</button></div></Modal>;
}

function TemplatesTab(){
  const { locale } = useI18n();
  const [templates, loading, load] = useMkt('/api/marketing/templates', []);
  const [current, setCurrent] = useState(null);
  const [show, setShow] = useState(false);
  return <div className='pb'><div className='mkt-toolbar'><div /><button className='btn btn-p' onClick={() => { setCurrent(null); setShow(true); }}><Ic name='plus' size={14} />{locale==='ar'?'قالب جديد':'New Template'}</button></div><div className='mkt-list'>{templates.length ? templates.map(t => <div className='mkt-row' key={t.id}><div><div className='mkt-row-title'>{t.name}</div><div className='mkt-row-sub'>{t.category} • {t.language} • {(t.content || '').slice(0, 90)}</div></div><div className='mkt-actions'><button className='btn btn-s btn-sm' onClick={() => { setCurrent({ ...t, variables_json: (() => { try { return JSON.parse(t.variables_json || '[]'); } catch { return []; } })() }); setShow(true); }}>{locale==='ar'?'تعديل':'Edit'}</button></div></div>) : <div className='empty'><h3>{locale==='ar'?'لا توجد قوالب':'No templates yet'}</h3></div>}</div>{show && <TemplateModal current={current} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}</div>;
}

function CampaignModal({ onClose, onSaved, bootstrap, current }){
  const { locale } = useI18n();
  const [templates, ,] = useMkt('/api/marketing/templates', []);
  const [segments, ,] = useMkt('/api/marketing/segments', []);
  const [f, setF] = useState(current || { name:'', campaign_type:'broadcast', target_segment:'all_contacts', template_id:'', scheduled_at:'', status:'draft', message_text:'' });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    try {
      const payload = { ...f, template_id: f.template_id || null };
      if (current?.id) await api.put('/api/marketing/campaigns/' + current.id, payload);
      else await api.post('/api/marketing/campaigns', payload);
      toast(locale==='ar'?'تم الحفظ':'Saved');
      onSaved();
    } catch (e) { toast(e.message, 'e'); }
  };
  return <Modal title={locale==='ar'?'حملة واتساب':'WhatsApp Campaign'} onClose={onClose} wide><div className='mdl-b'><div className='fr'><div className='fg'><label>{locale==='ar'?'الاسم':'Name'}</label><input className='fi' value={f.name} onChange={e => s('name', e.target.value)} /></div><div className='fg'><label>{locale==='ar'?'النوع':'Type'}</label><select className='fi' value={f.campaign_type} onChange={e => s('campaign_type', e.target.value)}><option value='broadcast'>broadcast</option><option value='offer'>offer</option><option value='renewal'>renewal</option><option value='reminder'>reminder</option></select></div></div><div className='fr'><div className='fg'><label>{locale==='ar'?'الشريحة':'Segment'}</label><select className='fi' value={f.target_segment} onChange={e => s('target_segment', e.target.value)}>{segments.map(seg => <option key={seg.code} value={seg.code}>{locale==='ar'?seg.nameAr:seg.name}</option>)}</select></div><div className='fg'><label>{locale==='ar'?'القالب':'Template'}</label><select className='fi' value={f.template_id} onChange={e => s('template_id', e.target.value)}><option value=''>{locale==='ar'?'بدون قالب':'No template'}</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div><div className='fr'><div className='fg'><label>{locale==='ar'?'موعد الجدولة':'Scheduled At'}</label><input className='fi' type='datetime-local' value={f.scheduled_at} onChange={e => s('scheduled_at', e.target.value)} /></div><div className='fg'><label>{locale==='ar'?'الحالة':'Status'}</label><select className='fi' value={f.status} onChange={e => s('status', e.target.value)}><option value='draft'>draft</option><option value='scheduled'>scheduled</option></select></div></div><div className='fg'><label>{locale==='ar'?'نص إضافي / العرض':'Offer / Extra Text'}</label><textarea className='fi' rows='5' value={f.message_text} onChange={e => s('message_text', e.target.value)} /></div></div><div className='mdl-f'><button className='btn btn-s' onClick={onClose}>{locale==='ar'?'إلغاء':'Cancel'}</button><button className='btn btn-p' onClick={save}>{locale==='ar'?'حفظ':'Save'}</button></div></Modal>;
}

function CampaignsTab({ bootstrap }){
  const { locale } = useI18n();
  const [rows, loading, load] = useMkt('/api/marketing/campaigns', []);
  const [current, setCurrent] = useState(null);
  const [show, setShow] = useState(false);
  const queue = async (id) => { try { const r = await api.post('/api/marketing/campaigns/' + id + '/queue', {}); toast((locale==='ar'?'تمت جدولة ':'Queued ') + (r.data?.queued || 0)); load(); } catch (e) { toast(e.message,'e'); } };
  return <div className='pb'><div className='mkt-toolbar'><div className='mkt-small'>{locale==='ar'?'ابنِ الحملة ثم جهّز الرسائل للصف في V1.':'Build campaign and queue messages in V1.'}</div><button className='btn btn-p' onClick={() => { setCurrent(null); setShow(true); }}><Ic name='plus' size={14} />{locale==='ar'?'حملة جديدة':'New Campaign'}</button></div><div className='mkt-list'>{rows.length ? rows.map(c => <div className='mkt-row' key={c.id}><div><div className='mkt-row-title'>{c.name}</div><div className='mkt-row-sub'>{c.campaign_type} • {c.target_segment} • {c.template_name || (locale==='ar'?'بدون قالب':'No template')} • {fdt(c.scheduled_at || c.created_at)}</div></div><div className='mkt-actions'><span className={'badge b-'+(c.status==='draft'?'inactive':c.status==='scheduled'?'info':c.status==='running'?'active':'paid')}>{mstatus(c.status,locale==='ar')}</span><button className='btn btn-s btn-sm' onClick={() => { setCurrent(c); setShow(true); }}>{locale==='ar'?'تعديل':'Edit'}</button><button className='btn btn-p btn-sm' onClick={() => queue(c.id)}>{locale==='ar'?'تهيئة الرسائل':'Queue'}</button></div></div>) : <div className='empty'><h3>{locale==='ar'?'لا توجد حملات':'No campaigns yet'}</h3></div>}</div>{show && <CampaignModal bootstrap={bootstrap} current={current} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}</div>;
}

function AutomationsTab(){
  const { locale } = useI18n();
  const [rows, loading, load] = useMkt('/api/marketing/automations', []);
  const toggle = async (code, enabled) => { try { await api.put('/api/marketing/automations/' + code + '/toggle', { enabled: !enabled }); load(); } catch (e) { toast(e.message,'e'); } };
  const runNow = async (code) => { try { const r = await api.post('/api/marketing/automations/' + code + '/run', {}); toast((locale==='ar'?'تم تجهيز ':'Queued ') + (r.data?.queued || 0)); } catch (e) { toast(e.message,'e'); } };
  return <div className='pb'><div className='mkt-list'>{rows.length ? rows.map(a => <div className='mkt-row' key={a.code}><div><div className='mkt-row-title'>{locale==='ar'?a.name_ar:a.name}</div><div className='mkt-row-sub'>{a.code} • {(a.template_name || (locale==='ar'?'قالب افتراضي':'Default template'))}</div></div><div className='mkt-actions'><span className={'badge b-'+(a.enabled ? 'active' : 'inactive')}>{a.enabled ? (locale==='ar'?'مفعل':'Enabled') : (locale==='ar'?'معطل':'Disabled')}</span><button className='btn btn-s btn-sm' onClick={() => toggle(a.code, !!a.enabled)}>{a.enabled ? (locale==='ar'?'تعطيل':'Disable') : (locale==='ar'?'تفعيل':'Enable')}</button><button className='btn btn-p btn-sm' onClick={() => runNow(a.code)}>{locale==='ar'?'تشغيل الآن':'Run Now'}</button></div></div>) : <div className='empty'><h3>{locale==='ar'?'لا توجد أتمتة':'No automations'}</h3></div>}</div></div>;
}

function LogsTab(){
  const { locale } = useI18n();
  const [rows, loading, load] = useMkt('/api/marketing/logs', []);
  return <div className='pb'><div className='card' style={{padding:0,overflow:'hidden'}}><table><thead><tr><th>{locale==='ar'?'الوقت':'Time'}</th><th>{locale==='ar'?'الجهة':'Contact'}</th><th>{locale==='ar'?'الهاتف':'Phone'}</th><th>{locale==='ar'?'الحالة':'Status'}</th><th>{locale==='ar'?'الملاحظة':'Note'}</th></tr></thead><tbody>{rows.length ? rows.map((r, idx) => <tr key={idx}><td>{fdt(r.log_created_at || r.created_at)}</td><td>{r.full_name || '—'}</td><td>{r.phone}</td><td><span className={'badge b-'+(r.status==='sent'?'paid':r.status==='queued'?'pending':'cancelled')}>{mstatus(r.status,locale==='ar')}</span></td><td style={{fontSize:11}}>{r.note || r.error_message || '—'}</td></tr>) : <tr><td colSpan='5'><div className='empty'><h3>{locale==='ar'?'لا توجد سجلات':'No logs'}</h3></div></td></tr>}</tbody></table></div></div>;
}

function SettingsTab({ bootstrap, onRefresh }){
  const { locale } = useI18n();
  const [settings, setSettings] = useState({});
  useEffect(() => { api.get('/api/settings?module=marketing').then(r => { const map={}; (r.data || []).forEach(x => { map[x.key] = x.type === 'boolean' ? (x.value === 'true' || x.value === '1') : x.value; }); setSettings(map); }).catch(()=>{}); }, []);
  const s = (k, v) => setSettings(p => ({ ...p, [k]: v }));
  const save = async () => { try { await api.put('/api/settings', { settings }); toast(locale==='ar'?'تم حفظ الإعدادات':'Settings saved'); onRefresh && onRefresh(); } catch(e){ toast(e.message,'e'); } };
  return <div className='pb'><div className='card'><div className='ct'>{locale==='ar'?'إعدادات Wesender':'Wesender Settings'}</div><div className='fr'><div className='fg'><label>Base URL</label><input className='fi' value={settings['marketing.wesender_base_url'] || ''} onChange={e => s('marketing.wesender_base_url', e.target.value)} /></div><div className='fg'><label>Send Path</label><input className='fi' value={settings['marketing.wesender_send_path'] || '/api/send-message'} onChange={e => s('marketing.wesender_send_path', e.target.value)} /></div></div><div className='fr'><div className='fg'><label>Token</label><input className='fi' value={settings['marketing.wesender_token'] || ''} onChange={e => s('marketing.wesender_token', e.target.value)} /></div><div className='fg'><label>Session</label><input className='fi' value={settings['marketing.wesender_session'] || ''} onChange={e => s('marketing.wesender_session', e.target.value)} /></div></div><div className='fr'><div className='fg'><label>{locale==='ar'?'أيام تذكير الانتهاء':'Expiry Reminder Days'}</label><input className='fi' value={settings['marketing.expiry_reminder_days'] || '7'} onChange={e => s('marketing.expiry_reminder_days', e.target.value)} /></div><div className='fg'><label>{locale==='ar'?'أيام تذكير الدفع':'Payment Due Days'}</label><input className='fi' value={settings['marketing.payment_due_days'] || '3'} onChange={e => s('marketing.payment_due_days', e.target.value)} /></div></div><div className='fr'><div className='fg'><label>{locale==='ar'?'حد الإرسال اليومي':'Daily Send Limit'}</label><input className='fi' value={settings['marketing.daily_send_limit'] || '500'} onChange={e => s('marketing.daily_send_limit', e.target.value)} /></div><div className='fg'><label>{locale==='ar'?'رمز الدولة':'Country Code'}</label><input className='fi' value={settings['marketing.default_country_code'] || '962'} onChange={e => s('marketing.default_country_code', e.target.value)} /></div></div><div className='mkt-actions' style={{marginTop:12}}><button className='btn btn-p' onClick={save}>{locale==='ar'?'حفظ الإعدادات':'Save Settings'}</button></div></div></div>;
}

function SessionsTab(){
  const { locale } = useI18n();
  const [data, loading, load] = useMkt('/api/marketing/sessions/status', {});
  const [show, setShow] = useState(false);
  const [test, setTest] = useState({ phone:'', message:'' });
  const sendTest = async () => { try { await api.post('/api/marketing/test-send', test); toast(locale==='ar'?'تم الإرسال التجريبي':'Test sent'); setShow(false); } catch(e){ toast(e.error || e.message,'e'); } };
  return <div className='pb'><div className='card'><div className='ct'>{locale==='ar'?'جلسة واتساب':'WhatsApp Session'}</div><div className='mkt-list'><div className='mkt-row'><div><div className='mkt-row-title'>{data.provider || 'wesender'}</div><div className='mkt-row-sub'>{data.baseUrl || '—'}</div></div><span className={'badge b-'+(data.configured ? 'active' : 'cancelled')}>{data.configured ? (locale==='ar'?'مهيأ':'Configured') : (locale==='ar'?'غير مهيأ':'Not Configured')}</span></div><div className='mkt-row'><div><div className='mkt-row-title'>{locale==='ar'?'الجلسة':'Session'}</div><div className='mkt-row-sub'>{data.session || '—'}</div></div><button className='btn btn-p btn-sm' onClick={() => setShow(true)}>{locale==='ar'?'إرسال تجريبي':'Send Test'}</button></div></div></div>{show && <Modal title={locale==='ar'?'رسالة تجريبية':'Test Message'} onClose={() => setShow(false)}><div className='mdl-b'><div className='fg'><label>{locale==='ar'?'الهاتف':'Phone'}</label><input className='fi' value={test.phone} onChange={e => setTest(p => ({ ...p, phone: e.target.value }))} /></div><div className='fg'><label>{locale==='ar'?'النص':'Message'}</label><textarea className='fi' rows='5' value={test.message} onChange={e => setTest(p => ({ ...p, message: e.target.value }))} /></div></div><div className='mdl-f'><button className='btn btn-s' onClick={() => setShow(false)}>{locale==='ar'?'إلغاء':'Cancel'}</button><button className='btn btn-p' onClick={sendTest}>{locale==='ar'?'إرسال':'Send'}</button></div></Modal>}</div>;
}

function MarketingWorkspace(){
  const { t, locale } = useI18n();
  const [boot, loading, reloadBoot] = useMkt('/api/marketing/bootstrap', { currency:'JOD', stats:{}, segments:[], sessions:{} });
  const [tab, setTab] = useState('dashboard');
  const tabs = [
    ['dashboard','Dashboard','لوحة التحكم',<Ic name='bar-chart' size={14}/>],
    ['contacts','Contacts','جهات الاتصال',<Ic name='users' size={14}/>],
    ['segments','Segments','الشرائح',<Ic name='puzzle' size={14}/>],
    ['templates','Templates','القوالب',<Ic name='file-text' size={14}/>],
    ['campaigns','Campaigns','الحملات',<Ic name='megaphone' size={14}/>],
    ['automations','Automations','الأتمتة',<Ic name='settings' size={14}/>],
    ['logs','Logs','السجل',<Ic name='clipboard' size={14}/>],
    ['settings','Settings','الإعدادات',<Ic name='wrench' size={14}/>],
    ['sessions','Sessions','الجلسات',<Ic name='smartphone' size={14}/>]
  ];
  return <div>
    <div className='mkt-top-nav'>
      <div className='mkt-brand'><Ic name='message' size={16}/> {locale==='ar'?'التسويق':'Marketing'}</div>
      <div className='mkt-tabs'>{tabs.map(([k,en,ar,icon]) => <button key={k} className={'mkt-tab ' + (tab===k?'active':'')} onClick={() => setTab(k)}><span>{icon}</span><span>{locale==='ar'?ar:en}</span></button>)}</div>
      <div style={{display:'flex',alignItems:'center',padding:'0 14px',borderInlineStart:'1px solid var(--border)',flexShrink:0}}><span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:10,background:'var(--bg-3)',color:'var(--t2)'}}>{boot.currency || 'JOD'}</span></div>
    </div>
    <div className='ph'><h1>{locale==='ar'?'التسويق عبر واتساب':'WhatsApp Marketing'}</h1><p style={{color:'var(--t3)',fontSize:13}}>{locale==='ar'?'إدارة القوالب والحملات والتذكيرات والتقسيمات على نمط المشتريات والمحاسبة.':'Campaigns, templates, segments, and reminders in the same structured style as Purchase and Accounting.'}</p></div>
    {loading && tab==='dashboard' ? <div className='pb'><div className='pld'><span className='spinner'/></div></div> : null}
    {tab==='dashboard' && <DashboardTab bootstrap={boot} />}
    {tab==='contacts' && <ContactsTab />}
    {tab==='segments' && <SegmentsTab />}
    {tab==='templates' && <TemplatesTab />}
    {tab==='campaigns' && <CampaignsTab bootstrap={boot} />}
    {tab==='automations' && <AutomationsTab />}
    {tab==='logs' && <LogsTab />}
    {tab==='settings' && <SettingsTab bootstrap={boot} onRefresh={reloadBoot} />}
    {tab==='sessions' && <SessionsTab />}
  </div>;
}

GymOS.registerPage({ path:'/marketing', component:MarketingWorkspace, module:'marketing', label:'Marketing', labelAr:'التسويق', order:75 });

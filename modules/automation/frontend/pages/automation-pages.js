// ═══════════════════════════════════════════════════════════
// GymOS Automation — smart workflow / alert builder
// Admin creates rules: trigger (expiry before/on/after, inactive,
// birthday, weekly report) → channels (WhatsApp/SMS/Notification)
// → message template. A scheduler fires them; every run is logged.
// ═══════════════════════════════════════════════════════════
(function () {
  const { useState, useEffect, useCallback } = React;
  const { api, useI18n, Modal, Ic, toast } = shared;
  const T = (loc, ar, en) => (loc === 'ar' ? ar : en);

  const TRIGGERS = [
    { v: 'expiry_before', ar: 'قبل انتهاء الاشتراك', en: 'Before expiry', off: true, icon: 'clock' },
    { v: 'expiry_on', ar: 'عند انتهاء الاشتراك', en: 'On expiry', icon: 'calendar' },
    { v: 'expiry_after', ar: 'بعد انتهاء الاشتراك', en: 'After expiry', off: true, icon: 'refresh' },
    { v: 'inactive', ar: 'عضو غير نشط', en: 'Inactive member', off: true, icon: 'users' },
    { v: 'debt', ar: 'عليه دين / رصيد مستحق', en: 'Has outstanding debt', icon: 'dollar-sign' },
    { v: 'birthday', ar: 'عيد ميلاد', en: 'Birthday', icon: 'star' },
    { v: 'weekly_report', ar: 'تقرير أسبوعي للإدارة', en: 'Weekly admin report', week: true, admin: true, icon: 'bar-chart' },
  ];
  const trg = v => TRIGGERS.find(o => o.v === v) || {};
  const CHANNELS = [['whatsapp', 'واتساب', 'WhatsApp'], ['email', 'بريد إلكتروني', 'Email'], ['sms', 'SMS', 'SMS'], ['notif', 'إشعار', 'Notification']];
  const chLabel = (c, loc) => { const x = CHANNELS.find(o => o[0] === c); return x ? T(loc, x[1], x[2]) : c; };
  const WEEKDAYS = [['الأحد', 'Sun'], ['الاثنين', 'Mon'], ['الثلاثاء', 'Tue'], ['الأربعاء', 'Wed'], ['الخميس', 'Thu'], ['الجمعة', 'Fri'], ['السبت', 'Sat']];
  const REPORT_GROUPS = [
    ['الأعضاء والاشتراكات', 'Members & subscriptions', [
      ['active_members', 'الأعضاء النشطون', 'Active members'],
      ['new_members', 'أعضاء جدد (٧ أيام)', 'New members (7d)'],
      ['expiring', 'اشتراكات تنتهي هذا الأسبوع', 'Expiring this week'],
      ['expired', 'اشتراكات منتهية (٧ أيام)', 'Expired (7d)'],
      ['cancellations', 'اشتراكات ملغاة (٧ أيام)', 'Cancellations (7d)'],
      ['attendance', 'عدد الزيارات (٧ أيام)', 'Visits (7d)'],
    ]],
    ['المبيعات والكافتيريا', 'Sales & cafeteria', [
      ['revenue', 'إيراد الاشتراكات (٧ أيام)', 'Membership revenue (7d)'],
      ['cafeteria', 'مبيعات الكافتيريا (٧ أيام)', 'Cafeteria sales (7d)'],
      ['cafeteria_orders', 'عدد الطلبات (٧ أيام)', 'Orders (7d)'],
      ['cafeteria_profit', 'ربح الكافتيريا (٧ أيام)', 'Cafeteria profit (7d)'],
    ]],
    ['المخزون', 'Inventory', [
      ['low_stock', 'أصناف قاربت على النفاد', 'Low stock items'],
      ['out_of_stock', 'أصناف نفدت من المخزون', 'Out-of-stock items'],
      ['stock_value', 'قيمة المخزون الحالية', 'Current stock value'],
    ]],
    ['المالية', 'Finance', [
      ['unpaid_invoices', 'فواتير عملاء غير مسددة', 'Unpaid customer invoices'],
      ['receivables', 'ذمم مدينة مستحقة', 'Accounts receivable'],
      ['payables', 'ذمم دائنة للموردين', 'Accounts payable'],
      ['debts', 'إجمالي الديون المستحقة', 'Total outstanding debts'],
    ]],
    ['الموارد البشرية', 'HR', [
      ['pending_leaves', 'طلبات إجازة معلّقة', 'Pending leave requests'],
    ]],
  ];
  const parseArr = c => { try { const v = JSON.parse(c || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const parseCh = parseArr;

  function useLoad(url, deps = [], fb = []) {
    const [data, setData] = useState(fb); const [loading, setLoading] = useState(true);
    const reload = useCallback(() => { let live = true; setLoading(true); api.get(url).then(r => { if (live) setData(r.data ?? fb); }).catch(() => { if (live) setData(fb); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [url]);
    useEffect(() => reload(), [...deps]);
    return [data, loading, reload];
  }

  function triggerSummary(r, loc) {
    const t = trg(r.trigger);
    if (r.trigger === 'weekly_report') return T(loc, 'كل ' + (WEEKDAYS[r.run_weekday] ? WEEKDAYS[r.run_weekday][0] : ''), 'Every ' + (WEEKDAYS[r.run_weekday] ? WEEKDAYS[r.run_weekday][1] : ''));
    if (t.off) return T(loc, `${triggerLabel(r.trigger, loc)} بـ ${r.offset_days} يوم`, `${triggerLabel(r.trigger, loc)} · ${r.offset_days} days`);
    return triggerLabel(r.trigger, loc);
  }
  const triggerLabel = (v, loc) => { const x = trg(v); return x.v ? T(loc, x.ar, x.en) : v; };

  // ── Overview ──
  function Overview() {
    const { locale: loc } = useI18n();
    const [d] = useLoad('/api/automation/overview', [], {});
    const cards = [
      [d.activeRules, T(loc, 'قواعد نشطة', 'Active rules')],
      [d.rules, T(loc, 'إجمالي القواعد', 'Total rules')],
      [d.sent7, T(loc, 'رسائل مُرسلة (٧ أيام)', 'Sent (7d)')],
      [d.failed7, T(loc, 'فشل الإرسال (٧ أيام)', 'Failed (7d)')],
    ];
    return (
      <div>
        <div className='au-stats'>{cards.map(([n, l], i) => <div className='au-stat' key={i}><div className='n'>{n ?? 0}</div><div className='l'>{l}</div></div>)}</div>
        <div className='card' style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.8 }}>
            {T(loc,
              'أنشئ قواعد أتمتة ذكية: اختر متى تُنفَّذ (قبل/عند/بعد انتهاء الاشتراك، عضو غير نشط، عيد ميلاد، أو تقرير أسبوعي) واختر قنوات الإرسال (واتساب / SMS / إشعار) والرسالة. يعمل المُجدوِل تلقائياً كل ساعة ويسجّل كل عملية.',
              'Create smart automation rules: choose when they run (before/on/after subscription expiry, inactive member, birthday, or weekly report), pick the delivery channels (WhatsApp / SMS / Notification) and the message. The scheduler runs hourly and logs every action.')}
          </p>
        </div>
      </div>
    );
  }

  // ── Rule editor — Odoo sheet form ──
  const FieldChips = ({ items, selected, onToggle, iconFor }) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map(([c, ar, en]) => { const on = selected.includes(c); return (
        <button type='button' key={c} onClick={() => onToggle(c)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1.5px solid ' + (on ? 'var(--o-brand)' : 'var(--b)'), background: on ? 'var(--o-brand-soft)' : 'var(--bg-view)', color: on ? 'var(--o-brand)' : 'var(--t2)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          {iconFor && <Ic name={iconFor(c)} size={13} />}{on ? <Ic name='check' size={13} /> : null}{c && arLabel(c, ar, en)}
        </button>
      ); })}
    </div>
  );
  const arLabel = (c, ar, en) => ar; // helper kept for readability

  function RuleForm({ rule, onClose, onSaved }) {
    const { locale: loc } = useI18n();
    const [f, setF] = useState(() => ({
      name_ar: rule?.name_ar || '', name: rule?.name || '', trigger: rule?.trigger || 'expiry_before',
      offset_days: rule?.offset_days ?? 7, run_weekday: rule?.run_weekday ?? 6,
      recipient: rule?.recipient || 'member', channels: rule?.channels ? parseArr(rule.channels) : ['whatsapp'],
      report_sections: rule?.report_sections ? parseArr(rule.report_sections) : ['active_members', 'expiring', 'revenue'],
      template_ar: rule?.template_ar || '', template: rule?.template || '', is_active: rule ? rule.is_active !== 0 : true,
    }));
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setF(p => ({ ...p, [k]: v }));
    const t = trg(f.trigger);
    const toggle = (key, c) => setF(p => ({ ...p, [key]: p[key].includes(c) ? p[key].filter(x => x !== c) : [...p[key], c] }));
    const save = async () => {
      if (!f.name_ar && !f.name) { toast(T(loc, 'أدخل اسم القاعدة', 'Enter a rule name'), 'e'); return; }
      if (!f.channels.length) { toast(T(loc, 'اختر قناة إرسال واحدة على الأقل', 'Pick at least one channel'), 'e'); return; }
      setSaving(true);
      try {
        const body = { ...f, recipient: t.admin ? 'admin' : 'member' };
        if (rule?.id) await api.put('/api/automation/rules/' + rule.id, body); else await api.post('/api/automation/rules', body);
        toast(T(loc, 'تم الحفظ', 'Saved')); onSaved();
      } catch (e) { toast(e.message || 'Failed', 'e'); setSaving(false); }
    };
    const vars = t.admin ? '{company}' : (f.trigger === 'debt' ? '{name} · {member_no} · {amount} · {company}' : '{name} · {member_no} · {days} · {end_date} · {plan} · {company} · {pwa_link}');
    const chIcon = c => (c === 'whatsapp' ? 'message' : c === 'email' ? 'mail' : c === 'sms' ? 'smartphone' : 'bell');
    const group = { fontSize: 13, fontWeight: 600, display: 'block', margin: '18px 0 8px', color: 'var(--t1)' };
    return (
      <div className='o-form-shell'>
        <div className='o-form-sheet'>
          <div className='o-form-sheet-header'>
            <div><h1>{rule?.id ? T(loc, 'تعديل قاعدة أتمتة', 'Edit automation rule') : T(loc, 'قاعدة أتمتة جديدة', 'New automation rule')}</h1><p>{T(loc, 'اختر المُشغِّل والقنوات والرسالة', 'Choose the trigger, channels, and message')}</p></div>
            <div className='acts'>
              <button className='btn btn-p' onClick={save} disabled={saving}>{saving ? '...' : T(loc, 'حفظ', 'Save')}</button>
              <button className='btn btn-s' onClick={onClose} disabled={saving}>{T(loc, 'تجاهل', 'Discard')}</button>
            </div>
          </div>
          <div className='o-sheet-inner'>
            <div className='o-member-form-grid'>
              <div className='fg'><label>{T(loc, 'اسم القاعدة', 'Rule name')}</label><input className='fi' value={f.name_ar} onChange={e => set('name_ar', e.target.value)} /></div>
              <div className='fg'><label>{T(loc, 'الحالة', 'Status')}</label><select className='fi' value={f.is_active ? '1' : '0'} onChange={e => set('is_active', e.target.value === '1')}><option value='1'>{T(loc, 'نشطة', 'Active')}</option><option value='0'>{T(loc, 'موقوفة', 'Paused')}</option></select></div>
              <div className='fg'><label>{T(loc, 'المُشغِّل — متى تُنفَّذ', 'Trigger — when it runs')}</label><select className='fi' value={f.trigger} onChange={e => set('trigger', e.target.value)}>{TRIGGERS.map(o => <option key={o.v} value={o.v}>{T(loc, o.ar, o.en)}</option>)}</select></div>
              {t.off && <div className='fg'><label>{T(loc, 'عدد الأيام (N)', 'Days (N)')}</label><input className='fi' type='number' value={f.offset_days} onChange={e => set('offset_days', e.target.value)} /></div>}
              {t.week && <div className='fg'><label>{T(loc, 'يوم الإرسال', 'Send on')}</label><select className='fi' value={f.run_weekday} onChange={e => set('run_weekday', Number(e.target.value))}>{WEEKDAYS.map((w, i) => <option key={i} value={i}>{T(loc, w[0], w[1])}</option>)}</select></div>}
              {t.admin && <div className='fg'><label>{T(loc, 'المستلِم', 'Recipient')}</label><input className='fi' value={T(loc, 'الإدارة (رقم في الإعدادات)', 'Admin (phone in Settings)')} disabled /></div>}
            </div>

            <label style={group}>{T(loc, 'قنوات الإرسال — يمكن اختيار أكثر من واحدة', 'Channels — choose one or more')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CHANNELS.map(([c, ar, en]) => { const on = f.channels.includes(c); return (
                <button type='button' key={c} onClick={() => toggle('channels', c)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid ' + (on ? 'var(--o-brand)' : 'var(--b)'), background: on ? 'var(--o-brand-soft)' : 'var(--bg-view)', color: on ? 'var(--o-brand)' : 'var(--t2)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Ic name={chIcon(c)} size={14} />{T(loc, ar, en)}{on ? <Ic name='check' size={13} /> : null}
                </button>
              ); })}
            </div>

            {t.admin && <>
              <label style={group}>{T(loc, 'محتوى التقرير — اختر البنود المطلوبة', 'Report content — pick what to include')}</label>
              {REPORT_GROUPS.map(([gAr, gEn, items], gi) => (
                <div key={gi} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t3)', margin: '4px 0 6px' }}>{T(loc, gAr, gEn)}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {items.map(([c, ar, en]) => { const on = f.report_sections.includes(c); return (
                      <button type='button' key={c} onClick={() => toggle('report_sections', c)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1.5px solid ' + (on ? 'var(--o-brand)' : 'var(--b)'), background: on ? 'var(--o-brand-soft)' : 'var(--bg-view)', color: on ? 'var(--o-brand)' : 'var(--t2)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                        {on ? <Ic name='check' size={13} /> : <Ic name='plus' size={13} />}{T(loc, ar, en)}
                      </button>
                    ); })}
                  </div>
                </div>
              ))}
            </>}

            <label style={group}>{t.admin ? T(loc, 'مقدمة التقرير', 'Report header') : T(loc, 'نص الرسالة', 'Message template')}</label>
            <textarea className='fi' rows={t.admin ? '3' : '6'} value={f.template_ar} onChange={e => set('template_ar', e.target.value)} style={{ resize: 'vertical', width: '100%' }} />
            <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, direction: 'ltr', textAlign: 'left' }}>{T(loc, 'المتغيرات: ', 'Variables: ')}{vars}</p>
            {t.admin && <p style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 6 }}>{T(loc, 'يُبنى التقرير تلقائياً من البنود المختارة أعلاه ويُرسَل إلى رقم الإدارة عبر واتساب.', 'The report is auto-built from the selected sections and sent to the admin phone via WhatsApp.')}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Rules list ──
  function Rules() {
    const { locale: loc } = useI18n();
    const [rules, loading, reload] = useLoad('/api/automation/rules', [], []);
    const [edit, setEdit] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const toggle = async (r) => { try { await api.put('/api/automation/rules/' + r.id, { ...r, channels: parseCh(r.channels), is_active: r.is_active ? false : true }); reload(); } catch (e) { toast(e.message, 'e'); } };
    const runNow = async (r) => { setBusyId(r.id); try { const res = await api.post('/api/automation/rules/' + r.id + '/run', {}); toast(T(loc, `تم التنفيذ — ${res.data.processed} عضو`, `Ran — ${res.data.processed} members`)); } catch (e) { toast(e.message, 'e'); } setBusyId(null); };
    const del = async (r) => { if (!window.confirm(T(loc, 'حذف هذه القاعدة؟', 'Delete this rule?'))) return; try { await api.delete('/api/automation/rules/' + r.id); reload(); } catch (e) { toast(e.message, 'e'); } };
    if (edit !== null) return <RuleForm rule={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>{rules.length} {T(loc, 'قاعدة', 'rules')}</div>
          <button className='btn btn-p' onClick={() => setEdit({})}><Ic name='plus' size={14} /> {T(loc, 'قاعدة جديدة', 'New rule')}</button>
        </div>
        {loading ? <div className='empty'><h3>...</h3></div> : !rules.length ? <div className='empty'><h3>{T(loc, 'لا توجد قواعد', 'No rules')}</h3></div> :
          rules.map(r => (
            <div className='au-rule' key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
              <div className='au-rule-ic'><Ic name={trg(r.trigger).icon || 'puzzle'} size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--t1)' }}>{loc === 'ar' ? r.name_ar || r.name : r.name || r.name_ar}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{triggerSummary(r, loc)}{r.recipient === 'admin' ? ' · ' + T(loc, 'إلى الإدارة', 'to admin') : ''}{r.last_run_at ? ' · ' + T(loc, 'آخر تنفيذ ', 'last run ') + String(r.last_run_at).slice(0, 10) : ''}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{parseCh(r.channels).map(c => <span className={'au-chip ' + c} key={c}>{chLabel(c, loc)}</span>)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className='btn btn-s btn-sm' onClick={() => runNow(r)} disabled={busyId === r.id} title={T(loc, 'تنفيذ الآن', 'Run now')}><Ic name='refresh' size={13} /></button>
                <button className='btn btn-s btn-sm' onClick={() => setEdit(r)}><Ic name='edit' size={13} /></button>
                <button className='btn btn-s btn-sm' onClick={() => del(r)}><Ic name='x' size={13} /></button>
                <button className='au-sw' onClick={() => toggle(r)} style={{ background: r.is_active ? 'var(--o-brand)' : 'var(--bg-3)' }}><span className='k' style={{ insetInlineStart: r.is_active ? 21 : 3 }} /></button>
              </div>
            </div>
          ))}
      </div>
    );
  }

  // ── Log ──
  function LogPanel() {
    const { locale: loc, formatDateTime } = useI18n();
    const [log, loading, reload] = useLoad('/api/automation/log', [], []);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
          <button className='btn btn-s' onClick={async () => { if (!confirm(T(loc, 'مسح الإدخالات الفاشلة فقط؟ ستُعاد المحاولة في التشغيل التالي.', 'Clear failed entries only? They will be retried on the next run.'))) return; try { await api.del('/api/automation/log?failed=1'); toast(T(loc, 'تم مسح الفاشلة', 'Failed entries cleared')); reload(); } catch (e) { toast(e.message, 'e'); } }}><Ic name='refresh' size={13} /> {T(loc, 'مسح الفاشلة', 'Clear failed')}</button>
          <button className='btn btn-s' onClick={async () => { if (!confirm(T(loc, 'مسح كامل السجل؟ سيسمح هذا بإعادة الإرسال في التشغيل التالي.', 'Clear the whole log? This lets rules re-send on the next run.'))) return; try { await api.del('/api/automation/log'); toast(T(loc, 'تم مسح السجل', 'Log cleared')); reload(); } catch (e) { toast(e.message, 'e'); } }}><Ic name='trash' size={13} /> {T(loc, 'مسح السجل', 'Clear log')}</button>
          <button className='btn btn-s' onClick={reload}><Ic name='refresh' size={13} /> {T(loc, 'تحديث', 'Refresh')}</button>
        </div>
        <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
          <table><thead><tr><th>{T(loc, 'القاعدة', 'Rule')}</th><th>{T(loc, 'العضو', 'Member')}</th><th>{T(loc, 'القناة', 'Channel')}</th><th>{T(loc, 'الحالة', 'Status')}</th><th>{T(loc, 'التفاصيل', 'Detail')}</th><th>{T(loc, 'الوقت', 'Time')}</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6}><div className='empty'><h3>...</h3></div></td></tr>
                : !log.length ? <tr><td colSpan={6}><div className='empty'><h3>{T(loc, 'لا يوجد سجل بعد', 'No log yet')}</h3></div></td></tr>
                  : log.map(e => <tr key={e.id}>
                    <td>{e.rule_name || '#' + e.rule_id}</td>
                    <td>{e.member_name || '—'}</td>
                    <td><span className={'au-chip ' + e.channel}>{chLabel(e.channel, loc) || e.channel}</span></td>
                    <td><span className={'badge b-' + (e.status === 'sent' ? 'active' : e.status === 'failed' ? 'inactive' : 'unknown')}>{e.status === 'sent' ? T(loc, 'مُرسلة', 'Sent') : e.status === 'failed' ? T(loc, 'فشل', 'Failed') : e.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--t3)' }}>{e.detail || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--t3)' }}>{e.created_at ? formatDateTime(e.created_at) : '—'}</td>
                  </tr>)}
            </tbody></table>
        </div>
      </div>
    );
  }

  // ── Settings ──
  function SettingsPanel() {
    const { locale: loc } = useI18n();
    const [d, loading, reload] = useLoad('/api/automation/settings', [], {});
    const [f, setF] = useState(null);
    const [busy, setBusy] = useState(false);
    const [running, setRunning] = useState(false);
    const [testTo, setTestTo] = useState('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    useEffect(() => { if (d && !loading) setF({
      admin_phone: d.admin_phone || '', admin_email: d.admin_email || '',
      email_enabled: !!d.email_enabled, email_smtp_host: d.email_smtp_host || '', email_smtp_port: d.email_smtp_port || 587,
      email_smtp_secure: !!d.email_smtp_secure, email_smtp_user: d.email_smtp_user || '', email_smtp_pass: '',
      email_from_email: d.email_from_email || '', email_from_name: d.email_from_name || '',
    }); }, [d, loading]);
    if (!f) return <div className='empty'><h3>...</h3></div>;
    const set = (k, v) => setF(p => ({ ...p, [k]: v }));
    const save = async () => { setBusy(true); try { const body = { ...f }; if (!body.email_smtp_pass) delete body.email_smtp_pass; await api.put('/api/automation/settings', body); toast(T(loc, 'تم الحفظ', 'Saved')); reload(); } catch (e) { toast(e.message, 'e'); } setBusy(false); };
    const runNow = async () => { setRunning(true); try { await api.post('/api/automation/run-now', {}); toast(T(loc, 'تم تشغيل جميع القواعد النشطة', 'Ran all active rules')); } catch (e) { toast(e.message, 'e'); } setRunning(false); };
    const sendTestEmail = async () => { const to = testTo.trim() || f.admin_email.trim(); if (!to) { toast(T(loc, 'أدخل بريداً إلكترونياً', 'Enter an email'), 'e'); return; } setTesting(true); setTestResult(null); try { const r = await api.post('/api/automation/test-email', { to }); const rd = r.data || {}; setTestResult({ ...rd, to }); if (rd.ok) toast(T(loc, 'تم إرسال بريد تجريبي', 'Test email sent')); else toast(T(loc, 'فشل الاختبار', 'Test failed'), 'e'); } catch (e) { setTestResult({ ok: false, error: e.message }); toast(e.message, 'e'); } setTesting(false); };
    const dot = ok => <span style={{ width: 9, height: 9, borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', flexShrink: 0 }} />;
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <div className='card' style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{dot(d.gateway_configured)}<span style={{ fontSize: 13, fontWeight: 600 }}>{T(loc, 'واتساب', 'WhatsApp')}</span></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{dot(d.email_configured)}<span style={{ fontSize: 13, fontWeight: 600 }}>{T(loc, 'البريد الإلكتروني', 'Email')}</span></span>
        </div>

        <div className='card' style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{T(loc, 'مستلِم التقارير (الإدارة)', 'Report recipient (admin)')}</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>{T(loc, 'إلى أين تُرسل التقارير الأسبوعية.', 'Where weekly reports are delivered.')}</p>
          <div className='fr'>
            <div className='fg'><label>{T(loc, 'رقم واتساب', 'WhatsApp number')}</label><input className='fi' value={f.admin_phone} onChange={e => set('admin_phone', e.target.value)} placeholder='07XXXXXXXX' dir='ltr' /></div>
            <div className='fg'><label>{T(loc, 'البريد الإلكتروني', 'Email address')}</label><input className='fi' value={f.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder='admin@gym.com' dir='ltr' /></div>
          </div>
        </div>

        <div className='card' style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>{T(loc, 'مزوّد البريد الإلكتروني (SMTP)', 'Email provider (SMTP)')}</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}><input type='checkbox' checked={f.email_enabled} onChange={e => set('email_enabled', e.target.checked)} />{T(loc, 'مفعّل', 'Enabled')}</label>
          </div>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>{T(loc, 'يعمل مع Gmail و Outlook وأي خادم SMTP. يُستخدم في كل النظام (التقارير، التسويق، رسائل الأعضاء).', 'Works with Gmail, Outlook, or any SMTP host. Used system-wide (reports, marketing, member messages).')}</p>
          <div className='fr'>
            <div className='fg'><label>{T(loc, 'خادم SMTP', 'SMTP host')}</label><input className='fi' value={f.email_smtp_host} onChange={e => set('email_smtp_host', e.target.value)} placeholder='smtp.gmail.com' dir='ltr' /></div>
            <div className='fg'><label>{T(loc, 'المنفذ', 'Port')}</label><input className='fi' type='number' value={f.email_smtp_port} onChange={e => set('email_smtp_port', e.target.value)} placeholder='587' dir='ltr' /></div>
            <div className='fg'><label>{T(loc, 'اسم المستخدم', 'Username')}</label><input className='fi' value={f.email_smtp_user} onChange={e => set('email_smtp_user', e.target.value)} dir='ltr' autoComplete='off' name='smtp_user_field' /></div>
            <div className='fg'><label>{T(loc, 'كلمة المرور', 'Password')}</label><input className='fi' type='password' value={f.email_smtp_pass} onChange={e => set('email_smtp_pass', e.target.value)} placeholder={d.email_smtp_pass_set ? '••••••••' : ''} dir='ltr' autoComplete='new-password' name='smtp_pass_field' />{d.email_smtp_pass_set && <span style={{ fontSize: 11, color: '#166534', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><Ic name='check' size={12} />{T(loc, 'كلمة المرور محفوظة — اتركها فارغة للإبقاء عليها', 'Password saved — leave blank to keep it')}</span>}</div>
            <div className='fg'><label>{T(loc, 'بريد المُرسِل', 'From email')}</label><input className='fi' value={f.email_from_email} onChange={e => set('email_from_email', e.target.value)} placeholder='no-reply@gym.com' dir='ltr' /></div>
            <div className='fg'><label>{T(loc, 'اسم المُرسِل', 'From name')}</label><input className='fi' value={f.email_from_name} onChange={e => set('email_from_name', e.target.value)} /></div>
            <div className='fg'><label>{T(loc, 'اتصال آمن (SSL)', 'Secure (SSL)')}</label><select className='fi' value={f.email_smtp_secure ? '1' : '0'} onChange={e => set('email_smtp_secure', e.target.value === '1')}><option value='0'>{T(loc, 'TLS (587)', 'TLS (587)')}</option><option value='1'>{T(loc, 'SSL (465)', 'SSL (465)')}</option></select></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
            <div className='fg' style={{ flex: 1, minWidth: 180, marginBottom: 0 }}><label>{T(loc, 'إرسال بريد تجريبي إلى', 'Send test email to')}</label><input className='fi' value={testTo} onChange={e => setTestTo(e.target.value)} placeholder={f.admin_email || 'you@email.com'} dir='ltr' /></div>
            <button className='btn btn-s' onClick={sendTestEmail} disabled={testing}><Ic name='mail' size={14} /> {testing ? '...' : T(loc, 'اختبار', 'Test')}</button>
          </div>
          {testResult && (testResult.ok
            ? <div style={{ marginTop: 12, padding: '11px 13px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><Ic name='check' size={15} /><span>{T(loc, 'قبِل خادم البريد الرسالة إلى ', 'Mail server accepted the message to ')}<b dir='ltr'>{testResult.to}</b></span></div><div style={{ marginTop: 6, fontWeight: 400, color: '#3f6212', lineHeight: 1.7 }}>{T(loc, 'القبول لا يعني الوصول. تحقق من صندوق الوارد والبريد المزعج، ومن سجل الإرسال لدى المزوّد (Brevo ← Transactional ← Logs). ملاحظة: بريد المُرسِل من نوع gmail.com قد يُحظر ما لم يكن موثّقاً لدى المزوّد.', 'Accepted ≠ delivered. Check the inbox and spam, and your provider\'s delivery log (Brevo → Transactional → Logs). Note: a gmail.com "from" address may be blocked unless verified with the provider.')}</div></div>
            : <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><Ic name='x' size={15} />{T(loc, 'فشل إرسال البريد', 'Email failed')}{testResult.code ? <span style={{ fontWeight: 400, opacity: .75, fontFamily: 'monospace', fontSize: 12 }}>({testResult.code})</span> : null}</div>
                {testResult.error && <div dir='ltr' style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12, opacity: .85, wordBreak: 'break-word', textAlign: 'left' }}>{testResult.error}</div>}
                {(loc === 'ar' ? testResult.hintAr : testResult.hint) && <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #fecaca', color: '#7f1d1d', lineHeight: 1.7 }}><b>{T(loc, 'الحل: ', 'How to fix: ')}</b>{loc === 'ar' ? testResult.hintAr : testResult.hint}</div>}
              </div>)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className='btn btn-p' onClick={save} disabled={busy}>{busy ? '...' : T(loc, 'حفظ الإعدادات', 'Save settings')}</button></div>

        <div className='card' style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{T(loc, 'تشغيل يدوي', 'Manual run')}</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>{T(loc, 'شغّل جميع القواعد النشطة الآن (يعمل المُجدوِل تلقائياً كل ساعة).', 'Run all active rules now (the scheduler runs hourly automatically).')}</p>
          <button className='btn btn-s' onClick={runNow} disabled={running}><Ic name='refresh' size={14} /> {running ? '...' : T(loc, 'تشغيل الآن', 'Run now')}</button>
        </div>
      </div>
    );
  }

  // ── Workspace ──
  function AutomationWorkspace() {
    const { locale: loc } = useI18n();
    const [tab, setTab] = useState('overview');
    const tabs = [
      ['overview', 'نظرة عامة', 'Overview', <Ic name='grid' size={16} />],
      ['rules', 'القواعد', 'Rules', <Ic name='puzzle' size={16} />],
      ['log', 'السجل', 'Log', <Ic name='clipboard' size={16} />],
      ['settings', 'الإعدادات', 'Settings', <Ic name='settings' size={16} />],
    ];
    const cur = tabs.find(t => t[0] === tab);
    return (
      <div>
        <div className='au-top-nav'>
          <div className='au-brand'><Ic name='puzzle' size={18} /> {T(loc, 'الأتمتة والتنبيهات', 'Automation')}</div>
          <div className='au-tabs'>{tabs.map(([k, ar, en, icon]) => <button key={k} className={`au-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}><span>{icon}</span><span>{T(loc, ar, en)}</span></button>)}</div>
        </div>
        <div className='ph'><h1>{T(loc, cur?.[1], cur?.[2])}</h1><p style={{ color: 'var(--t3)', fontSize: 13 }}>{T(loc, 'أتمتة سير العمل — تنبيهات وإجراءات ذكية عبر واتساب و SMS والإشعارات.', 'Workflow automation — smart alerts and actions via WhatsApp, SMS, and notifications.')}</p></div>
        <div className='pb'>
          {tab === 'overview' && <Overview />}
          {tab === 'rules' && <Rules />}
          {tab === 'log' && <LogPanel />}
          {tab === 'settings' && <SettingsPanel />}
        </div>
      </div>
    );
  }

  GymOS.registerPage({ path: '/automation', component: AutomationWorkspace, module: 'automation', label: 'Automation', labelAr: 'الأتمتة والتنبيهات', order: 55 });
})();

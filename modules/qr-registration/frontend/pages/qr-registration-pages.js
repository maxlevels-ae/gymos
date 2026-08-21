const { api, useI18n, Ic, toast, Modal } = window.GymOS.shared;
const { useEffect, useMemo, useState } = React;

function QrStatusBadge(props) {
  const map = {
    pending: { en: 'Pending', ar: 'قيد الانتظار', cls: 'b-draft' },
    approved: { en: 'Approved', ar: 'تمت الموافقة', cls: 'b-active' },
    rejected: { en: 'Rejected', ar: 'مرفوض', cls: 'b-cancelled' }
  };
  const item = map[props.value] || { en: props.value || '—', ar: props.value || '—', cls: 'b-draft' };
  return <span className={'badge ' + item.cls}>{props.locale === 'ar' ? item.ar : item.en}</span>;
}

function QrRegistrationsPage() {
  const i18n = useI18n();
  const locale = i18n.locale;
  const isAr = locale === 'ar';
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [filters, setFilters] = useState({ status: 'pending', search: '' });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load(page) {
    const targetPage = page || meta.page || 1;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(targetPage));
      q.set('limit', String(meta.limit || 20));
      if (filters.status) q.set('status', filters.status);
      if (filters.search) q.set('search', filters.search);
      const res = await api.get('/api/qr-register?' + q.toString());
      setRows(res.data || []);
      setMeta(res.meta || { total: 0, page: 1, limit: 20 });
    } catch (err) {
      toast(err.message, 'e');
    }
    try {
      const countRes = await api.get('/api/qr-register/pending-count');
      setPendingCount((countRes.data && countRes.data.count) || 0);
    } catch (_) {}
    setLoading(false);
  }

  useEffect(function () { load(1); }, [filters.status]);

  const stats = useMemo(function () {
    let approved = 0, rejected = 0, pending = 0;
    rows.forEach(function (r) {
      if (r.status === 'approved') approved += 1;
      else if (r.status === 'rejected') rejected += 1;
      else if (r.status === 'pending') pending += 1;
    });
    return { approved: approved, rejected: rejected, pending: pending };
  }, [rows]);

  async function openDetails(row) {
    try {
      const res = await api.get('/api/qr-register/' + row.id);
      setSelected(res.data || row);
      setRejectReason('');
    } catch (err) {
      toast(err.message, 'e');
    }
  }

  async function approve() {
    if (!selected || !selected.id) return;
    setBusy(true);
    try {
      const res = await api.post('/api/qr-register/' + selected.id + '/approve', {});
      const whatsapp = res.data && res.data.whatsapp;
      toast(whatsapp && whatsapp.success ? (isAr ? 'تمت الموافقة وإرسال رسالة القبول' : 'Approved and completion WhatsApp sent') : (isAr ? 'تمت الموافقة' : 'Approved'));
      setSelected(null);
      await load(meta.page || 1);
    } catch (err) {
      toast(err.message, 'e');
    }
    setBusy(false);
  }

  async function reject() {
    if (!selected || !selected.id) return;
    setBusy(true);
    try {
      await api.post('/api/qr-register/' + selected.id + '/reject', { reason: rejectReason });
      toast(isAr ? 'تم رفض الطلب' : 'Request rejected');
      setSelected(null);
      await load(meta.page || 1);
    } catch (err) {
      toast(err.message, 'e');
    }
    setBusy(false);
  }

  return <div>
    <div className="ph">
      <h1>{isAr ? 'تسجيلات QR' : 'QR Registrations'}</h1>
      <p>{isAr ? 'الطلب يبدأ من QR، ثم رسالة واتساب فورية، ثم موافقة الإدارة، وبعدها رسالة اكتمال مع رابط التطبيق.' : 'Request starts from QR, then instant WhatsApp acknowledgement, then admin approval, then completion WhatsApp with app link.'}</p>
    </div>
    <div className="pb" style={{ display: 'grid', gap: 14 }}>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <div className="card"><div className="ct">{isAr ? 'قيد الانتظار' : 'Pending'}</div><div style={{ fontSize: 28, fontWeight: 800 }}>{pendingCount}</div></div>
        <div className="card"><div className="ct">{isAr ? 'ضمن الصفحة الحالية' : 'Current Page'}</div><div style={{ fontSize: 28, fontWeight: 800 }}>{stats.pending}</div></div>
        <div className="card"><div className="ct">{isAr ? 'موافق عليه' : 'Approved'}</div><div style={{ fontSize: 28, fontWeight: 800 }}>{stats.approved}</div></div>
        <div className="card"><div className="ct">{isAr ? 'مرفوض' : 'Rejected'}</div><div style={{ fontSize: 28, fontWeight: 800 }}>{stats.rejected}</div></div>
      </div>

      <div className="card">
        <div className="fr" style={{ alignItems: 'end' }}>
          <div className="fg" style={{ minWidth: 220 }}>
            <label>{isAr ? 'بحث' : 'Search'}</label>
            <input className="fi" value={filters.search} onChange={function (e) { setFilters(function (p) { return { status: p.status, search: e.target.value }; }); }} placeholder={isAr ? 'اسم، هاتف، هدف...' : 'Name, phone, goal...'} />
          </div>
          <div className="fg" style={{ minWidth: 180 }}>
            <label>{isAr ? 'الحالة' : 'Status'}</label>
            <select className="fi" value={filters.status} onChange={function (e) { setFilters(function (p) { return { status: e.target.value, search: p.search }; }); }}>
              <option value="pending">{isAr ? 'قيد الانتظار' : 'Pending'}</option>
              <option value="approved">{isAr ? 'تمت الموافقة' : 'Approved'}</option>
              <option value="rejected">{isAr ? 'مرفوض' : 'Rejected'}</option>
              <option value="">{isAr ? 'الكل' : 'All'}</option>
            </select>
          </div>
          <button className="btn btn-p" style={{ width: 'auto' }} onClick={function () { load(1); }}><Ic name="refresh" size={16} /> {isAr ? 'تحديث' : 'Refresh'}</button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="pld"><span className="spinner" /></div> : rows.length ? (
          <table>
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'الهاتف' : 'Phone'}</th>
                <th>{isAr ? 'الهدف' : 'Goal'}</th>
                <th>{isAr ? 'الباقة المفضلة' : 'Preferred Plan'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'تاريخ الطلب' : 'Created'}</th>
                <th>{isAr ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(function (row) { return <tr key={row.id}>
                <td>{row.full_name || '—'}</td>
                <td>{row.phone || '—'}</td>
                <td>{row.goal || '—'}</td>
                <td>{row.preferred_plan || '—'}</td>
                <td><QrStatusBadge value={row.status} locale={locale} /></td>
                <td>{String(row.created_at || '').replace('T', ' ').slice(0, 16) || '—'}</td>
                <td><button className="btn btn-s btn-sm" onClick={function () { openDetails(row); }}>{isAr ? 'عرض' : 'View'}</button></td>
              </tr>; })}
            </tbody>
          </table>
        ) : <div className="empty"><h3>{isAr ? 'لا توجد بيانات' : 'No data'}</h3></div>}
      </div>
    </div>

    {selected ? <Modal title={isAr ? 'تفاصيل الطلب' : 'Request Details'} onClose={function () { setSelected(null); }}>
      <div className="mdl-b" style={{ display: 'grid', gap: 14 }}>
        <div className="dg">
          <div className="di"><div className="dl">{isAr ? 'الاسم الكامل' : 'Full Name'}</div><div className="dv">{selected.full_name || '—'}</div></div>
          <div className="di"><div className="dl">{isAr ? 'الهاتف' : 'Phone'}</div><div className="dv">{selected.phone || '—'}</div></div>
          <div className="di"><div className="dl">{isAr ? 'الجنس' : 'Gender'}</div><div className="dv">{selected.gender || '—'}</div></div>
          <div className="di"><div className="dl">{isAr ? 'تاريخ الميلاد' : 'Date of Birth'}</div><div className="dv">{selected.dob || '—'}</div></div>
          <div className="di"><div className="dl">{isAr ? 'الهدف' : 'Goal'}</div><div className="dv">{selected.goal || '—'}</div></div>
          <div className="di"><div className="dl">{isAr ? 'الباقة المفضلة' : 'Preferred Plan'}</div><div className="dv">{selected.preferred_plan || '—'}</div></div>
          <div className="di"><div className="dl">{isAr ? 'الحالة' : 'Status'}</div><div className="dv"><QrStatusBadge value={selected.status} locale={locale} /></div></div>
          <div className="di"><div className="dl">{isAr ? 'تاريخ الطلب' : 'Created'}</div><div className="dv">{selected.created_at || '—'}</div></div>
          {selected.member_id ? <div className="di"><div className="dl">{isAr ? 'العضو المنشأ' : 'Created Member'}</div><div className="dv">{selected.member_name || '—'} {selected.member_no ? '(' + selected.member_no + ')' : ''}</div></div> : null}
        </div>
        <div className="fg">
          <label>{isAr ? 'ملاحظات' : 'Notes'}</label>
          <textarea className="fi" rows="4" value={selected.notes || ''} readOnly />
        </div>
        {selected.status === 'pending' ? <div className="fg">
          <label>{isAr ? 'سبب الرفض (اختياري)' : 'Reject reason (optional)'}</label>
          <textarea className="fi" rows="3" value={rejectReason} onChange={function (e) { setRejectReason(e.target.value); }} />
        </div> : null}
        {selected.status === 'approved' && selected.member_id ? <div className="card" style={{ margin: 0, padding: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>{isAr ? 'بعد الموافقة، أكمل الاشتراك والدفعات من شاشة العضو.' : 'After approval, continue membership and finance setup from the member screen.'}</div>
        </div> : null}
      </div>
      <div className="mdl-f">
        <button className="btn btn-s" onClick={function () { setSelected(null); }}>{isAr ? 'إغلاق' : 'Close'}</button>
        {selected.status === 'pending' ? <button className="btn btn-d" onClick={reject} disabled={busy}>{isAr ? 'رفض' : 'Reject'}</button> : null}
        {selected.status === 'pending' ? <button className="btn btn-p" onClick={approve} disabled={busy}>{isAr ? 'موافقة وإنشاء عضو' : 'Approve & Create Member'}</button> : null}
        {selected.status === 'approved' && selected.member_id ? <button className="btn btn-p" onClick={function () { window.location.hash = '/members'; }}>{isAr ? 'فتح الأعضاء' : 'Open Members'}</button> : null}
      </div>
    </Modal> : null}
  </div>;
}

window.GymOS.registerPage({
  path: '/qr-registrations',
  component: QrRegistrationsPage,
  module: 'qr-registration',
  label: 'QR Registrations',
  labelAr: 'تسجيلات QR',
  icon: 'scan-line',
  order: 12
});

window.GymOS.registerMenu({
  path: '/qr-registrations',
  module: 'qr-registration',
  label: 'QR Registrations',
  labelAr: 'تسجيلات QR',
  icon: 'scan-line',
  order: 12,
  badgeEndpoint: '/api/qr-register/pending-count',
  badgeField: 'count'
});

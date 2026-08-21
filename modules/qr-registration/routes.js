const express = require('express');
const { authMiddleware, requirePermission } = require('../../core/middleware/auth');
const settingsService = require('../../core/services/settings-service');
const notificationService = require('../../core/services/notification-service');

module.exports = function (app, { database }) {
  const router = express.Router();
  const db = database;

  function s(key, fallback = '') {
    const value = settingsService.get(key, fallback);
    return value === undefined || value === null ? fallback : value;
  }

  function n(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function cleanText(value, max) {
    return String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max || 255);
  }

  function htmlToText(value) {
    return String(value || '')
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function normalizePhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let digits = digitsOnly(raw);
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('962')) return '+' + digits;
    if (digits.length === 9 && digits.startsWith('7')) return '+962' + digits;
    if (digits.length === 10 && digits.startsWith('07')) return '+962' + digits.slice(1);
    return '+' + digits;
  }

  function phonesMatch(a, b) {
    const da = digitsOnly(normalizePhone(a));
    const dbb = digitsOnly(normalizePhone(b));
    return !!da && !!dbb && (da === dbb || da.slice(-9) === dbb.slice(-9));
  }

  function splitName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
      first_name: parts[0] || 'Member',
      middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : (parts[1] || ''),
      last_name: parts.length > 1 ? parts[parts.length - 1] : '.'
    };
  }

  function getQrSettings() {
    const gymName = s('app.name', s('member_pwa.app_name', 'GymOS'));
    const gymLogoUrl = s('app.admin_logo_url', s('app.login_logo_url', s('member_pwa.logo_url', '')));
    return {
      enabled: s('qr_registration.enabled', true) !== false,
      gymName: gymName,
      gymLogoUrl: gymLogoUrl,
      pwaLink: s('qr_registration.pwa_link', '/member/'),
      iosVideoLink: s('qr_registration.ios_video_link', ''),
      androidVideoLink: s('qr_registration.android_video_link', ''),
      rateLimitPerHour: clamp(n(s('qr_registration.rate_limit_per_hour', 5), 5), 1, 50),
      registrationTemplate: s(
        'qr_registration.whatsapp_template_registration',
        'Thank you {member_name} for registering with {gym_name}.\n\nYour request has been received and is under review. We will notify you as soon as it is approved.\n\nWelcome.'
      ),
      approvalTemplate: s(
        'qr_registration.whatsapp_template_approval',
        'Hello {member_name}, your registration with {gym_name} has been approved.\n\nYou can now sign in to the member app and track your membership here:\n{pwa_link}\n\nHow to install on iPhone:\n{ios_video_link}\n\nHow to install on Android:\n{android_video_link}\n\nWelcome to {gym_name}.'
      )
    };
  }

  function existingMemberByPhone(phone) {
    const normalized = normalizePhone(phone);
    const tail = digitsOnly(normalized).slice(-9);
    const rows = db.getAll(
      "SELECT * FROM members WHERE phone = ? OR phone2 = ? OR phone LIKE ? OR phone2 LIKE ? ORDER BY id DESC LIMIT 50",
      [normalized, normalized, '%' + tail, '%' + tail]
    );
    for (const row of rows) {
      if (phonesMatch(row.phone, normalized) || phonesMatch(row.phone2, normalized)) return row;
    }
    return null;
  }

  function pendingRequestByPhone(phone) {
    const normalized = normalizePhone(phone);
    const tail = digitsOnly(normalized).slice(-9);
    const rows = db.getAll(
      "SELECT * FROM qr_registrations WHERE status = 'pending' AND (phone = ? OR phone LIKE ?) ORDER BY id DESC LIMIT 50",
      [normalized, '%' + tail]
    );
    for (const row of rows) {
      if (phonesMatch(row.phone, normalized)) return row;
    }
    return null;
  }

  function checkRateLimit(phone, ip) {
    const cfg = getQrSettings();
    const normalized = normalizePhone(phone);
    const byPhone = db.getOne(
      "SELECT COUNT(*) as c FROM qr_registrations WHERE phone = ? AND created_at >= datetime('now', '-1 hour')",
      [normalized]
    );
    const byIp = ip ? db.getOne(
      "SELECT COUNT(*) as c FROM qr_registrations WHERE ip_address = ? AND created_at >= datetime('now', '-1 hour')",
      [String(ip)]
    ) : { c: 0 };
    return Number((byPhone && byPhone.c) || 0) >= cfg.rateLimitPerHour || Number((byIp && byIp.c) || 0) >= cfg.rateLimitPerHour;
  }

  const sequenceService = require('../../core/services/sequence-service');
  function generateMemberNo() { return sequenceService.next('member_no', 'M-', 4); }

  function generateQrCode() {
    return 'QR-' + require('crypto').randomBytes(5).toString('hex').toUpperCase();
  }

  function fillTemplate(template, data) {
    let text = htmlToText(String(template || ''));
    const keys = Object.keys(data || {});
    keys.forEach((key) => {
      const re = new RegExp('\\{' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g');
      text = text.replace(re, data[key] == null ? '' : String(data[key]));
    });
    return text.trim();
  }

  async function sendWhatsappMessage(phone, text) {
    const baseUrl = String(s('marketing.wesender_base_url', '') || '').trim().replace(/\/$/, '');
    const token = String(s('marketing.wesender_token', '') || '').trim();
    const sendPath = String(s('marketing.wesender_send_path', '/api/send-message') || '/api/send-message').trim();
    const session = String(s('marketing.wesender_session', '') || '').trim();

    if (!baseUrl || !token) {
      return { success: false, skipped: true, message: 'Wesender is not configured' };
    }

    const payload = {
      to: normalizePhone(phone),
      text: text
    };
    if (session) payload.session = session;

    const response = await fetch(baseUrl + sendPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = { raw: raw }; }

    if (!response.ok) {
      const err = new Error(body.error || body.message || ('Wesender HTTP ' + response.status));
      err.responseBody = body;
      throw err;
    }

    return { success: true, response: body };
  }

  async function sendStageWhatsapp(stage, phone, memberName, memberId) {
    const cfg = getQrSettings();
    const text = fillTemplate(
      stage === 'registration' ? cfg.registrationTemplate : cfg.approvalTemplate,
      {
        gym_name: cfg.gymName || 'GymOS',
        gym_logo_url: cfg.gymLogoUrl || '',
        pwa_link: cfg.pwaLink || '',
        ios_video_link: cfg.iosVideoLink || '',
        android_video_link: cfg.androidVideoLink || '',
        member_name: memberName || '',
        member_id: memberId || ''
      }
    );
    return sendWhatsappMessage(phone, text);
  }

  function notifyAdmins(title, body, link) {
    const admins = db.getAll(
      "SELECT u.id FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 AND (r.name = 'admin' OR r.name = 'manager')"
    );
    admins.forEach((row) => {
      try {
        notificationService.create({ userId: row.id, title: title, body: body, type: 'info', link: link });
      } catch (_) {}
    });
  }

  function createMemberFromRegistration(reg, approvedBy) {
    const name = splitName(reg.full_name);
    const memberNo = generateMemberNo();
    const qrCode = generateQrCode();

    const result = db.run(
      "INSERT INTO members (member_no, first_name, middle_name, last_name, phone, gender, date_of_birth, status, lifecycle_stage, source, notes, qr_code, joined_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'qr_registration', ?, ?, date('now'), datetime('now'), datetime('now'))",
      [
        memberNo,
        name.first_name,
        name.middle_name,
        name.last_name,
        normalizePhone(reg.phone),
        cleanText(reg.gender, 20) || 'male',
        cleanText(reg.dob, 20) || null,
        'inactive',
        cleanText(reg.notes, 1000),
        qrCode
      ]
    );

    const memberId = result.lastInsertRowid;

    try {
      db.run(
        "INSERT INTO member_timeline (member_id, event_type, title, description, created_by, meta) VALUES (?, 'qr_registration_approved', 'QR Registration Approved', ?, ?, ?)",
        [memberId, 'Approved from QR registration #' + reg.id, approvedBy || null, JSON.stringify({ qr_registration_id: reg.id })]
      );
    } catch (_) {}

    return memberId;
  }

  function renderPublicPage() {
    const cfg = getQrSettings();
    const appName = cfg.gymName || 'GymOS';
    const logo = cfg.gymLogoUrl || '';
    return `<!DOCTYPE html>
<html lang="en" dir="auto">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${appName} | QR Registration</title>
<style>
:root{--bg:#0a0f18;--panel:#121a27;--line:#233047;--txt:#edf3ff;--muted:#9fb0cb;--acc:#6366f1;--danger:#ef4444;--ok:#22c55e}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:radial-gradient(circle at top,#17233a 0%,#0a0f18 55%,#060910 100%);color:var(--txt);min-height:100vh}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:22px}.card{width:min(100%,560px);background:rgba(18,26,39,.94);border:1px solid rgba(255,255,255,.08);border-radius:24px;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:22px}
.head{display:flex;align-items:center;gap:14px;margin-bottom:18px}.logo{width:60px;height:60px;border-radius:18px;background:#0f172a;border:1px solid var(--line);object-fit:contain;padding:8px}.title{font-size:22px;font-weight:800}.sub{color:var(--muted);font-size:13px;margin-top:4px}
.lang{display:flex;gap:8px;margin:0 0 16px}.lang button{border:1px solid var(--line);background:#0e1522;color:var(--txt);padding:8px 12px;border-radius:999px;cursor:pointer}.lang button.ac{background:linear-gradient(135deg,var(--acc),#8b5cf6);border-color:transparent}
.grid{display:grid;gap:12px}.row{display:grid;gap:6px}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}label{font-size:13px;color:#d9e5fb}.fi,.ta,.sel{width:100%;border:1px solid var(--line);background:#0c1320;color:var(--txt);border-radius:14px;padding:13px 14px;font-size:14px;outline:none}.fi:focus,.ta:focus,.sel:focus{border-color:#6c7bff;box-shadow:0 0 0 3px rgba(99,102,241,.2)}.ta{min-height:110px;resize:vertical}
.btn{width:100%;border:none;border-radius:16px;padding:14px 16px;font-size:15px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,var(--acc),#8b5cf6);color:white}.btn[disabled]{opacity:.65;cursor:not-allowed}
.msg{display:none;padding:12px 14px;border-radius:14px;font-size:14px;white-space:pre-line}.msg.ok{display:block;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.35);color:#b8f5cd}.msg.er{display:block;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#fecaca}
.note{font-size:12px;color:var(--muted);line-height:1.5}.rtl{direction:rtl;text-align:right}
@media (max-width:560px){.split{grid-template-columns:1fr}.card{padding:18px;border-radius:20px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="card" id="card">
    <div class="head">
      ${logo ? `<img class="logo" src="${logo}" alt="logo" />` : `<div class="logo"></div>`}
      <div>
        <div class="title" data-en="QR Registration" data-ar="التسجيل عبر QR">QR Registration</div>
        <div class="sub" data-en="Join ${appName} in a few quick steps" data-ar="انضم إلى ${appName} بخطوات سريعة">Join ${appName} in a few quick steps</div>
      </div>
    </div>
    <div class="lang">
      <button type="button" class="ac" id="langEn">English</button>
      <button type="button" id="langAr">العربية</button>
    </div>
    <div id="message" class="msg"></div>
    <form id="form" class="grid">
      <div class="row">
        <label data-en="Full Name" data-ar="الاسم الكامل">Full Name</label>
        <input class="fi" name="full_name" required />
      </div>
      <div class="row">
        <label data-en="Phone Number" data-ar="رقم الهاتف">Phone Number</label>
        <input class="fi" name="phone" required inputmode="tel" placeholder="079xxxxxxx / +96279xxxxxxx" />
      </div>
      <div class="split">
        <div class="row">
          <label data-en="Gender" data-ar="الجنس">Gender</label>
          <select class="sel" name="gender">
            <option value="">—</option>
            <option value="male">Male / ذكر</option>
            <option value="female">Female / أنثى</option>
          </select>
        </div>
        <div class="row">
          <label data-en="Date of Birth" data-ar="تاريخ الميلاد">Date of Birth</label>
          <input class="fi" type="date" name="dob" />
        </div>
      </div>
      <div class="split">
        <div class="row">
          <label data-en="Goal" data-ar="الهدف">Goal</label>
          <select class="sel" name="goal">
            <option value="">—</option>
            <option value="weight_loss">Weight Loss / تخفيف وزن</option>
            <option value="muscle_gain">Muscle Gain / بناء عضل</option>
            <option value="fitness">Fitness / لياقة</option>
          </select>
        </div>
        <div class="row">
          <label data-en="Preferred Plan" data-ar="الباقة المفضلة">Preferred Plan</label>
          <input class="fi" name="preferred_plan" />
        </div>
      </div>
      <div class="row">
        <label data-en="Notes" data-ar="ملاحظات">Notes</label>
        <textarea class="ta" name="notes"></textarea>
      </div>
      <button class="btn" type="submit" id="submitBtn" data-en="Send Request" data-ar="إرسال الطلب">Send Request</button>
      <div class="note" data-en="After submission, you will receive an immediate WhatsApp confirmation. After admin approval, you will receive the app link and install videos." data-ar="بعد الإرسال ستصلك رسالة واتساب فورية للتأكيد. وبعد موافقة الإدارة ستصلك رسالة فيها رابط التطبيق وفيديوهات التثبيت.">After submission, you will receive an immediate WhatsApp confirmation. After admin approval, you will receive the app link and install videos.</div>
    </form>
  </div>
</div>
<script>
const state={lang:'en'};const card=document.getElementById('card');const form=document.getElementById('form');const msg=document.getElementById('message');const submitBtn=document.getElementById('submitBtn');
function setLang(lang){state.lang=lang;card.classList.toggle('rtl',lang==='ar');document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-en]').forEach(function(el){el.textContent=lang==='ar'?(el.getAttribute('data-ar')||el.getAttribute('data-en')):(el.getAttribute('data-en')||'')});document.getElementById('langEn').classList.toggle('ac',lang==='en');document.getElementById('langAr').classList.toggle('ac',lang==='ar');}
function show(type,text){msg.className='msg '+type;msg.textContent=text}
document.getElementById('langEn').onclick=function(){setLang('en')};document.getElementById('langAr').onclick=function(){setLang('ar')};setLang('en');
form.addEventListener('submit',async function(e){e.preventDefault();show('','');submitBtn.disabled=true;const old=submitBtn.textContent;submitBtn.textContent=state.lang==='ar'?'جارٍ الإرسال...':'Sending...';const fd=new FormData(form);const payload=Object.fromEntries(fd.entries());
  try{const res=await fetch('/api/qr-register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Submit failed');show('ok',state.lang==='ar'?'تم إرسال طلبك بنجاح. ستصلك رسالة واتساب للتأكيد الآن، ورسالة ثانية بعد الموافقة.':'Your request has been sent. You will receive a WhatsApp confirmation now, and another one after approval.');form.reset();}
  catch(err){show('er',err.message||(state.lang==='ar'?'تعذر إرسال الطلب':'Unable to submit request'));}
  submitBtn.disabled=false;submitBtn.textContent=old;
});
</script>
</body>
</html>`;
  }

  app.get('/qr-register', function (_req, res) {
    const cfg = getQrSettings();
    if (!cfg.enabled) return res.status(403).send('QR registration is disabled');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPublicPage());
  });

  router.get('/api/qr-register/public-config', function (_req, res) {
    res.json({ success: true, data: getQrSettings() });
  });

  router.post('/api/qr-register', async function (req, res) {
    try {
      const cfg = getQrSettings();
      if (!cfg.enabled) return res.status(403).json({ success: false, error: 'QR registration is disabled' });

      const fullName = cleanText(req.body.full_name, 120);
      const phone = normalizePhone(req.body.phone);
      const gender = cleanText(req.body.gender, 20);
      const dob = cleanText(req.body.dob, 20);
      const goal = cleanText(req.body.goal, 40);
      const preferredPlan = cleanText(req.body.preferred_plan, 120);
      const notes = cleanText(req.body.notes, 1000);

      if (!fullName) return res.status(400).json({ success: false, error: 'Full name is required' });
      if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required' });
      if (existingMemberByPhone(phone)) return res.status(409).json({ success: false, error: 'This phone already exists as a member' });
      if (pendingRequestByPhone(phone)) return res.status(409).json({ success: false, error: 'A pending request already exists for this phone' });
      if (checkRateLimit(phone, req.ip)) return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });

      const result = db.run(
        "INSERT INTO qr_registrations (full_name, phone, gender, dob, goal, preferred_plan, notes, status, ip_address, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))",
        [fullName, phone, gender, dob, goal, preferredPlan, notes, String(req.ip || ''), String(req.headers['user-agent'] || '')]
      );

      notifyAdmins('New QR Registration', fullName + ' submitted a QR registration request', '/qr-registrations');

      let whatsapp = { success: false, skipped: true, message: 'Not attempted' };
      try {
        whatsapp = await sendStageWhatsapp('registration', phone, fullName, '');
      } catch (err) {
        whatsapp = { success: false, skipped: false, message: err.message || 'WhatsApp failed' };
      }

      res.json({
        success: true,
        data: { id: result.lastInsertRowid, whatsapp: whatsapp },
        message: 'Your request has been sent. We will contact you shortly.'
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || 'Unable to submit request' });
    }
  });

  router.get('/api/qr-register/pending-count', authMiddleware, requirePermission('qr_registration.view'), function (_req, res) {
    const count = db.getOne("SELECT COUNT(*) as c FROM qr_registrations WHERE status = 'pending'");
    res.json({ success: true, data: { count: Number((count && count.c) || 0) } });
  });

  router.get('/api/qr-register', authMiddleware, requirePermission('qr_registration.view'), function (req, res) {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = clamp(Number(req.query.limit || 20), 1, 100);
    const offset = (page - 1) * limit;
    const search = cleanText(req.query.search, 80);
    const status = cleanText(req.query.status, 20);
    const where = [];
    const params = [];

    if (status) {
      where.push('q.status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(q.full_name LIKE ? OR q.phone LIKE ? OR q.goal LIKE ?)');
      params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
    }

    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = db.getAll(
      "SELECT q.*, u.full_name as approved_by_name, m.member_no, TRIM(COALESCE(m.first_name,'') || ' ' || COALESCE(m.last_name,'')) as member_name FROM qr_registrations q LEFT JOIN users u ON u.id = q.approved_by LEFT JOIN members m ON m.id = q.member_id " + wc + " ORDER BY CASE WHEN q.status='pending' THEN 0 ELSE 1 END, q.created_at DESC LIMIT ? OFFSET ?",
      params.concat([limit, offset])
    );
    const total = db.getOne("SELECT COUNT(*) as c FROM qr_registrations q " + wc, params);
    res.json({ success: true, data: rows, meta: { total: Number((total && total.c) || 0), page: page, limit: limit } });
  });

  router.get('/api/qr-register/:id', authMiddleware, requirePermission('qr_registration.view'), function (req, res) {
    const row = db.getOne(
      "SELECT q.*, ua.full_name as approved_by_name, ur.full_name as rejected_by_name, m.member_no, TRIM(COALESCE(m.first_name,'') || ' ' || COALESCE(m.last_name,'')) as member_name FROM qr_registrations q LEFT JOIN users ua ON ua.id = q.approved_by LEFT JOIN users ur ON ur.id = q.rejected_by LEFT JOIN members m ON m.id = q.member_id WHERE q.id = ?",
      [req.params.id]
    );
    if (!row) return res.status(404).json({ success: false, error: 'QR registration not found' });
    res.json({ success: true, data: row });
  });

  router.post('/api/qr-register/:id/approve', authMiddleware, requirePermission('qr_registration.approve'), async function (req, res) {
    try {
      const row = db.getOne("SELECT * FROM qr_registrations WHERE id = ?", [req.params.id]);
      if (!row) return res.status(404).json({ success: false, error: 'QR registration not found' });
      if (row.status !== 'pending') return res.status(409).json({ success: false, error: 'Request already processed' });
      if (existingMemberByPhone(row.phone)) return res.status(409).json({ success: false, error: 'A member already exists with this phone' });

      const memberId = createMemberFromRegistration(row, req.user.id);

      db.run(
        "UPDATE qr_registrations SET status='approved', member_id=?, approved_by=?, approved_at=datetime('now'), updated_at=datetime('now') WHERE id = ?",
        [memberId, req.user.id, req.params.id]
      );

      let whatsapp = { success: false, skipped: true, message: 'Not attempted' };
      try {
        whatsapp = await sendStageWhatsapp('approval', row.phone, row.full_name, memberId);
      } catch (err) {
        whatsapp = { success: false, skipped: false, message: err.message || 'WhatsApp failed' };
      }

      res.json({ success: true, data: { member_id: memberId, whatsapp: whatsapp } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || 'Unable to approve request' });
    }
  });

  router.post('/api/qr-register/:id/reject', authMiddleware, requirePermission('qr_registration.reject'), function (req, res) {
    const row = db.getOne("SELECT * FROM qr_registrations WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'QR registration not found' });
    if (row.status !== 'pending') return res.status(409).json({ success: false, error: 'Request already processed' });

    db.run(
      "UPDATE qr_registrations SET status='rejected', rejected_by=?, rejected_at=datetime('now'), rejection_reason=?, updated_at=datetime('now') WHERE id = ?",
      [req.user.id, cleanText(req.body.reason, 255), req.params.id]
    );

    res.json({ success: true });
  });

  app.use(router);
};

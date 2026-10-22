/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Forgot password (code by SMS or email)
   File: frontend/js/forgot-password.js
   Steps: 1 choose phone/email → 2 enter 6-digit code →
          3 new password → 4 done
═══════════════════════════════════════════════════════════ */
(function () {
  const $ = (id) => document.getElementById(id);
  const link = $('forgotLink'), modal = $('forgotModal');
  if (!link || !modal) return;

  const idInput = $('idInput'), idLabel = $('idLabel');
  const dots = modal.querySelectorAll('.dot');
  const steps = modal.querySelectorAll('.step');
  const otp = Array.from(modal.querySelectorAll('#otp input'));
  const alertEl = $('fpAlert'), alertText = $('fpAlertText');
  const sendBtn = $('sendCodeBtn'), verifyBtn = $('verifyBtn'), saveBtn = $('saveBtn');

  let identifier = '';
  let resetToken = '';
  let timer = null;
  let expiresAt = 0;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ── helpers ─────────────────────────────────────────── */
  function say(kind, text) {
    if (!text) { alertEl.style.display = 'none'; return; }
    alertEl.className = 'forgot-alert ' + kind;
    alertText.textContent = text;
    alertEl.style.display = 'flex';
  }

  function show(n) {
    steps.forEach((s) => { s.hidden = String(s.dataset.s) !== String(n); });
    dots.forEach((d) => d.classList.toggle('on', Number(d.dataset.d) <= Math.min(n, 3)));
    say('', '');
  }

  function busy(btn, on, html) {
    if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>&nbsp; ' + html; }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.html || btn.innerHTML; }
  }

  function startCountdown() {
    clearInterval(timer);
    expiresAt = Date.now() + 10 * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, expiresAt - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
      const el = $('cd');
      if (el) el.textContent = m + ':' + String(s).padStart(2, '0');
      if (!left) clearInterval(timer);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function resetAll() {
    clearInterval(timer);
    resetToken = '';
    otp.forEach((i) => { i.value = ''; });
    $('newPw').value = ''; $('newPw2').value = '';
    sendBtn.disabled = false; verifyBtn.disabled = false; saveBtn.disabled = false;
  }

  function open(e) {
    e.preventDefault();
    resetAll();
    const loginEmail = $('email');
    if (loginEmail && loginEmail.value.trim() && !idInput.value) {
      idInput.value = loginEmail.value.trim();
    }
    show(1);
    modal.classList.add('visible');
    setTimeout(() => idInput.focus(), 50);
  }
  function close() { modal.classList.remove('visible'); clearInterval(timer); }

  /* ── step 1: one box for email or phone ─────────────── */

  async function sendCode(fromResend) {
    const value = idInput.value.trim();
    const isEmail = value.includes('@');
    const phoneOk = /^(\+?254|0)?[\s-]?[17](?:[\s-]?\d){8}$/.test(value);
    if (isEmail ? !EMAIL_RE.test(value) : !phoneOk) {
      say('error', 'Enter the email address or Kenyan phone number on your account.');
      return;
    }
    identifier = value;
    const btn = fromResend ? null : sendBtn;
    if (btn) busy(btn, true, 'Sending...');
    const r = await API.post('/auth/request-reset-code', { identifier });
    if (btn) busy(btn, false);

    if (!r || !r.ok) {
      say('error', (r && r.data && r.data.message) || 'Could not send the code. Please try again.');
      return;
    }
    $('codeSub').innerHTML = 'If this account exists, we sent the same 6-digit code by <strong>SMS</strong> ' +
      'and <strong>email</strong>. It expires in <strong id="cd">10:00</strong>.';
    otp.forEach((i) => { i.value = ''; });
    show(2);
    say(fromResend ? 'success' : '', fromResend ? 'A new code was requested.' : '');
    startCountdown();
    otp[0].focus();
  }
  sendBtn.addEventListener('click', () => sendCode(false));
  idInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendCode(false); } });

  /* ── step 2: code boxes ──────────────────────────────── */
  otp.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      if (box.value && otp[i + 1]) otp[i + 1].focus();
      if (otp.every((b) => b.value)) verify();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && otp[i - 1]) otp[i - 1].focus();
      if (e.key === 'Enter') { e.preventDefault(); verify(); }
    });
    box.addEventListener('paste', (e) => {
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      e.preventDefault();
      digits.split('').forEach((d, k) => { if (otp[k]) otp[k].value = d; });
      (otp[Math.min(digits.length, 5)]).focus();
      if (digits.length === 6) verify();
    });
  });

  async function verify() {
    const code = otp.map((b) => b.value).join('');
    if (code.length !== 6) { say('error', 'Enter the 6-digit code.'); return; }
    if (verifyBtn.disabled) return;
    busy(verifyBtn, true, 'Checking...');
    const r = await API.post('/auth/verify-reset-code', { identifier, code });
    busy(verifyBtn, false);
    if (r && r.ok && r.data && r.data.resetToken) {
      resetToken = r.data.resetToken;
      clearInterval(timer);
      show(3);
      $('newPw').focus();
    } else {
      say('error', (r && r.data && r.data.message) || 'That code is incorrect or has expired.');
      otp.forEach((i) => { i.value = ''; });
      otp[0].focus();
    }
  }
  verifyBtn.addEventListener('click', verify);

  $('resend').addEventListener('click', (e) => { e.preventDefault(); sendCode(true); });
  modal.querySelectorAll('[data-go="1"]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); show(1); }));

  /* ── step 3: new password ────────────────────────────── */
  async function savePassword() {
    const p1 = $('newPw').value, p2 = $('newPw2').value;
    if (p1.length < 8) { say('error', 'Password must be at least 8 characters.'); return; }
    if (p1 !== p2) { say('error', 'Passwords do not match.'); return; }
    busy(saveBtn, true, 'Saving...');
    const r = await API.post('/auth/reset-password/' + encodeURIComponent(resetToken),
      { password: p1, confirmPassword: p2 });
    busy(saveBtn, false);
    if (r && r.ok) {
      /* The server also signs the user in; we send them back to the
         normal sign-in form instead, with their identifier filled in. */
      const loginEmail = $('email');
      if (loginEmail && identifier.includes('@')) loginEmail.value = identifier;
      show(4);
    } else {
      say('error', (r && r.data && r.data.message) || 'Could not save the password. Request a new code.');
    }
  }
  saveBtn.addEventListener('click', savePassword);
  ['newPw', 'newPw2'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); savePassword(); } }));

  /* ── open / close ────────────────────────────────────── */
  link.addEventListener('click', open);
  modal.querySelectorAll('[data-close-forgot]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); close(); }));
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('visible')) close(); });
})();
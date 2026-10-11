/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Forgot Password modal (login page)
   File: js/forgot-password.js
   Needs: api.js (API.post) and the #forgotModal markup in login.html
═══════════════════════════════════════════════════════════ */
(function () {
  const link      = document.getElementById('forgotLink');
  const modal     = document.getElementById('forgotModal');
  if (!link || !modal) return;

  const form      = document.getElementById('forgotForm');
  const emailEl   = document.getElementById('forgotEmail');
  const errorEl   = document.getElementById('forgotEmailError');
  const alertEl   = document.getElementById('forgotAlert');
  const alertText = document.getElementById('forgotAlertText');
  const submitBtn = document.getElementById('forgotSubmit');
  const closeBtns = modal.querySelectorAll('[data-close-forgot]');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showAlert(kind, text) {
    alertEl.className = 'forgot-alert ' + kind;
    alertText.textContent = text;
    alertEl.style.display = 'flex';
  }

  function clearMessages() {
    alertEl.style.display = 'none';
    errorEl.style.display = 'none';
  }

  function openModal(e) {
    e.preventDefault();
    clearMessages();
    // Pre-fill from the login form if the user already typed their email
    const loginEmail = document.getElementById('email');
    if (loginEmail && loginEmail.value.trim() && !emailEl.value) {
      emailEl.value = loginEmail.value.trim();
    }
    submitBtn.disabled = false;
    modal.classList.add('visible');
    setTimeout(() => emailEl.focus(), 50);
  }

  function closeModal() {
    modal.classList.remove('visible');
  }

  link.addEventListener('click', openModal);
  closeBtns.forEach(b => b.addEventListener('click', closeModal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = emailEl.value.trim();
    if (!EMAIL_RE.test(email)) {
      errorEl.style.display = 'flex';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>&nbsp; Sending...';

    const result = await API.post('/auth/forgot-password', { email });

    submitBtn.innerHTML = 'Send Reset Link &nbsp;<i class="fas fa-paper-plane"></i>';

    if (!result) { submitBtn.disabled = false; return; }

    if (result.ok) {
      // The server answers the same way whether or not the email exists.
      showAlert('success',
        'If that email is registered, a reset link is on its way. ' +
        'Check your inbox (and spam folder). The link expires in 30 minutes.');
      // Leave the button disabled so the user doesn't spam the endpoint.
      setTimeout(() => { submitBtn.disabled = false; }, 30000);
    } else {
      submitBtn.disabled = false;
      showAlert('error',
        result.data?.message || 'Could not send the reset email. Please try again.');
    }
  });
})();
/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Reset / Setup password page logic
   File: js/auth-token.js
   Used by: pages/reset-password.html  (data-mode="reset")
            pages/setup-account.html   (data-mode="setup")
   Needs:   api.js (API, Auth)
═══════════════════════════════════════════════════════════ */
(function () {
  const mode = document.body.dataset.mode;               // 'reset' | 'setup'
  const endpoint = mode === 'setup' ? '/auth/setup-account' : '/auth/reset-password';

  const token = new URLSearchParams(window.location.search).get('token');

  const formWrap   = document.getElementById('formWrap');
  const badLink    = document.getElementById('badLink');
  const form       = document.getElementById('tokenForm');
  const pwd        = document.getElementById('newPassword');
  const confirmPwd = document.getElementById('confirmPassword');
  const pwdError   = document.getElementById('pwdError');
  const confError  = document.getElementById('confError');
  const alertBox   = document.getElementById('formAlert');
  const alertText  = document.getElementById('formAlertText');
  const submitBtn  = document.getElementById('submitBtn');
  const strengthEl = document.getElementById('strengthText');

  /* No token in the URL → the link is broken */
  if (!token) {
    formWrap.style.display = 'none';
    badLink.style.display  = 'block';
    return;
  }

  /* Show / hide password buttons */
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggle);
      const show  = input.type === 'password';
      input.type  = show ? 'text' : 'password';
      btn.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
    });
  });

  /* Simple live strength hint */
  pwd.addEventListener('input', () => {
    const v = pwd.value;
    if (!v) { strengthEl.textContent = ''; return; }
    let score = 0;
    if (v.length >= 8)  score++;
    if (v.length >= 12) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v))   score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'];
    strengthEl.textContent = 'Strength: ' + labels[score];
    strengthEl.style.color = score <= 1 ? '#c0392b' : score <= 2 ? '#d68910' : '#1e8449';
  });

  function clearErrors() {
    pwdError.style.display  = 'none';
    confError.style.display = 'none';
    alertBox.style.display  = 'none';
  }

  function fieldError(el, msg) {
    el.querySelector('span').textContent = msg;
    el.style.display = 'flex';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const password        = pwd.value;
    const confirmPassword = confirmPwd.value;

    let valid = true;
    if (password.length < 8) {
      fieldError(pwdError, 'Password must be at least 8 characters.');
      valid = false;
    }
    if (password !== confirmPassword) {
      fieldError(confError, 'Passwords do not match.');
      valid = false;
    }
    if (!valid) return;

    submitBtn.disabled = true;
    const originalLabel = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>&nbsp; Saving...';

    const result = await API.post(
      `${endpoint}/${encodeURIComponent(token)}`,
      { password, confirmPassword }
    );

    if (!result || !result.ok) {
      submitBtn.disabled  = false;
      submitBtn.innerHTML = originalLabel;
      alertText.textContent =
        result?.data?.message || 'Something went wrong. Please try again.';
      alertBox.style.display = 'flex';
      return;
    }

    /* Success — the server logs the user in, same as the login page */
    const { token: jwt, user } = result.data;
    Auth.setSession(jwt, user);

    submitBtn.innerHTML = '<i class="fas fa-check"></i>&nbsp; Done! Redirecting...';
    setTimeout(() => {
      window.location.href = user?.role === 'superadmin'
        ? 'sa-dashboard.html'
        : 'dashboard.html';
    }, 900);
  });
})();
/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Login Page Logic
   File: js/main.js
   Version: 3.1 — Fixed helper initialization order
═══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   HELPERS — defined first so they're available everywhere
══════════════════════════════════════════════════════════ */
const loginAlert    = document.getElementById('loginAlert');
const alertMessage  = document.getElementById('alertMessage');
const emailError    = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const loginBtn      = document.getElementById('loginBtn');
const btnText       = document.getElementById('btnText');
const btnSpinner    = document.getElementById('btnSpinner');

const setLoading = (loading) => {
  if (loginBtn)    loginBtn.disabled        = loading;
  if (btnText)     btnText.style.display    = loading ? 'none'   : 'inline';
  if (btnSpinner)  btnSpinner.style.display = loading ? 'inline' : 'none';
};

const showFieldError = (el, msg) => {
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'flex';
};

const showLoginError = (msg) => {
  if (loginAlert)   loginAlert.style.display = 'flex';
  if (alertMessage) alertMessage.textContent = msg;
};

const clearErrors = () => {
  if (emailError)    emailError.style.display    = 'none';
  if (passwordError) passwordError.style.display = 'none';
  if (loginAlert)    loginAlert.style.display    = 'none';
};

/* ── Redirect to dashboard if already logged in ───────────── */
if (Auth.isLoggedIn()) {
  window.location.href = '../pages/dashboard.html';
}

/* ══════════════════════════════════════════════════════════
   REMAINING DOM ELEMENTS
══════════════════════════════════════════════════════════ */
const loginForm       = document.getElementById('loginForm');
const emailInput      = document.getElementById('email');
const passwordInput   = document.getElementById('password');
const rememberMe      = document.getElementById('rememberMe');
const togglePassword  = document.getElementById('togglePassword');
const toggleIcon      = document.getElementById('toggleIcon');
const suspensionScreen= document.getElementById('suspensionScreen');
const suspensionReason= document.getElementById('suspensionReasonText');
const tryAgainBtn     = document.getElementById('tryAgainBtn');

/* ══════════════════════════════════════════════════════════
   PRE-FILL REMEMBERED EMAIL
══════════════════════════════════════════════════════════ */
const remembered = localStorage.getItem('sa_remembered_email');
if (remembered && emailInput) {
  emailInput.value = remembered;
}

/* ══════════════════════════════════════════════════════════
   CHECK URL FOR REASON (session expired etc.)
══════════════════════════════════════════════════════════ */
const urlParams = new URLSearchParams(window.location.search);
const reason    = urlParams.get('reason');

if (reason === 'SESSION_EXPIRED') {
  showLoginError('Your session has expired. Please log in again.');
}

if (reason === 'SCHOOL_LOCKED' || reason === 'SUBSCRIPTION_EXPIRED') {
  if (suspensionScreen) {
    suspensionScreen.classList.add('visible');
  }
}

/* ══════════════════════════════════════════════════════════
   PASSWORD TOGGLE
══════════════════════════════════════════════════════════ */
togglePassword?.addEventListener('click', () => {
  const type = passwordInput.type === 'password' ? 'text' : 'password';
  passwordInput.type = type;
  if (toggleIcon) {
    toggleIcon.className = type === 'password'
      ? 'fas fa-eye'
      : 'fas fa-eye-slash';
  }
});

/* ══════════════════════════════════════════════════════════
   TRY AGAIN — back to login from suspension screen
══════════════════════════════════════════════════════════ */
tryAgainBtn?.addEventListener('click', () => {
  if (suspensionScreen) {
    suspensionScreen.classList.remove('visible');
  }
});

/* ══════════════════════════════════════════════════════════
   FORM SUBMIT
══════════════════════════════════════════════════════════ */
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email    = emailInput?.value.trim() || '';
  const password = passwordInput?.value     || '';

  /* ── Client-side validation ───────────────────────────── */
  let valid = true;

  if (!email) {
    showFieldError(emailError, 'Email is required.');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError(emailError, 'Please enter a valid email address.');
    valid = false;
  }

  if (!password) {
    showFieldError(passwordError, 'Password is required.');
    valid = false;
  }

  if (!valid) return;

  /* ── Show loading state ───────────────────────────────── */
  setLoading(true);

  /* ── Call login API ───────────────────────────────────── */
  const result = await API.post('/auth/login', { email, password });

  setLoading(false);

  if (!result) return;

  /* ── Handle errors ────────────────────────────────────── */
  if (!result.ok) {
    const code = result.data?.errorCode;

    if (code === 'SCHOOL_LOCKED' || code === 'SUBSCRIPTION_EXPIRED') {
      if (suspensionScreen) {
        suspensionScreen.classList.add('visible');
        if (suspensionReason) {
          suspensionReason.textContent =
            result.data.message || 'Account suspended.';
        }
      }
      return;
    }

    showLoginError(result.data?.message || 'Invalid email or password.');
    return;
  }

  /* ── Login successful ─────────────────────────────────── */
  const { token, user } = result.data;

  if (rememberMe?.checked) {
    localStorage.setItem('sa_remembered_email', email);
  } else {
    localStorage.removeItem('sa_remembered_email');
  }

  Auth.setSession(token, user);
  window.location.href = 'dashboard.html';
});
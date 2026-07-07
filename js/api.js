/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Shared API Helper
   File: frontend/js/api.js
   Used by every page to talk to the backend
═══════════════════════════════════════════════════════════ */

const API_BASE_URL = 'https://scholar-analytics-api.onrender.com/api';

/* ══════════════════════════════════════════════════════════
   TOKEN HELPERS
══════════════════════════════════════════════════════════ */
const Auth = {

  getToken: () =>
    localStorage.getItem('sa_token'),

  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('sa_user'));
    } catch {
      return null;
    }
  },

  getSchool: () => {
    try {
      return JSON.parse(localStorage.getItem('sa_school'));
    } catch {
      return null;
    }
  },

  setSession: (token, user) => {

    localStorage.setItem('sa_token', token);
    localStorage.setItem('sa_user', JSON.stringify(user));

    if (user.school) {
      localStorage.setItem(
        'sa_school',
        JSON.stringify(user.school)
      );
    }
  },

  clearSession: () => {

    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_user');
    localStorage.removeItem('sa_school');
  },

  isLoggedIn: () =>
    !!localStorage.getItem('sa_token'),

  isSuperAdmin: () => {
    const user = Auth.getUser();
    return user?.role === 'superadmin';
  },

  isAdmin: () => {
    const user = Auth.getUser();
    return ['admin', 'superadmin']
      .includes(user?.role);
  },
};

/* ══════════════════════════════════════════════════════════
   CORE FETCH WRAPPER
══════════════════════════════════════════════════════════ */
const apiFetch = async (endpoint, options = {}) => {

  const token = Auth.getToken();

  const config = {
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),

      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),

      ...options.headers,
    },

    ...options,
  };

  try {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    const response = await fetch(
      `${API_BASE}${endpoint}`,
      {
        ...config,
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {
        success: false,
        message: 'Invalid server response',
      };
    }

    /* School locked */
    if (
      data.errorCode === 'SCHOOL_LOCKED' ||
      data.errorCode === 'SUBSCRIPTION_EXPIRED'
    ) {

      Auth.clearSession();

      window.location.href =
        '../pages/login.html?reason=' +
        data.errorCode;

      return;
    }

    /* Token expired */
    if (response.status === 401) {

      Auth.clearSession();

      window.location.href =
        '../pages/login.html?reason=SESSION_EXPIRED';

      return;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };

  } catch (error) {

    console.error('API Error:', error.message);

    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        message:
          error.name === 'AbortError'
            ? 'Request timed out. Please try again.'
            : 'Cannot connect to server. Make sure backend is running.',
      },
    };
  }
};

/* ══════════════════════════════════════════════════════════
   API METHODS
══════════════════════════════════════════════════════════ */
const API = {

  get: (endpoint) =>
    apiFetch(endpoint, {
      method: 'GET',
    }),

  post: (endpoint, body) =>
    apiFetch(endpoint, {
      method: 'POST',
      body:
        body instanceof FormData
          ? body
          : JSON.stringify(body),
    }),

  put: (endpoint, body) =>
    apiFetch(endpoint, {
      method: 'PUT',
      body:
        body instanceof FormData
          ? body
          : JSON.stringify(body),
    }),

  patch: (endpoint, body) =>
    apiFetch(endpoint, {
      method: 'PATCH',
      body:
        body instanceof FormData
          ? body
          : JSON.stringify(body),
    }),

  delete: (endpoint, body = null) =>
    apiFetch(endpoint, {
      method: 'DELETE',
      body:
        body
          ? JSON.stringify(body)
          : null,
    }),
};

/* ══════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════════════════ */
const showToast = (
  message,
  type = 'success'
) => {

  document
    .querySelectorAll('.sa-toast')
    .forEach(t => t.remove());

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info',
  };

  const colours = {
    success:
      'linear-gradient(135deg,#1e8449,#27ae60)',

    error:
      'linear-gradient(135deg,#c0392b,#e74c3c)',

    warning:
      'linear-gradient(135deg,#d68910,#f39c12)',

    info:
      'linear-gradient(135deg,#1a6fa8,#2e86c1)',
  };

  const toast = document.createElement('div');

  toast.className = 'sa-toast';

  toast.style.cssText = `
    position:fixed;
    bottom:28px;
    right:28px;
    z-index:9999;

    display:flex;
    align-items:center;
    gap:12px;

    padding:14px 22px;
    border-radius:14px;

    background:${colours[type]};
    color:white;

    font-family:var(--font-body,sans-serif);
    font-size:0.875rem;
    font-weight:600;

    max-width:380px;

    box-shadow:0 8px 32px rgba(0,0,0,0.25);

    animation:toastSlideIn 0.4s cubic-bezier(0.16,1,0.3,1);
  `;

  const icon = document.createElement('i');

  icon.className = `fas ${icons[type]}`;

  icon.style.fontSize = '18px';
  icon.style.flexShrink = '0';

  const text = document.createElement('span');

  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);

  if (!document.getElementById('sa-toast-style')) {

    const style = document.createElement('style');

    style.id = 'sa-toast-style';

    style.textContent = `
      @keyframes toastSlideIn{
        from{
          opacity:0;
          transform:translateX(40px) scale(0.95);
        }

        to{
          opacity:1;
          transform:translateX(0) scale(1);
        }
      }

      @keyframes toastSlideOut{
        from{
          opacity:1;
        }

        to{
          opacity:0;
          transform:translateX(40px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  setTimeout(() => {

    toast.style.animation =
      'toastSlideOut 0.3s ease forwards';

    setTimeout(() => {
      toast.remove();
    }, 300);

  }, 3500);
};

/* ══════════════════════════════════════════════════════════
   BUTTON LOADING HELPER
══════════════════════════════════════════════════════════ */
const setButtonLoading = (
  button,
  loading,
  text = 'Loading...'
) => {

  if (!button) return;

  if (loading) {

    button.dataset.original =
      button.innerHTML;

    button.disabled = true;

    button.innerHTML = `
      <i class="fas fa-spinner fa-spin"></i>
      ${text}
    `;

  } else {

    button.disabled = false;

    button.innerHTML =
      button.dataset.original;
  }
};

/* ══════════════════════════════════════════════════════════
   PAGE AUTH GUARD
══════════════════════════════════════════════════════════ */
const requireAuth = (
  allowedRoles = []
) => {

  if (!Auth.isLoggedIn()) {

    window.location.href =
      '../pages/login.html';

    return null;
  }

  const user = Auth.getUser();

  if (
    allowedRoles.length &&
    !allowedRoles.includes(user?.role)
  ) {

    window.location.href =
      '../pages/dashboard.html';

    return null;
  }

  return user;
};

/* ══════════════════════════════════════════════════════════
   SIDEBAR INITIALISER
══════════════════════════════════════════════════════════ */
const initSidebar = (user) => {

  const initials = user?.fullName
    ?.trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || '??';

  const roleLabels = {
    admin: 'Administrator',
    teacher: 'Teacher',
    superadmin: 'Super Admin',
  };

  const roleLabel =
    roleLabels[user?.role] || user?.role;

  const sidebarAvatar =
    document.getElementById('sidebarAvatar');

  const sidebarUserName =
    document.getElementById('sidebarUserName');

  const sidebarUserRole =
    document.getElementById('sidebarUserRole');

  const adminMenu =
    document.getElementById('adminMenu');

  const topbarAvatar =
    document.getElementById('topbarAvatar');

  const topbarUserName =
    document.getElementById('topbarUserName');

  const dropdownName =
    document.getElementById('dropdownName');

  const dropdownEmail =
    document.getElementById('dropdownEmail');

  const currentTerm =
    document.getElementById('currentTerm');

  if (sidebarAvatar)
    sidebarAvatar.textContent = initials;

  if (sidebarUserName)
    sidebarUserName.textContent =
      user?.fullName || 'User';

  if (sidebarUserRole)
    sidebarUserRole.textContent =
      roleLabel;

  if (topbarAvatar)
    topbarAvatar.textContent = initials;

  if (topbarUserName)
    topbarUserName.textContent =
      user?.fullName?.split(' ')[0] || 'User';

  if (dropdownName)
    dropdownName.textContent =
      user?.fullName || '--';

  if (dropdownEmail)
    dropdownEmail.textContent =
      user?.email || '--';

  if (adminMenu) {

    adminMenu.style.display =
      ['admin', 'superadmin']
      .includes(user?.role)
        ? 'block'
        : 'none';
  }

  const school = Auth.getSchool();

  if (currentTerm && school) {

    currentTerm.textContent =
      `Term ${school.currentTerm || 1}
       • ${school.currentYear || 2024}`;
  }

  const sidebar =
    document.getElementById('sidebar');

  const sidebarClose =
    document.getElementById('sidebarClose');

  const sidebarOverlay =
    document.getElementById('sidebarOverlay');

  const hamburger =
    document.getElementById('hamburger');

  const openSidebar = () => {

    sidebar?.classList.add('open');

    sidebarOverlay?.classList.add('active');

    document.body.style.overflow = 'hidden';
  };

  const closeSidebar = () => {

    sidebar?.classList.remove('open');

    sidebarOverlay?.classList.remove('active');

    document.body.style.overflow = '';
  };

  hamburger?.addEventListener(
    'click',
    openSidebar
  );

  sidebarClose?.addEventListener(
    'click',
    closeSidebar
  );

  sidebarOverlay?.addEventListener(
    'click',
    closeSidebar
  );

  if (!window.__sidebarEventsBound) {

    document.addEventListener(
      'keydown',
      e => {
        if (e.key === 'Escape') {
          closeSidebar();
        }
      }
    );

    window.__sidebarEventsBound = true;
  }

  const userMenuBtn =
    document.getElementById('userMenuBtn');

  const userDropdown =
    document.getElementById('userDropdown');

  userMenuBtn?.addEventListener(
    'click',
    e => {

      e.stopPropagation();

      const open =
        userDropdown?.classList.toggle('open');

      userMenuBtn?.classList.toggle(
        'open',
        open
      );
    }
  );

  document.addEventListener(
    'click',
    e => {

      if (
        !userMenuBtn?.contains(e.target)
      ) {

        userDropdown?.classList.remove('open');

        userMenuBtn?.classList.remove('open');
      }
    }
  );

  const handleLogout = () => {

    Auth.clearSession();

    window.location.href =
      '../pages/login.html';
  };

  document.getElementById('logoutBtn')
    ?.addEventListener(
      'click',
      handleLogout
    );

  document.getElementById('dropdownLogout')
    ?.addEventListener(
      'click',
      handleLogout
    );
};

/* ══════════════════════════════════════════════════════════
   SKELETON LOADERS
══════════════════════════════════════════════════════════ */
const Skeleton = {

  table: (rows = 5, cols = 6) => {

    return Array(rows).fill(0)
      .map(() => `
        <tr>
          ${Array(cols).fill(0)
            .map((_, i) => `
              <td>
                <div class="skeleton skeleton-text ${
                  i === 0
                    ? 'w25'
                    : i === cols - 1
                    ? 'w50'
                    : 'w75'
                }"></div>
              </td>
            `).join('')}
        </tr>
      `).join('');
  },

  card: (lines = 3) => `
    <div class="skeleton-card">

      <div
        class="skeleton skeleton-text lg w50"
        style="margin-bottom:12px;"
      ></div>

      ${Array(lines).fill(0)
        .map((_, i) => `
          <div
            class="skeleton skeleton-text ${
              i === lines - 1
                ? 'w50'
                : 'w100'
            }"
            style="margin-bottom:8px;"
          ></div>
        `).join('')}

    </div>
  `,

  grid: (count = 6) =>
    Array(count).fill(0)
      .map(() => Skeleton.card())
      .join(''),

  stats: (count = 5) =>
    Array(count).fill(0)
      .map(() => `
        <div
          style="
            display:flex;
            align-items:center;
            gap:12px;
            flex:1;
            padding:4px 8px;
          "
        >

          <div
            class="skeleton skeleton-circle"
            style="width:36px;height:36px;"
          ></div>

          <div style="flex:1;">

            <div
              class="skeleton skeleton-text lg w50"
              style="margin-bottom:6px;"
            ></div>

            <div
              class="skeleton skeleton-text sm w75"
            ></div>

          </div>

        </div>
      `).join(''),
};

/* ══════════════════════════════════════════════════════════
   AUTO-INJECT SKELETON CSS
══════════════════════════════════════════════════════════ */
(() => {

  if (
    document.getElementById(
      'sa-skeleton-style'
    )
  ) return;

  const style =
    document.createElement('style');

  style.id = 'sa-skeleton-style';

  style.textContent = `
    .skeleton{
      position:relative;
      overflow:hidden;
      background:#e5e7eb;
      border-radius:8px;
    }

    .skeleton::after{
      content:'';
      position:absolute;
      inset:0;
      transform:translateX(-100%);
      background:linear-gradient(
        90deg,
        transparent,
        rgba(255,255,255,0.65),
        transparent
      );
      animation:skeletonShimmer 1.2s infinite;
    }

    @keyframes skeletonShimmer{
      100%{
        transform:translateX(100%);
      }
    }

    .skeleton-text{
      height:12px;
    }

    .skeleton-text.sm{
      height:8px;
    }

    .skeleton-text.lg{
      height:16px;
    }

    .skeleton-circle{
      border-radius:50%;
    }

    .skeleton-card{
      padding:18px;
      border-radius:18px;
      background:#fff;
      border:1px solid #edf2f7;
    }

    .w25{ width:25%; }
    .w50{ width:50%; }
    .w75{ width:75%; }
    .w100{ width:100%; }
  `;

  document.head.appendChild(style);

})();
/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — SuperAdmin Dashboard
   File: js/sa-dashboard.js
═══════════════════════════════════════════════════════════ */

/* ── Auth guard — superadmin only ─────────────────────────── */
const saUser = Auth.getUser();
if (!saUser || saUser.role !== 'superadmin') {
  window.location.href = 'sa-login.html';
}

/* Set name */
const nameEl = document.getElementById('saAdminName');
if (nameEl) nameEl.textContent = saUser?.fullName?.split(' ')[0] || 'SuperAdmin';

/* Logout */
document.getElementById('saLogoutBtn')?.addEventListener('click', () => {
  Auth.clearSession();
  window.location.href = 'sa-login.html';
});

/* ══════════════════════════════════════════════════════════
   LOAD DASHBOARD
══════════════════════════════════════════════════════════ */
const loadDashboard = async () => {
  const result = await API.get('/superadmin/dashboard');

  if (!result?.ok) {
    showToast('Failed to load dashboard.', 'error');
    return;
  }

  const { stats, recentSchools } = result.data;

  /* KPI cards */
  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val ?? '--';
  };

  set('kpiTotalSchools',   stats.totalSchools);
  set('kpiActiveSchools',  stats.activeSchools);
  set('kpiLockedSchools',  stats.lockedSchools);
  set('kpiExpiringSoon',   stats.expiringSoon);
  set('kpiTotalUsers',     stats.totalUsers);
  set('kpiTotalStudents',  stats.totalStudents);

  /* Recent schools table */
  renderRecentSchools(recentSchools || []);
};

const renderRecentSchools = (schools) => {
  const tbody = document.getElementById('recentSchoolsBody');
  if (!tbody) return;

  if (!schools.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:32px;color:rgba(255,255,255,0.30);">
        No schools found. Create the first school.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = schools.map(s => {
    const expiry   = s.subscription?.expiryDate
      ? new Date(s.subscription.expiryDate).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})
      : '—';

    const statusHtml = `
      <span class="sa-status ${s.status}">
        <span class="sa-status-dot"></span>
        ${s.status.charAt(0).toUpperCase()+s.status.slice(1)}
      </span>`;

    const planHtml = `
      <span class="sa-plan ${s.subscription?.plan || 'trial'}">
        ${s.subscription?.plan || 'trial'}
      </span>`;

    return `
      <tr>
        <td style="font-weight:600;color:white;">${s.schoolName}</td>
        <td>${statusHtml}</td>
        <td>${planHtml}</td>
        <td style="color:rgba(255,255,255,0.55);">--</td>
        <td style="font-size:var(--text-xs);color:rgba(255,255,255,0.40);">${expiry}</td>
        <td>
          <a href="sa-schools.html" class="sa-btn-info" style="font-size:0.70rem;padding:5px 10px;">
            <i class="fas fa-arrow-right"></i> Manage
          </a>
        </td>
      </tr>`;
  }).join('');
};

/* Auto-lock expired */
document.getElementById('autoLockBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('autoLockBtn');
  if (btn) btn.disabled = true;

  const result = await API.post('/superadmin/auto-lock-expired', {});

  if (btn) btn.disabled = false;

  if (!result?.ok) { showToast('Failed.', 'error'); return; }

  showToast(result.data.message, 'success');
  loadDashboard();
});

loadDashboard();
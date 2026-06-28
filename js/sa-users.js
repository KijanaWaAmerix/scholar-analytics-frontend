/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — SuperAdmin Users
   File: js/sa-users.js
═══════════════════════════════════════════════════════════ */

const saUser = Auth.getUser();
if (!saUser || saUser.role !== 'superadmin') {
  window.location.href = 'sa-login.html';
}

const nameEl = document.getElementById('saAdminName');
if (nameEl) nameEl.textContent = saUser?.fullName?.split(' ')[0] || 'SuperAdmin';

document.getElementById('saLogoutBtn')?.addEventListener('click', () => {
  Auth.clearSession();
  window.location.href = 'sa-login.html';
});

const AV = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = n => n?.trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?';
const getAvColour = n => AV[(n?.charCodeAt(0)||0) % AV.length];

const state = { page:1, pages:1, total:0 };

const loadUsers = async (page = 1) => {
  const search = document.getElementById('userSearch')?.value.trim() || '';
  const role   = document.getElementById('userRoleFilter')?.value   || 'all';

  const params = new URLSearchParams({ page, limit:30 });
  if (search) params.set('search', search);
  if (role && role !== 'all') params.set('role', role);

  const result = await API.get(`/superadmin/users?${params}`);
  if (!result?.ok) { showToast('Failed to load users.', 'error'); return; }

  const users = result.data.users || [];
  state.page  = result.data.pagination?.page  || 1;
  state.pages = result.data.pagination?.pages || 1;
  state.total = result.data.pagination?.total || 0;

  /* Stats */
  const admins   = users.filter(u => u.role==='admin').length;
  const teachers = users.filter(u => u.role==='teacher').length;
  const setKpi = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  setKpi('totalUsersKpi',   state.total);
  setKpi('totalAdminsKpi',  admins);
  setKpi('totalTeachersKpi',teachers);

  renderUsers(users);

  const countEl = document.getElementById('usersCount');
  if (countEl) countEl.textContent = `${state.total} users`;
};

const renderUsers = (users) => {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:48px;color:rgba(255,255,255,0.30);">
        No users found.
      </td></tr>`;
    return;
  }

  const start = (state.page-1)*30;

  tbody.innerHTML = users.map((u, i) => {
    const lastLogin = u.lastLogin
      ? new Date(u.lastLogin).toLocaleDateString('en-KE',{day:'numeric',month:'short'})
      : 'Never';

    const roleColour = { admin:'#c39bd3', teacher:'#2ecc71' };

    return `
      <tr>
        <td style="color:rgba(255,255,255,0.30);font-size:var(--text-xs);">${start+i+1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);font-weight:700;color:white;flex-shrink:0;"
              class="${getAvColour(u.fullName)}">
              ${getInitials(u.fullName)}
            </div>
            <div>
              <div style="font-weight:600;color:white;">${u.fullName}</div>
            </div>
          </div>
        </td>
        <td style="font-size:var(--text-sm);color:rgba(255,255,255,0.55);">${u.email}</td>
        <td>
          <span style="font-size:var(--text-xs);font-weight:700;color:${roleColour[u.role]||'#94a3b8'};text-transform:capitalize;">
            ${u.role}
          </span>
        </td>
        <td style="font-size:var(--text-sm);color:rgba(255,255,255,0.45);">
          ${u.school?.schoolName || '—'}
        </td>
        <td>
          <span style="font-size:var(--text-xs);font-weight:600;color:${u.isAccountSetup?'#2ecc71':'#e67e22'};">
            <i class="fas ${u.isAccountSetup?'fa-circle-check':'fa-clock'}"></i>
            ${u.isAccountSetup?'Complete':'Pending'}
          </span>
        </td>
        <td style="font-size:var(--text-xs);color:rgba(255,255,255,0.35);">${lastLogin}</td>
        <td>
          <span class="sa-status ${u.isActive?'active':'locked'}">
            <span class="sa-status-dot"></span>
            ${u.isActive?'Active':'Inactive'}
          </span>
        </td>
        <td>
          <button class="sa-btn-${u.isActive?'danger':'success'}"
            onclick="toggleUser('${u._id}','${u.isActive}')">
            <i class="fas ${u.isActive?'fa-user-slash':'fa-user-check'}"></i>
            ${u.isActive?'Deactivate':'Activate'}
          </button>
        </td>
      </tr>`;
  }).join('');
};

window.toggleUser = async (id, isActive) => {
  const active = isActive === 'true';
  if (active && !confirm('Deactivate this user? They cannot log in.')) return;

  const result = await API.patch(`/superadmin/users/${id}/toggle`, {});
  if (!result?.ok) { showToast('Failed.', 'error'); return; }
  showToast(active ? 'User deactivated.' : 'User activated.', 'success');
  loadUsers(state.page);
};

/* Filters */
let searchTimeout;
document.getElementById('userSearch')?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadUsers(1), 400);
});

document.getElementById('userRoleFilter')?.addEventListener('change', () => loadUsers(1));

loadUsers(1);
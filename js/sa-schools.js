/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — SuperAdmin Schools Page
   File: js/sa-schools.js
═══════════════════════════════════════════════════════════ */

const user = requireAuth(['superadmin']);
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
const state = {
  schools  : [],
  editingId: null,
  lockId   : null,
  extendId : null,
};

/* ══════════════════════════════════════════════════════════
   LOAD SCHOOLS
══════════════════════════════════════════════════════════ */
const loadSchools = async () => {
  const tbody = document.getElementById('schoolsTableBody');
  if (tbody) tbody.innerHTML = `
    <tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-soft);">
      <i class="fas fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:10px;"></i>
      Loading schools...
    </td></tr>`;

  const result = await API.get('/superadmin/schools');

  if (!result?.ok) {
    showToast('Failed to load schools.', 'error');
    return;
  }

  state.schools = result.data.schools || [];
  renderStats();
  renderTable();
};

/* ══════════════════════════════════════════════════════════
   RENDER STATS
   (Only wire these up if matching elements exist on the page)
══════════════════════════════════════════════════════════ */
const renderStats = () => {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('totalSchools',  state.schools.length);
  set('activeSchools', state.schools.filter(s => s.status === 'active').length);
  set('lockedSchools', state.schools.filter(s => s.status === 'locked').length);
  set('trialSchools',  state.schools.filter(s => s.subscription?.plan === 'trial').length);

  const countEl = document.getElementById('schoolsCount');
  if (countEl) countEl.textContent = `${state.schools.length} school${state.schools.length === 1 ? '' : 's'}`;
};

/* ══════════════════════════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════════════════════════ */
const renderTable = () => {
  const tbody = document.getElementById('schoolsTableBody');
  if (!tbody) return;

  let schools = [...state.schools];

  /* Search filter */
  const search = document.getElementById('schoolSearch')?.value?.toLowerCase();
  if (search) {
    schools = schools.filter(s =>
      s.schoolName?.toLowerCase().includes(search) ||
      s.adminEmail?.toLowerCase().includes(search)
    );
  }

  /* Status filter */
  const status = document.getElementById('schoolStatusFilter')?.value;
  if (status && status !== 'all') {
    schools = schools.filter(s => s.status === status);
  }

  if (!schools.length) {
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:48px;color:var(--text-soft);">
        <i class="fas fa-school" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.2;"></i>
        No schools found.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = schools.map((s, i) => {
    const statusColours = {
      active   : { bg:'rgba(39,174,96,0.10)',  text:'#27ae60' },
      locked   : { bg:'rgba(231,76,60,0.10)',  text:'#e74c3c' },
      trial    : { bg:'rgba(243,156,18,0.10)', text:'#f39c12' },
      suspended: { bg:'rgba(142,68,173,0.10)', text:'#8e44ad' },
    };

    const col      = statusColours[s.status] || statusColours.active;
    const expiry   = s.subscription?.expiryDate
      ? new Date(s.subscription.expiryDate).toLocaleDateString('en-KE')
      : '—';
    const daysLeft = s.subscription?.expiryDate
      ? Math.ceil((new Date(s.subscription.expiryDate) - new Date()) / (1000*60*60*24))
      : null;

    const daysColour = daysLeft === null ? '#94a3b8'
      : daysLeft > 90  ? '#27ae60'
      : daysLeft > 30  ? '#f39c12'
      : '#e74c3c';

    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div>
            <p style="font-weight:600;color:var(--text-dark);">${s.schoolName}</p>
            <p style="font-size:0.78rem;color:var(--text-soft);">${s.schoolAddress || '—'}</p>
          </div>
        </td>
        <td style="font-size:0.84rem;">${s.adminEmail || '—'}</td>
        <td>
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;
            font-size:0.72rem;font-weight:700;
            background:${col.bg};color:${col.text};text-transform:capitalize;">
            ${s.status}
          </span>
        </td>
        <td style="text-transform:capitalize;">${s.subscription?.plan || 'standard'}</td>
        <td>${s.studentCount || 0}</td>
        <td style="font-size:0.82rem;">${expiry}</td>
        <td style="font-weight:700;color:${daysColour};">
          ${daysLeft !== null ? daysLeft + 'd' : '—'}
        </td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button onclick="openEditModal('${s._id}')"
              style="padding:5px 10px;border-radius:6px;border:1px solid var(--border-input);
              background:white;cursor:pointer;font-size:0.75rem;color:var(--text-mid);">
              <i class="fas fa-pen"></i>
            </button>
            ${s.status === 'active' || s.status === 'trial'
              ? `<button onclick="openLockModal('${s._id}')"
                  style="padding:5px 10px;border-radius:6px;border:1px solid rgba(231,76,60,0.3);
                  background:rgba(231,76,60,0.08);cursor:pointer;font-size:0.75rem;color:#e74c3c;">
                  <i class="fas fa-lock"></i>
                </button>`
              : `<button onclick="unlockSchool('${s._id}')"
                  style="padding:5px 10px;border-radius:6px;border:1px solid rgba(39,174,96,0.3);
                  background:rgba(39,174,96,0.08);cursor:pointer;font-size:0.75rem;color:#27ae60;">
                  <i class="fas fa-lock-open"></i>
                </button>`
            }
            <button onclick="openExtendModal('${s._id}')"
              style="padding:5px 10px;border-radius:6px;border:1px solid rgba(46,134,193,0.3);
              background:rgba(46,134,193,0.08);cursor:pointer;font-size:0.75rem;color:#2e86c1;">
              <i class="fas fa-calendar-plus"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
};

/* ══════════════════════════════════════════════════════════
   ADD / EDIT SCHOOL MODAL
══════════════════════════════════════════════════════════ */
const openAddModal = () => {
  state.editingId = null;
  const title = document.getElementById('schoolModalTitle');
  if (title) title.textContent = 'Add New School';
  clearModalFields();
  openModal('addSchoolModalOverlay');
};

const openEditModal = (id) => {
  const school = state.schools.find(s => s._id === id);
  if (!school) return;
  state.editingId = id;

  const title = document.getElementById('schoolModalTitle');
  if (title) title.textContent = 'Edit School';

  setField('newSchoolName',   school.schoolName);
  setField('newSchoolMotto',  school.schoolMotto);
  setField('newSchoolEmail',  school.schoolEmail);
  setField('newAdminName',    school.adminName);
  setField('newAdminEmail',   school.adminEmail);
  setField('newSchoolPlan',   school.subscription?.plan || 'standard');
  setField('newSchoolExpiry', school.subscription?.expiryDate
    ? new Date(school.subscription.expiryDate).toISOString().split('T')[0]
    : '');

  openModal('addSchoolModalOverlay');
};

const clearModalFields = () => {
  ['newSchoolName','newSchoolMotto','newSchoolEmail','newAdminName','newAdminEmail','newAdminPassword','newSchoolExpiry']
    .forEach(id => setField(id, ''));
  setField('newSchoolPlan', 'standard');
};

const setField = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
};

const saveSchool = async () => {
  const schoolName    = document.getElementById('newSchoolName')?.value.trim();
  const schoolMotto   = document.getElementById('newSchoolMotto')?.value.trim();
  const schoolEmail   = document.getElementById('newSchoolEmail')?.value.trim();
  const adminName     = document.getElementById('newAdminName')?.value.trim();
  const adminEmail    = document.getElementById('newAdminEmail')?.value.trim();
  const adminPassword = document.getElementById('newAdminPassword')?.value;
  const plan          = document.getElementById('newSchoolPlan')?.value || 'standard';
  const expiryDate    = document.getElementById('newSchoolExpiry')?.value;

  if (!schoolName) { showToast('School name is required.', 'warning'); return; }
  if (!adminName)  { showToast('Admin full name is required.', 'warning'); return; }
  if (!adminEmail) { showToast('Admin email is required.', 'warning'); return; }

  /* Password only required when creating a new school, not when editing */
  if (!state.editingId) {
    if (!adminPassword) {
      showToast('Please set an admin password.', 'warning');
      return;
    }
    if (adminPassword.length < 8) {
      showToast('Password must be at least 8 characters.', 'warning');
      return;
    }
  }

  const btn = document.getElementById('saveNewSchoolBtn');
  if (btn) btn.disabled = true;

  const payload = { schoolName, schoolMotto, schoolEmail, adminName, adminEmail, adminPassword, plan, expiryDate };

  let result;
  if (state.editingId) {
    result = await API.put(`/superadmin/schools/${state.editingId}`, payload);
  } else {
    result = await API.post('/superadmin/schools', payload);
  }

  if (btn) btn.disabled = false;

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to save school.', 'error');
    return;
  }

  closeModal('addSchoolModalOverlay');
  showToast(
    state.editingId ? 'School updated successfully.' : `School created. Admin can log in with ${adminEmail}.`,
    'success'
  );
  loadSchools();
};

/* ══════════════════════════════════════════════════════════
   LOCK / UNLOCK
══════════════════════════════════════════════════════════ */
const openLockModal = (id) => {
  const school = state.schools.find(s => s._id === id);
  if (!school) return;
  state.lockId = id;

  const nameEl = document.getElementById('lockSchoolName');
  if (nameEl) nameEl.textContent = school.schoolName;

  const reasonInput = document.getElementById('lockReason');
  if (reasonInput) reasonInput.value = '';

  openModal('lockModalOverlay');
};

const confirmLock = async () => {
  if (!state.lockId) return;
  const reason = document.getElementById('lockReason')?.value.trim();

  const btn = document.getElementById('confirmLockBtn');
  if (btn) btn.disabled = true;

  const result = await API.patch(`/superadmin/schools/${state.lockId}/lock`, { reason });

  if (btn) btn.disabled = false;

  if (!result?.ok) { showToast('Failed to lock school.', 'error'); return; }

  showToast('School locked.', 'success');
  closeModal('lockModalOverlay');
  state.lockId = null;
  loadSchools();
};

window.unlockSchool = async (id) => {
  const result = await API.patch(`/superadmin/schools/${id}/unlock`);
  if (!result?.ok) { showToast('Failed to unlock school.', 'error'); return; }
  showToast('School unlocked.', 'success');
  loadSchools();
};

/* ══════════════════════════════════════════════════════════
   EXTEND SUBSCRIPTION
══════════════════════════════════════════════════════════ */
const openExtendModal = (id) => {
  const school = state.schools.find(s => s._id === id);
  if (!school) return;
  state.extendId = id;

  const nameEl = document.getElementById('extendSchoolName');
  if (nameEl) nameEl.textContent = school.schoolName;

  setField('extendMonths', '12');
  setField('extendPlan', '');

  openModal('extendModalOverlay');
};

const confirmExtend = async () => {
  if (!state.extendId) return;

  const months = Number(document.getElementById('extendMonths')?.value || 12);
  const plan   = document.getElementById('extendPlan')?.value || undefined;

  const btn = document.getElementById('confirmExtendBtn');
  if (btn) btn.disabled = true;

  const result = await API.patch(`/superadmin/schools/${state.extendId}/extend`, { months, plan });

  if (btn) btn.disabled = false;

  if (!result?.ok) { showToast('Failed to extend subscription.', 'error'); return; }

  showToast(`Subscription extended by ${months} month${months === 1 ? '' : 's'}.`, 'success');
  closeModal('extendModalOverlay');
  state.extendId = null;
  loadSchools();
};

/* ══════════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════════ */
const openModal = (id) => {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeModal = (id) => {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
};

/* ══════════════════════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════════════════════ */
document.getElementById('addSchoolBtn')?.addEventListener('click', openAddModal);
document.getElementById('saveNewSchoolBtn')?.addEventListener('click', saveSchool);
document.getElementById('closeAddSchool')?.addEventListener('click', () => closeModal('addSchoolModalOverlay'));
document.getElementById('cancelAddSchool')?.addEventListener('click', () => closeModal('addSchoolModalOverlay'));

document.getElementById('closeCredentials')?.addEventListener('click', () => closeModal('credentialsModalOverlay'));
document.getElementById('closeCredentialsBtn')?.addEventListener('click', () => closeModal('credentialsModalOverlay'));
document.getElementById('copyCredentialsBtn')?.addEventListener('click', () => {
  const email    = document.getElementById('credentialsEmail')?.value || '';
  const password = document.getElementById('credentialsPassword')?.value || '';
  const text     = `Email: ${email}\nPassword: ${password}`;
  navigator.clipboard?.writeText(text)
    .then(() => showToast('Copied to clipboard.', 'success'))
    .catch(() => showToast('Could not copy — please copy manually.', 'warning'));
});

document.getElementById('closeLock')?.addEventListener('click', () => closeModal('lockModalOverlay'));
document.getElementById('cancelLock')?.addEventListener('click', () => closeModal('lockModalOverlay'));
document.getElementById('confirmLockBtn')?.addEventListener('click', confirmLock);

document.getElementById('closeExtend')?.addEventListener('click', () => closeModal('extendModalOverlay'));
document.getElementById('cancelExtend')?.addEventListener('click', () => closeModal('extendModalOverlay'));
document.getElementById('confirmExtendBtn')?.addEventListener('click', confirmExtend);

document.getElementById('schoolSearch')?.addEventListener('input', () => renderTable());
document.getElementById('schoolStatusFilter')?.addEventListener('change', () => renderTable());

window.openEditModal   = openEditModal;
window.openLockModal   = openLockModal;
window.openExtendModal = openExtendModal;

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
loadSchools();
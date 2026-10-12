/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Manage Users (school admin)
   File: js/users.js

   The admin can:
     • see every admin / teacher of THEIR school
     • add a teacher and set the teacher's password
     • edit a teacher's name, email and phone
     • reset a teacher's password
     • activate / deactivate a teacher
═══════════════════════════════════════════════════════════ */

const user = requireAuth(['admin']);
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const state = { users: [], editingId: null, resetId: null };

const byId = (id) => document.getElementById(id);

/* Escape text before putting it into HTML */
const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const AV_COLOURS = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = (name = '') =>
  name.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const getAvColour = (name = '') => AV_COLOURS[name.charCodeAt(0) % AV_COLOURS.length];

/* ══════════════════════════════════════════════════════════
   SMALL HELPERS
══════════════════════════════════════════════════════════ */
const MIN_PASSWORD = 8;

/* Random, easy-to-read password (no 0/O, 1/l/I) */
const makePassword = (length = 10) => {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all    = upper + lower + digits;
  const rnd    = (n) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  };
  const pick = (set) => set[rnd(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const openModal = (id) => {
  byId(id).classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeModal = (id) => {
  byId(id).classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
};

const setBusy = (btn, busy, busyLabel, idleLabel) => {
  btn.disabled = busy;
  btn.innerHTML = busy
    ? `<i class="fas fa-spinner fa-spin"></i> ${busyLabel}`
    : idleLabel;
};

const showFormError = (id, message) => {
  const el = byId(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.display = message ? 'block' : 'none';
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

/* Show / hide a password input */
const wireEye = (btnId, inputId) => {
  byId(btnId)?.addEventListener('click', () => {
    const input = byId(inputId);
    const show  = input.type === 'password';
    input.type  = show ? 'text' : 'password';
    byId(btnId).querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
  });
};

/* ══════════════════════════════════════════════════════════
   LOAD + RENDER
══════════════════════════════════════════════════════════ */
const loadUsers = async () => {
  const result = await API.get('/users');

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to load users.', 'error');
    return;
  }

  state.users = result.data.users || [];
  renderStats();
  renderTable();
};

const renderStats = () => {
  const set = (id, val) => { const e = byId(id); if (e) e.textContent = val; };
  set('totalUsers',    state.users.length);
  set('totalAdmins',   state.users.filter(u => u.role === 'admin').length);
  set('totalTeachers', state.users.filter(u => u.role === 'teacher').length);
  set('activeUsers',   state.users.filter(u => u.isActive).length);
};

/* Inline SVG icons: they work even if the Font Awesome CDN is slow or
   blocked, so the action buttons can never turn into blank boxes. */
const ICONS = {
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  key : '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  off : '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>',
  on  : '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
};
const svgIcon = (name) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const actionBtn = (action, id, icon, label, extra = '') => `
  <button type="button" class="u-act ${extra}" data-action="${action}" data-id="${esc(id)}"
    title="${label}" aria-label="${label}">
    ${svgIcon(icon)}
  </button>`;

const renderTable = () => {
  const tbody = byId('usersTableBody');
  if (!tbody) return;

  if (!state.users.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text-soft);">
        <i class="fas fa-users" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.3;"></i>
        No users found. Add a teacher to get started.
      </td></tr>`;
    return;
  }

  const roleColours = {
    admin  : { bg: 'rgba(46,134,193,0.10)', text: '#1a6fa8' },
    teacher: { bg: 'rgba(39,174,96,0.10)',  text: '#1e8449' },
  };

  tbody.innerHTML = state.users.map((u, i) => {
    const col = roleColours[u.role] || { bg: 'rgba(209,220,235,0.4)', text: '#94a3b8' };

    const lastLogin = u.lastLogin
      ? new Date(u.lastLogin).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Never';

    const actions = u.role === 'teacher'
      ? `<div class="u-acts">
           ${actionBtn('edit',  u._id, 'edit', 'Edit details')}
           ${actionBtn('reset', u._id, 'key',  'Reset password')}
           ${actionBtn('toggle', u._id,
              u.isActive ? 'off' : 'on',
              u.isActive ? 'Deactivate'    : 'Activate',
              u.isActive ? '' : 'u-act-go')}
         </div>`
      : '<span style="color:#94a3b8;font-size:0.78rem;">—</span>';

    return `
      <tr${u.isActive ? '' : ' style="opacity:0.6;"'}>
        <td>${i + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:0.74rem;font-weight:700;color:white;flex-shrink:0;"
              class="${getAvColour(u.fullName)}">
              ${esc(getInitials(u.fullName))}
            </div>
            <div>
              <p style="font-weight:600;color:var(--text-dark);font-size:0.875rem;">${esc(u.fullName)}</p>
              <p style="font-size:0.72rem;color:var(--text-soft);">${esc(u.phone || '')}</p>
            </div>
          </div>
        </td>
        <td style="font-size:0.84rem;">${esc(u.email)}</td>
        <td>
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;
            background:${col.bg};color:${col.text};text-transform:capitalize;">
            ${esc(u.role)}
          </span>
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;font-weight:600;
            color:${u.isAccountSetup ? '#27ae60' : '#e67e22'};">
            <i class="fas ${u.isAccountSetup ? 'fa-circle-check' : 'fa-clock'}"></i>
            ${u.isAccountSetup ? 'Complete' : 'Pending'}
          </span>
        </td>
        <td style="font-size:0.80rem;color:var(--text-soft);">${lastLogin}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;
            background:${u.isActive ? 'rgba(39,174,96,0.10)' : 'rgba(209,220,235,0.4)'};
            color:${u.isActive ? '#27ae60' : '#94a3b8'};">
            <i class="fas fa-circle" style="font-size:7px;"></i>
            ${u.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="u-sticky">${actions}</td>
      </tr>`;
  }).join('');
};

/* ══════════════════════════════════════════════════════════
   ADD / EDIT TEACHER
══════════════════════════════════════════════════════════ */
const resetTeacherForm = () => {
  ['teacherName', 'teacherEmail', 'teacherPhone', 'teacherPassword'].forEach(id => { byId(id).value = ''; });
  byId('teacherPassword').type = 'password';
  byId('eyeAdd').querySelector('i').className = 'fas fa-eye';
  showFormError('teacherFormError', '');
};

const openAddTeacher = () => {
  state.editingId = null;
  resetTeacherForm();
  byId('teacherModalTitle').textContent = 'Add Teacher';
  byId('teacherModalSub').textContent   = 'Create the account and set the teacher’s password';
  byId('passwordGroup').style.display   = '';
  byId('saveTeacherBtn').innerHTML      = '<i class="fas fa-user-plus"></i> Create Account';
  openModal('teacherModalOverlay');
  byId('teacherName').focus();
};

const openEditTeacher = (id) => {
  const u = state.users.find(x => x._id === id);
  if (!u) return;
  state.editingId = id;
  resetTeacherForm();
  byId('teacherName').value  = u.fullName || '';
  byId('teacherEmail').value = u.email    || '';
  byId('teacherPhone').value = u.phone    || '';
  byId('teacherModalTitle').textContent = 'Edit Teacher';
  byId('teacherModalSub').textContent   = 'Update the teacher’s details';
  byId('passwordGroup').style.display   = 'none';
  byId('saveTeacherBtn').innerHTML      = '<i class="fas fa-floppy-disk"></i> Save Changes';
  openModal('teacherModalOverlay');
  byId('teacherName').focus();
};

const saveTeacher = async () => {
  showFormError('teacherFormError', '');

  const fullName = byId('teacherName').value.trim();
  const email    = byId('teacherEmail').value.trim();
  const phone    = byId('teacherPhone').value.trim();
  const password = byId('teacherPassword').value;
  const editing  = !!state.editingId;

  if (!fullName || !email) {
    showFormError('teacherFormError', 'Name and email are required.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormError('teacherFormError', 'Please enter a valid email address.');
    return;
  }
  if (!editing && password && password.length < MIN_PASSWORD) {
    showFormError('teacherFormError', `Password must be at least ${MIN_PASSWORD} characters.`);
    return;
  }

  const btn  = byId('saveTeacherBtn');
  const idle = btn.innerHTML;
  setBusy(btn, true, editing ? 'Saving...' : 'Creating...', idle);

  const result = editing
    ? await API.put(`/users/${state.editingId}`, { fullName, email, phone })
    : await API.post('/users/teachers', { fullName, email, phone, password });

  setBusy(btn, false, '', idle);

  if (!result?.ok) {
    showFormError('teacherFormError', result?.data?.message || 'Something went wrong. Please try again.');
    return;
  }

  closeModal('teacherModalOverlay');
  loadUsers();

  if (editing) {
    showToast('Teacher details updated.', 'success');
  } else {
    showCredentials({
      title  : 'Teacher account created',
      name   : fullName,
      email  : result.data.credentials.email,
      password: result.data.credentials.password,
    });
  }
};

/* ══════════════════════════════════════════════════════════
   RESET PASSWORD
══════════════════════════════════════════════════════════ */
const openReset = (id) => {
  const u = state.users.find(x => x._id === id);
  if (!u) return;
  state.resetId = id;
  byId('resetName').textContent = u.fullName;
  byId('resetPassword').value   = '';
  byId('resetPassword').type    = 'password';
  byId('eyeReset').querySelector('i').className = 'fas fa-eye';
  showFormError('resetFormError', '');
  openModal('resetModalOverlay');
  byId('resetPassword').focus();
};

const submitReset = async () => {
  showFormError('resetFormError', '');
  const password = byId('resetPassword').value;

  if (password && password.length < MIN_PASSWORD) {
    showFormError('resetFormError', `Password must be at least ${MIN_PASSWORD} characters.`);
    return;
  }

  const u    = state.users.find(x => x._id === state.resetId);
  const btn  = byId('saveResetBtn');
  const idle = btn.innerHTML;
  setBusy(btn, true, 'Resetting...', idle);

  const result = await API.post(`/users/${state.resetId}/reset-password`, { password });

  setBusy(btn, false, '', idle);

  if (!result?.ok) {
    showFormError('resetFormError', result?.data?.message || 'Could not reset the password.');
    return;
  }

  closeModal('resetModalOverlay');
  showCredentials({
    title   : 'Password reset',
    name    : u?.fullName || '',
    email   : result.data.credentials.email,
    password: result.data.credentials.password,
  });
};

/* ══════════════════════════════════════════════════════════
   CREDENTIALS PANEL (shown once after create / reset)
══════════════════════════════════════════════════════════ */
const loginUrl = () => `${window.location.origin}/pages/login.html`;

const showCredentials = ({ title, name, email, password }) => {
  byId('credsTitle').textContent    = title;
  byId('credsName').textContent     = name;
  byId('credsUrl').textContent      = loginUrl();
  byId('credsEmail').textContent    = email;
  byId('credsPassword').textContent = password;
  byId('copyCredsBtn').innerHTML    = '<i class="fas fa-copy"></i> Copy login details';
  openModal('credsModalOverlay');
};

const copyCredentials = async () => {
  const text =
`Scholar Analytics login details
Teacher: ${byId('credsName').textContent}
Login page: ${byId('credsUrl').textContent}
Email: ${byId('credsEmail').textContent}
Password: ${byId('credsPassword').textContent}`;

  const ok  = await copyText(text);
  const btn = byId('copyCredsBtn');
  btn.innerHTML = ok
    ? '<i class="fas fa-check"></i> Copied!'
    : '<i class="fas fa-triangle-exclamation"></i> Copy failed — select the text instead';
};

/* ══════════════════════════════════════════════════════════
   ACTIVATE / DEACTIVATE
══════════════════════════════════════════════════════════ */
const toggleTeacher = async (id) => {
  const u = state.users.find(x => x._id === id);
  if (!u) return;

  if (u.isActive && !confirm(`Deactivate ${u.fullName}? They will not be able to sign in until you activate them again.`)) {
    return;
  }

  const result = await API.patch(`/users/${id}/toggle`);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to update the account.', 'error');
    return;
  }

  showToast(result.data.message || 'Account updated.', 'success');
  loadUsers();
};

/* ══════════════════════════════════════════════════════════
   EVENTS
══════════════════════════════════════════════════════════ */
byId('addTeacherBtn')?.addEventListener('click', openAddTeacher);

byId('teacherModalClose')?.addEventListener('click',  () => closeModal('teacherModalOverlay'));
byId('teacherModalCancel')?.addEventListener('click', () => closeModal('teacherModalOverlay'));
byId('saveTeacherBtn')?.addEventListener('click', saveTeacher);

byId('genPasswordBtn')?.addEventListener('click', () => {
  const pw = makePassword();
  const input = byId('teacherPassword');
  input.value = pw;
  input.type  = 'text';
  byId('eyeAdd').querySelector('i').className = 'fas fa-eye-slash';
  showFormError('teacherFormError', '');
});

byId('resetModalClose')?.addEventListener('click',  () => closeModal('resetModalOverlay'));
byId('resetModalCancel')?.addEventListener('click', () => closeModal('resetModalOverlay'));
byId('saveResetBtn')?.addEventListener('click', submitReset);
byId('genResetBtn')?.addEventListener('click', () => {
  const input = byId('resetPassword');
  input.value = makePassword();
  input.type  = 'text';
  byId('eyeReset').querySelector('i').className = 'fas fa-eye-slash';
  showFormError('resetFormError', '');
});

byId('credsModalClose')?.addEventListener('click', () => closeModal('credsModalOverlay'));
byId('credsDoneBtn')?.addEventListener('click',    () => closeModal('credsModalOverlay'));
byId('copyCredsBtn')?.addEventListener('click', copyCredentials);

wireEye('eyeAdd',   'teacherPassword');
wireEye('eyeReset', 'resetPassword');

/* Table buttons (one listener for the whole table) */
byId('usersTableBody')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'edit')   openEditTeacher(id);
  if (action === 'reset')  openReset(id);
  if (action === 'toggle') toggleTeacher(id);
});

/* Press Enter in a form field to submit; Esc closes the top modal */
['teacherName', 'teacherEmail', 'teacherPhone', 'teacherPassword'].forEach(id => {
  byId(id)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveTeacher(); });
});
byId('resetPassword')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitReset(); });

/* Hide an old error as soon as the admin starts correcting it */
['teacherName', 'teacherEmail', 'teacherPhone', 'teacherPassword'].forEach(id => {
  byId(id)?.addEventListener('input', () => showFormError('teacherFormError', ''));
});
byId('resetPassword')?.addEventListener('input', () => showFormError('resetFormError', ''));

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = document.querySelectorAll('.modal-overlay.open');
  if (open.length) closeModal(open[open.length - 1].id);
});

loadUsers();
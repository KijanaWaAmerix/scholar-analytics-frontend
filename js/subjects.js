/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Subjects Page
   File: js/subjects.js
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const state = {
  subjects   : [],
  classes    : [],
  selectedClass: null,
  editingId  : null,
};

/* How many standard learning areas a class gets, by grade (must match the backend list) */
const standardCount = (cls) => {
  const g = Number(cls?.grade);
  if (g >= 1 && g <= 3) return 7;
  if (g >= 4 && g <= 6) return 8;
  return 9;
};
const seedLabel = (cls) => cls ? `Add ${standardCount(cls)} Standard Subjects` : 'Add Standard Subjects';
const setSeedButton = (cls, busy) => {
  const btn = document.getElementById('seedSubjectsBtn');
  if (!btn) return;
  btn.disabled = !!busy;
  btn.innerHTML = busy
    ? '<i class="fas fa-spinner fa-spin"></i> Adding...'
    : `<i class="fas fa-wand-magic-sparkles"></i> ${seedLabel(cls)}`;
};

/* Load classes into filter dropdown */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;

  state.classes = result.data.classes || [];

  const sel = document.getElementById('classFilter');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- Select Class --</option>';
  state.classes.forEach(cls => {
    sel.innerHTML += `<option value="${cls._id}">${cls.name}</option>`;
  });

  /* Check URL params for pre-selected class */
  const params  = new URLSearchParams(window.location.search);
  const classId = params.get('class');
  if (classId) {
    sel.value = classId;
    loadSubjects(classId);
  }
};

/* Load subjects for selected class */
const loadSubjects = async (classId) => {
  state.selectedClass = classId;

  const cls = state.classes.find(c => c._id === classId);

  document.getElementById('pageSubtitle').textContent =
    cls ? `Subjects for ${cls.name}` : 'Select a class';

  document.getElementById('seedSubjectsBtn').style.display = 'inline-flex';
  setSeedButton(cls);
  document.getElementById('addSubjectBtn').style.display   = 'inline-flex';

  document.getElementById('subjectsCard').style.display        = 'block';
  document.getElementById('subjectsPlaceholder').style.display = 'none';

  const tbody = document.getElementById('subjectsTableBody');
  if (tbody) tbody.innerHTML = `
    <tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-soft);">
      <i class="fas fa-spinner fa-spin"></i> Loading...
    </td></tr>`;

  const result = await API.get(`/subjects?class=${classId}`);
  if (!result?.ok) {
    showToast('Failed to load subjects.', 'error');
    return;
  }

  state.subjects = result.data.subjects || [];
  renderTable();
};

/* Render subjects table */
const renderTable = () => {
  const tbody = document.getElementById('subjectsTableBody');
  if (!tbody) return;

  if (!state.subjects.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-soft);">
        <i class="fas fa-book-open" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3;"></i>
        No subjects yet. Click "${document.getElementById('seedSubjectsBtn')?.textContent.trim() || 'Add Standard Subjects'}" to add the standard learning areas for this class.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = state.subjects.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><code style="background:rgba(26,82,118,0.08);color:var(--primary);padding:3px 8px;border-radius:5px;font-size:0.80rem;font-weight:700;">${s.code}</code></td>
      <td><strong>${s.name}</strong></td>
      <td><span style="font-size:0.78rem;color:var(--text-soft);">${s.learningArea || '—'}</span></td>
      <td>${s.teacher?.fullName || '<span style="color:#94a3b8;">Not assigned</span>'}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;
          background:${s.isActive ? 'rgba(39,174,96,0.10)' : 'rgba(209,220,235,0.4)'};
          color:${s.isActive ? '#27ae60' : '#94a3b8'};">
          <i class="fas fa-circle" style="font-size:7px;"></i>
          ${s.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <button onclick="openEditModal('${s._id}')"
          style="padding:6px 12px;border-radius:6px;border:1px solid var(--border-input);background:white;color:var(--text-mid);cursor:pointer;font-size:0.78rem;margin-right:4px;">
          <i class="fas fa-pen"></i>
        </button>
        <button onclick="toggleSubject('${s._id}','${s.isActive}')"
          style="padding:6px 12px;border-radius:6px;border:1px solid var(--border-input);background:white;color:var(--text-mid);cursor:pointer;font-size:0.78rem;">
          <i class="fas ${s.isActive ? 'fa-eye-slash' : 'fa-eye'}"></i>
        </button>
      </td>
    </tr>`
  ).join('');
};

/* Open add modal */
const openAddModal = () => {
  if (!state.selectedClass) { showToast('Select a class first.', 'warning'); return; }
  state.editingId = null;
  document.getElementById('subjectModalTitle').textContent = 'Add Subject';
  document.getElementById('saveSubjectText').textContent   = 'Save Subject';
  document.getElementById('subjectName').value  = '';
  document.getElementById('subjectCode').value  = '';
  document.getElementById('subjectArea').value  = '';
  document.getElementById('subjectModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

/* Open edit modal */
const openEditModal = (id) => {
  const s = state.subjects.find(s => s._id === id);
  if (!s) return;
  state.editingId = id;
  document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
  document.getElementById('saveSubjectText').textContent   = 'Update Subject';
  document.getElementById('subjectName').value = s.name;
  document.getElementById('subjectCode').value = s.code;
  document.getElementById('subjectArea').value = s.learningArea || '';
  document.getElementById('subjectModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeSubjectModal = () => {
  document.getElementById('subjectModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
};

/* Save subject */
const saveSubject = async () => {
  const name = document.getElementById('subjectName').value.trim();
  const code = document.getElementById('subjectCode').value.trim().toUpperCase();
  const area = document.getElementById('subjectArea').value;

  if (!name || !code) {
    showToast('Name and code are required.', 'warning');
    return;
  }

  const btn = document.getElementById('saveSubjectBtn');
  if (btn) btn.disabled = true;

  let result;
  if (state.editingId) {
    result = await API.put(`/subjects/${state.editingId}`, { name, learningArea: area });
  } else {
    result = await API.post('/subjects', {
      name,
      code,
      classId     : state.selectedClass,
      learningArea: area,
    });
  }

  if (btn) btn.disabled = false;

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to save subject.', 'error');
    return;
  }

  showToast(state.editingId ? 'Subject updated.' : `${name} added.`, 'success');
  closeSubjectModal();
  loadSubjects(state.selectedClass);
};

/* Toggle subject active/inactive */
const toggleSubject = async (id, isActive) => {
  const result = await API.put(`/subjects/${id}`, {
    isActive: isActive === 'true' ? false : true,
  });

  if (!result?.ok) {
    showToast('Failed to update subject.', 'error');
    return;
  }

  showToast('Subject updated.', 'success');
  loadSubjects(state.selectedClass);
};

/* Seed 9 CBC subjects */
const seedSubjects = async () => {
  if (!state.selectedClass) { showToast('Select a class first.', 'warning'); return; }

  const cls = state.classes.find(c => c._id === state.selectedClass);
  setSeedButton(cls, true);

  const result = await API.post('/subjects/seed-defaults', { classId: state.selectedClass });

  setSeedButton(cls, false);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to seed subjects.', 'error');
    return;
  }

  const made = result.data.created?.length || 0;
  showToast(made ? `${made} subjects added.` : 'All standard subjects are already there.', made ? 'success' : 'info');
  loadSubjects(state.selectedClass);
};

/* Event listeners */
document.getElementById('classFilter')?.addEventListener('change', (e) => {
  if (e.target.value) loadSubjects(e.target.value);
  else {
    document.getElementById('subjectsCard').style.display        = 'none';
    document.getElementById('subjectsPlaceholder').style.display = 'block';
    document.getElementById('seedSubjectsBtn').style.display     = 'none';
    document.getElementById('addSubjectBtn').style.display       = 'none';
  }
});

document.getElementById('addSubjectBtn')?.addEventListener('click', openAddModal);
document.getElementById('seedSubjectsBtn')?.addEventListener('click', seedSubjects);
document.getElementById('saveSubjectBtn')?.addEventListener('click', saveSubject);
document.getElementById('subjectModalClose')?.addEventListener('click', closeSubjectModal);
document.getElementById('subjectModalCancel')?.addEventListener('click', closeSubjectModal);

window.openEditModal  = openEditModal;
window.toggleSubject  = toggleSubject;

loadClasses();
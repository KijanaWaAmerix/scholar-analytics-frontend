/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Students Page
   File: js/students.js  Version: 4.0
   Connected to real MongoDB backend
═══════════════════════════════════════════════════════════ */

/* ── Auth ─────────────────────────────────────────────────── */
const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
const state = {
  students  : [],
  classes   : [],
  pagination: { total:0, page:1, pages:1, limit:50 },
  filters   : { search:'', class:'', gender:'', status:'' },
  editingId : null,
  deleteId  : null,
  importing : [],
  importClassId: '',
};

/* ══════════════════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════════════════ */
const el = {
  searchInput     : document.getElementById('studentSearch'),
  filterClass     : document.getElementById('filterClass'),
  filterGender    : document.getElementById('filterGender'),
  filterStatus    : document.getElementById('filterStatus'),
  resetBtn        : document.getElementById('resetFiltersBtn'),
  addBtn          : document.getElementById('addStudentBtn'),
  importBtn       : document.getElementById('importExcelBtn'),
  exportBtn       : document.getElementById('exportCsvBtn'),
  tableBody       : document.getElementById('studentsTableBody'),
  tableCount      : document.getElementById('tableCount'),
  pagination      : document.getElementById('paginationEl'),
  totalStat       : document.getElementById('statTotal'),
  maleStat        : document.getElementById('statMale'),
  femaleStat      : document.getElementById('statFemale'),
  activeStat      : document.getElementById('statActive'),
  inactiveStat    : document.getElementById('statInactive'),
};

/* Avatar helpers */
const AV = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = n => n?.trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?';
const getAvColour = n => AV[(n?.charCodeAt(0)||0) % AV.length];

/* ══════════════════════════════════════════════════════════
   LOAD CLASSES (for dropdowns)
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;

  state.classes = result.data.classes || [];

  /* Populate filter dropdown */
  const filterSel = el.filterClass;
  if (filterSel) {
    filterSel.innerHTML = '<option value="">All Classes</option>' +
      state.classes.map(c =>
        `<option value="${c._id}">${c.name}</option>`
      ).join('');
  }

  /* Populate add/edit modal class dropdown */
  const modalSel = document.getElementById('studentClass');
  if (modalSel) {
    modalSel.innerHTML = '<option value="">-- Select Class --</option>' +
      state.classes.map(c =>
        `<option value="${c._id}">${c.name}</option>`
      ).join('');
  }

  /* Import modal class dropdown */
  const importSel = document.getElementById('importClass');
  if (importSel) {
    importSel.innerHTML = '<option value="">-- Select Class --</option>' +
      state.classes.map(c =>
        `<option value="${c._id}">${c.name}</option>`
      ).join('');
  }
};

/* ══════════════════════════════════════════════════════════
   LOAD STUDENTS FROM API
══════════════════════════════════════════════════════════ */
const loadStudents = async (page = 1) => {

  /* Show skeleton */
  if (el.tableBody) {
    el.tableBody.innerHTML = Skeleton.table(8, 8);
  }

  /* Build query */
  const params = new URLSearchParams({
    page  : page,
    limit : state.pagination.limit,
  });

  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.class)  params.set('class',  state.filters.class);
  if (state.filters.gender) params.set('gender', state.filters.gender);
  if (state.filters.status) params.set('status', state.filters.status);

  const result = await API.get(`/students?${params}`);

  if (!result?.ok) {
    showToast('Failed to load students.', 'error');
    if (el.tableBody) {
      el.tableBody.innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-soft);">
          <i class="fas fa-triangle-exclamation" style="font-size:24px;display:block;margin-bottom:10px;color:var(--danger);opacity:0.5;"></i>
          Failed to load students. Check your connection.
        </td></tr>`;
    }
    return;
  }

  state.students   = result.data.students   || [];
  state.pagination = result.data.pagination || state.pagination;
  state.pagination.page = page;

  /* Update stats */
  const stats = result.data.stats || {};
  updateStats(stats);

  /* Render */
  renderTable();
  renderPagination();
};

/* ══════════════════════════════════════════════════════════
   UPDATE STATS STRIP
══════════════════════════════════════════════════════════ */
const updateStats = (stats) => {
  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val ?? '--';
  };

  set('statTotal',    stats.total    || 0);
  set('statMale',     stats.male     || 0);
  set('statFemale',   stats.female   || 0);
  set('statActive',   stats.active   || 0);
  set('statInactive', stats.inactive || 0);
};

/* ══════════════════════════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════════════════════════ */
const renderTable = () => {
  if (!el.tableBody) return;

  if (!state.students.length) {
    el.tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:56px;color:var(--text-soft);">
          <i class="fas fa-user-graduate" style="font-size:36px;display:block;margin-bottom:14px;opacity:0.2;"></i>
          <p style="font-size:1rem;font-weight:600;color:var(--text-dark);margin-bottom:6px;">No students found</p>
          <p style="font-size:0.875rem;">
            ${state.filters.search || state.filters.class || state.filters.gender
              ? 'Try adjusting your filters.'
              : 'Click <strong>Add Learner</strong> to get started.'}
          </p>
        </td>
      </tr>`;
    if (el.tableCount) el.tableCount.textContent = '0 students';
    return;
  }

  const start = (state.pagination.page - 1) * state.pagination.limit;

  el.tableBody.innerHTML = state.students.map((s, i) => {
    const dob = s.dateOfBirth
      ? new Date(s.dateOfBirth).toLocaleDateString('en-KE', {
          day:'numeric', month:'short', year:'numeric'
        })
      : '—';

    const genderIcon  = s.gender === 'female'
      ? '<i class="fas fa-venus"  style="color:#e91e8c;font-size:11px;"></i>'
      : '<i class="fas fa-mars"   style="color:#1a6fa8;font-size:11px;"></i>';

    return `
      <tr id="row-${s._id}">

        <!-- Checkbox -->
        <td class="th-check">
          <input type="checkbox" class="student-checkbox" data-id="${s._id}"/>
        </td>

        <!-- Number -->
        <td class="th-num">${start + i + 1}</td>

        <!-- Name -->
        <td>
          <div class="student-name-cell">
            <div class="student-avatar ${getAvColour(s.fullName)}">
              ${getInitials(s.fullName)}
            </div>
            <div>
              <div class="student-name">${s.fullName}</div>
              <div class="student-dob">${dob}</div>
            </div>
          </div>
        </td>

        <!-- UPI -->
        <td>
          <span class="upi-code">${s.upiNumber || '<span style="color:var(--text-light);">Not set</span>'}</span>
        </td>

        <!-- Assessment No -->
        <td style="font-size:var(--text-sm);color:var(--text-mid);">
          ${s.assessmentNo || '—'}
        </td>

        <!-- Class -->
        <td>
          <span class="class-badge">
            <i class="fas fa-school" style="font-size:9px;"></i>
            ${s.class?.name || '—'}
          </span>
        </td>

        <!-- Gender -->
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:var(--text-sm);font-weight:600;color:var(--text-mid);text-transform:capitalize;">
            ${genderIcon} ${s.gender || '—'}
          </span>
        </td>

        <!-- Parent -->
        <td>
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--text-dark);">${s.parentName || '—'}</div>
          <div style="font-size:var(--text-xs);color:var(--text-soft);">${s.parentContact || ''}</div>
        </td>

        <!-- Status -->
        <td>
          <span class="badge ${s.isActive ? 'badge-success' : 'badge-neutral'}">
            <span class="dot"></span>
            ${s.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>

        <!-- Actions -->
        <td class="th-actions">
          <button class="action-btn edit"   onclick="openEdit('${s._id}')" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="action-btn delete" onclick="openDelete('${s._id}','${s.fullName.replace(/'/g,"\\'")}')  " title="Delete"><i class="fas fa-trash"></i></button>
        </td>

      </tr>`;
  }).join('');

  if (el.tableCount) {
    el.tableCount.textContent =
      `Showing ${state.students.length} of ${state.pagination.total} students`;
  }
};

/* ══════════════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════════════ */
const renderPagination = () => {
  const wrap = document.getElementById('paginationEl');
  if (!wrap) return;

  const { page, pages } = state.pagination;
  if (pages <= 1) { wrap.innerHTML = ''; return; }

  let html = `
    <button class="page-btn" onclick="changePage(${page-1})"
      ${page <= 1 ? 'disabled' : ''}>
      <i class="fas fa-chevron-left"></i>
    </button>`;

  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || (p >= page-1 && p <= page+1)) {
      html += `<button class="page-btn ${p === page ? 'active' : ''}"
        onclick="changePage(${p})">${p}</button>`;
    } else if (p === page-2 || p === page+2) {
      html += `<span class="page-dots">...</span>`;
    }
  }

  html += `
    <button class="page-btn" onclick="changePage(${page+1})"
      ${page >= pages ? 'disabled' : ''}>
      <i class="fas fa-chevron-right"></i>
    </button>`;

  wrap.innerHTML = html;
};

window.changePage = (p) => {
  if (p < 1 || p > state.pagination.pages) return;
  loadStudents(p);
};

/* ══════════════════════════════════════════════════════════
   FILTERS
══════════════════════════════════════════════════════════ */
let searchTimeout;

el.searchInput?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.filters.search = e.target.value.trim();
    loadStudents(1);
  }, 400);
});

el.filterClass?.addEventListener('change', (e) => {
  state.filters.class = e.target.value;
  loadStudents(1);
});

el.filterGender?.addEventListener('change', (e) => {
  state.filters.gender = e.target.value;
  loadStudents(1);
});

el.filterStatus?.addEventListener('change', (e) => {
  state.filters.status = e.target.value;
  loadStudents(1);
});

el.resetBtn?.addEventListener('click', () => {
  state.filters = { search:'', class:'', gender:'', status:'' };
  if (el.searchInput)  el.searchInput.value  = '';
  if (el.filterClass)  el.filterClass.value  = '';
  if (el.filterGender) el.filterGender.value = '';
  if (el.filterStatus) el.filterStatus.value = '';
  loadStudents(1);
});

/* ══════════════════════════════════════════════════════════
   ADD / EDIT STUDENT MODAL
══════════════════════════════════════════════════════════ */
el.addBtn?.addEventListener('click', openAdd);

function openAdd() {
  state.editingId = null;

  const title = document.getElementById('studentModalTitle');
  const sub   = document.getElementById('studentModalSub');
  if (title) title.textContent = 'Add New Learner';
  if (sub)   sub.textContent   = 'Fill in the learner details below';

  clearStudentForm();
  openModal('studentModal');
}

window.openEdit = async (id) => {
  state.editingId = id;

  const title = document.getElementById('studentModalTitle');
  const sub   = document.getElementById('studentModalSub');
  if (title) title.textContent = 'Edit Learner';
  if (sub)   sub.textContent   = 'Update learner information';

  /* Load student data */
  const result = await API.get(`/students/${id}`);
  if (!result?.ok) { showToast('Failed to load student data.', 'error'); return; }

  const s = result.data.student;

  /* Fill form */
  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.value = val || '';
  };

  set('studentFullName',    s.fullName);
  set('studentGender',      s.gender);
  set('studentDOB',         s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '');
  set('studentUPI',         s.upiNumber);
  set('studentAssessmentNo',s.assessmentNo);
  set('studentClass',       s.class?._id || '');
  set('studentParentName',  s.parentName);
  set('studentParentPhone', s.parentContact);

  const statusEl = document.getElementById('studentStatus');
  if (statusEl) statusEl.value = s.isActive ? 'active' : 'inactive';

  openModal('studentModal');
};

const clearStudentForm = () => {
  ['studentFullName','studentGender','studentDOB','studentUPI',
   'studentAssessmentNo','studentClass','studentParentName',
   'studentParentPhone','studentStatus'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.value = '';
  });
};

document.getElementById('saveStudentBtn')?.addEventListener('click', saveStudent);

async function saveStudent() {
  const fullName     = document.getElementById('studentFullName')?.value.trim();
  const gender       = document.getElementById('studentGender')?.value;
  const dateOfBirth  = document.getElementById('studentDOB')?.value;
  const upiNumber    = document.getElementById('studentUPI')?.value.trim();
  const assessmentNo = document.getElementById('studentAssessmentNo')?.value.trim();
  const classId      = document.getElementById('studentClass')?.value;
  const parentName   = document.getElementById('studentParentName')?.value.trim();
  const parentContact= document.getElementById('studentParentPhone')?.value.trim();
  const isActive     = document.getElementById('studentStatus')?.value !== 'inactive';

  /* Validation */
  if (!fullName) {
    showToast('Full name is required.', 'warning');
    document.getElementById('studentFullName')?.focus();
    return;
  }
  if (!gender)  { showToast('Please select gender.', 'warning'); return; }
  if (!classId) { showToast('Please select a class.', 'warning'); return; }

  const btn = document.getElementById('saveStudentBtn');
  if (btn) btn.disabled = true;

  const payload = {
    fullName, gender, dateOfBirth, upiNumber,
    assessmentNo, classId, parentName, parentContact, isActive,
  };

  let result;

  if (state.editingId) {
    result = await API.put(`/students/${state.editingId}`, payload);
  } else {
    result = await API.post('/students', payload);
  }

  if (btn) btn.disabled = false;

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to save student.', 'error');
    return;
  }

  showToast(
    state.editingId
      ? `${fullName} updated successfully.`
      : `${fullName} added successfully.`,
    'success'
  );

  closeModal('studentModal');
  loadStudents(state.pagination.page);
}

/* ══════════════════════════════════════════════════════════
   DELETE STUDENT
══════════════════════════════════════════════════════════ */
window.openDelete = (id, name) => {
  state.deleteId = id;
  const nameEl = document.getElementById('deleteStudentName');
  if (nameEl) nameEl.textContent = name;
  openModal('deleteStudentModal');
};

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  if (!state.deleteId) return;

  const result = await API.delete(`/students/${state.deleteId}`);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to delete student.', 'error');
    return;
  }

  showToast('Student deleted successfully.', 'success');
  closeModal('deleteStudentModal');
  state.deleteId = null;
  loadStudents(state.pagination.page);
});

/* ══════════════════════════════════════════════════════════
   EXCEL IMPORT
══════════════════════════════════════════════════════════ */
el.importBtn?.addEventListener('click', () => {
  openModal('importModal');
});

document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  /* Check SheetJS is loaded */
  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded. Please refresh.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb   = XLSX.read(ev.target.result, { type:'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);

      if (!data.length) {
        showToast('No data found in the Excel file.', 'warning');
        return;
      }

      state.importing = data;
      renderImportPreview(data);

    } catch (err) {
      showToast('Failed to read Excel file.', 'error');
    }
  };

  reader.readAsBinaryString(file);
});

const renderImportPreview = (data) => {
  const preview = document.getElementById('importPreviewTable');
  const count   = document.getElementById('importCount');

  if (count) count.textContent = `${data.length} rows found`;

  if (!preview) return;

  const headers = Object.keys(data[0]).slice(0, 6);

  preview.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:#0d3349;">
          ${headers.map(h => `<th style="padding:6px 10px;color:rgba(255,255,255,0.80);text-align:left;font-size:10px;text-transform:uppercase;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${data.slice(0,5).map((row,i) => `
          <tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #e2e8f0;">
            ${headers.map(h => `<td style="padding:6px 10px;color:#2c3e50;">${row[h]||'—'}</td>`).join('')}
          </tr>`
        ).join('')}
        ${data.length > 5 ? `<tr><td colspan="${headers.length}" style="padding:8px 10px;color:var(--text-soft);font-style:italic;">...and ${data.length - 5} more rows</td></tr>` : ''}
      </tbody>
    </table>`;
};

document.getElementById('confirmImportBtn')?.addEventListener('click', async () => {
  const classId = document.getElementById('importClass')?.value;

  if (!classId) {
    showToast('Please select a class for import.', 'warning');
    return;
  }

  if (!state.importing.length) {
    showToast('No data to import.', 'warning');
    return;
  }

  const btn = document.getElementById('confirmImportBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

  const result = await API.post('/students/bulk-import', {
    students: state.importing,
    classId,
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Confirm Import'; }

  if (!result?.ok) {
    showToast(result?.data?.message || 'Import failed.', 'error');
    return;
  }

  showToast(result.data.message, 'success');
  closeModal('importModal');
  state.importing = [];

  const fileInput = document.getElementById('importFileInput');
  if (fileInput) fileInput.value = '';

  loadStudents(1);
});

/* ══════════════════════════════════════════════════════════
   EXPORT CSV
══════════════════════════════════════════════════════════ */
el.exportBtn?.addEventListener('click', async () => {
  if (!state.students.length) {
    showToast('No students to export.', 'warning');
    return;
  }

  const rows = state.students.map(s => ({
    'Full Name'     : s.fullName,
    'UPI Number'    : s.upiNumber    || '',
    'Assessment No' : s.assessmentNo || '',
    'Class'         : s.class?.name  || '',
    'Gender'        : s.gender,
    'Date of Birth' : s.dateOfBirth
      ? new Date(s.dateOfBirth).toLocaleDateString('en-KE')
      : '',
    'Parent Name'   : s.parentName    || '',
    'Parent Contact': s.parentContact || '',
    'Status'        : s.isActive ? 'Active' : 'Inactive',
  }));

  const headers = Object.keys(rows[0]);
  const csv     = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${(r[h]||'').toString().replace(/"/g,'""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  a.href     = url;
  a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`${rows.length} students exported to CSV.`, 'success');
});

/* ══════════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════════ */
const openModal = (id) => {
  const modal = document.getElementById(id + 'Overlay') ||
                document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

const closeModal = (id) => {
  const modal = document.getElementById(id + 'Overlay') ||
                document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
};

/* Wire close buttons */
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    closeModal(btn.dataset.closeModal);
  });
});

/* ══════════════════════════════════════════════════════════
   SEED TEST STUDENTS (dev helper)
══════════════════════════════════════════════════════════ */
document.getElementById('seedStudentsBtn')?.addEventListener('click', async () => {
  if (state.classes.length === 0) {
    showToast('No classes found. Create classes first.', 'warning');
    return;
  }

  const cls = state.classes[0];
  const btn = document.getElementById('seedStudentsBtn');
  if (btn) btn.disabled = true;

  const testStudents = [
    { fullName:'Aisha Kamau',     gender:'female', upiNumber:'8N73K2P1Q4', assessmentNo:'23456780', classId:cls._id, parentName:'Grace Kamau',     parentContact:'0712345671' },
    { fullName:'Brian Ochieng',   gender:'male',   upiNumber:'2T41R5N7X8', assessmentNo:'23456781', classId:cls._id, parentName:'Peter Ochieng',    parentContact:'0722345672' },
    { fullName:'Cynthia Wanjiku', gender:'female', upiNumber:'9V63T3N1Z2', assessmentNo:'23456782', classId:cls._id, parentName:'John Mwangi',      parentContact:'0733345673' },
    { fullName:'David Kipchoge',  gender:'male',   upiNumber:'4R28P7L9S2', assessmentNo:'23456783', classId:cls._id, parentName:'Elijah Kipchoge',  parentContact:'0744345674' },
    { fullName:'Esther Njoroge',  gender:'female', upiNumber:'5Q17N8M3T6', assessmentNo:'23456784', classId:cls._id, parentName:'Samuel Njoroge',   parentContact:'0755345675' },
    { fullName:'Felix Mwenda',    gender:'male',   upiNumber:'6Y96W9R7C5', assessmentNo:'23456785', classId:cls._id, parentName:'Joseph Mwenda',    parentContact:'0766345676' },
    { fullName:'Grace Wambui',    gender:'female', upiNumber:'7X85V1Q8B4', assessmentNo:'23456786', classId:cls._id, parentName:'Thomas Wambui',    parentContact:'0777345677' },
    { fullName:'Hassan Abdi',     gender:'male',   upiNumber:'1U52S4M8Y9', assessmentNo:'23456787', classId:cls._id, parentName:'Omar Abdi',        parentContact:'0788345678' },
    { fullName:'Irene Chebet',    gender:'female', upiNumber:'9V63T3N1Z3', assessmentNo:'23456788', classId:cls._id, parentName:'Kibet Chebet',     parentContact:'0799345679' },
    { fullName:'James Otieno',    gender:'male',   upiNumber:'3K91P7N4W2', assessmentNo:'23456789', classId:cls._id, parentName:'Michael Otieno',   parentContact:'0700345680' },
  ];

  let created = 0;

  for (const s of testStudents) {
    const r = await API.post('/students', s);
    if (r?.ok) created++;
  }

  if (btn) btn.disabled = false;

  showToast(`${created} test students added to ${cls.name}.`, 'success');
  loadStudents(1);
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
const init = async () => {
  await loadClasses();
  await loadStudents(1);
};

init();
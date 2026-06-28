/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Exams Page
   File: js/exams.js
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const state = { exams: [], classes: [] };

/* Load everything */
const loadAll = async () => {
  const [examsRes, classesRes] = await Promise.all([
    API.get('/exams'),
    API.get('/classes'),
  ]);

  if (classesRes?.ok) {
    state.classes = classesRes.data.classes || [];
    populateClassDropdowns();
  }

  if (examsRes?.ok) {
    state.exams = examsRes.data.exams || [];
    renderTable();
  }
};

/* Populate class dropdowns */
const populateClassDropdowns = () => {
  ['classFilter','examClass'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(first);
    state.classes.forEach(cls => {
      sel.innerHTML += `<option value="${cls._id}">${cls.name}</option>`;
    });
  });
};

/* Render exams table */
const renderTable = (filter = {}) => {
  const tbody = document.getElementById('examsTableBody');
  if (!tbody) return;

  let exams = [...state.exams];
  if (filter.class) exams = exams.filter(e => e.class?._id === filter.class);
  if (filter.term)  exams = exams.filter(e => String(e.term) === String(filter.term));

  if (!exams.length) {
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-soft);">
        <i class="fas fa-calendar-xmark" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3;"></i>
        No exams found. Click "Add Exam" or "Seed All Exams".
      </td></tr>`;
    return;
  }

  tbody.innerHTML = exams.map((e, i) => {
    const termColours = {
      1:'rgba(46,134,193,0.10)', 2:'rgba(39,174,96,0.10)', 3:'rgba(142,68,173,0.10)',
    };
    const termTextCol = {
      1:'#1a6fa8', 2:'#1e8449', 3:'#7d3c98',
    };

    return `
      <tr>
        <td>${i+1}</td>
        <td>
          <strong>${e.name}</strong>
        </td>
        <td><span style="font-size:0.82rem;">${e.class?.name || '—'}</span></td>
        <td>
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;
            font-size:0.72rem;font-weight:700;
            background:${termColours[e.term]};color:${termTextCol[e.term]};">
            Term ${e.term}
          </span>
        </td>
        <td>${e.academicYear}</td>
        <td>
          <span style="font-weight:600;color:var(--text-dark);">${e.markCount || 0}</span>
          <span style="font-size:0.74rem;color:var(--text-soft);"> marks</span>
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;
            background:${e.isOpen ? 'rgba(39,174,96,0.10)' : 'rgba(209,220,235,0.5)'};
            color:${e.isOpen ? '#27ae60' : '#94a3b8'};">
            <i class="fas fa-circle" style="font-size:7px;"></i>
            ${e.isOpen ? 'Open' : 'Closed'}
          </span>
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:0.72rem;font-weight:700;
            background:${e.isPublished ? 'rgba(46,134,193,0.10)' : 'rgba(209,220,235,0.4)'};
            color:${e.isPublished ? '#2e86c1' : '#94a3b8'};">
            <i class="fas ${e.isPublished ? 'fa-check' : 'fa-clock'}" style="font-size:9px;"></i>
            ${e.isPublished ? 'Published' : 'Draft'}
          </span>
        </td>
        <td>
          <button onclick="toggleExam('${e._id}')"
            style="padding:5px 10px;border-radius:6px;border:1px solid var(--border-input);background:white;cursor:pointer;font-size:0.75rem;color:var(--text-mid);"
            title="${e.isOpen ? 'Close exam' : 'Reopen exam'}">
            <i class="fas ${e.isOpen ? 'fa-lock' : 'fa-lock-open'}"></i>
            ${e.isOpen ? 'Close' : 'Open'}
          </button>
        </td>
      </tr>`;
  }).join('');
};

/* Toggle exam open/closed */
const toggleExam = async (examId) => {
  const result = await API.patch(`/marks/exam/${examId}/toggle`);

  if (!result?.ok) {
    showToast('Failed to update exam.', 'error');
    return;
  }

  showToast(
    result.data.isOpen ? 'Exam opened for marks entry.' : 'Exam closed.',
    'success'
  );

  loadAll();
};

/* Save exam */
const saveExam = async () => {
  const name    = document.getElementById('examName').value;
  const classId = document.getElementById('examClass').value;
  const term    = document.getElementById('examTerm').value;
  const year    = document.getElementById('examYear').value || '2024';

  if (!name || !classId || !term) {
    showToast('Please fill all required fields.', 'warning');
    return;
  }

  const btn = document.getElementById('saveExamBtn');
  if (btn) btn.disabled = true;

  const result = await API.post('/exams', {
    name,
    classId,
    term        : Number(term),
    academicYear: year,
  });

  if (btn) btn.disabled = false;

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to create exam.', 'error');
    return;
  }

  showToast(`${name} created successfully.`, 'success');
  closeExamModal();
  loadAll();
};

/* Seed all exams */
const seedAllExams = async () => {
  const btn = document.getElementById('seedExamsBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Seeding...'; }

  const result = await API.post('/exams/seed-all', { academicYear: '2024' });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Seed All Exams'; }

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to seed exams.', 'error');
    return;
  }

  showToast(`${result.data.totalCreated} exams created.`, 'success');
  loadAll();
};

const closeExamModal = () => {
  document.getElementById('examModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
};

/* Filters */
let currentFilter = {};

document.getElementById('classFilter')?.addEventListener('change', (e) => {
  currentFilter.class = e.target.value;
  renderTable(currentFilter);
});

document.getElementById('termFilter')?.addEventListener('change', (e) => {
  currentFilter.term = e.target.value;
  renderTable(currentFilter);
});

document.getElementById('addExamBtn')?.addEventListener('click', () => {
  document.getElementById('examModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
});
document.getElementById('examModalClose')?.addEventListener('click',  closeExamModal);
document.getElementById('examModalCancel')?.addEventListener('click', closeExamModal);
document.getElementById('saveExamBtn')?.addEventListener('click',     saveExam);
document.getElementById('seedExamsBtn')?.addEventListener('click',    seedAllExams);

window.toggleExam = toggleExam;

loadAll();
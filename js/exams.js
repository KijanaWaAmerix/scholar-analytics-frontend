/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Exams Page
   File: js/exams.js   Version: 2.0
   v2.0:
   • Exam names are free text (no more fixed Opener/Midterm/Endterm).
     Names you've used before are suggested as you type.
   • An exam can be created for ONE class (e.g. Grade 7 East) or for
     a WHOLE GRADE in one go (every stream gets the same exam name,
     which is what makes whole-grade results line up).
   • Exams can be deleted — one at a time or several with the
     checkboxes. Deleting an exam also deletes its marks.
   • Classes/grades come from the backend; nothing is hard-coded.
   No change to exams.html is needed: the new controls are added
   by this file.
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const state = { exams: [], classes: [], selected: new Set() };
let currentFilter = {};

const esc = (t) => String(t ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* ══════════════════════════════════════════════════════════
   CLASS / GRADE TARGETS
   A dropdown value is either a class id ("65f…") or a whole
   grade ("grade:7"). parseTarget turns it into a list of classes.
══════════════════════════════════════════════════════════ */
const gradeGroups = () => {
  const map = {};
  state.classes.forEach(c => {
    if (c.grade === undefined || c.grade === null) return;
    (map[c.grade] = map[c.grade] || []).push(c);
  });
  return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]));
};

const parseTarget = (value) => {
  if (!value) return [];
  if (value.startsWith('grade:')) {
    const g = value.slice(6);
    return state.classes.filter(c => String(c.grade) === g);
  }
  const one = state.classes.find(c => c._id === value);
  return one ? [one] : [];
};

const classOptionsHtml = (firstLabel, wholeGradeLabelFn) => {
  const groups = gradeGroups();
  const whole = groups
    .filter(([, list]) => list.length > 0)
    .map(([g, list]) =>
      `<option value="grade:${esc(g)}">${esc(wholeGradeLabelFn(g, list))}</option>`
    ).join('');
  const single = state.classes.map(c =>
    `<option value="${c._id}">${esc(c.name)}</option>`
  ).join('');

  return `<option value="">${esc(firstLabel)}</option>` +
    (whole  ? `<optgroup label="Whole grade (all streams)">${whole}</optgroup>` : '') +
    (single ? `<optgroup label="Single class">${single}</optgroup>` : '');
};

const populateClassDropdowns = () => {
  const filter = document.getElementById('classFilter');
  if (filter) {
    const keep = filter.value;
    filter.innerHTML = classOptionsHtml(
      '-- Filter by Class --',
      (g, list) => `Whole Grade ${g} (${list.map(c => c.stream || c.name).join(' + ')})`
    );
    filter.value = keep;
  }

  const modal = document.getElementById('examClass');
  if (modal) {
    modal.innerHTML = classOptionsHtml(
      '-- Select Class or Whole Grade --',
      (g, list) => `All Grade ${g} classes (${list.map(c => c.stream || c.name).join(' + ')})`
    );
  }
};

/* ══════════════════════════════════════════════════════════
   MODAL ENHANCEMENTS (exam-name text box + labels)
══════════════════════════════════════════════════════════ */
const enhanceModal = () => {
  const old = document.getElementById('examName');
  if (old && old.tagName !== 'INPUT') {
    const input = document.createElement('input');
    input.type         = 'text';
    input.id           = 'examName';
    input.maxLength    = 50;
    input.autocomplete = 'off';
    input.placeholder  = 'e.g. Midterm, CAT 1, Mock';
    input.setAttribute('list', 'examNameList');
    input.style.cssText = old.style.cssText;

    const dl = document.createElement('datalist');
    dl.id = 'examNameList';

    old.replaceWith(input);
    input.insertAdjacentElement('afterend', dl);
  }

  const classLabel = document.getElementById('examClass')?.parentElement?.querySelector('label');
  if (classLabel) classLabel.innerHTML = 'Class or whole grade <span style="color:red;">*</span>';

  const sub = document.querySelector('#examModalOverlay .modal-subtitle');
  if (sub) sub.textContent = 'Type any exam name. Choose one class, or a whole grade to create it for every stream at once.';
};

const refreshNameSuggestions = () => {
  const dl = document.getElementById('examNameList');
  if (!dl) return;
  const names = [...new Set(state.exams.map(e => e.name).filter(Boolean))].sort();
  dl.innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
};

/* ══════════════════════════════════════════════════════════
   TABLE — adds a checkbox column + delete button per row
══════════════════════════════════════════════════════════ */
const ensureCheckboxHeader = () => {
  const tr = document.querySelector('.students-table thead tr');
  if (!tr || document.getElementById('selectAllExams')) return;
  tr.insertAdjacentHTML('afterbegin',
    `<th style="width:34px;text-align:center;">
       <input type="checkbox" id="selectAllExams" title="Select all shown" style="cursor:pointer;"/>
     </th>`);
  document.getElementById('selectAllExams').addEventListener('change', (e) => {
    visibleExams().forEach(x => e.target.checked ? state.selected.add(x._id) : state.selected.delete(x._id));
    renderTable(currentFilter);
  });
};

const ensureBulkDeleteButton = () => {
  if (document.getElementById('deleteSelectedBtn')) return;
  const host = document.querySelector('.page-header-right');
  if (!host) return;
  const btn = document.createElement('button');
  btn.id        = 'deleteSelectedBtn';
  btn.className = 'btn-secondary';
  btn.style.cssText = 'display:none;color:#c0392b;border-color:#e6b0aa;';
  btn.innerHTML = '<i class="fas fa-trash"></i> <span id="deleteSelectedText">Delete Selected</span>';
  host.insertBefore(btn, host.firstChild);
  btn.addEventListener('click', () => deleteExams([...state.selected]));
};

const updateBulkBar = () => {
  const btn = document.getElementById('deleteSelectedBtn');
  const txt = document.getElementById('deleteSelectedText');
  const n   = state.selected.size;
  if (btn) btn.style.display = n ? 'inline-flex' : 'none';
  if (txt) txt.textContent   = `Delete Selected (${n})`;

  const all = document.getElementById('selectAllExams');
  if (all) {
    const vis = visibleExams();
    const sel = vis.filter(x => state.selected.has(x._id)).length;
    all.checked       = vis.length > 0 && sel === vis.length;
    all.indeterminate = sel > 0 && sel < vis.length;
  }
};

const visibleExams = () => {
  let exams = [...state.exams];
  if (currentFilter.class) {
    const ids = parseTarget(currentFilter.class).map(c => c._id);
    exams = exams.filter(e => ids.includes(e.class?._id));
  }
  if (currentFilter.term) exams = exams.filter(e => String(e.term) === String(currentFilter.term));
  return exams;
};

const renderTable = (filter = currentFilter) => {
  currentFilter = filter;
  const tbody = document.getElementById('examsTableBody');
  if (!tbody) return;

  ensureCheckboxHeader();

  const exams = visibleExams();

  if (!exams.length) {
    tbody.innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-soft);">
        <i class="fas fa-calendar-xmark" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3;"></i>
        No exams found. Click "Add Exam" to create one.
      </td></tr>`;
    updateBulkBar();
    return;
  }

  const termColours = { 1:'rgba(46,134,193,0.10)', 2:'rgba(39,174,96,0.10)', 3:'rgba(142,68,173,0.10)' };
  const termTextCol = { 1:'#1a6fa8', 2:'#1e8449', 3:'#7d3c98' };

  tbody.innerHTML = exams.map((e, i) => `
      <tr>
        <td style="text-align:center;">
          <input type="checkbox" style="cursor:pointer;"
            ${state.selected.has(e._id) ? 'checked' : ''}
            onchange="toggleSelect('${e._id}', this.checked)"/>
        </td>
        <td>${i+1}</td>
        <td><strong>${esc(e.name)}</strong></td>
        <td><span style="font-size:0.82rem;">${esc(e.class?.name || '—')}</span></td>
        <td>
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;
            font-size:0.72rem;font-weight:700;
            background:${termColours[e.term]};color:${termTextCol[e.term]};">
            Term ${e.term}
          </span>
        </td>
        <td>${esc(e.academicYear)}</td>
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
        <td style="white-space:nowrap;">
          <button onclick="toggleExam('${e._id}')"
            style="padding:5px 10px;border-radius:6px;border:1px solid var(--border-input);background:white;cursor:pointer;font-size:0.75rem;color:var(--text-mid);"
            title="${e.isOpen ? 'Close exam' : 'Reopen exam'}">
            <i class="fas ${e.isOpen ? 'fa-lock' : 'fa-lock-open'}"></i>
            ${e.isOpen ? 'Close' : 'Open'}
          </button>
          <button onclick="deleteExam('${e._id}')"
            style="padding:5px 10px;border-radius:6px;border:1px solid #e6b0aa;background:white;cursor:pointer;font-size:0.75rem;color:#c0392b;margin-left:4px;"
            title="Delete this exam">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`
  ).join('');

  updateBulkBar();
};

/* ══════════════════════════════════════════════════════════
   LOAD
══════════════════════════════════════════════════════════ */
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
    /* drop selections for exams that no longer exist */
    const ids = new Set(state.exams.map(e => e._id));
    state.selected = new Set([...state.selected].filter(id => ids.has(id)));
    refreshNameSuggestions();
    renderTable(currentFilter);
  }
};

/* ══════════════════════════════════════════════════════════
   TOGGLE OPEN / CLOSED
══════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════
   SELECT + DELETE
══════════════════════════════════════════════════════════ */
window.toggleSelect = (id, checked) => {
  checked ? state.selected.add(id) : state.selected.delete(id);
  updateBulkBar();
};

const deleteExams = async (ids) => {
  const items = state.exams.filter(e => ids.includes(e._id));
  if (!items.length) return;

  const totalMarks = items.reduce((a, e) => a + (e.markCount || 0), 0);
  const published  = items.filter(e => e.isPublished).length;

  const list = items.slice(0, 8)
    .map(e => `• ${e.name} — ${e.class?.name || ''} (Term ${e.term}, ${e.academicYear})`)
    .join('\n');
  const more = items.length > 8 ? `\n…and ${items.length - 8} more` : '';

  const msg =
    `Delete ${items.length} exam${items.length > 1 ? 's' : ''}?\n\n${list}${more}\n\n` +
    (totalMarks
      ? `This will also permanently delete the ${totalMarks} marks entered for ${items.length > 1 ? 'them' : 'it'}.\n`
      : '') +
    (published ? `${published} of these ${published > 1 ? 'are' : 'is'} already published.\n` : '') +
    'This cannot be undone.';

  if (!confirm(msg)) return;

  const result = await API.post('/exams/delete', { examIds: items.map(e => e._id) });

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to delete exams.', 'error');
    return;
  }

  const d = result.data;
  showToast(
    `${d.deletedExams ?? items.length} exam${(d.deletedExams ?? items.length) > 1 ? 's' : ''} deleted` +
    (d.deletedMarks ? ` (${d.deletedMarks} marks removed).` : '.'),
    'success'
  );

  items.forEach(e => state.selected.delete(e._id));
  loadAll();
};

window.deleteExam = (id) => deleteExams([id]);

/* ══════════════════════════════════════════════════════════
   SAVE EXAM — one class, or every class of a grade
══════════════════════════════════════════════════════════ */
const saveExam = async () => {
  const name   = (document.getElementById('examName').value || '').trim().replace(/\s+/g, ' ');
  const target = document.getElementById('examClass').value;
  const term   = document.getElementById('examTerm').value;
  const year   = document.getElementById('examYear').value || '2024';

  if (!name || !target || !term) {
    showToast('Please fill all required fields.', 'warning');
    return;
  }
  if (name.length < 2) {
    showToast('Exam name is too short.', 'warning');
    return;
  }

  const targets = parseTarget(target);
  if (!targets.length) {
    showToast('No class found for that selection.', 'error');
    return;
  }

  const btn = document.getElementById('saveExamBtn');
  if (btn) btn.disabled = true;

  const created = [];
  const failed  = [];

  for (const cls of targets) {
    const result = await API.post('/exams', {
      name,
      classId     : cls._id,
      term        : Number(term),
      academicYear: year,
    });
    if (result?.ok) created.push(cls.name);
    else failed.push(`${cls.name}: ${result?.data?.message || 'failed'}`);
  }

  if (btn) btn.disabled = false;

  if (!created.length) {
    showToast(failed[0] || 'Failed to create exam.', 'error');
    return;
  }

  if (failed.length) {
    showToast(`"${name}" created for ${created.join(', ')}. Not created — ${failed.join('; ')}`, 'warning');
  } else {
    showToast(
      targets.length > 1
        ? `"${name}" created for ${created.join(' + ')}.`
        : `${name} created successfully.`,
      'success'
    );
  }

  closeExamModal();
  loadAll();
};

/* ══════════════════════════════════════════════════════════
   SEED ALL EXAMS (unchanged)
══════════════════════════════════════════════════════════ */
const seedAllExams = async () => {
  /* Ask which exam names to create, instead of a fixed list */
  const answer = prompt(
    'Exam names to create for EVERY class and EVERY term (comma-separated):',
    'Opener, Midterm, Endterm'
  );
  if (answer === null) return;
  const names = answer.split(',').map(n => n.trim()).filter(Boolean);
  if (!names.length) { showToast('Enter at least one exam name.', 'warning'); return; }

  const btn = document.getElementById('seedExamsBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Seeding...'; }

  const result = await API.post('/exams/seed-all', { academicYear: '2024', names });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Seed All Exams'; }

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to seed exams.', 'error');
    return;
  }

  showToast(`${result.data.totalCreated} exams created.`, 'success');
  loadAll();
};

/* ══════════════════════════════════════════════════════════
   MODAL OPEN / CLOSE
══════════════════════════════════════════════════════════ */
const openExamModal = () => {
  const name = document.getElementById('examName');
  if (name) name.value = '';
  document.getElementById('examModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  name?.focus();
};

const closeExamModal = () => {
  document.getElementById('examModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
};

/* ══════════════════════════════════════════════════════════
   FILTERS + EVENT WIRING
══════════════════════════════════════════════════════════ */
document.getElementById('classFilter')?.addEventListener('change', (e) => {
  state.selected.clear();
  currentFilter.class = e.target.value;
  renderTable(currentFilter);
});

document.getElementById('termFilter')?.addEventListener('change', (e) => {
  state.selected.clear();
  currentFilter.term = e.target.value;
  renderTable(currentFilter);
});

document.getElementById('addExamBtn')?.addEventListener('click', openExamModal);
document.getElementById('examModalClose')?.addEventListener('click',  closeExamModal);
document.getElementById('examModalCancel')?.addEventListener('click', closeExamModal);
document.getElementById('saveExamBtn')?.addEventListener('click',     saveExam);
document.getElementById('seedExamsBtn')?.addEventListener('click',    seedAllExams);

window.toggleExam = toggleExam;

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
enhanceModal();
ensureCheckboxHeader();
ensureBulkDeleteButton();
loadAll();
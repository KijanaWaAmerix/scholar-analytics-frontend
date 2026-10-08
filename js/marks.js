/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Marks Entry
   File: js/marks.js  Version: 6.0
   v6.0: enter marks for ONE class (e.g. Grade 7 East / Grade 7 West)
         or for a WHOLE GRADE at once (all streams on one sheet,
         with the stream shown under each name). Each learner's
         marks are saved to their own class automatically.
         Classes, exams and subjects all come from the backend —
         nothing is hard-coded to East/West or to exam names.
   v5.0: "ALL SUBJECTS" sheet + element IDs aligned with marks.html
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   KJSEA GRADING
══════════════════════════════════════════════════════════ */
const GRADES = [
  { grade:'EE1', min:90, max:100, points:8, css:'grade-ee1', remark:'Outstanding. Exceptional learner.' },
  { grade:'EE2', min:75, max:89,  points:7, css:'grade-ee2', remark:'Very good. Keep it up.' },
  { grade:'ME1', min:58, max:74,  points:6, css:'grade-me1', remark:'Good. Needs more practice.' },
  { grade:'ME2', min:41, max:57,  points:5, css:'grade-me2', remark:'Fair. More effort required.' },
  { grade:'AE1', min:31, max:40,  points:4, css:'grade-ae1', remark:'Approaching expectation.' },
  { grade:'AE2', min:21, max:30,  points:3, css:'grade-ae2', remark:'Needs improvement urgently.' },
  { grade:'BE1', min:11, max:20,  points:2, css:'grade-be1', remark:'Below expectation. Seek help.' },
  { grade:'BE2', min:1,  max:10,  points:1, css:'grade-be2', remark:'Below minimal. Urgent support.' },
];

const getGrade = (score) => {
  if (score === null || score === '' || score === 'A' || isNaN(score)) return null;
  const n = Number(score);
  if (n < 1 || n > 100) return null;
  return GRADES.find(g => n >= g.min && n <= g.max) || null;
};

const PASS_MARK = 41; // ME2 and above counts as a pass

/* ══════════════════════════════════════════════════════════
   SUBJECT ORDER  (ENG, MATH, KISW, INTER, SST, CRE, CAS, AGN, PRETECH)
   Add extra codes from your database to the "codes" arrays if needed.
══════════════════════════════════════════════════════════ */
const SUBJECT_ORDER = [
  { label:'ENG',     codes:['ENG'] },
  { label:'MATH',    codes:['MATH'] },
  { label:'KISW',    codes:['KISW','KIS'] },
  { label:'INTER',   codes:['INTER'] },
  { label:'SST',     codes:['SST'] },
  { label:'CRE',     codes:['CRE'] },
  { label:'CAS',     codes:['CAS'] },
  { label:'AGN',     codes:['AGN','AGR'] },
  { label:'PRETECH', codes:['PRETECH','PRT'] },
];
const orderIndex = code => {
  const i = SUBJECT_ORDER.findIndex(o => o.codes.includes((code || '').toUpperCase()));
  return i === -1 ? 99 : i;
};
const shortLabel = s => SUBJECT_ORDER[orderIndex(s.code)]?.label || s.code;

/* ══════════════════════════════════════════════════════════
   STATE
   subjects : canonical list for the selected class/grade, matched
              across streams by subject CODE:
              [{ key, code, name, ids: { classId: subjectId } }]
   targets  : per class being entered:
              { classId: { className, examId, subjectId? } }
══════════════════════════════════════════════════════════ */
const state = {
  classes: [], subjects: [],
  gradeExams: {},            // whole-grade mode: "year|name" -> { name, year, perClass:{classId:exam} }
  students: [], marks: {},
  targets: {},
  focusedRow: -1,
  hasUnsaved: false,
  saving: false,
  multi: null,               // set when "ALL SUBJECTS" is loaded
};

/* ══════════════════════════════════════════════════════════
   DOM REFS  (matched to marks.html)
══════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const el = {
  selClass: $('selClass'), selTerm: $('selTerm'), selExam: $('selExam'), selSubject: $('selSubject'),
  loadMarksBtn: $('loadMarksBtn'),
  emptyState: $('marksEmptyState'),
  sheetWrapper: $('marksSheetWrapper'),
  ctxClass: $('ctxClass'), ctxSubject: $('ctxSubject'), ctxExam: $('ctxExam'),
  progressFill: $('marksProgressFill'), progressText: $('marksProgressText'),
  saveStatus: $('marksSaveStatus'),
  quickFillVal: $('quickFillVal'), quickFillBtn: $('quickFillBtn'),
  saveBtn: $('saveMarksBtn'), saveBtnText: $('saveMarksBtnText'), saveBtnSpinner: $('saveMarksBtnSpinner'),
  saveBtnFooter: $('saveMarksBtnFooter'), clearBtn: $('clearMarksBtn'),
  unsavedBadge: $('footerUnsaved'),
  table: $('marksTable'), tableBody: $('marksTableBody'),
  statFilled: $('statFilled'), statAvg: $('statAvg'), statHighest: $('statHighest'),
  statLowest: $('statLowest'), statAbsent: $('statAbsent'), statPass: $('statPass'),
  importExcelBtn: $('importExcelBtn'), importExcelInput: $('importExcelInput'),
  importExcelBtnText: $('importExcelBtnText'),
};

const ORIGINAL_THEAD = el.table?.querySelector('thead')?.innerHTML;

const AV = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = n => n?.trim().split(' ').filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('') || '?';
const getAvColour = n => AV[(n?.charCodeAt(0) || 0) % AV.length];

const esc = (t) => String(t ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* ══════════════════════════════════════════════════════════
   CLASS / GRADE HELPERS
   Class dropdown value = a class id, or "grade:7" for a whole grade.
══════════════════════════════════════════════════════════ */
const streamLabel  = c => c.stream || c.name;
const isGradeValue = v => String(v || '').startsWith('grade:');

const gradeGroups = () => {
  const map = {};
  state.classes.forEach(c => {
    if (c.grade === undefined || c.grade === null) return;
    (map[c.grade] = map[c.grade] || []).push(c);
  });
  return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]));
};

const targetsOf = (value) => {
  if (!value) return [];
  if (isGradeValue(value)) {
    const g = value.slice(6);
    return state.classes.filter(c => String(c.grade) === g);
  }
  const one = state.classes.find(c => c._id === value);
  return one ? [one] : [];
};

const multiStream = () => Object.keys(state.targets).length > 1;
const streamTag = (st) => multiStream()
  ? `<div style="font-size:0.68rem;color:var(--text-soft);">${esc(st._stream || '')}</div>` : '';

/* ══════════════════════════════════════════════════════════
   LOAD CLASSES / EXAMS / SUBJECTS
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;
  state.classes = result.data.classes || [];

  const whole = gradeGroups()
    .filter(([, list]) => list.length > 1)
    .map(([g, list]) =>
      `<option value="grade:${esc(g)}">Grade ${esc(g)} — Whole Grade (${esc(list.map(streamLabel).join(' + '))})</option>`
    ).join('');
  const single = state.classes.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('');

  el.selClass.innerHTML = '<option value="">-- Select Class --</option>' +
    (whole  ? `<optgroup label="Whole grade (all streams together)">${whole}</optgroup>` : '') +
    (single ? `<optgroup label="Single class">${single}</optgroup>` : '');
};

const loadExams = async () => {
  const value = el.selClass.value;
  const term  = el.selTerm.value;
  if (!value || !term) return;

  const targets = targetsOf(value);
  if (!targets.length) return;

  el.selExam.innerHTML = '<option value="">Loading...</option>';

  /* ── single class: exam options are exam ids ── */
  if (!isGradeValue(value)) {
    const result = await API.get(`/exams?class=${value}&term=${term}`);
    if (!result?.ok || !result.data.exams?.length) {
      el.selExam.innerHTML = '<option value="">No exams found for this term</option>';
      return;
    }
    el.selExam.innerHTML = '<option value="">-- Select Exam --</option>' +
      result.data.exams.map(e =>
        `<option value="${e._id}">${esc(e.name)}${!e.isOpen ? ' (Closed)' : ''}</option>`
      ).join('');
    return;
  }

  /* ── whole grade: one option per exam name (year|name) that exists in EVERY class ── */
  const results = await Promise.all(targets.map(c => API.get(`/exams?class=${c._id}&term=${term}`)));

  const map = {};
  results.forEach((r, i) => {
    (r?.ok ? (r.data.exams || []) : []).forEach(e => {
      const key = `${e.academicYear}|${e.name}`;
      map[key] = map[key] || { name: e.name, year: e.academicYear, perClass: {} };
      map[key].perClass[targets[i]._id] = e;
    });
  });
  state.gradeExams = map;

  const keys = Object.keys(map).sort();
  if (!keys.length) {
    el.selExam.innerHTML = '<option value="">No exams found for this term</option>';
    return;
  }

  const manyYears = new Set(keys.map(k => map[k].year)).size > 1;

  el.selExam.innerHTML = '<option value="">-- Select Exam --</option>' + keys.map(k => {
    const x = map[k];
    const label   = esc(x.name) + (manyYears ? ` (${esc(x.year)})` : '');
    const missing = targets.filter(c => !x.perClass[c._id]);
    if (missing.length) {
      return `<option value="${esc(k)}" disabled>${label} — missing in ${esc(missing.map(streamLabel).join(', '))}</option>`;
    }
    const closed = targets.some(c => !x.perClass[c._id].isOpen);
    return `<option value="${esc(k)}">${label}${closed ? ' (Closed)' : ''}</option>`;
  }).join('');
};

const loadSubjects = async () => {
  const value = el.selClass.value;
  if (!value) return;

  const targets = targetsOf(value);
  if (!targets.length) return;

  el.selSubject.innerHTML = '<option value="">Loading...</option>';
  const results = await Promise.all(targets.map(c => API.get(`/subjects?class=${c._id}`)));

  /* Match subjects across streams by code */
  const byKey = {};
  results.forEach((r, i) => {
    (r?.ok ? (r.data.subjects || []) : []).filter(s => s.isActive).forEach(s => {
      const key  = String(s.code || s._id).toUpperCase();
      const item = byKey[key] = byKey[key] || { key, code: s.code || key, name: s.name, ids: {} };
      item.ids[targets[i]._id] = s._id;
    });
  });

  state.subjects = Object.values(byKey).sort((a, b) =>
    orderIndex(a.code) - orderIndex(b.code) || a.name.localeCompare(b.name));

  if (!state.subjects.length) {
    el.selSubject.innerHTML = '<option value="">No subjects found</option>';
    return;
  }

  el.selSubject.innerHTML =
    '<option value="">-- Select Subject --</option>' +
    '<option value="ALL">ALL SUBJECTS (ENG → PRETECH)</option>' +
    state.subjects.map(s => {
      const missing = targets.length > 1 ? targets.filter(c => !s.ids[c._id]) : [];
      const note = missing.length ? ` — not set up in ${missing.map(streamLabel).join(', ')}` : '';
      return `<option value="${esc(s.key)}">${esc(shortLabel(s))} – ${esc(s.name)}${esc(note)}</option>`;
    }).join('');
};

el.selClass.addEventListener('change', () => {
  state.subjects = [];
  el.selExam.innerHTML    = '<option value="">-- Select Exam --</option>';
  el.selSubject.innerHTML = '<option value="">-- Select Subject --</option>';
  loadExams();
  loadSubjects();
});
el.selTerm.addEventListener('change', loadExams);

/* ══════════════════════════════════════════════════════════
   HELPERS: unsaved flag, status, progress, stats
══════════════════════════════════════════════════════════ */
const setUnsaved = (flag) => {
  state.hasUnsaved = flag;
  if (el.unsavedBadge) el.unsavedBadge.style.display = flag ? 'inline-flex' : 'none';
};

const updateSaveStatus = (status) => {
  if (!el.saveStatus) return;
  el.saveStatus.className = `marks-save-status ${status}`;
  const msg = { idle:'All saved', unsaved:'Unsaved changes', saving:'Saving...', saved:'All saved ✓' };
  const span = el.saveStatus.querySelector('span');
  if (span) span.textContent = msg[status] || status;
};

/* Subjects that apply to a learner's class (ALL SUBJECTS sheet) */
const applicable = (st) => state.multi.subjects.filter(s => s.ids[st._classId]);

const allValues = () => {
  if (state.multi) {
    const m = state.multi;
    return m.students.flatMap(st => applicable(st).map(s => m.marks[st._id][s.key]));
  }
  return state.students.map(s => state.marks[s._id]);
};

const updateProgress = () => {
  const vals    = allValues();
  const total   = vals.length;
  const isFilled = v => v !== '' && v !== undefined && v !== null;
  const filled  = vals.filter(isFilled).length;
  const scores  = vals.filter(v => isFilled(v) && v !== 'A').map(Number);
  const absent  = vals.filter(v => v === 'A').length;

  const pct = total ? Math.round((filled / total) * 100) : 0;
  if (el.progressFill) {
    el.progressFill.style.width = pct + '%';
    el.progressFill.classList.toggle('complete', pct === 100);
  }
  if (el.progressText) el.progressText.textContent = `${filled} of ${total} filled`;

  if (el.statFilled)  el.statFilled.textContent  = filled;
  if (el.statAbsent)  el.statAbsent.textContent  = absent;
  if (el.statAvg)     el.statAvg.textContent     = scores.length ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) + '%' : '—';
  if (el.statHighest) el.statHighest.textContent = scores.length ? Math.max(...scores) + '%' : '—';
  if (el.statLowest)  el.statLowest.textContent  = scores.length ? Math.min(...scores) + '%' : '—';
  if (el.statPass)    el.statPass.textContent    = scores.length
    ? Math.round(scores.filter(n => n >= PASS_MARK).length / scores.length * 100) + '%' : '—';
};

const showSheet = (cls, subj, exam) => {
  if (el.emptyState)   el.emptyState.style.display   = 'none';
  if (el.sheetWrapper) el.sheetWrapper.style.display = 'block';
  if (el.ctxClass)   el.ctxClass.textContent   = cls;
  if (el.ctxSubject) el.ctxSubject.textContent = subj;
  if (el.ctxExam)    el.ctxExam.textContent    = exam;
};
const hideSheet = () => {
  if (el.emptyState)   el.emptyState.style.display   = 'flex';
  if (el.sheetWrapper) el.sheetWrapper.style.display = 'none';
};

const selectedClassLabel = () => el.selClass.selectedOptions[0]?.textContent?.trim() || 'Class';

/* ══════════════════════════════════════════════════════════
   LOAD MARK SHEET
══════════════════════════════════════════════════════════ */
el.loadMarksBtn.addEventListener('click', async () => {
  const classValue = el.selClass.value;
  const term       = el.selTerm.value;
  const examValue  = el.selExam.value;
  const subjectKey = el.selSubject.value;

  if (!classValue || !term || !examValue || !subjectKey) {
    showToast('Please select all four fields.', 'warning');
    ['selClass','selTerm','selExam','selSubject'].forEach(id => {
      const s = $(id);
      if (s && !s.value) {
        s.style.borderColor = 'var(--danger)';
        setTimeout(() => s.style.borderColor = '', 1400);
      }
    });
    return;
  }

  if (state.hasUnsaved && !confirm('You have unsaved marks. Load new sheet anyway?')) return;

  const gradeMode = isGradeValue(classValue);
  const targets   = targetsOf(classValue);

  /* Work out which exam belongs to each class */
  const plan = targets.map(c => ({
    cls   : c,
    examId: gradeMode ? state.gradeExams[examValue]?.perClass?.[c._id]?._id : examValue,
  }));

  if (!plan.length || plan.some(p => !p.examId)) {
    showToast('This exam does not exist in every selected class. Create it on the Exams page first.', 'error');
    return;
  }

  state.targets = {};
  plan.forEach(p => { state.targets[p.cls._id] = { className: p.cls.name, examId: p.examId }; });

  if (subjectKey === 'ALL') return loadAllSubjects(plan);

  /* ---- single subject ---- */
  const subj = state.subjects.find(s => s.key === subjectKey);
  if (!subj) { showToast('Subject not found.', 'error'); return; }

  const usable  = plan.filter(p => subj.ids[p.cls._id]);
  const skipped = plan.filter(p => !subj.ids[p.cls._id]);

  if (!usable.length) {
    showToast(`${subj.name} is not set up in the selected class(es).`, 'error');
    return;
  }
  if (skipped.length) {
    showToast(`${subj.name} is not set up in ${skipped.map(p => p.cls.name).join(', ')} — those learners are skipped.`, 'warning');
    skipped.forEach(p => delete state.targets[p.cls._id]);
  }

  state.multi = null;
  if (ORIGINAL_THEAD) el.table.querySelector('thead').innerHTML = ORIGINAL_THEAD;

  el.emptyState.style.display = 'none';
  el.sheetWrapper.style.display = 'block';
  el.tableBody.innerHTML = Skeleton.table(8, 8);

  const results = await Promise.all(usable.map(p =>
    API.get(`/marks/sheet?classId=${p.cls._id}&examId=${p.examId}&subjectId=${subj.ids[p.cls._id]}`)));

  const students = [];
  const marks    = {};
  const closed   = [];
  const failed   = [];
  let   examInfo = null;

  results.forEach((r, i) => {
    const p = usable[i];
    if (!r?.ok) { failed.push(`${p.cls.name}: ${r?.data?.message || 'could not load'}`); delete state.targets[p.cls._id]; return; }

    state.targets[p.cls._id].subjectId = subj.ids[p.cls._id];
    examInfo = examInfo || r.data.exam;
    if (!r.data.exam.isOpen) closed.push(p.cls.name);

    r.data.sheet.forEach(s => {
      students.push({ ...s, _classId: p.cls._id, _stream: streamLabel(p.cls) });
      marks[s._id] = s.mark ? (s.mark.absent ? 'A' : s.mark.score) : '';
    });
  });

  if (!students.length) {
    showToast(failed[0] || 'No learners found.', 'error');
    hideSheet();
    return;
  }
  if (failed.length) showToast('Some classes failed to load: ' + failed.join('; '), 'warning');
  if (closed.length) showToast(`Exam is closed in ${closed.join(', ')}. Open it in the Exams page first.`, 'warning');

  state.students = students; state.marks = marks; state.focusedRow = -1;
  setUnsaved(false);

  showSheet(selectedClassLabel(), subj.name, `${examInfo.name} (Term ${examInfo.term})`);
  renderTable();
  updateProgress();
  updateSaveStatus('idle');
  showToast(`Loaded ${students.length} learners.`, 'success');

  setTimeout(() => document.querySelector('.marks-score-input:not(:disabled)')?.focus(), 100);
});

/* ══════════════════════════════════════════════════════════
   SINGLE-SUBJECT TABLE
══════════════════════════════════════════════════════════ */
const gradeBadge = (g) => g
  ? `<span class="marks-grade-badge marks-legend-item ${g.css.replace('grade-','')}">${g.grade}</span>`
  : '<span style="color:var(--text-light);font-size:0.72rem;">--</span>';
const pointsCell = (g) => g
  ? `<span class="marks-points-val">${g.points}</span><span style="font-size:0.68rem;color:var(--text-light);">/8</span>`
  : '<span style="color:var(--text-light);">--</span>';

const renderTable = () => {
  el.tableBody.innerHTML = state.students.map((student, i) => {
    const score    = state.marks[student._id] ?? '';
    const isAbsent = score === 'A';
    const g        = isAbsent ? null : getGrade(score);

    return `
      <tr id="row-${student._id}" class="${isAbsent ? 'row-absent' : ''}" data-index="${i}">
        <td style="text-align:center;color:var(--text-light);font-size:var(--text-sm);">${i + 1}</td>
        <td>
          <div class="marks-student-cell">
            <div class="marks-student-avatar ${getAvColour(student.fullName)}">${getInitials(student.fullName)}</div>
            <div>
              <div class="marks-student-name">${esc(student.fullName)}</div>
              ${streamTag(student)}
            </div>
          </div>
        </td>
        <td><span class="marks-upi-code">${esc(student.upiNumber || '—')}</span></td>
        <td class="marks-score-cell">
          <input type="number"
            class="marks-score-input ${g ? g.css : ''} ${isAbsent ? 'absent-mode' : ''}"
            id="score-${student._id}" data-id="${student._id}" data-index="${i}"
            value="${isAbsent ? '' : score}" min="1" max="100"
            placeholder="${isAbsent ? 'ABSENT' : '0–100'}" ${isAbsent ? 'disabled' : ''} autocomplete="off"/>
        </td>
        <td style="text-align:center;" id="grade-${student._id}">
          ${isAbsent ? '<span class="marks-grade-badge" style="background:rgba(100,116,139,0.10);color:#64748b;">ABS</span>' : gradeBadge(g)}
        </td>
        <td style="text-align:center;" id="points-${student._id}">${pointsCell(g)}</td>
        <td class="marks-absent-toggle">
          <button class="marks-absent-btn ${isAbsent ? 'active' : ''}" id="absent-${student._id}"
            title="Toggle absent" onclick="toggleAbsent('${student._id}')">
            <i class="fas fa-user-slash"></i>
          </button>
        </td>
        <td id="remarks-${student._id}">
          <span class="marks-remarks-text">${g ? g.remark : isAbsent ? 'Absent — not assessed' : ''}</span>
        </td>
      </tr>`;
  }).join('');

  document.querySelectorAll('.marks-score-input').forEach(input => {
    input.addEventListener('input',   onScoreInput);
    input.addEventListener('keydown', onScoreKeydown);
    input.addEventListener('focus',   onScoreFocus);
  });
};

const onScoreInput = (e) => {
  const input = e.target;
  const id    = input.dataset.id;
  let val     = input.value;

  if (val !== '') {
    const n = parseInt(val);
    if (!isNaN(n)) {
      if (n > 100) { input.value = '100'; val = '100'; }
      if (n < 0)   { input.value = '0';   val = '0'; }
    }
  }

  state.marks[id] = val === '' ? '' : Number(val);
  setUnsaved(true);
  updateRow(id, state.marks[id]);
  updateProgress();
  updateSaveStatus('unsaved');
};

const updateRow = (id, score) => {
  const g = getGrade(score);
  const input = $(`score-${id}`);
  if (input) {
    GRADES.forEach(x => input.classList.remove(x.css));
    if (g) input.classList.add(g.css);
  }
  if ($(`grade-${id}`))   $(`grade-${id}`).innerHTML   = gradeBadge(g);
  if ($(`points-${id}`))  $(`points-${id}`).innerHTML  = pointsCell(g);
  if ($(`remarks-${id}`)) $(`remarks-${id}`).innerHTML = `<span class="marks-remarks-text">${g ? g.remark : ''}</span>`;
};

const onScoreKeydown = (e) => {
  const input = e.target;
  const idx   = parseInt(input.dataset.index);

  if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRow(idx + 1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(idx - 1); }
  if ((e.key === 'a' || e.key === 'A') && input.value === '') {
    e.preventDefault();
    toggleAbsent(input.dataset.id);
    focusRow(idx + 1);
  }
};

const focusRow = (idx) => {
  if (idx < 0 || idx >= state.students.length) return;
  const student = state.students[idx];
  const input   = $(`score-${student._id}`);
  const row     = $(`row-${student._id}`);
  if (input && !input.disabled) {
    document.querySelectorAll('.marks-table tbody tr').forEach(r => r.classList.remove('row-focused'));
    input.focus();
    input.select();
    state.focusedRow = idx;
    if (row) { row.classList.add('row-focused'); row.scrollIntoView({ block:'nearest', behavior:'smooth' }); }
  }
};

const onScoreFocus = (e) => {
  document.querySelectorAll('.marks-table tbody tr').forEach(r => r.classList.remove('row-focused'));
  $(`row-${e.target.dataset.id}`)?.classList.add('row-focused');
  state.focusedRow = parseInt(e.target.dataset.index);
};

window.toggleAbsent = (id) => {
  const wasAbsent = state.marks[id] === 'A';
  const input = $(`score-${id}`);
  const btn   = $(`absent-${id}`);
  const row   = $(`row-${id}`);

  if (wasAbsent) {
    state.marks[id] = '';
    if (input) { input.disabled = false; input.value = ''; input.placeholder = '0–100'; input.classList.remove('absent-mode'); }
    btn?.classList.remove('active');
    row?.classList.remove('row-absent');
    updateRow(id, '');
  } else {
    state.marks[id] = 'A';
    if (input) {
      input.disabled = true; input.value = ''; input.placeholder = 'ABSENT';
      GRADES.forEach(x => input.classList.remove(x.css));
      input.classList.add('absent-mode');
    }
    btn?.classList.add('active');
    row?.classList.add('row-absent');
    $(`grade-${id}`).innerHTML   = '<span class="marks-grade-badge" style="background:rgba(100,116,139,0.10);color:#64748b;">ABS</span>';
    $(`points-${id}`).innerHTML  = '<span style="color:var(--text-light);">--</span>';
    $(`remarks-${id}`).innerHTML = '<span class="marks-remarks-text">Absent — not assessed</span>';
  }

  setUnsaved(true);
  updateProgress();
  updateSaveStatus('unsaved');
};

/* ══════════════════════════════════════════════════════════
   ALL-SUBJECTS SHEET  (name + ENG … PRETECH across)
   Works for one class or a whole grade.
══════════════════════════════════════════════════════════ */
const loadAllSubjects = async (plan) => {
  const subs = state.subjects;
  if (!subs.length) { showToast('No subjects found for this selection.', 'warning'); return; }

  el.emptyState.style.display = 'none';
  el.sheetWrapper.style.display = 'block';
  el.table.querySelector('thead').innerHTML =
    `<tr><th>#</th><th>Learner Name</th>${subs.map(s => `<th>${esc(shortLabel(s))}</th>`).join('')}</tr>`;
  el.tableBody.innerHTML = Skeleton.table(8, subs.length + 2);

  /* one request per class × subject that exists in that class */
  const jobs = [];
  plan.forEach(p => subs.forEach(s => { if (s.ids[p.cls._id]) jobs.push({ p, s }); }));

  const results = await Promise.all(jobs.map(j =>
    API.get(`/marks/sheet?classId=${j.p.cls._id}&examId=${j.p.examId}&subjectId=${j.s.ids[j.p.cls._id]}`)));

  const students = [];
  const marks    = {};
  const seen     = new Set();
  const closed   = new Set();
  const failed   = [];
  let   examInfo = null;

  results.forEach((r, i) => {
    const { p, s } = jobs[i];
    if (!r?.ok) { failed.push(`${p.cls.name} ${shortLabel(s)}`); return; }

    examInfo = examInfo || r.data.exam;
    if (!r.data.exam.isOpen) closed.add(p.cls.name);

    r.data.sheet.forEach(st => {
      if (!seen.has(st._id)) {
        seen.add(st._id);
        students.push({ ...st, _classId: p.cls._id, _stream: streamLabel(p.cls) });
        marks[st._id] = {};
        subs.forEach(x => { marks[st._id][x.key] = ''; });
      }
      marks[st._id][s.key] = st.mark ? (st.mark.absent ? 'A' : st.mark.score) : '';
    });
  });

  if (!students.length) {
    showToast('Failed to load mark sheet.', 'error');
    hideSheet();
    return;
  }
  if (failed.length) showToast('Could not load: ' + failed.join(', '), 'warning');
  if (closed.size)   showToast(`Exam is closed in ${[...closed].join(', ')}.`, 'warning');

  state.multi    = { subjects: subs, students, marks };
  state.students = students;
  setUnsaved(false);

  showSheet(selectedClassLabel(), 'ALL SUBJECTS', `${examInfo.name} (Term ${examInfo.term})`);
  renderMultiTable();
  updateProgress();
  updateSaveStatus('idle');
  showToast(`Loaded ${students.length} learners.`, 'success');
  document.querySelector('.multi-input')?.focus();
};

const renderMultiTable = () => {
  const m = state.multi;

  el.table.querySelector('thead').innerHTML = `<tr>
    <th class="col-num">#</th><th class="col-name">Learner Name</th>
    ${m.subjects.map(s => `<th style="text-align:center;">${esc(shortLabel(s))}</th>`).join('')}
  </tr>`;

  el.tableBody.innerHTML = m.students.map((st, r) => `
    <tr>
      <td style="text-align:center;">${r + 1}</td>
      <td>
        <div class="marks-student-cell">
          <div class="marks-student-avatar ${getAvColour(st.fullName)}">${getInitials(st.fullName)}</div>
          <div>
            <div class="marks-student-name">${esc(st.fullName)}</div>
            ${streamTag(st)}
          </div>
        </div>
      </td>
      ${m.subjects.map((s, c) => {
        if (!s.ids[st._classId]) {
          return `<td style="text-align:center;color:var(--text-light);" title="Not set up in this class">—</td>`;
        }
        const v = m.marks[st._id][s.key];
        const g = getGrade(v);
        return `<td style="text-align:center;">
          <input type="text" inputmode="numeric" autocomplete="off" placeholder="–"
            class="marks-score-input multi-input ${g ? g.css : ''}"
            style="width:64px;text-align:center;"
            data-student="${st._id}" data-subject="${esc(s.key)}" data-r="${r}" data-c="${c}"
            value="${esc(v ?? '')}"/></td>`;
      }).join('')}
    </tr>`).join('');

  document.querySelectorAll('.multi-input').forEach(inp => {
    inp.addEventListener('input', () => {
      let v = inp.value.trim().toUpperCase();
      if (v !== 'A') {
        v = v.replace(/\D/g, '');
        if (v !== '' && Number(v) > 100) v = '100';
      }
      inp.value = v;
      m.marks[inp.dataset.student][inp.dataset.subject] = v === '' ? '' : (v === 'A' ? 'A' : Number(v));

      GRADES.forEach(x => inp.classList.remove(x.css));
      const g = getGrade(v);
      if (g) inp.classList.add(g.css);

      setUnsaved(true);
      updateProgress();
      updateSaveStatus('unsaved');
    });

    inp.addEventListener('keydown', e => {
      const r = +inp.dataset.r, c = +inp.dataset.c;
      const go = (rr, cc) => {
        const t = document.querySelector(`.multi-input[data-r="${rr}"][data-c="${cc}"]`);
        if (t) { t.focus(); t.select(); }
      };
      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); go(r + 1, c); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); go(r - 1, c); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(r, c + 1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); go(r, c - 1); }
    });

    inp.addEventListener('focus', () => inp.select());
  });
};

/* ══════════════════════════════════════════════════════════
   QUICK FILL
══════════════════════════════════════════════════════════ */
el.quickFillBtn?.addEventListener('click', () => {
  const raw = el.quickFillVal.value;
  if (raw === '' || isNaN(raw)) { showToast('Enter a score first.', 'warning'); return; }
  const n = Math.min(100, Math.max(0, Number(raw)));

  if (state.multi) {
    const m = state.multi;
    m.students.forEach(st => applicable(st).forEach(s => {
      if (m.marks[st._id][s.key] === '') m.marks[st._id][s.key] = n;
    }));
    renderMultiTable();
  } else if (state.students.length) {
    state.students.forEach(s => { if (state.marks[s._id] === '') state.marks[s._id] = n; });
    renderTable();
  } else return;

  setUnsaved(true);
  updateProgress();
  updateSaveStatus('unsaved');
});

/* ══════════════════════════════════════════════════════════
   SAVE  (each learner's marks go to their own class)
══════════════════════════════════════════════════════════ */
const setSaveBusy = (busy) => {
  if (el.saveBtnText)    el.saveBtnText.style.display    = busy ? 'none' : 'inline';
  if (el.saveBtnSpinner) el.saveBtnSpinner.style.display = busy ? 'inline' : 'none';
  if (el.saveBtn)        el.saveBtn.disabled       = busy;
  if (el.saveBtnFooter)  el.saveBtnFooter.disabled = busy;
};

const finishSave = (okMsg) => {
  setUnsaved(false);
  updateSaveStatus('saved');
  showToast(okMsg, 'success');
  setTimeout(() => updateSaveStatus('idle'), 3000);
};

async function saveMarks() {
  if (state.saving) return;
  if (!state.students.length) return;
  if (state.multi) return saveAllSubjects();

  /* group learners with a mark by class */
  const byClass = {};
  state.students.forEach(s => {
    const m = state.marks[s._id];
    if (m === '' || m === undefined) return;
    (byClass[s._classId] = byClass[s._classId] || []).push(s);
  });

  const classIds = Object.keys(byClass);
  if (!classIds.length) { showToast('No marks to save. Enter at least one score.', 'warning'); return; }

  state.saving = true;
  setSaveBusy(true);
  updateSaveStatus('saving');

  const failed = [];
  let total = 0;

  for (const cid of classIds) {
    const t    = state.targets[cid];
    const list = byClass[cid];

    const result = await API.post('/marks/bulk', {
      examId: t.examId, subjectId: t.subjectId, classId: cid,
      marks: list.map(s => ({
        studentId: s._id,
        score: state.marks[s._id] === 'A' ? null : Number(state.marks[s._id]),
        absent: state.marks[s._id] === 'A',
      })),
    });

    if (result?.ok) {
      total += list.length;
      list.forEach(s => {
        const row = $(`row-${s._id}`);
        if (row) { row.classList.add('row-saved'); setTimeout(() => row.classList.remove('row-saved'), 2000); }
      });
    } else {
      failed.push(`${t.className}: ${result?.data?.message || 'status ' + result?.status}`);
    }
  }

  state.saving = false;
  setSaveBusy(false);

  if (failed.length) {
    alert((total ? `${total} marks were saved.\n\n` : '') + 'These classes did not save:\n\n' + failed.join('\n'));
    updateSaveStatus('unsaved');
    return;
  }
  finishSave(`${total} marks saved to database!`);
}

async function saveAllSubjects() {
  const m = state.multi;
  state.saving = true;
  setSaveBusy(true);
  updateSaveStatus('saving');

  const failed = [];
  let savedCount = 0;

  for (const cid of Object.keys(state.targets)) {
    const t     = state.targets[cid];
    const studs = m.students.filter(st => st._classId === cid);

    for (const s of m.subjects) {
      const subjectId = s.ids[cid];
      if (!subjectId) continue;

      const marks = studs
        .filter(st => m.marks[st._id][s.key] !== '' && m.marks[st._id][s.key] !== undefined)
        .map(st => {
          const v = m.marks[st._id][s.key];
          return { studentId: st._id, score: v === 'A' ? null : Number(v), absent: v === 'A' };
        });

      if (!marks.length) continue;

      const result = await API.post('/marks/bulk', {
        examId: t.examId, subjectId, classId: cid, marks,
      });

      if (result?.ok) savedCount++;
      else failed.push(`${t.className} ${shortLabel(s)}: ${result?.data?.message || 'status ' + result?.status}`);
    }
  }

  state.saving = false;
  setSaveBusy(false);

  if (!savedCount && !failed.length) {
    showToast('No marks to save.', 'warning');
    updateSaveStatus('unsaved');
    return;
  }
  if (failed.length) {
    console.error('Save failures:', failed);
    alert('These subjects did not save:\n\n' + failed.join('\n'));
    updateSaveStatus('unsaved');
    return;
  }
  finishSave('All subjects saved!');
}

el.saveBtn?.addEventListener('click', saveMarks);
el.saveBtnFooter?.addEventListener('click', saveMarks);

document.addEventListener('keydown', e => {
  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    saveMarks();
  }
});

/* ══════════════════════════════════════════════════════════
   CLEAR ALL
══════════════════════════════════════════════════════════ */
el.clearBtn?.addEventListener('click', () => {
  if (!allValues().some(v => v !== '' && v !== undefined)) return;
  if (!confirm('Clear all marks on screen? Already saved marks in the database will NOT be deleted.')) return;

  if (state.multi) {
    const m = state.multi;
    m.students.forEach(st => m.subjects.forEach(s => { m.marks[st._id][s.key] = ''; }));
    renderMultiTable();
  } else {
    state.students.forEach(s => { state.marks[s._id] = ''; });
    renderTable();
  }
  setUnsaved(false);
  updateProgress();
  updateSaveStatus('idle');
  showToast('Marks cleared from screen.', 'info');
});

/* ══════════════════════════════════════════════════════════
   EXCEL IMPORT  (one class at a time)
══════════════════════════════════════════════════════════ */
el.importExcelBtn?.addEventListener('click', () => {
  if (isGradeValue(el.selClass.value)) {
    showToast('Excel import works one class at a time. Pick a single class (e.g. Grade 7 East), then import.', 'warning');
    return;
  }
  if (!el.selClass.value || !el.selExam.value) {
    showToast('Please select a Class and an Exam first.', 'warning');
    ['selClass','selExam'].forEach(id => {
      const s = $(id);
      if (s && !s.value) {
        s.style.borderColor = 'var(--danger)';
        setTimeout(() => s.style.borderColor = '', 1400);
      }
    });
    return;
  }
  el.importExcelInput?.click();
});

el.importExcelInput?.addEventListener('change', async () => {
  const file = el.importExcelInput.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('classId', el.selClass.value);
  formData.append('examId', el.selExam.value);

  el.importExcelBtnText.textContent = 'Importing...';
  el.importExcelBtn.disabled = true;

  const result = await API.post('/marks/import-excel', formData);

  el.importExcelBtnText.textContent = 'Import from Excel';
  el.importExcelBtn.disabled = false;
  el.importExcelInput.value = '';

  if (!result?.ok) { showToast(result?.data?.message || 'Import failed.', 'error'); return; }
  showImportResults(result.data);
});

const showImportResults = (data) => {
  const body = $('importResultsBody');
  if (!body) return;
  const s = data.summary || {};

  const row = (label, val, colour) => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);">
      <span style="color:var(--text-soft);font-size:0.85rem;">${label}</span>
      <span style="font-weight:700;color:${colour || 'var(--text-dark)'};">${val}</span>
    </div>`;
  const heading = (txt, colour) => `
    <p style="font-size:0.78rem;font-weight:700;color:${colour};text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 8px;">${txt}</p>`;

  let html = `<div style="margin-bottom:10px;">
      ${row('Students created', s.studentsCreated || 0, '#e67e22')}
      ${row('Marks created', s.created || 0, '#27ae60')}
      ${row('Marks updated', s.updated || 0, '#2e86c1')}
      ${row('Blank cells skipped', s.skippedBlank || 0)}
      ${row('Errors', s.errorCount || 0, s.errorCount ? '#e74c3c' : undefined)}
    </div>`;

  if (s.createdStudents?.length) {
    html += heading('New students added (finish their profiles in Students page)', 'var(--text-mid)') +
      `<ul style="margin:0;padding-left:18px;font-size:0.85rem;color:var(--text-mid);">${s.createdStudents.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
  }
  if (s.unmatchedColumns?.length) {
    html += heading('Column headers not matched to any subject', '#e74c3c') +
      `<ul style="margin:0;padding-left:18px;font-size:0.85rem;color:var(--text-mid);">${s.unmatchedColumns.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
  }
  if (data.errors?.length) {
    html += heading('Errors', '#e74c3c') +
      `<ul style="margin:0;padding-left:18px;font-size:0.8rem;color:var(--text-mid);">${data.errors.map(e => `<li>${esc(e.student || '')} ${e.subject ? '(' + esc(e.subject) + ')' : ''}: ${esc(e.error)}</li>`).join('')}</ul>`;
  }

  body.innerHTML = html;
  $('importResultsOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  showToast(data.message || 'Import complete.', 'success');
};

const closeImportResults = () => {
  $('importResultsOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
};
$('closeImportResults')?.addEventListener('click', closeImportResults);
$('doneImportResults')?.addEventListener('click', closeImportResults);

/* ══════════════════════════════════════════════════════════
   PREVENT ACCIDENTAL NAVIGATION
══════════════════════════════════════════════════════════ */
window.addEventListener('beforeunload', e => {
  if (state.hasUnsaved) {
    e.preventDefault();
    e.returnValue = 'You have unsaved marks. Leave anyway?';
  }
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
loadClasses();
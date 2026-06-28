/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Marks Entry
   File: js/marks.js  Version: 4.0
   Connected to real MongoDB backend
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   KJSEA GRADING
══════════════════════════════════════════════════════════ */
const GRADES = [
  { grade:'EE1', min:90, max:100, points:8, css:'grade-ee1', label:'Exceeds Expectation', remark:'Outstanding. Exceptional learner.'  },
  { grade:'EE2', min:75, max:89,  points:7, css:'grade-ee2', label:'Exceeds Expectation', remark:'Very good. Keep it up.'             },
  { grade:'ME1', min:58, max:74,  points:6, css:'grade-me1', label:'Meets Expectation',   remark:'Good. Needs more practice.'         },
  { grade:'ME2', min:41, max:57,  points:5, css:'grade-me2', label:'Meets Expectation',   remark:'Fair. More effort required.'        },
  { grade:'AE1', min:31, max:40,  points:4, css:'grade-ae1', label:'Approaches Exp.',     remark:'Approaching expectation.'           },
  { grade:'AE2', min:21, max:30,  points:3, css:'grade-ae2', label:'Approaches Exp.',     remark:'Needs improvement urgently.'        },
  { grade:'BE1', min:11, max:20,  points:2, css:'grade-be1', label:'Below Expectation',   remark:'Below expectation. Seek help.'      },
  { grade:'BE2', min:1,  max:10,  points:1, css:'grade-be2', label:'Below Expectation',   remark:'Below minimal. Urgent support.'     },
];

const getGrade = (score) => {
  if (score === null || score === '' || isNaN(score)) return null;
  const n = Number(score);
  if (n < 1 || n > 100) return null;
  return GRADES.find(g => n >= g.min && n <= g.max) || null;
};

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
const state = {
  classes  : [],
  exams    : [],
  subjects : [],
  students : [],
  marks    : {},
  examId   : '',
  subjectId: '',
  classId  : '',
  focusedRow: -1,
  hasUnsaved: false,
  saving    : false,
};

/* ══════════════════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════════════════ */
const el = {
  selClass         : document.getElementById('selClass'),
  selTerm          : document.getElementById('selTerm'),
  selExam          : document.getElementById('selExam'),
  selSubject       : document.getElementById('selSubject'),
  loadMarksBtn     : document.getElementById('loadMarksBtn'),
  marksPlaceholder : document.getElementById('marksPlaceholder'),
  marksSheetWrapper: document.getElementById('marksSheetWrapper'),
  sheetTitle       : document.getElementById('sheetTitle'),
  sheetMeta        : document.getElementById('sheetMeta'),
  marksTableBody   : document.getElementById('marksTableBody'),
  marksTableFoot   : document.getElementById('marksTableFoot'),
  progressFill     : document.getElementById('progressFill'),
  progressEntered  : document.getElementById('progressEntered'),
  progressTotal    : document.getElementById('progressTotal'),
  saveMarksBtn     : document.getElementById('saveMarksBtn'),
  saveBtnText      : document.getElementById('saveBtnText'),
  saveBtnSpinner   : document.getElementById('saveBtnSpinner'),
  clearAllBtn      : document.getElementById('clearAllBtn'),
  saveStatus       : document.getElementById('saveStatus'),
  saveStatusText   : document.getElementById('saveStatusText'),
};

/* Avatar helpers */
const AV = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = n => n?.trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?';
const getAvColour = n => AV[(n?.charCodeAt(0)||0) % AV.length];

/* ══════════════════════════════════════════════════════════
   LOAD CLASSES ON PAGE LOAD
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;

  state.classes = result.data.classes || [];

  if (el.selClass) {
    el.selClass.innerHTML = '<option value="">-- Select Class --</option>' +
      state.classes.map(c =>
        `<option value="${c._id}">${c.name}</option>`
      ).join('');
  }
};

/* ══════════════════════════════════════════════════════════
   WHEN CLASS + TERM SELECTED — LOAD EXAMS
══════════════════════════════════════════════════════════ */
const loadExams = async () => {
  const classId = el.selClass?.value;
  const term    = el.selTerm?.value;

  if (!classId || !term) return;

  if (el.selExam) {
    el.selExam.innerHTML = '<option value="">Loading...</option>';
  }

  const result = await API.get(`/exams?class=${classId}&term=${term}`);

  if (!result?.ok || !result.data.exams?.length) {
    if (el.selExam) {
      el.selExam.innerHTML = '<option value="">No exams found for this term</option>';
    }
    return;
  }

  state.exams = result.data.exams;

  if (el.selExam) {
    el.selExam.innerHTML = '<option value="">-- Select Exam --</option>' +
      state.exams.map(e =>
        `<option value="${e._id}">${e.name}${!e.isOpen ? ' (Closed)' : ''}</option>`
      ).join('');
  }
};

/* ══════════════════════════════════════════════════════════
   WHEN CLASS SELECTED — LOAD SUBJECTS
══════════════════════════════════════════════════════════ */
const loadSubjects = async () => {
  const classId = el.selClass?.value;
  if (!classId) return;

  if (el.selSubject) {
    el.selSubject.innerHTML = '<option value="">Loading...</option>';
  }

  const result = await API.get(`/subjects?class=${classId}`);

  if (!result?.ok || !result.data.subjects?.length) {
    if (el.selSubject) {
      el.selSubject.innerHTML = '<option value="">No subjects found</option>';
    }
    return;
  }

  state.subjects = result.data.subjects.filter(s => s.isActive);

  if (el.selSubject) {
    el.selSubject.innerHTML = '<option value="">-- Select Subject --</option>' +
      state.subjects.map(s =>
        `<option value="${s._id}">[${s.code}] ${s.name}</option>`
      ).join('');
  }
};

/* Wire selectors */
el.selClass?.addEventListener('change', () => {
  loadExams();
  loadSubjects();
  /* Reset exam/subject */
  if (el.selExam)    el.selExam.innerHTML    = '<option value="">-- Select Exam --</option>';
  if (el.selSubject) el.selSubject.innerHTML = '<option value="">-- Select Subject --</option>';
});

el.selTerm?.addEventListener('change', loadExams);

/* ══════════════════════════════════════════════════════════
   LOAD MARK SHEET FROM API
══════════════════════════════════════════════════════════ */
el.loadMarksBtn?.addEventListener('click', async () => {
  const classId   = el.selClass?.value;
  const term      = el.selTerm?.value;
  const examId    = el.selExam?.value;
  const subjectId = el.selSubject?.value;

  if (!classId || !term || !examId || !subjectId) {
    showToast('Please select all four fields.', 'warning');
    ['selClass','selTerm','selExam','selSubject'].forEach(id => {
      const s = document.getElementById(id);
      if (s && !s.value) {
        s.style.borderColor = 'var(--danger)';
        setTimeout(() => s.style.borderColor = '', 1400);
      }
    });
    return;
  }

  /* Warn if unsaved */
  if (state.hasUnsaved) {
    if (!confirm('You have unsaved marks. Load new sheet anyway?')) return;
  }

  /* Show loading in table */
  if (el.marksPlaceholder)  el.marksPlaceholder.style.display  = 'none';
  if (el.marksSheetWrapper) el.marksSheetWrapper.style.display = 'block';
  if (el.marksTableBody)    el.marksTableBody.innerHTML = Skeleton.table(8, 8);

  /* Fetch mark sheet from API */
  const result = await API.get(
    `/marks/sheet?classId=${classId}&examId=${examId}&subjectId=${subjectId}`
  );

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to load mark sheet.', 'error');
    if (el.marksPlaceholder)  el.marksPlaceholder.style.display  = 'flex';
    if (el.marksSheetWrapper) el.marksSheetWrapper.style.display = 'none';
    return;
  }

  const { sheet, exam, subject, class: cls } = result.data;

  /* Check exam is open */
  if (!exam.isOpen) {
    showToast(
      `"${exam.name}" is closed for marks entry. Open it in Exams page first.`,
      'warning'
    );
  }

  /* Update state */
  state.examId    = examId;
  state.subjectId = subjectId;
  state.classId   = classId;
  state.students  = sheet;
  state.marks     = {};
  state.hasUnsaved= false;
  state.focusedRow= -1;

  /* Pre-load existing marks */
  sheet.forEach(s => {
    if (s.mark) {
      state.marks[s._id] = s.mark.absent ? 'A' : s.mark.score;
    } else {
      state.marks[s._id] = '';
    }
  });

  /* Update header */
  if (el.sheetTitle)
    el.sheetTitle.textContent =
      `${subject.name} — ${cls.name}`;

  if (el.sheetMeta)
    el.sheetMeta.textContent =
      `Term ${exam.term} | ${exam.name} | ${sheet.length} Learners${!exam.isOpen ? ' | ⚠ EXAM CLOSED' : ''}`;

  if (el.progressTotal) el.progressTotal.textContent = sheet.length;

  renderTable();
  updateProgress();
  updateSaveStatus('idle');

  showToast(`Loaded ${sheet.length} learners.`, 'success');

  setTimeout(() => {
    const firstInput = document.querySelector('.marks-score-input:not(:disabled)');
    if (firstInput) firstInput.focus();
  }, 100);
});

/* ══════════════════════════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════════════════════════ */
const renderTable = () => {
  if (!el.marksTableBody) return;

  el.marksTableBody.innerHTML = state.students.map((student, i) => {
    const score     = state.marks[student._id] ?? '';
    const isAbsent  = score === 'A';
    const gradeInfo = isAbsent ? null : getGrade(score);

    return `
      <tr id="row-${student._id}" class="${isAbsent ? 'row-absent' : ''}" data-index="${i}">

        <td style="text-align:center;color:var(--text-light);font-size:var(--text-sm);">${i+1}</td>

        <td>
          <div class="marks-student-cell">
            <div class="marks-student-avatar ${getAvColour(student.fullName)}">
              ${getInitials(student.fullName)}
            </div>
            <div>
              <div class="marks-student-name">${student.fullName}</div>
            </div>
          </div>
        </td>

        <td><span class="marks-upi-code">${student.upiNumber || '—'}</span></td>

        <td class="marks-score-cell">
          <input
            type="number"
            class="marks-score-input ${gradeInfo ? gradeInfo.css : ''} ${isAbsent ? 'absent-mode' : ''}"
            id="score-${student._id}"
            data-id="${student._id}"
            data-index="${i}"
            value="${isAbsent ? '' : (score === '' ? '' : score)}"
            min="1" max="100"
            placeholder="${isAbsent ? 'ABSENT' : '0–100'}"
            ${isAbsent ? 'disabled' : ''}
            autocomplete="off"
          />
        </td>

        <td style="text-align:center;" id="grade-${student._id}">
          ${gradeInfo
            ? `<span class="marks-grade-badge marks-legend-item ${gradeInfo.css.replace('grade-','')}">${gradeInfo.grade}</span>`
            : isAbsent
            ? `<span class="marks-grade-badge" style="background:rgba(100,116,139,0.10);color:#64748b;">ABS</span>`
            : '<span style="color:var(--text-light);font-size:0.72rem;">--</span>'
          }
        </td>

        <td style="text-align:center;" id="points-${student._id}">
          ${gradeInfo
            ? `<span class="marks-points-val">${gradeInfo.points}</span><span style="font-size:0.68rem;color:var(--text-light);">/8</span>`
            : '<span style="color:var(--text-light);">--</span>'
          }
        </td>

        <td class="marks-absent-toggle">
          <button
            class="marks-absent-btn ${isAbsent ? 'active' : ''}"
            id="absent-${student._id}"
            data-id="${student._id}"
            title="Toggle absent"
            onclick="toggleAbsent('${student._id}')">
            <i class="fas fa-user-slash"></i>
          </button>
        </td>

        <td id="remarks-${student._id}">
          <span class="marks-remarks-text">
            ${gradeInfo ? gradeInfo.remark : isAbsent ? 'Absent — not assessed' : ''}
          </span>
        </td>

      </tr>`;
  }).join('');

  document.querySelectorAll('.marks-score-input').forEach(input => {
    input.addEventListener('input',   onScoreInput);
    input.addEventListener('keydown', onScoreKeydown);
    input.addEventListener('focus',   onScoreFocus);
  });

  renderFooter();
};

/* ══════════════════════════════════════════════════════════
   SCORE INPUT EVENTS
══════════════════════════════════════════════════════════ */
const onScoreInput = (e) => {
  const input = e.target;
  const id    = input.dataset.id;
  let   val   = input.value;

  if (val !== '') {
    const n = parseInt(val);
    if (!isNaN(n)) {
      if (n > 100) { input.value = '100'; val = '100'; }
      if (n < 0)   { input.value = '0';   val = '0';   }
    }
  }

  state.marks[id] = val === '' ? '' : Number(val);
  state.hasUnsaved = true;

  updateRow(id, val === '' ? '' : Number(val));
  updateProgress();
  updateSaveStatus('unsaved');
};

const updateRow = (id, score) => {
  const gradeInfo = getGrade(score);
  const input     = document.getElementById(`score-${id}`);
  const gradeCell = document.getElementById(`grade-${id}`);
  const pointsCell= document.getElementById(`points-${id}`);
  const remarksCell=document.getElementById(`remarks-${id}`);

  if (input) {
    GRADES.forEach(g => input.classList.remove(g.css));
    if (gradeInfo) input.classList.add(gradeInfo.css);
  }

  if (gradeCell) {
    gradeCell.innerHTML = gradeInfo
      ? `<span class="marks-grade-badge marks-legend-item ${gradeInfo.css.replace('grade-','')}">${gradeInfo.grade}</span>`
      : `<span style="color:var(--text-light);font-size:0.72rem;">--</span>`;
  }

  if (pointsCell) {
    pointsCell.innerHTML = gradeInfo
      ? `<span class="marks-points-val">${gradeInfo.points}</span><span style="font-size:0.68rem;color:var(--text-light);">/8</span>`
      : `<span style="color:var(--text-light);">--</span>`;
  }

  if (remarksCell) {
    remarksCell.innerHTML = `<span class="marks-remarks-text">${gradeInfo ? gradeInfo.remark : ''}</span>`;
  }

  renderFooter();
};

/* ══════════════════════════════════════════════════════════
   KEYBOARD NAVIGATION
══════════════════════════════════════════════════════════ */
const onScoreKeydown = (e) => {
  const input = e.target;
  const idx   = parseInt(input.dataset.index);

  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault();
    focusRow(idx + 1);
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusRow(idx - 1);
  }

  if ((e.key === 'a' || e.key === 'A') && input.value === '') {
    e.preventDefault();
    toggleAbsent(input.dataset.id);
    focusRow(idx + 1);
  }

  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    saveMarks();
  }
};

const focusRow = (idx) => {
  if (idx < 0 || idx >= state.students.length) return;
  const student = state.students[idx];
  const input   = document.getElementById(`score-${student._id}`);
  const row     = document.getElementById(`row-${student._id}`);

  if (input && !input.disabled) {
    document.querySelectorAll('.marks-table tbody tr')
      .forEach(r => r.classList.remove('row-focused'));
    input.focus();
    input.select();
    state.focusedRow = idx;
    if (row) {
      row.classList.add('row-focused');
      row.scrollIntoView({ block:'nearest', behavior:'smooth' });
    }
  }
};

const onScoreFocus = (e) => {
  const idx = parseInt(e.target.dataset.index);
  const id  = e.target.dataset.id;
  document.querySelectorAll('.marks-table tbody tr')
    .forEach(r => r.classList.remove('row-focused'));
  const row = document.getElementById(`row-${id}`);
  if (row) row.classList.add('row-focused');
  state.focusedRow = idx;
};

/* ══════════════════════════════════════════════════════════
   ABSENT TOGGLE
══════════════════════════════════════════════════════════ */
window.toggleAbsent = (id) => {
  const isAbsent  = state.marks[id] === 'A';
  const input     = document.getElementById(`score-${id}`);
  const absentBtn = document.getElementById(`absent-${id}`);
  const row       = document.getElementById(`row-${id}`);

  if (isAbsent) {
    state.marks[id] = '';
    if (input)     { input.disabled=false; input.value=''; input.placeholder='0–100'; input.classList.remove('absent-mode'); GRADES.forEach(g=>input.classList.remove(g.css)); }
    if (absentBtn) absentBtn.classList.remove('active');
    if (row)       row.classList.remove('row-absent');
    updateRow(id, '');
  } else {
    state.marks[id] = 'A';
    if (input)     { input.disabled=true; input.value=''; input.placeholder='ABSENT'; GRADES.forEach(g=>input.classList.remove(g.css)); input.classList.add('absent-mode'); }
    if (absentBtn) absentBtn.classList.add('active');
    if (row)       row.classList.add('row-absent');
    const gc = document.getElementById(`grade-${id}`);
    const pc = document.getElementById(`points-${id}`);
    const rc = document.getElementById(`remarks-${id}`);
    if (gc) gc.innerHTML = `<span class="marks-grade-badge" style="background:rgba(100,116,139,0.10);color:#64748b;">ABS</span>`;
    if (pc) pc.innerHTML = `<span style="color:var(--text-light);">--</span>`;
    if (rc) rc.innerHTML = `<span class="marks-remarks-text">Absent — not assessed</span>`;
  }

  state.hasUnsaved = true;
  updateProgress();
  updateSaveStatus('unsaved');
  renderFooter();
};

/* ══════════════════════════════════════════════════════════
   FOOTER SUMMARY
══════════════════════════════════════════════════════════ */
const renderFooter = () => {
  if (!el.marksTableFoot) return;

  const entered = state.students.filter(s => {
    const m = state.marks[s._id];
    return m !== '' && m !== undefined && m !== 'A' && m !== null;
  });

  if (!entered.length) { el.marksTableFoot.innerHTML = ''; return; }

  const scores  = entered.map(s => Number(state.marks[s._id]));
  const avg     = (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
  const highest = Math.max(...scores);
  const lowest  = Math.min(...scores);
  const absent  = state.students.filter(s => state.marks[s._id]==='A').length;

  el.marksTableFoot.innerHTML = `
    <tr>
      <td colspan="2" style="font-weight:700;font-size:var(--text-sm);">Class Summary</td>
      <td style="font-size:var(--text-xs);color:var(--text-soft);">${entered.length} entered${absent ? `, ${absent} absent` : ''}</td>
      <td style="text-align:center;font-weight:700;color:var(--primary);">Avg: ${avg}%</td>
      <td style="text-align:center;" colspan="2">
        <span style="font-size:var(--text-xs);color:var(--text-soft);">H: ${highest}% &nbsp;|&nbsp; L: ${lowest}%</span>
      </td>
      <td></td><td></td>
    </tr>`;
};

/* ══════════════════════════════════════════════════════════
   PROGRESS + STATUS
══════════════════════════════════════════════════════════ */
const updateProgress = () => {
  const total   = state.students.length;
  const entered = state.students.filter(s => {
    const m = state.marks[s._id];
    return m !== '' && m !== undefined && m !== null;
  }).length;

  if (el.progressEntered) el.progressEntered.textContent = entered;
  const pct = total ? Math.round((entered/total)*100) : 0;
  if (el.progressFill) {
    el.progressFill.style.width = pct + '%';
    el.progressFill.classList.toggle('complete', pct === 100);
  }
};

const updateSaveStatus = (status) => {
  const wrap = document.getElementById('saveStatus');
  const text = document.getElementById('saveStatusText');
  if (!wrap) return;
  wrap.style.display = 'flex';
  wrap.className     = `marks-save-status ${status}`;
  const msg = { idle:'All saved', unsaved:'Unsaved changes', saving:'Saving...', saved:'All saved ✓' };
  if (text) text.textContent = msg[status] || status;
};

/* ══════════════════════════════════════════════════════════
   SAVE MARKS TO API
══════════════════════════════════════════════════════════ */
el.saveMarksBtn?.addEventListener('click', saveMarks);

document.addEventListener('keydown', e => {
  if (e.key === 's' && (e.ctrlKey||e.metaKey)) {
    e.preventDefault();
    if (state.students.length) saveMarks();
  }
});

async function saveMarks() {
  if (state.saving) return;

  const toSave = state.students.filter(s => {
    const m = state.marks[s._id];
    return m !== '' && m !== undefined;
  });

  if (!toSave.length) {
    showToast('No marks to save. Enter at least one score.', 'warning');
    return;
  }

  state.saving = true;

  if (el.saveBtnText)    el.saveBtnText.style.display    = 'none';
  if (el.saveBtnSpinner) el.saveBtnSpinner.style.display = 'inline';
  if (el.saveMarksBtn)   el.saveMarksBtn.disabled        = true;

  updateSaveStatus('saving');

  /* Build payload */
  const marks = toSave.map(s => ({
    studentId: s._id,
    score    : state.marks[s._id] === 'A' ? null : Number(state.marks[s._id]),
    absent   : state.marks[s._id] === 'A',
  }));

  const result = await API.post('/marks/bulk', {
    examId   : state.examId,
    subjectId: state.subjectId,
    classId  : state.classId,
    marks,
  });

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to save marks.', 'error');
    updateSaveStatus('unsaved');
    state.saving = false;
    if (el.saveBtnText)    el.saveBtnText.style.display    = 'inline';
    if (el.saveBtnSpinner) el.saveBtnSpinner.style.display = 'none';
    if (el.saveMarksBtn)   el.saveMarksBtn.disabled        = false;
    return;
  }

  /* Flash saved rows green */
  toSave.forEach(s => {
    const row = document.getElementById(`row-${s._id}`);
    if (row) {
      row.classList.add('row-saved');
      setTimeout(() => row.classList.remove('row-saved'), 2000);
    }
  });

  state.hasUnsaved = false;
  state.saving     = false;

  updateSaveStatus('saved');
  showToast(`${toSave.length} marks saved to database!`, 'success');
  setTimeout(() => updateSaveStatus('idle'), 3000);

  if (el.saveBtnText)    el.saveBtnText.style.display    = 'inline';
  if (el.saveBtnSpinner) el.saveBtnSpinner.style.display = 'none';
  if (el.saveMarksBtn)   el.saveMarksBtn.disabled        = false;
}

/* ══════════════════════════════════════════════════════════
   CLEAR ALL
══════════════════════════════════════════════════════════ */
el.clearAllBtn?.addEventListener('click', () => {
  if (!Object.values(state.marks).some(v => v !== '')) return;
  if (!confirm('Clear all marks on screen? Already saved marks in the database will NOT be deleted.')) return;

  state.students.forEach(s => { state.marks[s._id] = ''; });
  state.hasUnsaved = false;
  renderTable();
  updateProgress();
  updateSaveStatus('idle');
  showToast('Marks cleared from screen.', 'info');
});

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
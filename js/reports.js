/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Reports & PDFs
   File: js/reports.js
   Version: 6.0 — Now wired to real backend data.
   Same pixel-perfect CBC report card design as v5.1;
   MOCK_DATA removed, replaced with /classes, /exams,
   /results/class (the same ranking already used by Results page).
═══════════════════════════════════════════════════════════ */

/* ── Auth ─────────────────────────────────────────────────── */
const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   1. KJSEA GRADING ENGINE
   (grading scale/comments are pure functions of score/grade —
   unchanged from before, since they don't depend on data source)
══════════════════════════════════════════════════════════ */
const KJSEA = {

  SCALE: [
    { grade:'EE1', label:'Exceeds Expectation',      measure:'Exceptional',    min:90, max:100, points:8, css:'ee1' },
    { grade:'EE2', label:'Exceeds Expectation',      measure:'Very Good',      min:75, max:89,  points:7, css:'ee2' },
    { grade:'ME1', label:'Meets Expectation',        measure:'Good',           min:58, max:74,  points:6, css:'me1' },
    { grade:'ME2', label:'Meets Expectation',        measure:'Fair',           min:41, max:57,  points:5, css:'me2' },
    { grade:'AE1', label:'Approaches Expectation',   measure:'Developing',     min:31, max:40,  points:4, css:'ae1' },
    { grade:'AE2', label:'Approaches Expectation',   measure:'Improving',      min:21, max:30,  points:3, css:'ae2' },
    { grade:'BE1', label:'Below Expectation',        measure:'Minimal',        min:11, max:20,  points:2, css:'be1' },
    { grade:'BE2', label:'Below Expectation',        measure:'Below Minimal',  min:1,  max:10,  points:1, css:'be2' },
  ],

  /* Maps a subject's real learningArea (from Subject model) to one
     of the 3 KNEC pathway buckets shown in the Pathway Summary. */
  LEARNING_AREA_TO_PATHWAY: {
    'Mathematics'  : 'stem',
    'Sciences'     : 'stem',
    'Technical'    : 'stem',
    'Languages'    : 'social',
    'Humanities'   : 'social',
    'Life Skills'  : 'social',
    'Creative Arts': 'creative',
  },

  PATHWAYS: {
    stem    : { name:'STEM',            col:'#1d4ed8', bg:'#dbeafe', border:'#3b82f6', pillBg:'#bfdbfe', pillCol:'#1e3a8a' },
    social  : { name:'Social Sciences', col:'#166534', bg:'#dcfce7', border:'#22c55e', pillBg:'#bbf7d0', pillCol:'#14532d' },
    creative: { name:'Creative Arts',   col:'#6b21a8', bg:'#f3e8ff', border:'#a855f7', pillBg:'#e9d5ff', pillCol:'#581c87' },
  },

  getGrade(score) {
    if (score === null || score === undefined || score === '') return null;
    return this.SCALE.find(s => Number(score) >= s.min && Number(score) <= s.max) || null;
  },

  /* Groups a learner's subjectResults into stem/social/creative buckets
     using each subject's learningArea. Subjects with no learningArea
     set, or one that isn't in the map, are simply left out of every
     bucket (rather than guessed) — the Subjects page can assign a
     learningArea to fix that. */
  computePathways(subjectResults) {
    const acc = {
      stem    : { scores:[], points:0, count:0, subjectNames:[] },
      social  : { scores:[], points:0, count:0, subjectNames:[] },
      creative: { scores:[], points:0, count:0, subjectNames:[] },
    };

    subjectResults.forEach(s => {
      const pathwayKey = this.LEARNING_AREA_TO_PATHWAY[s.learningArea];
      if (!pathwayKey || s.score === null) return;
      const p = acc[pathwayKey];
      p.scores.push(s.score);
      p.points += s.points;
      p.count++;
      p.subjectNames.push(s.name);
    });

    const out = {};
    Object.entries(acc).forEach(([key, p]) => {
      const avg       = p.scores.length
        ? parseFloat((p.scores.reduce((a,b)=>a+b,0)/p.scores.length).toFixed(1))
        : 0;
      const maxPts    = p.count * 8;
      const gradeInfo = this.getGrade(avg);
      out[key] = {
        avg,
        points  : p.points,
        maxPts,
        grade   : gradeInfo?.label   || '--',
        measure : gradeInfo?.measure || '--',
        css     : gradeInfo?.css     || '',
        subjects: p.subjectNames.join(' · ') || 'No subjects assigned to this pathway yet',
      };
    });
    return out;
  },

  getTeacherComment(grade) {
    return {
      EE1: 'Exceptional performance this term. A truly outstanding learner demonstrating mastery across all learning areas. Keep excelling!',
      EE2: 'Very good performance. Shows strong mastery of the subject. Continue with the same dedication and enthusiasm.',
      ME1: 'Good performance. Meeting expectations well. A focused learner who is progressing steadily. Keep it up!',
      ME2: 'Fair performance. Meeting basic expectations. More effort and practice will yield better results next term.',
      AE1: 'Approaching expectation. Some improvement noted but more effort is needed in several learning areas.',
      AE2: 'Below average performance. Extra support and consistent effort are required to improve results.',
      BE1: 'Minimal performance. Urgent intervention and additional support are needed. Please consult the class teacher.',
      BE2: 'Below minimal. Requires immediate and intensive academic support. Parents are encouraged to engage the school.',
    }[grade] || 'Performance noted. The learner is encouraged to work harder next term.';
  },

  getPrincipalComment(learner, grade) {
    const first = learner.fullName.split(' ')[0];
    return {
      EE1: `${learner.fullName} has demonstrated exceptional academic achievement this term. This is outstanding and the school is very proud. Encouraged to maintain this level of excellence.`,
      EE2: `${learner.fullName} has demonstrated very good performance this term. We encourage continued dedication and a positive attitude throughout the year.`,
      ME1: `${first} is making good progress and meeting expectations. We encourage continued effort and active participation in all learning activities.`,
      ME2: `${first} has shown satisfactory performance. With more commitment and focus, we expect better results in the coming term.`,
      AE1: `${first} is making some progress but needs to put in more effort. We encourage seeking help where needed and revising consistently.`,
      AE2: `${first} needs to improve significantly. We urge the learner and parents to work closely with the school for better academic outcomes.`,
      BE1: `${first} requires urgent academic support. We strongly encourage regular attendance and close engagement with class teachers.`,
      BE2: `${first} requires immediate and intensive support. Please contact the school to discuss a personalised improvement plan.`,
    }[grade] || `${first} is encouraged to work harder and engage more actively with the learning process.`;
  },

  getSubjectRemark(score) {
    if (score === null || score === undefined) return '—';
    if (score >= 90) return 'Outstanding. Exceptional learner.';
    if (score >= 75) return 'Very good. Keep it up.';
    if (score >= 58) return 'Good. Needs more practice.';
    if (score >= 41) return 'Fair. More effort required.';
    if (score >= 31) return 'Approaching expectation.';
    if (score >= 21) return 'Needs improvement urgently.';
    return 'Below expectation. Seek help.';
  },

  ordinal(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  },
};

/* ══════════════════════════════════════════════════════════
   2. STATE
══════════════════════════════════════════════════════════ */
const state = {
  activeTab    : 'individual',
  scope        : 'class', // 'class' | 'grade'
  classes      : [],
  exams        : [],
  subjects     : [],   // real per-class subject list from the last results call
  results      : [],   // ranked learners for the currently selected class+exam (or grade+exam)
  paperSize    : 'A4',
  recentReports: [],
  context      : {},
  bulkCards    : [],
  loadedKey    : null, // guards against stale results if selection changes after fetch
};
const CURRENT_YEAR = new Date().getFullYear().toString();

/* ══════════════════════════════════════════════════════════
   3. DOM REFS
══════════════════════════════════════════════════════════ */
const el = {
  tabIndividual      : document.getElementById('tabIndividual'),
  tabClass           : document.getElementById('tabClass'),
  tabBulk            : document.getElementById('tabBulk'),
  scopeClassBtn      : document.getElementById('scopeClassBtn'),
  scopeGradeBtn      : document.getElementById('scopeGradeBtn'),
  classFieldWrap     : document.getElementById('classFieldWrap'),
  gradeFieldWrap     : document.getElementById('gradeFieldWrap'),
  examFieldWrap      : document.getElementById('examFieldWrap'),
  examNameFieldWrap  : document.getElementById('examNameFieldWrap'),
  rptClass           : document.getElementById('rptClass'),
  rptGrade           : document.getElementById('rptGrade'),
  rptTerm            : document.getElementById('rptTerm'),
  rptExam            : document.getElementById('rptExam'),
  rptExamName        : document.getElementById('rptExamName'),
  rptLearner         : document.getElementById('rptLearner'),
  rptLearnerField    : document.getElementById('rptLearnerField'),
  bulkInfoBanner     : document.getElementById('bulkInfoBanner'),
  generatePreviewBtn : document.getElementById('generatePreviewBtn'),
  generateBtnText    : document.getElementById('generateBtnText'),
  rptSchoolName      : document.getElementById('rptSchoolName'),
  rptSchoolMotto     : document.getElementById('rptSchoolMotto'),
  rptTeacher         : document.getElementById('rptTeacher'),
  rptPrincipal       : document.getElementById('rptPrincipal'),
  rptClosingDate     : document.getElementById('rptClosingDate'),
  rptNextTerm        : document.getElementById('rptNextTerm'),
  previewPlaceholder : document.getElementById('previewPlaceholder'),
  previewFrameWrapper: document.getElementById('previewFrameWrapper'),
  previewPaper       : document.getElementById('previewPaper'),
  previewLabel       : document.getElementById('previewLabel'),
  printBtn           : document.getElementById('printBtn'),
  downloadPdfBtn     : document.getElementById('downloadPdfBtn'),
  downloadBtnText    : document.getElementById('downloadBtnText'),
  downloadBtnSpinner : document.getElementById('downloadBtnSpinner'),
  printArea          : document.getElementById('printArea'),
  recentReportsList  : document.getElementById('recentReportsList'),
  bulkProgressBar    : document.getElementById('bulkProgressBar'),
  bulkProgressFill   : document.getElementById('bulkProgressFill'),
  bulkProgressText   : document.getElementById('bulkProgressText'),
};

/* ══════════════════════════════════════════════════════════
   4. LOAD CLASSES
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;

  state.classes = result.data.classes || [];

  if (el.rptClass) {
    el.rptClass.innerHTML = '<option value="">-- Select Class --</option>' +
      state.classes.map(c =>
        `<option value="${c._id}">${c.name}</option>`
      ).join('');
  }

  const grades = [...new Set(state.classes.map(c => c.grade).filter(Boolean))];
  if (el.rptGrade) {
    el.rptGrade.innerHTML = '<option value="">-- Select Grade --</option>' +
      grades.map(g => `<option value="${g}">${g}</option>`).join('');
  }
};

/* ══════════════════════════════════════════════════════════
   SCOPE TOGGLE — This Class vs Whole Grade
══════════════════════════════════════════════════════════ */
const setScope = (scope) => {
  state.scope = scope;
  el.scopeClassBtn?.classList.toggle('active', scope === 'class');
  el.scopeGradeBtn?.classList.toggle('active', scope === 'grade');

  if (el.classFieldWrap)    el.classFieldWrap.style.display    = scope === 'class' ? 'flex' : 'none';
  if (el.gradeFieldWrap)    el.gradeFieldWrap.style.display    = scope === 'grade' ? 'flex' : 'none';
  if (el.examFieldWrap)     el.examFieldWrap.style.display     = scope === 'class' ? 'flex' : 'none';
  if (el.examNameFieldWrap) el.examNameFieldWrap.style.display = scope === 'grade' ? 'flex' : 'none';

  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">-- Select Learner --</option>';
  resetPreview();
};

el.scopeClassBtn?.addEventListener('click', () => setScope('class'));
el.scopeGradeBtn?.addEventListener('click', () => setScope('grade'));

/* ══════════════════════════════════════════════════════════
   5. LOAD EXAMS WHEN CLASS + TERM SELECTED
══════════════════════════════════════════════════════════ */
const loadExams = async () => {
  const classId = el.rptClass?.value;
  const term    = el.rptTerm?.value;

  if (!classId || !term) return;

  if (el.rptExam) el.rptExam.innerHTML = '<option value="">Loading...</option>';

  const result = await API.get(`/exams?class=${classId}&term=${term}`);

  if (!result?.ok || !result.data.exams?.length) {
    if (el.rptExam) el.rptExam.innerHTML = '<option value="">No exams found</option>';
    return;
  }

  state.exams = result.data.exams;

  if (el.rptExam) {
    el.rptExam.innerHTML = '<option value="">-- Select Exam --</option>' +
      state.exams.map(e =>
        `<option value="${e._id}">${e.name}</option>`
      ).join('');
  }
};

el.rptClass?.addEventListener('change', () => {
  loadExams();
  if (el.rptExam)    el.rptExam.innerHTML    = '<option value="">-- Select Exam --</option>';
  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">-- Select Learner --</option>';
  resetPreview();
});

el.rptTerm?.addEventListener('change', () => {
  if (state.scope === 'class') loadExams();
  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">-- Select Learner --</option>';
  resetPreview();
});

el.rptGrade?.addEventListener('change', () => {
  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">-- Select Learner --</option>';
  resetPreview();
});

/* ══════════════════════════════════════════════════════════
   6. WHEN SELECTION IS COMPLETE — FETCH REAL RESULTS
   This populates the Learner dropdown (individual tab) and
   is reused directly when the user clicks "Preview Report",
   so results are only fetched once per selection.
══════════════════════════════════════════════════════════ */
el.rptExam?.addEventListener('change', fetchResults);
el.rptExamName?.addEventListener('change', fetchResults);

async function fetchResults() {
  let apiUrl;
  let key;

  if (state.scope === 'class') {
    const classId = el.rptClass?.value;
    const examId  = el.rptExam?.value;
    if (!classId || !examId) return;
    apiUrl = `/results/class?classId=${classId}&examId=${examId}`;
    key    = `class:${classId}:${examId}`;

  } else {
    const grade    = el.rptGrade?.value;
    const term     = el.rptTerm?.value;
    const examName = el.rptExamName?.value;
    if (!grade || !term || !examName) return;
    apiUrl = `/results/grade?grade=${encodeURIComponent(grade)}&term=${term}&examName=${encodeURIComponent(examName)}`;
    key    = `grade:${grade}:${term}:${examName}`;
  }

  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">Loading...</option>';

  const result = await API.get(apiUrl);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to load results.', 'error');
    if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">-- Select Learner --</option>';
    return;
  }

  const data = result.data;

  state.subjects  = data.subjects || [];
  state.results   = computeResults(data.results || []);
  state.loadedKey = key;

  if (state.scope === 'class') {
    state.classInfo = data.class;
    state.examInfo  = data.exam;
  } else {
    state.classInfo = { name: `${data.grade} (${(data.streams || []).join(' + ')})` };
    state.examInfo  = data.exam;
  }

  if (!state.results.length) {
    if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">No results yet — enter marks first</option>';
    showToast('No results found yet. Enter or import marks first.', 'warning');
    return;
  }

  if (el.rptLearner) {
    el.rptLearner.innerHTML = '<option value="">-- Select Learner --</option>' +
      state.results.map(r =>
        `<option value="${r.studentId}">${r.fullName}${r.streamName ? ' — ' + r.streamName : ''}</option>`
      ).join('');
  }
}

const resetPreview = () => {
  if (el.previewPlaceholder)  el.previewPlaceholder.style.display  = 'flex';
  if (el.previewFrameWrapper) el.previewFrameWrapper.style.display = 'none';
  state.bulkCards = [];
};

/* ══════════════════════════════════════════════════════════
   7. TRANSFORM API RESULTS INTO REPORT-CARD-READY SHAPE
   The API (getClassResults) already ranks correctly — this
   just adds the pathway breakdown the report card needs.
══════════════════════════════════════════════════════════ */
const computeResults = (apiResults) => {
  return apiResults.map(r => {
    const pathways = KJSEA.computePathways(r.subjectResults);
    return {
      ...r,
      pathways,
    };
  });
};

/* ══════════════════════════════════════════════════════════
   8. TABS
══════════════════════════════════════════════════════════ */
el.tabIndividual?.addEventListener('click', () => switchTab('individual'));
el.tabClass?.addEventListener('click',      () => switchTab('class'));
el.tabBulk?.addEventListener('click',       () => switchTab('bulk'));

const switchTab = (tab) => {
  state.activeTab = tab;

  el.tabIndividual?.classList.toggle('active', tab === 'individual');
  el.tabClass?.classList.toggle('active',      tab === 'class');
  el.tabBulk?.classList.toggle('active',       tab === 'bulk');

  if (el.rptLearnerField)
    el.rptLearnerField.style.display  = tab === 'individual' ? 'flex' : 'none';
  if (el.bulkInfoBanner)
    el.bulkInfoBanner.style.display   = tab === 'bulk'       ? 'flex' : 'none';
  if (el.generateBtnText)
    el.generateBtnText.textContent    = tab === 'bulk'
      ? 'Preview All Report Cards'
      : 'Preview Report';

  resetPreview();
};

/* ══════════════════════════════════════════════════════════
   9. PAPER SIZE TOGGLE
══════════════════════════════════════════════════════════ */
document.querySelectorAll('.rpt-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rpt-toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.paperSize = btn.dataset.size;
  });
});

/* ══════════════════════════════════════════════════════════
   10. GENERATE PREVIEW
══════════════════════════════════════════════════════════ */
el.generatePreviewBtn?.addEventListener('click', async () => {
  const term = el.rptTerm?.value;

  if (!term) {
    showToast('Please select a Term.', 'warning');
    flashMissing(null, term, null);
    return;
  }

  let scopeValid, cls, exam;

  if (state.scope === 'class') {
    cls  = el.rptClass?.value;
    exam = el.rptExam?.value;
    scopeValid = !!(cls && exam);
    if (!scopeValid) {
      showToast('Please select Class and Exam.', 'warning');
      flashMissing(cls, term, exam);
      return;
    }
  } else {
    cls  = el.rptGrade?.value;
    exam = el.rptExamName?.value;
    scopeValid = !!(cls && exam);
    if (!scopeValid) {
      showToast('Please select Grade and Exam.', 'warning');
      flashMissing(cls, term, exam);
      return;
    }
  }

  if (state.activeTab === 'individual' && !el.rptLearner?.value) {
    showToast('Please select a learner.', 'warning');
    if (el.rptLearner) {
      el.rptLearner.style.borderColor = '#e74c3c';
      setTimeout(() => el.rptLearner.style.borderColor = '', 1400);
    }
    return;
  }

  /* Results should already be loaded from the selection-change handler,
     but fetch fresh if for some reason they aren't. */
  const expectedKey = state.scope === 'class'
    ? `class:${cls}:${exam}`
    : `grade:${cls}:${term}:${exam}`;

  if (state.loadedKey !== expectedKey) {
    await fetchResults();
  }

  if (!state.results.length) {
    showToast('No results found. Enter or import marks first.', 'error');
    return;
  }

  const className = state.scope === 'class'
    ? (state.classes.find(c => c._id === cls)?.name || state.classInfo?.name || 'Class')
    : (state.classInfo?.name || cls);

  const examName = state.scope === 'class'
    ? (state.exams.find(e => e._id === exam)?.name || state.examInfo?.name || 'Exam')
    : exam;

  const settings = {
    schoolName  : el.rptSchoolName?.value  || 'Scholar Analytics Demo School',
    schoolMotto : el.rptSchoolMotto?.value || 'Excellence Through Knowledge',
    teacher     : el.rptTeacher?.value     || 'Class Teacher',
    principal   : el.rptPrincipal?.value   || 'The Principal',
    closingDate : el.rptClosingDate?.value || 'To Be Announced',
    nextTerm    : el.rptNextTerm?.value    || 'To Be Announced',
    cls: className, term, exam: examName,
    year        : CURRENT_YEAR,
  };

  state.context = settings;

  let html = '';

  if (state.activeTab === 'individual') {
    const learner = state.results.find(r => r.studentId === el.rptLearner?.value);
    if (!learner) { showToast('Learner not found.', 'error'); return; }
    html = buildReportCard(learner, settings);

  } else if (state.activeTab === 'class') {
    html = buildClassSheet(state.results, settings);

  } else {
    html = buildBulkPreview(state.results, settings);
  }

  if (el.previewPaper) el.previewPaper.innerHTML = html;

  if (el.previewPlaceholder)  el.previewPlaceholder.style.display  = 'none';
  if (el.previewFrameWrapper) el.previewFrameWrapper.style.display = 'block';

  if (el.previewLabel) {
    const labels = {
      individual: state.results.find(r => r.studentId === el.rptLearner?.value)?.fullName || 'Preview',
      class      : `${className} — ${examName}`,
      bulk       : `All ${state.results.length} Learners — ${className}`,
    };
    el.previewLabel.innerHTML =
      `<i class="fas fa-file-pdf"></i> ${labels[state.activeTab]}`;
  }

  addToRecent(settings);
  showToast(
    state.activeTab === 'bulk'
      ? `${state.results.length} report cards ready!`
      : 'Preview ready.',
    'success'
  );
});

const flashMissing = (cls, term, exam) => {
  const clsId  = state.scope === 'class' ? 'rptClass' : 'rptGrade';
  const examId = state.scope === 'class' ? 'rptExam'  : 'rptExamName';
  [{ v:cls, id:clsId }, {v:term, id:'rptTerm'}, {v:exam, id:examId}]
    .forEach(({v, id}) => {
      if (!v) {
        const e = document.getElementById(id);
        if (e) { e.style.borderColor='#e74c3c'; setTimeout(()=>e.style.borderColor='',1400); }
      }
    });
};

/* ══════════════════════════════════════════════════════════
   11. BUILD INDIVIDUAL REPORT CARD
       Same pixel design as before — only the data source and
       dynamic subject count/pathway breakdown changed.
══════════════════════════════════════════════════════════ */
const buildReportCard = (r, s) => {

  const td = (extra = '') =>
    `padding:5px 8px;background:#ffffff;border-right:1.5px solid #94a3b8;border-bottom:1.5px solid #94a3b8;${extra}`;

  const maxTotal  = r.subjectCount * 100;
  const maxPoints = r.subjectCount * 8;

  const subjectRows = r.subjectResults.map((sub, i) => {
    const gradeInfo = KJSEA.getGrade(sub.score);
    const label     = gradeInfo?.label || (sub.absent ? 'Absent' : sub.notEntered ? 'Not Entered' : '--');
    const gradeCode = sub.grade || (sub.absent ? 'ABS' : '--');
    return `
    <tr>
      <td style="${td('text-align:center;color:#94a3b8;font-size:10px;font-weight:600;width:4%;')}">${i+1}</td>
      <td style="${td('text-align:left;font-weight:600;font-size:11px;color:#1a2a3a;width:20%;')}">${sub.name}</td>
      <td style="${td('text-align:center;font-weight:700;font-size:11px;color:#0d3349;width:8%;')}">${sub.score !== null ? sub.score + '%' : '—'}</td>
      <td style="${td('text-align:center;width:18%;line-height:1.2;')}">
        <div style="font-size:8.5px;font-weight:600;color:#1a2a3a;margin-bottom:1px;">${label.replace('Expectation','<br>Expectation')}</div>
        <span style="display:inline-block;background:#d0e8f7;color:#0d3349;border-radius:3px;padding:1px 4px;font-size:8px;font-weight:700;">${gradeCode}</span>
      </td>
      <td style="${td('text-align:center;width:8%;font-weight:700;color:#0d3349;font-size:11px;')}">
        ${sub.points}<span style="font-size:8px;color:#94a3b8;font-weight:400;">/8</span>
      </td>
      <td style="${td('text-align:left;font-size:9.5px;font-style:italic;color:#64748b;width:32%;')}">${sub.absent ? 'Absent — not assessed' : KJSEA.getSubjectRemark(sub.score)}</td>
      <td style="${td('text-align:center;font-size:10px;font-weight:700;color:#0d3349;width:8%;border-right:none;')}">${sub.teacherName || '—'}</td>
    </tr>`;
  }).join('');

  const pathwayConfig = [
    { key:'stem',     ...KJSEA.PATHWAYS.stem     },
    { key:'social',   ...KJSEA.PATHWAYS.social   },
    { key:'creative', ...KJSEA.PATHWAYS.creative },
  ];

  const pathwayCells = pathwayConfig.map(({ key, name, bg, border, col, pillBg, pillCol }, i) => {
    const pw   = r.pathways[key];
    const last = i === pathwayConfig.length - 1;
    return `
      <div style="flex:1;padding:8px 8px;text-align:center;background:${bg};border-top:2px solid ${border};border-bottom:2px solid ${border};border-left:2px solid ${border};${last ? 'border-right:2px solid ' + border + ';' : ''}">
        <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${col};margin-bottom:2px;">${name}</div>
        <div style="font-size:7px;color:${col};opacity:0.75;margin-bottom:5px;line-height:1.4;">${pw.subjects}</div>
        <div style="font-size:1.4rem;font-weight:700;color:${col};line-height:1;margin-bottom:1px;">${pw.avg}%</div>
        <div style="font-size:9px;font-weight:600;color:${col};margin-bottom:4px;">${pw.points}/${pw.maxPts} pts</div>
        <span style="display:inline-block;background:${pillBg};color:${pillCol};border-radius:3px;padding:1px 7px;font-size:7.5px;font-weight:700;">${pw.grade}</span>
      </div>`;
  }).join('');

  return `
<div style="max-width:700px;background:#ffffff;border:2px solid #64748b;border-radius:8px;overflow:hidden;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#1e293b;margin:0 auto;">

  <!-- ══ HEADER ══ -->
  <div style="background:#ffffff;padding:10px 16px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #64748b;">
    <div style="width:46px;height:46px;background:#0d3349;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🎓</div>
    <div style="flex:1;">
      <div style="font-size:0.95rem;font-weight:700;color:#0d3349;letter-spacing:0.2px;margin-bottom:1px;">${s.schoolName.toUpperCase()}</div>
      <div style="font-size:0.65rem;color:#64748b;margin-bottom:1px;">Junior Secondary School</div>
      <div style="font-size:0.62rem;color:#475569;font-style:italic;">${s.schoolMotto}</div>
    </div>
    <div style="width:1.5px;height:44px;background:#64748b;flex-shrink:0;"></div>
    <div style="text-align:center;flex-shrink:0;padding-left:8px;">
      <div style="width:38px;height:38px;background:#0d3349;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;margin:0 auto 3px;">🛡️</div>
      <div style="font-size:0.52rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;">Academic Year</div>
      <div style="font-size:1.05rem;font-weight:800;color:#0d3349;line-height:1.1;">${s.year}</div>
    </div>
  </div>

  <!-- ══ LEARNER META BAR ══ -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);background:#ffffff;border-bottom:2px solid #64748b;">
    ${[
      { label:'Full Name',      val: r.fullName          },
      { label:'Assessment No.', val: r.assessmentNo||'—' },
      { label:'Grade',          val: s.cls               },
      { label:'Gender',         val: r.gender||'—'       },
      { label:'Admission No.',  val: r.upiNumber||'—'    },
      { label:'Academic Year',  val: s.year              },
    ].map((c,i,a) => `
      <div style="padding:6px 8px;background:#ffffff;${i < a.length-1 ? 'border-right:1.5px solid #94a3b8;' : ''}">
        <div style="font-size:0.52rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;">${c.label}</div>
        <div style="font-size:0.75rem;font-weight:700;color:#0d3349;">${c.val}</div>
      </div>`
    ).join('')}
  </div>

  <!-- ══ EXAM STRIP ══ -->
  <div style="background:#0d3349;display:flex;align-items:center;justify-content:center;gap:16px;padding:5px 16px;">
    <span style="color:rgba(255,255,255,0.90);font-size:0.68rem;font-weight:600;">📅 Term ${s.term}</span>
    <span style="color:rgba(255,255,255,0.25);font-size:16px;line-height:1;">|</span>
    <span style="color:rgba(255,255,255,0.90);font-size:0.68rem;font-weight:600;">📄 ${s.exam} Examination</span>
    <span style="color:rgba(255,255,255,0.25);font-size:16px;line-height:1;">|</span>
    <span style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.90);font-size:0.68rem;font-weight:600;">
      <span style="width:6px;height:6px;background:#4ecb8d;border-radius:50%;display:inline-block;"></span>
      Academic Year ${s.year}
    </span>
  </div>

  <!-- ══ SUBJECT PERFORMANCE LABEL ══ -->
  <div style="background:#0d3349;padding:4px 12px;font-size:0.60rem;font-weight:700;color:rgba(255,255,255,0.90);text-transform:uppercase;letter-spacing:0.8px;">Subject Performance</div>

  <!-- ══ TABLE ══ -->
  <table style="width:100%;border-collapse:collapse;border-left:2px solid #64748b;border-right:2px solid #64748b;">
    <thead>
      <tr style="background:#0d3349;">
        <th style="padding:5px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-right:1.5px solid rgba(255,255,255,0.20);border-bottom:1.5px solid rgba(255,255,255,0.20);width:4%;">No.</th>
        <th style="padding:5px 8px;text-align:left;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-right:1.5px solid rgba(255,255,255,0.20);border-bottom:1.5px solid rgba(255,255,255,0.20);width:20%;">Learning Area</th>
        <th style="padding:5px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-right:1.5px solid rgba(255,255,255,0.20);border-bottom:1.5px solid rgba(255,255,255,0.20);width:8%;">Score %</th>
        <th style="padding:5px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-right:1.5px solid rgba(255,255,255,0.20);border-bottom:1.5px solid rgba(255,255,255,0.20);width:18%;">Grade</th>
        <th style="padding:5px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-right:1.5px solid rgba(255,255,255,0.20);border-bottom:1.5px solid rgba(255,255,255,0.20);width:8%;">Points</th>
        <th style="padding:5px 8px;text-align:left;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-right:1.5px solid rgba(255,255,255,0.20);border-bottom:1.5px solid rgba(255,255,255,0.20);width:32%;">Teacher Comment</th>
        <th style="padding:5px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-bottom:1.5px solid rgba(255,255,255,0.20);width:8%;">Teacher</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
      <!-- TOTAL ROW -->
      <tr>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);"></td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);font-weight:700;font-size:10.5px;color:#ffffff;text-transform:uppercase;letter-spacing:0.3px;">Total</td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);text-align:center;font-weight:700;font-size:11px;color:#ffffff;">${r.totalScore}/${maxTotal}</td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);text-align:center;line-height:1.2;">
          <div style="font-size:8px;color:rgba(255,255,255,0.60);margin-bottom:2px;">${r.meanGradeInfo?.label || '--'}</div>
          <span style="display:inline-block;background:#1d9e75;color:#fff;border-radius:3px;padding:1px 5px;font-size:7.5px;font-weight:700;">${r.meanGrade || '--'}</span>
        </td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);text-align:center;">
          <span style="font-weight:700;color:#4ecb8d;font-size:11px;">${r.totalPoints}</span>
          <span style="font-size:8px;color:rgba(255,255,255,0.40);">/${maxPoints}</span>
        </td>
        <td colspan="2" style="padding:5px 8px;background:#0d3349;font-style:italic;font-size:9px;color:rgba(255,255,255,0.55);">
          ${KJSEA.getTeacherComment(r.meanGrade).split('.')[0]}.
        </td>
      </tr>
    </tbody>
  </table>

  <!-- ══ PATHWAY SUMMARY ══ -->
  <div style="background:#0d3349;padding:4px 12px;font-size:0.60rem;font-weight:700;color:rgba(255,255,255,0.90);text-transform:uppercase;letter-spacing:0.8px;">Pathway Summary — KNEC</div>
  <div style="display:flex;border-bottom:2px solid #64748b;">${pathwayCells}</div>

  <!-- ══ COMMENTS HEADER ══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1.5px solid #94a3b8;">
    <div style="background:#f1f5f9;padding:3px 12px;border-right:1.5px solid #94a3b8;">
      <div style="font-size:0.57rem;font-weight:700;color:#0d3349;text-transform:uppercase;letter-spacing:0.4px;">Comments</div>
    </div>
    <div style="background:#f1f5f9;padding:3px 12px;">
      <div style="font-size:0.57rem;font-weight:700;color:#0d3349;text-transform:uppercase;letter-spacing:0.4px;">Principal's Comment</div>
    </div>
  </div>

  <!-- ══ COMMENTS BODY ══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #64748b;">
    <div style="padding:8px 12px;border-right:1.5px solid #94a3b8;background:#ffffff;">
      <div style="font-size:0.55rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:3px;">Class Teacher's Comment</div>
      <div style="font-size:0.68rem;color:#334155;line-height:1.45;font-style:italic;">${KJSEA.getTeacherComment(r.meanGrade)}</div>
      <div style="border-bottom:1px solid #94a3b8;margin:6px 0 3px;"></div>
      <div style="font-size:0.52rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;display:flex;justify-content:space-between;">
        <span>Class Teacher Signature &amp; Date</span><span>Date: .....................</span>
      </div>
    </div>
    <div style="padding:8px 12px;background:#ffffff;">
      <div style="font-size:0.55rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:3px;">Principal Signature Stamp &amp; Date</div>
      <div style="font-size:0.68rem;color:#334155;line-height:1.45;font-style:italic;">${KJSEA.getPrincipalComment(r, r.meanGrade)}</div>
      <div style="border-bottom:1px solid #94a3b8;margin:6px 0 3px;"></div>
      <div style="font-size:0.52rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;display:flex;justify-content:flex-end;">
        <span>Date: .....................</span>
      </div>
    </div>
  </div>

  <!-- ══ DATES BAR ══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1.5px solid #94a3b8;background:#ffffff;">
    <div style="padding:6px 12px;border-right:1.5px solid #94a3b8;display:flex;align-items:center;gap:8px;">
      <div style="width:26px;height:26px;border-radius:6px;background:#e1f5ee;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">📅</div>
      <div>
        <div style="font-size:0.52rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:1px;">Term Closing Date</div>
        <div style="font-size:0.78rem;font-weight:700;color:#0d3349;">${s.closingDate}</div>
      </div>
    </div>
    <div style="padding:6px 12px;display:flex;align-items:center;gap:8px;">
      <div style="width:26px;height:26px;border-radius:6px;background:#e1f5ee;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">📅</div>
      <div>
        <div style="font-size:0.52rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:1px;">Next Term Opens</div>
        <div style="font-size:0.78rem;font-weight:700;color:#0d3349;">${s.nextTerm}</div>
      </div>
    </div>
  </div>

  <!-- ══ PARENT SIGNATURE ══ -->
  <div style="padding:6px 12px;border-bottom:1.5px solid #94a3b8;display:flex;align-items:center;gap:8px;font-size:0.68rem;color:#475569;background:#ffffff;">
    <span style="white-space:nowrap;font-weight:600;">Parent / Guardian signature:</span>
    <div style="flex:1;border-bottom:1.5px solid #64748b;height:14px;"></div>
    <span style="white-space:nowrap;">Date: ___________</span>
  </div>

  <!-- ══ FOOTER ══ -->
  <div style="background:#0d3349;display:flex;align-items:center;justify-content:space-between;padding:6px 12px;">
    <div style="display:flex;align-items:center;gap:5px;font-size:0.62rem;color:rgba(255,255,255,0.55);">
      <span style="color:#4ecb8d;font-size:12px;">🎓</span>
      Powered by Scholar Analytics &nbsp;|&nbsp; ${s.schoolMotto}
    </div>
    <div style="font-size:0.55rem;color:rgba(255,255,255,0.30);">Confidential — For Authorised Personnel Only</div>
  </div>

</div>`;
};

/* ══════════════════════════════════════════════════════════
   12. BUILD CLASS RESULT SHEET
       Subject columns are now the real per-class subject list
       (state.subjects) instead of a fixed hardcoded 9.
══════════════════════════════════════════════════════════ */
const buildClassSheet = (results, s) => {
  const avg      = (results.reduce((a,r)=>a+r.avgScore,0)/results.length).toFixed(1);
  const highest  = Math.max(...results.map(r=>r.avgScore));
  const topPts   = Math.max(...results.map(r=>r.totalPoints));
  const passed   = results.filter(r=>r.avgScore>=41).length;
  const passRate = ((passed/results.length)*100).toFixed(1);

  const dist = {};
  KJSEA.SCALE.forEach(g => dist[g.grade]=0);
  results.forEach(r => { if(r.meanGrade && dist[r.meanGrade]!==undefined) dist[r.meanGrade]++; });

  const subjHeaders = state.subjects.map(subj=>
    `<th style="padding:7px 6px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);" title="${subj.name}">${subj.code}</th>`
  ).join('');

  const tableRows = results.map((r,i)=>{
    const rowBg     = i%2===0?'#ffffff':'#f8fafc';
    const rankCol   = r.position===1?'#d4a017':r.position===2?'#888':r.position===3?'#cd7f32':'#94a3b8';
    const subjCells = r.subjectResults.map(sub=>
      `<td style="padding:7px 6px;text-align:center;border-right:0.5px solid #e2e8f0;font-size:10.5px;">${sub.absent ? 'ABS' : (sub.score ?? '—')}</td>`
    ).join('');
    return `
      <tr style="background:${rowBg};border-bottom:0.5px solid #e2e8f0;">
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:700;color:${rankCol};font-size:11px;">${KJSEA.ordinal(r.position)}</td>
        <td style="padding:7px 10px;text-align:left;border-right:0.5px solid #e2e8f0;font-weight:600;font-size:11.5px;">${r.fullName}</td>
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-family:monospace;font-size:10px;">${r.upiNumber || '—'}</td>
        ${subjCells}
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:700;font-size:12px;color:#0d3349;">${r.totalScore}</td>
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-size:11px;">${r.avgScore}%</td>
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:800;font-size:12px;color:#0d3349;">${r.totalPoints}/${r.subjectCount*8}</td>
        <td style="padding:7px 8px;text-align:center;">
          <span style="display:inline-block;background:#e1f5ee;color:#0f6e56;border-radius:4px;padding:2px 7px;font-size:9px;font-weight:700;">${r.meanGrade || '--'}</span>
        </td>
      </tr>`;
  }).join('');

  const gradeColours = {EE1:'#d5f5e3',EE2:'#d5f5e3',ME1:'#d6eaf8',ME2:'#d6eaf8',AE1:'#fef9e7',AE2:'#fdebd0',BE1:'#fce4e4',BE2:'#f9d6d6'};
  const gradeText    = {EE1:'#1e8449',EE2:'#27ae60',ME1:'#1a6fa8',ME2:'#2980b9',AE1:'#d68910',AE2:'#ca6f1e',BE1:'#c0392b',BE2:'#922b21'};

  const distCells = KJSEA.SCALE.map(g=>`
    <div style="text-align:center;padding:10px 6px;border-right:1px solid #e2e8f0;background:${gradeColours[g.grade]};">
      <div style="font-size:0.65rem;font-weight:800;color:${gradeText[g.grade]};margin-bottom:3px;">${g.grade}</div>
      <div style="font-size:1.05rem;font-weight:700;color:${gradeText[g.grade]};">${dist[g.grade]}</div>
      <div style="font-size:0.55rem;color:#718096;">${g.label.split(' ').slice(-1)[0]}</div>
    </div>`
  ).join('');

  return `
<div style="max-width:900px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#2c3e50;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

  <!-- Header -->
  <div style="background:#0d3349;padding:16px 22px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:20px 20px;"></div>
    <div style="width:50px;height:50px;background:rgba(255,255,255,0.10);border:1.5px solid rgba(255,255,255,0.18);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;position:relative;z-index:1;">🎓</div>
    <div style="position:relative;z-index:1;flex:1;">
      <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:2px;">${s.schoolName.toUpperCase()}</div>
      <div style="font-size:0.70rem;color:rgba(255,255,255,0.55);margin-bottom:1px;">Junior Secondary School</div>
      <div style="font-size:0.68rem;color:#4ecb8d;font-style:italic;">${s.schoolMotto}</div>
    </div>
    <div style="text-align:right;position:relative;z-index:1;">
      <span style="display:inline-block;border:1px solid rgba(255,255,255,0.25);border-radius:6px;padding:3px 10px;font-size:0.65rem;font-weight:700;color:#fff;letter-spacing:0.5px;margin-bottom:5px;">Class Result Sheet</span>
      <div style="font-size:1.20rem;font-weight:800;color:#fff;">${s.year}</div>
    </div>
  </div>

  <!-- Pills bar -->
  <div style="background:#134a6a;display:flex;align-items:center;justify-content:center;gap:20px;padding:8px 20px;">
    <span style="color:rgba(255,255,255,0.85);font-size:0.75rem;font-weight:600;">📅 Term ${s.term}</span>
    <span style="color:rgba(255,255,255,0.25);">|</span>
    <span style="color:rgba(255,255,255,0.85);font-size:0.75rem;font-weight:600;">📄 ${s.exam} Examination</span>
    <span style="color:rgba(255,255,255,0.25);">|</span>
    <span style="color:rgba(255,255,255,0.85);font-size:0.75rem;font-weight:600;">🏫 ${s.cls}</span>
    <span style="color:rgba(255,255,255,0.25);">|</span>
    <span style="color:rgba(255,255,255,0.85);font-size:0.75rem;font-weight:600;">👥 ${results.length} Learners</span>
  </div>

  <!-- Stats strip -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);background:#f8fafc;border-bottom:2px solid #0d3349;">
    ${[
      { val:avg+'%',       lbl:'Class Average'     },
      { val:highest+'%',   lbl:'Highest Score'     },
      { val:topPts+'/'+(results[0]?.subjectCount*8 || 0),  lbl:'Top KJSEA Points'  },
      { val:passRate+'%',  lbl:'Pass Rate'          },
    ].map((c,i,a)=>`
      <div style="padding:12px 14px;text-align:center;${i<a.length-1?'border-right:1px solid #e2e8f0;':''}">
        <div style="font-size:1.15rem;font-weight:700;color:#0d3349;margin-bottom:2px;">${c.val}</div>
        <div style="font-size:0.60rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">${c.lbl}</div>
      </div>`
    ).join('')}
  </div>

  <!-- Section title -->
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;">Class Rankings</div>

  <!-- Table -->
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#134a6a;">
          <th style="padding:8px 8px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">Rank</th>
          <th style="padding:8px 10px;text-align:left;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">Learner Name</th>
          <th style="padding:8px 8px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">UPI</th>
          ${subjHeaders}
          <th style="padding:8px 8px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">Total</th>
          <th style="padding:8px 8px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">Avg%</th>
          <th style="padding:8px 8px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">Points</th>
          <th style="padding:8px 8px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;">Grade</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <!-- Grade distribution -->
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;">Grade Distribution</div>
  <div style="display:grid;grid-template-columns:repeat(8,1fr);">${distCells}</div>

  <!-- Signatures -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e2e8f0;">
    <div style="padding:12px 16px;border-right:1px solid #e2e8f0;">
      <div style="font-size:0.62rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Class Teacher: ${s.teacher||''}</div>
      <div style="border-bottom:1px solid #cbd5e0;margin:8px 0 4px;"></div>
      <div style="font-size:0.60rem;color:#94a3b8;">Signature &amp; Date: .....................</div>
    </div>
    <div style="padding:12px 16px;">
      <div style="font-size:0.62rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Principal: ${s.principal||''}</div>
      <div style="border-bottom:1px solid #cbd5e0;margin:8px 0 4px;"></div>
      <div style="font-size:0.60rem;color:#94a3b8;">Signature, Stamp &amp; Date: .....................</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#0d3349;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;">
    <div style="display:flex;align-items:center;gap:6px;font-size:0.70rem;color:rgba(255,255,255,0.50);">
      <span style="color:#4ecb8d;font-size:14px;">🎓</span>
      Powered by Scholar Analytics &nbsp;|&nbsp; ${s.schoolMotto}
    </div>
    <div style="font-size:0.65rem;color:rgba(255,255,255,0.30);">Confidential — For Authorised Personnel Only</div>
  </div>

</div>`;
};

/* ══════════════════════════════════════════════════════════
   13. BULK PREVIEW — All cards stacked
══════════════════════════════════════════════════════════ */
const buildBulkPreview = (results, settings) => {
  state.bulkCards = [];

  const pages = results.map((learner, i) => {
    const cardHTML = buildReportCard(learner, settings);
    state.bulkCards.push({ learner, html: cardHTML });
    return `
      <div style="position:relative;margin-bottom:4px;">
        <div style="font-size:11px;font-weight:700;color:#718096;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <i class="fas fa-file"></i>
          Card ${i+1} of ${results.length} — ${learner.fullName}
        </div>
        ${cardHTML}
      </div>`;
  });

  return `<div style="display:flex;flex-direction:column;gap:24px;">${pages.join('')}</div>`;
};

/* ══════════════════════════════════════════════════════════
   14. PRINT
══════════════════════════════════════════════════════════ */
el.printBtn?.addEventListener('click', () => {
  if (!el.previewPaper?.innerHTML.trim()) {
    showToast('Generate a preview first.', 'warning');
    return;
  }

  if (state.activeTab === 'bulk') {
    el.printArea.innerHTML = state.bulkCards.map(({ html }) => html).join('');
    showToast(`Sending ${state.bulkCards.length} report cards to printer...`, 'info');
  } else {
    el.printArea.innerHTML = el.previewPaper.innerHTML;
  }

  window.print();
});

/* ══════════════════════════════════════════════════════════
   15. PDF DOWNLOAD
══════════════════════════════════════════════════════════ */
el.downloadPdfBtn?.addEventListener('click', () => {
  state.activeTab === 'bulk' ? downloadBulkPDF() : downloadSinglePDF();
});

const setDownloadLoading = (loading) => {
  if (el.downloadPdfBtn)     el.downloadPdfBtn.disabled          = loading;
  if (el.downloadBtnText)    el.downloadBtnText.style.display    = loading ? 'none'   : 'inline';
  if (el.downloadBtnSpinner) el.downloadBtnSpinner.style.display = loading ? 'inline' : 'none';
};

/* ── Single / Class Sheet PDF ─────────────────────────── */
async function downloadSinglePDF() {
  if (!el.previewPaper?.innerHTML.trim()) {
    showToast('Generate a preview first.', 'warning');
    return;
  }

  const reportEl = el.previewPaper.querySelector('div');
  if (!reportEl) return;

  setDownloadLoading(true);

  try {
    const wrap       = document.createElement('div');
    wrap.style.cssText = 'position:fixed;top:-99999px;left:-99999px;width:794px;background:#fff;z-index:-9999;';
    wrap.appendChild(reportEl.cloneNode(true));
    document.body.appendChild(wrap);

    const canvas = await html2canvas(wrap, {
      scale:2, useCORS:true, allowTaint:true,
      backgroundColor:'#ffffff', logging:false,
      windowWidth:794, scrollX:0, scrollY:0,
    });

    document.body.removeChild(wrap);

    const { jsPDF } = window.jspdf;
    const pdf        = new jsPDF({ orientation:'portrait', unit:'mm',
      format: state.paperSize === 'Letter' ? 'letter' : 'a4' });

    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const img= canvas.toDataURL('image/png');
    const iw = pw;
    const ih = (canvas.height * iw) / canvas.width;

    let left = ih, pos = 0;
    pdf.addImage(img,'PNG',0,pos,iw,ih);
    left -= ph;

    while (left > 0) {
      pos = left - ih;
      pdf.addPage();
      pdf.addImage(img,'PNG',0,pos,iw,ih);
      left -= ph;
    }

    const ctx  = state.context;
    const date = new Date().toISOString().split('T')[0];
    let   fn   = '';

    if (state.activeTab === 'individual') {
      const lrn  = state.results.find(r=>r.studentId===el.rptLearner?.value);
      const name = lrn?.fullName?.replace(/\s+/g,'_')?.replace(/[^a-zA-Z0-9_]/g,'') || 'Learner';
      fn = `Report_Card_${name}_T${ctx.term}_${ctx.exam}_${date}.pdf`;
    } else {
      const cls = ctx.cls?.replace(/\s+/g,'_')?.replace(/[^a-zA-Z0-9_]/g,'') || 'Class';
      fn = `Class_Results_${cls}_T${ctx.term}_${ctx.exam}_${date}.pdf`;
    }

    pdf.save(fn);
    showToast('PDF downloaded!', 'success');
    addToRecent(ctx);

  } catch (err) {
    console.error(err);
    showToast('Failed to generate PDF. Please try again.', 'error');
  } finally {
    setDownloadLoading(false);
  }
}

/* ── Bulk PDF — all students one file ─────────────────── */
async function downloadBulkPDF() {
  if (!state.bulkCards.length) {
    showToast('Generate bulk preview first.', 'warning');
    return;
  }

  setDownloadLoading(true);
  if (el.bulkProgressBar) el.bulkProgressBar.style.display = 'block';

  try {
    const { jsPDF } = window.jspdf;
    const pdf        = new jsPDF({ orientation:'portrait', unit:'mm',
      format: state.paperSize === 'Letter' ? 'letter' : 'a4' });

    const pw    = pdf.internal.pageSize.getWidth();
    const ph    = pdf.internal.pageSize.getHeight();
    const total = state.bulkCards.length;

    for (let i = 0; i < total; i++) {
      const { learner, html } = state.bulkCards[i];

      const pct = Math.round(((i+1)/total)*100);
      if (el.bulkProgressFill) el.bulkProgressFill.style.width = pct + '%';
      if (el.bulkProgressText) el.bulkProgressText.textContent =
        `Generating ${i+1} of ${total} — ${learner.fullName}`;

      await new Promise(r => setTimeout(r, 20));

      const wrap       = document.createElement('div');
      wrap.style.cssText = 'position:fixed;top:-99999px;left:-99999px;width:794px;background:#fff;z-index:-9999;';
      wrap.innerHTML     = html;
      document.body.appendChild(wrap);

      const canvas = await html2canvas(wrap, {
        scale:1.5, useCORS:true, allowTaint:true,
        backgroundColor:'#ffffff', logging:false,
        windowWidth:794, scrollX:0, scrollY:0,
      });

      document.body.removeChild(wrap);

      const img = canvas.toDataURL('image/png');
      const iw  = pw;
      const ih  = (canvas.height * iw) / canvas.width;

      if (i > 0) pdf.addPage();

      let left = ih, pos = 0;
      pdf.addImage(img,'PNG',0,pos,iw,ih);
      left -= ph;

      while (left > 0) {
        pos = left - ih;
        pdf.addPage();
        pdf.addImage(img,'PNG',0,pos,iw,ih);
        left -= ph;
      }
    }

    const ctx  = state.context;
    const cls  = ctx.cls?.replace(/\s+/g,'_')?.replace(/[^a-zA-Z0-9_]/g,'') || 'Class';
    const date = new Date().toISOString().split('T')[0];
    const fn   = `All_Report_Cards_${cls}_T${ctx.term}_${ctx.exam}_${date}.pdf`;

    pdf.save(fn);
    showToast(`${total} report cards downloaded!`, 'success');
    addToRecent(ctx);

  } catch (err) {
    console.error(err);
    showToast('Failed. Please try again.', 'error');
  } finally {
    setDownloadLoading(false);
    if (el.bulkProgressBar)  el.bulkProgressBar.style.display = 'none';
    if (el.bulkProgressFill) el.bulkProgressFill.style.width  = '0%';
  }
}

/* ══════════════════════════════════════════════════════════
   16. RECENT REPORTS
══════════════════════════════════════════════════════════ */
const addToRecent = (ctx) => {
  const type = state.activeTab;
  const name = type === 'individual'
    ? state.results.find(r => r.studentId === el.rptLearner?.value)?.fullName || '--'
    : ctx.cls;

  state.recentReports.unshift({
    id  : Date.now(), type, name,
    meta: `Term ${ctx.term} — ${ctx.exam}`,
    time: new Date().toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' }),
  });

  if (state.recentReports.length > 5) state.recentReports.pop();
  renderRecentReports();
};

const renderRecentReports = () => {
  if (!el.recentReportsList) return;

  if (!state.recentReports.length) {
    el.recentReportsList.innerHTML = `<li class="recent-reports-empty">No reports generated yet.</li>`;
    return;
  }

  const icons = { individual:'fa-id-card', class:'fa-table-list', bulk:'fa-layer-group' };

  el.recentReportsList.innerHTML = state.recentReports.map(r => `
    <li class="recent-report-item">
      <div class="recent-report-icon ${r.type}">
        <i class="fas ${icons[r.type] || 'fa-file'}"></i>
      </div>
      <div class="recent-report-info">
        <p class="recent-report-name">${r.name}</p>
        <p class="recent-report-meta">${r.meta} &bull; ${r.time}</p>
      </div>
      <div class="recent-report-actions">
        <button class="recent-report-btn print"    onclick="reprintLast()"    title="Print"><i class="fas fa-print"></i></button>
        <button class="recent-report-btn download" onclick="redownloadLast()" title="Download PDF"><i class="fas fa-file-arrow-down"></i></button>
      </div>
    </li>`
  ).join('');
};

window.reprintLast = () => {
  if (el.previewPaper?.innerHTML) {
    el.printArea.innerHTML = el.previewPaper.innerHTML;
    window.print();
  } else showToast('Regenerate the report first.', 'warning');
};

window.redownloadLast = () => {
  if (el.previewPaper?.innerHTML) {
    state.activeTab === 'bulk' ? downloadBulkPDF() : downloadSinglePDF();
  } else showToast('Regenerate the report first.', 'warning');
};

/* ══════════════════════════════════════════════════════════
   17. INIT
══════════════════════════════════════════════════════════ */
switchTab('individual');
renderRecentReports();
loadClasses();
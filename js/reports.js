/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Reports & PDFs
   File: js/reports.js
   Version: 6.3
   6.2: ONE class dropdown — Whole Grade, or any single class (East / West).
        Exam names come from real exams; teacher names are saved per class.
   Changes from 6.0:
   • Pathway Summary follows the KNEC subject sets:
       STEM            = Mathematics, Integrated Science, Pre-Technical, Agriculture
       Creative Arts   = Creative Arts & Sports, English, Kiswahili
       Social Sciences = Social Studies, CRE + the better of English / Kiswahili
     Edit them in KJSEA.SUBJECT_SLOTS / KJSEA.PATHWAY_SUBJECTS.
   • Report card gridlines are black and thicker.
   • Subject teacher names can be typed on the Reports page, per
     class (e.g. Grade 7 East / Grade 7 West) or per grade when
     "Whole Grade" scope is used. Nothing is hard-coded: classes
     and subjects come from the backend. Names are saved in this
     browser and fill the TEACHER column on the report card.
   • Class teacher / Principal names print above signature lines.
═══════════════════════════════════════════════════════════ */

/* ── Auth ─────────────────────────────────────────────────── */
const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   1. KJSEA GRADING ENGINE
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

  /* ══════════════════════════════════════════════════════════
     KNEC PATHWAY SUBJECTS
     Which subjects count toward each pathway (as KNEC does it):
       STEM            → Mathematics, Integrated Science,
                         Pre-Technical, Agriculture
       Creative Arts   → Creative Arts & Sports, English, Kiswahili
       Social Sciences → Social Studies, Religious Education (CRE)
                         + the BETTER of English or Kiswahili

     A subject is recognised by its CODE or by the START of its
     NAME (case-insensitive). Add extra codes/names below if yours
     differ. In PATHWAY_SUBJECTS, a nested array like ['eng','kisw']
     means "take whichever of these has the higher score".
  ══════════════════════════════════════════════════════════ */
  SUBJECT_SLOTS: {
    math   : { label:'Mathematics',            codes:['MATH','MAT'],       names:['math'] },
    inter  : { label:'Integrated Science',     codes:['INTER','INT'],      names:['integrated science'] },
    pretech: { label:'Pre-Technical',          codes:['PRETECH','PRT'],    names:['pre technical','pre-technical','pretechnical','pre tech'] },
    agri   : { label:'Agriculture',            codes:['AGN','AGR','AGRI'], names:['agricultur'] },
    cas    : { label:'Creative Arts & Sports', codes:['CAS'],              names:['creative arts'] },
    eng    : { label:'English',                codes:['ENG'],              names:['english'] },
    kisw   : { label:'Kiswahili',              codes:['KISW','KIS'],       names:['kiswahili'] },
    sst    : { label:'Social Studies',         codes:['SST'],              names:['social studies'] },
    cre    : { label:'Religious Education',    codes:['CRE'],              names:['religious','christian religious'] },
  },

  PATHWAY_SUBJECTS: {
    stem    : ['math', 'inter', 'pretech', 'agri'],
    creative: ['cas', 'eng', 'kisw'],
    social  : ['sst', 'cre', ['eng', 'kisw']],   // better of English / Kiswahili
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

  /* Does this subject result belong to the given slot (math, eng, …)? */
  matchSlot(sub, slotKey) {
    const slot = this.SUBJECT_SLOTS[slotKey];
    if (!slot || !sub) return false;
    const code = String(sub.code || '').trim().toUpperCase();
    const name = String(sub.name || '').trim().toLowerCase();
    return slot.codes.includes(code) || slot.names.some(k => name.startsWith(k));
  },

  /* Pathway result per KNEC subject sets.
       avg    = mean score % of the counted subjects
       points = sum of their KJSEA points, out of 8 per subject
     Subjects the learner has no score for (absent / not entered)
     are left out, and the card says how many were counted. */
  computePathways(subjectResults) {
    const valid = s => s && s.score !== null && s.score !== undefined && !isNaN(Number(s.score));
    const scored = (subjectResults || []).filter(valid);
    const findSlot = key => scored.find(s => this.matchSlot(s, key)) || null;

    const out = {};

    Object.entries(this.PATHWAY_SUBJECTS).forEach(([key, slots]) => {
      const picked = [];

      slots.forEach(slot => {
        if (Array.isArray(slot)) {
          const cands = slot.map(findSlot).filter(Boolean);
          if (!cands.length) return;
          const best = cands.reduce((a, b) => Number(b.score) > Number(a.score) ? b : a);
          const label = slot.map(k => this.SUBJECT_SLOTS[k]?.label || k).join(' / ');
          picked.push({ sub: best, note: `better of ${label}` });
        } else {
          const sub = findSlot(slot);
          if (sub) picked.push({ sub });
        }
      });

      const scores  = picked.map(p => Number(p.sub.score));
      const avg     = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const points  = picked.reduce((a, p) => a + (p.sub.points || 0), 0);
      const gradeInfo = avg === null ? null : this.getGrade(Math.round(avg));

      out[key] = {
        avg     : avg === null ? null : parseFloat(avg.toFixed(1)),
        points,
        maxPts  : picked.length * 8,
        count   : picked.length,
        expected: slots.length,
        grade   : gradeInfo?.label   || '--',
        measure : gradeInfo?.measure || '--',
        css     : gradeInfo?.css     || '',
        subjects: picked.length
          ? picked.map(p => p.sub.name + (p.note ? ` (${p.note})` : '')).join(' · ')
          : 'No scored subjects for this pathway',
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
  scope        : 'class', // 'class' (one class) | 'grade' (whole grade)
  gradeValue   : '',      // e.g. "7" when scope === 'grade'
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
   3b. SUBJECT TEACHERS
   Teacher names are typed on the Reports page, one box per
   subject, and are always saved PER CLASS (e.g. Grade 7 East and
   Grade 7 West can have different teachers). They are stored in
   this browser (localStorage).
   • Single class selected  → one set of boxes.
   • Whole Grade selected   → one set of boxes for EACH stream; every
     learner's card shows the teachers of their own stream.
   Classes and subjects come from the backend — nothing is hard-coded.

   The panel is inserted right after the Principal field. If you
   prefer a fixed spot, add <div id="teacherNamesWrap"></div> to
   reports.html and the panel will render there instead.
══════════════════════════════════════════════════════════ */
const TEACHER_STORE_KEY = 'sa_report_subject_teachers_v1';

const normName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
const escHtml  = (t) => String(t ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const getTeacherStore = () => {
  try { return JSON.parse(localStorage.getItem(TEACHER_STORE_KEY)) || {}; }
  catch { return {}; }
};
const saveTeacherStore = (store) => {
  try { localStorage.setItem(TEACHER_STORE_KEY, JSON.stringify(store)); } catch { /* storage full/blocked */ }
};

/* Classes in the current selection: 1 for a single class, N for a whole grade */
const classesInScope = () => targetsOf(el.rptClass?.value);

/* { 'Grade 7 East': { subjectName: teacher }, 'Grade 7 West': { … } } */
const getTeacherMaps = () => {
  const store = getTeacherStore();
  const out = {};
  classesInScope().forEach(c => { out[c.name] = store[`class:${c._id}`] || {}; });
  return out;
};

const clearTeacherInputs = () => {
  const wrap = document.getElementById('teacherNamesWrap');
  if (wrap) wrap.innerHTML = '';
};

const renderTeacherInputs = () => {
  let wrap = document.getElementById('teacherNamesWrap');

  if (!wrap) {
    const anchor =
      el.rptPrincipal?.closest('.rpt-field, .form-group, .field') ||
      el.rptPrincipal?.parentElement;
    if (!anchor) return;
    wrap = document.createElement('div');
    wrap.id = 'teacherNamesWrap';
    wrap.style.cssText = 'grid-column:1 / -1;width:100%;margin-top:10px;';
    anchor.insertAdjacentElement('afterend', wrap);
  }

  const classes = classesInScope();
  if (!state.subjects.length || !classes.length) { wrap.innerHTML = ''; return; }

  const store = getTeacherStore();

  const section = (c) => `
    <div style="margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:#0d3349;margin-bottom:6px;">${escHtml(c.name)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
        ${state.subjects.map(subj => `
          <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:600;color:#334155;">
            ${escHtml(subj.name)}
            <input type="text" data-class="${c._id}" data-subj="${escHtml(normName(subj.name))}"
              value="${escHtml((store[`class:${c._id}`] || {})[normName(subj.name)] || '')}"
              placeholder="Teacher name"
              style="padding:7px 9px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;font-weight:400;" />
          </label>`).join('')}
      </div>
    </div>`;

  /* "Copy to other classes of this grade": from the first class in scope */
  const src   = classes[0];
  const dests = state.classes.filter(c => c.grade === src.grade && c._id !== src._id);
  const copyBtn = dests.length ? `
    <button type="button" id="copyTeachersBtn"
      style="padding:6px 12px;font-size:12px;font-weight:600;border:1px solid #94a3b8;border-radius:6px;background:#fff;color:#0d3349;cursor:pointer;">
      Copy ${escHtml(src.name)} names to ${dests.map(d => escHtml(d.name)).join(', ')}
    </button>` : '';

  wrap.innerHTML = `
    <div style="border:1px solid #cbd5e1;border-radius:8px;padding:12px;background:#f8fafc;">
      <div style="font-size:12px;font-weight:700;color:#0d3349;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">
        Subject Teachers
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:10px;">
        Type each teacher's name (e.g. Kemboi Dan). Saved on this device, separately for each class, and printed in the Teacher column.
      </div>
      ${classes.map(section).join('')}
      ${copyBtn}
    </div>`;

  wrap.querySelectorAll('input[data-subj]').forEach(inp => {
    inp.addEventListener('input', () => {
      const st  = getTeacherStore();
      const key = `class:${inp.dataset.class}`;
      st[key] = st[key] || {};
      st[key][inp.dataset.subj] = inp.value.trim();
      saveTeacherStore(st);
    });
  });

  document.getElementById('copyTeachersBtn')?.addEventListener('click', () => {
    const st      = getTeacherStore();
    const current = Object.fromEntries(
      Object.entries(st[`class:${src._id}`] || {}).filter(([, v]) => v));
    dests.forEach(d => {
      st[`class:${d._id}`] = { ...(st[`class:${d._id}`] || {}), ...current };
    });
    saveTeacherStore(st);
    renderTeacherInputs();
    showToast(`Teacher names copied to ${dests.length} other class${dests.length === 1 ? '' : 'es'}.`, 'success');
  });
};

/* ══════════════════════════════════════════════════════════
   4. CLASS / GRADE SELECTION
   ONE class dropdown with every choice:
     • Whole Grade (all streams together)
     • each single class (e.g. Grade 7 East, Grade 7 West)
   The old "This Class / Whole Grade" toggle, the separate Grade
   dropdown and the fixed exam-name dropdown are hidden.
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

const hideLegacyControls = () => {
  const a = el.scopeClassBtn, b = el.scopeGradeBtn;
  if (a && b && a.parentElement === b.parentElement &&
      a.parentElement.querySelectorAll('button').length === 2) {
    a.parentElement.style.display = 'none';
  } else {
    if (a) a.style.display = 'none';
    if (b) b.style.display = 'none';
  }
  if (el.gradeFieldWrap)    el.gradeFieldWrap.style.display    = 'none';
  if (el.examNameFieldWrap) el.examNameFieldWrap.style.display = 'none';
  if (el.classFieldWrap)    el.classFieldWrap.style.display    = 'flex';
  if (el.examFieldWrap)     el.examFieldWrap.style.display     = 'flex';
};

const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;

  state.classes = result.data.classes || [];

  const whole = gradeGroups()
    .filter(([, list]) => list.length > 1)
    .map(([g, list]) =>
      `<option value="grade:${escHtml(g)}">Grade ${escHtml(g)} — Whole Grade (${escHtml(list.map(streamLabel).join(' + '))})</option>`
    ).join('');
  const single = state.classes.map(c =>
    `<option value="${c._id}">${escHtml(c.name)}</option>`
  ).join('');

  if (el.rptClass) {
    el.rptClass.innerHTML = '<option value="">-- Select Class --</option>' +
      (whole  ? `<optgroup label="Whole grade (all streams together)">${whole}</optgroup>` : '') +
      (single ? `<optgroup label="Single class">${single}</optgroup>` : '');
  }
};

const resetLearnerList = () => {
  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">-- Select Learner --</option>';
};

/* ══════════════════════════════════════════════════════════
   5. LOAD EXAMS WHEN CLASS + TERM SELECTED
   Single class  → option value = exam id
   Whole grade   → option value = "year|exam name"
══════════════════════════════════════════════════════════ */
const loadExams = async () => {
  const value = el.rptClass?.value;
  const term  = el.rptTerm?.value;

  if (!value || !term || !el.rptExam) return;

  const targets = targetsOf(value);
  if (!targets.length) return;

  el.rptExam.innerHTML = '<option value="">Loading...</option>';

  if (!isGradeValue(value)) {
    const result = await API.get(`/exams?class=${value}&term=${term}`);

    if (!result?.ok || !result.data.exams?.length) {
      el.rptExam.innerHTML = '<option value="">No exams found</option>';
      return;
    }

    state.exams = result.data.exams;
    el.rptExam.innerHTML = '<option value="">-- Select Exam --</option>' +
      state.exams.map(e => `<option value="${e._id}">${escHtml(e.name)}</option>`).join('');
    return;
  }

  const results = await Promise.all(targets.map(c => API.get(`/exams?class=${c._id}&term=${term}`)));

  const map = {};
  results.forEach((r, i) => {
    (r?.ok ? (r.data.exams || []) : []).forEach(e => {
      const key = `${e.academicYear}|${e.name}`;
      map[key] = map[key] || { name: e.name, year: e.academicYear, classes: [] };
      map[key].classes.push(targets[i]);
    });
  });

  const keys = Object.keys(map).sort();
  if (!keys.length) {
    el.rptExam.innerHTML = '<option value="">No exams found</option>';
    return;
  }

  const manyYears = new Set(keys.map(k => map[k].year)).size > 1;

  el.rptExam.innerHTML = '<option value="">-- Select Exam --</option>' + keys.map(k => {
    const x = map[k];
    const missing = targets.filter(c => !x.classes.includes(c));
    const note = missing.length ? ` — not in ${missing.map(streamLabel).join(', ')}` : '';
    return `<option value="${escHtml(k)}">${escHtml(x.name)}${manyYears ? ` (${escHtml(x.year)})` : ''}${escHtml(note)}</option>`;
  }).join('');
};

el.rptClass?.addEventListener('change', () => {
  const v = el.rptClass.value;
  state.scope      = isGradeValue(v) ? 'grade' : 'class';
  state.gradeValue = isGradeValue(v) ? v.slice(6) : '';
  if (el.rptExam) el.rptExam.innerHTML = '<option value="">-- Select Exam --</option>';
  resetLearnerList();
  clearTeacherInputs();
  resetPreview();
  loadExams();
});

el.rptTerm?.addEventListener('change', () => {
  if (el.rptExam) el.rptExam.innerHTML = '<option value="">-- Select Exam --</option>';
  resetLearnerList();
  resetPreview();
  loadExams();
});

/* ══════════════════════════════════════════════════════════
   6. WHEN SELECTION IS COMPLETE — FETCH REAL RESULTS
   This populates the Learner dropdown (individual tab) and
   is reused directly when the user clicks "Preview Report",
   so results are only fetched once per selection.
══════════════════════════════════════════════════════════ */
el.rptExam?.addEventListener('change', fetchResults);

async function fetchResults() {
  const classVal = el.rptClass?.value;
  const examVal  = el.rptExam?.value;
  const term     = el.rptTerm?.value;
  if (!classVal || !examVal) return;

  let apiUrl;
  let key;

  if (state.scope === 'class') {
    apiUrl = `/results/class?classId=${classVal}&examId=${examVal}`;
    key    = `class:${classVal}:${examVal}`;

  } else {
    if (!term) return;
    const i        = examVal.indexOf('|');
    const year     = examVal.slice(0, i);
    const examName = examVal.slice(i + 1);
    apiUrl = `/results/grade?grade=${encodeURIComponent(state.gradeValue)}&term=${term}` +
             `&examName=${encodeURIComponent(examName)}&academicYear=${encodeURIComponent(year)}`;
    key    = `grade:${state.gradeValue}:${term}:${examVal}`;
  }

  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">Loading...</option>';

  const result = await API.get(apiUrl);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to load results.', 'error');
    resetLearnerList();
    return;
  }

  const data = result.data;

  state.subjects  = data.subjects || [];
  state.results   = computeResults(data.results || []);
  state.loadedKey = key;

  /* Show the "Subject Teachers" boxes for the class(es) in scope */
  renderTeacherInputs();

  if (state.scope === 'class') {
    state.classInfo = data.class;
    state.examInfo  = data.exam;
  } else {
    state.classInfo = { name: `Grade ${data.grade} — Whole Grade (${(data.streams || []).join(' + ')})` };
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
        `<option value="${r.studentId}">${escHtml(r.fullName)}${r.streamName ? ' — ' + escHtml(r.streamName) : ''}</option>`
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

  const cls  = el.rptClass?.value;
  const exam = el.rptExam?.value;
  if (!cls || !exam) {
    showToast('Please select Class and Exam.', 'warning');
    flashMissing(cls, term, exam);
    return;
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
    : `grade:${state.gradeValue}:${term}:${exam}`;

  if (state.loadedKey !== expectedKey) {
    await fetchResults();
  }

  if (!state.results.length) {
    showToast('No results found. Enter or import marks first.', 'error');
    return;
  }

  const className = state.scope === 'class'
    ? (state.classes.find(c => c._id === cls)?.name || state.classInfo?.name || 'Class')
    : (state.classInfo?.name || 'Whole Grade');

  const examName = state.scope === 'class'
    ? (state.exams.find(e => e._id === exam)?.name || state.examInfo?.name || 'Exam')
    : (state.examInfo?.name || 'Exam');

  const settings = {
    schoolName   : el.rptSchoolName?.value  || 'Scholar Analytics Demo School',
    schoolMotto  : el.rptSchoolMotto?.value || 'Excellence Through Knowledge',
    teacher      : (el.rptTeacher?.value   || '').trim(),   // class teacher (blank if not typed)
    principal    : (el.rptPrincipal?.value || '').trim(),   // principal (blank if not typed)
    teacherMaps  : getTeacherMaps(),                        // subject teachers, per class in scope
    closingDate  : el.rptClosingDate?.value || 'To Be Announced',
    nextTerm     : el.rptNextTerm?.value    || 'To Be Announced',
    cls: className, term, exam: examName,
    year         : state.examInfo?.academicYear || CURRENT_YEAR,
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
  const clsId  = 'rptClass';
  const examId = 'rptExam';
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
══════════════════════════════════════════════════════════ */
const buildReportCard = (r, s) => {

  /* ── Design tokens ──────────────────────────────────────── */
  const INK  = '#0b1220';   // body text
  const LINE = '#000000';   // gridlines
  const MUTE = '#475569';   // secondary text
  const NAVY = '#0d3349';   // brand / section bars
  const LEVEL_COL = {
    EE1:'#15803d', EE2:'#15803d',
    ME1:'#1d4ed8', ME2:'#1d4ed8',
    AE1:'#b45309', AE2:'#b45309',
    BE1:'#b91c1c', BE2:'#b91c1c',
  };

  /* Level chip: white fill, coloured outline + text (prints crisply) */
  const chip = (code, extra = '') => {
    const c = LEVEL_COL[code] || MUTE;
    return `<span style="display:inline-block;min-width:30px;text-align:center;padding:2px 5px;border:1.5px solid ${c};color:${c};background:#ffffff;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.3px;line-height:1.2;${extra}">${escHtml(code || '—')}</span>`;
  };

  const sectionBar = (title, right = '') => `
    <div style="background:${NAVY};color:#ffffff;display:flex;justify-content:space-between;align-items:center;padding:5px 12px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
      <span>${title}</span><span style="font-weight:500;letter-spacing:0.3px;text-transform:none;opacity:0.85;">${right}</span>
    </div>`;

  const th = (label, width, align = 'center', last = false) =>
    `<th style="width:${width}%;padding:6px 8px;text-align:${align};font-size:8.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:#ffffff;background:${NAVY};border-right:${last ? 'none' : '2px solid rgba(255,255,255,0.65)'};">${label}</th>`;

  const td = (extra = '') =>
    `padding:5px 8px;background:#ffffff;border-right:2px solid ${LINE};border-bottom:2px solid ${LINE};vertical-align:middle;${extra}`;

  /* ── Derived values ─────────────────────────────────────── */
  const maxTotal  = r.subjectCount * 100;
  const maxPoints = r.subjectCount * 8;

  const initials = String(s.schoolName || 'S').trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map(w => w[0].toUpperCase()).join('');

  const gender   = r.gender ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1) : '—';

  /* Teacher for a subject: typed name (for THIS learner's class) first,
     then any name the backend already sends, otherwise a dash. */
  const maps = s.teacherMaps || {};
  const teacherMap =
    maps[r.streamName] ||
    (Object.keys(maps).length === 1 ? Object.values(maps)[0] : null) || {};
  const teacherFor = (sub) => teacherMap[normName(sub.name)] || sub.teacherName || '—';

  /* ── Subject rows ───────────────────────────────────────── */
  const subjectRows = r.subjectResults.map((sub, i) => {
    const gradeInfo = KJSEA.getGrade(sub.score);
    const code      = sub.grade || '';
    const label     = gradeInfo ? gradeInfo.label.split(' ')[0] : (sub.absent ? 'Absent' : sub.notEntered ? 'Not entered' : '');
    const scoreTxt  = sub.score !== null && sub.score !== undefined ? sub.score + '%' : (sub.absent ? 'ABS' : '—');
    const remark    = sub.absent ? 'Absent — not assessed' : sub.notEntered ? 'Marks not entered' : KJSEA.getSubjectRemark(sub.score);
    const hasLevel  = !!LEVEL_COL[code];

    return `
    <tr>
      <td style="${td(`text-align:center;color:${MUTE};font-size:10px;font-weight:600;`)}">${i + 1}</td>
      <td style="${td(`text-align:left;font-weight:700;font-size:11.5px;color:${INK};`)}">${escHtml(sub.name)}</td>
      <td style="${td(`text-align:center;font-weight:800;font-size:12px;color:${INK};`)}">${scoreTxt}</td>
      <td style="${td('text-align:left;')}">
        ${hasLevel ? chip(code) : ''}
        <span style="font-size:9px;color:${INK};margin-left:${hasLevel ? 6 : 0}px;">${escHtml(label)}</span>
      </td>
      <td style="${td(`text-align:center;font-weight:800;font-size:12px;color:${INK};`)}">${sub.absent || sub.notEntered ? '—' : sub.points}<span style="font-size:8.5px;color:${MUTE};font-weight:500;">${sub.absent || sub.notEntered ? '' : '/8'}</span></td>
      <td style="${td(`text-align:left;font-size:9.5px;font-style:italic;color:${MUTE};`)}">${escHtml(remark)}</td>
      <td style="${td(`text-align:left;font-size:9.5px;font-weight:700;color:${INK};line-height:1.25;border-right:none;`)}">${escHtml(teacherFor(sub))}</td>
    </tr>`;
  }).join('');

  /* ── Learner details grid ───────────────────────────────── */
  const cell = (label, value, { span = 1, last = false, bottom = true } = {}) => `
    <div style="grid-column:span ${span};padding:6px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}${bottom ? `border-bottom:2px solid ${LINE};` : ''}">
      <div style="font-size:7.5px;font-weight:700;color:${MUTE};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">${label}</div>
      <div style="font-size:12.5px;font-weight:800;color:${INK};line-height:1.2;">${value}</div>
    </div>`;

  const learnerGrid = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:3px solid ${LINE};">
      ${cell('Learner name',  escHtml(r.fullName),            { span: 2 })}
      ${cell('Class',         escHtml(r.streamName || s.cls))}
      ${cell('Gender',        escHtml(gender),                { last: true })}
      ${cell('Assessment no.', escHtml(r.assessmentNo || '—'), { bottom: false })}
      ${cell('Admission no.',  escHtml(r.upiNumber || '—'),    { bottom: false })}
      ${cell('Academic year',  escHtml(s.year),                { bottom: false, span: 2, last: true })}
    </div>`;

  /* ── Key figures strip ──────────────────────────────────── */
  const stat = (label, value, last = false) => `
    <div style="padding:7px 12px;text-align:center;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:7.5px;font-weight:700;color:${MUTE};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">${label}</div>
      <div style="font-size:16px;font-weight:800;color:${NAVY};line-height:1.1;">${value}</div>
    </div>`;

  const statsStrip = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:3px solid ${LINE};">
      ${stat('Total marks',  `${r.totalScore}<span style="font-size:10px;color:${MUTE};font-weight:600;">/${maxTotal}</span>`)}
      ${stat('Average',      `${r.avgScore}%`)}
      ${stat('KJSEA points', `${r.totalPoints}<span style="font-size:10px;color:${MUTE};font-weight:600;">/${maxPoints}</span>`)}
      ${stat('Overall level', `${chip(r.meanGrade, 'font-size:11px;padding:2px 8px;')} <span style="font-size:9px;font-weight:600;color:${INK};margin-left:4px;">${escHtml(r.meanGradeInfo?.label || '')}</span>`, true)}
    </div>`;

  /* ── Pathway summary ────────────────────────────────────── */
  const pathwayConfig = [
    { key:'stem',     ...KJSEA.PATHWAYS.stem     },
    { key:'social',   ...KJSEA.PATHWAYS.social   },
    { key:'creative', ...KJSEA.PATHWAYS.creative },
  ];

  const pathwayCells = pathwayConfig.map(({ key, name, col }, i) => {
    const pw       = r.pathways[key];
    const last     = i === pathwayConfig.length - 1;
    const hasScore = pw.avg !== null;
    const code     = (pw.css || '').toUpperCase();
    const partial  = hasScore && pw.count < pw.expected
      ? `<div style="font-size:8px;color:${MUTE};margin-top:4px;">${pw.count} of ${pw.expected} subjects counted</div>` : '';
    return `
      <div style="flex:1;padding:9px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="width:9px;height:9px;background:${col};border-radius:2px;display:inline-block;"></span>
          <span style="font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:${INK};">${name}</span>
        </div>
        <div style="font-size:8px;color:${MUTE};line-height:1.35;min-height:22px;">${escHtml(pw.subjects)}</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin:5px 0 5px;">
          <span style="font-size:24px;font-weight:800;color:${col};line-height:1;">${hasScore ? pw.avg + '%' : '—'}</span>
          <span style="font-size:10px;font-weight:700;color:${INK};">${hasScore ? pw.points + '/' + pw.maxPts + ' pts' : ''}</span>
        </div>
        <div style="height:8px;border:1.5px solid ${LINE};border-radius:4px;overflow:hidden;background:#ffffff;">
          <div style="height:100%;width:${hasScore ? Math.min(100, pw.avg) : 0}%;background:${col};"></div>
        </div>
        <div style="margin-top:6px;display:flex;align-items:center;">
          ${hasScore ? chip(code) : ''}
          <span style="font-size:9px;font-weight:600;color:${INK};margin-left:${hasScore ? 6 : 0}px;">${hasScore ? escHtml(pw.grade) : 'No data'}</span>
        </div>
        ${partial}
      </div>`;
  }).join('');

  /* ── Comments + sign-off ────────────────────────────────── */
  const signBlock = (title, comment, person, personLabel, last = false) => `
    <div style="padding:8px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:7.5px;font-weight:700;color:${MUTE};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">${title}</div>
      <div style="font-size:10px;color:${INK};line-height:1.45;font-style:italic;min-height:44px;">${escHtml(comment)}</div>
      <div style="margin-top:14px;border-bottom:2px solid ${LINE};"></div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:8px;color:${MUTE};">
        <span><strong style="color:${INK};font-size:9.5px;">${person ? escHtml(person) : '&nbsp;'}</strong><br/>${personLabel}</span>
        <span style="align-self:flex-end;">Date: ....................</span>
      </div>
    </div>`;

  const dateCell = (label, value, last = false) => `
    <div style="padding:6px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:7.5px;font-weight:700;color:${MUTE};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">${label}</div>
      <div style="font-size:12px;font-weight:800;color:${INK};">${escHtml(value)}</div>
    </div>`;

  /* ── Grading key ────────────────────────────────────────── */
  const keyCells = KJSEA.SCALE.map((g, i) => `
    <div style="padding:5px 4px;text-align:center;background:#ffffff;${i < KJSEA.SCALE.length - 1 ? `border-right:2px solid ${LINE};` : ''}">
      ${chip(g.grade)}
      <div style="font-size:8px;color:${INK};margin-top:3px;font-weight:600;">${g.min}–${g.max}%</div>
      <div style="font-size:7.5px;color:${MUTE};">${g.points} pts</div>
    </div>`).join('');

  /* ── Page ───────────────────────────────────────────────── */
  return `
<div style="width:100%;max-width:754px;box-sizing:border-box;background:#ffffff;color-scheme:light;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:3px solid ${LINE};border-radius:6px;overflow:hidden;font-family:'DM Sans','Segoe UI',Arial,sans-serif;font-size:11px;color:${INK};margin:0 auto;font-variant-numeric:tabular-nums;">

  <!-- Letterhead -->
  <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:#ffffff;border-bottom:3px solid ${LINE};">
    <div style="width:50px;height:50px;background:${NAVY};color:#ffffff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;letter-spacing:1px;flex-shrink:0;">${escHtml(initials)}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:17px;font-weight:800;color:${NAVY};letter-spacing:0.4px;line-height:1.15;">${escHtml(String(s.schoolName).toUpperCase())}</div>
      <div style="font-size:10px;color:${MUTE};margin-top:3px;">Junior Secondary School &nbsp;&bull;&nbsp; <em>${escHtml(s.schoolMotto)}</em></div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:12.5px;font-weight:800;letter-spacing:1.2px;color:${INK};">LEARNER PROGRESS REPORT</div>
      <div style="font-size:10px;color:${MUTE};margin-top:3px;">Term ${escHtml(s.term)} &nbsp;&bull;&nbsp; ${escHtml(s.exam)} Examination &nbsp;&bull;&nbsp; ${escHtml(s.year)}</div>
    </div>
  </div>

  ${learnerGrid}
  ${statsStrip}

  ${sectionBar('Subject performance')}
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <thead>
      <tr>
        ${th('No.', 4)}${th('Learning area', 21, 'left')}${th('Score', 9)}${th('Level', 20, 'left')}${th('Points', 8)}${th('Teacher&rsquo;s remark', 24, 'left')}${th('Teacher', 14, 'left', true)}
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
      <tr>
        <td style="padding:6px 8px;background:${NAVY};border-right:2px solid rgba(255,255,255,0.65);"></td>
        <td style="padding:6px 8px;background:${NAVY};border-right:2px solid rgba(255,255,255,0.65);font-weight:800;font-size:10.5px;color:#ffffff;letter-spacing:0.8px;">TOTAL</td>
        <td style="padding:6px 8px;background:${NAVY};border-right:2px solid rgba(255,255,255,0.65);text-align:center;font-weight:800;font-size:11px;color:#ffffff;">${r.totalScore}/${maxTotal}</td>
        <td style="padding:6px 8px;background:${NAVY};border-right:2px solid rgba(255,255,255,0.65);">${chip(r.meanGrade)} <span style="font-size:9px;color:#ffffff;margin-left:4px;">${escHtml((r.meanGradeInfo?.label || '').split(' ')[0])}</span></td>
        <td style="padding:6px 8px;background:${NAVY};border-right:2px solid rgba(255,255,255,0.65);text-align:center;font-weight:800;font-size:11px;color:#ffffff;">${r.totalPoints}<span style="font-size:8.5px;opacity:0.7;font-weight:500;">/${maxPoints}</span></td>
        <td colspan="2" style="padding:6px 8px;background:${NAVY};font-style:italic;font-size:9.5px;color:#ffffff;">${escHtml(KJSEA.getTeacherComment(r.meanGrade).split('.')[0])}.</td>
      </tr>
    </tbody>
  </table>

  ${sectionBar('Pathway summary', 'Average of the KNEC subjects for each pathway')}
  <div style="display:flex;border-bottom:3px solid ${LINE};">${pathwayCells}</div>

  ${sectionBar('Comments')}
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:3px solid ${LINE};">
    ${signBlock("Class teacher's comment", KJSEA.getTeacherComment(r.meanGrade), s.teacher, 'Class teacher &mdash; signature')}
    ${signBlock("Principal's comment",     KJSEA.getPrincipalComment(r, r.meanGrade), s.principal, 'Principal &mdash; signature &amp; stamp', true)}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:3px solid ${LINE};">
    ${dateCell('Term closing date', s.closingDate)}
    ${dateCell('Next term opens',   s.nextTerm, true)}
  </div>

  <div style="display:flex;align-items:flex-end;gap:10px;padding:10px 12px 6px;background:#ffffff;border-bottom:3px solid ${LINE};font-size:10px;color:${INK};">
    <span style="white-space:nowrap;font-weight:700;">Parent / Guardian signature:</span>
    <div style="flex:1;border-bottom:2px solid ${LINE};height:14px;"></div>
    <span style="white-space:nowrap;">Date: ______________</span>
  </div>

  ${sectionBar('Grading key', 'Level, score range and KJSEA points')}
  <div style="display:grid;grid-template-columns:repeat(8,1fr);border-bottom:3px solid ${LINE};">${keyCells}</div>

  <!-- Footer -->
  <div style="background:${NAVY};display:flex;justify-content:space-between;align-items:center;padding:6px 14px;font-size:8.5px;color:rgba(255,255,255,0.85);">
    <span>Powered by Scholar Analytics</span>
    <span>Confidential &mdash; for authorised personnel only</span>
  </div>

</div>`;
};

/* ══════════════════════════════════════════════════════════
   12. BUILD CLASS RESULT SHEET
       Subject columns are the real per-class subject list
══════════════════════════════════════════════════════════ */
const buildClassSheet = (results, s) => {
  const avg      = (results.reduce((a,r)=>a+r.avgScore,0)/results.length).toFixed(1);
  const highest  = Math.max(...results.map(r=>r.avgScore));
  const topPts   = Math.max(...results.map(r=>r.totalPoints));
  const passed   = results.filter(r=>r.avgScore>=41).length;
  const passRate = ((passed/results.length)*100).toFixed(1);
  const meanPts  = (results.reduce((a,r)=>a+r.avgPoints,0)/results.length).toFixed(2);

  /* Grade distribution */
  const dist = {};
  KJSEA.SCALE.forEach(g => dist[g.grade] = 0);
  let xCount = 0;
  results.forEach(r => {
    if (r.subjectCount === 0) { xCount++; return; }
    if (r.meanGrade && dist[r.meanGrade] !== undefined) dist[r.meanGrade]++;
  });

  /* Subject averages + top 3 + grade dist per subject */
  const subjectStats = state.subjects.map(subj => {
    const scores = results
      .map(r => r.subjectResults?.find(s => s.subjectId?.toString() === subj._id?.toString()))
      .filter(s => s && !s.absent && !s.notEntered && s.score !== null)
      .map(s => ({ fullName: results.find(r => r.subjectResults?.includes(s))?.fullName || '', score: s.score, grade: s.grade, points: s.points }));

    const allScores  = scores.map(s => s.score);
    const avg        = allScores.length ? parseFloat((allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(1)) : 0;
    const avgPts     = allScores.length
      ? parseFloat((scores.map(s => s.points||0).reduce((a,b)=>a+b,0)/allScores.length).toFixed(2)) : 0;

    const subDist = {};
    KJSEA.SCALE.forEach(g => subDist[g.grade] = 0);
    scores.forEach(s => { if (s.grade && subDist[s.grade] !== undefined) subDist[s.grade]++; });

    const top3 = [...scores].sort((a,b)=>b.score-a.score).slice(0,3);

    return { ...subj, avg, avgPts, subDist, top3, count: allScores.length };
  }).sort((a,b) => b.avg - a.avg).map((s,i) => ({ ...s, rank: i+1 }));

  /* Gender analytics */
  const males   = results.filter(r => r.gender === 'male'   && r.subjectCount > 0);
  const females = results.filter(r => r.gender === 'female' && r.subjectCount > 0);
  const maleAvg   = males.length   ? parseFloat((males.reduce((a,r)=>a+r.avgScore,0)/males.length).toFixed(1))   : 0;
  const femaleAvg = females.length ? parseFloat((females.reduce((a,r)=>a+r.avgScore,0)/females.length).toFixed(1)) : 0;
  const betterGender = femaleAvg >= maleAvg ? 'Female' : 'Male';
  const genderGap    = Math.abs(maleAvg - femaleAvg).toFixed(2);

  /* Most improved (VAP) */
  const mostImproved = results
    .filter(r => r.vap !== null && r.vap !== undefined && r.vap > 0)
    .sort((a,b) => b.vap - a.vap)
    .slice(0, 5);

  /* ── TABLE ROWS ── */
  const subjHeaders = state.subjects.map(subj =>
    `<th style="padding:6px 4px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);" title="${subj.name}">${subj.code}</th>`
  ).join('');

  const gradeColours = {EE1:'#d5f5e3',EE2:'#d5f5e3',ME1:'#d6eaf8',ME2:'#d6eaf8',AE1:'#fef9e7',AE2:'#fdebd0',BE1:'#fce4e4',BE2:'#f9d6d6'};
  const gradeText    = {EE1:'#1e8449',EE2:'#27ae60',ME1:'#1a6fa8',ME2:'#2980b9',AE1:'#d68910',AE2:'#ca6f1e',BE1:'#c0392b',BE2:'#922b21'};

  const tableRows = results.map((r,i) => {
    const rowBg    = i%2===0 ? '#ffffff' : '#f8fafc';
    const rankCol  = r.position===1?'#d4a017':r.position===2?'#888':r.position===3?'#cd7f32':'#94a3b8';
    const vapCol   = !r.vap ? '#94a3b8' : r.vap > 0 ? '#27ae60' : '#e74c3c';
    const vapText  = r.vap !== null && r.vap !== undefined ? (r.vap > 0 ? `+${r.vap}` : `${r.vap}`) : '—';
    const subjCells= state.subjects.map(subj => {
      const sr = r.subjectResults?.find(s => s.subjectId?.toString() === subj._id?.toString());
      const val= (!sr||sr.notEntered) ? '—' : sr.absent ? 'ABS' : sr.score;
      const col= sr?.grade ? gradeText[sr.grade] : '#333';
      return `<td style="padding:6px 4px;text-align:center;border-right:0.5px solid #e2e8f0;font-size:10px;font-weight:600;color:${col};">${val}</td>`;
    }).join('');

    return `
      <tr style="background:${rowBg};border-bottom:0.5px solid #e2e8f0;">
        <td style="padding:6px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:700;color:${rankCol};font-size:11px;">${KJSEA.ordinal(r.position)}</td>
        <td style="padding:6px 10px;text-align:left;border-right:0.5px solid #e2e8f0;font-weight:600;font-size:11px;">${r.fullName}</td>
        <td style="padding:6px 6px;text-align:center;border-right:0.5px solid #e2e8f0;font-size:9.5px;color:#64748b;">${r.gender?.charAt(0).toUpperCase()||'—'}</td>
        ${subjCells}
        <td style="padding:6px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:700;font-size:11px;color:#0d3349;">${r.totalScore}</td>
        <td style="padding:6px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-size:11px;font-weight:700;">${r.avgScore}%</td>
        <td style="padding:6px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:700;font-size:11px;color:#7d3c98;">${r.totalPoints}</td>
        <td style="padding:6px 8px;text-align:center;border-right:0.5px solid #e2e8f0;">
          <span style="display:inline-block;background:${gradeColours[r.meanGrade]||'#f0f4f8'};color:${gradeText[r.meanGrade]||'#666'};border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700;">${r.meanGrade||'—'}</span>
        </td>
        <td style="padding:6px 8px;text-align:center;font-weight:700;font-size:11px;color:${vapCol};">${vapText}</td>
      </tr>`;
  }).join('');

  /* ── SUBJECT AVERAGES TABLE ROW ── */
  const subjectAvgRow = state.subjects.map(subj => {
    const ss  = subjectStats.find(s => s._id?.toString() === subj._id?.toString());
    const avg = ss?.avg || 0;
    const col = avg >= 75 ? '#1e8449' : avg >= 58 ? '#1a6fa8' : avg >= 41 ? '#d68910' : '#c0392b';
    return `<td style="padding:6px 4px;text-align:center;border-right:0.5px solid rgba(255,255,255,0.15);font-size:10px;font-weight:700;color:${col};">${avg}%</td>`;
  }).join('');

  /* ── SUBJECT PERFORMANCE SUMMARY TABLE ── */
  const subjectSummaryRows = subjectStats.map(s => {
    const barCol = s.avg >= 75 ? '#27ae60' : s.avg >= 58 ? '#2e86c1' : s.avg >= 41 ? '#e67e22' : '#e74c3c';
    const distCells = KJSEA.SCALE.map(g =>
      `<td style="padding:5px 6px;text-align:center;font-size:10px;font-weight:${(s.subDist[g.grade]||0)>0?'700':'400'};color:${(s.subDist[g.grade]||0)>0?gradeText[g.grade]:'#94a3b8'};">${s.subDist[g.grade]||0}</td>`
    ).join('');
    return `
      <tr>
        <td style="padding:6px 10px;font-weight:700;color:${barCol};text-align:center;">${s.rank}</td>
        <td style="padding:6px 10px;font-weight:600;">${s.name}</td>
        <td style="padding:6px 10px;font-weight:700;color:${barCol};text-align:center;">${s.avg}%</td>
        <td style="padding:6px 10px;font-weight:700;color:#7d3c98;text-align:center;">${s.avgPts}</td>
        ${distCells}
      </tr>`;
  }).join('');

  /* ── TOP 3 PER SUBJECT ── */
  const top3Cards = subjectStats.map(s => `
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;min-width:180px;">
      <div style="background:#0d3349;padding:7px 12px;">
        <p style="font-size:0.78rem;font-weight:700;color:white;margin:0;">${s.name}</p>
        <p style="font-size:0.65rem;color:rgba(255,255,255,0.50);margin:0;">Avg: ${s.avg}%</p>
      </div>
      <div style="padding:8px;">
        ${s.top3.map((st,i) => `
          <div style="display:flex;align-items:center;gap:6px;padding:5px 0;${i<s.top3.length-1?'border-bottom:1px solid #f0f4f8':''}">
            <span style="font-size:0.9rem;">${i===0?'🥇':i===1?'🥈':'🥉'}</span>
            <span style="font-size:0.75rem;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${st.fullName}</span>
            <span style="font-size:0.72rem;font-weight:700;background:${gradeColours[st.grade]||'#f0f4f8'};color:${gradeText[st.grade]||'#666'};padding:1px 5px;border-radius:3px;">${st.score}</span>
          </div>
        `).join('')}
        ${!s.top3.length ? '<p style="font-size:0.72rem;color:#94a3b8;padding:4px 0;">No data</p>' : ''}
      </div>
    </div>
  `).join('');

  /* ── GRADE DIST CELLS ── */
  const distCells = KJSEA.SCALE.map(g => `
    <div style="text-align:center;padding:10px 6px;border-right:1px solid #e2e8f0;background:${gradeColours[g.grade]};">
      <div style="font-size:0.65rem;font-weight:800;color:${gradeText[g.grade]};margin-bottom:3px;">${g.grade}</div>
      <div style="font-size:1.05rem;font-weight:700;color:${gradeText[g.grade]};">${dist[g.grade]}</div>
    </div>`
  ).join('') + (xCount > 0 ? `
    <div style="text-align:center;padding:10px 6px;background:#f0f4f8;">
      <div style="font-size:0.65rem;font-weight:800;color:#94a3b8;margin-bottom:3px;">X</div>
      <div style="font-size:1.05rem;font-weight:700;color:#94a3b8;">${xCount}</div>
    </div>` : '');

  /* ── GENDER SUBJECT TABLE ── */
  const genderSubjectRows = state.subjects.map(subj => {
    const maleScores   = males.map(r => r.subjectResults?.find(s => s.subjectId?.toString() === subj._id?.toString())).filter(s=>s&&!s.absent&&!s.notEntered&&s.score!==null).map(s=>s.score);
    const femaleScores = females.map(r => r.subjectResults?.find(s => s.subjectId?.toString() === subj._id?.toString())).filter(s=>s&&!s.absent&&!s.notEntered&&s.score!==null).map(s=>s.score);
    const mA = maleScores.length   ? parseFloat((maleScores.reduce((a,b)=>a+b,0)/maleScores.length).toFixed(1))   : 0;
    const fA = femaleScores.length ? parseFloat((femaleScores.reduce((a,b)=>a+b,0)/femaleScores.length).toFixed(1)) : 0;
    const gap    = Math.abs(mA-fA).toFixed(1);
    const leader = mA > fA ? '♂ Male' : mA < fA ? '♀ Female' : 'Tie';
    const lCol   = mA > fA ? '#2980b9' : mA < fA ? '#c0392b' : '#94a3b8';
    return `
      <tr>
        <td style="padding:6px 10px;font-weight:600;">${subj.name}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:700;color:#2980b9;">${mA}%</td>
        <td style="padding:6px 10px;text-align:center;font-weight:700;color:#c0392b;">${fA}%</td>
        <td style="padding:6px 10px;text-align:center;font-weight:700;">${gap}</td>
        <td style="padding:6px 10px;text-align:center;font-weight:700;color:${lCol};">${leader}</td>
      </tr>`;
  }).join('');

  /* ── MOST IMPROVED ── */
  const improvedRows = mostImproved.length ? mostImproved.map((r,i) => `
    <tr>
      <td style="padding:6px 10px;font-weight:700;text-align:center;">${i+1}</td>
      <td style="padding:6px 10px;font-weight:600;">${r.fullName}</td>
      <td style="padding:6px 10px;text-align:center;">${r.prevPoints || '—'}</td>
      <td style="padding:6px 10px;text-align:center;font-weight:700;color:#1a6fa8;">${r.avgPoints}</td>
      <td style="padding:6px 10px;text-align:center;font-weight:700;color:#27ae60;">+${r.vap}</td>
    </tr>`
  ).join('') : '<tr><td colspan="5" style="text-align:center;padding:16px;color:#94a3b8;">No previous exam data for VAP comparison.</td></tr>';

  /* ════════════════════════════════════════════
     FULL HTML OUTPUT
  ════════════════════════════════════════════ */
  return `
<div style="max-width:960px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#2c3e50;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

  <!-- ══ HEADER ══ -->
  <div style="background:#0d3349;padding:16px 22px;display:flex;align-items:center;gap:14px;">
    <div style="width:50px;height:50px;background:rgba(255,255,255,0.10);border:1.5px solid rgba(255,255,255,0.18);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🎓</div>
    <div style="flex:1;">
      <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:2px;">${s.schoolName.toUpperCase()}</div>
      <div style="font-size:0.70rem;color:rgba(255,255,255,0.55);">Junior Secondary School &nbsp;|&nbsp; <em>${s.schoolMotto}</em></div>
    </div>
    <div style="text-align:right;">
      <span style="border:1px solid rgba(255,255,255,0.25);border-radius:6px;padding:4px 12px;font-size:0.72rem;font-weight:700;color:#fff;letter-spacing:0.5px;">ASSESSMENT RESULTS</span>
      <div style="font-size:0.70rem;color:rgba(255,255,255,0.50);margin-top:4px;">Grade: ${s.cls} &nbsp;|&nbsp; Term: ${s.term} &nbsp;|&nbsp; Exam: ${s.exam}</div>
    </div>
  </div>

  <!-- ══ STATS STRIP ══ -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);background:#f8fafc;border-bottom:2px solid #0d3349;">
    ${[
      { val: results.length,       lbl: 'Total Learners'    },
      { val: avg + '%',            lbl: 'Average Marks'     },
      { val: passed,               lbl: 'Passed (≥41%)'    },
      { val: passRate + '%',       lbl: 'Pass Rate'         },
      { val: meanPts,              lbl: 'Mean Points'       },
    ].map((c,i,a) => `
      <div style="padding:12px 14px;text-align:center;${i<a.length-1?'border-right:1px solid #e2e8f0;':''}">
        <div style="font-size:1.2rem;font-weight:700;color:#0d3349;margin-bottom:2px;">${c.val}</div>
        <div style="font-size:0.60rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">${c.lbl}</div>
      </div>`
    ).join('')}
  </div>

  <!-- ══ RANKINGS TABLE ══ -->
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;">Class Rankings</div>
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#134a6a;">
          <th style="padding:7px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Rank</th>
          <th style="padding:7px 10px;text-align:left;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Learner Name</th>
          <th style="padding:7px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Gender</th>
          ${subjHeaders}
          <th style="padding:7px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Total</th>
          <th style="padding:7px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Avg%</th>
          <th style="padding:7px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Points</th>
          <th style="padding:7px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Grade</th>
          <th style="padding:7px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);">VAP</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <!-- Class Average Row -->
        <tr style="background:#0d3349;">
          <td colspan="3" style="padding:7px 10px;color:rgba(255,255,255,0.70);font-size:0.70rem;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Class Average</td>
          ${subjectAvgRow}
          <td colspan="5" style="padding:7px 10px;color:rgba(255,255,255,0.50);font-size:0.68rem;">Avg: ${avg}% &nbsp;|&nbsp; Mean Pts: ${meanPts} &nbsp;|&nbsp; Pass Rate: ${passRate}%</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ══ OVERALL GRADE DISTRIBUTION ══ -->
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;">Overall Grade Distribution</div>
  <div style="display:grid;grid-template-columns:repeat(${xCount>0?9:8},1fr);">${distCells}</div>

  <!-- ══ SUBJECT-WISE PERFORMANCE SUMMARY ══ -->
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;">Subject-wise Performance Summary</div>
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#134a6a;">
          <th style="padding:7px 10px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Rank</th>
          <th style="padding:7px 10px;text-align:left;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Learning Area</th>
          <th style="padding:7px 10px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Avg Mark</th>
          <th style="padding:7px 10px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.70);border-right:1px solid rgba(255,255,255,0.08);">Avg Pts</th>
          ${KJSEA.SCALE.map(g=>`<th style="padding:7px 6px;text-align:center;font-size:0.56rem;font-weight:700;color:${gradeText[g.grade]};border-right:1px solid rgba(255,255,255,0.08);">${g.grade}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${subjectSummaryRows}</tbody>
    </table>
  </div>

  <!-- ══ TOP 3 PER SUBJECT ══ -->
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;">Top 3 Learners Per Subject</div>
  <div style="padding:14px;display:flex;flex-wrap:wrap;gap:10px;background:#f8fafc;">
    ${top3Cards}
  </div>

  <!-- ══ GENDER PERFORMANCE ══ -->
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;">Gender Performance Analytics</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <div style="padding:14px;border-right:1px solid #e2e8f0;">
      <div style="display:flex;gap:16px;margin-bottom:12px;">
        <div style="flex:1;background:#dbeafe;border-radius:8px;padding:12px;text-align:center;">
          <p style="font-size:1.2rem;font-weight:700;color:#2980b9;margin:0;">♂ ${males.length}</p>
          <p style="font-size:0.65rem;color:#64748b;margin:0;">Male &nbsp;|&nbsp; Avg: ${maleAvg}%</p>
        </div>
        <div style="flex:1;background:#fce7f3;border-radius:8px;padding:12px;text-align:center;">
          <p style="font-size:1.2rem;font-weight:700;color:#c0392b;margin:0;">♀ ${females.length}</p>
          <p style="font-size:0.65rem;color:#64748b;margin:0;">Female &nbsp;|&nbsp; Avg: ${femaleAvg}%</p>
        </div>
      </div>
      <div style="background:white;border:1px solid #e2e8f0;border-radius:6px;padding:10px;font-size:0.78rem;">
        <strong>Better Performing Gender: ${betterGender}</strong><br/>
        <span style="color:#64748b;">Performance Gap: ${genderGap} Marks</span>
      </div>
    </div>
    <div style="padding:14px;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
        <thead>
          <tr style="background:#134a6a;">
            <th style="padding:6px 8px;text-align:left;color:rgba(255,255,255,0.75);border-right:1px solid rgba(255,255,255,0.10);">Subject</th>
            <th style="padding:6px 8px;text-align:center;color:#2980b9;border-right:1px solid rgba(255,255,255,0.10);">♂ Male</th>
            <th style="padding:6px 8px;text-align:center;color:#c0392b;border-right:1px solid rgba(255,255,255,0.10);">♀ Female</th>
            <th style="padding:6px 8px;text-align:center;color:rgba(255,255,255,0.75);border-right:1px solid rgba(255,255,255,0.10);">Gap</th>
            <th style="padding:6px 8px;text-align:center;color:rgba(255,255,255,0.75);">Leader</th>
          </tr>
        </thead>
        <tbody>${genderSubjectRows}</tbody>
      </table>
    </div>
  </div>

  <!-- ══ MOST IMPROVED ══ -->
  ${mostImproved.length ? `
  <div style="background:#0d3349;padding:6px 16px;font-size:0.65rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;">Most Improved Learners (VAP)</div>
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:0.80rem;">
      <thead>
        <tr style="background:#134a6a;">
          <th style="padding:7px 10px;text-align:center;color:rgba(255,255,255,0.70);">Rank</th>
          <th style="padding:7px 10px;text-align:left;color:rgba(255,255,255,0.70);">Learner Name</th>
          <th style="padding:7px 10px;text-align:center;color:rgba(255,255,255,0.70);">Prev Points</th>
          <th style="padding:7px 10px;text-align:center;color:rgba(255,255,255,0.70);">Current Points</th>
          <th style="padding:7px 10px;text-align:center;color:rgba(255,255,255,0.70);">VAP (+/-)</th>
        </tr>
      </thead>
      <tbody>${improvedRows}</tbody>
    </table>
  </div>` : ''}

  <!-- ══ SIGNATURES ══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-top:2px solid #0d3349;margin-top:2px;">
    <div style="padding:14px 18px;border-right:1px solid #e2e8f0;">
      <div style="font-size:0.65rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Class Teacher: ${escHtml(s.teacher||'')}</div>
      <div style="border-bottom:1px solid #cbd5e0;margin:10px 0 6px;"></div>
      <div style="font-size:0.62rem;color:#94a3b8;">Signature &amp; Date: .....................</div>
    </div>
    <div style="padding:14px 18px;">
      <div style="font-size:0.65rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Principal: ${escHtml(s.principal||'')}</div>
      <div style="border-bottom:1px solid #cbd5e0;margin:10px 0 6px;"></div>
      <div style="font-size:0.62rem;color:#94a3b8;">Signature, Stamp &amp; Date: .....................</div>
    </div>
  </div>

  <!-- ══ FOOTER ══ -->
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

hideLegacyControls();
loadClasses();
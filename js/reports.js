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
/* ═══════════════════════════════════════════════════════════
   reports_fixes.js  — drop-in replacement for sections 11 and 12
   of js/reports.js (buildReportCard and buildClassSheet).

   HOW TO USE
   1. In reports.js DELETE the old "11. BUILD INDIVIDUAL REPORT CARD"
      (const buildReportCard = …) and "12. BUILD CLASS RESULT SHEET"
      (const buildClassSheet = …) blocks completely.
   2. Paste this whole file in their place (between sections 10 and 13).
   3. Make the two small edits in section 10 listed in the notes.

   Nothing else in reports.js is touched. Pathway calculations
   (KJSEA.computePathways) are unchanged.
═══════════════════════════════════════════════════════════ */

/* ── A. Grading scale: full level names, 0 covered, whole-number rounding ──
   These lines REPLACE the old KJSEA.SCALE / getGrade / getSubjectRemark.
   (They run after the KJSEA object exists, so the old copies are simply
   overridden; you can delete the old ones later if you like.) */
KJSEA.SCALE = [
  { grade:'EE1', label:'Exceeds Expectation',    full:'Exceeding Expectation',   measure:'Exceptional',   min:90, max:100, points:8, css:'ee1' },
  { grade:'EE2', label:'Exceeds Expectation',    full:'Exceeding Expectation',   measure:'Very Good',     min:75, max:89,  points:7, css:'ee2' },
  { grade:'ME1', label:'Meets Expectation',      full:'Meeting Expectation',     measure:'Good',          min:58, max:74,  points:6, css:'me1' },
  { grade:'ME2', label:'Meets Expectation',      full:'Meeting Expectation',     measure:'Fair',          min:41, max:57,  points:5, css:'me2' },
  { grade:'AE1', label:'Approaches Expectation', full:'Approaching Expectation', measure:'Developing',    min:31, max:40,  points:4, css:'ae1' },
  { grade:'AE2', label:'Approaches Expectation', full:'Approaching Expectation', measure:'Improving',     min:21, max:30,  points:3, css:'ae2' },
  { grade:'BE1', label:'Below Expectation',      full:'Below Expectation',       measure:'Minimal',       min:11, max:20,  points:2, css:'be1' },
  { grade:'BE2', label:'Below Expectation',      full:'Below Expectation',       measure:'Below Minimal', min:0,  max:10,  points:1, css:'be2' },
];

/* Marks are rounded to a whole number first, so 57.5 never falls between ranges */
KJSEA.getGrade = function (score) {
  if (score === null || score === undefined || score === '' || isNaN(Number(score))) return null;
  const n = Math.round(Number(score));
  return this.SCALE.find(s => n >= s.min && n <= s.max) || null;
};

KJSEA.levelFull = function (code) {
  return this.SCALE.find(s => s.grade === code)?.full || '';
};

/* Remark matched to the level, so it can never contradict the Performance Level column */
KJSEA.getSubjectRemark = function (score) {
  const g = this.getGrade(score);
  if (!g) return '—';
  return {
    EE1: 'Outstanding performance. Keep it up.',
    EE2: 'Very good performance. Aim even higher.',
    ME1: 'Good performance. The next level is within reach.',
    ME2: 'Meeting the expected standard. Steady practice will lift it.',
    AE1: 'Close to the expected standard. More practice needed.',
    AE2: 'Approaching the standard. Needs regular support and practice.',
    BE1: 'Below the expected standard. Needs extra support.',
    BE2: 'Well below the expected standard. Needs close support.',
  }[g.grade];
};

/* ── B. Shared print-friendly style: white page, black text, gridlines only ── */
const PRINT = { INK: '#000000', LINE: '#000000', MUTE: '#1f2937' };

/* "7 EAST" -> "Grade 7 East";  "Grade 7 East" stays as it is */
const prettyClass = (name) => {
  const t = String(name || '').trim();
  if (!t) return '—';
  const w = t.replace(/\w\S*/g, x => x[0].toUpperCase() + x.slice(1).toLowerCase());
  return /^\d/.test(w) ? 'Grade ' + w : w;
};

/* Level in full: name on line one, bold code on line two (no box, no colour) */
const levelBlock = (code) => {
  const full = KJSEA.levelFull(code);
  if (!code || !full) return '';
  return `<div style="font-size:10px;font-weight:600;line-height:1.2;">${escHtml(full)}</div>` +
         `<div style="font-size:11.5px;font-weight:800;line-height:1.25;">${escHtml(code)}</div>`;
};

/* ══════════════════════════════════════════════════════════
   11. BUILD INDIVIDUAL REPORT CARD  (7 columns, low ink)
══════════════════════════════════════════════════════════ */
const buildReportCard = (r, s) => {
  const { INK, LINE, MUTE } = PRINT;

  const sectionBar = (title, right = '') => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 12px;background:#ffffff;color:${INK};border-bottom:2px solid ${LINE};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
      <span>${title}</span><span style="font-weight:600;letter-spacing:0.2px;text-transform:none;">${right}</span>
    </div>`;

  const th = (label, width, align = 'center', last = false) =>
    `<th style="width:${width}%;padding:6px 6px;text-align:${align};font-size:9.5px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;line-height:1.2;color:${INK};background:#ffffff;border-right:${last ? 'none' : `2px solid ${LINE}`};border-bottom:3px solid ${LINE};">${label}</th>`;

  const td = (extra = '') =>
    `padding:5px 6px;background:#ffffff;border-right:2px solid ${LINE};border-bottom:2px solid ${LINE};vertical-align:middle;${extra}`;

  /* ── Derived values ─────────────────────────────────────── */
  const maxTotal  = r.subjectCount * 100;
  const maxPoints = r.subjectCount * 8;

  const initials = String(s.schoolName || 'S').trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map(w => w[0].toUpperCase()).join('');

  const gender = r.gender ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1) : '';

  /* Teacher for a subject: name typed for THIS learner's class, else the backend's, else blank */
  const maps = s.teacherMaps || {};
  const teacherMap =
    maps[r.streamName] ||
    (Object.keys(maps).length === 1 ? Object.values(maps)[0] : null) || {};
  const teacherFor = (sub) => teacherMap[normName(sub.name)] || sub.teacherName || '';

  /* ── Subject rows ───────────────────────────────────────── */
  const subjectRows = r.subjectResults.map((sub, i) => {
    const isOut    = sub.absent || sub.notEntered;
    const code     = sub.grade || '';
    const scoreTxt = sub.score !== null && sub.score !== undefined ? sub.score + '%' : (sub.absent ? 'ABS' : '—');
    const remark   = sub.absent ? 'Absent — not assessed'
                   : sub.notEntered ? 'Marks not entered'
                   : (sub.remark || KJSEA.getSubjectRemark(sub.score));
    const level    = isOut
      ? `<div style="font-size:10px;font-weight:600;">${sub.absent ? 'Absent' : 'Not entered'}</div>`
      : levelBlock(code);

    return `
    <tr>
      <td style="${td(`text-align:center;font-size:10px;font-weight:700;color:${INK};`)}">${i + 1}</td>
      <td style="${td(`text-align:left;font-weight:700;font-size:11.5px;color:${INK};`)}">${escHtml(sub.name)}</td>
      <td style="${td(`text-align:center;font-weight:800;font-size:12px;color:${INK};`)}">${scoreTxt}</td>
      <td style="${td(`text-align:left;color:${INK};`)}">${level}</td>
      <td style="${td(`text-align:center;font-weight:800;font-size:12px;color:${INK};`)}">${isOut ? '—' : sub.points}</td>
      <td style="${td(`text-align:left;font-size:10px;color:${INK};line-height:1.25;`)}">${escHtml(remark)}</td>
      <td style="${td(`text-align:left;font-size:10px;font-weight:700;color:${INK};line-height:1.25;border-right:none;`)}">${escHtml(teacherFor(sub))}</td>
    </tr>`;
  }).join('');

  /* ── Learner details grid ───────────────────────────────── */
  const cell = (label, value, { span = 1, last = false, bottom = true } = {}) => `
    <div style="grid-column:span ${span};padding:6px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}${bottom ? `border-bottom:2px solid ${LINE};` : ''}">
      <div style="font-size:9px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${label}</div>
      <div style="font-size:12.5px;font-weight:800;color:${INK};line-height:1.2;min-height:15px;">${value || '&nbsp;'}</div>
    </div>`;

  const learnerGrid = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:3px solid ${LINE};">
      ${cell('Learner name',   escHtml(r.fullName),                   { span: 2 })}
      ${cell('Class',          escHtml(prettyClass(r.streamName || s.cls))) }
      ${cell('Gender',         escHtml(gender),                       { last: true })}
      ${cell('Assessment no.', escHtml(r.assessmentNo || ''),         { bottom: false })}
      ${cell('Admission no.',  escHtml(r.upiNumber || ''),            { bottom: false })}
      ${cell('Academic year',  escHtml(s.year),                       { bottom: false, span: 2, last: true })}
    </div>`;

  /* ── Summary strip: average + overall performance level only ── */
  const stat = (label, value, last = false) => `
    <div style="padding:7px 12px;text-align:center;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:9px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${label}</div>
      <div style="font-size:15px;font-weight:800;color:${INK};line-height:1.15;">${value}</div>
    </div>`;

  const statsStrip = `
    <div style="display:grid;grid-template-columns:1fr 2fr;border-bottom:3px solid ${LINE};">
      ${stat('Average', `${r.avgScore}%`)}
      ${stat('Overall performance level', `${escHtml(KJSEA.levelFull(r.meanGrade))} &nbsp;${escHtml(r.meanGrade || '')}`, true)}
    </div>`;

  /* ── Pathway summary (calculations unchanged; no bars, no colour) ── */
  const pathwayKeys = ['stem', 'social', 'creative'];

  const pathwayCells = pathwayKeys.map((key, i) => {
    const pw       = r.pathways[key];
    const name     = KJSEA.PATHWAYS[key].name;
    const last     = i === pathwayKeys.length - 1;
    const hasScore = pw.avg !== null;
    const code     = (pw.css || '').toUpperCase();
    const partial  = hasScore && pw.count < pw.expected
      ? `<div style="font-size:9px;color:${MUTE};margin-top:4px;">${pw.count} of ${pw.expected} subjects counted</div>` : '';
    return `
      <div style="flex:1;padding:9px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
        <div style="font-size:10.5px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:${INK};margin-bottom:3px;">${name}</div>
        <div style="font-size:9px;color:${MUTE};line-height:1.35;min-height:24px;">${escHtml(pw.subjects)}</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin:6px 0;">
          <span style="font-size:22px;font-weight:800;color:${INK};line-height:1.1;">${hasScore ? pw.avg + '%' : '—'}</span>
          <span style="font-size:11px;font-weight:700;color:${INK};">${hasScore ? pw.points + '/' + pw.maxPts + ' pts' : ''}</span>
        </div>
        <div style="font-size:10px;font-weight:600;color:${INK};line-height:1.25;">${hasScore ? `${escHtml(KJSEA.levelFull(code))} <strong>${escHtml(code)}</strong>` : 'No data'}</div>
        ${partial}
      </div>`;
  }).join('');

  /* ── Comments + sign-off ────────────────────────────────── */
  const signBlock = (title, comment, person, personLabel, last = false) => `
    <div style="padding:8px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:9px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${title}</div>
      <div style="font-size:10.5px;color:${INK};line-height:1.45;font-style:italic;min-height:44px;">${escHtml(comment)}</div>
      <div style="margin-top:14px;border-bottom:2px solid ${LINE};"></div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:9px;color:${INK};">
        <span><strong style="font-size:10px;">${person ? escHtml(person) : '&nbsp;'}</strong><br/>${personLabel}</span>
        <span style="align-self:flex-end;">Date: ....................</span>
      </div>
    </div>`;

  const dateCell = (label, value, last = false) => `
    <div style="padding:6px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:9px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${label}</div>
      <div style="font-size:12px;font-weight:800;color:${INK};min-height:15px;">${value ? escHtml(value) : '..............................'}</div>
    </div>`;

  /* ── Grading key: code, full name, range, points ────────── */
  const keyCells = KJSEA.SCALE.map((g, i) => `
    <div style="padding:5px 4px;text-align:center;background:#ffffff;${i < KJSEA.SCALE.length - 1 ? `border-right:2px solid ${LINE};` : ''}">
      <div style="font-size:11px;font-weight:800;color:${INK};">${g.grade}</div>
      <div style="font-size:8.5px;font-weight:600;color:${INK};line-height:1.2;">${g.full}</div>
      <div style="font-size:9px;font-weight:700;color:${INK};margin-top:3px;">${g.min}–${g.max}%</div>
      <div style="font-size:8.5px;color:${INK};">${g.points} pts</div>
    </div>`).join('');

  /* ── Page ───────────────────────────────────────────────── */
  return `
<div style="width:100%;max-width:754px;box-sizing:border-box;background:#ffffff;color-scheme:light;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:3px solid ${LINE};border-radius:6px;overflow:hidden;font-family:'DM Sans','Segoe UI',Arial,sans-serif;font-size:11px;color:${INK};margin:0 auto;font-variant-numeric:tabular-nums;">

  <!-- Letterhead -->
  <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:#ffffff;border-bottom:3px solid ${LINE};">
    <div style="width:50px;height:50px;background:#ffffff;color:${INK};border:2px solid ${LINE};border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;letter-spacing:1px;flex-shrink:0;">${escHtml(initials)}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:17px;font-weight:800;color:${INK};letter-spacing:0.4px;line-height:1.15;">${escHtml(String(s.schoolName).toUpperCase())}</div>
      <div style="font-size:10px;color:${INK};margin-top:3px;">Junior Secondary School &nbsp;&bull;&nbsp; <em>${escHtml(s.schoolMotto)}</em></div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:12.5px;font-weight:800;letter-spacing:1.2px;color:${INK};">LEARNER PROGRESS REPORT</div>
      <div style="font-size:10.5px;font-weight:600;color:${INK};margin-top:3px;">Term ${escHtml(s.term)} &nbsp;&bull;&nbsp; ${escHtml(s.exam)} Examination &nbsp;&bull;&nbsp; ${escHtml(s.year)}</div>
    </div>
  </div>

  ${learnerGrid}
  ${statsStrip}

  ${sectionBar('Subject performance')}
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <thead>
      <tr>
        ${th('No.', 4)}${th('Learning area', 19, 'left')}${th('Score', 8)}${th('Performance level', 21, 'left')}${th('Points<br/>(out of 8)', 9)}${th('Teacher&rsquo;s remark', 22, 'left')}${th('Teacher', 17, 'left', true)}
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
      <tr>
        <td style="${td(`border-top:4px double ${LINE};`)}"></td>
        <td style="${td(`border-top:4px double ${LINE};font-weight:800;font-size:11px;letter-spacing:0.8px;color:${INK};`)}">TOTAL</td>
        <td style="${td(`border-top:4px double ${LINE};text-align:center;font-weight:800;font-size:11.5px;color:${INK};`)}">${r.totalScore}/${maxTotal}</td>
        <td style="${td(`border-top:4px double ${LINE};color:${INK};`)}">${levelBlock(r.meanGrade)}</td>
        <td style="${td(`border-top:4px double ${LINE};text-align:center;font-weight:800;font-size:11.5px;color:${INK};`)}">${r.totalPoints}/${maxPoints}</td>
        <td colspan="2" style="${td(`border-top:4px double ${LINE};border-right:none;font-size:10px;font-weight:700;color:${INK};`)}">${escHtml(KJSEA.getTeacherComment(r.meanGrade).split('.')[0])}.</td>
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

  ${sectionBar('Grading key', 'Performance level, score range and points')}
  <div style="display:grid;grid-template-columns:repeat(8,1fr);border-bottom:2px solid ${LINE};">${keyCells}</div>
  <div style="padding:4px 12px;background:#ffffff;border-bottom:3px solid ${LINE};font-size:8.5px;color:${INK};">Marks are rounded to the nearest whole number before the performance level is worked out.</div>

  <!-- Footer -->
  <div style="background:#ffffff;display:flex;justify-content:space-between;align-items:center;padding:6px 14px;font-size:9px;font-weight:600;color:${INK};">
    <span>Powered by Scholar Analytics</span>
    <span>Parent / Guardian copy</span>
  </div>

</div>`;
};

/* ══════════════════════════════════════════════════════════
   12. BUILD CLASS RESULT SHEET  (Kaaboi table + Chebarus analysis, low ink)
══════════════════════════════════════════════════════════ */
const buildClassSheet = (results, s) => {
  const { INK, LINE, MUTE } = PRINT;
  const n = results.length;

  const avg      = (results.reduce((a, r) => a + r.avgScore, 0) / n).toFixed(1);
  const passed   = results.filter(r => r.avgScore >= 41).length;
  const passRate = ((passed / n) * 100).toFixed(1);
  const meanPts  = (results.reduce((a, r) => a + r.avgPoints, 0) / n).toFixed(2);
  const classCode = KJSEA.getGrade(Math.round(Number(avg)))?.grade || '';

  /* Overall grade distribution */
  const dist = {};
  KJSEA.SCALE.forEach(g => dist[g.grade] = 0);
  let xCount = 0;
  results.forEach(r => {
    if (r.subjectCount === 0) { xCount++; return; }
    if (r.meanGrade && dist[r.meanGrade] !== undefined) dist[r.meanGrade]++;
  });

  /* Teachers for a subject (one class -> one name; whole grade -> names joined) */
  const maps = s.teacherMaps || {};
  const teachersOf = (name) =>
    [...new Set(Object.values(maps).map(m => m[normName(name)]).filter(Boolean))].join(' / ');

  /* Subject averages, grade counts, top 3 */
  const sameSubj = (x, subj) => String(x.subjectId) === String(subj._id);

  const subjectStats = state.subjects.map(subj => {
    const scores = [];
    results.forEach(r => {
      const sr = r.subjectResults?.find(x => sameSubj(x, subj));
      if (sr && !sr.absent && !sr.notEntered && sr.score !== null && sr.score !== undefined)
        scores.push({ fullName: r.fullName, score: sr.score, grade: sr.grade, points: sr.points || 0 });
    });

    const cnt    = scores.length;
    const avgM   = cnt ? parseFloat((scores.reduce((a, x) => a + x.score, 0) / cnt).toFixed(1)) : 0;
    const avgPts = cnt ? parseFloat((scores.reduce((a, x) => a + x.points, 0) / cnt).toFixed(2)) : 0;

    const subDist = {};
    KJSEA.SCALE.forEach(g => subDist[g.grade] = 0);
    scores.forEach(x => { if (x.grade && subDist[x.grade] !== undefined) subDist[x.grade]++; });

    const top3 = [...scores].sort((a, b) => b.score - a.score).slice(0, 3);
    return { ...subj, avg: avgM, avgPts, subDist, top3, count: cnt };
  });

  const ranked = [...subjectStats].sort((a, b) => b.avg - a.avg).map((x, i) => ({ ...x, rank: i + 1 }));
  const statOf = (subj) => subjectStats.find(x => String(x._id) === String(subj._id));

  /* Gender analytics */
  const males     = results.filter(r => r.gender === 'male'   && r.subjectCount > 0);
  const females   = results.filter(r => r.gender === 'female' && r.subjectCount > 0);
  const maleAvg   = males.length   ? parseFloat((males.reduce((a, r) => a + r.avgScore, 0) / males.length).toFixed(1))   : 0;
  const femaleAvg = females.length ? parseFloat((females.reduce((a, r) => a + r.avgScore, 0) / females.length).toFixed(1)) : 0;
  const betterGender = femaleAvg >= maleAvg ? 'Female' : 'Male';
  const genderGap    = Math.abs(maleAvg - femaleAvg).toFixed(2);

  /* Most improved (VAP) */
  const mostImproved = results.filter(r => r.vap !== null && r.vap !== undefined && r.vap > 0)
    .sort((a, b) => b.vap - a.vap).slice(0, 5);

  /* ── Style helpers: white, black text, 1px gridlines ── */
  const bar = (t) => `<div style="padding:5px 14px;background:#ffffff;color:${INK};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-top:3px solid ${LINE};border-bottom:2px solid ${LINE};">${t}</div>`;
  const th  = (label, align = 'center', title = '') => `<th ${title ? `title="${escHtml(title)}"` : ''} style="padding:6px 5px;text-align:${align};font-size:9px;font-weight:800;line-height:1.15;color:${INK};background:#ffffff;border-right:1px solid ${LINE};border-bottom:2px solid ${LINE};">${label}</th>`;
  const tdS = (extra = '') => `padding:5px 5px;border-right:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:10.5px;color:${INK};background:#ffffff;${extra}`;

  /* ── Merit table (Kaaboi style: mark + level in one cell) ── */
  const subjHeaders = state.subjects.map(subj => th(escHtml(subj.code), 'center', subj.name)).join('');

  const tableRows = results.map(r => {
    const subjCells = state.subjects.map(subj => {
      const sr = r.subjectResults?.find(x => sameSubj(x, subj));
      let txt = '—';
      if (sr && !sr.notEntered) txt = sr.absent ? 'ABS' : `${sr.score ?? '—'}${sr.grade ? ' ' + sr.grade : ''}`;
      return `<td style="${tdS('text-align:center;white-space:nowrap;font-weight:600;')}">${escHtml(txt)}</td>`;
    }).join('');

    const vapText = r.vap !== null && r.vap !== undefined ? (r.vap > 0 ? `+${r.vap}` : `${r.vap}`) : '—';

    return `
      <tr>
        <td style="${tdS('text-align:center;font-weight:800;')}">${r.position}</td>
        <td style="${tdS('text-align:left;font-weight:700;')}">${escHtml(r.fullName)}</td>
        <td style="${tdS('text-align:center;')}">${escHtml(r.gender?.charAt(0).toUpperCase() || '—')}</td>
        ${subjCells}
        <td style="${tdS('text-align:center;font-weight:800;')}">${r.totalScore}</td>
        <td style="${tdS('text-align:center;font-weight:700;')}">${r.avgScore}%</td>
        <td style="${tdS('text-align:center;font-weight:800;')}">${r.totalPoints}</td>
        <td style="${tdS('text-align:left;')}">${levelBlock(r.meanGrade) || '—'}</td>
        <td style="${tdS('text-align:center;font-weight:700;border-right:none;')}">${vapText}</td>
      </tr>`;
  }).join('');

  /* Bottom rows: subject average marks, and average points with level (as in Kaaboi) */
  const avgMarksRow = `
    <tr>
      <td colspan="3" style="${tdS(`font-weight:800;border-top:3px double ${LINE};`)}">AVG. MARKS</td>
      ${state.subjects.map(subj => `<td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${statOf(subj)?.avg ?? 0}%</td>`).join('')}
      <td style="${tdS(`border-top:3px double ${LINE};`)}"></td>
      <td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${avg}%</td>
      <td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${meanPts}</td>
      <td style="${tdS(`border-top:3px double ${LINE};`)}">${levelBlock(classCode)}</td>
      <td style="${tdS(`border-top:3px double ${LINE};border-right:none;`)}"></td>
    </tr>`;

  const avgPointsRow = `
    <tr>
      <td colspan="3" style="${tdS('font-weight:800;')}">AVG. POINTS</td>
      ${state.subjects.map(subj => {
        const st = statOf(subj);
        const code = st && st.count ? (KJSEA.getGrade(Math.round(st.avg))?.grade || '') : '';
        return `<td style="${tdS('text-align:center;font-weight:700;white-space:nowrap;')}">${st?.avgPts ?? 0} ${escHtml(code)}</td>`;
      }).join('')}
      <td colspan="5" style="${tdS('border-right:none;')}"></td>
    </tr>`;

  /* ── Grade distribution ── */
  const distCells = KJSEA.SCALE.map((g, i) => `
    <div style="text-align:center;padding:7px 4px;background:#ffffff;border-right:1px solid ${LINE};">
      <div style="font-size:10px;font-weight:800;">${g.grade}</div>
      <div style="font-size:14px;font-weight:800;">${dist[g.grade]}</div>
    </div>`).join('') + (xCount > 0 ? `
    <div style="text-align:center;padding:7px 4px;background:#ffffff;">
      <div style="font-size:10px;font-weight:800;">X</div>
      <div style="font-size:14px;font-weight:800;">${xCount}</div>
    </div>` : '');

  /* ── Subject-wise summary, with teacher ── */
  const summaryRows = ranked.map(x => `
    <tr>
      <td style="${tdS('text-align:center;font-weight:800;')}">${x.rank}</td>
      <td style="${tdS('font-weight:700;')}">${escHtml(x.name)}</td>
      <td style="${tdS('text-align:center;font-weight:800;')}">${x.avg}%</td>
      <td style="${tdS('text-align:center;font-weight:700;')}">${x.avgPts}</td>
      ${KJSEA.SCALE.map(g => `<td style="${tdS(`text-align:center;font-weight:${x.subDist[g.grade] ? 800 : 400};`)}">${x.subDist[g.grade]}</td>`).join('')}
      <td style="${tdS('font-size:10px;border-right:none;')}">${escHtml(teachersOf(x.name))}</td>
    </tr>`).join('');

  /* ── Top 3 per subject ── */
  const top3Cards = ranked.map(x => `
    <div style="flex:1 1 200px;border:1.5px solid ${LINE};background:#ffffff;">
      <div style="padding:5px 10px;border-bottom:1.5px solid ${LINE};">
        <div style="font-size:11px;font-weight:800;">${escHtml(x.name)}</div>
        <div style="font-size:9.5px;">Avg: ${x.avg}%</div>
      </div>
      <div style="padding:5px 10px;">
        ${x.top3.map((st, i) => `
          <div style="display:flex;gap:6px;padding:3px 0;font-size:10.5px;${i < x.top3.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}">
            <span style="font-weight:800;">${i + 1}.</span>
            <span style="flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(st.fullName)}</span>
            <span style="font-weight:800;white-space:nowrap;">${st.score} ${escHtml(st.grade || '')}</span>
          </div>`).join('')}
        ${!x.top3.length ? '<div style="font-size:10px;">No data</div>' : ''}
      </div>
    </div>`).join('');

  /* ── Gender, per subject ── */
  const genderRows = state.subjects.map(subj => {
    const pick = (list) => list.map(r => r.subjectResults?.find(x => sameSubj(x, subj)))
      .filter(x => x && !x.absent && !x.notEntered && x.score !== null && x.score !== undefined).map(x => x.score);
    const mS = pick(males), fS = pick(females);
    const mA = mS.length ? parseFloat((mS.reduce((a, b) => a + b, 0) / mS.length).toFixed(1)) : 0;
    const fA = fS.length ? parseFloat((fS.reduce((a, b) => a + b, 0) / fS.length).toFixed(1)) : 0;
    const leader = mA > fA ? 'Male' : mA < fA ? 'Female' : 'Tie';
    return `
      <tr>
        <td style="${tdS('font-weight:700;')}">${escHtml(subj.name)}</td>
        <td style="${tdS('text-align:center;')}">${mA}%</td>
        <td style="${tdS('text-align:center;')}">${fA}%</td>
        <td style="${tdS('text-align:center;')}">${Math.abs(mA - fA).toFixed(1)}</td>
        <td style="${tdS('text-align:center;font-weight:800;border-right:none;')}">${leader}</td>
      </tr>`;
  }).join('');

  /* ── Most improved ── */
  const improvedRows = mostImproved.map((r, i) => `
    <tr>
      <td style="${tdS('text-align:center;font-weight:800;')}">${i + 1}</td>
      <td style="${tdS('font-weight:700;')}">${escHtml(r.fullName)}</td>
      <td style="${tdS('text-align:center;')}">${r.prevPoints || '—'}</td>
      <td style="${tdS('text-align:center;')}">${r.avgPoints}</td>
      <td style="${tdS('text-align:center;font-weight:800;border-right:none;')}">+${r.vap}</td>
    </tr>`).join('');

  const statBox = (val, lbl, last = false) => `
    <div style="padding:9px 10px;text-align:center;background:#ffffff;${last ? '' : `border-right:1px solid ${LINE};`}">
      <div style="font-size:16px;font-weight:800;">${val}</div>
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">${lbl}</div>
    </div>`;

  const sigBlock = (title, person, label, last = false) => `
    <div style="padding:12px 18px;background:#ffffff;${last ? '' : `border-right:1px solid ${LINE};`}">
      <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">${title}${person ? ': ' + escHtml(person) : ''}</div>
      <div style="border-bottom:1.5px solid ${LINE};margin:22px 0 5px;"></div>
      <div style="font-size:9px;">${label}</div>
    </div>`;

  const generated = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  /* ════════════ FULL HTML ════════════ */
  return `
<div style="max-width:960px;background:#ffffff;border:2px solid ${LINE};font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${INK};margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;padding:14px 18px;border-bottom:3px solid ${LINE};">
    <div>
      <div style="font-size:16px;font-weight:800;letter-spacing:0.4px;">${escHtml(String(s.schoolName).toUpperCase())}</div>
      <div style="font-size:10px;margin-top:2px;">Junior Secondary School &nbsp;|&nbsp; <em>${escHtml(s.schoolMotto)}</em></div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12.5px;font-weight:800;letter-spacing:1px;">ASSESSMENT RESULTS</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:3px;">CLASS: ${escHtml(prettyClass(s.cls))} &nbsp;|&nbsp; TERM: ${escHtml(s.term)} &nbsp;|&nbsp; YEAR: ${escHtml(s.year)} &nbsp;|&nbsp; EXAM: ${escHtml(s.exam)}</div>
    </div>
  </div>

  <!-- Class summary -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);border-bottom:2px solid ${LINE};">
    ${statBox(n, 'Total learners')}${statBox(avg + '%', 'Average marks')}${statBox(passed, 'Passed (≥41%)')}${statBox(passRate + '%', 'Pass rate')}${statBox(meanPts, 'Mean points', true)}
  </div>

  ${bar('Class rankings')}
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          ${th('Pos')}${th('Learner name', 'left')}${th('G')}${subjHeaders}${th('Total')}${th('Avg %')}${th('Points')}${th('Performance level', 'left')}${th('VAP')}
        </tr>
      </thead>
      <tbody>${tableRows}${avgMarksRow}${avgPointsRow}</tbody>
    </table>
  </div>
  <div style="padding:5px 14px;font-size:9px;border-top:1px solid ${LINE};">
    Learner position is assigned using total marks. Performance level is calculated using average marks. Marks are rounded to the nearest whole number before the level is worked out.
  </div>

  ${bar('Overall grade distribution')}
  <div style="display:grid;grid-template-columns:repeat(${xCount > 0 ? 9 : 8},1fr);">${distCells}</div>

  ${bar('Subject-wise performance summary')}
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          ${th('Rank')}${th('Learning area', 'left')}${th('Avg mark')}${th('Avg pts')}${KJSEA.SCALE.map(g => th(g.grade)).join('')}${th('Subject teacher', 'left')}
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>

  ${bar('Top 3 learners per subject')}
  <div style="padding:12px;display:flex;flex-wrap:wrap;gap:10px;background:#ffffff;">${top3Cards}</div>

  ${bar('Gender performance analytics')}
  <div style="display:grid;grid-template-columns:1fr 2fr;">
    <div style="padding:12px;border-right:1px solid ${LINE};font-size:11px;">
      <div style="display:flex;gap:10px;margin-bottom:10px;">
        <div style="flex:1;border:1.5px solid ${LINE};padding:8px;text-align:center;"><div style="font-size:15px;font-weight:800;">${males.length}</div><div style="font-size:9.5px;">Male | Avg ${maleAvg}%</div></div>
        <div style="flex:1;border:1.5px solid ${LINE};padding:8px;text-align:center;"><div style="font-size:15px;font-weight:800;">${females.length}</div><div style="font-size:9.5px;">Female | Avg ${femaleAvg}%</div></div>
      </div>
      <strong>Better performing gender: ${betterGender}</strong><br/>Performance gap: ${genderGap} marks
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${th('Subject', 'left')}${th('Male')}${th('Female')}${th('Gap')}${th('Leader')}</tr></thead>
        <tbody>${genderRows}</tbody>
      </table>
    </div>
  </div>

  ${mostImproved.length ? `
  ${bar('Most improved learners (VAP)')}
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>${th('Rank')}${th('Learner name', 'left')}${th('Prev points')}${th('Current points')}${th('VAP (+/-)')}</tr></thead>
    <tbody>${improvedRows}</tbody>
  </table>` : ''}

  <!-- Signatures -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:3px solid ${LINE};margin-top:0;">
    ${sigBlock('Class teacher', s.teacher, 'Signature &amp; date: .....................')}
    ${sigBlock('Dean of studies', '', 'Signature &amp; date: .....................')}
    ${sigBlock('Principal / Headteacher', s.principal, 'Signature, stamp &amp; date: .....................', true)}
  </div>

  <!-- Footer -->
  <div style="display:flex;justify-content:space-between;padding:6px 16px;border-top:2px solid ${LINE};font-size:9px;font-weight:600;">
    <span>Report generated on: ${escHtml(generated)}</span>
    <span>Powered by Scholar Analytics</span>
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
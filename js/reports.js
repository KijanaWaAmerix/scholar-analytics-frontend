/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Reports & PDFs
   File: js/reports.js
   Version: 6.5
   6.5: • Grades 7–9 report cards can show Mid Term + End Term side by side (average drives remarks, pathway, overall level, comments); larger wording pools for remarks and comments.
   6.4: • Grades 1–6 use js/reports-primary.js (load it after this file): report type
          End Term / Mid Term / Mid + End Term, KNEC four-level performance levels.
        • Grades 7–9: KNEC learning-area codes (901…911) on the card; the class sheet writes
          the code in brackets after each learning area. Bolder, clearer text.
        • "Examination" -> "Assessment"; "Principal / HOI" -> "Head of Institution".
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
    creative: { name:'Creative Arts & Sports', col:'#6b21a8', bg:'#f3e8ff', border:'#a855f7', pillBg:'#e9d5ff', pillCol:'#581c87' },
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

  const wholeGrade = classes.length > 1;
  const savedCT    = readSavedSettings();

  const section = (c) => `
    <div style="margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:#0d3349;margin-bottom:6px;">${escHtml(c.name)}</div>
      ${wholeGrade ? `
      <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:700;color:#0d3349;margin-bottom:8px;max-width:340px;">
        Class teacher — ${escHtml(c.name)}
        <input type="text" data-classteacher="${c._id}"
          value="${escHtml(savedCT[`classTeacher:${c._id}`] || '')}"
          placeholder="Class teacher's name"
          style="padding:7px 9px;font-size:12px;border:1px solid #94a3b8;border-radius:6px;font-weight:400;" />
      </label>` : ''}
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
        ${wholeGrade ? 'Type the class teacher and each subject teacher for every class. Each learner\'s report card shows the class teacher of their own class. ' : 'Type each teacher\'s name (e.g. Kemboi Dan). '}Saved separately for each class and printed on the report cards.
      </div>
      ${classes.map(section).join('')}
      ${copyBtn}
    </div>`;

  /* One class teacher per class (East and West can have different ones) */
  wrap.querySelectorAll('input[data-classteacher]').forEach(inp => {
    inp.addEventListener('input', () => {
      const st = readSavedSettings();
      st[`classTeacher:${inp.dataset.classteacher}`] = inp.value.trim();
      writeSavedSettings(st);
      pushTeachersToServer(inp.dataset.classteacher);
    });
  });

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
   /* ══════════════════════════════════════════════════════════
   3c. SAVED SETTINGS — remembered on this device AND on the server
   Paste this block straight AFTER section 3b (SUBJECT TEACHERS),
   after renderTeacherInputs and before "4. CLASS / GRADE SELECTION".
   (If you pasted the earlier, device-only version of this block,
    delete it and use this one instead.)

   What happens
   • When the page opens it fills in what is saved: school name, motto,
     principal, each class's teacher and each class's subject teachers.
   • As you type, the change is kept on this device straight away and
     sent to the server about 1.5 seconds after you stop typing.
   • School name, motto and principal are sent to the server only when
     an ADMIN types them. Teacher names are saved for everyone.
   • If the server cannot be reached, nothing is lost: the names stay on
     this device and are sent next time.
   • Term closing date and next term opens are NOT saved (they change
     every term).
   Needs: api.js (Auth, API, showToast) and section 3b helpers.
══════════════════════════════════════════════════════════ */
const SETTINGS_KEY = 'sa_report_school_settings_v1';

const readSavedSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
};
const writeSavedSettings = (obj) => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj)); } catch { /* storage blocked */ }
};

/* Run fn once, 1.5 s after the last call for the same key (keeps requests low) */
const debounceByKey = (fn, ms = 1500) => {
  const timers = {};
  return (key) => {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => fn(key), ms);
  };
};

let warnedSaveFailed = false;
const warnSaveFailed = (what) => {
  if (warnedSaveFailed) return;
  warnedSaveFailed = true;
  showToast(`Could not save ${what} to the server. It is kept on this device.`, 'warning');
};

const canEditSchool = () => {
  try { return Auth.isAdmin(); } catch { return false; }
};

/* ── School name, motto, principal ─────────────────────────── */
const schoolFields = [
  { key: 'schoolName',  input: el.rptSchoolName,  sendAs: 'schoolName'    },
  { key: 'schoolMotto', input: el.rptSchoolMotto, sendAs: 'schoolMotto'   },
  { key: 'principal',   input: el.rptPrincipal,   sendAs: 'principalName' },
];

const pushSchoolToServer = debounceByKey(async () => {
  if (!canEditSchool()) return;
  const body = {};
  schoolFields.forEach(f => {
    const v = f.input?.value.trim();
    if (v) body[f.sendAs] = v;
  });
  if (!Object.keys(body).length) return;
  const r = await API.put('/settings/school', body);
  if (!r?.ok) warnSaveFailed('the school details');
});

/* School name, motto and principal are kept in ONE place: Settings -> School Profile.
   The Reports page only reads them, so they are never typed twice. The old boxes stay in the
   page (hidden) so the rest of this file keeps working. */
const fieldWrap = (input) => input?.closest('.rpt-field') || input?.parentElement;

const renderSchoolInfo = () => {
  const name = el.rptSchoolName?.value.trim();
  const mot  = el.rptSchoolMotto?.value.trim();
  const pri  = el.rptPrincipal?.value.trim();
  let box = document.getElementById('rptSchoolInfo');
  if (!box) {
    const anchor = fieldWrap(el.rptSchoolName);
    if (!anchor) return;
    box = document.createElement('div');
    box.id = 'rptSchoolInfo';
    box.style.cssText = 'border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.6;color:#334155;margin-bottom:6px;';
    anchor.insertAdjacentElement('beforebegin', box);
  }
  const row = (label, v) => `<div><strong>${label}:</strong> ${v ? escHtml(v) : '<span style="color:#b45309;">not set</span>'}</div>`;
  box.innerHTML = row('School', name) + row('Motto', mot) + row('Principal / HOI', pri) +
    `<div style="margin-top:4px;font-size:11px;color:#64748b;">Taken from Settings &rarr; School Profile. <a href="settings.html" style="color:#0d3349;font-weight:700;">Change it there</a>.</div>`;
};

schoolFields.forEach(({ key, input }) => {
  if (!input) return;
  const saved = readSavedSettings()[key];
  input.value = saved || '';                              // device copy, instantly (never the demo text)
  const w = fieldWrap(input);
  if (w) w.style.display = 'none';
});
renderSchoolInfo();

/* Postal address, phone and (optional) email come from Settings -> School Profile.
   Kept in this browser too, so the header is right even before the server answers. */
const schoolContact = {
  address: readSavedSettings().schoolAddress || '',
  phone  : readSavedSettings().schoolPhone   || '',
  email  : readSavedSettings().schoolEmail   || '',
};

const loadSchoolFromServer = async () => {
  const r = await API.get('/settings');
  if (!r?.ok || !r.data?.school) return;
  const sch = r.data.school;
  const fromServer = {
    schoolName : sch.schoolName,
    schoolMotto: sch.schoolMotto,
    principal  : sch.principal?.name,
  };
  const st = readSavedSettings();
  schoolContact.address = (sch.schoolAddress || '').trim();
  schoolContact.phone   = (sch.schoolPhone   || '').trim();
  schoolContact.email   = (sch.schoolEmail   || '').trim();
  st.schoolAddress = schoolContact.address;
  st.schoolPhone   = schoolContact.phone;
  st.schoolEmail   = schoolContact.email;
  schoolFields.forEach(({ key, input }) => {
    const v = fromServer[key];
    if (!v) return;
    st[key] = v;
    if (input) input.value = v;
  });
  writeSavedSettings(st);
  renderSchoolInfo();
};

/* ── Class teacher (one name per class) ────────────────────── */
const classTeacherKey = () => el.rptClass?.value ? `classTeacher:${el.rptClass.value}` : null;

/* What to send to the server for one class */
const teachersPayload = (classId) => ({
  classTeacherName: readSavedSettings()[`classTeacher:${classId}`] || '',
  subjectTeachers : Object.fromEntries(
    Object.entries(getTeacherStore()[`class:${classId}`] || {}).filter(([, v]) => v)
  ),
});

const pushTeachersToServer = debounceByKey(async (classId) => {
  const r = await API.put(`/settings/class-teachers/${classId}`, teachersPayload(classId));
  if (!r?.ok) warnSaveFailed('the teacher names');
});

el.rptClass?.addEventListener('change', () => {
  if (!el.rptTeacher) return;
  /* Whole grade: each class gets its own class-teacher box in the Teachers panel, so hide this one */
  const tw = fieldWrap(el.rptTeacher);
  if (tw) tw.style.display = isGradeValue(el.rptClass.value) ? 'none' : '';
  delete el.rptTeacher.dataset.touched;
  const k = classTeacherKey();
  el.rptTeacher.value = k ? (readSavedSettings()[k] || '') : '';   // never carry one class's teacher to another
});

el.rptTeacher?.addEventListener('input', () => {
  el.rptTeacher.dataset.touched = '1';
  const k = classTeacherKey();
  if (!k) return;
  const st = readSavedSettings();
  st[k] = el.rptTeacher.value.trim();
  writeSavedSettings(st);
  if (!isGradeValue(el.rptClass.value)) pushTeachersToServer(el.rptClass.value);
});

/* Subject-teacher boxes (built in section 3b) save to the device themselves;
   here we only send the same change to the server. */
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t?.matches?.('input[data-subj][data-class]')) pushTeachersToServer(t.dataset.class);
});

/* "Copy names to other classes" button: send every class that now has names */
document.addEventListener('click', (e) => {
  if (!e.target?.closest?.('#copyTeachersBtn')) return;
  const store = getTeacherStore();
  (state.classes || []).forEach(c => {
    if (Object.keys(store[`class:${c._id}`] || {}).length) pushTeachersToServer(c._id);
  });
});

/* Load what the server has, merge with this device, upload anything the server lacks */
const loadTeachersFromServer = async () => {
  const r = await API.get('/settings/class-teachers');
  if (!r?.ok || !Array.isArray(r.data?.classes)) return;

  const store  = getTeacherStore();
  const st     = readSavedSettings();
  const toPush = [];

  r.data.classes.forEach(c => {
    const key    = `class:${c._id}`;
    const server = c.subjectTeachers || {};
    const merged = { ...(store[key] || {}), ...server };    // server wins, device fills the gaps
    store[key]   = merged;

    const ctKey = `classTeacher:${c._id}`;
    const ct    = c.classTeacherName || st[ctKey] || '';
    if (ct) st[ctKey] = ct;

    const lacksOnServer = Object.keys(merged).some(k => !server[k]) || (!!st[ctKey] && !c.classTeacherName);
    if (lacksOnServer) toPush.push(c._id);                  // first-time upload of names saved on this device
  });

  saveTeacherStore(store);
  writeSavedSettings(st);
  toPush.forEach(id => pushTeachersToServer(id));

  /* Refresh what is on screen, unless someone is typing in it */
  const wrap = document.getElementById('teacherNamesWrap');
  if (wrap && wrap.innerHTML && !wrap.contains(document.activeElement)) renderTeacherInputs();
  const k = classTeacherKey();
  if (el.rptTeacher && !el.rptTeacher.dataset.touched && k && st[k]) el.rptTeacher.value = st[k];
};

/* Start: fetch in the background so the page never waits for a sleeping server */
const schoolLoaded = loadSchoolFromServer();
loadTeachersFromServer();
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
const loadExamsCore = async () => {
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
    el.rptExam.innerHTML = '<option value="">-- Select Assessment --</option>' +
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

  el.rptExam.innerHTML = '<option value="">-- Select Assessment --</option>' + keys.map(k => {
    const x = map[k];
    const missing = targets.filter(c => !x.classes.includes(c));
    const note = missing.length ? ` — not in ${missing.map(streamLabel).join(', ')}` : '';
    return `<option value="${escHtml(k)}">${escHtml(x.name)}${manyYears ? ` (${escHtml(x.year)})` : ''}${escHtml(note)}</option>`;
  }).join('');
};

/* Loads the assessment list; for Grades 1–6 (js/reports-primary.js) it then fills the second
   dropdown and pre-selects the End Term / Mid Term assessment. */
const loadExams = async () => {
  await loadExamsCore();
  if (typeof primaryAfterExams === 'function') primaryAfterExams();
};

el.rptClass?.addEventListener('change', () => {
  const v = el.rptClass.value;
  state.scope      = isGradeValue(v) ? 'grade' : 'class';
  state.gradeValue = isGradeValue(v) ? v.slice(6) : '';
  if (el.rptExam) el.rptExam.innerHTML = '<option value="">-- Select Assessment --</option>';
  resetLearnerList();
  clearTeacherInputs();
  resetPreview();
  loadExams();
});

el.rptTerm?.addEventListener('change', () => {
  if (el.rptExam) el.rptExam.innerHTML = '<option value="">-- Select Assessment --</option>';
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
  if (typeof isPrimarySelection === 'function' && isPrimarySelection()) return fetchPrimaryResults();
  if (typeof juniorDual === 'function' && juniorDual()) return fetchJuniorDual();      // Grades 7–9, Mid + End on one card

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
  state.vapInfo   = data.vapInfo || null;      // which earlier exam each class was compared with

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
    const auto = (typeof isDualCapable === 'function') && isDualCapable() && cls;
    showToast(auto ? 'No matching assessment found for this class and term. Please choose one.' : 'Please select Class and Assessment.', 'warning');
    if (typeof syncExamPickers === 'function') syncExamPickers();
    flashMissing(cls, term, exam);
    return;
  }

  if ((isPrimarySelection() || juniorDual()) && reportType() === 'both' && !document.getElementById('rptExam2')?.value) {
    showToast('Please select the Mid Term assessment.', 'warning');
    flashMissing(cls, term, '');
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
  const expectedKey = expectedKeyNow();

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
    schoolName   : el.rptSchoolName?.value  || 'School Name',
    schoolMotto  : el.rptSchoolMotto?.value || '',
    address      : schoolContact.address,                   // from Settings -> School Profile
    phone        : schoolContact.phone,
    email        : schoolContact.email,                     // optional
    teacher      : (el.rptTeacher?.value   || '').trim(),   // class teacher (blank if not typed)
    principal    : (el.rptPrincipal?.value || '').trim(),   // principal (blank if not typed)
    teacherMaps  : getTeacherMaps(),                        // subject teachers, per class in scope
    classTeachers: Object.fromEntries(classesInScope().map(c =>   // class teacher of each class (East / West …)
      [c.name, (readSavedSettings()[`classTeacher:${c._id}`] || '').trim()])),
    closingDate  : el.rptClosingDate?.value || 'To Be Announced',
    nextTerm     : el.rptNextTerm?.value    || 'To Be Announced',
    cls: className, term, exam: primaryExamLabel() || examName,
    primary      : primarySettings(),                        // Grades 1–6: { type: 'end' | 'mid' | 'both' }
    dual         : dualSettings(),                           // Grades 7–9 card: { type: 'both' } = Mid + End side by side
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
/* ── Wording pools (Grades 7–9) ─────────────────────────────────────────────
   Many wordings per level, so cards in the same class do not read the same.
   The wording is picked from the learner + learning area, so it is the same every
   time a card is printed, and rows on one card differ from each other. */
const hashStr = (x) => { let h = 7; for (const c of String(x ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pickFrom = (pool, seed, step = 0) => pool[(hashStr(seed) + step * 7) % pool.length];

const REMARK_POOL = {
  EE1: ['Outstanding performance. Keep it up.', 'Exceptional work. A true achiever.', 'Excellent mastery of this learning area.', 'Brilliant results. Keep shining.', 'Superb work. Maintain this standard.',
        'Highly commendable performance.', 'Remarkable understanding. Well done.', 'Top performance. Keep the focus.', 'Excellent. Share your skills with others.', 'Impressive command of the content.',
        'Exemplary work. Keep it going.', 'Truly outstanding. Congratulations.'],
  EE2: ['Very good performance. Aim higher.', 'Strong work. Push for the top level.', 'Very good understanding. Keep going.', 'Commendable results. Keep it up.', 'A very good effort. Aim for excellence.',
        'Solid mastery. A little more for EE1.', 'Very good. Keep practising.', 'Well done. You can reach the top.', 'Great progress. Stay consistent.', 'Very good grasp of the content.',
        'Keep up this fine effort.', 'Very good work. Aim even higher.'],
  ME1: ['Good performance. Next level is near.', 'Good work. A little more effort.', 'Meeting expectation well. Keep going.', 'Good grasp. Practise to improve.', 'Steady progress. Keep it up.',
        'Good effort. Revise more often.', 'On track. Aim a level higher.', 'Good understanding. Work on details.', 'Well done. More practice will help.', 'A good result. Stay focused.',
        'Pleasing work. Keep improving.', 'Good. Read widely to do better.'],
  ME2: ['Meeting the standard. Keep practising.', 'Fair work. More revision is needed.', 'Satisfactory. Put in more effort.', 'Meeting basic expectation. Aim higher.', 'Fair grasp. Practise regularly.',
        'An average result. Work harder.', 'Can do better with more practice.', 'Fair effort. Revise key topics.', 'Satisfactory. Ask for help when stuck.', 'Reasonable work. Be more consistent.',
        'Keep working to move up a level.', 'Fair. Daily practice will help.'],
  AE1: ['Close to the standard. Practise more.', 'Nearly there. Revise regularly.', 'Needs more effort to meet the standard.', 'Improving. Keep practising.', 'Some gaps remain. Seek help.',
        'Work harder on the basics.', 'Can improve with steady revision.', 'Approaching the standard. Stay focused.', 'More practice is needed.', 'Revise past topics often.',
        'Needs extra effort and guidance.', 'A step away from the standard.'],
  AE2: ['Approaching the standard. Needs support.', 'More effort and guidance needed.', 'Many gaps. Revise the basics.', 'Needs regular extra practice.', 'Below the standard. Seek help.',
        'Improvement is needed. Work harder.', 'Please see the teacher for help.', 'Needs close support in this area.', 'Practise every day to improve.', 'Needs a firm push in this area.',
        'Work with the teacher on weak topics.', 'Must improve with extra support.'],
  BE1: ['Below the standard. Needs extra support.', 'Urgent help needed in this area.', 'Needs close guidance and daily practice.', 'Please seek extra lessons.', 'Weak performance. Work with the teacher.',
        'Basic skills need to be built.', 'Needs strong support at school and home.', 'Much improvement is needed.', 'Work hard on the basics.', 'Needs extra attention in this area.',
        'Support is urgently needed.', 'Meet the teacher for a plan.'],
  BE2: ['Well below the standard. Needs close support.', 'Needs urgent and intensive help.', 'Very weak. Extra lessons advised.', 'Please work closely with the teacher.', 'Basic skills are not yet in place.',
        'Needs daily guided practice.', 'Requires immediate support.', 'Needs a plan of support from school and home.', 'Serious improvement is needed.', 'Start again with the basics.',
        'Needs intensive support.', 'Please see the teacher soon.'],
};

KJSEA.getSubjectRemark = function (score, seed = '', step = 0) {
  const g = this.getGrade(score);
  if (!g) return '—';
  return pickFrom(REMARK_POOL[g.grade], seed, step);
};

const TEACHER_POOL = {
  EE1: ['Exceptional performance. {n} shows mastery across the learning areas. Keep excelling!',
        'An outstanding result. {n} is a role model in class. Keep it up!',
        'Excellent work. {n} is focused, hard-working and consistent.',
        'Superb results. {n} should keep challenging themselves.',
        'Brilliant performance. {n} is a joy to teach.',
        'Remarkable achievement. Maintain this high standard, {n}.',
        'Outstanding. {n} shows great discipline and understanding.',
        'Exemplary results. {n} can inspire others in class.'],
  EE2: ['Very good performance. {n} shows strong understanding. Keep it up.',
        'A very good result. A little more effort will reach the top level.',
        'Strong work, {n}. Keep up the dedication and enthusiasm.',
        '{n} is a hard-working learner with very good results.',
        'Very good progress. {n} should aim even higher.',
        'Commendable performance. Stay consistent, {n}.',
        'Very good grasp of most learning areas. Well done.',
        'Great effort. {n} is close to excellence.'],
  ME1: ['Good performance. {n} is meeting expectations well. Keep it up!',
        'A good result. More practice will lift {n} higher.',
        '{n} is a focused learner making steady progress.',
        'Good work, {n}. Aim for a higher level next time.',
        'Meeting expectations in most areas. Keep working hard.',
        'Good effort. Regular revision will help {n} improve.',
        'Steady progress. {n} can do even better.',
        'A pleasing result. Keep up the good habits, {n}.'],
  ME2: ['Fair performance. {n} is meeting basic expectations. More practice is needed.',
        'A fair result. With extra effort, {n} can improve.',
        '{n} can do better with regular revision and focus.',
        'Satisfactory work. Ask for help in weaker areas, {n}.',
        'An average performance. More commitment will bring better results.',
        'Fair effort. {n} should practise a little every day.',
        'Meeting the basics. {n} should aim higher next term.',
        'Reasonable work. More consistency is needed, {n}.'],
  AE1: ['Approaching expectation. Some improvement shown, but more effort is needed.',
        '{n} is improving but must work harder in several areas.',
        'Close to the standard. Regular revision will help {n}.',
        'More effort and practice are needed, {n}.',
        'Some progress noted. {n} should seek help in weaker areas.',
        'With extra focus, {n} can reach the standard.',
        '{n} needs to revise more and ask questions in class.',
        'A step away from the standard. Keep trying, {n}.'],
  AE2: ['Below average. Extra support and steady effort are needed.',
        '{n} needs close guidance and regular practice.',
        'Improvement is needed in many areas. Please support {n} at home.',
        '{n} should seek help from teachers and revise daily.',
        'Needs a firm push. Parents are encouraged to follow up.',
        'More commitment is needed. {n} can improve with support.',
        'Weak in several areas. Extra lessons would help {n}.',
        'Please work with the school to help {n} improve.'],
  BE1: ['Performance is low. Urgent support is needed. Please see the class teacher.',
        '{n} needs close guidance and extra lessons.',
        'Much improvement is needed. Parents are encouraged to engage the school.',
        'Basic skills need to be built. Please support {n} daily.',
        'Needs urgent attention in most areas.',
        'The school and home should work together to help {n}.',
        'Weak results. {n} needs a clear plan of support.',
        'Please meet the class teacher to discuss how to help {n}.'],
  BE2: ['Very low performance. Immediate and intensive support is needed.',
        '{n} needs urgent help. Parents are asked to meet the school.',
        'Serious support is needed in all areas for {n}.',
        'Please contact the class teacher for a support plan.',
        'Basic skills are not yet in place. Daily guided practice is needed.',
        'Urgent intervention is required for {n}.',
        'Parents are encouraged to engage the school soon.',
        '{n} needs intensive support at school and at home.'],
};

const HEAD_POOL = {
  EE1: ['{n} has achieved exceptional results. The school is very proud. Keep it up.',
        'An outstanding term for {n}. We congratulate and encourage you.',
        'Excellent achievement, {n}. Be a role model to others.',
        'Exceptional work from {n}. The school is proud of this success.',
        'Congratulations {n} on an excellent performance. Maintain the standard.',
        'A brilliant result. We encourage {n} to keep aiming high.'],
  EE2: ['{n} has done very well this term. We encourage continued dedication.',
        'Very good results from {n}. Keep up the positive attitude.',
        'A strong performance. {n} is encouraged to aim for the top.',
        'Well done {n}. We expect even better results.',
        'Commendable work, {n}. Keep the hard work going.',
        '{n} is doing very well. Keep it up.'],
  ME1: ['{n} is making good progress. We encourage continued effort and participation.',
        'A good term for {n}. Keep working hard.',
        'Good results from {n}. We urge more focus to do even better.',
        '{n} is on the right track. Keep it up.',
        'Pleasing progress, {n}. Aim for the next level.',
        'Good work, {n}. We encourage regular revision.'],
  ME2: ['{n} has shown satisfactory performance. With more focus, better results will come.',
        'A fair term for {n}. We expect improvement next term.',
        '{n} can do better. We encourage more commitment.',
        'Satisfactory results. {n} should put in more effort.',
        'Fair work, {n}. Regular revision will bring improvement.',
        'We encourage {n} to work harder and aim higher.'],
  AE1: ['{n} is making some progress but needs more effort. Seek help where needed.',
        'Improvement is noted. {n} should revise consistently.',
        'More effort is needed from {n} to reach the standard.',
        '{n} is encouraged to work closely with teachers.',
        'We urge {n} to put in more work next term.',
        'With more focus, {n} will improve.'],
  AE2: ['{n} needs to improve. We urge parents to work closely with the school.',
        'Better results are possible with support. We encourage {n} to try harder.',
        'Please support {n} with regular revision at home.',
        '{n} needs extra support to improve results.',
        'We encourage parents to follow up on {n}\'s work.',
        'Improvement is needed. We will support {n} at school.'],
  BE1: ['{n} needs urgent academic support. Please keep close contact with the class teacher.',
        'We strongly encourage regular attendance and extra support for {n}.',
        'Please meet the school to plan how to help {n}.',
        '{n} needs close follow up from school and home.',
        'Urgent help is needed. We will work with you to support {n}.',
        'Parents are urged to engage the school about {n}\'s progress.'],
  BE2: ['{n} needs immediate and intensive support. Please contact the school.',
        'We invite parents to meet us to plan support for {n}.',
        'Urgent intervention is needed for {n}. Please see the class teacher.',
        'Please come to school to discuss a plan for {n}.',
        'Serious support is required. We will work together to help {n}.',
        '{n} needs intensive help. Parents, please engage the school.'],
};


/* ── More wordings (Grades 7–9) so cards in one class rarely repeat ── */
const EXTRA = (pool, more) => Object.entries(more).forEach(([k, v]) => pool[k].push(...v));
EXTRA(REMARK_POOL, {
  EE1: ['Consistently excellent. Well done.', 'A model learner in this area.', 'Exceptional grasp of concepts.', 'Superb. Keep stretching yourself.', 'Top marks. Keep reading widely.', 'Excellent depth of understanding.', 'Very impressive. Keep it up.', 'A standout result. Congratulations.', 'Excellent work ethic shown here.', 'Great mastery. Help your peers.', 'Distinguished performance.', 'Flawless effort. Keep going.'],
  EE2: ['Very good. The top level is within reach.', 'Strong grasp. Polish the details.', 'A very good show. Keep it steady.', 'Great work. Aim for full marks.', 'Very good effort and focus.', 'Keep this momentum going.', 'Commendable. Try harder questions.', 'Very good understanding of topics.', 'Well done. Keep reading more.', 'Almost excellent. Keep pushing.', 'A very pleasing result.', 'Very good. Stay disciplined.'],
  ME1: ['Good result. Keep building on it.', 'Solid work. Aim a notch higher.', 'Good. Revise weak topics.', 'Doing well. Stay consistent.', 'A good show. Try extra exercises.', 'Good grasp. Work on accuracy.', 'Well done. Keep reading widely.', 'On the right track. Keep going.', 'Good effort. Ask more questions.', 'Fairly strong. Push a bit more.', 'Good progress this term.', 'Keep this up and improve more.'],
  ME2: ['Meets the standard. Push for more.', 'Average work. Revise often.', 'Fair. Do extra exercises.', 'You can do better. Practise.', 'An acceptable result. Aim higher.', 'Revise notes every week.', 'Fair progress. Stay focused.', 'Needs steady daily practice.', 'Satisfactory. Read more widely.', 'Work on weaker topics.', 'Meeting the basics. Keep trying.', 'Average. More effort will lift it.'],
  AE1: ['Almost there. Keep revising.', 'Some progress. More effort needed.', 'Practise past questions often.', 'Needs a little more work.', 'Close to the standard. Do not stop.', 'Revise the key concepts again.', 'Focus more during lessons.', 'Weak spots need attention.', 'Improving slowly. Keep trying.', 'Ask the teacher for help.', 'More daily practice is needed.', 'Work harder to meet the standard.'],
  AE2: ['Needs regular guided practice.', 'Gaps remain. Seek extra help.', 'Please revise the basics daily.', 'Work closely with the teacher.', 'Below the standard. Keep trying.', 'Needs more time on this area.', 'Extra lessons would help.', 'Please attend remedial sessions.', 'Build the basics step by step.', 'Needs a clear improvement plan.', 'Put in much more effort.', 'Support is needed to improve.'],
  BE1: ['Needs strong support to improve.', 'Please attend extra lessons.', 'Build basic skills daily.', 'Parents, please help with revision.', 'Needs one-on-one guidance.', 'Very low. Work with the teacher.', 'Improvement plan is needed.', 'Needs patient daily practice.', 'Start from the basics again.', 'Much more effort is needed.', 'Seek help without delay.', 'Needs close follow-up.'],
  BE2: ['Needs immediate close support.', 'Basics must be rebuilt.', 'Extra lessons are strongly advised.', 'Please see the teacher urgently.', 'Needs daily supervised practice.', 'Very low. A support plan is needed.', 'Needs intensive help in this area.', 'Parents, please follow up closely.', 'Take small steps. Ask for help.', 'Requires urgent attention.', 'Needs a fresh start with support.', 'Do not give up. Seek help.'],
});
EXTRA(TEACHER_POOL, {
  EE1: ['{n} has had an excellent term. Keep aiming high.', 'A brilliant result. {n} should keep helping classmates.', '{n} is disciplined and highly capable. Well done.', 'Superb effort this term, {n}. Keep it up.', 'Top-class results. {n} leads by example.', 'Exceptional work, {n}. Stay humble and keep learning.'],
  EE2: ['{n} has done very well. Keep up the hard work.', 'A very good term. {n} is on course for excellence.', 'Very good results. {n} should tackle tougher questions.', '{n} shows commitment and strong results.', 'Well done, {n}. A little more polish will reach the top.', 'Very good performance. Keep the habits that work, {n}.'],
  ME1: ['{n} has had a good term. More revision will help.', 'Good results. {n} can climb higher with focus.', '{n} is a capable learner. Keep working steadily.', 'A good term, {n}. Set a higher target next time.', '{n} is meeting expectations. Keep it up.', 'Good effort, {n}. Reading more will lift your results.'],
  ME2: ['{n} has done fairly. More effort is needed to improve.', 'An average term. {n} should revise every day.', '{n} can achieve more with focus and practice.', 'Fair results. {n} should ask questions in class.', 'Meeting basic expectations. {n} should set a higher goal.', 'More commitment will help {n} do better.'],
  AE1: ['{n} is close to the standard. More revision is needed.', 'Some improvement seen. {n} must keep working hard.', '{n} should practise past questions regularly.', 'With more effort, {n} will meet the standard.', '{n} should seek help from subject teachers.', 'A fair attempt. {n} needs more consistency.'],
  AE2: ['{n} needs steady support and daily revision.', 'Results are below the standard. {n} should work harder.', 'Please encourage {n} to revise at home.', '{n} would benefit from extra lessons.', 'More focus is needed in class, {n}.', 'Parents are asked to support {n} with revision.'],
  BE1: ['{n} needs urgent support. Please meet the class teacher.', 'Results are low. {n} needs a support plan.', 'Close follow-up at home and school will help {n}.', '{n} needs help to build the basics.', 'Please work with the school to support {n}.', 'Much improvement is needed. {n} should attend extra lessons.'],
  BE2: ['{n} needs immediate and intensive support.', 'Please meet the school to plan support for {n}.', '{n} needs close daily guidance.', 'Very low results. {n} needs urgent help in every area.', 'Parents, please follow up with {n} every day.', 'A clear support plan is needed for {n}.'],
});
EXTRA(HEAD_POOL, {
  EE1: ['Excellent results, {n}. The school is proud of you.', 'Outstanding work, {n}. Keep leading by example.', 'Congratulations {n}. Maintain this fine standard.', 'A wonderful term for {n}. Keep shining.', '{n} has set a high standard. Well done.', 'Exceptional, {n}. Keep aiming higher.'],
  EE2: ['Very good work, {n}. Keep pushing for the top.', 'Well done {n}. We are pleased with this progress.', '{n} has done very well. Stay consistent.', 'A very good term, {n}. Aim for excellence.', 'Commendable results from {n}. Keep it up.', '{n} is doing very well. We encourage more effort.'],
  ME1: ['Good work, {n}. Aim a level higher next term.', '{n} is progressing well. Keep working hard.', 'A good term for {n}. Keep up the effort.', 'Well done {n}. More focus will bring better results.', '{n} is doing well. We encourage steady revision.', 'Good progress, {n}. Keep going.'],
  ME2: ['{n} can do better. We encourage more revision.', 'Fair results. {n} should aim higher next term.', '{n} is meeting the basics. More effort is needed.', 'We encourage {n} to be more consistent.', 'More practice will help {n} improve.', '{n} has potential. Please work harder.'],
  AE1: ['{n} is improving. More effort will bring results.', 'We encourage {n} to revise daily.', '{n} is close to the standard. Keep trying.', 'More focus is needed from {n}. We will help.', '{n} should seek help early. We are here to support.', 'Keep working, {n}. You can reach the standard.'],
  AE2: ['{n} needs more support. Please engage the class teacher.', 'Improvement is needed. We will support {n}.', '{n} should work harder and attend remedial lessons.', 'Please help {n} revise at home.', 'We will work with {n} to improve.', 'More effort is needed from {n}.'],
  BE1: ['{n} needs close support. Please visit the school.', 'We will help {n}. Please meet the class teacher.', 'Urgent attention is needed for {n}.', '{n} needs help to build the basics. Parents, please engage.', 'Please work with us to support {n}.', 'A support plan will be made for {n}.'],
  BE2: ['{n} needs urgent intensive support. Please visit the school.', 'We ask parents to meet the school about {n}.', 'Immediate support is needed for {n}.', 'We will work closely with {n} and the family.', '{n} needs daily guided help. Please see the class teacher.', 'Serious attention is needed. We will support {n}.'],
});

const fillName = (t, name) => t.replace(/\{n\}/g, name);
KJSEA.getTeacherComment = function (grade, name = 'The learner', seed = '') {
  const pool = TEACHER_POOL[grade];
  return pool ? fillName(pickFrom(pool, seed), name) : 'Performance noted. The learner is encouraged to work harder next term.';
};
KJSEA.getPrincipalComment = function (learner, grade) {
  const first = String(learner.fullName || 'The learner').trim().split(/\s+/)[0]
    .replace(/^./, c => c.toUpperCase()).replace(/(?<=.)./g, c => c.toLowerCase());
  const pool = HEAD_POOL[grade];
  return pool ? fillName(pickFrom(pool, String(learner.studentId) + 'h'), first)
              : `${first} is encouraged to work harder and engage more actively with the learning process.`;
};

/* ── B. Shared print-friendly style: white page, black text, gridlines only ── */
const PRINT = { INK: '#000000', LINE: '#000000', MUTE: '#1f2937' };

/* Fixed subject order for every result sheet and report card:
   English, Maths, Kiswahili, Integrated Science, Social Studies, CRE,
   Creative Arts & Sports, Agriculture, Pre-Technical.
   Subjects are recognised by code or name (see KJSEA.SUBJECT_SLOTS);
   anything not in the list goes last, in its original order. */
const SUBJECT_ORDER = ['eng', 'math', 'kisw', 'inter', 'sst', 'cre', 'cas', 'agri', 'pretech'];

const sortSubjects = (list) => (list || [])
  .map((x, i) => {
    const k = SUBJECT_ORDER.findIndex(key => KJSEA.matchSlot({ code: x.code, name: x.name }, key));
    return { x, i, k: k < 0 ? 99 : k };
  })
  .sort((a, b) => (a.k - b.k) || (a.i - b.i))
  .map(o => o.x);

/* "7 EAST" -> "Grade 7 East";  "Grade 7 East" stays as it is */
const prettyClass = (name) => {
  const t = String(name || '').trim();
  if (!t) return '—';
  const w = t.replace(/\w\S*/g, x => x[0].toUpperCase() + x.slice(1).toLowerCase());
  return /^\d/.test(w) ? 'Grade ' + w : w;
};

/* "MR.ANDREW WAMACHO" -> "Mr. Andrew Wamacho" */
const tidyName = (n) => String(n || '').trim()
  .replace(/\.(?=[A-Za-z])/g, '. ').replace(/\s+/g, ' ').toLowerCase()
  .replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

/* Level in full: name on line one, bold code on line two (no box, no colour) */
const levelBlock = (code) => {
  const full = KJSEA.levelFull(code);
  if (!code || !full) return '';
  return `<div style="font-size:13.2px;font-weight:700;line-height:1.2;overflow-wrap:break-word;">${escHtml(full)}</div>` +
         `<div style="font-size:15px;font-weight:800;line-height:1.25;">${escHtml(code)}</div>`;
};

/* School name block for the top of every report card and class sheet.
   Official letterhead style, light on ink: a medium-weight serif name, then one line with the
   postal address, phone and (optional) email, then the motto in italics. Only what the school
   has filled in is printed, so there are never blank gaps. The name steps down in size when
   it is long, so it always stays tidy. */
const schoolHeader = (s, size = 22) => {
  const name = String(s.schoolName || '').trim().toUpperCase();
  const fs   = name.length > 42 ? size - 4 : name.length > 34 ? size - 2.5 : name.length > 27 ? size - 1.2 : size;

  const parts = [];
  if (s.address) parts.push(escHtml(s.address));
  if (s.phone)   parts.push('Tel: ' + escHtml(s.phone));

  const small = 'font-size:12px;font-weight:500;line-height:1.5;';
  const details =
    (parts.length
      ? `<div style="${small}margin-top:3px;">${parts.map((x, i) =>
          `<span style="display:inline-block;white-space:nowrap;${i ? 'border-left:1px solid #000;padding-left:7px;margin-left:7px;' : ''}">${x}</span>`).join('')}</div>`
      : '') +
    (s.email ? `<div style="${small}${parts.length ? '' : 'margin-top:3px;'}">${escHtml(s.email)}</div>` : '');
  const motto = String(s.schoolMotto || '').trim()
    ? `<div style="font-size:13px;font-style:italic;margin-top:2px;">&ldquo;${escHtml(String(s.schoolMotto).trim())}&rdquo;</div>` : '';
  const fallback = !details && !motto
    ? '<div style="font-size:10px;margin-top:3px;">Junior Secondary School</div>' : '';

  return `<div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:${fs}px;font-weight:900;letter-spacing:0.8px;line-height:1.15;color:#000;-webkit-text-stroke:0.5px #000;">${escHtml(name)}</div>${details}${motto}${fallback}`;
};

/* KNEC learning-area codes (Grades 7–9) */
const knecCode = (sub) => {
  const n = String(sub.name || '').toLowerCase().replace(/[^a-z]/g, '');
  const c = String(sub.code || '').toUpperCase();
  if (/sign/.test(n))                              return '904';
  if (/^english/.test(n))                          return '901';
  if (/kiswahili/.test(n))                         return '902';
  if (/math/.test(n))                              return '903';
  if (/science/.test(n) && !/social/.test(n))     return '905';
  if (/agricultur|nutrition/.test(n))              return '906';
  if (/social/.test(n))                            return '907';
  if (/islamic/.test(n) || c === 'IRE')            return '909';
  if (/christian|religio/.test(n) || c === 'CRE')  return '908';
  if (/creative|arts|sport/.test(n))               return '910';
  if (/pretech|technical/.test(n))                 return '911';
  return '';
};

/* Total points of one assessment, worked out from its marks (so it never depends on a stored total) */
const endPts = (res) => (res?.subjectResults || []).reduce((t, x) => {
  const ok = x && !x.absent && !x.notEntered && x.score !== null && x.score !== undefined && !isNaN(Number(x.score));
  return t + (ok ? (KJSEA.getGrade(x.score)?.points || 0) : 0);
}, 0);

/* ══════════════════════════════════════════════════════════
   11. REPORT CARD — shared building blocks (Grades 1–9)
   Compact A4-shaped layout: white page, solid black gridlines, bold text.
   js/reports-primary.js uses these same blocks, so every card looks alike.
══════════════════════════════════════════════════════════ */
const CARD_LINE = '#000000';
const CARD_INK  = '#000000';

/* 437 over a short line over 900 */
const cardFrac = (a, b) =>
  `<div style="display:inline-block;text-align:center;line-height:1.15;"><div style="padding:0 4px 3px;">${a}</div><div style="border-top:2px solid ${CARD_LINE};"></div><div style="padding:1px 4px 2px;">${b}</div></div>`;

/* Teacher name without the title ("Mr. Dan Kemboi" -> "Dan Kemboi"): titles in the data are often wrong */
const dropTitle = (n) => tidyName(n).replace(/^(Mr|Mrs|Ms|Md|Miss|Dr|Madam|Sir|Rev|Fr)\.?\s+/i, '').trim();

const cardBar = (title, right = '') => `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 12px 6px;background:#ffffff;color:${CARD_INK};border-bottom:2px solid ${CARD_LINE};font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
    <span>${title}</span><span style="font-weight:600;letter-spacing:0.2px;text-transform:none;font-size:12.5px;">${right}</span>
  </div>`;

const cardTh = (label, width, align = 'center', last = false, extra = '') =>
  `<th ${extra} style="${width ? `width:${width}%;` : ''}padding:5px 4px 9px;text-align:${align};font-size:12.5px;font-weight:800;letter-spacing:0;text-transform:uppercase;line-height:1.15;overflow-wrap:normal;color:${CARD_INK};background:#ffffff;border-right:${last ? 'none' : `2px solid ${CARD_LINE}`};border-bottom:3px solid ${CARD_LINE};">${label}</th>`;

const cardGroupTh = (label, n) =>
  `<th colspan="${n}" style="padding:3px 4px 6px;text-align:center;font-size:12.5px;font-weight:800;text-transform:uppercase;color:${CARD_INK};background:#ffffff;border-right:2px solid ${CARD_LINE};border-bottom:2px solid ${CARD_LINE};">${label}</th>`;

const cardSubTh = (label) =>
  `<th style="padding:3px 0 7px;text-align:center;font-size:11px;font-weight:800;text-transform:uppercase;color:${CARD_INK};background:#ffffff;border-right:2px solid ${CARD_LINE};border-bottom:3px solid ${CARD_LINE};">${label}</th>`;

const cardTd = (extra = '') =>
  `padding:3px 6px 6px;line-height:1.2;background:#ffffff;border-right:2px solid ${CARD_LINE};border-bottom:2px solid ${CARD_LINE};vertical-align:middle;${extra}`;

const cardCell = (label, value, { span = 1, last = false, bottom = true } = {}) => `
  <div style="grid-column:span ${span};padding:2px 12px 6px;background:#ffffff;${last ? '' : `border-right:2px solid ${CARD_LINE};`}${bottom ? `border-bottom:2px solid ${CARD_LINE};` : ''}">
    <div style="font-size:12.5px;font-weight:800;color:${CARD_INK};text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    <div style="font-size:15.5px;font-weight:700;color:${CARD_INK};margin-top:1px;line-height:1.3;min-height:17px;">${value || '&mdash;'}</div>
  </div>`;

/* Stacked label + value box (used in the average / overall-level strip) */
const cardStat = (label, value, last = false) => `
  <div style="padding:2px 12px 6px;background:#ffffff;${last ? '' : `border-right:2px solid ${CARD_LINE};`}">
    <div style="font-size:12.5px;font-weight:800;color:${CARD_INK};text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    <div style="font-size:17px;font-weight:800;color:${CARD_INK};margin-top:1px;line-height:1.25;">${value}</div>
  </div>`;

const cardSign = (title, comment, person, personLabel, last = false) => `
  <div style="padding:5px 12px 8px;background:#ffffff;${last ? '' : `border-right:2px solid ${CARD_LINE};`}">
    <div style="font-size:12.5px;font-weight:800;color:${CARD_INK};text-transform:uppercase;letter-spacing:0.5px;">${title}</div>
    <div style="font-size:14.5px;font-weight:600;color:${CARD_INK};line-height:1.3;font-style:italic;min-height:38px;">${escHtml(comment)}</div>
    <div style="margin-top:3px;border-bottom:2px solid ${CARD_LINE};"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-top:2px;font-size:12px;font-weight:600;color:${CARD_INK};">
      <span style="min-width:0;">${person ? `<strong style="font-size:14px;">${escHtml(tidyName(person))}</strong> &middot; ` : ''}${personLabel}</span>
      <span style="white-space:nowrap;flex-shrink:0;">Date: ........</span>
    </div>
  </div>`;

const cardDate = (label, value, last = false) => `
  <div style="padding:4px 12px 7px;background:#ffffff;${last ? '' : `border-right:2px solid ${CARD_LINE};`}">
    <div style="font-size:12.5px;font-weight:800;color:${CARD_INK};text-transform:uppercase;">${label}</div>
    <div style="font-size:14px;font-weight:800;color:${CARD_INK};min-height:16px;">${value ? escHtml(value) : '..............................'}</div>
  </div>`;

/* Closing date | next term | parent signature, on one row */
const cardDatesRow = (s) => `
  <div style="display:grid;grid-template-columns:1fr 1fr 1.7fr;border-bottom:3px solid ${CARD_LINE};">
    ${cardDate('Term closing date', s.closingDate)}
    ${cardDate('Next term opens', s.nextTerm)}
    <div style="padding:4px 12px 5px;background:#ffffff;">
      <div style="font-size:12.5px;font-weight:800;color:${CARD_INK};text-transform:uppercase;">Parent / Guardian signature</div>
      <div style="border-bottom:2px solid ${CARD_LINE};height:15px;margin-top:3px;"></div>
    </div>
  </div>`;

/* Letterhead (one compact block) + title row */
const cardHeader = (s, rightText) => {
  const initials = String(s.schoolName || 'S').trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const name = String(s.schoolName || '').trim().toUpperCase();
  const fs = name.length > 56 ? 15 : name.length > 50 ? 16.5 : name.length > 44 ? 18 : name.length > 38 ? 19.5 : 21;
  const bits = [];
  if (s.address) bits.push(escHtml(s.address));
  if (s.phone)   bits.push('Tel: ' + escHtml(s.phone));
  if (s.email)   bits.push(escHtml(s.email));
  const details = bits.length
    ? bits.map((x, i) => `<span style="display:inline-block;white-space:nowrap;">${i ? '<span style="padding:0 7px 0 5px;">|</span>' : ''}${x}</span>`).join('')
    : '';
  const motto = String(s.schoolMotto || '').trim()
    ? `<i style="display:inline-block;margin-left:10px;">&ldquo;${escHtml(String(s.schoolMotto).trim())}&rdquo;</i>` : '';
  return `
  <div style="display:flex;align-items:center;gap:12px;padding:6px 14px;background:#ffffff;border-bottom:3px solid ${CARD_LINE};">
    <div style="width:44px;height:44px;background:#ffffff;color:${CARD_INK};border:2px solid ${CARD_LINE};border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;letter-spacing:1px;flex-shrink:0;">${escHtml(initials)}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:${fs}px;font-weight:900;letter-spacing:0.6px;line-height:1.15;color:#000;-webkit-text-stroke:0.5px #000;white-space:nowrap;">${escHtml(name)}</div>
      <div style="font-size:11.5px;font-weight:500;line-height:1.35;margin-top:2px;">${details}${motto}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:3px 14px 6px;background:#ffffff;border-bottom:3px solid ${CARD_LINE};font-size:14px;font-weight:800;letter-spacing:1.4px;color:${CARD_INK};">
    <span style="white-space:nowrap;">LEARNER PROGRESS REPORT</span>
    <span style="font-weight:600;letter-spacing:0.2px;font-size:13.5px;text-align:right;">${rightText}</span>
  </div>`;
};

/* Frame: thin outer line with corner diamonds, thick inner line */
const cardFrame = (inner) => {
  const dot = (pos) => `<span style="position:absolute;${pos}width:9px;height:9px;background:#000;transform:rotate(45deg);"></span>`;
  return `
<div style="position:relative;width:100%;max-width:754px;box-sizing:border-box;background:#ffffff;border:1.5px solid #000;padding:5px;margin:7px auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
${dot('top:-6px;left:-6px;')}${dot('top:-6px;right:-6px;')}${dot('bottom:-6px;left:-6px;')}${dot('bottom:-6px;right:-6px;')}
<div style="width:100%;box-sizing:border-box;background:#ffffff;color-scheme:light;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:3px solid ${CARD_LINE};overflow:hidden;font-family:'DM Sans','Segoe UI',Arial,sans-serif;font-size:14px;color:${CARD_INK};margin:0 auto;font-variant-numeric:tabular-nums;">
${inner}
</div>
</div>`;
};

/* Footer line: note + brand on the left, copy label on the right */
const cardFooter = (note) => `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:3px 12px 7px;background:#ffffff;font-size:12px;font-weight:700;color:${CARD_INK};">
    <span>${note}Powered by Scholar Analytics</span>
    <span style="white-space:nowrap;">Parent / Guardian copy</span>
  </div>`;

/* ══════════════════════════════════════════════════════════
   11b. BUILD INDIVIDUAL REPORT CARD — Grades 7–9
        End Term, Mid Term, or Mid + End Term side by side
══════════════════════════════════════════════════════════ */
const buildReportCard = (r, s) => {
  if (s.primary) return buildPrimaryCard(r, s);          // Grades 1–6 (js/reports-primary.js)
  const INK = CARD_INK, LINE = CARD_LINE;
  const both = !!(s.dual && r.dual);                      // Mid Term + End Term side by side
  const firstName = String(r.fullName || 'The learner').trim().split(/\s+/)[0]
    .replace(/^./, c => c.toUpperCase()).replace(/(?<=.)./g, c => c.toLowerCase());

  const gender = r.gender ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1) : '';

  /* Teacher for a subject: name typed for THIS learner's class, else the backend's, else blank */
  const maps = s.teacherMaps || {};
  const teacherMap =
    maps[r.streamName] ||
    (Object.keys(maps).length === 1 ? Object.values(maps)[0] : null) || {};
  const teacherFor = (sub) => dropTitle(teacherMap[normName(sub.name)] || sub.teacherName || '');

  /* ── Subject rows ───────────────────────────────────────── */
  const lvlCode = (x) => (x && validSub(x)) ? (KJSEA.getGrade(x.score)?.grade || '—') : (x && x.absent ? 'ABS' : '—');
  const scoreOf = (x) => !x ? '—' : x.absent ? 'ABS' : validSub(x) ? Math.round(Number(x.score)) + '%' : '—';
  const num = (size = 15) => `text-align:center;font-weight:800;font-size:${size}px;color:${INK};padding-left:2px;padding-right:2px;`;
  const codeTd = (row, i) => `<td style="${cardTd(`text-align:center;font-size:13px;font-weight:700;color:${INK};`)}">${escHtml(knecCode(row) || String(i + 1))}</td>`;
  const areaTd = (name) => `<td style="${cardTd(`text-align:left;font-weight:700;font-size:14px;color:${INK};`)}">${escHtml(name)}</td>`;
  const remarkTd = (t) => `<td style="${cardTd(`text-align:left;font-size:13px;font-weight:600;color:${INK};`)}">${escHtml(t)}</td>`;
  const teacherTd = (t) => `<td style="${cardTd(`text-align:left;font-size:13px;font-weight:800;color:${INK};border-right:none;`)}">${escHtml(t)}</td>`;

  const rowsHtml = both
    ? sortSubjects(r.dual.rows).map((row, i) => {
        const remark = row.avg !== null
          ? KJSEA.getSubjectRemark(row.avg, String(r.studentId) + row.key, i)
          : ((row.mid?.absent || row.end?.absent) ? 'Absent — not assessed' : 'Marks not entered');
        const pts = validSub(row.end) ? (KJSEA.getGrade(row.end.score)?.points ?? '—') : '—';
        const tch = teacherFor({ name: row.name, teacherName: row.teacherName });
        return `<tr>${codeTd(row, i)}${areaTd(row.name)}
          <td style="${cardTd(num())}">${scoreOf(row.mid)}</td><td style="${cardTd(num())}">${lvlCode(row.mid)}</td>
          <td style="${cardTd(num())}">${scoreOf(row.end)}</td><td style="${cardTd(num())}">${lvlCode(row.end)}</td>
          <td style="${cardTd(num())}">${pts}</td>${remarkTd(remark)}${teacherTd(tch)}</tr>`;
      }).join('')
    : sortSubjects(r.subjectResults).map((sub, i) => {
        const isOut = sub.absent || sub.notEntered;
        const g     = isOut ? null : KJSEA.getGrade(sub.score);
        const remark = sub.absent ? 'Absent — not assessed'
                     : sub.notEntered ? 'Marks not entered'
                     : (sub.remark || KJSEA.getSubjectRemark(sub.score, String(r.studentId) + sub.name, i));
        return `<tr>${codeTd(sub, i)}${areaTd(sub.name)}
          <td style="${cardTd(num(15.5))}">${scoreOf(sub)}</td>
          <td style="${cardTd(num(15.5))}">${isOut ? (sub.absent ? 'ABS' : '—') : (g?.grade || sub.grade || '—')}</td>
          <td style="${cardTd(num(15.5))}">${isOut ? '—' : (g?.points ?? sub.points ?? '—')}</td>
          ${remarkTd(remark)}${teacherTd(teacherFor(sub))}</tr>`;
      }).join('');

  /* ── Totals ─────────────────────────────────────────────── */
  const DB = `border-top:4px double ${LINE};`;
  const totNum = (inner, size = 14) => `<td style="${cardTd(DB + `text-align:center;font-weight:800;font-size:${size}px;color:${INK};padding:2px 2px;`)}">${inner}</td>`;
  const fracOf = (tot, n, mult) => (n ? cardFrac(tot, n * mult) : '—');
  const dLvl = (x) => (x && x.subjectCount) ? (KJSEA.getGrade(x.avgScore)?.grade || '—') : '—';

  /* ── Class teacher's comment: from the overall level (the average on a Mid + End card) ── */
  const trend = both && r.dual.mid?.subjectCount && r.dual.end?.subjectCount
    ? (() => { const d = r.dual.end.avgScore - r.dual.mid.avgScore;
               return d >= 3 ? ' Improved since mid term.' : d <= -3 ? ' Dipped since mid term; more effort is needed.' : ''; })()
    : '';
  const teacherComment = KJSEA.getTeacherComment(r.meanGrade, firstName, String(r.studentId)) + trend;
  const closing = escHtml(teacherComment.split('.')[0]) + '.';

  const totalRow = both
    ? `<tr><td style="${cardTd(DB)}"></td>
        <td style="${cardTd(DB + `font-weight:800;font-size:14px;letter-spacing:0.8px;color:${INK};`)}">TOTAL</td>
        ${totNum(fracOf(r.dual.mid?.totalScore, r.dual.mid?.subjectCount, 100))}${totNum(dLvl(r.dual.mid))}
        ${totNum(fracOf(r.dual.end?.totalScore, r.dual.end?.subjectCount, 100))}${totNum(dLvl(r.dual.end))}
        ${totNum(fracOf(endPts(r.dual.end), r.dual.end?.subjectCount, 8))}
        <td colspan="2" style="${cardTd(DB + `border-right:none;font-size:13px;font-weight:700;color:${INK};`)}">${closing}</td></tr>`
    : `<tr><td style="${cardTd(DB)}"></td>
        <td style="${cardTd(DB + `font-weight:800;font-size:14px;letter-spacing:0.8px;color:${INK};`)}">TOTAL</td>
        ${totNum(fracOf(r.totalScore, r.subjectCount, 100), 15)}${totNum(escHtml(r.meanGrade || '—'), 15.5)}
        ${totNum(fracOf(endPts(r), r.subjectCount, 8), 15)}
        <td colspan="2" style="${cardTd(DB + `border-right:none;font-size:13px;font-weight:700;color:${INK};`)}">${closing}</td></tr>`;

  /* ── Table head + column widths ─────────────────────────── */
  const cols = both ? [6, 17, 7, 7, 7, 7, 6, 24, 19] : [7, 22, 8, 8, 6, 31, 18];
  const colgroup = '<colgroup>' + cols.map(w => `<col style="width:${w}%">`).join('') + '</colgroup>';
  const head = both
    ? `<tr>${cardTh('Code', 0, 'center', false, 'rowspan="2"')}${cardTh('Learning area', 0, 'left', false, 'rowspan="2"')}${cardGroupTh('Mid term', 2)}${cardGroupTh('End term', 3)}${cardTh('Teacher&rsquo;s remark (average)', 0, 'left', false, 'rowspan="2"')}${cardTh('Teacher', 0, 'left', true, 'rowspan="2"')}</tr>
       <tr>${cardSubTh('Score')}${cardSubTh('Level')}${cardSubTh('Score')}${cardSubTh('Level')}${cardSubTh('Pts')}</tr>`
    : `<tr>${cardTh('Code')}${cardTh('Learning area', 0, 'left')}${cardTh('Score')}${cardTh('Level')}${cardTh('Pts<br/>/ 8')}${cardTh('Teacher&rsquo;s remark', 0, 'left')}${cardTh('Teacher', 0, 'left', true)}</tr>`;

  /* ── Learner details + averages ─────────────────────────── */
  const dAvg = (x) => (x && x.subjectCount) ? `${x.avgScore}%` : '—';
  const levelText = `${escHtml(KJSEA.levelFull(r.meanGrade))} &nbsp;${escHtml(r.meanGrade || '')}`;
  const learnerGrid = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:3px solid ${LINE};">
      ${cardCell('Learner name',   escHtml(r.fullName), { span: 2 })}
      ${cardCell('Class',          escHtml(prettyClass(r.streamName || s.cls)))}
      ${cardCell('Gender',         escHtml(gender), { last: true })}
      ${cardCell('Assessment no.', escHtml(r.assessmentNo || ''), { bottom: false })}
      ${cardCell('Admission no.',  escHtml(r.upiNumber || ''), { bottom: false })}
      ${both
        ? cardCell('Academic year', escHtml(s.year), { span: 2, last: true, bottom: false })
        : cardCell('Academic year', escHtml(s.year), { bottom: false }) + cardCell('Average', `${r.avgScore}%`, { last: true, bottom: false })}
    </div>`;

  const levelStrip = both
    ? `<div style="display:grid;grid-template-columns:1fr 1fr 2fr;border-bottom:3px solid ${LINE};">
         ${cardStat('Mid term average', dAvg(r.dual.mid))}
         ${cardStat('End term average', dAvg(r.dual.end))}
         ${cardStat('Overall level (average of both)', levelText, true)}
       </div>`
    : `<div style="display:flex;align-items:baseline;gap:12px;padding:3px 12px 7px;background:#ffffff;border-bottom:3px solid ${LINE};line-height:1.2;">
         <span style="font-size:12.5px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:0.5px;">Overall performance level</span>
         <span style="font-size:19px;font-weight:800;color:${INK};">${levelText}</span>
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
      ? ` &middot; ${pw.count} of ${pw.expected} subjects` : '';
    return `
      <div style="flex:1;min-width:0;padding:4px 10px 11px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
        <div style="font-size:13px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:${INK};">${name}</div>
        <div style="font-size:11.5px;font-weight:600;color:${INK};line-height:1.2;">${escHtml(pw.subjects)}</div>
        <div style="display:flex;align-items:baseline;gap:7px;margin-top:2px;flex-wrap:wrap;">
          <span style="font-size:23px;font-weight:800;color:${INK};line-height:1.1;">${hasScore ? pw.avg + '%' : '—'}</span>
          <span style="font-size:12.5px;font-weight:700;color:${INK};">${hasScore ? `${pw.points}/${pw.maxPts} pts &nbsp;&middot;&nbsp; ${escHtml(code)}${partial}` : 'No data'}</span>
        </div>
      </div>`;
  }).join('');

  /* ── Grading key: group headings, then code · range · points ── */
  const groups = [];
  KJSEA.SCALE.forEach(g => {
    const last = groups[groups.length - 1];
    if (last && last.full === g.full) last.n++; else groups.push({ full: g.full, n: 1 });
  });
  const keyGroups = groups.map((g, i) => `
    <div style="grid-column:span ${g.n};text-align:center;padding:2px 0 5px;font-size:11px;letter-spacing:0;font-weight:800;text-transform:uppercase;color:${INK};white-space:nowrap;${i ? `border-left:2px solid ${LINE};` : ''}">${g.full}</div>`).join('');
  const keyCells = KJSEA.SCALE.map((g, i) => `
    <div style="text-align:center;padding:3px 0 6px;${i ? `border-left:2px solid ${LINE};` : ''}">
      <div style="font-size:14px;font-weight:800;color:${INK};">${g.grade}</div>
      <div style="font-size:11.5px;font-weight:700;color:${INK};">${g.min}–${g.max}%</div>
      <div style="font-size:11.5px;font-weight:600;color:${INK};">${g.points} pts</div>
    </div>`).join('');

  return cardFrame(`
  ${cardHeader(s, `Term ${escHtml(s.term)} &nbsp;&bull;&nbsp; ${escHtml(s.exam)} Assessment &nbsp;&bull;&nbsp; ${escHtml(s.year)}`)}
  ${learnerGrid}
  ${levelStrip}

  ${cardBar('Subject performance')}
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    ${colgroup}
    <thead>${head}</thead>
    <tbody>${rowsHtml}${totalRow}</tbody>
  </table>

  ${cardBar('Pathway summary', both ? 'Average of Mid &amp; End Term' : 'Average of the KNEC subjects for each pathway')}
  <div style="display:flex;border-bottom:3px solid ${LINE};">${pathwayCells}</div>

  ${cardBar('Comments')}
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:3px solid ${LINE};">
    ${cardSign("Class teacher's comment", teacherComment, ((s.classTeachers || {})[r.streamName] || s.teacher), 'Class teacher')}
    ${cardSign("Head of Institution's comment", KJSEA.getPrincipalComment(r, r.meanGrade), s.principal, 'Signature &amp; stamp', true)}
  </div>

  ${cardDatesRow(s)}

  ${cardBar('Grading key', 'Performance level, score range and points')}
  <div style="display:grid;grid-template-columns:repeat(8,1fr);border-bottom:2px solid ${LINE};">${keyGroups}</div>
  <div style="display:grid;grid-template-columns:repeat(8,1fr);border-bottom:2px solid ${LINE};">${keyCells}</div>
  ${cardFooter('Marks are rounded to the nearest whole number. ')}`);
};

/* ══════════════════════════════════════════════════════════
   12. BUILD CLASS RESULT SHEET  (Kaaboi table + Chebarus analysis, low ink)
══════════════════════════════════════════════════════════ */
const buildClassSheet = (allResults, s) => {
  if (s.primary) return buildPrimarySheet(allResults, s);   // Grades 1–6 (js/reports-primary.js)
  const { INK, LINE, MUTE } = PRINT;
  const results = allResults.filter(r => r.subjectCount > 0);    // learners with marks
  const noMarks = allResults.filter(r => !(r.subjectCount > 0));  // shown as X, not ranked
  const n = results.length;
  const div = (a, b) => b ? a / b : 0;

  /* One subject list for the whole sheet. Subjects are matched by NAME, because East and West
     keep separate subject records (different ids) for the same subject. */
  const subjectList = [...(state.subjects || [])];
  allResults.forEach(r => (r.subjectResults || []).forEach(x => {
    if (x.name && !subjectList.some(sj => normName(sj.name) === normName(x.name)))
      subjectList.push({ name: x.name, code: x.code || String(x.name).slice(0, 4).toUpperCase() });
  }));
  subjectList.splice(0, subjectList.length, ...sortSubjects(subjectList));
  const sameSubj = (x, subj) => normName(x.name) === normName(subj.name);
  /* "English (901)" — learning-area name followed by its KNEC code in brackets */
  /* Class sheet: learning-area name only. KNEC codes (901…911) are printed on Grade 7–9 report cards only. */
  const areaLabel = (x) => escHtml(x.name);

  const avg      = div(results.reduce((a, r) => a + r.avgScore, 0), n).toFixed(1);
  const meanPts  = div(results.reduce((a, r) => a + r.avgPoints, 0), n).toFixed(2);
  const classCode = KJSEA.getGrade(Math.round(Number(avg)))?.grade || '';

  /* Overall grade distribution */
  const dist = {};
  KJSEA.SCALE.forEach(g => dist[g.grade] = 0);
  const xCount = noMarks.length;
  results.forEach(r => { if (r.meanGrade && dist[r.meanGrade] !== undefined) dist[r.meanGrade]++; });

  /* Teachers for a subject (one class -> one name; whole grade -> names joined) */
  const maps = s.teacherMaps || {};
  const teachersOf = (name) =>
    [...new Set(Object.values(maps).map(m => m[normName(name)]).filter(Boolean))].map(tidyName).join(' / ');

  /* Subject averages, grade counts, top 3 */

  const subjectStats = subjectList.map(subj => {
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
  const statOf = (subj) => subjectStats.find(x => normName(x.name) === normName(subj.name));

  /* Gender analytics */
  const males     = results.filter(r => r.gender === 'male'   && r.subjectCount > 0);
  const females   = results.filter(r => r.gender === 'female' && r.subjectCount > 0);
  const maleAvg   = males.length   ? parseFloat((males.reduce((a, r) => a + r.avgScore, 0) / males.length).toFixed(1))   : 0;
  const femaleAvg = females.length ? parseFloat((females.reduce((a, r) => a + r.avgScore, 0) / females.length).toFixed(1)) : 0;
  const betterGender = (!males.length || !females.length) ? 'Not enough data' : (femaleAvg >= maleAvg ? 'Female' : 'Male');
  const genderGap    = (!males.length || !females.length) ? '—' : Math.abs(maleAvg - femaleAvg).toFixed(2);

  /* Most improved (VAP) */
  const mostImproved = results.filter(r => r.vap !== null && r.vap !== undefined && r.vap > 0)
    .sort((a, b) => b.vap - a.vap).slice(0, 3);          // top 3 most improved
  const hasPrevExam = results.some(r => r.vap !== null && r.vap !== undefined);

  /* ── Style helpers: white, black text, 1px gridlines ── */
  const levelShort = (code) => code
    ? `<span style="font-size:12.5px;font-weight:800;letter-spacing:0.3px;">${escHtml(code)}</span>` : '—';

  const bar = (t, newPage = false) => `<div class="bar${newPage ? ' pgstart' : ''}" style="padding:5px 14px;background:#ffffff;color:${INK};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-top:3px solid ${LINE};border-bottom:2px solid ${LINE};">${t}</div>`;
  const th  = (label, align = 'center', title = '') => `<th ${title ? `title="${escHtml(title)}"` : ''} style="padding:6px 5px 10px;text-align:${align};font-size:9px;font-weight:800;line-height:1.15;color:${INK};background:#ffffff;border-right:1px solid ${LINE};border-bottom:2px solid ${LINE};">${label}</th>`;
  const tdS = (extra = '') => `padding:4px 5px 6px;border-right:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:10.5px;line-height:1.3;color:${INK};background:#ffffff;${extra}`;

  /* ── Merit table (Kaaboi style: mark + level in one cell) ── */
  /* Whole-grade sheets: which class each learner is in, and their position within that class */
  const multi = new Set(allResults.map(r => r.streamName).filter(Boolean)).size > 1;
  const extra = multi ? 2 : 0;
  const shortClass = (n) => prettyClass(n).replace(/^Grade\s+/, '');
  const streamPos = results.map(() => 0);
  const tally = {};
  results.forEach((r, i) => {
    const t = (tally[r.streamName || ''] = tally[r.streamName || ''] || { n: 0, lastTotal: null, lastPos: 0 });
    t.n++;
    if (r.totalScore !== t.lastTotal) { t.lastPos = t.n; t.lastTotal = r.totalScore; }
    streamPos[i] = t.lastPos;
  });
  const classCells = (r, i) => multi
    ? `<td style="${tdS('text-align:center;white-space:nowrap;')}">${escHtml(shortClass(r.streamName))}</td><td style="${tdS('text-align:center;font-weight:800;')}">${i === null ? '—' : streamPos[i]}</td>`
    : '';

  const subjHeaders = subjectList.map(subj => th(areaLabel(subj), 'center', subj.name)).join('');

  const tableRows = results.map((r, i) => {
    const subjCells = subjectList.map(subj => {
      const sr = r.subjectResults?.find(x => sameSubj(x, subj));
      let txt = '—';
      if (sr && !sr.notEntered) txt = sr.absent ? 'ABS' : `${sr.score ?? '—'}${sr.grade ? ' ' + sr.grade : ''}`;
      return `<td style="${tdS('text-align:center;white-space:nowrap;font-weight:600;')}">${escHtml(txt)}</td>`;
    }).join('');

    const vapText = r.vap !== null && r.vap !== undefined ? (r.vap > 0 ? `+${r.vap}` : `${r.vap}`) : '—';

    return `
      <tr>
        <td style="${tdS('text-align:center;font-weight:800;')}">${r.position}</td>
        <td style="${tdS('text-align:left;font-weight:700;white-space:nowrap;')}">${escHtml(r.fullName)}</td>
        <td style="${tdS('text-align:center;')}">${escHtml(r.gender?.charAt(0).toUpperCase() || '—')}</td>
        ${classCells(r, i)}
        ${subjCells}
        <td style="${tdS('text-align:center;font-weight:800;')}">${r.totalScore}</td>
        <td style="${tdS('text-align:center;font-weight:700;')}">${r.avgScore}%</td>
        <td style="${tdS('text-align:center;font-weight:800;')}">${r.totalPoints}</td>
        <td style="${tdS('text-align:center;white-space:nowrap;')}">${levelShort(r.meanGrade)}</td>
        <td style="${tdS('text-align:center;font-weight:700;border-right:none;')}">${vapText}</td>
      </tr>`;
  }).join('');

  const xCells = subjectList.map(() => `<td style="${tdS('text-align:center;')}">—</td>`).join('');
  const noMarksRows = noMarks.map(r => `
      <tr>
        <td style="${tdS('text-align:center;')}">—</td>
        <td style="${tdS('text-align:left;font-weight:700;white-space:nowrap;')}">${escHtml(r.fullName)}</td>
        <td style="${tdS('text-align:center;')}">${escHtml(r.gender?.charAt(0).toUpperCase() || '—')}</td>
        ${classCells(r, null)}
        ${xCells}
        <td style="${tdS('text-align:center;')}">—</td>
        <td style="${tdS('text-align:center;')}">—</td>
        <td style="${tdS('text-align:center;')}">—</td>
        <td style="${tdS('text-align:center;font-weight:800;font-size:12.5px;')}">X</td>
        <td style="${tdS('text-align:center;border-right:none;')}">—</td>
      </tr>`).join('');

  /* Bottom rows: subject average marks, and average points with level (as in Kaaboi) */
  const avgMarksRow = `
    <tr>
      <td colspan="${3 + extra}" style="${tdS(`font-weight:800;border-top:3px double ${LINE};`)}">AVG. MARKS</td>
      ${subjectList.map(subj => `<td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${statOf(subj)?.avg ?? 0}%</td>`).join('')}
      <td style="${tdS(`border-top:3px double ${LINE};`)}"></td>
      <td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${avg}%</td>
      <td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${meanPts}</td>
      <td style="${tdS(`text-align:center;border-top:3px double ${LINE};`)}">${levelShort(classCode)}</td>
      <td style="${tdS(`border-top:3px double ${LINE};border-right:none;`)}"></td>
    </tr>`;

  const avgPointsRow = `
    <tr>
      <td colspan="${3 + extra}" style="${tdS('font-weight:800;')}">AVG. POINTS</td>
      ${subjectList.map(subj => {
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
      <td style="${tdS('font-weight:700;')}">${areaLabel(x)}</td>
      <td style="${tdS('text-align:center;font-weight:800;')}">${x.avg}%</td>
      <td style="${tdS('text-align:center;font-weight:700;')}">${x.avgPts}</td>
      ${KJSEA.SCALE.map(g => `<td style="${tdS(`text-align:center;font-weight:${x.subDist[g.grade] ? 800 : 400};`)}">${x.subDist[g.grade]}</td>`).join('')}
      <td style="${tdS('font-size:10px;border-right:none;')}">${escHtml(teachersOf(x.name))}</td>
    </tr>`).join('');

  /* ── Top 3 per subject ── */
  const top3Cards = subjectStats.map(x => `
    <div class="keep" style="flex:0 0 calc(25% - 7.5px);box-sizing:border-box;border:1.5px solid ${LINE};background:#ffffff;">
      <div style="padding:5px 10px;border-bottom:1.5px solid ${LINE};">
        <div style="font-size:11px;font-weight:800;">${areaLabel(x)}</div>
        <div style="font-size:9.5px;">Avg: ${x.avg}%</div>
      </div>
      <div style="padding:5px 10px;">
        ${x.top3.map((st, i) => `
          <div style="display:flex;gap:6px;padding:3px 0 5px;font-size:10.5px;${i < x.top3.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}">
            <span style="font-weight:800;">${i + 1}.</span>
            <span style="flex:1;font-weight:600;line-height:1.3;">${escHtml(st.fullName)}</span>
            <span style="font-weight:800;white-space:nowrap;">${st.score} ${escHtml(st.grade || '')}</span>
          </div>`).join('')}
        ${!x.top3.length ? '<div style="font-size:10px;">No data</div>' : ''}
      </div>
    </div>`).join('');

  /* ── Gender, per subject ── */
  const genderRows = subjectList.map(subj => {
    const pick = (list) => list.map(r => r.subjectResults?.find(x => sameSubj(x, subj)))
      .filter(x => x && !x.absent && !x.notEntered && x.score !== null && x.score !== undefined).map(x => x.score);
    const mS = pick(males), fS = pick(females);
    const mA = mS.length ? parseFloat((mS.reduce((a, b) => a + b, 0) / mS.length).toFixed(1)) : 0;
    const fA = fS.length ? parseFloat((fS.reduce((a, b) => a + b, 0) / fS.length).toFixed(1)) : 0;
    const none = !mS.length || !fS.length;
    const leader = none ? '—' : mA > fA ? 'Male' : mA < fA ? 'Female' : 'Tie';
    return `
      <tr>
        <td style="${tdS('font-weight:700;')}">${areaLabel(subj)}</td>
        <td style="${tdS('text-align:center;')}">${mS.length ? mA + '%' : '—'}</td>
        <td style="${tdS('text-align:center;')}">${fS.length ? fA + '%' : '—'}</td>
        <td style="${tdS('text-align:center;')}">${none ? '—' : Math.abs(mA - fA).toFixed(1)}</td>
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

  const ctNames = Object.entries(s.classTeachers || {}).filter(([, t]) => t);
  const sigBlock = (title, person, label, last = false) => `
    <div style="padding:12px 18px;background:#ffffff;${last ? '' : `border-right:1px solid ${LINE};`}">
      <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">${title}${person ? ': ' + escHtml(tidyName(person)) : ''}</div>
      <div style="border-bottom:1.5px solid ${LINE};margin:22px 0 5px;"></div>
      <div style="font-size:9px;">${label}</div>
    </div>`;

  const generated = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  /* ════════════ FULL HTML ════════════ */
  return `
<div style="max-width:960px;background:#ffffff;border:2px solid ${LINE};font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${INK};margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;">

  <style>
    @media print { tr, .keep { break-inside: avoid; page-break-inside: avoid; } .bar { break-after: avoid; page-break-after: avoid; } thead { display: table-header-group; } .pgstart { break-before: page; page-break-before: always; } }
  </style>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;padding:14px 18px;border-bottom:3px solid ${LINE};">
    <div>
      ${schoolHeader(s, 19)}
    </div>
    <div style="text-align:right;">
      <div style="font-size:12.5px;font-weight:800;letter-spacing:1px;">ASSESSMENT RESULTS</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:3px;">CLASS: ${escHtml(prettyClass(s.cls))} &nbsp;|&nbsp; TERM: ${escHtml(s.term)} &nbsp;|&nbsp; YEAR: ${escHtml(s.year)} &nbsp;|&nbsp; ASSESSMENT: ${escHtml(s.exam)}</div>
    </div>
  </div>

  ${bar('Class rankings')}
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          ${th('Pos')}${th('Learner name', 'left')}${th('G')}${multi ? th('Class') + th('Str pos') : ''}${subjHeaders}${th('Total')}${th('Avg %')}${th('Points')}${th('Performance<br/>level')}${th('VAP')}
        </tr>
      </thead>
      <tbody>${tableRows}${noMarksRows}${avgMarksRow}${avgPointsRow}</tbody>
    </table>
  </div>
  <div style="padding:5px 14px;font-size:9px;border-top:1px solid ${LINE};">
    Learner position is assigned using total marks. Performance level is calculated using average marks. Marks are rounded to the nearest whole number before the level is worked out.<br/><strong>Performance level:</strong> EE1, EE2 = Exceeding Expectation &nbsp;·&nbsp; ME1, ME2 = Meeting Expectation &nbsp;·&nbsp; AE1, AE2 = Approaching Expectation &nbsp;·&nbsp; BE1, BE2 = Below Expectation
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
        <div style="flex:1;border:1.5px solid ${LINE};padding:8px;text-align:center;"><div style="font-size:15px;font-weight:800;">${males.length}</div><div style="font-size:9.5px;">Male | Avg ${males.length ? maleAvg + '%' : '—'}</div></div>
        <div style="flex:1;border:1.5px solid ${LINE};padding:8px;text-align:center;"><div style="font-size:15px;font-weight:800;">${females.length}</div><div style="font-size:9.5px;">Female | Avg ${females.length ? femaleAvg + '%' : '—'}</div></div>
      </div>
      <strong>Better performing gender: ${betterGender}</strong><br/>Performance gap: ${genderGap}${genderGap === '—' ? '' : ' marks'}
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${th('Subject', 'left')}${th('Male')}${th('Female')}${th('Gap')}${th('Leader')}</tr></thead>
        <tbody>${genderRows}</tbody>
      </table>
    </div>
  </div>

  ${bar('Top 3 most improved learners (VAP)')}
  ${mostImproved.length ? `
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>${th('Rank')}${th('Learner name', 'left')}${th('Prev points')}${th('Current points')}${th('VAP (+/-)')}</tr></thead>
    <tbody>${improvedRows}</tbody>
  </table>` : `
  <div style="padding:10px 14px;font-size:11px;">${hasPrevExam
    ? 'No learner improved on the previous exam.'
    : 'No earlier exam with marks was found for this class, so VAP cannot be worked out. The three most improved learners will appear once an earlier exam (an earlier term or year, or created before this one in the same term) has marks.'}
    ${(state.vapInfo || []).length ? `<div style="margin-top:6px;font-size:10px;">Compared with: ${state.vapInfo.map(v => `${escHtml(prettyClass(v.class))} — ${v.previous ? escHtml(v.previous.name) + ' (Term ' + escHtml(v.previous.term) + ', ' + escHtml(v.previous.year) + ')' : 'no earlier exam'}`).join(' &nbsp;|&nbsp; ')}</div>` : ''}</div>`}

  <!-- Signatures -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:3px solid ${LINE};margin-top:0;">
    ${sigBlock(ctNames.length > 1 ? 'Class teachers' : 'Class teacher', ctNames.length > 1 ? ctNames.map(([c, t]) => `${shortClass(c)}: ${t}`).join(' / ') : (ctNames[0]?.[1] || s.teacher), 'Signature &amp; date: .....................')}
    ${sigBlock('Dean of studies', '', 'Signature &amp; date: .....................')}
    ${sigBlock('Head of Institution', s.principal, 'Signature, stamp &amp; date: .....................', true)}
  </div>

  <!-- Footer -->
  <div style="display:flex;justify-content:space-between;padding:6px 16px;border-top:2px solid ${LINE};font-size:9px;font-weight:600;">
    <span>Report generated on: ${escHtml(generated)}</span>
    <span>Powered by Scholar Analytics</span>
  </div>

</div>`;
};
/* ═══════════════════════════════════════════════════════════
   SECTIONS 13, 14 AND 15 OF js/reports.js — complete replacement
   Delete your old sections 13, 14 and 15 (everything from
   "13. BULK PREVIEW" down to just before "16. RECENT REPORTS")
   and paste this whole file in their place.
═══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   13. BULK PREVIEW — All cards stacked (skips learners with no marks)
══════════════════════════════════════════════════════════ */
const buildBulkPreview = (results, settings) => {
  state.bulkCards = [];
  const withMarks = results.filter(r => r.subjectCount > 0);

  const pages = withMarks.map((learner, i) => {
    const cardHTML = buildReportCard(learner, settings);
    state.bulkCards.push({ learner, html: cardHTML });
    return `
      <div style="position:relative;margin-bottom:4px;">
        <div style="font-size:11px;font-weight:700;color:#718096;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <i class="fas fa-file"></i>
          Card ${i + 1} of ${withMarks.length} — ${escHtml(learner.fullName)}
        </div>
        ${cardHTML}
      </div>`;
  });

  return `<div style="display:flex;flex-direction:column;gap:24px;">${pages.join('')}</div>`;
};

/* ══════════════════════════════════════════════════════════
   14. PRINT  (unchanged)
══════════════════════════════════════════════════════════ */
/* Browser print. Report cards: every card is scaled to fit EXACTLY one A4 portrait page (a
   card that is too tall is shrunk, never cut). Class sheet: A4 landscape, split only between
   rows and sections. The page size/orientation is set here, because the stylesheet only knows
   portrait. */
const PX_PER_MM = 96 / 25.4;

const printPages = (htmls, landscape) => {
  const margin = 8;                                                    // mm
  const pageW  = Math.floor(((landscape ? 297 : 210) - 2 * margin) * PX_PER_MM);
  const pageH  = Math.floor(((landscape ? 210 : 297) - 2 * margin) * PX_PER_MM) - 4;

  let st = document.getElementById('printPageStyle');
  if (!st) { st = document.createElement('style'); st.id = 'printPageStyle'; document.head.appendChild(st); }
  st.textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: ${landscape ? margin : 0}mm; }` +
    `@media print { html, body, #printArea, .print-area { background:#fff !important; } ` +
    `.print-area div[style*="max-width:754px"] { max-width:none !important; } ` +
    `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;

  if (landscape) {                                    // class sheet: flows over pages by itself
    el.printArea.innerHTML = htmls.join('');
    window.print();
    return;
  }

  /* cards: laid out at the SAME width as the preview and the PDF (so nothing re-wraps),
     then scaled to fit one page and centred */
  const CARD_W = 754;
  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;left:-99999px;top:0;width:${CARD_W}px;background:#fff;`;
  document.body.appendChild(probe);

  const heightOf = (html) => {
    probe.innerHTML = html;
    return (probe.firstElementChild || probe).getBoundingClientRect().height;
  };

  const useZoom = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '0.5');
  const pages = htmls.map((h0, i) => {
    const html = String(h0);
    const h = heightOf(html);
    const k = Math.min(pageW / CARD_W, (pageH / h) * 0.995, 1);
    const last = i === htmls.length - 1;
    return `<div style="width:210mm;height:296mm;padding:${margin}mm;background:#fff;overflow:hidden;box-sizing:border-box;` +
           `${last ? '' : 'break-after:page;page-break-after:always;'}">` +
           `<div style="width:${pageW}px;height:${pageH}px;overflow:hidden;box-sizing:border-box;">` +
           (useZoom
             ? `<div style="width:${CARD_W}px;zoom:${k};margin:0 auto;">${html}</div></div></div>`
             : `<div style="width:${CARD_W * k}px;margin:0 auto;"><div style="width:${CARD_W}px;transform:scale(${k});transform-origin:top left;">${html}</div></div></div></div>`);
  });

  probe.remove();
  el.printArea.innerHTML = pages.join('');
  window.print();
};

el.printBtn?.addEventListener('click', () => {
  if (!el.previewPaper?.innerHTML.trim()) {
    showToast('Generate a preview first.', 'warning');
    return;
  }

  if (state.activeTab === 'bulk') {
    showToast(`Sending ${state.bulkCards.length} report cards to printer...`, 'info');
    printPages(state.bulkCards.map(({ html }) => html), false);
  } else if (state.activeTab === 'class') {
    printPages([el.previewPaper.innerHTML], true);
  } else {
    printPages([el.previewPaper.innerHTML], false);
  }
});

/* ══════════════════════════════════════════════════════════
   15. PDF DOWNLOAD
   Report card = always ONE page. Class sheet = landscape, cut
   only between rows and sections, with page numbers.
══════════════════════════════════════════════════════════ */
el.downloadPdfBtn?.addEventListener('click', () => {
  state.activeTab === 'bulk' ? downloadBulkPDF() : generateSinglePDF();
});

const setDownloadLoading = (loading) => {
  if (el.downloadPdfBtn)     el.downloadPdfBtn.disabled          = loading;
  if (el.downloadBtnText)    el.downloadBtnText.style.display    = loading ? 'none'   : 'inline';
  if (el.downloadBtnSpinner) el.downloadBtnSpinner.style.display = loading ? 'inline' : 'none';
};

const PDF_MARGIN = 6;   // mm, on every side

/* ── helpers ──────────────────────────────────────────────── */
const pdfFormat = () => state.paperSize === 'Letter' ? 'letter' : 'a4';

const safeFileText = (t, fallback) =>
  String(t || fallback).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || fallback;

/* Draw html off-screen, measure where a page may be cut, and capture it.
   breaks = y positions (CSS px from the top of the sheet) that are safe to cut at. */
async function captureHTML(html, widthPx, maxScale, isCard = false) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${widthPx}px;background:#fff;z-index:-9999;`;
  /* Cards: fill the page width (same as printing) so the narrow SCORE column fits "620/900" */
  wrap.innerHTML = isCard ? String(html).replace(/max-width:754px/g, 'max-width:none') : html;
  document.body.appendChild(wrap);

  try {
    const root = wrap.firstElementChild;
    const box  = root.getBoundingClientRect();
    const top  = box.top;

    const breaks = [];
    root.querySelectorAll(':scope > *, tr, .keep').forEach(node => {
      if (node.tagName === 'STYLE')                 return;
      if (node.classList.contains('bar'))           return;   // never cut right after a heading
      if (node.closest('thead'))                    return;   // never cut right after the table header
      breaks.push(node.getBoundingClientRect().bottom - top);
    });
    breaks.sort((a, b) => a - b);

    /* sections that must start on a fresh page (class sheet) */
    const starts = [...root.querySelectorAll('.pgstart')]
      .map(node => node.getBoundingClientRect().top - top)
      .sort((a, b) => a - b);

    /* keep very tall sheets under the browser's canvas size limit */
    const scale = Math.min(maxScale, 12000 / Math.max(box.height, 1));

    const canvas = await html2canvas(wrap, {
      scale, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
      logging: false, windowWidth: widthPx, scrollX: 0, scrollY: 0,
      /* html2canvas draws text a little lower than the browser does, so the bottom of
         letters touched the cell border and looked cut off. Give bordered cells and
         value boxes a few extra pixels underneath (capture copy only). */
      onclone: isCard ? (doc) => {
        doc.querySelectorAll('td, th, div').forEach(n => {
          const hasText = [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
          if (!hasText) return;
          const cs = doc.defaultView.getComputedStyle(n);
          n.style.paddingBottom = (parseFloat(cs.paddingBottom) + 5) + 'px';
        });
      } : undefined,
    });

    return { canvas, scale, breaks, starts, cssW: canvas.width / scale, cssH: canvas.height / scale };
  } finally {
    wrap.remove();
  }
}

/* Report card: scale to fit ONE page */
function addCardOnePage(pdf, cap) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const k  = Math.min((pw - 2 * PDF_MARGIN) / cap.cssW, (ph - 2 * PDF_MARGIN) / cap.cssH);
  const w  = cap.cssW * k;
  const h  = cap.cssH * k;
  pdf.addImage(cap.canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (pw - w) / 2, PDF_MARGIN, w, h);
}

/* Where to cut. `starts` are forced page starts (each analysis section begins a new page);
   inside each part, a page is cut at the last safe break (between rows) that fits. */
function planPageCuts(breaks, totalPx, pagePx, starts = []) {
  const marks = [0, ...starts.filter(m => m > 1 && m < totalPx - 1), totalPx];
  const cuts  = [0];

  for (let m = 0; m < marks.length - 1; m++) {
    let y = marks[m];
    const end = marks[m + 1];

    while (end - y > pagePx) {
      const limit = y + pagePx;
      const minY  = y + pagePx * 0.4;                  // avoid tiny pages
      const cut   = breaks.filter(b => b <= limit && b >= minY && b < end).pop() || limit;
      cuts.push(cut);
      y = cut;
    }
    cuts.push(end);
  }
  return cuts;
}

/* Class sheet: many pages, cut between rows and sections only */
function addSheetPaged(pdf, cap) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const usableW = pw - 2 * PDF_MARGIN;
  const usableH = ph - 2 * PDF_MARGIN - 4;           // 4 mm kept for the page number
  const mmPerPx = usableW / cap.cssW;
  const cuts    = planPageCuts(cap.breaks, cap.cssH, usableH / mmPerPx, cap.starts);

  for (let i = 0; i < cuts.length - 1; i++) {
    const y0 = Math.round(cuts[i] * cap.scale);
    const h  = Math.round(cuts[i + 1] * cap.scale) - y0;
    if (h <= 0) continue;

    const slice = document.createElement('canvas');
    slice.width = cap.canvas.width;
    slice.height = h;
    slice.getContext('2d').drawImage(cap.canvas, 0, y0, cap.canvas.width, h, 0, 0, cap.canvas.width, h);

    if (i > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG',
      PDF_MARGIN, PDF_MARGIN, usableW, (h / cap.scale) * mmPerPx);
  }

  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.text(`Page ${p} of ${total}`, pw / 2, ph - 3, { align: 'center' });
  }
}

/* ── Single card / class sheet PDF ────────────────────────── */
async function generateSinglePDF() {
  if (!el.previewPaper?.innerHTML.trim()) {
    showToast('Generate a preview first.', 'warning');
    return;
  }

  setDownloadLoading(true);

  try {
    const isSheet = state.activeTab === 'class';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: isSheet ? 'landscape' : 'portrait',
      unit: 'mm', format: pdfFormat(),
    });

    const cap = await captureHTML(el.previewPaper.innerHTML, isSheet ? 960 : 794, isSheet ? 1.6 : 2, !isSheet);

    if (isSheet) addSheetPaged(pdf, cap);
    else         addCardOnePage(pdf, cap);

    const ctx  = state.context;
    const date = new Date().toISOString().split('T')[0];
    let fn;

    if (state.activeTab === 'individual') {
      const lrn = state.results.find(r => r.studentId === el.rptLearner?.value);
      fn = `Report_Card_${safeFileText(lrn?.fullName, 'Learner')}_T${ctx.term}_${ctx.exam}_${date}.pdf`;
    } else {
      fn = `Class_Results_${safeFileText(ctx.cls, 'Class')}_T${ctx.term}_${ctx.exam}_${date}.pdf`;
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

window.downloadSinglePDF = generateSinglePDF;

/* ── Bulk PDF: one report card per page, all learners in one file ── */
async function downloadBulkPDF() {
  if (!state.bulkCards.length) {
    showToast('Generate bulk preview first.', 'warning');
    return;
  }

  setDownloadLoading(true);
  if (el.bulkProgressBar) el.bulkProgressBar.style.display = 'block';

  try {
    const { jsPDF } = window.jspdf;
    const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: pdfFormat() });
    const total = state.bulkCards.length;

    for (let i = 0; i < total; i++) {
      const { learner, html } = state.bulkCards[i];

      if (el.bulkProgressFill) el.bulkProgressFill.style.width = Math.round(((i + 1) / total) * 100) + '%';
      if (el.bulkProgressText) el.bulkProgressText.textContent = `Generating ${i + 1} of ${total} — ${learner.fullName}`;

      await new Promise(r => setTimeout(r, 20));          // let the progress bar repaint

      const cap = await captureHTML(html, 794, 1.5, true);
      if (i > 0) pdf.addPage();
      addCardOnePage(pdf, cap);
    }

    const ctx  = state.context;
    const date = new Date().toISOString().split('T')[0];
    pdf.save(`All_Report_Cards_${safeFileText(ctx.cls, 'Class')}_T${ctx.term}_${ctx.exam}_${date}.pdf`);
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
  if (el.previewPaper?.innerHTML) el.printBtn?.click();
  else showToast('Regenerate the report first.', 'warning');
};

window.redownloadLast = () => {
  if (el.previewPaper?.innerHTML) {
    state.activeTab === 'bulk' ? downloadBulkPDF() : generateSinglePDF();
  } else showToast('Regenerate the report first.', 'warning');
};

/* ══════════════════════════════════════════════════════════
   17. INIT
══════════════════════════════════════════════════════════ */
switchTab('individual');
renderRecentReports();

hideLegacyControls();

/* Opened from the Results page ("Download Class Sheet"): the link carries the class, term and
   exam, so select them here, load the results and show the class sheet preview. */
async function applyDeepLink() {
  const q = new URLSearchParams(location.search);
  const cls = q.get('cls'), term = q.get('term'), exam = q.get('exam');
  if (!cls || !term || !exam || !el.rptClass || !el.rptTerm || !el.rptExam) return;
  if (![...el.rptClass.options].some(o => o.value === cls)) return;

  try {
    switchTab('class');
    el.rptTerm.value  = term;
    el.rptClass.value = cls;
    state.scope      = isGradeValue(cls) ? 'grade' : 'class';
    state.gradeValue = isGradeValue(cls) ? cls.slice(6) : '';

    await loadExams();
    if (![...el.rptExam.options].some(o => o.value === exam)) return;
    el.rptExam.value = exam;

    await fetchResults();
    try { await schoolLoaded; } catch { /* use what is saved on this device */ }
    el.generatePreviewBtn?.click();
    history.replaceState(null, '', location.pathname);          // so a refresh starts clean
    setTimeout(() => el.previewFrameWrapper?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
  } catch (err) {
    console.error('Could not open the class sheet', err);
  }
}

loadClasses().then(applyDeepLink);
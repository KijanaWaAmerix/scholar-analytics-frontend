/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Reports & PDFs
   File: js/reports.js
   Version: 5.1 — Pixel-perfect CBC report card
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

  SUBJECTS: [
    { code:'ENG',   name:'English',                pathway:'social'   },
    { code:'KIS',   name:'Kiswahili',              pathway:'social'   },
    { code:'MATH',  name:'Mathematics',            pathway:'stem'     },
    { code:'INTER', name:'Integrated Science',     pathway:'stem'     },
    { code:'SST',   name:'Social Studies',         pathway:'social'   },
    { code:'CRE',   name:'Religious Education',    pathway:'social'   },
    { code:'PRT',   name:'Pre Technical',          pathway:'stem'     },
    { code:'AGR',   name:'Agriculture',            pathway:'stem'     },
    { code:'CAS',   name:'Creative Arts & Sports', pathway:'creative' },
  ],

  PATHWAYS: {
    stem    : { name:'STEM',            subjects:'Mathematics · Integrated Science · Pre Technical · Agriculture', col:'#185FA5', bg:'#E6F1FB', border:'#b8d4f0' },
    social  : { name:'Social Sciences', subjects:'English · Kiswahili · Social Studies · Religious Education',    col:'#3B6D11', bg:'#EAF3DE', border:'#b5d98a' },
    creative: { name:'Creative Arts',   subjects:'Creative Arts & Sports',                                        col:'#854F0B', bg:'#FAEEDA', border:'#f0c87a' },
  },

  getGrade(score) {
    if (score === null || score === undefined || score === '') return null;
    return this.SCALE.find(s => Number(score) >= s.min && Number(score) <= s.max) || null;
  },

  computePathways(subjectResults) {
    const acc = {
      stem    : { scores:[], points:0, count:0 },
      social  : { scores:[], points:0, count:0 },
      creative: { scores:[], points:0, count:0 },
    };

    subjectResults.forEach(s => {
      const subj = this.SUBJECTS.find(x => x.code === s.code);
      if (!subj || s.score === null) return;
      const p = acc[subj.pathway];
      p.scores.push(s.score);
      p.points += s.points;
      p.count++;
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
        points : p.points,
        maxPts,
        grade  : gradeInfo?.label   || '--',
        measure: gradeInfo?.measure || '--',
        css    : gradeInfo?.css     || '',
      };
    });
    return out;
  },

  getMeanGrade(totalPoints, count) {
    if (!count) return null;
    const avg = totalPoints / count;
    if (avg >= 7.5) return 'EE1';
    if (avg >= 6.5) return 'EE2';
    if (avg >= 5.5) return 'ME1';
    if (avg >= 4.5) return 'ME2';
    if (avg >= 3.5) return 'AE1';
    if (avg >= 2.5) return 'AE2';
    if (avg >= 1.5) return 'BE1';
    return 'BE2';
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
   2. MOCK DATA
══════════════════════════════════════════════════════════ */
const MOCK_DATA = {
  'Grade 9 East': [
    { id:'g9e1', fullName:'Aisha Kamau',     upiNumber:'8N73K2P1Q4', assessmentNo:'B0012345K', gender:'Female', dateOfBirth:'2011-03-15',
      scores:{ ENG:89, KIS:92, MATH:95, INTER:91, SST:88, CRE:90, PRT:87, AGR:93, CAS:94 },
      initials:{ ENG:'W.N.', KIS:'B.O.', MATH:'J.M.', INTER:'A.K.', SST:'C.L.', CRE:'S.W.', PRT:'P.R.', AGR:'P.R.', CAS:'D.M.' } },
    { id:'g9e2', fullName:'Brian Ochieng',   upiNumber:'2T41R5N7X8', assessmentNo:'B0012346K', gender:'Male',   dateOfBirth:'2011-07-22',
      scores:{ ENG:72, KIS:75, MATH:68, INTER:74, SST:70, CRE:73, PRT:69, AGR:76, CAS:77 },
      initials:{ ENG:'W.N.', KIS:'B.O.', MATH:'J.M.', INTER:'A.K.', SST:'C.L.', CRE:'S.W.', PRT:'P.R.', AGR:'P.R.', CAS:'D.M.' } },
    { id:'g9e3', fullName:'Cynthia Wanjiku', upiNumber:'9V63T3N1Z2', assessmentNo:'B0012347K', gender:'Female', dateOfBirth:'2011-11-08',
      scores:{ ENG:80, KIS:83, MATH:86, INTER:82, SST:79, CRE:81, PRT:84, AGR:78, CAS:85 },
      initials:{ ENG:'W.N.', KIS:'B.O.', MATH:'J.M.', INTER:'A.K.', SST:'C.L.', CRE:'S.W.', PRT:'P.R.', AGR:'P.R.', CAS:'D.M.' } },
    { id:'g9e4', fullName:'David Kipchoge',  upiNumber:'4R28P7L9S2', assessmentNo:'B0012348K', gender:'Male',   dateOfBirth:'2011-05-20',
      scores:{ ENG:45, KIS:50, MATH:38, INTER:42, SST:48, CRE:44, PRT:40, AGR:46, CAS:43 },
      initials:{ ENG:'W.N.', KIS:'B.O.', MATH:'J.M.', INTER:'A.K.', SST:'C.L.', CRE:'S.W.', PRT:'P.R.', AGR:'P.R.', CAS:'D.M.' } },
    { id:'g9e5', fullName:'Eunice Adhiambo', upiNumber:'5Q17N8M3T6', assessmentNo:'B0012349K', gender:'Female', dateOfBirth:'2011-09-12',
      scores:{ ENG:62, KIS:58, MATH:65, INTER:60, SST:64, CRE:59, PRT:67, AGR:61, CAS:63 },
      initials:{ ENG:'W.N.', KIS:'B.O.', MATH:'J.M.', INTER:'A.K.', SST:'C.L.', CRE:'S.W.', PRT:'P.R.', AGR:'P.R.', CAS:'D.M.' } },
  ],
  'Grade 8 East': [
    { id:'g8e1', fullName:'Irene Chebet',    upiNumber:'9V63T3N1Z2', assessmentNo:'B0023448K', gender:'Female', dateOfBirth:'2012-09-25',
      scores:{ ENG:86, KIS:88, MATH:88, INTER:83, SST:87, CRE:82, PRT:79, AGR:84, CAS:86 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
    { id:'g8e2', fullName:'Frank Otieno',    upiNumber:'3K91P7N4W2', assessmentNo:'B0023449K', gender:'Male',   dateOfBirth:'2012-04-14',
      scores:{ ENG:70, KIS:68, MATH:76, INTER:72, SST:69, CRE:71, PRT:74, AGR:67, CAS:73 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
    { id:'g8e3', fullName:'Grace Wambui',    upiNumber:'7X85V1Q8B4', assessmentNo:'B0023450K', gender:'Female', dateOfBirth:'2012-12-03',
      scores:{ ENG:92, KIS:90, MATH:95, INTER:91, SST:89, CRE:93, PRT:88, AGR:90, CAS:94 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
    { id:'g8e4', fullName:'Hassan Abdi',     upiNumber:'1U52S4M8Y9', assessmentNo:'B0023451K', gender:'Male',   dateOfBirth:'2012-06-18',
      scores:{ ENG:55, KIS:60, MATH:48, INTER:52, SST:58, CRE:50, PRT:45, AGR:55, CAS:53 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
  ],
  'Grade 7 East': [
    { id:'g7e1', fullName:'Janet Mwangi',    upiNumber:'6Y96W9R7C5', assessmentNo:'B0034561K', gender:'Female', dateOfBirth:'2013-02-28',
      scores:{ ENG:78, KIS:82, MATH:91, INTER:75, SST:88, CRE:79, PRT:84, AGR:77, CAS:92 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
    { id:'g7e2', fullName:'Kevin Mutua',     upiNumber:'8M74L6K3P1', assessmentNo:'B0034562K', gender:'Male',   dateOfBirth:'2013-08-15',
      scores:{ ENG:65, KIS:70, MATH:60, INTER:68, SST:72, CRE:64, PRT:58, AGR:62, CAS:67 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
    { id:'g7e3', fullName:'Lydia Chelangat', upiNumber:'2N85K7M4Q9', assessmentNo:'B0034563K', gender:'Female', dateOfBirth:'2013-11-22',
      scores:{ ENG:94, KIS:91, MATH:96, INTER:92, SST:90, CRE:93, PRT:89, AGR:91, CAS:95 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
  ],
  'Grade 7 West': [
    { id:'g7w1', fullName:'Michael Baraka',  upiNumber:'3P96L8N5Q2', assessmentNo:'B0034571K', gender:'Male',   dateOfBirth:'2013-04-10',
      scores:{ ENG:75, KIS:78, MATH:82, INTER:76, SST:74, CRE:77, PRT:80, AGR:73, CAS:79 },
      initials:{ ENG:'C.T.', KIS:'C.T.', MATH:'C.T.', INTER:'C.T.', SST:'C.T.', CRE:'C.T.', PRT:'C.T.', AGR:'C.T.', CAS:'C.T.' } },
  ],
  'Grade 8 West': [],
  'Grade 9 West': [],
};

/* ══════════════════════════════════════════════════════════
   3. STATE
══════════════════════════════════════════════════════════ */
const state = {
  activeTab    : 'individual',
  results      : [],
  paperSize    : 'A4',
  recentReports: [],
  context      : {},
  bulkCards    : [],
};
const CURRENT_YEAR = new Date().getFullYear().toString();
/* ══════════════════════════════════════════════════════════
   4. DOM REFS
══════════════════════════════════════════════════════════ */
const el = {
  tabIndividual      : document.getElementById('tabIndividual'),
  tabClass           : document.getElementById('tabClass'),
  tabBulk            : document.getElementById('tabBulk'),
  rptClass           : document.getElementById('rptClass'),
  rptTerm            : document.getElementById('rptTerm'),
  rptExam            : document.getElementById('rptExam'),
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
   5. COMPUTE RESULTS
══════════════════════════════════════════════════════════ */
const computeResults = (learners) => {
  const processed = learners.map(learner => {
    const subjectResults = KJSEA.SUBJECTS.map(s => {
      const score     = learner.scores?.[s.code] ?? null;
      const gradeInfo = KJSEA.getGrade(score);
      return {
        code    : s.code,
        name    : s.name,
        pathway : s.pathway,
        score,
        grade   : gradeInfo?.grade   || '--',
        label   : gradeInfo?.label   || '--',
        measure : gradeInfo?.measure || '--',
        points  : gradeInfo ? gradeInfo.points : 0,
        css     : gradeInfo?.css     || '',
        initials: learner.initials?.[s.code] || 'C.T.',
      };
    });

    const valid       = subjectResults.filter(s => s.score !== null);
    const totalScore  = valid.reduce((a,s) => a + s.score, 0);
    const totalPoints = valid.reduce((a,s) => a + s.points, 0);
    const avgScore    = valid.length
      ? parseFloat((totalScore / valid.length).toFixed(1))
      : 0;

    const meanGradeKey = KJSEA.getMeanGrade(totalPoints, valid.length);
    const meanInfo     = KJSEA.SCALE.find(s => s.grade === meanGradeKey);
    const pathways     = KJSEA.computePathways(subjectResults);

    return {
      ...learner,
      subjectResults,
      totalScore,
      totalPoints,
      avgScore,
      meanGrade  : meanGradeKey      || '--',
      meanLabel  : meanInfo?.label   || '--',
      meanMeasure: meanInfo?.measure || '--',
      meanCss    : meanInfo?.css     || '',
      pathways,
      position   : 0,
    };
  });

  /* Rank by points then total score */
  processed.sort((a,b) =>
    b.totalPoints !== a.totalPoints
      ? b.totalPoints - a.totalPoints
      : b.totalScore  - a.totalScore
  );

  let pos = 1;
  processed.forEach((r,i) => {
    if (i > 0 && r.totalPoints === processed[i-1].totalPoints) {
      r.position = processed[i-1].position;
    } else {
      r.position = pos;
    }
    pos++;
  });

  return processed;
};

/* ══════════════════════════════════════════════════════════
   6. TABS
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

  if (el.previewPlaceholder)  el.previewPlaceholder.style.display  = 'flex';
  if (el.previewFrameWrapper) el.previewFrameWrapper.style.display = 'none';

  state.bulkCards = [];
};

/* ══════════════════════════════════════════════════════════
   7. POPULATE LEARNER DROPDOWN
══════════════════════════════════════════════════════════ */
el.rptClass?.addEventListener('change', () => {
  const cls      = el.rptClass.value;
  const learners = MOCK_DATA[cls] || [];

  if (el.rptLearner) {
    el.rptLearner.innerHTML =
      '<option value="">-- Select Learner --</option>' +
      learners.map(l =>
        `<option value="${l.id}">${l.fullName}</option>`
      ).join('');
  }
});

/* ══════════════════════════════════════════════════════════
   8. PAPER SIZE TOGGLE
══════════════════════════════════════════════════════════ */
document.querySelectorAll('.rpt-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rpt-toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.paperSize = btn.dataset.size;
  });
});

/* ══════════════════════════════════════════════════════════
   9. GENERATE PREVIEW
══════════════════════════════════════════════════════════ */
el.generatePreviewBtn?.addEventListener('click', async () => {
  const cls  = el.rptClass?.value;
  const term = el.rptTerm?.value;
  const exam = el.rptExam?.value;

  if (!cls || !term || !exam) {
    showToast('Please select Class, Term and Exam.', 'warning');
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

  const learners = MOCK_DATA[cls] || [];
  if (!learners.length) {
    showToast('No learners found for this class.', 'error');
    return;
  }

 state.results = computeResults(learners);

  const settings = {
    schoolName  : el.rptSchoolName?.value  || 'Scholar Analytics Demo School',
    schoolMotto : el.rptSchoolMotto?.value || 'Excellence Through Knowledge',
    teacher     : el.rptTeacher?.value     || 'Class Teacher',
    principal   : el.rptPrincipal?.value   || 'The Principal',
    closingDate : el.rptClosingDate?.value || 'To Be Announced',
    nextTerm    : el.rptNextTerm?.value    || 'To Be Announced',
    cls, term, exam,
    year        : CURRENT_YEAR,  // ← was '2024'
  };

  state.context = settings;

  let html = '';

  if (state.activeTab === 'individual') {
    const learner = state.results.find(r => r.id === el.rptLearner?.value);
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
      individual: state.results.find(r => r.id === el.rptLearner?.value)?.fullName || 'Preview',
      class      : `${cls} — ${exam}`,
      bulk       : `All ${state.results.length} Learners — ${cls}`,
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
  [{ v:cls, id:'rptClass'}, {v:term, id:'rptTerm'}, {v:exam, id:'rptExam'}]
    .forEach(({v, id}) => {
      if (!v) {
        const e = document.getElementById(id);
        if (e) { e.style.borderColor='#e74c3c'; setTimeout(()=>e.style.borderColor='',1400); }
      }
    });
};

/* ══════════════════════════════════════════════════════════
   10. BUILD INDIVIDUAL REPORT CARD
       Pixel-perfect match to the uploaded design
══════════════════════════════════════════════════════════ */
const buildReportCard = (r, s) => {

  // TD style helper — borders on every cell for PDF compatibility
  const td = (extra = '') =>
    `padding:5px 8px;background:#ffffff;border-right:1.5px solid #94a3b8;border-bottom:1.5px solid #94a3b8;${extra}`;

  // Map short initials codes to full teacher names
  const initialsMap = {
    'W.N.': 'Wanjiku N.',
    'B.O.': 'Otieno B.',
    'J.M.': 'Mwangi J.',
    'A.K.': 'Kipchoge A.',
    'C.L.': 'Limo C.',
    'S.W.': 'Wambui S.',
    'P.R.': 'Ruto P.',
    'D.M.': 'Mburu D.',
    'C.T.': 'Kemboi D.',
  };
  const getFormattedInitials = (code) => initialsMap[code] || code;

  const subjectRows = r.subjectResults.map((sub, i) => `
    <tr>
      <td style="${td('text-align:center;color:#94a3b8;font-size:10px;font-weight:600;width:4%;')}">${i+1}</td>
      <td style="${td('text-align:left;font-weight:600;font-size:11px;color:#1a2a3a;width:20%;')}">${sub.name}</td>
      <td style="${td('text-align:center;font-weight:700;font-size:11px;color:#0d3349;width:8%;')}">${sub.score !== null ? sub.score + '%' : '—'}</td>
      <td style="${td('text-align:center;width:18%;line-height:1.2;')}">
        <div style="font-size:8.5px;font-weight:600;color:#1a2a3a;margin-bottom:1px;">${sub.label.replace('Expectation','<br>Expectation')}</div>
        <span style="display:inline-block;background:#d0e8f7;color:#0d3349;border-radius:3px;padding:1px 4px;font-size:8px;font-weight:700;">${sub.grade}</span>
      </td>
      <td style="${td('text-align:center;width:8%;font-weight:700;color:#0d3349;font-size:11px;')}">
        ${sub.points}<span style="font-size:8px;color:#94a3b8;font-weight:400;">/8</span>
      </td>
      <td style="${td('text-align:left;font-size:9.5px;font-style:italic;color:#64748b;width:32%;')}">${KJSEA.getSubjectRemark(sub.score)}</td>
      <td style="${td('text-align:center;font-size:10px;font-weight:700;color:#0d3349;width:8%;border-right:none;')}">${getFormattedInitials(sub.initials)}</td>
    </tr>`).join('');

  const pathwayConfig = [
    { key:'stem',     label:'STEM',            subjects:'Mathematics · Integrated Science ·\nPre Technical · Agriculture',  bg:'#dbeafe', border:'#3b82f6', col:'#1d4ed8', pillBg:'#bfdbfe', pillCol:'#1e3a8a' },
    { key:'social',   label:'Social Sciences', subjects:'English · Kiswahili ·\nSocial Studies · Religious Education',      bg:'#dcfce7', border:'#22c55e', col:'#166534', pillBg:'#bbf7d0', pillCol:'#14532d' },
    { key:'creative', label:'Creative Arts',   subjects:'Creative Arts & Sports',                                             bg:'#f3e8ff', border:'#a855f7', col:'#6b21a8', pillBg:'#e9d5ff', pillCol:'#581c87' },
  ];

  const pathwayCells = pathwayConfig.map(({ key, label, subjects, bg, border, col, pillBg, pillCol }, i) => {
    const pw   = r.pathways[key];
    const last = i === pathwayConfig.length - 1;
    return `
      <div style="flex:1;padding:8px 8px;text-align:center;background:${bg};border-top:2px solid ${border};border-bottom:2px solid ${border};border-left:2px solid ${border};${last ? 'border-right:2px solid ' + border + ';' : ''}">
        <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${col};margin-bottom:2px;">${label}</div>
        <div style="font-size:7px;color:${col};opacity:0.75;margin-bottom:5px;line-height:1.4;white-space:pre-line;">${subjects}</div>
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
      { label:'Admission No.',  val: r.upiNumber         },
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
        <th style="padding:5px 8px;text-align:center;font-size:0.56rem;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;border-bottom:1.5px solid rgba(255,255,255,0.20);width:8%;">Initials</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
      <!-- TOTAL ROW -->
      <tr>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);"></td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);font-weight:700;font-size:10.5px;color:#ffffff;text-transform:uppercase;letter-spacing:0.3px;">Total</td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);text-align:center;font-weight:700;font-size:11px;color:#ffffff;">${r.totalScore}/900</td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);text-align:center;line-height:1.2;">
          <div style="font-size:8px;color:rgba(255,255,255,0.60);margin-bottom:2px;">${r.meanLabel}</div>
          <span style="display:inline-block;background:#1d9e75;color:#fff;border-radius:3px;padding:1px 5px;font-size:7.5px;font-weight:700;">${r.meanGrade}</span>
        </td>
        <td style="padding:5px 8px;background:#0d3349;border-right:1.5px solid rgba(255,255,255,0.18);text-align:center;">
          <span style="font-weight:700;color:#4ecb8d;font-size:11px;">${r.totalPoints}</span>
          <span style="font-size:8px;color:rgba(255,255,255,0.40);">/72</span>
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
   11. BUILD CLASS RESULT SHEET
══════════════════════════════════════════════════════════ */
const buildClassSheet = (results, s) => {
  const avg      = (results.reduce((a,r)=>a+r.avgScore,0)/results.length).toFixed(1);
  const highest  = Math.max(...results.map(r=>r.avgScore));
  const topPts   = Math.max(...results.map(r=>r.totalPoints));
  const passed   = results.filter(r=>r.avgScore>=41).length;
  const passRate = ((passed/results.length)*100).toFixed(1);

  const dist = {};
  KJSEA.SCALE.forEach(g => dist[g.grade]=0);
  results.forEach(r => { if(dist[r.meanGrade]!==undefined) dist[r.meanGrade]++; });

  const subjHeaders = KJSEA.SUBJECTS.map(s=>
    `<th style="padding:7px 6px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);" title="${s.name}">${s.code}</th>`
  ).join('');

  const tableRows = results.map((r,i)=>{
    const rowBg     = i%2===0?'#ffffff':'#f8fafc';
    const rankCol   = r.position===1?'#d4a017':r.position===2?'#888':r.position===3?'#cd7f32':'#94a3b8';
    const subjCells = r.subjectResults.map(s=>
      `<td style="padding:7px 6px;text-align:center;border-right:0.5px solid #e2e8f0;font-size:10.5px;">${s.score??'—'}</td>`
    ).join('');
    return `
      <tr style="background:${rowBg};border-bottom:0.5px solid #e2e8f0;">
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:700;color:${rankCol};font-size:11px;">${KJSEA.ordinal(r.position)}</td>
        <td style="padding:7px 10px;text-align:left;border-right:0.5px solid #e2e8f0;font-weight:600;font-size:11.5px;">${r.fullName}</td>
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-family:monospace;font-size:10px;">${r.upiNumber}</td>
        ${subjCells}
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:700;font-size:12px;color:#0d3349;">${r.totalScore}</td>
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-size:11px;">${r.avgScore}%</td>
        <td style="padding:7px 8px;text-align:center;border-right:0.5px solid #e2e8f0;font-weight:800;font-size:12px;color:#0d3349;">${r.totalPoints}/72</td>
        <td style="padding:7px 8px;text-align:center;">
          <span style="display:inline-block;background:#e1f5ee;color:#0f6e56;border-radius:4px;padding:2px 7px;font-size:9px;font-weight:700;">${r.meanGrade}</span>
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
      { val:topPts+'/72',  lbl:'Top KJSEA Points'  },
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
          <th style="padding:8px 8px;text-align:center;font-size:0.58rem;font-weight:700;color:rgba(255,255,255,0.70);text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.08);">Pts/72</th>
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
   12. BULK PREVIEW — All cards stacked
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
   13. PRINT
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
   14. PDF DOWNLOAD
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
      const lrn  = state.results.find(r=>r.id===el.rptLearner?.value);
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
   15. RECENT REPORTS
══════════════════════════════════════════════════════════ */
const addToRecent = (ctx) => {
  const type = state.activeTab;
  const name = type === 'individual'
    ? state.results.find(r => r.id === el.rptLearner?.value)?.fullName || '--'
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
   16. INIT
══════════════════════════════════════════════════════════ */
switchTab('individual');
renderRecentReports();
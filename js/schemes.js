/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Schemes of Work Page
   File: js/schemes.js  Version: 1.0
   Connected to: GET /api/schemes/designs, POST /api/schemes/preview, POST /api/schemes/content
═══════════════════════════════════════════════════════════ */

const user = requireAuth(['admin', 'teacher', 'superadmin']);
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const $ = (id) => document.getElementById(id);

let designs    = [];
let holidays   = [];
let lastResult = null;   /* the scheme on screen: { rows, summary } */
let lessonData = null;   /* written lessons: { lang, labels, map: { 'subId:n': { source, content } } } */
let writing    = false;

/* Text from the server goes into the page as text, never as markup */
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });

const showError = (message) => { $('schError').textContent = message || ''; };

/* ══════════════════════════════════════════════════════════
   LOAD THE DESIGNS
══════════════════════════════════════════════════════════ */
const loadDesigns = async () => {
  const res = await API.get('/schemes/designs');

  if (!res?.ok) {
    $('schDesign').innerHTML = '<option value="">Could not load</option>';
    showError(res?.data?.message || 'Could not load the curriculum designs. Please try again.');
    return;
  }

  designs = res.data.designs || [];

  if (!designs.length) {
    $('schDesign').innerHTML = '<option value="">No designs available</option>';
    return;
  }

  $('schDesign').innerHTML = designs
    .map((d) => `<option value="${esc(d.key)}">Grade ${esc(d.grade)} · ${esc(d.learningArea)}</option>`)
    .join('');

  onDesignChange();
};

const currentDesign = () => designs.find((d) => d.key === $('schDesign').value);

const onDesignChange = () => {
  const design = currentDesign();
  const start  = $('schStart');
  const end    = $('schEnd');

  if (!design) {
    start.disabled = end.disabled = true;
    $('schPerWeek').textContent = '--';
    return;
  }

  const options = design.subStrands
    .map((s) => `<option value="${esc(s.id)}">${esc(s.id)} ${esc(s.name)} (${esc(s.lessons)} lessons)</option>`)
    .join('');

  start.innerHTML = options;
  end.innerHTML   = options;
  start.disabled  = end.disabled = false;

  /* By default the scheme covers the whole design, first topic to last */
  start.selectedIndex = 0;
  end.selectedIndex   = design.subStrands.length - 1;

  $('schPerWeek').textContent =
    `${design.lessonsPerWeek} (${design.lessonMinutes} minutes each)`;

  /* The title follows the chosen design, and can still be edited */
  $('schArea').value  = design.learningArea || '';
  $('schGrade').value = `Grade ${design.grade}`;
};

/* ══════════════════════════════════════════════════════════
   HOLIDAYS
══════════════════════════════════════════════════════════ */
const renderChips = () => {
  $('schChips').innerHTML = holidays
    .map((d) => `
      <span class="sch-chip">${esc(fmtDate(d))}
        <button type="button" data-date="${esc(d)}" aria-label="Remove ${esc(fmtDate(d))}">&times;</button>
      </span>`)
    .join('');
};

const addHoliday = () => {
  const value = $('schHoliday').value;
  if (!value) return;
  if (!holidays.includes(value)) holidays.push(value);
  holidays.sort();
  $('schHoliday').value = '';
  renderChips();
};

/* ══════════════════════════════════════════════════════════
   GENERATE
══════════════════════════════════════════════════════════ */
const validateInputs = () => {
  const needed = [
    ['schTermStart', 'the day the term starts'],
    ['schTermEnd',   'the day the term ends'],
    ['schHtStart',   'the day half term starts'],
    ['schHtEnd',     'the day half term ends'],
  ];
  for (const [id, label] of needed) {
    if (!$(id).value) return `Please enter ${label}.`;
  }

  const ts = $('schTermStart').value, te = $('schTermEnd').value;
  const hs = $('schHtStart').value,   he = $('schHtEnd').value;

  const year = $('schYear').value.trim();
  if (/^\d{4}$/.test(year) && ts.slice(0, 4) !== year) {
    return `The term starts in ${ts.slice(0, 4)}, but the year is ${year}. Please correct the dates or the year.`;
  }
  if (te < ts) return 'The term cannot end before it starts.';
  if (he < hs) return 'Half term cannot end before it starts.';
  if (hs < ts || he > te) return 'Half term must fall inside the term.';
  return '';
};

const generate = async () => {
  showError('');

  const design = currentDesign();
  if (!design) return showError('Please choose the grade and subject.');

  const problem = validateInputs();
  if (problem) return showError(problem);

  const btn = $('schGenerate');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';

  try {
    const res = await API.post('/schemes/preview', {
      designKey     : design.key,
      startSubStrand: $('schStart').value,
      endSubStrand  : $('schEnd').value,
      termStart     : $('schTermStart').value,
      termEnd       : $('schTermEnd').value,
      halfTermStart : $('schHtStart').value,
      halfTermEnd   : $('schHtEnd').value,
      holidays,
    });

    if (!res?.ok) {
      $('schResult').hidden = true;
      return showError(res?.data?.message || 'Could not generate the scheme. Please try again.');
    }

    renderResult(res.data);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate scheme';
  }
};

/* ══════════════════════════════════════════════════════════
   SHOW THE RESULT
══════════════════════════════════════════════════════════ */
const renderResult = ({ summary, rows }) => {
  lastResult = { summary, rows };
  lessonData = null;
  $('schWriteStatus').textContent = '';
  $('schProgress').hidden = true;
  $('schDocNote').hidden = false;
  $('kpiPlaced').textContent = `${summary.lessonsPlaced} of ${summary.lessonsRequired}`;
  $('kpiWeeks').textContent  = summary.weeksUsed;
  $('kpiFits').textContent   = summary.fits ? 'Yes' : 'No';

  const ht = rows.find((r) => r.type === 'HALF_TERM');
  $('kpiHalfTerm').textContent = ht
    ? `${fmtDate(ht.from)} – ${fmtDate(ht.to)}`
    : `${fmtDate($('schHtStart').value)} – ${fmtDate($('schHtEnd').value)}`;

  const short = $('schShortfall');
  if (!summary.fits) {
    short.hidden = false;
    short.textContent =
      `The topics you chose need ${summary.shortBy} more lesson${summary.shortBy === 1 ? '' : 's'} than this term has. ` +
      'Choose an earlier end topic, or check the term dates and holidays.';
  } else {
    short.hidden = true;
  }

  let lastWeek = null;
  $('schBody').innerHTML = rows.map((r) => {
    if (r.type === 'HALF_TERM') {
      return `<tr class="sch-ht"><td colspan="6"><i class="fas fa-umbrella-beach"></i> HALF TERM &nbsp;·&nbsp; ${esc(fmtDate(r.from))} – ${esc(fmtDate(r.to))}</td></tr>`;
    }
    const startOfWeek = r.week !== lastWeek;
    lastWeek = r.week;
    return `<tr class="${startOfWeek ? 'sch-week-start' : ''}">
      <td><strong>${esc(r.week)}</strong></td>
      <td>${esc(r.lessonOfWeek)}</td>
      <td>${esc(r.day)} ${esc(fmtDate(r.date))}</td>
      <td>${esc(r.strand)}</td>
      <td>${esc(r.subStrand)}</td>
      <td>${esc(r.lessonInSubStrand)} of ${esc(r.lessonsInSubStrand)}</td>
    </tr>`;
  }).join('');

  $('schResult').hidden = false;
  $('schResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
};


/* ══════════════════════════════════════════════════════════
   TITLE OF THE DOCUMENT
   School and teacher come from the account; the teacher's name
   and TSC No. are remembered on this device for next time.
══════════════════════════════════════════════════════════ */
const TITLE_KEY = `sa_scheme_title_${user?._id || user?.id || user?.email || 'user'}`;

const readSaved = () => {
  try { return JSON.parse(localStorage.getItem(TITLE_KEY)) || {}; } catch { return {}; }
};
const writeSaved = (data) => {
  try { localStorage.setItem(TITLE_KEY, JSON.stringify(data)); } catch { /* private window: skip */ }
};

const initTitleFields = () => {
  const school = Auth.getSchool() || {};
  const saved  = readSaved();
  const acad   = school.academic || {};

  $('schSchool').value  = saved.school  || school.schoolName || school.name || '';
  $('schTeacher').value = saved.teacher || user.fullName || '';
  $('schTsc').value     = saved.tsc     || '';
  $('schYear').value    = acad.currentYear || school.currentYear || new Date().getFullYear();
  $('schTerm').value    = String(acad.currentTerm || school.currentTerm || 1);

  ['schSchool', 'schTeacher', 'schTsc'].forEach((id) =>
    $(id).addEventListener('change', () =>
      writeSaved({ school: $('schSchool').value.trim(), teacher: $('schTeacher').value.trim(), tsc: $('schTsc').value.trim() })));
};

const readTitle = () => ({
  school : $('schSchool').value.trim(),
  teacher: $('schTeacher').value.trim(),
  tsc    : $('schTsc').value.trim(),
  year   : $('schYear').value.trim(),
  area   : $('schArea').value.trim(),
  grade  : $('schGrade').value.trim(),
  term   : $('schTerm').value,
});

const titleProblem = (t) => {
  if (!t.school)  return 'Please enter the school name.';
  if (!t.teacher) return 'Please enter the name of the teacher.';
  if (!t.area)    return 'Please enter the learning area.';
  if (!t.grade)   return 'Please enter the grade the scheme is used in.';
  if (!/^\d{4}$/.test(t.year)) return 'Please enter the year, for example 2026.';
  return '';
};

/* "8" and "grade 8" both become "Grade 8" */
const gradeLabel = (g) => (/^\d/.test(g) ? `Grade ${g}` : g.replace(/^grade\b/i, 'Grade'));

/* ══════════════════════════════════════════════════════════
   BUILD THE DOCUMENTS
══════════════════════════════════════════════════════════ */
const dateLabel = (r) => `${r.day.charAt(0)}${r.day.slice(1).toLowerCase()} ${fmtDate(r.date)}`;

/* Written content for a row of the scheme, or null */
const lessonFor = (r) => lessonData?.map[`${r.subStrandId}:${r.lessonInSubStrand}`]?.content || null;

const bullets = (items) => (items || []).map((i) => `• ${i}`).join('\n');

const buildSchemeSpec = (t, rows) => {
  const body = [];
  let lastWeek = null;

  rows.forEach((r) => {
    if (r.type === 'HALF_TERM') {
      body.push({ band: `HALF TERM  ·  ${fmtDate(r.from)} – ${fmtDate(r.to)} ${t.year}` });
      return;
    }
    const first = r.week !== lastWeek;
    lastWeek = r.week;
    const c = lessonFor(r);
    body.push([
      first ? String(r.week) : '', String(r.lessonOfWeek), dateLabel(r),
      r.strand, r.subStrand,
      c ? bullets(c.outcomes) : '',
      c ? bullets(c.experiences) : '',
      c ? bullets(c.kiqs) : '',
      c ? bullets(c.resources) : '',
      c ? bullets(c.assessment) : '',
      '',
    ]);
  });

  return {
    orientation: 'landscape',
    title      : 'SCHEME OF WORK',
    subtitle   : `${gradeLabel(t.grade)} ${t.area} – TERM ${t.term} – ${t.year}`.toUpperCase(),
    meta: [
      [['SCHOOL', t.school],        ['LEARNING AREA', t.area]],
      [['TEACHER', t.teacher],      ['GRADE', t.grade]],
      [['TSC NO.', t.tsc],          ['TERM / YEAR', `Term ${t.term} / ${t.year}`]],
    ],
    columns: [
      { header: 'Week',                       width: 4.5 },
      { header: 'Lesson',                     width: 5.8 },
      { header: 'Date',                       width: 7.8 },
      { header: 'Strand',                     width: 9   },
      { header: 'Sub-strand',                 width: 8.5 },
      { header: 'Specific learning outcomes', width: 15 },
      { header: 'Learning experiences',       width: 15.9 },
      { header: 'Key inquiry questions',      width: 9   },
      { header: 'Learning resources',         width: 8   },
      { header: 'Assessment',                 width: 8.5 },
      { header: 'Reflection',                 width: 8   },
    ],
    rows   : body,
    endLine: 'REFLECTION / INSPECTOR:',
  };
};

/* One page for each week */
const buildRecordSpecs = (t, rows) => {
  const weeks = new Map();
  rows.filter((r) => r.type === 'LESSON').forEach((r) => {
    if (!weeks.has(r.week)) weeks.set(r.week, []);
    weeks.get(r.week).push(r);
  });

  return [...weeks.entries()].map(([week, list]) => ({
    orientation: 'portrait',
    title      : 'RECORD OF WORK COVERED',
    subtitle   : `${gradeLabel(t.grade)} ${t.area} – TERM ${t.term} – WEEK ${week}`.toUpperCase(),
    meta: [
      [['SCHOOL', t.school]],
      [['TEACHER', t.teacher],     ['TSC NO.', t.tsc]],
      [['LEARNING AREA', t.area],  ['GRADE / YEAR', `${t.grade} / ${t.year}`]],
    ],
    columns: [
      { header: 'Date',         width: 14 },
      { header: 'Lesson',       width: 10 },
      { header: 'Work covered', width: 42 },
      { header: 'Comments',     width: 21 },
      { header: 'Signature',    width: 13 },
    ],
    rows: list.map((r) => {
      const c = lessonFor(r);
      return [
        dateLabel(r), `Lesson ${r.lessonOfWeek}`,
        c ? `${r.subStrand}: ${c.focus}` : `${r.subStrand}: lesson ${r.lessonInSubStrand} of ${r.lessonsInSubStrand}`,
        '', '',
      ];
    }),
    extra: {
      columns: [
        { header: '',         width: 30 },
        { header: 'Comments', width: 48 },
        { header: 'Signature', width: 22 },
      ],
      rows: [
        ['SUBJECT HEAD', '', ''],
        ['HEAD OF DEPARTMENT', '', ''],
        ["PRINCIPAL'S COMMENT", '', ''],
      ],
    },
  }));
};

/* ══════════════════════════════════════════════════════════
   LESSON PLANS — one page for each lesson. Kiswahili lessons use
   Kiswahili headings; every other subject is English only.
══════════════════════════════════════════════════════════ */
const PLAN_TEXT = {
  en: { school: 'SCHOOL', teacher: 'TEACHER', tsc: 'TSC NO.', area: 'LEARNING AREA', grade: 'GRADE', term: 'TERM / YEAR',
        strand: 'Strand', sub: 'Sub-strand', date: 'Date', lesson: 'Lesson', minutes: 'minutes', head: ['Section', 'Details'] },
  sw: { school: 'SHULE', teacher: 'MWALIMU', tsc: 'NAMBA YA TSC', area: 'SOMO', grade: 'DARAJA', term: 'MUHULA / MWAKA',
        strand: 'Mada', sub: 'Mada ndogo', date: 'Tarehe', lesson: 'Somo', minutes: 'dakika', head: ['Kipengele', 'Maelezo'] },
};

const buildPlanSpecs = (t, rows) => {
  const lang = lessonData.lang;
  const L = lessonData.labels;
  const X = PLAN_TEXT[lang];
  const minutes = currentDesign()?.lessonMinutes || 40;

  return rows.filter((r) => r.type === 'LESSON').map((r) => {
    const c = lessonFor(r);
    const dev = (c?.development || [])
      .map((d) => `${d.title}\n${(d.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`)
      .join('\n\n');

    const body = [
      [X.strand, r.strand],
      [X.sub, `${r.subStrand} (${r.lessonInSubStrand}/${r.lessonsInSubStrand})`],
      [X.date, `${dateLabel(r)} ${t.year}`],
      [L.outcomes, c ? `${L.outcomesLead}\n${bullets(c.outcomes)}` : ''],
      [L.kiq, c ? bullets(c.kiqs) : ''],
      [L.experiences, c ? `${L.experiencesLead}\n${bullets(c.experiences)}` : ''],
      [L.resources, c ? bullets(c.resources) : ''],
      [L.organisation, c ? c.organisation : ''],
      [`${L.introduction} (5 ${X.minutes})`, c ? bullets(c.introduction) : ''],
      [`${L.development} (${minutes - 10} ${X.minutes})`, dev],
      [L.extended, c ? bullets(c.extended) : ''],
      [`${L.conclusion} (5 ${X.minutes})`, c ? bullets(c.conclusion) : ''],
      [L.assessment, c ? bullets(c.assessment) : ''],
      [L.reflection, ''],
    ];

    return {
      orientation: 'portrait',
      title      : L.lessonPlan,
      subtitle   : `${gradeLabel(t.grade)} ${t.area} – ${X.lesson} ${r.lessonNo}`.toUpperCase(),
      meta: [
        [[X.school, t.school]],
        [[X.teacher, t.teacher], [X.tsc, t.tsc]],
        [[X.area, t.area], [X.grade, t.grade]],
        [[X.term, `${t.term} / ${t.year}`]],
      ],
      columns: [
        { header: X.head[0], width: 24 },
        { header: X.head[1], width: 76 },
      ],
      rows: body,
    };
  });
};

/* ══════════════════════════════════════════════════════════
   WRITE THE LESSON CONTENT
   Asked for in steps of up to 5 lessons, so one slow request
   never holds the whole scheme up.
══════════════════════════════════════════════════════════ */
const STEP = 5;

/* { subStrandId: [lesson numbers used by the scheme] } -> list of runs of up to STEP */
const planRequests = (rows) => {
  const bySub = new Map();
  rows.filter((r) => r.type === 'LESSON').forEach((r) => {
    if (!bySub.has(r.subStrandId)) bySub.set(r.subStrandId, new Set());
    bySub.get(r.subStrandId).add(r.lessonInSubStrand);
  });

  const out = [];
  bySub.forEach((set, subStrandId) => {
    const nums = [...set].sort((a, b) => a - b);
    let run = [];
    nums.forEach((n) => {
      if (run.length && (n !== run[run.length - 1] + 1 || run.length === STEP)) {
        out.push({ subStrandId, from: run[0], to: run[run.length - 1] });
        run = [];
      }
      run.push(n);
    });
    if (run.length) out.push({ subStrandId, from: run[0], to: run[run.length - 1] });
  });
  return out;
};

const askContent = async (design, req) => {
  const body = { designKey: design.key, ...req };
  let res = await API.post('/schemes/content', body);
  if (!res?.ok && (!res?.status || res.status >= 500)) {
    res = await API.post('/schemes/content', body);   /* one more try for a slow or sleeping server */
  }
  return res;
};

const writeContent = async () => {
  if (writing || !lastResult) return;
  showError('');
  const design = currentDesign();
  if (!design) return;

  const requests = planRequests(lastResult.rows);
  if (!requests.length) return showError('There are no lessons to write.');

  writing = true;
  const btn = $('schWrite');
  btn.disabled = true;
  $('schProgress').hidden = false;
  $('schProgressBar').style.width = '0%';

  const data = { lang: 'en', labels: null, map: {} };
  let fromAi = 0, fromDesign = 0, stopped = '';

  for (let i = 0; i < requests.length; i += 1) {
    const req = requests[i];
    $('schWriteStatus').textContent = `Writing lessons… ${i + 1} of ${requests.length}`;

    const res = await askContent(design, req);
    if (!res?.ok) {
      stopped = res?.data?.message || 'Could not reach the server.';
      break;
    }

    data.lang = res.data.lang;
    data.labels = res.data.labels;
    res.data.lessons.forEach((l) => {
      data.map[`${req.subStrandId}:${l.lessonNo}`] = { source: l.source, content: l.content };
      if (l.source === 'design') fromDesign += 1; else fromAi += 1;
    });
    $('schProgressBar').style.width = `${Math.round(((i + 1) / requests.length) * 100)}%`;
  }

  writing = false;
  btn.disabled = false;

  if (data.labels) {
    lessonData = data;
    $('schDocNote').hidden = true;
  }

  const total = fromAi + fromDesign;
  if (stopped) {
    $('schWriteStatus').textContent = total ? `Stopped after ${total} lessons.` : '';
    showError(stopped);
  } else if (fromDesign && !fromAi) {
    $('schWriteStatus').textContent = `${total} lessons ready, taken from the curriculum design.`;
    showToast('Lessons were built from the curriculum design.', 'success');
  } else if (fromDesign) {
    $('schWriteStatus').textContent = `${total} lessons ready. ${fromDesign} came from the curriculum design.`;
  } else {
    $('schWriteStatus').textContent = `${total} lessons ready.`;
    showToast('Lesson content is ready.', 'success');
  }
};

/* ══════════════════════════════════════════════════════════
   DOWNLOAD / PRINT
══════════════════════════════════════════════════════════ */
const exportDoc = async (kind, format, button) => {
  showError('');
  if (!lastResult) return showError('Generate the scheme first.');

  const t = readTitle();
  const problem = titleProblem(t);
  if (problem) {
    showError(problem);
    $('schSchool').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const libsReady = window.jspdf?.jsPDF && window.docx;
  if (!libsReady || !window.DocExport) {
    return showError('The download tools did not load. Check your internet connection and refresh the page.');
  }

  if (kind === 'plans' && !lessonData) {
    return showError('Write the lesson content first, then download the lesson plans.');
  }

  const specs = kind === 'scheme' ? [buildSchemeSpec(t, lastResult.rows)]
              : kind === 'plans'  ? buildPlanSpecs(t, lastResult.rows)
              : buildRecordSpecs(t, lastResult.rows);

  if (!specs.length) return showError('There are no lessons to put in this document.');

  const base = [
    kind === 'scheme' ? 'Scheme_of_Work' : kind === 'plans' ? 'Lesson_Plans' : 'Record_of_Work',
    DocExport.safeName(gradeLabel(t.grade)),
    DocExport.safeName(t.area),
    `Term${t.term}`, t.year,
  ].join('_');

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…';

  try {
    await new Promise((r) => setTimeout(r, 30));          /* let the button repaint first */
    if (format === 'pdf')        { DocExport.downloadPdf(specs, base);  showToast('PDF downloaded.', 'success'); }
    else if (format === 'docx')  { await DocExport.downloadDocx(specs, base); showToast('Word file downloaded.', 'success'); }
    else                         { DocExport.printPdf(specs); }
  } catch (err) {
    console.error(err);
    showError('Could not create the file. Please try again.');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
};

/* ══════════════════════════════════════════════════════════
   WIRE UP
══════════════════════════════════════════════════════════ */
$('schDesign').addEventListener('change', onDesignChange);
$('schAddHoliday').addEventListener('click', addHoliday);
$('schHoliday').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addHoliday(); } });
$('schChips').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-date]');
  if (!btn) return;
  holidays = holidays.filter((d) => d !== btn.dataset.date);
  renderChips();
});
$('schGenerate').addEventListener('click', generate);
$('schWrite').addEventListener('click', writeContent);
document.querySelector('.sch-downloads').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-doc]');
  if (btn) exportDoc(btn.dataset.doc, btn.dataset.fmt, btn);
});

initTitleFields();
loadDesigns();

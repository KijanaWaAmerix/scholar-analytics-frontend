/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Schemes of Work Page
   File: js/schemes.js  Version: 1.0
   Connected to: GET /api/schemes/designs, POST /api/schemes/preview
═══════════════════════════════════════════════════════════ */

const user = requireAuth(['admin', 'teacher', 'superadmin']);
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const $ = (id) => document.getElementById(id);

let designs    = [];
let holidays   = [];
let lastResult = null;   /* the scheme on screen: { rows, summary } */

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
    /* The last five columns (outcomes ... reflection) are filled in by the lesson content step */
    body.push([
      first ? String(r.week) : '', String(r.lessonOfWeek), dateLabel(r),
      r.strand, r.subStrand, '', '', '', '', '', '',
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
    rows: list.map((r) => [
      dateLabel(r), `Lesson ${r.lessonOfWeek}`,
      `${r.subStrand}: lesson ${r.lessonInSubStrand} of ${r.lessonsInSubStrand}`, '', '',
    ]),
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

  const specs = kind === 'scheme'
    ? [buildSchemeSpec(t, lastResult.rows)]
    : buildRecordSpecs(t, lastResult.rows);

  if (!specs.length) return showError('There are no lessons to put in this document.');

  const base = [
    kind === 'scheme' ? 'Scheme_of_Work' : 'Record_of_Work',
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
document.querySelector('.sch-downloads').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-doc]');
  if (btn) exportDoc(btn.dataset.doc, btn.dataset.fmt, btn);
});

initTitleFields();
loadDesigns();

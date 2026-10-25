/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Schemes of Work Page
   File: js/schemes.js  Version: 1.0
   Connected to: GET /api/schemes/designs, POST /api/schemes/preview
═══════════════════════════════════════════════════════════ */

const user = requireAuth(['admin', 'teacher', 'superadmin']);
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const $ = (id) => document.getElementById(id);

let designs  = [];
let holidays = [];

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

loadDesigns();

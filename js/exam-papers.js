/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Exam Papers Page
   File: js/exam-papers.js  Version: 1.0
   Connected to: GET /api/schemes/designs,
                 POST /api/papers/plan, /api/papers/part, /api/papers/bands
═══════════════════════════════════════════════════════════ */

const user = requireAuth(['admin', 'teacher', 'superadmin']);
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const $ = (id) => document.getElementById(id);

let designs = [];
let paper   = null;   /* { design, mcq:[], structured:[], totals, bands, short } */
let writing = false;

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const showError = (message) => { $('epError').textContent = message || ''; };
const currentDesign = () => designs.find((d) => d.key === $('epDesign').value);
const gradeLabel = (g) => (/^\d/.test(String(g)) ? `Grade ${g}` : String(g).replace(/^grade\b/i, 'Grade'));
const LETTERS = ['A', 'B', 'C', 'D'];

/* ── Remember school on this device ───────────────────────── */
const SAVE_KEY = `sa_paper_title_${user?._id || user?.id || user?.email || 'user'}`;
const readSaved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } };
const writeSaved = (d) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* skip */ } };

const initFields = () => {
  const school = Auth.getSchool() || {};
  const saved  = readSaved();
  const acad   = school.academic || {};
  $('epSchool').value = saved.school || school.schoolName || school.name || '';
  if (saved.time)  $('epTime').value  = saved.time;
  if (saved.title) $('epTitle').value = saved.title;
  $('epYear').value = acad.currentYear || school.currentYear || new Date().getFullYear();
  $('epTerm').value = String(acad.currentTerm || school.currentTerm || 1);
  ['epSchool', 'epTime', 'epTitle'].forEach((id) =>
    $(id).addEventListener('change', () =>
      writeSaved({ school: $('epSchool').value.trim(), time: $('epTime').value.trim(), title: $('epTitle').value.trim() })));
};

/* ── Designs and topics ───────────────────────────────────── */
const loadDesigns = async () => {
  const res = await API.get('/schemes/designs');
  if (!res?.ok) {
    $('epDesign').innerHTML = '<option value="">Could not load</option>';
    return showError(res?.data?.message || 'Could not load the curriculum designs. Please try again.');
  }
  designs = res.data.designs || [];
  if (!designs.length) { $('epDesign').innerHTML = '<option value="">No designs available</option>'; return; }
  $('epDesign').innerHTML = designs
    .map((d) => `<option value="${esc(d.key)}">Grade ${esc(d.grade)} · ${esc(d.learningArea)}</option>`)
    .join('');
  renderTopics();
};

const renderTopics = () => {
  const design = currentDesign();
  if (!design) { $('epTopics').innerHTML = ''; return; }
  let strand = null;
  $('epTopics').innerHTML = design.subStrands.map((s) => {
    const head = s.strandId !== strand ? `<div class="ep-strand">${esc(s.strand)}</div>` : '';
    strand = s.strandId;
    return `${head}<label class="ep-topic"><input type="checkbox" value="${esc(s.id)}"/>
      <span>${esc(s.id)} ${esc(s.name)}<small>${esc(s.lessons)} lessons</small></span></label>`;
  }).join('');
};

const chosen = () => [...$('epTopics').querySelectorAll('input:checked')].map((i) => i.value);

/* ── Write the paper ──────────────────────────────────────── */
const readTitle = () => ({
  school: $('epSchool').value.trim(),
  title : $('epTitle').value.trim() || 'EXAMINATION',
  time  : $('epTime').value.trim(),
  term  : $('epTerm').value,
  year  : $('epYear').value.trim(),
});

const write = async () => {
  if (writing) return;
  showError('');
  const design = currentDesign();
  const t = readTitle();
  const subs = chosen();
  const mcq = Number($('epMcq').value);
  const structured = Number($('epStr').value);

  if (!design) return showError('Please choose the learning area and grade.');
  if (!t.school) return showError('Please enter the school name.');
  if (!/^\d{4}$/.test(t.year)) return showError('Please enter the year, for example 2026.');
  if (!subs.length) return showError('Choose at least one topic.');
  if (subs.length > 8) return showError('Choose at most 8 topics.');
  if (!Number.isInteger(mcq) || mcq < 0 || mcq > 60) return showError('Multiple choice questions must be from 0 to 60.');
  if (!Number.isInteger(structured) || structured < 0 || structured > 20) return showError('Structured questions must be from 0 to 20.');
  if (mcq + structured < 1) return showError('Ask for at least one question.');

  writing = true;
  const btn = $('epWrite');
  btn.disabled = true;
  $('epProgress').hidden = false;
  $('epProgressBar').style.width = '0%';
  $('epStatus').textContent = 'Planning the paper…';

  const finish = () => { writing = false; btn.disabled = false; };

  try {
    const plan = await API.post('/papers/plan', { designKey: design.key, subStrandIds: subs, mcq, structured });
    if (!plan?.ok) return showError(plan?.data?.message || 'Could not plan the paper. Please try again.');

    const parts = plan.data.parts.filter((p) => p.mcq + p.structured > 0);
    const got = { mcq: [], structured: [], short: { mcq: 0, structured: 0 }, saved: 0, aiError: '' };

    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      $('epStatus').textContent = `Writing questions… ${i + 1} of ${parts.length} (${p.subStrand})`;
      const body = { designKey: design.key, subStrandId: p.subStrandId, mcq: p.mcq, structured: p.structured, source: $('epSource').value };
      let res = await API.post('/papers/part', body);
      if (!res?.ok && (!res?.status || res.status >= 500)) res = await API.post('/papers/part', body);

      if (!res?.ok) {
        showError(res?.data?.message || 'Could not write the questions. Please try again.');
        if (!got.mcq.length && !got.structured.length) return;
        got.short.mcq += p.mcq; got.short.structured += p.structured;
        break;
      }
      got.mcq.push(...res.data.mcq);
      got.structured.push(...res.data.structured);
      got.short.mcq += res.data.short.mcq;
      got.short.structured += res.data.short.structured;
      got.saved += res.data.saved || 0;
      got.aiError = res.data.aiError || got.aiError;
      $('epProgressBar').style.width = `${Math.round(((i + 1) / parts.length) * 100)}%`;
    }

    const total = got.mcq.length + got.structured.reduce((n, q) => n + q.marks, 0);
    if (!total) {
      return showError($('epSource').value === 'notes'
        ? 'The notes for these topics have too few definitions or lists to make questions from. Choose Notes + AI, or pick other sub-strands.'
        : `No questions could be written${got.aiError ? ` (${got.aiError})` : ''}. Please try again, or choose Notes only.`);
    }

    const bands = await API.post('/papers/bands', { total });
    paper = { design, t, ...got, total, bands: bands?.ok ? bands.data.bands : [] };
    $('epStatus').textContent = '';
    render();
  } finally {
    finish();
  }
};

/* ── Show it ──────────────────────────────────────────────── */
const sectionMarks = () => ({
  a: paper.mcq.length,
  b: paper.structured.reduce((n, q) => n + q.marks, 0),
});

const render = () => {
  const m = sectionMarks();
  const rows = [];
  const side = $('epShowAnswers') ? $('epShowAnswers').checked : true;   /* answers beside each question, for the teacher */
  const cols = side ? 3 : 2;
  const cell = (html) => (side ? `<td style="width:34%;white-space:pre-line;background:#f3f8f3;font-size:.92em">${html}</td>` : '');
  if (paper.mcq.length) {
    rows.push(`<tr><th colspan="${cols}">SECTION A: MULTIPLE CHOICE (${m.a} MARKS)</th></tr>`);
    paper.mcq.forEach((q, i) => rows.push(
      `<tr><td style="width:6%"><strong>${i + 1}</strong></td><td style="white-space:pre-line">${esc(q.question)}\n${
        q.options.map((o, k) => `${LETTERS[k]}. ${esc(o)}`).join('\n')}</td>${
        cell(`<strong>${esc(q.answer)}.</strong> ${esc(q.options[LETTERS.indexOf(q.answer)] || '')}${q.explanation ? `\n<em>${esc(q.explanation)}</em>` : ''}`)}</tr>`));
  }
  if (paper.structured.length) {
    rows.push(`<tr><th colspan="${cols}">SECTION B: STRUCTURED QUESTIONS (${m.b} MARKS)</th></tr>`);
    paper.structured.forEach((q, i) => rows.push(
      `<tr><td style="width:6%"><strong>${paper.mcq.length + i + 1}</strong></td><td style="white-space:pre-line">${esc(structuredText(q, false))}</td>${
        cell(q.parts.map((p, k) => `${q.parts.length > 1 ? `${letter(k)} ` : ''}${p.answer.map((x) => `• ${esc(x)}`).join('\n')}`).join('\n'))}</tr>`));
  }
  $('epPreview').innerHTML = rows.join('');
  $('epPaperInfo').textContent = `${paper.total} marks · ${paper.mcq.length} multiple choice, ${paper.structured.length} structured`;

  const warn = $('epWarn');
  const short = paper.short;
  const fromSaved = paper.saved ? `${paper.saved} question${paper.saved === 1 ? ' was' : 's were'} taken from your saved questions${paper.aiError ? ' because Gemini was not available' : ''}. ` : '';
  if (short.mcq || short.structured) {
    warn.hidden = false;
    warn.textContent = `${fromSaved}${short.mcq + short.structured} question${short.mcq + short.structured === 1 ? '' : 's'} could not be found. Write the paper again, or ask for fewer questions.`;
  } else if (fromSaved) {
    warn.hidden = false;
    warn.textContent = fromSaved;
  } else {
    warn.hidden = true;
  }
  $('epResult').hidden = false;
  $('epResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ── Documents ────────────────────────────────────────────── */
const letter = (i) => `(${String.fromCharCode(97 + i)})`;

/* Text of a structured question. withLines adds answer lines for the learner; withAnswers adds the marking points */
const structuredText = (q, withLines, withAnswers) => {
  const out = [];
  if (q.intro) out.push(q.intro);
  q.parts.forEach((p, i) => {
    const label = q.parts.length > 1 ? `${letter(i)} ` : '';
    out.push(`${label}${p.text}  (${p.marks} mark${p.marks === 1 ? '' : 's'})`);
    if (withAnswers) out.push(p.answer.map((a) => `• ${a}`).join('\n'));
    if (withLines) out.push(Array.from({ length: Math.max(1, p.marks) }, () => '_'.repeat(58)).join('\n'));
  });
  return out.join('\n');
};

const metaBase = (t, d) => ([
  [['SCHOOL', t.school]],
  [['LEARNING AREA', d.learningArea], ['GRADE', gradeLabel(d.grade)]],
]);

const bandsText = () =>
  (paper.bands || []).map((b) => `${b.grade} ${b.from}-${b.to}`).join('   ');

const buildPaperSpec = () => {
  const { t, design: d } = paper;
  const m = sectionMarks();
  const rows = [];
  if (paper.mcq.length) {
    rows.push({ band: `SECTION A: MULTIPLE CHOICE – ${m.a} MARKS` });
    paper.mcq.forEach((q, i) => rows.push([
      String(i + 1),
      `${q.question}\n${q.options.map((o, k) => `${LETTERS[k]}.  ${o}`).join('\n')}`,
      '1',
    ]));
  }
  if (paper.structured.length) {
    rows.push({ band: `SECTION B: STRUCTURED QUESTIONS – ${m.b} MARKS` });
    paper.structured.forEach((q, i) => rows.push([
      String(paper.mcq.length + i + 1), structuredText(q, true), String(q.marks),
    ]));
  }
  return {
    orientation: 'portrait',
    title      : t.title.toUpperCase(),
    subtitle   : `${gradeLabel(d.grade)} ${d.learningArea} – TERM ${t.term} – ${t.year}`.toUpperCase(),
    meta: [
      ...metaBase(t, d),
      [['NAME', ''], ['ADM NO.', '']],
      [['TIME', t.time], ['TOTAL MARKS', String(paper.total)]],
      ...(bandsText() ? [[['MARKS BANDS', bandsText()]]] : []),
    ],
    columns: [
      { header: 'No.',      width: 7 },
      { header: 'Question', width: 83 },
      { header: 'Marks',    width: 10 },
    ],
    rows,
    endLine: 'END OF PAPER',
  };
};

const buildSchemeSpec = () => {
  const { t, design: d } = paper;
  const m = sectionMarks();
  const rows = [];
  if (paper.mcq.length) {
    rows.push({ band: `SECTION A: MULTIPLE CHOICE – ${m.a} MARKS` });
    paper.mcq.forEach((q, i) => rows.push([
      String(i + 1),
      `${q.answer}. ${q.options[LETTERS.indexOf(q.answer)]}${q.explanation ? `\n${q.explanation}` : ''}`,
      '1',
    ]));
  }
  if (paper.structured.length) {
    rows.push({ band: `SECTION B: STRUCTURED QUESTIONS – ${m.b} MARKS` });
    paper.structured.forEach((q, i) => rows.push([
      String(paper.mcq.length + i + 1), structuredText(q, false, true), String(q.marks),
    ]));
  }
  return {
    orientation: 'portrait',
    title      : 'MARKING SCHEME',
    subtitle   : `${t.title} – ${gradeLabel(d.grade)} ${d.learningArea} – TERM ${t.term} – ${t.year}`.toUpperCase(),
    meta: [
      ...metaBase(t, d),
      [['TOTAL MARKS', String(paper.total)]],
    ],
    columns: [
      { header: 'No.',    width: 7 },
      { header: 'Answer', width: 83 },
      { header: 'Marks',  width: 10 },
    ],
    rows,
  };
};

const exportDoc = async (kind, format, button) => {
  showError('');
  if (!paper) return showError('Write the paper first.');
  if (!(window.jspdf?.jsPDF && window.docx && window.DocExport)) {
    return showError('The download tools did not load. Check your internet connection and refresh the page.');
  }
  const specs = kind === 'paper' ? [buildPaperSpec()] : kind === 'scheme' ? [buildSchemeSpec()] : [buildPaperSpec(), buildSchemeSpec()];
  const { design: d, t } = paper;
  const base = [kind === 'paper' ? 'Exam_Paper' : kind === 'scheme' ? 'Marking_Scheme' : 'Exam_With_Answers',
    DocExport.safeName(gradeLabel(d.grade)), DocExport.safeName(d.learningArea), `Term${t.term}`, t.year].join('_');

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…';
  try {
    await new Promise((r) => setTimeout(r, 30));
    if (format === 'pdf')       { DocExport.downloadPdf(specs, base); showToast('PDF downloaded.', 'success'); }
    else if (format === 'docx') { await DocExport.downloadDocx(specs, base); showToast('Word file downloaded.', 'success'); }
    else                        { DocExport.printPdf(specs); }
  } catch (err) {
    console.error(err);
    showError('Could not create the file. Please try again.');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
};

/* ── Wire up ──────────────────────────────────────────────── */
$('epDesign').addEventListener('change', renderTopics);
if ($('epShowAnswers')) $('epShowAnswers').addEventListener('change', () => { if (paper) render(); });
$('epAll').addEventListener('click', () => {
  const boxes = [...$('epTopics').querySelectorAll('input')];
  boxes.forEach((b, i) => { b.checked = i < 8; });
  if (boxes.length > 8) showError('Only the first 8 topics were selected. A paper can cover up to 8.');
});
$('epNone').addEventListener('click', () => $('epTopics').querySelectorAll('input').forEach((b) => { b.checked = false; }));
$('epWrite').addEventListener('click', write);
document.querySelector('.sch-downloads').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-doc]');
  if (btn) exportDoc(btn.dataset.doc, btn.dataset.fmt, btn);
});

initFields();
loadDesigns();

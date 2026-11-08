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
  const grades = [...new Set(designs.map((d) => String(d.grade)))].sort((a, b) => Number(a) - Number(b));
  $('epPickGrade').innerHTML = grades.map((g) => `<option value="${esc(g)}">Grade ${esc(g)}</option>`).join('');
  fillAreas();
  renderTopics();
};

/* Only the learning areas of the chosen grade */
const fillAreas = () => {
  const grade = $('epPickGrade').value;
  $('epDesign').innerHTML = designs
    .filter((d) => String(d.grade) === grade)
    .map((d) => `<option value="${esc(d.key)}">${esc(d.learningArea)}</option>`)
    .join('');
};

const renderTopics = () => {
  const design = currentDesign();
  if (!design) { $('epTopics').innerHTML = ''; return; }
  let strand = null;
  $('epTopics').innerHTML = design.subStrands.map((s) => {
    const head = s.strandId !== strand ? `<div class="ep-strand">${esc(s.strand)}</div>` : '';
    strand = s.strandId;
    return `${head}<label class="ep-topic"><input type="checkbox" value="${esc(s.id)}"/>
      <span>${esc(s.id)} ${esc(s.name)}<small>${esc(s.lessons)} lessons<span data-bank="${esc(s.id)}"></span></small></span></label>`;
  }).join('');
  loadBankStats();
};

/* How many questions the bank holds for each topic */
let bankCounts = {};
const showBankCounts = () => {
  $('epTopics').querySelectorAll('[data-bank]').forEach((el) => {
    const c = bankCounts[el.dataset.bank];
    el.textContent = c ? ` · bank: ${c.mcq} multiple choice, ${c.structured} structured` : '';
  });
};
const loadBankStats = async () => {
  const design = currentDesign();
  bankCounts = {};
  if (!design) return;
  const res = await API.post('/papers/bank/stats', { designKey: design.key });
  if (res?.ok && currentDesign()?.key === design.key) { bankCounts = res.data.counts || {}; showBankCounts(); }
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
  if (!Number.isInteger(mcq) || mcq < 0) return showError('Multiple choice questions must be a whole number, 0 or more.');
  if (!Number.isInteger(structured) || structured < 0) return showError('Structured questions must be a whole number, 0 or more.');
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
      const body = { designKey: design.key, subStrandId: p.subStrandId, mcq: p.mcq, structured: p.structured };
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
      return showError('There are no saved questions and too few definitions in the notes for these topics. Ask the admin to add questions to the bank, or pick other topics.');
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

/* Admin only: take a bad question out of the bank for good */
const removeBtn = (kind, i) => (Auth.isAdmin() && paper[kind][i].source === 'saved' && side()
  ? `<button type="button" class="btn btn-secondary btn-sm" data-remove="${kind}:${i}" title="Delete this question from the bank">Remove from bank</button>\n` : '');
const side = () => ($('epShowAnswers') ? $('epShowAnswers').checked : true);

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
        cell(`${removeBtn('mcq', i)}<strong>${esc(q.answer)}.</strong> ${esc(q.options[LETTERS.indexOf(q.answer)] || '')}${q.explanation ? `\n<em>${esc(q.explanation)}</em>` : ''}`)}</tr>`));
  }
  if (paper.structured.length) {
    rows.push(`<tr><th colspan="${cols}">SECTION B: STRUCTURED QUESTIONS (${m.b} MARKS)</th></tr>`);
    paper.structured.forEach((q, i) => rows.push(
      `<tr><td style="width:6%"><strong>${paper.mcq.length + i + 1}</strong></td><td style="white-space:pre-line">${esc(structuredText(q, false))}</td>${
        cell(removeBtn('structured', i) + q.parts.map((p, k) => `${q.parts.length > 1 ? `${letter(k)} ` : ''}${p.answer.map((x) => `• ${esc(x)}`).join('\n')}`).join('\n'))}</tr>`));
  }
  $('epPreview').innerHTML = rows.join('');
  $('epPaperInfo').textContent = `${paper.total} marks · ${paper.mcq.length} multiple choice, ${paper.structured.length} structured`;

  const warn = $('epWarn');
  const short = paper.short;
  const nNotes = [...paper.mcq, ...paper.structured].filter((q) => q.source === 'notes').length;
  const fromSaved = nNotes ? `${nNotes} question${nNotes === 1 ? ' was' : 's were'} made straight from the notes because the bank has too few for ${nNotes === 1 ? 'that topic' : 'those topics'}. ` : '';
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
      [['SCHOOL', t.school]],
      [['LEARNING AREA', d.learningArea]],
      [['NAME', ''], ['GRADE', '']],          /* left empty for the learner to fill in */
      [['ADM NO.', ''], ['DATE', '']],
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
$('epPickGrade').addEventListener('change', () => { fillAreas(); renderTopics(); });
if ($('epShowAnswers')) $('epShowAnswers').addEventListener('change', () => { if (paper) render(); });
$('epAll').addEventListener('click', () => {
  const boxes = [...$('epTopics').querySelectorAll('input')];
  boxes.forEach((b) => { b.checked = true; });
});
$('epNone').addEventListener('click', () => $('epTopics').querySelectorAll('input').forEach((b) => { b.checked = false; }));
$('epWrite').addEventListener('click', write);
$('epPreview').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-remove]');
  if (!b || !paper) return;
  const [kind, idx] = b.dataset.remove.split(':');
  const q = paper[kind][Number(idx)];
  if (!q || !window.confirm('Delete this question from the bank for good?')) return;
  b.disabled = true;
  const res = await API.post('/papers/bank/remove', {
    designKey: paper.design.key, subStrandId: q.subStrandId, kind,
    text: kind === 'mcq' ? q.question : q.parts[0].text,
  });
  if (!res?.ok) { b.disabled = false; return showError(res?.data?.message || 'Could not remove the question.'); }
  paper[kind].splice(Number(idx), 1);
  paper.total = paper.mcq.length + paper.structured.reduce((n, x) => n + x.marks, 0);
  if (!paper.total) { $('epResult').hidden = true; paper = null; return; }
  const bands = await API.post('/papers/bands', { total: paper.total });
  paper.bands = bands?.ok ? bands.data.bands : [];
  render();
  loadBankStats();
});

/* Admin: Gemini adds questions to the bank, one topic at a time */
let filling = false;
const fillBank = async () => {
  if (filling) return;
  const design = currentDesign();
  if (!design) return;
  if (!window.confirm(`Gemini will write new questions for all ${design.subStrands.length} topics of ${design.learningArea}. This uses Gemini credit. Continue?`)) return;
  filling = true;
  $('epFill').disabled = true;
  $('epFillProgress').hidden = false;
  let added = 0; let skipped = 0; let failed = 0;
  const subs = design.subStrands;
  for (let i = 0; i < subs.length; i += 1) {
    $('epFillStatus').textContent = `Writing questions… ${i + 1} of ${subs.length} (${subs[i].name})`;
    const body = { designKey: design.key, subStrandId: subs[i].id, mcq: 12, structured: 4 };
    let res = await API.post('/papers/bank/fill', body);
    if (!res?.ok && (!res?.status || res.status >= 500)) res = await API.post('/papers/bank/fill', body);
    if (!res?.ok) {
      failed += 1;
      if (res?.status === 503 || res?.status === 403 || res?.status === 429) { $('epFillStatus').textContent = res?.data?.message || 'Stopped.'; break; }
    } else if (res.data.skipped) skipped += 1;
    else added += res.data.added.mcq + res.data.added.structured;
    $('epFillBar').style.width = `${Math.round(((i + 1) / subs.length) * 100)}%`;
  }
  if (failed < subs.length) {
    $('epFillStatus').textContent = `Done: ${added} new questions saved${skipped ? `; ${skipped} topic${skipped === 1 ? ' has' : 's have'} no notes yet` : ''}${failed ? `; ${failed} topic${failed === 1 ? '' : 's'} failed, press again to retry` : ''}.`;
  }
  filling = false;
  $('epFill').disabled = false;
  loadBankStats();
};
if (Auth.isAdmin()) { $('epBankCard').hidden = false; $('epFill').addEventListener('click', fillBank); }
document.querySelector('.sch-downloads').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-doc]');
  if (btn) exportDoc(btn.dataset.doc, btn.dataset.fmt, btn);
});

initFields();
loadDesigns();

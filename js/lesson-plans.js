/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Lesson Plan Page (one lesson)
   File: js/lesson-plans.js  Version: 1.0
   Connected to: GET /api/schemes/designs, POST /api/schemes/content
═══════════════════════════════════════════════════════════ */

const user = requireAuth(['admin', 'teacher', 'superadmin']);
if (!user) throw new Error('Not authenticated');
initSidebar(user);

const $ = (id) => document.getElementById(id);

let designs = [];
let current = null;   /* { lang, labels, lesson: { lessonNo, source, content }, fields } */

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const showError = (message) => { $('lpError').textContent = message || ''; };

const currentDesign = () => designs.find((d) => d.key === $('lpDesign').value);

/* "8" and "grade 8" both become "Grade 8" */
const gradeLabel = (g) => (/^\d/.test(String(g)) ? `Grade ${g}` : String(g).replace(/^grade\b/i, 'Grade'));

/* ── Remember school and teacher on this device ───────────── */
const SAVE_KEY = `sa_plan_title_${user?._id || user?.id || user?.email || 'user'}`;
const readSaved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } };
const writeSaved = (d) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* skip */ } };

const initFields = () => {
  const school = Auth.getSchool() || {};
  const saved  = readSaved();
  $('lpSchool').value  = saved.school  || school.schoolName || school.name || '';
  $('lpTeacher').value = saved.teacher || user.fullName || '';
  if (saved.time) $('lpTime').value = saved.time;
  ['lpSchool', 'lpTeacher', 'lpTime'].forEach((id) =>
    $(id).addEventListener('change', () =>
      writeSaved({ school: $('lpSchool').value.trim(), teacher: $('lpTeacher').value.trim(), time: $('lpTime').value.trim() })));
};

/* ── Designs, sub-strands and lessons ─────────────────────── */
const loadDesigns = async () => {
  const res = await API.get('/schemes/designs');
  if (!res?.ok) {
    $('lpDesign').innerHTML = '<option value="">Could not load</option>';
    return showError(res?.data?.message || 'Could not load the curriculum designs. Please try again.');
  }
  designs = res.data.designs || [];
  if (!designs.length) {
    $('lpDesign').innerHTML = '<option value="">No designs available</option>';
    return;
  }
  const grades = [...new Set(designs.map((d) => String(d.grade)))].sort((a, b) => Number(a) - Number(b));
  $('lpPickGrade').innerHTML = grades.map((g) => `<option value="${esc(g)}">Grade ${esc(g)}</option>`).join('');
  fillSubjects();
  onDesignChange();
};

/* Only the subjects of the chosen grade */
const fillSubjects = () => {
  const grade = $('lpPickGrade').value;
  $('lpDesign').innerHTML = designs
    .filter((d) => String(d.grade) === grade)
    .map((d) => `<option value="${esc(d.key)}">${esc(d.learningArea)}</option>`)
    .join('');
};

const currentSub = () => currentDesign()?.subStrands.find((s) => s.id === $('lpSub').value);

const onDesignChange = () => {
  const design = currentDesign();
  const sub = $('lpSub');
  if (!design) { sub.disabled = true; return; }
  sub.innerHTML = design.subStrands
    .map((s) => `<option value="${esc(s.id)}">${esc(s.id)} ${esc(s.name)}</option>`)
    .join('');
  sub.disabled = false;
  onSubChange();
};

/* The topics of the chosen sub-strand. No lesson numbers: the teacher picks what is to be taught,
   because a class seldom gets all the suggested lessons. */
let topicGroups = [];
const onSubChange = () => {
  const s = currentSub();
  const sel = $('lpLesson');
  topicGroups = [];
  if (!s) { sel.disabled = true; return; }
  $('lpStrand').value = s.strand;
  sel.innerHTML = '<option value="0">Loading the topics…</option>';
  sel.disabled = true;
  loadTopics(s);
};

let labelToken = 0;
const loadTopics = async (s) => {
  const token = ++labelToken;
  const design = currentDesign();
  const sel = $('lpLesson');
  if (!design) return;
  let groups = [];
  try {
    const res = await API.post('/schemes/topics', { designKey: design.key, subStrandId: s.id });
    if (token !== labelToken) return;
    if (res?.ok) groups = res.data.groups || [];
  } catch { /* the whole sub-strand is offered below */ }
  /* If the topics could not be loaded, the sub-strand itself is one topic */
  if (!groups.length) groups = [{ no: 1, label: s.name, from: 1, to: Number(s.lessons) || 1, covers: [] }];
  topicGroups = groups;
  sel.innerHTML = groups.map((g, i) => `<option value="${i}">${esc(g.label)}</option>`).join('');
  sel.disabled = false;
};

/* ── Text of the lesson plan ──────────────────────────────── */
const TEXT = {
  en: { school: 'SCHOOL', teacher: 'TEACHER', area: 'LEARNING AREA', grade: 'GRADE', roll: 'ROLL', date: 'DATE', time: 'TIME',
        strand: 'STRAND', sub: 'SUB-STRAND', lesson: 'Lesson', minutes: 'minutes', head: ['Section', 'Details'],
        competencies: 'Core competencies', values: 'Values', pcis: 'Pertinent and contemporary issues' },
  sw: { school: 'SHULE', teacher: 'MWALIMU', area: 'SOMO', grade: 'DARAJA', roll: 'IDADI', date: 'TAREHE', time: 'MUDA',
        strand: 'MADA', sub: 'MADA NDOGO', lesson: 'Somo', minutes: 'dakika', head: ['Kipengele', 'Maelezo'],
        competencies: 'Umilisi msingi', values: 'Maadili', pcis: 'Masuala mtambuko' },
};

const bullets = (items) => (items || []).map((i) => `• ${i}`).join('\n');
const plain   = (items) => (items || []).map((i) => String(i).split(':')[0].trim()).filter(Boolean).join(', ');

const longDate = (iso) => !iso ? '' :
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/* what the teacher typed for this strand on the schemes page, if they chose to type them */
const typedResources = (cur) => {
  const sub = currentSub();
  const design = designs.find((d) => d.key === $('lpDesign').value);
  return design && sub && typeof ResourceSettings !== 'undefined' ? ResourceSettings.override(design.key, sub.strandId) : null;
};

const sections = (cur) => {
  const { labels: L, lang, lesson } = cur;
  const X = TEXT[lang];
  const c = lesson.content;
  const total = cur.designMinutes;

  const dev = (c.development || [])
    .map((d) => `${d.title}\n${(d.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`)
    .join('\n\n');

  return [
    [L.outcomes, `${L.outcomesLead}\n${bullets(c.outcomes)}`],
    [L.kiq, bullets(c.kiqs)],
    [X.competencies, plain(c.competencies)],
    [X.values, plain(c.values)],
    [X.pcis, plain(c.pcis)],
    [L.resources, bullets(typedResources(cur) || c.resources)],
    [L.organisation, c.organisation],
    [`${L.introduction} (5 ${X.minutes})`, bullets(c.introduction)],
    [`${L.development} (${total - 10} ${X.minutes})`, dev],
    [L.experiences, `${L.experiencesLead}\n${bullets(c.experiences)}`],
    [L.extended, bullets(c.extended)],
    [`${L.conclusion} (5 ${X.minutes})`, bullets(c.conclusion)],
    [L.assessment, bullets(c.assessment)],
    [L.reflection, ''],
  ].filter(([, v]) => v !== undefined);
};

const buildSpec = (cur) => {
  const { fields: f, lang, labels: L } = cur;
  const X = TEXT[lang];
  return {
    orientation: 'portrait',
    title      : L.lessonPlan,
    subtitle   : `${gradeLabel(f.grade)} ${f.area} – ${cur.topicLabel}`.toUpperCase(),
    meta: [
      [[X.school, f.school]],
      [[X.teacher, f.teacher], [X.roll, f.roll]],
      [[X.area, f.area], [X.grade, gradeLabel(f.grade)]],
      [[X.date, longDate(f.date)], [X.time, f.time]],
      [[X.strand, f.strand]],
      [[X.sub, f.sub]],
    ],
    columns: [
      { header: X.head[0], width: 26 },
      { header: X.head[1], width: 74 },
    ],
    rows: sections(cur),
  };
};

/* ── Write the lesson plan ────────────────────────────────── */
const readFields = () => {
  const design = currentDesign();
  const sub = currentSub();
  return {
    school : $('lpSchool').value.trim(),
    teacher: $('lpTeacher').value.trim(),
    area   : design?.learningArea || '',
    grade  : design ? String(design.grade) : '',
    roll   : $('lpRoll').value.trim(),
    date   : $('lpDate').value,
    time   : $('lpTime').value.trim(),
    strand : sub?.strand || '',
    sub    : sub?.name || '',
  };
};

const problemWith = (f) => {
  if (!f.school)  return 'Please enter the school name.';
  if (!f.teacher) return 'Please enter the name of the teacher.';
  if (!f.area || !f.sub) return 'Please choose the learning area and the sub-strand.';
  return '';
};

const write = async () => {
  showError('');
  const f = readFields();
  const problem = problemWith(f);
  if (problem) return showError(problem);

  const design = currentDesign();
  const group = topicGroups[Number($('lpLesson').value)] || topicGroups[0];
  if (!group) return showError('Please wait for the topics to load, then choose one.');
  const btn = $('lpWrite');
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Writing…';

  try {
    /* A topic plan is planned from the notes found for the topic (the typed topic wins over the list) */
    const typed = $('lpTopic') ? $('lpTopic').value.trim() : '';
    const listed = [group.label, ...(group.covers || []).filter((c) => c !== group.label)].join('. ');
    const body = {
      designKey: design.key, subStrandId: $('lpSub').value, from: group.from, to: group.to,
      source: $('lpFrom').value, topic: typed || listed,
    };
    let res = await API.post('/schemes/content', body);
    if (!res?.ok && (!res?.status || res.status >= 500)) res = await API.post('/schemes/content', body);

    if (!res?.ok) return showError(res?.data?.message || 'Could not write the lesson plan. Please try again.');

    current = {
      lang: res.data.lang, labels: res.data.labels, lesson: res.data.lessons[0],
      fields: f, designMinutes: design.lessonMinutes || 40,
      topicLabel: typed ? (typed.length > 60 ? `${typed.slice(0, 57)}…` : typed) : group.label,
    };
    render();
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
};

const render = () => {
  const rows = sections(current);
  $('lpPreview').innerHTML = rows.map(([k, v]) =>
    `<tr><th style="width:26%;text-align:left;vertical-align:top">${esc(k)}</th><td style="white-space:pre-line">${esc(v)}</td></tr>`).join('');
  $('lpDocName').textContent = `${current.fields.sub} – ${current.topicLabel}`;
  const src = current.lesson.source;
  $('lpSource').textContent =
      src === 'notes'  ? 'This lesson was built from your saved notes and the curriculum design, without AI. Try again later for a fuller version.'
    : src === 'design' ? 'This lesson was built from the curriculum design only. Try again later, or add notes for this topic.'
    : '';
  $('lpResult').hidden = false;
  $('lpResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ── Download / print ─────────────────────────────────────── */
const exportDoc = async (format, button) => {
  showError('');
  if (!current) return showError('Write the lesson plan first.');
  if (!(window.jspdf?.jsPDF && window.docx && window.DocExport)) {
    return showError('The download tools did not load. Check your internet connection and refresh the page.');
  }

  const f = current.fields;
  const spec = buildSpec(current);
  const base = ['Lesson_Plan', DocExport.safeName(gradeLabel(f.grade)), DocExport.safeName(f.sub), DocExport.safeName(current.topicLabel).slice(0, 40)].join('_');

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…';
  try {
    await new Promise((r) => setTimeout(r, 30));
    if (format === 'pdf')       { DocExport.downloadPdf([spec], base); showToast('PDF downloaded.', 'success'); }
    else if (format === 'docx') { await DocExport.downloadDocx([spec], base); showToast('Word file downloaded.', 'success'); }
    else                        { DocExport.printPdf([spec]); }
  } catch (err) {
    console.error(err);
    showError('Could not create the file. Please try again.');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
};

/* ── Wire up ──────────────────────────────────────────────── */
$('lpDesign').addEventListener('change', onDesignChange);
$('lpPickGrade').addEventListener('change', () => { fillSubjects(); onDesignChange(); });
$('lpSub').addEventListener('change', onSubChange);
$('lpWrite').addEventListener('click', write);
document.querySelector('.sch-downloads').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-fmt]');
  if (btn) exportDoc(btn.dataset.fmt, btn);
});

initFields();
loadDesigns();

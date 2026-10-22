/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Primary school (Grades 1–6) reports
   File: js/reports-primary.js          (load AFTER js/reports.js)

   What it does
   • Adds a "Report type" choice for Grades 1–6:
        End Term  |  Mid Term  |  Mid + End Term
     The columns on the card follow the choice, so nothing is left empty.
   • Draws the Grades 1–3 card (one class teacher) and the Grades 4–6
     card (a teacher beside each learning area).
   • Draws the primary class sheet (levels per learning area + level counts).
   • Performance levels use the KNEC four-level scale below. If your
     school's ranges differ, change PRIMARY_SCALE — it is the only place.
   • Grades 1 and 2 have no assessment number; it starts in Grade 3.

   Everything else (preview, print, PDF, bulk) is the existing code in
   reports.js — it simply calls the builders defined here.
═══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   1. PRIMARY PERFORMANCE LEVELS  (percentage out of 100)
══════════════════════════════════════════════════════════ */
const PRIMARY_SCALE = [
  { code: 'EE', full: 'Exceeds Expectation',    min: 75, max: 100, label: '75–100%' },
  { code: 'ME', full: 'Meets Expectation',      min: 41, max: 74,  label: '41–74%'  },
  { code: 'AE', full: 'Approaches Expectation', min: 21, max: 40,  label: '21–40%'  },
  { code: 'BE', full: 'Below Expectation',      min: 0,  max: 20,  label: '1–20%'   },
];

const primaryLevel = (score) => {
  if (score === null || score === undefined || score === '' || isNaN(Number(score))) return null;
  const v = Math.round(Number(score));
  return PRIMARY_SCALE.find(l => v >= l.min && v <= l.max) || null;
};

/* Short, child-friendly wordings (by level). Many per level so cards do not all read the same;
   the wording is picked from the learner + learning area, so it never changes between prints. */
const PRIMARY_REMARK_POOL = {
  EE: ['Excellent work. Keep it up.', 'Very well done. Keep shining.', 'Great job. You are doing very well.', 'Wonderful work. Keep going.', 'Excellent effort. We are proud of you.',
       'Superb work. Keep it up.', 'You are doing very well here.', 'Outstanding work. Well done.', 'Brilliant effort. Keep learning.', 'Very good work. Keep it up.',
       'Great understanding. Well done.', 'A star performance. Keep it up.'],
  ME: ['Good work. Aim higher.', 'Well done. Try a little harder.', 'Good effort. Keep practising.', 'A good job. You can do even better.', 'Good progress. Keep going.',
       'Nice work. Read more to improve.', 'Good. Practise to do better.', 'You are doing well. Keep trying.', 'Good understanding. Keep practising.', 'Fair work. A little more effort.',
       'Keep it up. You can reach higher.', 'Good try. Practise every day.'],
  AE: ['Needs more practice.', 'Keep trying. Practise more.', 'You can improve with practice.', 'Please practise at home.', 'A little more effort is needed.',
       'Try harder. Ask for help.', 'Getting there. Keep practising.', 'Needs more reading and practice.', 'Work harder in this area.', 'Practise a little every day.',
       'Needs more help in this area.', 'Do not give up. Keep trying.'],
  BE: ['Needs extra support.', 'Needs a lot of help. Please practise.', 'Please get extra help in this area.', 'Needs close support from teacher and home.', 'Let us practise the basics together.',
       'Needs extra time and practice.', 'Please practise daily with help.', 'Needs urgent help in this area.', 'Start with the basics. Keep trying.', 'Needs more support to improve.',
       'Please see the teacher for help.', 'Needs help every day.'],
};
const primaryRemark = (code, seed, step = 0) => PRIMARY_REMARK_POOL[code] ? pickFrom(PRIMARY_REMARK_POOL[code], seed, step) : '';

const PRIMARY_TEACHER_POOL = {
  EE: ['{n} has done excellent work this term. Keep up the good effort.', '{n} is a bright and hard-working learner. Well done.', 'Wonderful results from {n}. Keep reading and learning.',
       '{n} has done very well. We are proud of this work.', 'Excellent term, {n}. Keep it up.', '{n} works hard and it shows. Keep going.', 'A very good term for {n}. Keep shining.', 'Great work, {n}. Keep helping your friends too.'],
  ME: ['{n} has done well this term. A little more effort will make it even better.', '{n} is doing well. Keep practising every day.', 'Good work, {n}. Read more to do even better.',
       '{n} is making good progress. Keep trying.', 'A good term for {n}. Aim a little higher.', '{n} is a good learner. More practice will help.', 'Well done, {n}. Keep up the effort.', '{n} is on the right track. Keep going.'],
  AE: ['{n} is trying. More practice at school and home will help.', '{n} can improve with regular reading and practice.', 'Keep trying, {n}. Ask for help when you need it.',
       '{n} needs more practice in some areas. Please help at home.', 'Some progress, {n}. More effort will bring better results.', '{n} should read and practise a little every day.',
       'With more practice, {n} will do better.', '{n} is getting there. Please keep supporting at home.'],
  BE: ['{n} needs extra support. Please read and practise with {n} at home.', '{n} needs more help in class and at home. Please see the class teacher.', 'Please practise the basics with {n} every day.',
       '{n} needs close support. Let us work together to help.', 'Extra help is needed. Please talk to the class teacher about {n}.', '{n} needs more time and practice. We will support {n} at school.',
       'Please help {n} with reading and counting at home.', '{n} needs urgent help. Please visit the school.'],
};
const PRIMARY_HEAD_POOL = {
  EE: ['A very good term for {n}. The school is proud of this work.', 'Excellent work, {n}. Keep it up.', 'Well done {n}. We are proud of you.', 'Great results from {n}. Keep shining.', '{n} has done very well. Keep going.', 'A wonderful term for {n}. Congratulations.'],
  ME: ['{n} is making good progress. We encourage continued effort.', 'A good term for {n}. Keep working hard.', 'Well done {n}. Aim even higher next term.', '{n} is doing well. Keep it up.', 'Good work from {n}. More practice will help.', '{n} is on the right track. Keep trying.'],
  AE: ['{n} is making some progress. We encourage more practice and revision.', 'Keep trying, {n}. We will support you.', '{n} can do better with more practice.', 'More effort is needed from {n}. We will help.', '{n} is encouraged to read and practise more.', 'Please support {n} with practice at home.'],
  BE: ['{n} needs extra support. Please talk to the class teacher about how to help.', 'We will work with you to help {n}. Please visit the school.', '{n} needs close help from school and home.', 'Please meet the class teacher to plan support for {n}.', 'Extra help is needed for {n}. We are ready to assist.', 'Let us work together to help {n}.'],
};
/* More wordings so cards in one class rarely repeat */
const PRIMARY_EXTRA = (pool, more) => Object.entries(more).forEach(([k, v]) => pool[k].push(...v));
PRIMARY_EXTRA(PRIMARY_REMARK_POOL, {
  EE: ['Fantastic work. Keep it up.', 'You really understand this. Well done.', 'Top work. Keep reading.', 'Very bright work. Keep going.', 'Super job. We are proud.', 'Excellent. Help your friends too.', 'Great marks. Keep trying hard.', 'You are a real star here.', 'Very neat and clever work.', 'Wonderful. Keep up the effort.', 'Excellent grasp. Well done.', 'Great result. Keep learning more.'],
  ME: ['Nice effort. Keep practising.', 'Good job. Read a little more.', 'You are getting better. Keep going.', 'Good work. Try harder questions.', 'Well done. A bit more practice.', 'A good result. Do not stop now.', 'You can reach higher. Keep trying.', 'Good understanding. Revise often.', 'Fine effort. Keep it up.', 'Good progress. Keep reading.', 'On track. Keep practising.', 'Good. Ask when you do not know.'],
  AE: ['Practise a little more each day.', 'You are close. Keep trying.', 'Read more and practise.', 'Ask your teacher for help.', 'Try again. You can do it.', 'Needs more time and practice.', 'Please revise at home.', 'Keep working. You will improve.', 'More effort will help you.', 'Work on the easy parts first.', 'Please read daily at home.', 'Keep going. Do not give up.'],
  BE: ['Let us practise together.', 'Needs help every day. Please support.', 'Go slowly and practise the basics.', 'Please get extra help here.', 'Needs lots of practice with help.', 'We will help you learn this.', 'Please practise daily at home.', 'Needs close teacher support.', 'Start small. Keep trying.', 'Needs a lot more help.', 'Please see the teacher about this.', 'Extra lessons will help.'],
});
PRIMARY_EXTRA(PRIMARY_TEACHER_POOL, {
  EE: ['{n} has had a super term. Keep it up.', 'Very bright work from {n}. Keep learning.', '{n} is a joy to teach. Well done.', 'Great marks, {n}. Keep helping others.', '{n} works hard and does very well.', 'An excellent term, {n}. Keep reading.', '{n} should be proud of this term.', 'Well done {n}. Keep up the good habits.'],
  ME: ['{n} has had a good term. Keep practising.', 'Good work, {n}. Aim a bit higher next term.', '{n} is learning well. Read more at home.', 'A fair and good term for {n}.', '{n} can do even better with more practice.', 'Nice effort, {n}. Keep trying hard.', '{n} is doing well. Keep it up.', '{n} shows good effort. Keep going.'],
  AE: ['{n} is improving. Please keep supporting at home.', '{n} needs more practice in class and at home.', 'Keep trying, {n}. Your effort will pay off.', '{n} should read a little every day.', 'With help, {n} will do better.', '{n} needs more time on the basics.', 'Please help {n} practise at home.', '{n} is trying. Keep encouraging.'],
  BE: ['{n} needs extra help. Please visit the school.', 'Please read with {n} every day.', '{n} needs close help from teacher and home.', 'We will support {n}. Please help at home too.', '{n} needs more time and patient help.', 'Please meet the class teacher about {n}.', '{n} needs daily practice with help.', 'Let us work together to help {n}.'],
});
PRIMARY_EXTRA(PRIMARY_HEAD_POOL, {
  EE: ['A great term for {n}. Well done.', '{n} has done very well. Keep shining.', 'Excellent work, {n}. We are proud.', 'Very good results from {n}. Keep it up.', 'Congratulations {n}. Keep learning.', '{n} is doing wonderfully. Keep going.', 'Super work, {n}. Keep it up.', 'We are happy with {n}. Well done.'],
  ME: ['{n} is doing well. Keep practising.', 'Good work, {n}. Aim even higher.', 'A good term for {n}. Keep going.', 'Well done {n}. Keep up the effort.', '{n} is making steady progress.', 'Nice work, {n}. Read more at home.', '{n} can do even better. Keep trying.', 'We encourage {n} to keep working hard.'],
  AE: ['{n} is trying. More practice will help.', 'We will help {n} improve. Keep trying.', '{n} can do better with daily practice.', 'More effort will help {n}. We will support.', '{n} should read and revise daily.', 'Keep working, {n}. You will improve.', 'Please support {n} with reading at home.', '{n} is getting there. Keep going.'],
  BE: ['{n} needs extra help. Please visit the school.', 'We will support {n}. Please meet the class teacher.', '{n} needs close help at school and home.', 'Please work with us to help {n}.', 'Urgent help is needed for {n}. Please see us.', '{n} needs more time and support.', 'We will make a plan to help {n}.', 'Please visit the school to talk about {n}.'],
});
const primaryTeacherComment = (code, first, seed = '') =>
  PRIMARY_TEACHER_POOL[code] ? fillName(pickFrom(PRIMARY_TEACHER_POOL[code], seed), first) : `${first} is encouraged to keep working hard.`;
const primaryHeadComment = (code, first, seed = '') =>
  PRIMARY_HEAD_POOL[code] ? fillName(pickFrom(PRIMARY_HEAD_POOL[code], seed + 'h'), first) : `${first} is encouraged to work harder.`;

/* Curriculum order of learning areas (anything not listed goes last, A–Z) */
const PRIMARY_ORDER = ['english', 'literacy', 'kiswahili', 'indigenous', 'mathemat', 'environment',
  'science', 'social', 'religious', 'creative', 'agricult'];

const primaryAreaRank = (name) => {
  const n = String(name || '').toLowerCase();
  const i = PRIMARY_ORDER.findIndex(k => n.includes(k));
  return i < 0 ? 99 : i;
};
const sortPrimaryAreas = (list) => [...list].sort((a, b) =>
  (primaryAreaRank(a.name) - primaryAreaRank(b.name)) || String(a.name).localeCompare(String(b.name)));

/* ══════════════════════════════════════════════════════════
   2. WHICH CLASSES ARE PRIMARY, AND WHICH REPORT TYPE IS CHOSEN
══════════════════════════════════════════════════════════ */
const $p = (id) => document.getElementById(id);

const isPrimarySelection = () => {
  const t = targetsOf(el.rptClass?.value);
  return t.length > 0 && t.every(c => Number(c.grade) >= 1 && Number(c.grade) <= 6);
};

/* Grades 7–9 selection (report cards only; the class sheet keeps its single assessment) */
const isJuniorSelection = () => {
  const t = targetsOf(el.rptClass?.value);
  return t.length > 0 && t.every(c => Number(c.grade) >= 7 && Number(c.grade) <= 9);
};
const isDualCapable = () => isPrimarySelection() || (isJuniorSelection() && state.activeTab !== 'class');
/* Grades 7–9 card showing Mid Term and End Term side by side */
const juniorDual = () => isJuniorSelection() && state.activeTab !== 'class' && reportType() === 'both';

const reportType = () => {
  const v = $p('rptReportType')?.value;
  return v === 'mid' || v === 'both' ? v : 'end';
};

const PRIMARY_TYPE_LABEL = { end: 'End Term', mid: 'Mid Term', both: 'Mid & End Term' };
const primarySettings   = () => isPrimarySelection() ? { type: reportType() } : null;
const primaryExamLabel  = () => (isPrimarySelection() || juniorDual()) ? PRIMARY_TYPE_LABEL[reportType()] : '';
const dualSettings      = () => juniorDual() ? { type: 'both' } : null;

/* The key a loaded result set must have for the current selection */
const expectedKeyNow = () => {
  if (isPrimarySelection() || juniorDual()) return primaryKey();
  const cls = el.rptClass?.value, exam = el.rptExam?.value;
  return state.scope === 'class' ? `class:${cls}:${exam}` : `grade:${state.gradeValue}:${el.rptTerm?.value}:${exam}`;
};

/* Grade number (1–6) of a learner's class; null if it cannot be worked out */
const primaryGradeOf = (r, s) => {
  const own = state.classes.find(c => c.name === r.streamName);
  const g = own?.grade ?? targetsOf(el.rptClass?.value)[0]?.grade ??
            (/(\d+)/.exec(r.streamName || s?.cls || '') || [])[1];
  const n = Number(g);
  return n >= 1 && n <= 12 ? n : null;
};

/* ══════════════════════════════════════════════════════════
   3. CONTROLS — report type + the second assessment dropdown
══════════════════════════════════════════════════════════ */
const updatePrimaryControls = () => {
  const prim = isDualCapable();               // Grades 1–6, or Grades 7–9 on the report-card tabs

  /* A class sheet is for ONE assessment, so "Mid + End Term" is offered for report cards only */
  const sel = $p('rptReportType');
  const sheetTab = state.activeTab === 'class' && isPrimarySelection();
  const bothOpt = sel && [...sel.options].find(o => o.value === 'both');
  if (bothOpt) { bothOpt.disabled = sheetTab; bothOpt.hidden = sheetTab; }
  let changed = false;
  if (sheetTab && sel && sel.value === 'both') { sel.value = 'end'; changed = true; }

  const type = reportType();

  const typeWrap = $p('reportTypeWrap');
  const exam2    = $p('exam2FieldWrap');
  const label    = $p('examLabelText');
  const label2   = $p('exam2LabelText');

  if (typeWrap) typeWrap.style.display = prim ? 'flex' : 'none';
  if (exam2)    exam2.style.display    = prim && type === 'both' ? 'flex' : 'none';
  if (label)    label.textContent      = prim ? (type === 'mid' ? 'Mid Term assessment' : 'End Term assessment') : 'Assessment';
  if (label2)   label2.textContent     = 'Mid Term assessment';
  return changed;
};

/* Called by reports.js after the assessment list has loaded: copy it to the second dropdown and
   pre-select the End Term / Mid Term assessment by name (the teacher can still change either). */
const primaryAfterExams = (force = false) => {
  updatePrimaryControls();
  if (!isDualCapable()) return;

  const a = el.rptExam, b = $p('rptExam2');
  if (!a) return;
  if (b && (force === false || !b.options.length || b.options.length !== a.options.length)) {
    const keep = b.value;
    b.innerHTML = a.innerHTML;
    if (keep && [...b.options].some(o => o.value === keep)) b.value = keep;
  }

  const pick = (sel, re) => {
    if (!sel) return;
    const o = [...sel.options].find(x => x.value && re.test(x.textContent));
    if (o && (force || !sel.value)) sel.value = o.value;
  };

  const type = reportType();
  if (type === 'end')  pick(a, /end/i);
  if (type === 'mid')  pick(a, /mid/i);
  if (type === 'both') { pick(a, /end/i); pick(b, /mid/i); }

  /* Selection complete (picked automatically)? load the marks now, as if the teacher had chosen it */
  if (a.value && (type !== 'both' || b?.value) && state.loadedKey !== expectedKeyNow()) fetchResults();
};

const primaryKey = () => {
  const type = reportType();
  return `${isPrimarySelection() ? 'primary' : 'dual'}:${type}:${el.rptClass?.value}:${el.rptTerm?.value}:${el.rptExam?.value}:` +
         (type === 'both' ? ($p('rptExam2')?.value || '') : '');
};

$p('rptReportType')?.addEventListener('change', () => {
  updatePrimaryControls();
  resetLearnerList();
  resetPreview();
  state.loadedKey = null;
  primaryAfterExams(true);                // pre-selects the right assessment(s) and loads the marks
});

$p('rptExam2')?.addEventListener('change', () => { resetPreview(); fetchResults(); });

el.rptClass?.addEventListener('change', () => { updatePrimaryControls(); });

/* Switching between Individual / Class sheet / Bulk: re-check what the report type may be */
[el.tabIndividual, el.tabClass, el.tabBulk].forEach(btn => btn?.addEventListener('click', () => {
  if (updatePrimaryControls() && isPrimarySelection()) {
    resetPreview();
    state.loadedKey = null;
    primaryAfterExams(true);
  } else if (isJuniorSelection()) {
    primaryAfterExams(false);             // Grades 7–9: show / hide the report type with the tab
  }
}));

/* ══════════════════════════════════════════════════════════
   4. LOAD + MERGE  (one result set per assessment -> one object per learner)
══════════════════════════════════════════════════════════ */
const primaryUrl = (val) => {
  if (state.scope === 'class') return `/results/class?classId=${el.rptClass.value}&examId=${val}`;
  const i = val.indexOf('|');
  return `/results/grade?grade=${encodeURIComponent(state.gradeValue)}&term=${el.rptTerm.value}` +
         `&examName=${encodeURIComponent(val.slice(i + 1))}&academicYear=${encodeURIComponent(val.slice(0, i))}`;
};

/* Marks of one learner in one assessment, keyed by learning-area name */
const summarisePrimary = (r) => {
  const map = {};
  let total = 0, count = 0;
  (r.subjectResults || []).forEach(x => {
    const ok = !x.absent && !x.notEntered && x.score !== null && x.score !== undefined && !isNaN(Number(x.score));
    map[normName(x.name)] = {
      name: x.name, teacher: x.teacherName || '',
      score: ok ? Number(x.score) : null, absent: !!x.absent, notEntered: !ok && !x.absent,
    };
    if (ok) { total += Number(x.score); count++; }
  });
  return { map, total, count, avg: count ? total / count : null };
};

const mergePrimary = (sets) => {
  const byId = new Map();

  sets.forEach(({ role, data }) => {
    (data?.results || []).forEach(r => {
      let m = byId.get(String(r.studentId));
      if (!m) {
        m = { studentId: r.studentId, fullName: r.fullName, gender: r.gender, upiNumber: r.upiNumber,
              assessmentNo: r.assessmentNo, streamName: r.streamName, mid: null, end: null, primary: true };
        byId.set(String(r.studentId), m);
      }
      m[role] = summarisePrimary(r);
      m.streamName   = m.streamName   || r.streamName;
      m.upiNumber    = m.upiNumber    || r.upiNumber;
      m.assessmentNo = m.assessmentNo || r.assessmentNo;
    });
  });

  const out = [...byId.values()];
  out.forEach(m => { m.subjectCount = Math.max(m.mid?.count || 0, m.end?.count || 0); });
  return out.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
};

async function fetchPrimaryResults() {
  const type = reportType();
  const a = el.rptExam?.value;
  const b = $p('rptExam2')?.value;
  const term = el.rptTerm?.value;
  if (!el.rptClass?.value || !term || !a || (type === 'both' && !b)) return;

  if (type === 'both' && a === b) {
    showToast('Choose two different assessments for Mid Term and End Term.', 'warning');
    return;
  }

  const wanted = type === 'both' ? [{ role: 'end', val: a }, { role: 'mid', val: b }]
               : [{ role: type, val: a }];

  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">Loading...</option>';

  const replies = await Promise.all(wanted.map(w => API.get(primaryUrl(w.val))));
  const failed  = replies.findIndex(r => !r?.ok);
  if (failed >= 0) {
    showToast(replies[failed]?.data?.message || 'Failed to load results.', 'error');
    resetLearnerList();
    return;
  }

  const sets = wanted.map((w, i) => ({ role: w.role, data: replies[i].data }));
  const main = sets[0].data;

  /* Learning areas: the first assessment's list, plus any the second one adds */
  const subjects = [];
  sets.forEach(({ data }) => (data.subjects || []).forEach(sj => {
    if (!subjects.some(x => normName(x.name) === normName(sj.name))) subjects.push(sj);
  }));

  state.subjects  = subjects;
  state.results   = mergePrimary(sets);
  state.loadedKey = primaryKey();
  state.vapInfo   = null;
  state.examInfo  = { ...(main.exam || {}), academicYear: main.exam?.academicYear || CURRENT_YEAR };
  state.classInfo = state.scope === 'class'
    ? main.class
    : { name: `Grade ${main.grade} — Whole Grade (${(main.streams || []).join(' + ')})` };

  renderTeacherInputs();

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


/* ══════════════════════════════════════════════════════════
   4b. GRADES 7–9: Mid Term + End Term on one card
   Each assessment is loaded as usual; every learner then gets
   • dual.mid / dual.end  — that assessment's own result (shown side by side)
   • dual.rows            — one row per learning area, with the AVERAGE of the two marks
   The pathway summary, remarks, overall level and comments use that average.
══════════════════════════════════════════════════════════ */
const validSub = (x) => x && !x.absent && !x.notEntered && x.score !== null && x.score !== undefined && !isNaN(Number(x.score));

const blendJunior = (mid, end) => {
  const base = end || mid;
  const m = new Map();
  [['mid', mid], ['end', end]].forEach(([role, res]) => (res?.subjectResults || []).forEach(x => {
    const k = normName(x.name);
    if (!m.has(k)) m.set(k, { key: k, name: x.name, code: x.code, teacherName: x.teacherName || '', mid: null, end: null });
    const row = m.get(k);
    row[role] = x;
    row.teacherName = row.teacherName || x.teacherName || '';
  }));

  const rows = [...m.values()].map(row => {
    const a = validSub(row.mid) ? Number(row.mid.score) : null;
    const b = validSub(row.end) ? Number(row.end.score) : null;
    const avg = (a !== null && b !== null) ? (a + b) / 2 : (a !== null ? a : b);
    const g = avg === null ? null : KJSEA.getGrade(avg);
    return { ...row, avg, grade: g?.grade || '', points: g?.points || 0, score: avg };
  });

  const scored = rows.filter(x => x.avg !== null);
  const overallAvg = scored.length ? scored.reduce((t, x) => t + x.avg, 0) / scored.length : null;

  return {
    ...base,
    streamName   : base.streamName,
    subjectCount : scored.length,
    avgScore     : overallAvg === null ? 0 : parseFloat(overallAvg.toFixed(1)),
    meanGrade    : overallAvg === null ? '' : (KJSEA.getGrade(overallAvg)?.grade || ''),
    pathways     : KJSEA.computePathways(rows.map(x => ({ name: x.name, code: x.code, score: x.avg, points: x.points }))),
    dual         : { mid: mid || null, end: end || null, rows },
  };
};

async function fetchJuniorDual() {
  const a = el.rptExam?.value;                         // End Term
  const b = $p('rptExam2')?.value;                     // Mid Term
  const term = el.rptTerm?.value;
  if (!el.rptClass?.value || !term || !a || !b) return;

  if (a === b) {
    showToast('Choose two different assessments for Mid Term and End Term.', 'warning');
    return;
  }

  if (el.rptLearner) el.rptLearner.innerHTML = '<option value="">Loading...</option>';

  const replies = await Promise.all([API.get(primaryUrl(a)), API.get(primaryUrl(b))]);
  const failed  = replies.findIndex(r => !r?.ok);
  if (failed >= 0) {
    showToast(replies[failed]?.data?.message || 'Failed to load results.', 'error');
    resetLearnerList();
    return;
  }

  const [endData, midData] = [replies[0].data, replies[1].data];
  const endRes = computeResults(endData.results || []);
  const midRes = computeResults(midData.results || []);
  const endBy  = new Map(endRes.map(r => [String(r.studentId), r]));
  const midBy  = new Map(midRes.map(r => [String(r.studentId), r]));
  const ids    = [...new Set([...endBy.keys(), ...midBy.keys()])];

  const subjects = [];
  [endData, midData].forEach(d => (d.subjects || []).forEach(sj => {
    if (!subjects.some(x => normName(x.name) === normName(sj.name))) subjects.push(sj);
  }));

  state.subjects  = subjects;
  state.results   = ids.map(id => blendJunior(midBy.get(id), endBy.get(id)))
                       .sort((p, q) => String(p.fullName).localeCompare(String(q.fullName)));
  state.loadedKey = primaryKey();
  state.vapInfo   = null;
  state.examInfo  = { ...(endData.exam || {}), academicYear: endData.exam?.academicYear || CURRENT_YEAR };
  state.classInfo = state.scope === 'class'
    ? endData.class
    : { name: `Grade ${endData.grade} — Whole Grade (${(endData.streams || []).join(' + ')})` };

  renderTeacherInputs();

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

/* ══════════════════════════════════════════════════════════
   5. SMALL HELPERS SHARED BY THE CARD AND THE SHEET
══════════════════════════════════════════════════════════ */
const primaryRoles = (type) => type === 'both' ? ['mid', 'end'] : [type];

/* The learning areas to print for a learner (curriculum order) */
const primaryAreasOf = (r, type) => {
  const seen = new Map();
  primaryRoles(type).forEach(role => {
    Object.entries(r[role]?.map || {}).forEach(([k, v]) => { if (!seen.has(k)) seen.set(k, { key: k, name: v.name, teacher: v.teacher }); });
  });
  /* Learning areas the class has but this learner has no record of: keep the card complete */
  (state.subjects || []).forEach(sj => {
    const k = normName(sj.name);
    if (!seen.has(k)) seen.set(k, { key: k, name: sj.name, teacher: sj.teacherName || '' });
  });
  return sortPrimaryAreas([...seen.values()]);
};

/* What to print in one cell: { txt, level } */
const primaryCell = (r, role, key) => {
  const v = r[role]?.map?.[key];
  if (!v) return { txt: '—', level: '' };
  if (v.absent) return { txt: 'ABS', level: '—' };
  if (v.score === null) return { txt: '—', level: '—' };
  const l = primaryLevel(v.score);
  return { txt: `${Math.round(v.score)}%`, level: l ? l.code : '—' };
};

/* Average of the Mid and End Term averages (only one of them if the other is missing) */
const primaryBlendAvg = (r) => {
  const m = r.mid?.count ? r.mid.avg : null, e = r.end?.count ? r.end.avg : null;
  return (m !== null && e !== null) ? (m + e) / 2 : (e !== null ? e : m);
};

/* The level that decides the overall result: one assessment's average, or the average of both */
const primaryOverall = (r, type) => {
  if (type === 'both') { const a = primaryBlendAvg(r); return a === null ? null : primaryLevel(a); }
  const a = r[type]?.avg;
  return (a !== null && a !== undefined) ? primaryLevel(a) : null;
};

/* "Improved / dipped since mid term" line for the class teacher's comment on a Mid + End card */
const trendSentence = (m, e) => {
  if (m === null || e === null || m === undefined || e === undefined) return '';
  const d = e - m;
  return d >= 3 ? ' Improved since mid term.' : d <= -3 ? ' Dipped since mid term; more effort is needed.' : '';
};

/* ══════════════════════════════════════════════════════════
   6. THE REPORT CARD  (Grades 1–3 and 4–6; End, Mid, or Mid + End)
══════════════════════════════════════════════════════════ */
const buildPrimaryCard = (r, s) => {
  const { INK, LINE } = PRINT;
  const type  = s.primary?.type || 'end';
  const both  = type === 'both';
  const roles = primaryRoles(type);
  const grade = primaryGradeOf(r, s);
  const upper = grade !== null && grade >= 4;             // Grades 4–6 show the subject teacher
  const showAssessNo = grade === null ? !!r.assessmentNo : grade >= 3;   // none in Grades 1 and 2
  const areas = primaryAreasOf(r, type);

  const maps = s.teacherMaps || {};
  const teacherMap = maps[r.streamName] || (Object.keys(maps).length === 1 ? Object.values(maps)[0] : null) || {};
  const teacherFor = (a) => tidyName(teacherMap[a.key] || a.teacher || '');

  const initials = String(s.schoolName || 'S').trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const gender = r.gender ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1) : '';

  /* ── table styles ── */
  const thS = (label, al = 'center', last = false, extra = '') =>
    `<th ${extra} style="padding:6px 4px;text-align:${al};font-size:13.4px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;line-height:1.2;color:${INK};background:#ffffff;border-right:${last ? 'none' : `2px solid ${LINE}`};border-bottom:3px solid ${LINE};">${label}</th>`;
  const subTh = (label) =>
    `<th style="padding:5px 3px;text-align:center;font-size:13px;font-weight:800;text-transform:uppercase;color:${INK};background:#ffffff;border-right:2px solid ${LINE};border-bottom:3px solid ${LINE};">${label}</th>`;
  const grpTh = (label) =>
    `<th colspan="2" style="padding:5px;text-align:center;font-size:13.4px;font-weight:800;text-transform:uppercase;color:${INK};background:#ffffff;border-right:2px solid ${LINE};border-bottom:2px solid ${LINE};">${label}</th>`;
  const td = (extra = '') =>
    `padding:6px 6px 7px;line-height:1.2;background:#ffffff;border-right:2px solid ${LINE};border-bottom:2px solid ${LINE};vertical-align:middle;color:${INK};${extra}`;

  const widths = both ? (upper ? [5, 20, 9, 8, 9, 8, 24, 17] : [5, 24, 10, 9, 10, 9, 33])
                      : (upper ? [5, 20, 10, 25, 23, 17]      : [5, 25, 12, 25, 33]);
  const colgroup = '<colgroup>' + widths.map(w => `<col style="width:${w}%">`).join('') + '</colgroup>';

  const lastRemarkTh = !upper;
  const head = both
    ? `<tr>${thS('No.', 'center', false, 'rowspan="2"')}${thS('Learning area', 'left', false, 'rowspan="2"')}${grpTh('Mid term')}${grpTh('End term')}${thS('Teacher&rsquo;s remark', 'left', lastRemarkTh, 'rowspan="2"')}${upper ? thS('Teacher', 'left', true, 'rowspan="2"') : ''}</tr>
       <tr>${subTh('Score')}${subTh('Level')}${subTh('Score')}${subTh('Level')}</tr>`
    : `<tr>${thS('No.')}${thS('Learning area', 'left')}${thS('Score')}${thS('Performance level', 'left')}${thS('Teacher&rsquo;s remark', 'left', lastRemarkTh)}${upper ? thS('Teacher', 'left', true) : ''}</tr>`;

  /* A level: full name + bold code when there is room (one assessment), code only when side by side */
  const levelCell = (code, full) => {
    const l = PRIMARY_SCALE.find(x => x.code === code);
    if (!l) return `<div style="text-align:${full ? 'left' : 'center'};font-size:17px;font-weight:800;">—</div>`;
    return full
      ? `<div style="font-size:13.5px;font-weight:700;line-height:1.15;">${escHtml(l.full)}</div><div style="font-size:16.5px;font-weight:800;line-height:1.2;">${l.code}</div>`
      : `<div style="text-align:center;font-size:19px;font-weight:800;line-height:1.2;">${l.code}</div>`;
  };

  /* Remark follows the level of the learning area: the average of Mid and End Term on a Mid + End card */
  const remarkFor = (a, i) => {
    const vals = roles.map(role => r[role]?.map?.[a.key]).filter(Boolean);
    const ok = vals.filter(v => v.score !== null);
    if (ok.length) {
      const avg = ok.reduce((t, v) => t + v.score, 0) / ok.length;
      return primaryRemark(primaryLevel(avg)?.code, String(r.studentId) + a.key, i);
    }
    if (vals.some(v => v.absent)) return 'Absent — not assessed.';
    return vals.length ? 'Marks not entered.' : '';
  };

  const rows = areas.map((a, i) => {
    let cells = '';
    if (both) {
      const m = primaryCell(r, 'mid', a.key), e = primaryCell(r, 'end', a.key);
      cells = `<td style="${td('text-align:center;font-weight:800;font-size:17px;')}">${m.txt}</td><td style="${td('text-align:center;')}">${levelCell(m.level, false)}</td>` +
              `<td style="${td('text-align:center;font-weight:800;font-size:17px;')}">${e.txt}</td><td style="${td('text-align:center;')}">${levelCell(e.level, false)}</td>`;
    } else {
      const c = primaryCell(r, type, a.key);
      cells = `<td style="${td('text-align:center;font-weight:800;font-size:17.5px;')}">${c.txt}</td><td style="${td('text-align:left;')}">${levelCell(c.level, true)}</td>`;
    }
    return `<tr>
      <td style="${td('text-align:center;font-size:15px;font-weight:700;')}">${i + 1}</td>
      <td style="${td('text-align:left;font-weight:800;font-size:16.5px;')}">${escHtml(a.name)}</td>
      ${cells}
      <td style="${td(`text-align:left;font-size:15px;font-weight:600;${upper ? '' : 'border-right:none;'}`)}">${escHtml(remarkFor(a, i))}</td>
      ${upper ? `<td style="${td('text-align:left;font-size:15px;font-weight:800;border-right:none;')}">${escHtml(teacherFor(a))}</td>` : ''}
    </tr>`;
  }).join('');

  /* ── total row ── */
  const D = `border-top:4px double ${LINE};`;
  const totalCells = roles.map(role => {
    const v = r[role];
    const has = v && v.count > 0;
    const lv = has ? primaryLevel(v.avg)?.code : '';
    return both
      ? `<td style="${td(D + 'text-align:center;font-weight:800;font-size:15.5px;')}">${has ? `${v.total}<div style="font-size:12px;font-weight:700;">/${v.count * 100}</div>` : '—'}</td><td style="${td(D + 'text-align:center;')}">${levelCell(lv, false)}</td>`
      : `<td style="${td(D + 'text-align:center;font-weight:800;font-size:16px;')}">${has ? `${v.total}<div style="font-size:12px;font-weight:700;">/${v.count * 100}</div>` : '—'}</td><td style="${td(D + 'text-align:left;')}">${levelCell(lv, true)}</td>`;
  }).join('');

  const overall = primaryOverall(r, type);
  const overallRemark = { EE: 'Excellent performance.', ME: 'Good performance.', AE: 'Fair. More effort needed.', BE: 'Needs extra support.' }[overall?.code] || '';

  const totalRow = `<tr>
    <td style="${td(D)}"></td>
    <td style="${td(D + 'font-weight:800;font-size:16px;letter-spacing:.8px;text-align:left;')}">TOTAL</td>
    ${totalCells}
    <td colspan="${upper ? 2 : 1}" style="${td(D + 'border-right:none;font-size:15px;font-weight:800;text-align:left;')}">${escHtml(overallRemark)}</td>
  </tr>`;

  /* ── learner grid (no assessment number in Grades 1–2) ── */
  const cell = (label, value, { span = 1, last = false, bottom = true } = {}) => `
    <div style="grid-column:span ${span};padding:3px 12px 5px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}${bottom ? `border-bottom:2px solid ${LINE};` : ''}">
      <div style="font-size:13.4px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">${label}</div>
      <div style="font-size:18px;font-weight:800;color:${INK};line-height:1.35;min-height:17px;">${value || '&nbsp;'}</div>
    </div>`;

  const learnerGrid = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:3px solid ${LINE};">
      ${cell('Learner name', escHtml(r.fullName), { span: 2 })}
      ${cell('Class', escHtml(prettyClass(r.streamName || s.cls)))}
      ${cell('Gender', escHtml(gender), { last: true })}
      ${showAssessNo
        ? cell('Assessment no.', escHtml(r.assessmentNo || ''), { bottom: false }) + cell('Admission no.', escHtml(r.upiNumber || ''), { bottom: false }) + cell('Academic year', escHtml(s.year), { bottom: false, span: 2, last: true })
        : cell('Admission no.', escHtml(r.upiNumber || ''), { bottom: false, span: 2 }) + cell('Academic year', escHtml(s.year), { bottom: false, span: 2, last: true })}
    </div>`;

  /* ── averages strip ── */
  const stat = (label, value, last = false) => `
    <div style="padding:4px 12px;text-align:center;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:13.4px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">${label}</div>
      <div style="font-size:21px;font-weight:800;color:${INK};line-height:1.15;">${value}</div>
    </div>`;
  const avgTxt = (role) => r[role]?.count ? `${Math.round(r[role].avg)}%` : '—';
  const overallTxt = overall ? `${escHtml(overall.full)} &nbsp;${overall.code}` : '—';
  const statsStrip = both
    ? `<div style="display:grid;grid-template-columns:1fr 1fr 2fr;border-bottom:3px solid ${LINE};">${stat('Mid term average', avgTxt('mid'))}${stat('End term average', avgTxt('end'))}${stat('Overall level (average of both)', overallTxt, true)}</div>`
    : `<div style="display:grid;grid-template-columns:1fr 2fr;border-bottom:3px solid ${LINE};">${stat('Average', avgTxt(type))}${stat('Overall performance level', overallTxt, true)}</div>`;

  const sectionBar = (title, right = '') => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 12px;background:#ffffff;color:${INK};border-bottom:2px solid ${LINE};font-size:14.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
      <span>${title}</span><span style="font-weight:600;letter-spacing:.2px;text-transform:none;font-size:13.5px;">${right}</span>
    </div>`;

  /* ── comments ── */
  const first = String(r.fullName || 'The learner').trim().split(/\s+/)[0].replace(/^./, c => c.toUpperCase()).replace(/(?<=.)./g, c => c.toLowerCase());
  const signBlock = (title, comment, person, personLabel, last = false) => `
    <div style="padding:8px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:13.4px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">${title}</div>
      <div style="font-size:16px;font-weight:600;color:${INK};line-height:1.4;font-style:italic;min-height:24px;">${escHtml(comment)}</div>
      <div style="margin-top:8px;border-bottom:2px solid ${LINE};"></div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:12.8px;font-weight:600;color:${INK};">
        <span><strong style="font-size:15.5px;">${person ? escHtml(tidyName(person)) : '&nbsp;'}</strong><br/>${personLabel}</span>
        <span style="align-self:flex-end;white-space:nowrap;">Date: ..........</span>
      </div>
    </div>`;

  const dateCell = (label, value, last = false) => `
    <div style="padding:6px 12px;background:#ffffff;${last ? '' : `border-right:2px solid ${LINE};`}">
      <div style="font-size:13.4px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">${label}</div>
      <div style="font-size:17px;font-weight:800;color:${INK};min-height:15px;">${value ? escHtml(value) : '..............................'}</div>
    </div>`;

  const keyCells = PRIMARY_SCALE.map((l, i) => `
    <div style="padding:5px 4px;text-align:center;background:#ffffff;${i < PRIMARY_SCALE.length - 1 ? `border-right:2px solid ${LINE};` : ''}">
      <div style="font-size:16px;font-weight:800;color:${INK};">${l.code}</div>
      <div style="font-size:13px;font-weight:700;color:${INK};line-height:1.2;">${l.full}</div>
      <div style="font-size:13.6px;font-weight:800;color:${INK};margin-top:3px;">${l.label}</div>
    </div>`).join('');

  const classTeacher = (s.classTeachers || {})[r.streamName] || s.teacher;
  const dot = (pos) => `<span style="position:absolute;${pos}width:9px;height:9px;background:#000;transform:rotate(45deg);"></span>`;

  return `
<div style="position:relative;width:100%;max-width:754px;box-sizing:border-box;background:#ffffff;border:1.5px solid #000;padding:5px;margin:7px auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
${dot('top:-6px;left:-6px;')}${dot('top:-6px;right:-6px;')}${dot('bottom:-6px;left:-6px;')}${dot('bottom:-6px;right:-6px;')}
<div style="width:100%;box-sizing:border-box;background:#ffffff;color-scheme:light;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:3px solid ${LINE};overflow:hidden;font-family:'DM Sans','Segoe UI',Arial,sans-serif;font-size:15.3px;color:${INK};margin:0 auto;font-variant-numeric:tabular-nums;">

  <div style="display:flex;align-items:center;gap:14px;padding:8px 16px;background:#ffffff;border-bottom:3px solid ${LINE};">
    <div style="width:50px;height:50px;background:#ffffff;color:${INK};border:2px solid ${LINE};border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:26.3px;font-weight:800;letter-spacing:1px;flex-shrink:0;">${escHtml(initials)}</div>
    <div style="flex:1;min-width:0;">${schoolHeader(s, 24)}</div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:17.4px;font-weight:800;letter-spacing:1.2px;color:${INK};">LEARNER PROGRESS REPORT</div>
      <div style="font-size:14.5px;font-weight:600;color:${INK};margin-top:3px;">Term ${escHtml(s.term)} &nbsp;&bull;&nbsp; ${PRIMARY_TYPE_LABEL[type]} Assessment &nbsp;&bull;&nbsp; ${escHtml(s.year)}</div>
    </div>
  </div>

  ${learnerGrid}
  ${statsStrip}

  ${sectionBar('Learning area performance')}
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    ${colgroup}
    <thead>${head}</thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>

  ${sectionBar('Comments')}
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:3px solid ${LINE};">
    ${signBlock("Class teacher's comment", primaryTeacherComment(overall?.code, first, String(r.studentId)) + (both ? trendSentence(r.mid?.count ? r.mid.avg : null, r.end?.count ? r.end.avg : null) : ''), classTeacher, 'Class teacher &mdash; signature')}
    ${signBlock("Head of Institution's comment", primaryHeadComment(overall?.code, first, String(r.studentId)), s.principal, 'Head of Institution &mdash; signature &amp; stamp', true)}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:3px solid ${LINE};">
    ${dateCell('Term closing date', s.closingDate)}
    ${dateCell('Next term opens', s.nextTerm, true)}
  </div>

  <div style="display:flex;align-items:flex-end;gap:10px;padding:10px 12px 6px;background:#ffffff;border-bottom:3px solid ${LINE};font-size:15.5px;color:${INK};">
    <span style="white-space:nowrap;font-weight:700;">Parent / Guardian signature:</span>
    <div style="flex:1;border-bottom:2px solid ${LINE};height:14px;"></div>
    <span style="white-space:nowrap;">Date: ______________</span>
  </div>

  ${sectionBar('Grading key', 'Performance level and score range')}
  <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:2px solid ${LINE};">${keyCells}</div>
  <div style="padding:4px 12px;background:#ffffff;border-bottom:3px solid ${LINE};font-size:12.8px;font-weight:600;color:${INK};">Marks are rounded to the nearest whole number before the performance level is worked out.</div>

  <div style="background:#ffffff;display:flex;justify-content:space-between;align-items:center;padding:6px 14px;font-size:13.4px;font-weight:700;color:${INK};">
    <span>Powered by Scholar Analytics</span>
    <span>Parent / Guardian copy</span>
  </div>

</div>
</div>`;
};

/* ══════════════════════════════════════════════════════════
   7. THE PRIMARY CLASS SHEET  (same layout as the Grades 7–9 class sheet)
   One sheet per assessment: End Term OR Mid Term (never combined).
   Class rankings · level counts · learning-area summary · top 3 per
   learning area · gender analytics · signatures.
   Primary has no points, so there is no Points / VAP column.
══════════════════════════════════════════════════════════ */
const buildPrimarySheet = (allResults, s) => {
  const { INK, LINE } = PRINT;
  const role     = s.primary?.type === 'mid' ? 'mid' : 'end';       // a sheet is for ONE assessment
  const roleName = role === 'mid' ? 'Mid Term' : 'End Term';
  const div      = (a, b) => b ? a / b : 0;

  const has      = (r) => (r[role]?.count || 0) > 0;
  const results  = allResults.filter(has).sort((a, b) => (b[role].total - a[role].total) || String(a.fullName).localeCompare(String(b.fullName)));
  const noMarks  = allResults.filter(r => !has(r));                 // shown as X, not ranked
  const n        = results.length;

  /* Positions (equal totals share a position) */
  let lastTotal = null, lastPos = 0;
  results.forEach((r, i) => {
    if (r[role].total !== lastTotal) { lastPos = i + 1; lastTotal = r[role].total; }
    r._pos = lastPos;
  });

  /* Learning areas for the whole sheet (matched by name across streams) */
  const seen = new Map();
  allResults.forEach(r => primaryAreasOf(r, role).forEach(a => { if (!seen.has(a.key)) seen.set(a.key, a); }));
  (state.subjects || []).forEach(sj => {
    const k = normName(sj.name);
    if (!seen.has(k)) seen.set(k, { key: k, name: sj.name, teacher: sj.teacherName || '' });
  });
  const areas = sortPrimaryAreas([...seen.values()]);

  const maps = s.teacherMaps || {};
  const teachersOf = (a) =>
    [...new Set(Object.values(maps).map(m => m[a.key]).filter(Boolean).concat(a.teacher ? [a.teacher] : []))]
      .map(tidyName).join(' / ');

  const avg       = div(results.reduce((t, r) => t + r[role].avg, 0), n);
  const classCode = primaryLevel(avg)?.code || '';

  /* Overall level counts */
  const dist = { EE: 0, ME: 0, AE: 0, BE: 0 };
  results.forEach(r => { const c = primaryLevel(r[role].avg)?.code; if (c) dist[c]++; });
  const xCount = noMarks.length;

  /* Per learning area: average, level counts, top 3 */
  const areaStats = areas.map(a => {
    const scores = [];
    results.forEach(r => {
      const v = r[role]?.map?.[a.key];
      if (v && v.score !== null) scores.push({ fullName: r.fullName, score: v.score, code: primaryLevel(v.score)?.code || '' });
    });
    const d = { EE: 0, ME: 0, AE: 0, BE: 0 };
    scores.forEach(x => { if (d[x.code] !== undefined) d[x.code]++; });
    const mean = scores.length ? parseFloat((scores.reduce((t, x) => t + x.score, 0) / scores.length).toFixed(1)) : 0;
    return { ...a, avg: mean, count: scores.length, d, top3: [...scores].sort((p, q) => q.score - p.score).slice(0, 3) };
  });
  const ranked = [...areaStats].sort((p, q) => q.avg - p.avg).map((x, i) => ({ ...x, rank: i + 1 }));
  const statOf = (a) => areaStats.find(x => x.key === a.key);

  /* Gender */
  const males   = results.filter(r => r.gender === 'male');
  const females = results.filter(r => r.gender === 'female');
  const gAvg    = (list) => list.length ? parseFloat((list.reduce((t, r) => t + r[role].avg, 0) / list.length).toFixed(1)) : 0;
  const maleAvg = gAvg(males), femaleAvg = gAvg(females);
  const betterGender = (!males.length || !females.length) ? 'Not enough data' : (femaleAvg >= maleAvg ? 'Female' : 'Male');
  const genderGap    = (!males.length || !females.length) ? '—' : Math.abs(maleAvg - femaleAvg).toFixed(2);

  /* ── style helpers (same as the Grades 7–9 sheet) ── */
  const levelShort = (code) => code ? `<span style="font-size:14px;font-weight:800;letter-spacing:0.3px;">${escHtml(code)}</span>` : '—';
  const bar = (t, newPage = false) => `<div class="bar${newPage ? ' pgstart' : ''}" style="padding:5px 14px;background:#ffffff;color:${INK};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-top:3px solid ${LINE};border-bottom:2px solid ${LINE};">${t}</div>`;
  const th  = (label, align = 'center', title = '') => `<th ${title ? `title="${escHtml(title)}"` : ''} style="padding:6px 5px 10px;text-align:${align};font-size:10.5px;font-weight:800;line-height:1.15;color:${INK};background:#ffffff;border-right:1px solid ${LINE};border-bottom:2px solid ${LINE};">${label}</th>`;
  const tdS = (extra = '') => `padding:4px 5px 6px;border-right:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:12px;line-height:1.3;color:${INK};background:#ffffff;${extra}`;

  /* Whole-grade sheets: which class each learner is in, and the position within that class */
  const multi = new Set(allResults.map(r => r.streamName).filter(Boolean)).size > 1;
  const extra = multi ? 2 : 0;
  const shortClass = (nm) => prettyClass(nm).replace(/^Grade\s+/, '');
  const tally = {};
  results.forEach(r => {
    const t = (tally[r.streamName || ''] = tally[r.streamName || ''] || { n: 0, lastTotal: null, lastPos: 0 });
    t.n++;
    if (r[role].total !== t.lastTotal) { t.lastPos = t.n; t.lastTotal = r[role].total; }
    r._streamPos = t.lastPos;
  });
  const classCells = (r, ranked) => multi
    ? `<td style="${tdS('text-align:center;white-space:nowrap;')}">${escHtml(shortClass(r.streamName))}</td><td style="${tdS('text-align:center;font-weight:800;')}">${ranked ? r._streamPos : '—'}</td>`
    : '';

  const areaHeaders = areas.map(a => th(escHtml(a.name), 'center', a.name)).join('');

  const tableRows = results.map(r => {
    const cells = areas.map(a => {
      const c = primaryCell(r, role, a.key);
      const txt = c.txt === '—' || c.txt === 'ABS' ? c.txt : `${c.txt.replace('%', '')}${c.level && c.level !== '—' ? ' ' + c.level : ''}`;
      return `<td style="${tdS('text-align:center;white-space:nowrap;font-weight:600;')}">${escHtml(txt)}</td>`;
    }).join('');
    return `
      <tr>
        <td style="${tdS('text-align:center;font-weight:800;')}">${r._pos}</td>
        <td style="${tdS('text-align:left;font-weight:700;white-space:nowrap;')}">${escHtml(r.fullName)}</td>
        <td style="${tdS('text-align:center;')}">${escHtml(r.gender?.charAt(0).toUpperCase() || '—')}</td>
        ${classCells(r, true)}
        ${cells}
        <td style="${tdS('text-align:center;font-weight:800;')}">${r[role].total}</td>
        <td style="${tdS('text-align:center;font-weight:700;')}">${Math.round(r[role].avg)}%</td>
        <td style="${tdS('text-align:center;white-space:nowrap;border-right:none;')}">${levelShort(primaryLevel(r[role].avg)?.code)}</td>
      </tr>`;
  }).join('');

  const noMarkRows = noMarks.map(r => `
      <tr>
        <td style="${tdS('text-align:center;')}">—</td>
        <td style="${tdS('text-align:left;font-weight:700;white-space:nowrap;')}">${escHtml(r.fullName)}</td>
        <td style="${tdS('text-align:center;')}">${escHtml(r.gender?.charAt(0).toUpperCase() || '—')}</td>
        ${classCells(r, false)}
        ${areas.map(() => `<td style="${tdS('text-align:center;')}">—</td>`).join('')}
        <td style="${tdS('text-align:center;')}">—</td>
        <td style="${tdS('text-align:center;')}">—</td>
        <td style="${tdS('text-align:center;font-weight:800;font-size:12.5px;border-right:none;')}">X</td>
      </tr>`).join('');

  const avgMarksRow = `
    <tr>
      <td colspan="${3 + extra}" style="${tdS(`font-weight:800;border-top:3px double ${LINE};`)}">AVG. MARKS</td>
      ${areas.map(a => `<td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${statOf(a)?.avg ?? 0}%</td>`).join('')}
      <td style="${tdS(`border-top:3px double ${LINE};`)}"></td>
      <td style="${tdS(`text-align:center;font-weight:800;border-top:3px double ${LINE};`)}">${avg.toFixed(1)}%</td>
      <td style="${tdS(`text-align:center;border-top:3px double ${LINE};border-right:none;`)}">${levelShort(classCode)}</td>
    </tr>`;

  /* ── level counts ── */
  const cols = 4 + (xCount > 0 ? 1 : 0);
  const distCells = PRIMARY_SCALE.map(l => `
    <div style="text-align:center;padding:7px 4px;background:#ffffff;border-right:1px solid ${LINE};">
      <div style="font-size:11px;font-weight:800;">${l.code}</div>
      <div style="font-size:16px;font-weight:800;">${dist[l.code]}</div>
    </div>`).join('') + (xCount > 0 ? `
    <div style="text-align:center;padding:7px 4px;background:#ffffff;">
      <div style="font-size:11px;font-weight:800;">X</div>
      <div style="font-size:16px;font-weight:800;">${xCount}</div>
    </div>` : '');

  /* ── learning-area summary, with teacher ── */
  const summaryRows = ranked.map(x => `
    <tr>
      <td style="${tdS('text-align:center;font-weight:800;')}">${x.rank}</td>
      <td style="${tdS('font-weight:700;')}">${escHtml(x.name)}</td>
      <td style="${tdS('text-align:center;font-weight:800;')}">${x.avg}%</td>
      ${PRIMARY_SCALE.map(l => `<td style="${tdS(`text-align:center;font-weight:${x.d[l.code] ? 800 : 400};`)}">${x.d[l.code]}</td>`).join('')}
      <td style="${tdS('font-size:11.5px;border-right:none;')}">${escHtml(teachersOf(x))}</td>
    </tr>`).join('');

  /* ── top 3 per learning area ── */
  const top3Cards = areaStats.map(x => `
    <div class="keep" style="flex:0 0 calc(25% - 7.5px);box-sizing:border-box;border:1.5px solid ${LINE};background:#ffffff;">
      <div style="padding:5px 10px;border-bottom:1.5px solid ${LINE};">
        <div style="font-size:12.5px;font-weight:800;">${escHtml(x.name)}</div>
        <div style="font-size:10.5px;">Avg: ${x.avg}%</div>
      </div>
      <div style="padding:5px 10px;">
        ${x.top3.map((st, i) => `
          <div style="display:flex;gap:6px;padding:3px 0 5px;font-size:12px;${i < x.top3.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}">
            <span style="font-weight:800;">${i + 1}.</span>
            <span style="flex:1;font-weight:600;line-height:1.3;">${escHtml(st.fullName)}</span>
            <span style="font-weight:800;white-space:nowrap;">${Math.round(st.score)} ${escHtml(st.code)}</span>
          </div>`).join('')}
        ${!x.top3.length ? '<div style="font-size:10px;">No data</div>' : ''}
      </div>
    </div>`).join('');

  /* ── gender, per learning area ── */
  const genderRows = areas.map(a => {
    const pick = (list) => list.map(r => r[role]?.map?.[a.key]).filter(v => v && v.score !== null).map(v => v.score);
    const mS = pick(males), fS = pick(females);
    const mA = mS.length ? parseFloat((mS.reduce((p, q) => p + q, 0) / mS.length).toFixed(1)) : 0;
    const fA = fS.length ? parseFloat((fS.reduce((p, q) => p + q, 0) / fS.length).toFixed(1)) : 0;
    const none = !mS.length || !fS.length;
    const leader = none ? '—' : mA > fA ? 'Male' : mA < fA ? 'Female' : 'Tie';
    return `
      <tr>
        <td style="${tdS('font-weight:700;')}">${escHtml(a.name)}</td>
        <td style="${tdS('text-align:center;')}">${mS.length ? mA + '%' : '—'}</td>
        <td style="${tdS('text-align:center;')}">${fS.length ? fA + '%' : '—'}</td>
        <td style="${tdS('text-align:center;')}">${none ? '—' : Math.abs(mA - fA).toFixed(1)}</td>
        <td style="${tdS('text-align:center;font-weight:800;border-right:none;')}">${leader}</td>
      </tr>`;
  }).join('');

  const ctNames = Object.entries(s.classTeachers || {}).filter(([, t]) => t);
  const sigBlock = (title, person, last = false) => `
    <div style="padding:12px 18px;background:#ffffff;${last ? '' : `border-right:1px solid ${LINE};`}">
      <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">${title}${person ? ': ' + escHtml(tidyName(person)) : ''}</div>
      <div style="border-bottom:1.5px solid ${LINE};margin:22px 0 5px;"></div>
      <div style="font-size:9px;">Signature &amp; date: .....................</div>
    </div>`;
  const generated = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return `
<div style="max-width:960px;background:#ffffff;border:2px solid ${LINE};font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${INK};margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;">

  <style>
    @media print { tr, .keep { break-inside: avoid; page-break-inside: avoid; } .bar { break-after: avoid; page-break-after: avoid; } thead { display: table-header-group; } .pgstart { break-before: page; page-break-before: always; } }
  </style>

  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;padding:14px 18px;border-bottom:3px solid ${LINE};">
    <div>${schoolHeader(s, 19)}</div>
    <div style="text-align:right;">
      <div style="font-size:12.5px;font-weight:800;letter-spacing:1px;">ASSESSMENT RESULTS</div>
      <div style="font-size:10.5px;font-weight:600;margin-top:3px;">CLASS: ${escHtml(prettyClass(s.cls))} &nbsp;|&nbsp; TERM: ${escHtml(s.term)} &nbsp;|&nbsp; YEAR: ${escHtml(s.year)} &nbsp;|&nbsp; ASSESSMENT: ${roleName}</div>
    </div>
  </div>

  ${bar('Class rankings')}
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          ${th('Pos')}${th('Learner name', 'left')}${th('G')}${multi ? th('Class') + th('Str pos') : ''}${areaHeaders}${th('Total')}${th('Avg %')}${th('Performance<br/>level')}
        </tr>
      </thead>
      <tbody>${tableRows}${noMarkRows}${avgMarksRow}</tbody>
    </table>
  </div>
  <div style="padding:5px 14px;font-size:10.5px;border-top:1px solid ${LINE};">
    Learner position is assigned using total marks. Performance level is calculated using average marks. Marks are rounded to the nearest whole number before the level is worked out.<br/><strong>Performance level:</strong> ${PRIMARY_SCALE.map(l => `${l.code} = ${l.full} (${l.label})`).join(' &nbsp;·&nbsp; ')}
  </div>

  ${bar('Overall level distribution')}
  <div style="display:grid;grid-template-columns:repeat(${cols},1fr);">${distCells}</div>

  ${bar('Learning area performance summary')}
  <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>${th('Rank')}${th('Learning area', 'left')}${th('Avg mark')}${PRIMARY_SCALE.map(l => th(l.code)).join('')}${th('Subject teacher', 'left')}</tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>

  ${bar('Top 3 learners per learning area')}
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
        <thead><tr>${th('Learning area', 'left')}${th('Male')}${th('Female')}${th('Gap')}${th('Leader')}</tr></thead>
        <tbody>${genderRows}</tbody>
      </table>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:3px solid ${LINE};margin-top:0;">
    ${sigBlock(ctNames.length > 1 ? 'Class teachers' : 'Class teacher', ctNames.length > 1 ? ctNames.map(([c, t]) => `${shortClass(c)}: ${t}`).join(' / ') : (ctNames[0]?.[1] || s.teacher))}
    ${sigBlock('Dean of studies', '')}
    ${sigBlock('Head of Institution', s.principal, true)}
  </div>

  <div style="display:flex;justify-content:space-between;padding:6px 16px;border-top:2px solid ${LINE};font-size:9px;font-weight:600;">
    <span>Report generated on: ${escHtml(generated)}</span>
    <span>Powered by Scholar Analytics</span>
  </div>

</div>`;
};
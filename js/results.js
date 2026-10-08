/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Results Page
   File: js/results.js  Version: 6.0
   v6.0: ONE class dropdown with every choice:
           • Whole Grade (all streams ranked together)
           • each single class (e.g. Grade 7 East, Grade 7 West)
         Exam names come from the exams that actually exist (no
         fixed list), and the academic year is passed correctly to
         the whole-grade results.
   v5.0: subjects shown in fixed order and the performance level
         is shown beside every subject score.
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   KJSEA CSS CLASS MAP
══════════════════════════════════════════════════════════ */
const GRADE_CSS = {
  EE1:'ee1', EE2:'ee2', ME1:'me1', ME2:'me2',
  AE1:'ae1', AE2:'ae2', BE1:'be1', BE2:'be2',
};

const GRADE_COLOURS = {
  EE1:'#1e8449', EE2:'#27ae60',
  ME1:'#1a6fa8', ME2:'#2980b9',
  AE1:'#d68910', AE2:'#ca6f1e',
  BE1:'#c0392b', BE2:'#922b21',
};

const GRADE_BG = {
  EE1:'#d5f5e3', EE2:'#d5f5e3',
  ME1:'#d6eaf8', ME2:'#d6eaf8',
  AE1:'#fef9e7', AE2:'#fdebd0',
  BE1:'#fce4e4', BE2:'#f9d6d6',
};

/* ══════════════════════════════════════════════════════════
   SUBJECT ORDER
   Add any extra codes used in your database to these lists.
══════════════════════════════════════════════════════════ */
const SUBJECT_ORDER = [
  ['ENG'],
  ['MATH','MAT'],
  ['KISW','KIS'],
  ['INTER','INT'],
  ['SST'],
  ['CRE'],
  ['CAS'],
  ['AGN','AGR','AGRI'],
  ['PRETECH','PRT'],
];
const subjIdx = c => {
  const i = SUBJECT_ORDER.findIndex(g => g.includes((c || '').toUpperCase()));
  return i === -1 ? 99 : i;
};
const sortSubjects = arr => [...arr].sort((a, b) => subjIdx(a.code) - subjIdx(b.code));

/* ══════════════════════════════════════════════════════════
   STATE
   scope: 'class' (one class) | 'grade' (whole grade, all streams)
══════════════════════════════════════════════════════════ */
const state = {
  scope   : 'class',
  gradeValue: '',      // e.g. "7" when scope === 'grade'
  classes : [],
  results : [],
  subjects: [],
  stats   : {},
  subjectAverages: [],
  classInfo: null,
  examInfo : null,
};

const esc = (t) => String(t ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* Avatar helpers */
const AV = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = n => n?.trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?';
const getAvColour = n => AV[(n?.charCodeAt(0)||0) % AV.length];

/* ══════════════════════════════════════════════════════════
   DOM REFS
   The old "This Class / Whole Grade" toggle, the separate Grade
   dropdown and the fixed exam-name dropdown are no longer needed:
   they are hidden and replaced by the single Class dropdown.
══════════════════════════════════════════════════════════ */
const selClassEl         = document.getElementById('selClass');
const selTermEl          = document.getElementById('selTerm');
const selExamEl          = document.getElementById('selExam');

const scopeClassBtn      = document.getElementById('scopeClassBtn');
const scopeGradeBtn      = document.getElementById('scopeGradeBtn');
const classFieldWrap     = document.getElementById('classFieldWrap');
const gradeFieldWrap     = document.getElementById('gradeFieldWrap');
const examFieldWrap      = document.getElementById('examFieldWrap');
const examNameFieldWrap  = document.getElementById('examNameFieldWrap');

const hideLegacyControls = () => {
  const a = scopeClassBtn, b = scopeGradeBtn;
  if (a && b && a.parentElement === b.parentElement &&
      a.parentElement.querySelectorAll('button').length === 2) {
    a.parentElement.style.display = 'none';
  } else {
    if (a) a.style.display = 'none';
    if (b) b.style.display = 'none';
  }
  if (gradeFieldWrap)    gradeFieldWrap.style.display    = 'none';
  if (examNameFieldWrap) examNameFieldWrap.style.display = 'none';
  if (classFieldWrap)    classFieldWrap.style.display    = 'flex';
  if (examFieldWrap)     examFieldWrap.style.display     = 'flex';
};

const showPlaceholder = () => {
  const p = document.getElementById('resultsPlaceholder');
  const c = document.getElementById('resultsContent');
  if (p) p.style.display = 'flex';
  if (c) c.style.display = 'none';
};

/* ══════════════════════════════════════════════════════════
   CLASS / GRADE HELPERS
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

/* ══════════════════════════════════════════════════════════
   LOAD CLASSES  (one dropdown: whole grades + single classes)
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;

  state.classes = result.data.classes || [];

  const whole = gradeGroups()
    .filter(([, list]) => list.length > 1)
    .map(([g, list]) =>
      `<option value="grade:${esc(g)}">Grade ${esc(g)} — Whole Grade (${esc(list.map(streamLabel).join(' + '))})</option>`
    ).join('');
  const single = state.classes.map(c =>
    `<option value="${c._id}">${esc(c.name)}</option>`
  ).join('');

  if (selClassEl) {
    selClassEl.innerHTML = '<option value="">-- Select Class --</option>' +
      (whole  ? `<optgroup label="Whole grade (all streams together)">${whole}</optgroup>` : '') +
      (single ? `<optgroup label="Single class">${single}</optgroup>` : '');
  }
};

/* ══════════════════════════════════════════════════════════
   LOAD EXAMS WHEN CLASS + TERM SELECTED
   Single class  → option value = exam id
   Whole grade   → option value = "year|exam name"
══════════════════════════════════════════════════════════ */
const loadExams = async () => {
  const value = selClassEl?.value;
  const term  = selTermEl?.value;
  if (!value || !term || !selExamEl) return;

  const targets = targetsOf(value);
  if (!targets.length) return;

  selExamEl.innerHTML = '<option value="">Loading...</option>';

  if (!isGradeValue(value)) {
    const result = await API.get(`/exams?class=${value}&term=${term}`);
    if (!result?.ok || !result.data.exams?.length) {
      selExamEl.innerHTML = '<option value="">No exams found</option>';
      return;
    }
    selExamEl.innerHTML = '<option value="">-- Select Exam --</option>' +
      result.data.exams.map(e => `<option value="${e._id}">${esc(e.name)}</option>`).join('');
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
    selExamEl.innerHTML = '<option value="">No exams found</option>';
    return;
  }

  const manyYears = new Set(keys.map(k => map[k].year)).size > 1;

  selExamEl.innerHTML = '<option value="">-- Select Exam --</option>' + keys.map(k => {
    const x = map[k];
    const missing = targets.filter(c => !x.classes.includes(c));
    const note = missing.length ? ` — not in ${missing.map(streamLabel).join(', ')}` : '';
    return `<option value="${esc(k)}">${esc(x.name)}${manyYears ? ` (${esc(x.year)})` : ''}${esc(note)}</option>`;
  }).join('');
};

selClassEl?.addEventListener('change', () => {
  const v = selClassEl.value;
  state.scope      = isGradeValue(v) ? 'grade' : 'class';
  state.gradeValue = isGradeValue(v) ? v.slice(6) : '';
  if (selExamEl) selExamEl.innerHTML = '<option value="">-- Select Exam --</option>';
  showPlaceholder();
  loadExams();
});

selTermEl?.addEventListener('change', () => {
  showPlaceholder();
  loadExams();
});

/* ══════════════════════════════════════════════════════════
   LOAD RESULTS FROM API — branches by scope
══════════════════════════════════════════════════════════ */
document.getElementById('loadResultsBtn')?.addEventListener('click', loadResults);

async function loadResults() {
  const term      = selTermEl?.value;
  const classVal  = selClassEl?.value;
  const examVal   = selExamEl?.value;

  if (!term) {
    showToast('Please select a Term.', 'warning');
    flashField('selTerm');
    return;
  }

  if (!classVal || !examVal) {
    showToast('Please select Class and Exam.', 'warning');
    flashField('selClass'); flashField('selExam');
    return;
  }

  let apiUrl;

  if (state.scope === 'class') {
    apiUrl = `/results/class?classId=${classVal}&examId=${examVal}`;
  } else {
    const i        = examVal.indexOf('|');
    const year     = examVal.slice(0, i);
    const examName = examVal.slice(i + 1);
    apiUrl = `/results/grade?grade=${encodeURIComponent(state.gradeValue)}&term=${term}` +
             `&examName=${encodeURIComponent(examName)}&academicYear=${encodeURIComponent(year)}`;
  }

  /* Show loading */
  document.getElementById('resultsPlaceholder').style.display = 'none';
  document.getElementById('resultsContent').style.display     = 'block';

  const tbody = document.getElementById('resultsTableBody');
  if (tbody) tbody.innerHTML = Skeleton.table(8, 14);

  const result = await API.get(apiUrl);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to load results.', 'error');
    showPlaceholder();
    return;
  }

  const data = result.data;

  state.results         = data.results         || [];
  state.subjects        = sortSubjects(data.subjects || []);
  state.stats           = data.stats            || {};
  state.subjectAverages = sortSubjects(data.subjectAverages || []);

  if (state.scope === 'class') {
    state.classInfo = data.class;
    state.examInfo  = data.exam;
  } else {
    state.classInfo = { name: `Grade ${data.grade} — Whole Grade (${(data.streams || []).join(' + ')})` };
    state.examInfo  = data.exam;
  }

  /* Update subtitle */
  const subtitle = document.getElementById('resultsSubtitle');
  if (subtitle) {
    subtitle.textContent =
      `${state.classInfo?.name} | Term ${state.examInfo?.term} ${state.examInfo?.name} | ${state.examInfo?.academicYear}`;
  }

  renderStats(state.stats);
  renderSubjectAverages(state.subjectAverages);
  renderTable(state.results, state.subjects);

  showToast(`Results loaded — ${state.results.length} learners.`, 'success');
}

const flashField = (id) => {
  const e = document.getElementById(id);
  if (e && !e.value) {
    e.style.borderColor = 'var(--danger)';
    setTimeout(() => e.style.borderColor = '', 1400);
  }
};

/* ══════════════════════════════════════════════════════════
   RENDER STATS
══════════════════════════════════════════════════════════ */
const renderStats = (stats) => {
  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val ?? '--';
  };

  set('statTotal',    stats.total);
  set('statAvg',      stats.avg + '%');
  set('statPassRate', stats.passRate + '%');
  set('statHighest',  stats.highest + '%');
  set('statLowest',   stats.lowest  + '%');
};

/* ══════════════════════════════════════════════════════════
   RENDER SUBJECT AVERAGES
══════════════════════════════════════════════════════════ */
const renderSubjectAverages = (averages) => {
  const wrap = document.getElementById('subjectAveragesBar');
  if (!wrap) return;

  const getBarColour = (avg) => {
    if (avg >= 75) return '#27ae60';
    if (avg >= 58) return '#2e86c1';
    if (avg >= 41) return '#e67e22';
    return '#e74c3c';
  };

  wrap.innerHTML = `<div class="subj-avg-grid">
    ${averages.map(s => `
      <div class="subj-avg-item">
        <div class="subj-avg-code">${s.code}</div>
        <div class="subj-avg-name">${s.name}</div>
        <div class="subj-avg-score">${s.avg}%</div>
        <div class="subj-avg-bar-wrap">
          <div class="subj-avg-bar-fill"
            style="width:${s.avg}%;background:${getBarColour(s.avg)};"></div>
        </div>
      </div>`
    ).join('')}
  </div>`;
};

/* ══════════════════════════════════════════════════════════
   RENDER RESULTS TABLE
   Subject columns matched by CODE (not subjectId) — required
   for Whole Grade scope where each stream has its own Subject
   documents; works the same way for single-class scope too.
══════════════════════════════════════════════════════════ */
const renderTable = (results, subjects) => {
  const thead = document.getElementById('resultsTableHead');
  const tbody = document.getElementById('resultsTableBody');
  const tfoot = document.getElementById('resultsTableFoot');

  if (!thead || !tbody) return;

  const showStream = state.scope === 'grade';

  /* ── Build header ───────────────────────────────────── */
  thead.innerHTML = `
    <tr>
      <th class="col-rank" rowspan="2">#</th>
      <th class="col-name" rowspan="2">Learner Name</th>
      <th class="col-upi"  rowspan="2">UPI No.</th>
      ${showStream ? '<th class="col-upi" rowspan="2">Stream</th>' : ''}
      <th colspan="${subjects.length}" style="border-bottom:1px solid rgba(255,255,255,0.10);">
        Subject Scores
      </th>
      <th class="col-total" rowspan="2">Total</th>
      <th class="col-avg"   rowspan="2">Avg%</th>
      <th class="col-pts"   rowspan="2">Points</th>
      <th class="col-grade" rowspan="2">Grade</th>
      <th class="col-actions" rowspan="2"></th>
    </tr>
    <tr>
      ${subjects.map(s =>
        `<th class="col-subj" title="${s.name}">${s.code}</th>`
      ).join('')}
    </tr>`;

  /* ── Build body ─────────────────────────────────────── */
  if (!results.length) {
    tbody.innerHTML = `
      <tr><td colspan="${subjects.length + (showStream ? 9 : 8)}"
        style="text-align:center;padding:48px;color:var(--text-soft);">
        <i class="fas fa-inbox" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.2;"></i>
        No results found. Make sure marks have been entered for this exam.
      </td></tr>`;
    return;
  }

  const rankClass = (pos) => {
    if (pos === 1) return 'gold';
    if (pos === 2) return 'silver';
    if (pos === 3) return 'bronze';
    return 'other';
  };

  const rankLabel = (pos) => {
    if (pos === 1) return '🥇 1st';
    if (pos === 2) return '🥈 2nd';
    if (pos === 3) return '🥉 3rd';
    return `${pos}th`;
  };

  tbody.innerHTML = results.map((r, i) => {

    const subjectCells = subjects.map(subj => {
      const sr = r.subjectResults?.find(s => s.code === subj.code);

      if (!sr || sr.notEntered) {
        return `<td><span class="res-score" style="color:var(--text-light);background:transparent;">—</span></td>`;
      }

      if (sr.absent) {
        return `<td><span class="res-score abs">ABS</span></td>`;
      }

      const css = GRADE_CSS[sr.grade] || '';
      return `<td><span class="res-score ${css}">${sr.score} <small style="font-size:0.7em;font-weight:700;">${sr.grade || ''}</small></span></td>`;
    }).join('');

    const meanBg    = GRADE_BG[r.meanGrade]     || '#f0f4f8';
    const meanColor = GRADE_COLOURS[r.meanGrade] || '#666';

    const rowClass =
      r.position === 1 ? 'top-1' :
      r.position === 2 ? 'top-2' :
      r.position === 3 ? 'top-3' : '';

    return `
      <tr class="${rowClass}" onclick="viewStudent('${r.studentId}')">
        <td>
          <span class="res-rank ${rankClass(r.position)}">${rankLabel(r.position)}</span>
        </td>
        <td class="col-name">
          <div class="res-name-cell">
            <div class="res-avatar ${getAvColour(r.fullName)}">
              ${getInitials(r.fullName)}
            </div>
            <div>
              <div class="res-name">${r.fullName}</div>
              <div class="res-gender">${r.gender?.charAt(0).toUpperCase()+r.gender?.slice(1)||'—'}</div>
            </div>
          </div>
        </td>
        <td class="col-upi">
          <span class="upi-code">${r.upiNumber || '—'}</span>
        </td>
        ${showStream ? `<td class="col-upi"><span class="upi-code">${r.streamName || '—'}</span></td>` : ''}
        ${subjectCells}
        <td><span class="res-total">${r.totalScore}</span></td>
        <td><span class="res-avg">${r.avgScore}%</span></td>
        <td><span class="res-pts">${r.totalPoints}<span style="font-size:9px;color:#94a3b8;">/${r.subjectCount*8}</span></span></td>
        <td>
          <span class="res-mean-badge"
            style="background:${meanBg};color:${meanColor};">
            ${r.meanGrade || '—'}
          </span>
        </td>
        <td>
          <button class="res-view-btn" onclick="event.stopPropagation();viewStudent('${r.studentId}')"
            title="View details">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  /* ── Build footer — class averages ──────────────────── */
  if (tfoot && results.length) {
    const subjAvgCells = subjects.map(subj => {
      const sa = state.subjectAverages.find(a => a.code === subj.code);
      const avg    = sa?.avg || 0;
      const css    = avg >= 75 ? 'ee2' : avg >= 58 ? 'me1' : avg >= 41 ? 'me2' : 'ae1';
      return `<td><span class="res-score ${css}">${avg}%</span></td>`;
    }).join('');

    tfoot.innerHTML = `
      <tr>
        <td colspan="${showStream ? 4 : 3}" style="text-align:left;font-size:var(--text-xs);font-weight:700;color:var(--text-soft);text-transform:uppercase;">
          ${showStream ? 'Grade Average' : 'Class Average'}
        </td>
        ${subjAvgCells}
        <td></td>
        <td><span style="font-weight:700;color:var(--primary);">${state.stats.avg}%</span></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`;
  }
};

/* ══════════════════════════════════════════════════════════
   VIEW STUDENT DETAIL
══════════════════════════════════════════════════════════ */
window.viewStudent = (studentId) => {
  const r = state.results.find(
    res => res.studentId?.toString() === studentId?.toString()
  );
  if (!r) return;

  /* Update modal header */
  const nameEl = document.getElementById('detailStudentName');
  const metaEl = document.getElementById('detailStudentMeta');
  if (nameEl) nameEl.textContent = r.fullName;
  if (metaEl) {
    metaEl.textContent =
      `${state.classInfo?.name}${r.streamName ? ' — ' + r.streamName : ''} | Term ${state.examInfo?.term} ${state.examInfo?.name} | Rank: ${r.position}`;
  }

  /* Build subject breakdown (sorted in the fixed subject order) */
  const body = document.getElementById('detailModalBody');
  if (body) {
    const meanBg    = GRADE_BG[r.meanGrade]     || '#f0f4f8';
    const meanColor = GRADE_COLOURS[r.meanGrade] || '#666';
    const orderedResults = sortSubjects(r.subjectResults || []);

    body.innerHTML = `
      <!-- Summary row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:var(--bg-light);border-radius:var(--radius-sm);padding:14px;text-align:center;">
          <p style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:var(--text-dark);">${r.totalScore}</p>
          <p style="font-size:var(--text-xs);color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">Total Score</p>
        </div>
        <div style="background:var(--bg-light);border-radius:var(--radius-sm);padding:14px;text-align:center;">
          <p style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:var(--primary);">${r.avgScore}%</p>
          <p style="font-size:var(--text-xs);color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">Average</p>
        </div>
        <div style="background:var(--bg-light);border-radius:var(--radius-sm);padding:14px;text-align:center;">
          <p style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:#7d3c98;">${r.totalPoints}<span style="font-size:0.8rem;color:var(--text-soft);">/${r.subjectCount*8}</span></p>
          <p style="font-size:var(--text-xs);color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">KJSEA Points</p>
        </div>
        <div style="background:${meanBg};border-radius:var(--radius-sm);padding:14px;text-align:center;border:1px solid ${meanColor}22;">
          <p style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:${meanColor};">${r.meanGrade || '—'}</p>
          <p style="font-size:var(--text-xs);color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;">Mean Grade</p>
        </div>
      </div>

      <!-- Subject breakdown -->
      <div style="border:1px solid var(--border-light);border-radius:var(--radius-sm);overflow:hidden;">
        ${orderedResults.map((sr, i) => {
          const rowBg  = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          const css    = GRADE_CSS[sr.grade] || '';
          const colour = GRADE_COLOURS[sr.grade] || '#94a3b8';
          const pct    = sr.score || 0;

          return `
            <div class="detail-subject-row" style="background:${rowBg};">
              <div class="detail-subj-name">${sr.name}</div>
              <div class="detail-subj-score-bar">
                <div class="detail-subj-score-fill"
                  style="width:${pct}%;background:${colour};"></div>
              </div>
              <div style="min-width:52px;text-align:right;">
                ${sr.absent
                  ? `<span class="res-score abs">ABS</span>`
                  : sr.notEntered
                  ? `<span style="color:var(--text-light);font-size:11px;">—</span>`
                  : `<span class="res-score ${css}">${sr.score}%</span>`
                }
              </div>
              <div style="min-width:36px;text-align:right;font-size:11px;font-weight:700;color:#7d3c98;">
                ${sr.absent || sr.notEntered ? '' : sr.points + 'pts'}
              </div>
              <div style="min-width:36px;text-align:right;">
                ${sr.grade
                  ? `<span style="font-size:0.65rem;font-weight:700;background:${GRADE_BG[sr.grade]};color:${colour};padding:2px 6px;border-radius:3px;">${sr.grade}</span>`
                  : ''
                }
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  /* Open modal */
  document.getElementById('studentDetailOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

/* Close detail modal */
const closeDetail = () => {
  document.getElementById('studentDetailOverlay').classList.remove('open');
  document.body.style.overflow = '';
};

document.getElementById('closeDetailModal')?.addEventListener('click', closeDetail);
document.getElementById('closeDetailBtn')?.addEventListener('click',   closeDetail);

/* ══════════════════════════════════════════════════════════
   EXPORT CSV  (score and level shown together, e.g. "72 ME1")
══════════════════════════════════════════════════════════ */
document.getElementById('exportResultsBtn')?.addEventListener('click', () => {
  if (!state.results.length) {
    showToast('No results to export.', 'warning');
    return;
  }

  const headers = [
    'Position','Full Name','UPI Number','Gender',
    ...(state.scope === 'grade' ? ['Stream'] : []),
    ...state.subjects.map(s => s.code),
    'Total Score','Average%','Total Points','Mean Grade',
  ];

  const rows = state.results.map(r => {
    const subjectScores = state.subjects.map(subj => {
      const sr = r.subjectResults?.find(s => s.code === subj.code);
      if (!sr || sr.notEntered) return '—';
      if (sr.absent) return 'ABS';
      return `${sr.score} ${sr.grade || ''}`.trim();
    });

    return [
      r.position, r.fullName, r.upiNumber||'',
      r.gender||'',
      ...(state.scope === 'grade' ? [r.streamName||''] : []),
      ...subjectScores,
      r.totalScore, r.avgScore+'%',
      r.totalPoints, r.meanGrade||'—',
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(r =>
      r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  a.href     = url;
  a.download = `Results_${state.classInfo?.name||'Class'}_${state.examInfo?.name||'Exam'}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`${state.results.length} results exported to CSV.`, 'success');
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
hideLegacyControls();
loadClasses();
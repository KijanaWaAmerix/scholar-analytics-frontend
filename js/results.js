/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Results Page
   File: js/results.js  Version: 4.0
   v4.0: added This Class / Whole Grade scope toggle.
   Subject column matching switched from subjectId to subject
   code, since combined grade results span multiple streams —
   each stream has its own separate Subject documents even for
   "the same" subject, but codes stay consistent across streams.
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
   STATE
══════════════════════════════════════════════════════════ */
const state = {
  scope   : 'class', // 'class' | 'grade'
  classes : [],
  exams   : [],
  results : [],
  subjects: [],
  stats   : {},
  subjectAverages: [],
  classInfo: null,
  examInfo : null,
};

/* Avatar helpers */
const AV = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = n => n?.trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?';
const getAvColour = n => AV[(n?.charCodeAt(0)||0) % AV.length];

/* ══════════════════════════════════════════════════════════
   SCOPE TOGGLE — This Class vs Whole Grade
══════════════════════════════════════════════════════════ */
const scopeClassBtn      = document.getElementById('scopeClassBtn');
const scopeGradeBtn      = document.getElementById('scopeGradeBtn');
const classFieldWrap     = document.getElementById('classFieldWrap');
const gradeFieldWrap     = document.getElementById('gradeFieldWrap');
const examFieldWrap      = document.getElementById('examFieldWrap');
const examNameFieldWrap  = document.getElementById('examNameFieldWrap');
const selGrade           = document.getElementById('selGrade');
const selExamName        = document.getElementById('selExamName');

const setScope = (scope) => {
  state.scope = scope;
  scopeClassBtn?.classList.toggle('active', scope === 'class');
  scopeGradeBtn?.classList.toggle('active', scope === 'grade');

  if (classFieldWrap)    classFieldWrap.style.display    = scope === 'class' ? 'flex' : 'none';
  if (gradeFieldWrap)    gradeFieldWrap.style.display     = scope === 'grade' ? 'flex' : 'none';
  if (examFieldWrap)     examFieldWrap.style.display      = scope === 'class' ? 'flex' : 'none';
  if (examNameFieldWrap) examNameFieldWrap.style.display  = scope === 'grade' ? 'flex' : 'none';

  document.getElementById('resultsPlaceholder').style.display = 'flex';
  document.getElementById('resultsContent').style.display     = 'none';
};

scopeClassBtn?.addEventListener('click', () => setScope('class'));
scopeGradeBtn?.addEventListener('click', () => setScope('grade'));

/* ══════════════════════════════════════════════════════════
   LOAD CLASSES (also derives the distinct Grade list)
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;

  state.classes = result.data.classes || [];

  const sel = document.getElementById('selClass');
  if (sel) {
    sel.innerHTML = '<option value="">-- Select Class --</option>' +
      state.classes.map(c =>
        `<option value="${c._id}">${c.name}</option>`
      ).join('');
  }

  /* Distinct grades, derived client-side from each class's `grade` field */
  const grades = [...new Set(state.classes.map(c => c.grade).filter(Boolean))];
  if (selGrade) {
    selGrade.innerHTML = '<option value="">-- Select Grade --</option>' +
      grades.map(g => `<option value="${g}">${g}</option>`).join('');
  }
};

/* ══════════════════════════════════════════════════════════
   LOAD EXAMS WHEN CLASS + TERM SELECTED (This Class mode)
══════════════════════════════════════════════════════════ */
const loadExams = async () => {
  const classId = document.getElementById('selClass')?.value;
  const term    = document.getElementById('selTerm')?.value;

  if (!classId || !term) return;

  const sel = document.getElementById('selExam');
  if (sel) sel.innerHTML = '<option value="">Loading...</option>';

  const result = await API.get(`/exams?class=${classId}&term=${term}`);

  if (!result?.ok || !result.data.exams?.length) {
    if (sel) sel.innerHTML = '<option value="">No exams found</option>';
    return;
  }

  state.exams = result.data.exams;

  if (sel) {
    sel.innerHTML = '<option value="">-- Select Exam --</option>' +
      state.exams.map(e =>
        `<option value="${e._id}">${e.name}</option>`
      ).join('');
  }
};

document.getElementById('selClass')?.addEventListener('change', () => {
  loadExams();
  document.getElementById('selExam').innerHTML = '<option value="">-- Select Exam --</option>';
});

document.getElementById('selTerm')?.addEventListener('change', () => {
  if (state.scope === 'class') loadExams();
});

/* ══════════════════════════════════════════════════════════
   LOAD RESULTS FROM API — branches by scope
══════════════════════════════════════════════════════════ */
document.getElementById('loadResultsBtn')?.addEventListener('click', loadResults);

async function loadResults() {
  const term = document.getElementById('selTerm')?.value;

  if (!term) {
    showToast('Please select a Term.', 'warning');
    flashField('selTerm');
    return;
  }

  let apiUrl;
  let missingMsg;

  if (state.scope === 'class') {
    const classId = document.getElementById('selClass')?.value;
    const examId  = document.getElementById('selExam')?.value;

    if (!classId || !examId) {
      showToast('Please select Class and Exam.', 'warning');
      flashField('selClass'); flashField('selExam');
      return;
    }

    apiUrl = `/results/class?classId=${classId}&examId=${examId}`;

  } else {
    const grade    = selGrade?.value;
    const examName = selExamName?.value;

    if (!grade || !examName) {
      showToast('Please select Grade and Exam.', 'warning');
      flashField('selGrade'); flashField('selExamName');
      return;
    }

    apiUrl = `/results/grade?grade=${encodeURIComponent(grade)}&term=${term}&examName=${encodeURIComponent(examName)}`;
  }

  /* Show loading */
  document.getElementById('resultsPlaceholder').style.display = 'none';
  document.getElementById('resultsContent').style.display     = 'block';

  const tbody = document.getElementById('resultsTableBody');
  if (tbody) tbody.innerHTML = Skeleton.table(8, 14);

  const result = await API.get(apiUrl);

  if (!result?.ok) {
    showToast(result?.data?.message || 'Failed to load results.', 'error');
    document.getElementById('resultsPlaceholder').style.display = 'flex';
    document.getElementById('resultsContent').style.display     = 'none';
    return;
  }

  const data = result.data;

  state.results         = data.results         || [];
  state.subjects        = data.subjects         || [];
  state.stats           = data.stats            || {};
  state.subjectAverages = data.subjectAverages  || [];

  /* Class-scope response has data.class/data.exam;
     Grade-scope response has data.grade/data.streams/data.exam (name-only) */
  if (state.scope === 'class') {
    state.classInfo = data.class;
    state.examInfo  = data.exam;
  } else {
    state.classInfo = { name: `${data.grade} (${(data.streams || []).join(' + ')})` };
    state.examInfo  = data.exam;
  }

  /* Update subtitle */
  const subtitle = document.getElementById('resultsSubtitle');
  if (subtitle) {
    subtitle.textContent =
      `${state.classInfo?.name} | Term ${state.examInfo?.term} ${state.examInfo?.name} | ${state.examInfo?.academicYear}`;
  }

  renderStats(data.stats);
  renderSubjectAverages(data.subjectAverages);
  renderTable(data.results, data.subjects);

  showToast(`Results loaded — ${data.results.length} learners.`, 'success');
}

const flashField = (id) => {
  const el = document.getElementById(id);
  if (el && !el.value) {
    el.style.borderColor = 'var(--danger)';
    setTimeout(() => el.style.borderColor = '', 1400);
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
      return `<td><span class="res-score ${css}">${sr.score}</span></td>`;
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
          Class Average
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

  /* Build subject breakdown */
  const body = document.getElementById('detailModalBody');
  if (body) {
    const meanBg    = GRADE_BG[r.meanGrade]     || '#f0f4f8';
    const meanColor = GRADE_COLOURS[r.meanGrade] || '#666';

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
        ${(r.subjectResults || []).map((sr, i) => {
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
   EXPORT CSV
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
      return sr.score;
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
loadClasses();
/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Analytics Page
   File: js/analytics.js  Version: 2.0
   Connected to real backend
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   CHART INSTANCES
══════════════════════════════════════════════════════════ */
let trendChartInst   = null;
let gradeChartInst   = null;
let classChartInst   = null;
let subjectChartInst = null;

const destroyChart = (inst) => { if (inst) inst.destroy(); };

/* ══════════════════════════════════════════════════════════
   GRADE COLOURS
══════════════════════════════════════════════════════════ */
const GRADE_COLOURS = {
  EE1:'#1e8449', EE2:'#27ae60',
  ME1:'#1a6fa8', ME2:'#2980b9',
  AE1:'#d68910', AE2:'#ca6f1e',
  BE1:'#c0392b', BE2:'#922b21',
};

const getBarColour = (avg) => {
  if (avg >= 75) return '#27ae60';
  if (avg >= 58) return '#2e86c1';
  if (avg >= 41) return '#e67e22';
  return '#e74c3c';
};

/* ══════════════════════════════════════════════════════════
   LOAD DROPDOWNS
══════════════════════════════════════════════════════════ */
const loadDropdowns = async () => {
  const [classRes, examRes] = await Promise.all([
    API.get('/classes'),
    API.get('/exams'),
  ]);

  const classes = classRes?.data?.classes || [];
  const exams   = examRes?.data?.exams   || [];

  /* Populate all class dropdowns */
  ['globalClass','trendClassFilter','subjClassFilter'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const firstOpt = sel.options[0];
    sel.innerHTML  = '';
    sel.appendChild(firstOpt);
    classes.forEach(c => {
      sel.innerHTML += `<option value="${c._id}">${c.name}</option>`;
    });
  });

  /* Exam dropdown */
  const examSel = document.getElementById('globalExam');
  if (examSel) {
    examSel.innerHTML = '<option value="">-- Select Exam --</option>' +
      exams.map(e =>
        `<option value="${e._id}">[T${e.term}] ${e.name} — ${e.class?.name || ''}</option>`
      ).join('');
  }
};

/* ══════════════════════════════════════════════════════════
   LOAD OVERVIEW STATS
══════════════════════════════════════════════════════════ */
const loadOverview = async () => {
  const result = await API.get('/analytics/overview');
  if (!result?.ok) return;

  const { stats } = result.data;

  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val ?? '--';
  };

  set('kpiStudents', stats.totalStudents);
  set('kpiClasses',  stats.totalClasses);
  set('kpiAvg',      (stats.latestStats?.avg || 0) + '%');
  set('kpiPass',     (stats.latestStats?.passRate || 0) + '%');
};

/* ══════════════════════════════════════════════════════════
   TREND CHART
══════════════════════════════════════════════════════════ */
const loadTrendChart = async (classId = 'all') => {
  const url    = `/analytics/trend${classId !== 'all' ? `?classId=${classId}` : ''}`;
  const result = await API.get(url);
  if (!result?.ok || !result.data.trend?.length) return;

  const { trend } = result.data;
  const canvas    = document.getElementById('trendChart');
  if (!canvas) return;

  destroyChart(trendChartInst);

  trendChartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels  : trend.map(t => t.label),
      datasets: [{
        label          : 'Average Score',
        data           : trend.map(t => t.avg),
        borderColor    : '#1a5276',
        backgroundColor: 'rgba(26,82,118,0.08)',
        borderWidth    : 2.5,
        pointRadius    : 5,
        pointBackgroundColor: '#1a5276',
        fill           : true,
        tension        : 0.4,
      }],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      interaction        : { mode:'index', intersect:false },
      plugins: {
        legend : { display:false },
        tooltip: {
          backgroundColor: '#0a2540',
          callbacks: { label: ctx => ` Average: ${ctx.parsed.y}%` },
        },
      },
      scales: {
        x: { grid:{ color:'rgba(209,220,235,0.4)' }, ticks:{ font:{size:11}, color:'#718096' } },
        y: {
          min: 0, max: 100,
          grid : { color:'rgba(209,220,235,0.4)' },
          ticks: { font:{size:11}, color:'#718096', callback: v => v + '%' },
        },
      },
    },
  });
};

/* ══════════════════════════════════════════════════════════
   GRADE DISTRIBUTION CHART
══════════════════════════════════════════════════════════ */
const loadGradeChart = async (examId = '', classId = 'all') => {
  if (!examId) return;

  let url = `/analytics/grade-distribution?examId=${examId}`;
  if (classId !== 'all') url += `&classId=${classId}`;

  const result = await API.get(url);
  if (!result?.ok) return;

  const { dist, total } = result.data;
  const grades  = Object.keys(dist);
  const counts  = Object.values(dist);
  const canvas  = document.getElementById('gradeChart');
  const legend  = document.getElementById('gradeLegend');
  if (!canvas) return;

  destroyChart(gradeChartInst);

  gradeChartInst = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels  : grades,
      datasets: [{
        data           : counts,
        backgroundColor: grades.map(g => GRADE_COLOURS[g]),
        borderColor    : '#ffffff',
        borderWidth    : 2,
        hoverOffset    : 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout:'68%',
      plugins: {
        legend : { display:false },
        tooltip: {
          backgroundColor: '#0a2540',
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed/total*100)}%)` },
        },
      },
    },
  });

  if (legend) {
    const maxCount = Math.max(...counts, 1);
    legend.innerHTML = grades.map((g, i) => `
      <div class="analytics-grade-legend-item">
        <span class="analytics-grade-legend-dot" style="background:${GRADE_COLOURS[g]};"></span>
        <span class="analytics-grade-legend-label">${g}</span>
        <span class="analytics-grade-legend-count">${counts[i]}</span>
        <div class="analytics-grade-legend-bar-wrap">
          <div class="analytics-grade-legend-bar"
            style="width:${Math.round(counts[i]/maxCount*100)}%;background:${GRADE_COLOURS[g]};"></div>
        </div>
      </div>`
    ).join('');
  }
};

/* ══════════════════════════════════════════════════════════
   CLASS COMPARISON CHART
══════════════════════════════════════════════════════════ */
const loadClassChart = async (examId) => {
  if (!examId) return;

  const result = await API.get(`/analytics/class-comparison?examId=${examId}`);
  if (!result?.ok || !result.data.comparison?.length) return;

  const { comparison } = result.data;
  const canvas          = document.getElementById('classChart');
  if (!canvas) return;

  destroyChart(classChartInst);

  classChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels  : comparison.map(c => c.className),
      datasets: [{
        label          : 'Average Score',
        data           : comparison.map(c => c.avg),
        backgroundColor: comparison.map(c => getBarColour(c.avg)),
        borderRadius   : 6,
        borderSkipped  : false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend : { display:false },
        tooltip: {
          backgroundColor: '#0a2540',
          callbacks: {
            label: ctx => [
              ` Average: ${ctx.parsed.y}%`,
              ` Pass Rate: ${comparison[ctx.dataIndex].passRate}%`,
            ],
          },
        },
      },
      scales: {
        x: { grid:{ display:false }, ticks:{ font:{size:11}, color:'#4a5568' } },
        y: {
          min:0, max:100,
          grid : { color:'rgba(209,220,235,0.4)' },
          ticks: { font:{size:11}, color:'#718096', callback: v => v + '%' },
        },
      },
    },
  });
};

/* ══════════════════════════════════════════════════════════
   SUBJECT PERFORMANCE CHART
══════════════════════════════════════════════════════════ */
const loadSubjectChart = async (classId, examId) => {
  if (!classId || !examId) return;

  const result = await API.get(`/analytics/subject-performance?classId=${classId}&examId=${examId}`);
  if (!result?.ok || !result.data.performance?.length) return;

  const { performance } = result.data;
  const canvas           = document.getElementById('subjectChart');
  if (!canvas) return;

  destroyChart(subjectChartInst);

  subjectChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels  : performance.map(s => s.code),
      datasets: [{
        label          : 'Average Score',
        data           : performance.map(s => s.avg),
        backgroundColor: performance.map(s => getBarColour(s.avg)),
        borderRadius   : 5,
        borderSkipped  : false,
      }],
    },
    options: {
      indexAxis  : 'y',
      responsive : true, maintainAspectRatio: false,
      plugins: {
        legend : { display:false },
        tooltip: {
          backgroundColor: '#0a2540',
          callbacks: {
            title: (ctx) => performance[ctx[0].dataIndex].subjectName,
            label: ctx => ` Average: ${ctx.parsed.x}%`,
          },
        },
      },
      scales: {
        x: {
          min:0, max:100,
          grid : { color:'rgba(209,220,235,0.4)' },
          ticks: { font:{size:11}, color:'#718096', callback: v => v + '%' },
        },
        y: { grid:{ display:false }, ticks:{ font:{size:11}, color:'#4a5568' } },
      },
    },
  });
};

/* ══════════════════════════════════════════════════════════
   AT-RISK STUDENTS
══════════════════════════════════════════════════════════ */
const loadAtRisk = async (examId) => {
  if (!examId) return;

  const result = await API.get(`/analytics/at-risk?examId=${examId}`);
  if (!result?.ok) return;

  const { atRisk } = result.data;

  const countEl = document.getElementById('atRiskCount');
  if (countEl) countEl.textContent = `${atRisk.length} learners`;

  const tbody = document.getElementById('atRiskBody');
  if (!tbody) return;

  if (!atRisk.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--success);">
      <i class="fas fa-circle-check"></i> No at-risk learners for this exam.
    </td></tr>`;
    return;
  }

  const AV = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
  const getInitials = n => n?.trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?';
  const getAv       = n => AV[(n?.charCodeAt(0)||0) % AV.length];

  tbody.innerHTML = atRisk.map((s, i) => {
    const gradeColour = s.avg >= 31 ? '#e67e22' : s.avg >= 21 ? '#c0392b' : '#922b21';
    return `
      <tr>
        <td>${i+1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="${getAv(s.fullName)}" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:700;color:white;flex-shrink:0;">
              ${getInitials(s.fullName)}
            </div>
            <span style="font-weight:600;">${s.fullName}</span>
          </div>
        </td>
        <td>${s.className}</td>
        <td>
          <strong style="color:${gradeColour};">${s.avg}%</strong>
        </td>
        <td>
          <span style="background:var(--danger-light);color:var(--danger);padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:700;">
            Below 41%
          </span>
        </td>
        <td>
          <a href="results.html" style="font-size:0.78rem;font-weight:600;color:var(--primary-light);text-decoration:none;">
            View Results →
          </a>
        </td>
      </tr>`;
  }).join('');
};

/* ══════════════════════════════════════════════════════════
   FILTER EVENTS
══════════════════════════════════════════════════════════ */
document.getElementById('globalExam')?.addEventListener('change', async (e) => {
  const examId  = e.target.value;
  const classId = document.getElementById('globalClass')?.value || 'all';
  if (!examId) return;
  await Promise.all([
    loadGradeChart(examId, classId),
    loadClassChart(examId),
    loadAtRisk(examId),
  ]);
});

document.getElementById('globalClass')?.addEventListener('change', (e) => {
  const examId = document.getElementById('globalExam')?.value;
  if (examId) loadGradeChart(examId, e.target.value);
});

document.getElementById('trendClassFilter')?.addEventListener('change', (e) => {
  loadTrendChart(e.target.value);
});

document.getElementById('subjClassFilter')?.addEventListener('change', (e) => {
  const examId = document.getElementById('globalExam')?.value;
  if (examId) loadSubjectChart(e.target.value, examId);
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
const init = async () => {
  await loadDropdowns();
  await loadOverview();
  await loadTrendChart('all');
};

init();
/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Dashboard
   File: js/dashboard.js  Version: 3.1 (wired to real endpoints)
═══════════════════════════════════════════════════════════ */

const currentUser = requireAuth();
if (!currentUser) throw new Error('Not authenticated');
initSidebar(currentUser);

const PASS_MARK = 41;
const state = { classes: [], exams: [], latestExam: null, charts: {} };

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const e = $(id); if (e) e.textContent = v ?? '--'; };
const hide = (el) => { if (el) el.style.display = 'none'; };
const esc = (s = '') => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const num = (v) => (v === null || v === undefined || v === '' || isNaN(+v)) ? null : +v;

const AV_COLOURS = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];
const getInitials = (n = '') => n.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const get = async (url) => {
  try {
    const r = await API.get(url);
    return r?.ok ? r.data : null;
  } catch (e) { console.warn('Dashboard fetch failed:', url, e); return null; }
};

const animateValue = (el, end, duration, suffix = '') => {
  if (!el) return;
  if (num(end) === null) { el.textContent = '--'; return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / duration, 1);
    const v = end * (1 - Math.pow(1 - p, 3));
    el.textContent = (Number.isInteger(end) ? Math.round(v).toLocaleString() : v.toFixed(1)) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const emptyState = (el, msg) => {
  if (el) el.innerHTML = `<div style="padding:22px;text-align:center;color:#94a3b8;font-size:0.82rem;">${esc(msg)}</div>`;
};

const makeChart = (key, canvas, config) => {
  if (state.charts[key]) state.charts[key].destroy();
  state.charts[key] = new Chart(canvas, config);
};

const killChart = (key) => { if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; } };

/* Latest exam = newest by date; falls back to the last one returned */
const pickLatestExam = (exams) => {
  if (!exams.length) return null;
  const dated = exams.filter(e => e.createdAt || e.date);
  if (dated.length) {
    return [...dated].sort((a, b) =>
      new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))[0];
  }
  return exams[exams.length - 1];
};

/* ══════════════════════════════════════════════════════════
   WELCOME + TERM BADGE
══════════════════════════════════════════════════════════ */
const initWelcome = () => {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = currentUser?.fullName?.split(' ')[0] || 'there';
  setText('welcomeTitle', `${greeting}, ${first}! 👋`);
  setText('welcomeSub', `Here is what is happening at ${Auth.getSchool()?.name || 'your school'} today.`);
  setText('todayDate', new Date().toLocaleDateString('en-KE',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
};

const initTermBadge = () => {
  const ex = state.latestExam;
  const year = ex?.year
    || (ex && (ex.date || ex.createdAt) ? new Date(ex.date || ex.createdAt).getFullYear() : null)
    || new Date().getFullYear();
  setText('currentTerm', ex?.term ? `Term ${ex.term} • ${year}` : String(year));
};

/* ══════════════════════════════════════════════════════════
   KPI CARDS
══════════════════════════════════════════════════════════ */
const initKPIs = (stats, trend) => {
  stats = stats || {};
  const avg  = num(stats.latestStats?.avg);
  const pass = num(stats.latestStats?.passRate);

  animateValue($('kpiStudents'), num(stats.totalStudents), 1000);
  animateValue($('kpiAverage'),  avg,  1000, '%');
  animateValue($('kpiPassRate'), pass, 1000, '%');

  setText('kpiStudentsSub', num(stats.totalClasses) !== null ? `Across ${stats.totalClasses} classes` : 'Enrolled learners');
  setText('kpiAverageSub',  state.latestExam ? `${state.latestExam.name} result` : 'Latest exam result');
  setText('kpiPassSub',     `Learners at or above ${PASS_MARK}%`);

  /* Fake trend badges removed; only the average gets a real change */
  ['kpiStudentsTrend', 'kpiPassTrend'].forEach(id => hide($(id)));
  const t = $('kpiAverageTrend');
  const pts = trend.filter(p => num(p.avg) !== null);
  if (t && pts.length >= 2) {
    const d = pts[pts.length - 1].avg - pts[pts.length - 2].avg;
    t.className = 'dash-kpi-trend ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat');
    t.innerHTML = `<i class="fas fa-arrow-trend-${d >= 0 ? 'up' : 'down'}"></i> ${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
  } else hide(t);

  /* No data source for "top points" yet: hide that card */
  hide($('kpiTopPoints')?.closest('.dash-kpi-card'));

  /* Sparklines: only average has real history */
  ['sparkStudents', 'sparkPassRate', 'sparkPoints'].forEach(id => hide($(id)?.parentElement));
  const spark = $('sparkAverage');
  if (spark && pts.length >= 2) {
    spark.parentElement.style.height = '36px';
    makeChart('spark', spark, {
      type: 'line',
      data: { labels: pts.map((_, i) => i),
        datasets: [{ data: pts.map(p => p.avg), borderColor: '#27ae60', backgroundColor: '#27ae6022', fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
      },
    });
  } else hide(spark?.parentElement);
};

/* ══════════════════════════════════════════════════════════
   TREND   → GET /analytics/trend[?classId=]   { trend:[{label,avg}] }
══════════════════════════════════════════════════════════ */
const initTrendChart = (trend) => {
  const canvas = $('performanceTrendChart');
  if (!canvas) return;
  hide(document.querySelector('.dash-chart-legend'));   // trend has no per-term split

  if (!trend.length) {
    killChart('trend');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '13px DM Sans, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
    ctx.fillText('No exam results yet', canvas.width / 2, canvas.height / 2);
    return;
  }
  makeChart('trend', canvas, {
    type: 'line',
    data: {
      labels: trend.map(t => t.label),
      datasets: [{ label: 'Average Score', data: trend.map(t => t.avg),
        borderColor: '#1a5276', backgroundColor: 'rgba(26,82,118,0.08)',
        borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#1a5276', fill: true, tension: 0.4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false },
        tooltip: { backgroundColor: '#0a2540', callbacks: { label: c => ` Average: ${c.parsed.y}%` } } },
      scales: {
        x: { grid: { color: 'rgba(209,220,235,0.4)' }, ticks: { font: { size: 11 }, color: '#718096' } },
        y: { min: 0, max: 100, grid: { color: 'rgba(209,220,235,0.4)' },
          ticks: { font: { size: 11 }, color: '#718096', callback: v => v + '%' } },
      },
    },
  });
};

/* ══════════════════════════════════════════════════════════
   SUBJECTS → GET /analytics/subject-performance?classId=&examId=
              { performance:[{code, subjectName, avg}] }
══════════════════════════════════════════════════════════ */
const barColour = (v) => v >= 75 ? '#1a5276' : v >= 58 ? '#2980b9' : v >= PASS_MARK ? '#e67e22' : '#e74c3c';

const loadSubjectChart = async (classId) => {
  const canvas = $('subjectPerfChart');
  if (!canvas) return;
  if (!classId || !state.latestExam) { killChart('subject'); return; }

  const data = await get(`/analytics/subject-performance?classId=${classId}&examId=${state.latestExam._id}`);
  const perf = data?.performance || [];
  if (!perf.length) { killChart('subject'); return; }

  makeChart('subject', canvas, {
    type: 'bar',
    data: { labels: perf.map(s => s.code),
      datasets: [{ label: 'Average Score', data: perf.map(s => s.avg),
        backgroundColor: perf.map(s => barColour(s.avg)), borderRadius: 5, borderSkipped: false }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { backgroundColor: '#0a2540', callbacks: {
          title: (c) => perf[c[0].dataIndex].subjectName,
          label: (c) => ` Average: ${c.parsed.x}%` } } },
      scales: {
        x: { min: 0, max: 100, grid: { color: 'rgba(209,220,235,0.4)' },
          ticks: { font: { size: 11 }, color: '#718096', callback: v => v + '%' } },
        y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#4a5568' } },
      },
    },
  });
};

/* ══════════════════════════════════════════════════════════
   GRADES → GET /analytics/grade-distribution?examId=   { dist:{EE1:n..}, total }
══════════════════════════════════════════════════════════ */
const GRADE_COLOURS = {
  EE1:'#1e8449', EE2:'#27ae60', ME1:'#1a6fa8', ME2:'#2980b9',
  AE1:'#d68910', AE2:'#ca6f1e', BE1:'#c0392b', BE2:'#922b21',
};

const initGradeChart = (data) => {
  const canvas = $('gradeDistChart');
  const legend = $('gradeDistLegend');
  if (!canvas) return;

  const dist = data?.dist || {};
  const grades = Object.keys(dist);
  const counts = Object.values(dist);
  const total  = data?.total ?? counts.reduce((a, b) => a + b, 0);

  if (!grades.length || !total) { killChart('grades'); emptyState(legend, 'No graded results yet'); return; }

  makeChart('grades', canvas, {
    type: 'doughnut',
    data: { labels: grades, datasets: [{ data: counts, backgroundColor: grades.map(g => GRADE_COLOURS[g]),
      borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: { legend: { display: false },
        tooltip: { backgroundColor: '#0a2540',
          callbacks: { label: c => ` ${c.label}: ${c.parsed} learners (${Math.round(c.parsed / total * 100)}%)` } } },
    },
  });

  const max = Math.max(...counts, 1);
  legend.innerHTML = grades.map((g, i) => `
    <div class="dash-grade-legend-item">
      <span class="dash-grade-legend-dot" style="background:${GRADE_COLOURS[g]};"></span>
      <span class="dash-grade-legend-label">${g}</span>
      <span class="dash-grade-legend-count">${counts[i]}</span>
      <div class="dash-grade-legend-bar-wrap"><div class="dash-grade-legend-bar"
        style="width:${Math.round(counts[i] / max * 100)}%;background:${GRADE_COLOURS[g]};"></div></div>
    </div>`).join('');
};

/* ══════════════════════════════════════════════════════════
   AT RISK → GET /analytics/at-risk?examId=   { atRisk:[{fullName, className, avg}] }
══════════════════════════════════════════════════════════ */
const initNeedsAttention = (atRisk) => {
  const el = $('needsAttentionList');
  if (!el) return;
  if (!atRisk.length) return emptyState(el, `No learners below ${PASS_MARK}% 🎉`);
  el.innerHTML = atRisk.slice(0, 5).map(s => `
    <div class="dash-attention-item">
      <div class="dash-attention-avatar">${esc(getInitials(s.fullName))}</div>
      <div style="flex:1;min-width:0;">
        <div class="dash-attention-name">${esc(s.fullName)}</div>
        <div class="dash-attention-class">${esc(s.className)}</div>
      </div>
      <div class="dash-attention-score">${num(s.avg) !== null ? (+s.avg).toFixed(1) + '%' : '--'}</div>
    </div>`).join('');
};

const initAlerts = (atRisk) => {
  const el = $('alertsList');
  if (!el) return;
  if (!atRisk.length) { emptyState(el, 'Nothing needs your attention'); setText('alertCount', 0); return; }
  el.innerHTML = `
    <div class="dash-alert-item danger">
      <div class="dash-alert-icon"><i class="fas fa-triangle-exclamation"></i></div>
      <div>
        <div class="dash-alert-title">${atRisk.length} Learner${atRisk.length === 1 ? '' : 's'} Below ${PASS_MARK}%</div>
        <div class="dash-alert-sub">${esc(state.latestExam?.name || 'Latest exam')} — support recommended</div>
      </div>
    </div>`;
  setText('alertCount', 1);
};

/* ══════════════════════════════════════════════════════════
   FILTERS
══════════════════════════════════════════════════════════ */
const fillClassFilters = () => {
  const opts = state.classes.map(c => `<option value="${esc(c._id)}">${esc(c.name)}</option>`).join('');
  const trendSel = $('trendClassFilter');
  const subjSel  = $('subjectClassFilter');
  if (trendSel) trendSel.innerHTML = '<option value="all">All Classes</option>' + opts;
  if (subjSel)  subjSel.innerHTML  = opts;            // subjects need a specific class
};

const loadTrend = async (classId = 'all') => {
  const data = await get(`/analytics/trend${classId !== 'all' ? `?classId=${classId}` : ''}`);
  const trend = data?.trend || [];
  initTrendChart(trend);
  return trend;
};

$('trendClassFilter')?.addEventListener('change', (e) => loadTrend(e.target.value));
$('subjectClassFilter')?.addEventListener('change', (e) => loadSubjectChart(e.target.value));

/* ══════════════════════════════════════════════════════════
   HIDE SECTIONS THAT HAVE NO REAL DATA SOURCE YET
══════════════════════════════════════════════════════════ */
const hideUnsupported = () => {
  hide($('topPerformersList')?.closest('.dash-card'));   // no endpoint yet
  hide($('activityFeed')?.closest('.dash-card'));        // no endpoint yet
};

/* ══════════════════════════════════════════════════════════
   LOAD EVERYTHING
══════════════════════════════════════════════════════════ */
const loadDashboard = async () => {
  const [ov, classData, examData] = await Promise.all([
    get('/analytics/overview'), get('/classes'), get('/exams'),
  ]);

  if (!ov) showToast('Could not load dashboard data.', 'error');

  state.classes = classData?.classes || [];
  state.exams   = examData?.exams || [];
  state.latestExam = pickLatestExam(state.exams);

  fillClassFilters();
  initTermBadge();

  const examId = state.latestExam?._id;
  const firstClass = state.classes[0]?._id;

  const [trend, grades, risk] = await Promise.all([
    loadTrend('all'),
    examId ? get(`/analytics/grade-distribution?examId=${examId}`) : null,
    examId ? get(`/analytics/at-risk?examId=${examId}`) : null,
  ]);
  const atRisk = risk?.atRisk || [];

  initKPIs(ov?.stats, trend);
  initGradeChart(grades);
  initNeedsAttention(atRisk);
  initAlerts(atRisk);
  loadSubjectChart(firstClass);
  setText('subjectChartSub', state.latestExam ? state.latestExam.name : '');
};

$('refreshBtn')?.addEventListener('click', async () => {
  const icon = $('refreshBtn').querySelector('i');
  icon?.classList.add('fa-spin');
  await loadDashboard();
  icon?.classList.remove('fa-spin');
  showToast('Dashboard refreshed', 'success');
});

initWelcome();
hideUnsupported();
loadDashboard();
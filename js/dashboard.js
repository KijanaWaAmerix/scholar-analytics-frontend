/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Dashboard
   File: js/dashboard.js  Version: 2.0
═══════════════════════════════════════════════════════════ */

/* ── Auth ─────────────────────────────────────────────────── */
const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   MOCK DATA
══════════════════════════════════════════════════════════ */
const DASH_DATA = {

  kpi: {
    students  : 247,
    average   : 74.3,
    passRate  : 83.7,
    topPoints : 68,
    topStudent: 'Aisha Kamau',
  },

  trendData: {
    labels  : ['T1 Opener','T1 Midterm','T1 Endterm','T2 Opener','T2 Midterm'],
    term1   : [68.2, 71.5, 74.1, null, null],
    term2   : [null, null, null, 72.3, 75.8],
    term3   : [],
  },

  subjectPerformance: {
    labels: ['English','Kiswahili','Mathematics','Integrated Science','Social Studies','Religious Ed','Pre Technical','Agriculture','Creative Arts'],
    data  : [74, 78, 71, 69, 76, 80, 67, 72, 82],
  },

  gradeDistribution: {
    EE1: 18, EE2: 42, ME1: 67, ME2: 58,
    AE1: 31, AE2: 18, BE1: 9,  BE2: 4,
  },

  topPerformers: [
    { name:'Aisha Kamau',     cls:'Grade 9 East', points:68, grade:'EE1', avg:91.2 },
    { name:'Grace Wambui',    cls:'Grade 8 East', points:65, grade:'EE2', avg:88.5 },
    { name:'Lydia Chelangat', cls:'Grade 7 East', points:64, grade:'EE2', avg:87.4 },
    { name:'Irene Chebet',    cls:'Grade 8 East', points:63, grade:'EE2', avg:85.5 },
    { name:'Janet Mwangi',    cls:'Grade 7 East', points:61, grade:'EE2', avg:83.2 },
  ],

  needsAttention: [
    { name:'David Kipchoge',  cls:'Grade 9 East', avg:44.2 },
    { name:'Hassan Abdi',     cls:'Grade 8 East', avg:47.8 },
    { name:'Oliver Otieno',   cls:'Grade 7 East', avg:48.5 },
    { name:'Kevin Mutua',     cls:'Grade 7 East', avg:49.1 },
  ],

  alerts: [
    { type:'warning', icon:'fa-clock',               title:'Marks Entry Deadline',    sub:'T1 Midterm marks due in 3 days' },
    { type:'danger',  icon:'fa-triangle-exclamation', title:'4 Learners Below 41%',   sub:'Immediate support recommended' },
    { type:'info',    icon:'fa-file-pdf',             title:'Report Cards Ready',      sub:'Grade 9 East — 5 learners' },
    { type:'success', icon:'fa-circle-check',         title:'Setup Complete',          sub:'All 6 classes and subjects seeded' },
  ],

  activity: [
    { dot:'blue',   text:'<strong>Mr. Kamau</strong> entered marks for Grade 8 East — English', time:'2 mins ago'  },
    { dot:'green',  text:'<strong>Aisha Kamau</strong> report card generated',                  time:'18 mins ago' },
    { dot:'orange', text:'<strong>Grade 9 East</strong> Opener results published',              time:'1 hour ago'  },
    { dot:'purple', text:'<strong>3 new students</strong> added to Grade 7 West',              time:'2 hours ago' },
    { dot:'blue',   text:'<strong>Term 1 Midterm</strong> exam created for all classes',        time:'Yesterday'   },
    { dot:'green',  text:'<strong>Bulk PDF</strong> generated — 45 report cards',              time:'Yesterday'   },
  ],
};

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const AV_COLOURS = ['av-blue','av-green','av-orange','av-purple','av-teal','av-red'];

const getInitials = (name='') =>
  name.trim().split(' ').filter(Boolean).slice(0,2)
    .map(w=>w[0].toUpperCase()).join('');

const getAvColour = (name='') =>
  AV_COLOURS[name.charCodeAt(0) % AV_COLOURS.length];

const animateValue = (el, start, end, duration, suffix='') => {
  if (!el) return;
  const startTime = performance.now();
  const update = (now) => {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3);
    const value    = start + (end - start) * ease;
    el.textContent = Number.isInteger(end)
      ? Math.round(value).toLocaleString() + suffix
      : value.toFixed(1) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
};

/* ══════════════════════════════════════════════════════════
   WELCOME BANNER
══════════════════════════════════════════════════════════ */
const initWelcome = () => {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    'Good evening';

  const firstName = user?.fullName?.split(' ')[0] || 'there';

  const title = document.getElementById('welcomeTitle');
  const sub   = document.getElementById('welcomeSub');

  if (title) title.textContent = `${greeting}, ${firstName}! 👋`;
  if (sub)   sub.textContent   = `Here is what is happening at ${Auth.getSchool()?.name || 'your school'} today.`;

  const dateEl = document.getElementById('todayDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-KE', {
      weekday:'long', day:'numeric', month:'long', year:'numeric',
    });
  }
};

/* ══════════════════════════════════════════════════════════
   KPI CARDS
══════════════════════════════════════════════════════════ */
const initKPIs = () => {
  const d = DASH_DATA.kpi;

  animateValue(document.getElementById('kpiStudents'),  0, d.students,  1200);
  animateValue(document.getElementById('kpiAverage'),   0, d.average,   1400, '%');
  animateValue(document.getElementById('kpiPassRate'),  0, d.passRate,  1600, '%');
  animateValue(document.getElementById('kpiTopPoints'), 0, d.topPoints, 1000);

  const sub = document.getElementById('kpiTopStudent');
  if (sub) sub.textContent = d.topStudent;

  /* Sparklines */
  const sparkConfig = {
    type   : 'line',
    options: {
      responsive          : true,
      maintainAspectRatio : false,
      plugins : { legend: { display: false }, tooltip: { enabled: false } },
      scales  : { x: { display: false }, y: { display: false } },
      elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
    },
  };

  const makeSparkline = (id, data, colour) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    canvas.parentElement.style.height = '36px';
    new Chart(canvas, {
      ...sparkConfig,
      data: {
        labels  : data.map((_, i) => i),
        datasets: [{
          data,
          borderColor     : colour,
          backgroundColor : colour + '22',
          fill            : true,
        }],
      },
    });
  };

  makeSparkline('sparkStudents', [210,218,225,231,238,247],  '#1a5276');
  makeSparkline('sparkAverage',  [68,70,72,71,73,74],        '#27ae60');
  makeSparkline('sparkPassRate', [75,78,79,81,82,84],        '#8e44ad');
  makeSparkline('sparkPoints',   [60,62,64,65,66,68],        '#e67e22');
};

/* ══════════════════════════════════════════════════════════
   PERFORMANCE TREND CHART
══════════════════════════════════════════════════════════ */
const initTrendChart = () => {
  const canvas = document.getElementById('performanceTrendChart');
  if (!canvas) return;

  new Chart(canvas, {
    type: 'line',
    data: {
      labels  : DASH_DATA.trendData.labels,
      datasets: [
        {
          label          : 'Term 1',
          data           : DASH_DATA.trendData.term1,
          borderColor    : '#1a5276',
          backgroundColor: 'rgba(26,82,118,0.08)',
          borderWidth    : 2.5,
          borderDash     : [],
          pointRadius    : 5,
          pointBackgroundColor: '#1a5276',
          fill           : true,
          tension        : 0.4,
          spanGaps       : false,
        },
        {
          label          : 'Term 2',
          data           : DASH_DATA.trendData.term2,
          borderColor    : '#27ae60',
          backgroundColor: 'rgba(39,174,96,0.06)',
          borderWidth    : 2.5,
          borderDash     : [6, 3],
          pointRadius    : 5,
          pointBackgroundColor: '#27ae60',
          fill           : true,
          tension        : 0.4,
          spanGaps       : false,
        },
      ],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      interaction        : { mode: 'index', intersect: false },
      plugins: {
        legend : { display: false },
        tooltip: {
          backgroundColor: '#0a2540',
          titleFont      : { size: 12, weight: 'bold' },
          bodyFont       : { size: 12 },
          padding        : 10,
          callbacks      : {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          grid    : { color: 'rgba(209,220,235,0.4)', drawBorder: false },
          ticks   : { font: { size: 11 }, color: '#718096' },
        },
        y: {
          min    : 50,
          max    : 100,
          grid   : { color: 'rgba(209,220,235,0.4)', drawBorder: false },
          ticks  : { font: { size: 11 }, color: '#718096',
            callback: v => v + '%' },
        },
      },
    },
  });
};

/* ══════════════════════════════════════════════════════════
   SUBJECT PERFORMANCE CHART
══════════════════════════════════════════════════════════ */
const initSubjectChart = () => {
  const canvas = document.getElementById('subjectPerfChart');
  if (!canvas) return;

  const data   = DASH_DATA.subjectPerformance;
  const colours = data.data.map(v =>
    v >= 75 ? '#1a5276' :
    v >= 58 ? '#2980b9' :
    v >= 41 ? '#e67e22' :
              '#e74c3c'
  );

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels  : data.labels,
      datasets: [{
        label          : 'Average Score',
        data           : data.data,
        backgroundColor: colours,
        borderRadius   : 5,
        borderSkipped  : false,
      }],
    },
    options: {
      indexAxis          : 'y',
      responsive         : true,
      maintainAspectRatio: false,
      plugins: {
        legend : { display: false },
        tooltip: {
          backgroundColor: '#0a2540',
          callbacks      : {
            label: ctx => ` Average: ${ctx.parsed.x}%`,
          },
        },
      },
      scales: {
        x: {
          min  : 0,
          max  : 100,
          grid : { color: 'rgba(209,220,235,0.4)', drawBorder: false },
          ticks: { font: { size: 11 }, color: '#718096',
            callback: v => v + '%' },
        },
        y: {
          grid : { display: false },
          ticks: { font: { size: 11 }, color: '#4a5568' },
        },
      },
    },
  });
};

/* ══════════════════════════════════════════════════════════
   GRADE DISTRIBUTION CHART
══════════════════════════════════════════════════════════ */
const initGradeChart = () => {
  const canvas = document.getElementById('gradeDistChart');
  if (!canvas) return;

  const grades  = Object.keys(DASH_DATA.gradeDistribution);
  const counts  = Object.values(DASH_DATA.gradeDistribution);
  const total   = counts.reduce((a,b)=>a+b,0);

  const colours = {
    EE1:'#1e8449', EE2:'#27ae60',
    ME1:'#1a6fa8', ME2:'#2980b9',
    AE1:'#d68910', AE2:'#ca6f1e',
    BE1:'#c0392b', BE2:'#922b21',
  };

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels  : grades,
      datasets: [{
        data           : counts,
        backgroundColor: grades.map(g => colours[g]),
        borderColor    : '#ffffff',
        borderWidth    : 2,
        hoverOffset    : 6,
      }],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      cutout             : '68%',
      plugins: {
        legend : { display: false },
        tooltip: {
          backgroundColor: '#0a2540',
          callbacks      : {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} learners (${Math.round((ctx.parsed/total)*100)}%)`,
          },
        },
      },
    },
  });

  /* Custom legend */
  const legend = document.getElementById('gradeDistLegend');
  if (!legend) return;

  const maxCount = Math.max(...counts);

  legend.innerHTML = grades.map((g, i) => `
    <div class="dash-grade-legend-item">
      <span class="dash-grade-legend-dot" style="background:${colours[g]};"></span>
      <span class="dash-grade-legend-label">${g}</span>
      <span class="dash-grade-legend-count">${counts[i]}</span>
      <div class="dash-grade-legend-bar-wrap">
        <div class="dash-grade-legend-bar"
          style="width:${Math.round((counts[i]/maxCount)*100)}%;background:${colours[g]};"></div>
      </div>
    </div>`
  ).join('');
};

/* ══════════════════════════════════════════════════════════
   TOP PERFORMERS
══════════════════════════════════════════════════════════ */
const initTopPerformers = () => {
  const list = document.getElementById('topPerformersList');
  if (!list) return;

  const rankClass = ['gold','silver','bronze','other','other'];
  const rankLabel = ['🥇','🥈','🥉','4th','5th'];

  list.innerHTML = DASH_DATA.topPerformers.map((p, i) => `
    <div class="dash-performer-item">
      <div class="dash-performer-rank ${rankClass[i]}">${rankLabel[i]}</div>
      <div class="dash-performer-avatar ${getAvColour(p.name)}">
        ${getInitials(p.name)}
      </div>
      <div class="dash-performer-info">
        <div class="dash-performer-name">${p.name}</div>
        <div class="dash-performer-class">${p.cls}</div>
      </div>
      <div class="dash-performer-score">
        <div class="dash-performer-pts">
          ${p.points}<span style="font-size:0.65rem;color:#94a3b8;font-weight:400;">/72</span>
        </div>
        <div class="dash-performer-grade">${p.grade}</div>
      </div>
    </div>`
  ).join('');
};

/* ══════════════════════════════════════════════════════════
   NEEDS ATTENTION
══════════════════════════════════════════════════════════ */
const initNeedsAttention = () => {
  const list = document.getElementById('needsAttentionList');
  if (!list) return;

  list.innerHTML = DASH_DATA.needsAttention.map(s => `
    <div class="dash-attention-item">
      <div class="dash-attention-avatar">${getInitials(s.name)}</div>
      <div style="flex:1;min-width:0;">
        <div class="dash-attention-name">${s.name}</div>
        <div class="dash-attention-class">${s.cls}</div>
      </div>
      <div class="dash-attention-score">${s.avg.toFixed(1)}%</div>
    </div>`
  ).join('');
};

/* ══════════════════════════════════════════════════════════
   ALERTS
══════════════════════════════════════════════════════════ */
const initAlerts = () => {
  const list = document.getElementById('alertsList');
  if (!list) return;

  list.innerHTML = DASH_DATA.alerts.map(a => `
    <div class="dash-alert-item ${a.type}">
      <div class="dash-alert-icon">
        <i class="fas ${a.icon}"></i>
      </div>
      <div>
        <div class="dash-alert-title">${a.title}</div>
        <div class="dash-alert-sub">${a.sub}</div>
      </div>
    </div>`
  ).join('');

  const countEl = document.getElementById('alertCount');
  if (countEl) {
    countEl.textContent = DASH_DATA.alerts.filter(
      a => a.type === 'warning' || a.type === 'danger'
    ).length;
  }
};

/* ══════════════════════════════════════════════════════════
   ACTIVITY FEED
══════════════════════════════════════════════════════════ */
const initActivity = () => {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  feed.innerHTML = DASH_DATA.activity.map(a => `
    <div class="dash-activity-item">
      <div class="dash-activity-dot ${a.dot}"></div>
      <div style="flex:1;">
        <div class="dash-activity-text">${a.text}</div>
        <div class="dash-activity-time">${a.time}</div>
      </div>
    </div>`
  ).join('');
};

/* ══════════════════════════════════════════════════════════
   REFRESH BUTTON
══════════════════════════════════════════════════════════ */
document.getElementById('refreshBtn')?.addEventListener('click', () => {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.querySelector('i').classList.add('fa-spin');
  setTimeout(() => {
    if (btn) btn.querySelector('i').classList.remove('fa-spin');
    showToast('Dashboard refreshed!', 'success');
  }, 1000);
});

/* ══════════════════════════════════════════════════════════
   INITIALISE ALL
══════════════════════════════════════════════════════════ */
const initDashboard = () => {
  initWelcome();
  initKPIs();
  initAlerts();
  initTopPerformers();
  initNeedsAttention();
  initActivity();

  /* Charts after a short delay for smooth load */
  setTimeout(() => {
    initTrendChart();
    initSubjectChart();
    initGradeChart();
  }, 100);
};

initDashboard();
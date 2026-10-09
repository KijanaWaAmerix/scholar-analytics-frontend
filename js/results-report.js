/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Downloadable Results Report
   File: js/results-report.js   (load AFTER results.js)  Version: 2.0

   Adds a "Download Report" button. Opens a print-ready, black-and-white
   report; choose "Save as PDF" in the print window to download it.

   Layout (A4 landscape)
     Page 1  Class analysis
             summary · grade distribution · subject ranking ·
             top 3 per subject · gender analysis · most improved
     Page 2  Merit list
             position · marks and level per subject · total · average ·
             points · level · class averages

   Notes
   • Strictly monochrome: no colour is used for grades or headings, so
     the report prints clearly on any black-and-white printer.
   • Every figure is calculated once and reused everywhere.
   • Absent learners (X) are listed but excluded from all averages.
   • Subject teacher names (saved from the Reports page) are printed
     when a single class is selected.
═══════════════════════════════════════════════════════════ */
(() => {

/* ── Grading scale ──────────────────────────────────────── */
const LEVELS = [
  { grade:'EE1', min:90, max:100, points:8 },
  { grade:'EE2', min:75, max:89,  points:7 },
  { grade:'ME1', min:58, max:74,  points:6 },
  { grade:'ME2', min:41, max:57,  points:5 },
  { grade:'AE1', min:31, max:40,  points:4 },
  { grade:'AE2', min:21, max:30,  points:3 },
  { grade:'BE1', min:11, max:20,  points:2 },
  { grade:'BE2', min:1,  max:10,  points:1 },
];
const PASS_MARK = 41;                       // ME2 and above
const TEACHER_STORE_KEY = 'sa_report_subject_teachers_v1';

/* ── Helpers ────────────────────────────────────────────── */
const levelOf = (n) => {
  if (n === null || n === undefined || isNaN(n)) return 'X';
  const r = Math.round(Number(n));
  return LEVELS.find(l => r >= l.min && r <= l.max)?.grade || 'X';
};
const esc  = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const sum  = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? sum(a) / a.length : 0;
const n1   = n => (Math.round(n * 10)  / 10 ).toFixed(1);
const n2   = n => (Math.round(n * 100) / 100).toFixed(2);
const sex  = r => { const g = (r.gender || '').toLowerCase(); return g.startsWith('f') ? 'F' : g.startsWith('m') ? 'M' : ''; };
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const lv   = g => `<b>${esc(g)}</b>`;
const signed = n => n > 0 ? `+${n}` : `${n}`;

const teacherLookup = () => {
  if (state.scope !== 'class') return () => '';
  try {
    const store = JSON.parse(localStorage.getItem(TEACHER_STORE_KEY)) || {};
    const map   = store[`class:${document.getElementById('selClass')?.value}`] || {};
    return (subject) => map[norm(subject.name)] || '';
  } catch { return () => ''; }
};

/* ── Build the full report HTML ─────────────────────────── */
const buildReport = () => {
  const subs = state.subjects;
  const res  = state.results;
  const exam = state.examInfo || {};
  const showStream = state.scope === 'grade';

  const school     = (typeof Auth !== 'undefined' && Auth.getSchool && Auth.getSchool()) || {};
  const schoolName = (school.name || school.schoolName || 'SCHOOL NAME').toUpperCase();
  const className  = state.classInfo?.name || 'Class';
  const examLine   = `Term ${exam.term || ''}  ·  ${(exam.name || '').toUpperCase()}  ·  ${exam.academicYear || ''}`;
  const today      = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  const isX        = r => !r.meanGrade || !r.subjectCount;
  const considered = res.filter(r => !isX(r));
  const absentees  = res.length - considered.length;

  /* Per-subject statistics */
  const stats = subs.map(s => {
    const entries = res
      .map(r => ({ r, sr: r.subjectResults?.find(x => x.code === s.code) }))
      .filter(e => e.sr && !e.sr.notEntered && !e.sr.absent && e.sr.score !== null && e.sr.score !== undefined);
    const scores = entries.map(e => Number(e.sr.score));
    const counts = {};
    LEVELS.forEach(l => counts[l.grade] = 0);
    entries.forEach(e => { if (counts[e.sr.grade] !== undefined) counts[e.sr.grade]++; });
    const avg = mean(scores);
    return {
      s, entries, counts, avg,
      total  : sum(scores),
      avgPts : mean(entries.map(e => e.sr.points || 0)),
      level  : levelOf(avg),
    };
  });
  const ranked = [...stats].sort((a, b) => b.avg - a.avg);

  /* Class figures */
  const classAvg  = state.stats?.avg ?? mean(considered.map(r => r.avgScore));
  const meanPts   = mean(considered.map(r => r.totalPoints / r.subjectCount));
  const passed    = considered.filter(r => r.avgScore >= PASS_MARK).length;
  const passRate  = considered.length ? passed / considered.length * 100 : 0;

  /* Overall grade distribution */
  const dist = {}; LEVELS.forEach(l => dist[l.grade] = 0); dist.X = 0;
  res.forEach(r => { if (isX(r)) dist.X++; else if (dist[r.meanGrade] !== undefined) dist[r.meanGrade]++; });
  const distKeys = [...LEVELS.map(l => l.grade), ...(dist.X ? ['X'] : [])];
  const distMax  = Math.max(1, ...distKeys.map(k => dist[k]));

  /* Teachers (only when a single class is selected) */
  const teacherOf  = teacherLookup();
  const hasTeacher = subs.some(s => teacherOf(s));

  /* Gender */
  const boys  = considered.filter(r => sex(r) === 'M');
  const girls = considered.filter(r => sex(r) === 'F');
  const gStat = arr => ({ n: arr.length, avg: mean(arr.map(r => r.avgScore)), pts: mean(arr.map(r => r.totalPoints / r.subjectCount)) });
  const gm = gStat(boys), gf = gStat(girls);
  const hasGender = gm.n > 0 && gf.n > 0;
  const better = gf.avg === gm.avg ? 'Equal' : gf.avg > gm.avg ? 'Female' : 'Male';

  const subjGender = stats.map(t => {
    const m = t.entries.filter(e => sex(e.r) === 'M').map(e => Number(e.sr.score));
    const f = t.entries.filter(e => sex(e.r) === 'F').map(e => Number(e.sr.score));
    const ma = mean(m), fa = mean(f);
    return { name: t.s.name, ma, fa, gap: Math.abs(ma - fa), lead: ma === fa ? '—' : fa > ma ? 'Female' : 'Male' };
  }).sort((a, b) => b.gap - a.gap);
  const ledBoys  = subjGender.filter(x => x.lead === 'Male').length;
  const ledGirls = subjGender.filter(x => x.lead === 'Female').length;

  /* Value added (VAP) — only when previous-exam data exists */
  const hasVap   = res.some(r => r.vap !== null && r.vap !== undefined);
  const improved = res.filter(r => r.vap > 0).sort((a, b) => b.vap - a.vap).slice(0, 5);

  /* ── Page 1 sections ─────────────────────────────────── */
  const summary = `
    <div class="kpis">
      <div><span>${considered.length}</span>Learners assessed${absentees ? ` (${absentees} absent)` : ''}</div>
      <div><span>${n2(classAvg)}</span>Mean mark</div>
      <div><span>${levelOf(classAvg)}</span>Mean grade</div>
      <div><span>${n2(meanPts)}</span>Mean points</div>
      <div><span>${n1(passRate)}%</span>At or above ${PASS_MARK}%</div>
    </div>`;

  const distTable = `
    <table class="dist"><tr>${distKeys.map(k => `<th>${k}</th>`).join('')}</tr>
    <tr>${distKeys.map(k => `<td><i style="height:${Math.round(dist[k] / distMax * 34)}px"></i><br>${dist[k]}</td>`).join('')}</tr></table>`;

  const subjectTable = `
    <table>
      <tr><th>Rank</th><th class="l">Learning area</th>${hasTeacher ? '<th class="l">Subject teacher</th>' : ''}<th>Mean mark</th><th>Level</th><th>Mean pts</th>${LEVELS.map(l => `<th>${l.grade}</th>`).join('')}</tr>
      ${ranked.map((t, i) => `<tr><td>${i + 1}</td><td class="l">${esc(t.s.name)}</td>${hasTeacher ? `<td class="l">${esc(teacherOf(t.s)) || '—'}</td>` : ''}<td>${n2(t.avg)}</td><td>${lv(t.level)}</td><td>${n2(t.avgPts)}</td>${LEVELS.map(l => `<td>${t.counts[l.grade] || '·'}</td>`).join('')}</tr>`).join('')}
    </table>`;

  const top3 = stats.map(t => {
    const top = [...t.entries].sort((a, b) => b.sr.score - a.sr.score).slice(0, 3);
    return `<div class="box"><h4>${esc(t.s.name)}</h4>
      <table><tr><th>#</th><th class="l">Learner</th><th>Mark</th><th>Level</th></tr>
      ${top.map((e, i) => `<tr><td>${i + 1}</td><td class="l">${esc(e.r.fullName)}</td><td>${e.sr.score}</td><td>${lv(e.sr.grade || levelOf(e.sr.score))}</td></tr>`).join('')}
      </table></div>`;
  }).join('');

  const genderBlock = hasGender ? `
    <h3>Gender performance</h3>
    <div class="two">
      <div>
        <table>
          <tr><th class="l">Gender</th><th>Learners</th><th>Mean mark</th><th>Mean pts</th><th>Level</th></tr>
          <tr><td class="l">Male</td><td>${gm.n}</td><td>${n2(gm.avg)}</td><td>${n2(gm.pts)}</td><td>${lv(levelOf(gm.avg))}</td></tr>
          <tr><td class="l">Female</td><td>${gf.n}</td><td>${n2(gf.avg)}</td><td>${n2(gf.pts)}</td><td>${lv(levelOf(gf.avg))}</td></tr>
        </table>
        <p class="note">Leading gender: <b>${better}</b> &nbsp;·&nbsp; Gap: <b>${n2(Math.abs(gf.avg - gm.avg))}</b> marks<br>
        Subjects led by boys: <b>${ledBoys}</b> &nbsp;·&nbsp; by girls: <b>${ledGirls}</b></p>
      </div>
      <div>
        <table>
          <tr><th class="l">Learning area</th><th>Male</th><th>Female</th><th>Gap</th><th>Leader</th></tr>
          ${subjGender.map(x => `<tr><td class="l">${esc(x.name)}</td><td>${n1(x.ma)}</td><td>${n1(x.fa)}</td><td>${n1(x.gap)}</td><td>${x.lead}</td></tr>`).join('')}
        </table>
      </div>
    </div>` : '';

  const improvedBlock = improved.length ? `
    <h3>Most improved learners (VAP)</h3>
    <table class="narrow">
      <tr><th>Rank</th><th class="l">Learner</th><th>Previous pts</th><th>Current pts</th><th>VAP</th></tr>
      ${improved.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${esc(r.fullName)}</td><td>${r.prevPoints ?? '—'}</td><td>${r.totalPoints}</td><td><b>${signed(r.vap)}</b></td></tr>`).join('')}
    </table>` : '';

  /* ── Page 2: merit list ──────────────────────────────── */
  const mHead = `<tr>
    <th>Pos</th><th class="l">Learner</th>${showStream ? '<th>Stream</th>' : ''}
    ${subs.map(s => `<th>${esc(s.code)}</th>`).join('')}
    <th>Total</th><th>Avg</th><th>Points</th><th>Level</th>${hasVap ? '<th>VAP</th>' : ''}</tr>`;

  const mBody = res.map(r => {
    const cells = subs.map(s => {
      const sr = r.subjectResults?.find(x => x.code === s.code);
      if (!sr || sr.notEntered) return '<td>—</td>';
      if (sr.absent) return '<td>ABS</td>';
      return `<td>${sr.score} <small>${esc(sr.grade || levelOf(sr.score))}</small></td>`;
    }).join('');
    const x = isX(r);
    return `<tr>
      <td><b>${x ? 'X' : (r.position ?? '')}</b></td><td class="l">${esc(r.fullName)}</td>${showStream ? `<td>${esc(r.streamName || '')}</td>` : ''}
      ${cells}
      <td>${r.totalScore ?? ''}</td><td>${x ? 'X' : n1(r.avgScore)}</td><td>${x ? 'X' : r.totalPoints}</td><td>${x ? 'X' : lv(r.meanGrade)}</td>
      ${hasVap ? `<td>${r.vap === null || r.vap === undefined ? '—' : signed(r.vap)}</td>` : ''}</tr>`;
  }).join('');

  const lead = showStream ? 3 : 2;
  const tail = hasVap ? 5 : 4;
  const mFoot = `
    <tr class="f"><td class="l" colspan="${lead}">Class average</td>${stats.map(t => `<td>${n1(t.avg)} <small>${t.level}</small></td>`).join('')}<td></td><td>${n1(classAvg)}</td><td>${n2(meanPts)}</td><td>${lv(levelOf(classAvg))}</td>${hasVap ? '<td></td>' : ''}</tr>`;

  const signatures = `
    <div class="sign"><span>Dean of Studies</span><span>Principal / Headteacher</span><span>School stamp</span></div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Results_${esc(className)}_${esc(exam.name || 'Exam')}</title>
<style>
  @page { size: A4 landscape; margin: 11mm 11mm 15mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:9.5px; line-height:1.35; color:#000; background:#fff; }
  .masthead { text-align:center; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:8px; }
  .masthead h1 { margin:0; font-size:17px; letter-spacing:1.4px; }
  .masthead h2 { margin:3px 0 0; font-size:10px; font-weight:600; letter-spacing:2px; text-transform:uppercase; }
  .masthead p  { margin:3px 0 0; font-size:10px; }
  h3 { margin:14px 0 5px; padding-bottom:2px; font-size:10px; letter-spacing:1.2px; text-transform:uppercase; border-bottom:1px solid #000; }
  h4 { margin:0 0 3px; font-size:9.5px; }
  table { width:100%; border-collapse:collapse; margin-bottom:4px; }
  th, td { border:0.5px solid #777; padding:3px 4px; text-align:center; font-size:9px; }
  th { background:#ececec; font-weight:700; border-bottom:1px solid #000; }
  td.l, th.l { text-align:left; }
  small { font-size:7.5px; color:#444; }
  .kpis { display:flex; border:1px solid #000; margin-bottom:2px; }
  .kpis div { flex:1; padding:7px 6px; text-align:center; font-size:8.5px; text-transform:uppercase; letter-spacing:.5px; border-right:1px solid #000; }
  .kpis div:last-child { border-right:0; }
  .kpis span { display:block; font-size:18px; font-weight:700; letter-spacing:0; margin-bottom:1px; }
  table.dist td { vertical-align:bottom; height:52px; font-weight:700; }
  table.dist i { display:inline-block; width:55%; background:#555; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px 10px; }
  .two  { display:grid; grid-template-columns:1fr 1.25fr; gap:12px; align-items:start; }
  .box  { break-inside:avoid; }
  .note { margin:4px 0; }
  table.narrow { width:60%; }
  .pb { break-before:page; }
  .merit thead { display:table-header-group; }
  .merit tr { break-inside:avoid; }
  .merit tbody tr:nth-child(even) td { background:#f6f6f6; }
  tr.f td { background:#ececec !important; font-weight:700; border-top:1.5px solid #000; }
  .rules { margin-top:6px; font-size:8px; color:#333; }
  .sign { display:flex; justify-content:space-between; gap:30px; margin-top:34px; }
  .sign span { flex:1; padding-top:4px; border-top:1px solid #000; text-align:center; font-size:8.5px; text-transform:uppercase; letter-spacing:.6px; }
  .run { position:fixed; left:0; right:0; bottom:-10mm; display:flex; justify-content:space-between; font-size:7.5px; color:#444; border-top:0.5px solid #999; padding-top:2px; }
</style></head><body>

<div class="run"><span>${esc(schoolName)} · ${esc(className)} · ${esc(examLine)}</span><span>Generated ${today} · Scholar Analytics</span></div>

<!-- ═══ PAGE 1 — CLASS ANALYSIS ═══ -->
<div class="masthead">
  <h1>${esc(schoolName)}</h1>
  <h2>Assessment Results — Class Analysis</h2>
  <p>${esc(className)} &nbsp;|&nbsp; ${esc(examLine)}</p>
</div>

${summary}

<h3>Overall grade distribution</h3>
${distTable}

<h3>Subject performance</h3>
${subjectTable}

<h3>Top 3 learners per subject</h3>
<div class="grid">${top3}</div>

${genderBlock}
${improvedBlock}
${signatures}

<!-- ═══ PAGE 2 — MERIT LIST ═══ -->
<div class="pb"></div>
<div class="masthead">
  <h1>${esc(schoolName)}</h1>
  <h2>Assessment Results — Merit List</h2>
  <p>${esc(className)} &nbsp;|&nbsp; ${esc(examLine)}</p>
</div>

<table class="merit"><thead>${mHead}</thead><tbody>${mBody}</tbody><tfoot>${mFoot}</tfoot></table>
<p class="rules">Levels: EE1 90–100 · EE2 75–89 · ME1 58–74 · ME2 41–57 · AE1 31–40 · AE2 21–30 · BE1 11–20 · BE2 1–10. Learners with tied totals share a position. X = absent for all assessments; excluded from all averages.</p>
${signatures}

</body></html>`;
};

/* ── Download button ────────────────────────────────────── */
const csvBtn = document.getElementById('exportResultsBtn');
if (csvBtn) {
  const btn = document.createElement('button');
  btn.id = 'downloadReportBtn';
  btn.className = 'btn-primary btn-sm';
  btn.innerHTML = '<i class="fas fa-download"></i> Download Report';
  csvBtn.parentNode.insertBefore(btn, csvBtn);

  btn.addEventListener('click', () => {
    if (!state.results.length) { showToast('Load results first.', 'warning'); return; }

    const w = window.open('', '_blank');
    if (!w) { showToast('Please allow pop-ups for this site, then try again.', 'warning'); return; }

    w.document.write(buildReport());
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
    showToast('In the print window, choose "Save as PDF".', 'info');
  });
}

})();
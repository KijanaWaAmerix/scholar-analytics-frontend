/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Downloadable Results Report
   File: js/results-report.js   (load AFTER results.js)
   Adds a "Download Report" button. Opens a print-ready report;
   choose "Save as PDF" in the print window to download it.
═══════════════════════════════════════════════════════════ */
(() => {

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

const levelOf = (n) => {
  if (n === null || n === undefined || isNaN(n)) return 'X';
  const r = Math.round(Number(n));
  return LEVELS.find(l => r >= l.min && r <= l.max)?.grade || 'X';
};

const esc  = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sum  = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? sum(a) / a.length : 0;
const f1   = n => (Math.round(n * 100) / 100).toString();
const lv   = g => `<b style="color:${(typeof GRADE_COLOURS !== 'undefined' && GRADE_COLOURS[g]) || '#333'}">${g}</b>`;
const sex  = r => { const g = (r.gender || '').toLowerCase(); return g.startsWith('f') ? 'F' : g.startsWith('m') ? 'M' : ''; };

/* ── Build the full report HTML ─────────────────────────── */
const buildReport = () => {
  const subs = state.subjects;
  const res  = state.results;
  const exam = state.examInfo || {};
  const showStream = state.scope === 'grade';

  const school = Auth.getSchool() || {};
  const schoolName = (school.name || school.schoolName || 'SCHOOL NAME').toUpperCase();
  const title = `${state.classInfo?.name || 'Class'} | Term ${exam.term || ''} | Exam: ${(exam.name || '').toUpperCase()} | ${exam.academicYear || ''}`;

  const isX = r => !r.meanGrade || !r.subjectCount;
  const considered = res.filter(r => !isX(r));

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
    return { s, entries, total: sum(scores), avg, avgPts: mean(entries.map(e => e.sr.points || 0)), level: levelOf(avg), counts };
  });

  /* 1 — Main results table */
  const head = `<tr>
    <th>#</th><th class="l">LEARNER'S NAME</th>${showStream ? '<th>STREAM</th>' : ''}
    ${subs.map(s => `<th>${esc(s.code)}</th>`).join('')}
    <th>TOTAL</th><th>AVG</th><th>LEVEL</th><th>POINTS</th></tr>`;

  const body = res.map(r => {
    const cells = subs.map(s => {
      const sr = r.subjectResults?.find(x => x.code === s.code);
      if (!sr || sr.notEntered) return '<td>-</td>';
      if (sr.absent) return '<td>ABS</td>';
      return `<td>${sr.score} ${lv(sr.grade || levelOf(sr.score))}</td>`;
    }).join('');
    const x = isX(r);
    return `<tr>
      <td>${r.position ?? ''}</td><td class="l">${esc(r.fullName)}</td>${showStream ? `<td>${esc(r.streamName || '')}</td>` : ''}
      ${cells}
      <td>${r.totalScore ?? ''}</td><td>${x ? 'X' : f1(r.avgScore)}</td>
      <td>${x ? 'X' : lv(r.meanGrade)}</td><td>${x ? 'X' : r.totalPoints}</td></tr>`;
  }).join('');

  const lead = showStream ? 3 : 2;
  const foot = `
    <tr class="f"><td class="l" colspan="${lead}">TOTAL MARKS</td>${stats.map(t => `<td>${t.total}</td>`).join('')}<td>${sum(res.map(r => r.totalScore || 0))}</td><td colspan="3"></td></tr>
    <tr class="f"><td class="l" colspan="${lead}">AVG MARK</td>${stats.map(t => `<td>${f1(t.avg)}</td>`).join('')}<td></td><td>${f1(state.stats?.avg ?? mean(considered.map(r => r.avgScore)))}</td><td colspan="2"></td></tr>
    <tr class="f"><td class="l" colspan="${lead}">LEVEL</td>${stats.map(t => `<td>${lv(t.level)}</td>`).join('')}<td colspan="4"></td></tr>
    <tr class="f"><td class="l" colspan="${lead}">AVG POINTS</td>${stats.map(t => `<td>${f1(t.avgPts)}</td>`).join('')}<td colspan="4"></td></tr>`;

  /* 2 — Overall grade distribution */
  const dist = {}; LEVELS.forEach(l => dist[l.grade] = 0); dist.X = 0;
  res.forEach(r => { if (isX(r)) dist.X++; else if (dist[r.meanGrade] !== undefined) dist[r.meanGrade]++; });
  const distKeys = [...LEVELS.map(l => l.grade), 'X'];

  /* 3 — Class summary */
  const classAvg = state.stats?.avg ?? mean(considered.map(r => r.avgScore));
  const meanPts  = mean(considered.map(r => r.totalPoints / r.subjectCount));

  /* 4 — Subject-wise ranking */
  const ranked = [...stats].sort((a, b) => b.avg - a.avg);

  /* 5 — Top 3 per subject */
  const top3 = stats.map(t => {
    const top = [...t.entries].sort((a, b) => b.sr.score - a.sr.score).slice(0, 3);
    return `<div class="box"><h4>${esc(t.s.name)} — Top 3</h4>
      <table><tr><th>No</th><th class="l">Student</th><th>Mark</th><th>Level</th><th>Pts</th></tr>
      ${top.map((e, i) => `<tr><td>${i + 1}</td><td class="l">${esc(e.r.fullName)}</td><td>${e.sr.score}</td><td>${lv(e.sr.grade || levelOf(e.sr.score))}</td><td>${e.sr.points ?? ''}</td></tr>`).join('')}
      </table></div>`;
  }).join('');

  /* 6 — Gender analytics */
  const boys  = considered.filter(r => sex(r) === 'M');
  const girls = considered.filter(r => sex(r) === 'F');
  const gStat = arr => ({ n: arr.length, avg: mean(arr.map(r => r.avgScore)), pts: mean(arr.map(r => r.totalPoints / r.subjectCount)) });
  const gm = gStat(boys), gf = gStat(girls);
  const better = gf.avg === gm.avg ? 'EQUAL' : gf.avg > gm.avg ? 'FEMALE' : 'MALE';

  const subjGender = stats.map(t => {
    const m = t.entries.filter(e => sex(e.r) === 'M').map(e => Number(e.sr.score));
    const f = t.entries.filter(e => sex(e.r) === 'F').map(e => Number(e.sr.score));
    const ma = mean(m), fa = mean(f);
    return { name: t.s.name, ma, fa, gap: Math.abs(ma - fa), lead: ma === fa ? '-' : fa > ma ? 'Female' : 'Male' };
  }).sort((a, b) => b.gap - a.gap);
  const ledBoys  = subjGender.filter(x => x.lead === 'Male').length;
  const ledGirls = subjGender.filter(x => x.lead === 'Female').length;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Results_${esc(state.classInfo?.name || 'Class')}_${esc(exam.name || 'Exam')}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; color:#111; font-size:10px; }
  h1 { text-align:center; margin:0; font-size:18px; }
  h2 { text-align:center; margin:2px 0; font-size:13px; }
  h3 { margin:14px 0 4px; font-size:12px; background:#0a2540; color:#fff; padding:4px 8px; }
  h4 { margin:0 0 3px; font-size:10px; }
  p.sub { text-align:center; margin:2px 0 8px; font-weight:bold; }
  table { border-collapse:collapse; width:100%; margin-bottom:6px; }
  th, td { border:1px solid #888; padding:2px 3px; text-align:center; font-size:9px; }
  th { background:#e8eef5; }
  td.l, th.l { text-align:left; }
  tr.f td { background:#f3f6fa; font-weight:bold; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .box { break-inside:avoid; }
  .pb { page-break-before:always; }
  .sign { margin-top:20px; display:flex; justify-content:space-between; font-size:10px; }
  .note { font-weight:bold; margin:4px 0; }
</style></head><body>

<h1>${esc(schoolName)}</h1>
<h2>ASSESSMENT RESULTS</h2>
<p class="sub">${esc(title)}</p>

<table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>

<h3>OVERALL GRADE DISTRIBUTION</h3>
<table><tr>${distKeys.map(k => `<th>${k}</th>`).join('')}</tr><tr>${distKeys.map(k => `<td>${dist[k]}</td>`).join('')}</tr></table>

<h3>CLASS PERFORMANCE SUMMARY</h3>
<table>
  <tr><th class="l">Description</th><th>Value</th></tr>
  <tr><td class="l">Average Marks</td><td>${f1(classAvg)}</td></tr>
  <tr><td class="l">Mean Grade</td><td>${lv(levelOf(classAvg))}</td></tr>
  <tr><td class="l">Mean Points</td><td>${f1(meanPts)}</td></tr>
  <tr><td class="l">Students Considered</td><td>${considered.length}</td></tr>
</table>
<div class="sign"><span>Dean of Studies: ____________________</span><span>Principal/Headteacher: ____________________</span><span>School Stamp: ____________________</span></div>

<div class="pb"></div>
<h3>SUBJECT-WISE PERFORMANCE SUMMARY</h3>
<table>
  <tr><th>RANK</th><th class="l">LEARNING AREA</th><th>Avg Mark</th><th>Level</th><th>Avg Pts</th>${LEVELS.map(l => `<th>${l.grade}</th>`).join('')}</tr>
  ${ranked.map((t, i) => `<tr><td>${i + 1}</td><td class="l">${esc(t.s.name)}</td><td>${f1(t.avg)}</td><td>${lv(t.level)}</td><td>${f1(t.avgPts)}</td>${LEVELS.map(l => `<td>${t.counts[l.grade]}</td>`).join('')}</tr>`).join('')}
</table>

<h3>TOP 3 LEARNERS PER SUBJECT</h3>
<div class="grid">${top3}</div>

<div class="pb"></div>
<h3>GENDER PERFORMANCE ANALYTICS</h3>
<table>
  <tr><th>Gender</th><th>Learners</th><th>Avg Mark</th><th>Avg Points</th><th>Level</th></tr>
  <tr><td>Male</td><td>${gm.n}</td><td>${f1(gm.avg)}</td><td>${f1(gm.pts)}</td><td>${lv(levelOf(gm.avg))}</td></tr>
  <tr><td>Female</td><td>${gf.n}</td><td>${f1(gf.avg)}</td><td>${f1(gf.pts)}</td><td>${lv(levelOf(gf.avg))}</td></tr>
</table>
<p class="note">BETTER PERFORMING GENDER: ${better} &nbsp;|&nbsp; Performance Gap: ${f1(Math.abs(gf.avg - gm.avg))} Marks</p>

<h3>SUBJECT GENDER PERFORMANCE ANALYSIS</h3>
<table>
  <tr><th class="l">Learning Area</th><th>Male Avg</th><th>Female Avg</th><th>Gap</th><th>Leading Gender</th></tr>
  ${subjGender.map(x => `<tr><td class="l">${esc(x.name)}</td><td>${f1(x.ma)}</td><td>${f1(x.fa)}</td><td>${f1(x.gap)}</td><td>${x.lead}</td></tr>`).join('')}
</table>
<p class="note">Subjects led by Boys: ${ledBoys} &nbsp;|&nbsp; Subjects led by Girls: ${ledGirls}</p>
<div class="sign"><span>Dean of Studies: ____________________</span><span>Principal/Headteacher: ____________________</span><span>School Stamp: ____________________</span></div>

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
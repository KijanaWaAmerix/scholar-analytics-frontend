/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Class Results Sheet (shared)
   File: js/class-sheet.js
   Load this BEFORE reports.js and results-report.js.

   One generator for BOTH the Reports page and the Results page, so
   the sheet always looks the same. It is a pure function of the data
   you give it — it does not read page state.

   Layout: landscape A4, white, thin black lines, almost no ink.
     Page 1+ : merit list (Kaaboi style) — learner, ADM/ASS no.,
               stream, position, every subject as "mark + level",
               totals, average, points, level; subject averages
               at the bottom. Header repeats on every page and
               rows never split.
     Next    : grade distribution, class summary, (stream
               comparison), subject-wise summary with teachers,
               top 3 per subject, gender analysis, most improved,
               signatures.

   Rules:
     • Level is worked out from the AVERAGE MARK (KNEC bands).
     • Position is by TOTAL MARKS (ties share a position).
     • A learner with fewer than CONFIG.MIN_SUBJECTS marks is "X":
       shown as X and left out of every average and count.

   Usage:
     ClassSheet.preview(input)          -> HTML string for on-page preview
     ClassSheet.openPrintWindow(input)  -> opens print dialog ("Save as PDF")
   input = { results, subjects, classes, teacherMaps, meta }
     meta = { schoolName, schoolMotto, className, term, exam, year,
              scope: 'class' | 'grade', streamLabel, teacher, principal }
═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ── Settings you may want to change ───────────────────────── */
const CONFIG = {
  MIN_SUBJECTS: 1,   // learner needs at least this many marks to count (otherwise X).
                     // Set to the number of subjects (e.g. 9) to mark anyone with a missing subject as X.
};

const SCALE = [
  { grade:'EE1', min:90, max:100, points:8 },
  { grade:'EE2', min:75, max:89,  points:7 },
  { grade:'ME1', min:58, max:74,  points:6 },
  { grade:'ME2', min:41, max:57,  points:5 },
  { grade:'AE1', min:31, max:40,  points:4 },
  { grade:'AE2', min:21, max:30,  points:3 },
  { grade:'BE1', min:11, max:20,  points:2 },
  { grade:'BE2', min:1,  max:10,  points:1 },
];
const MEETING = ['EE1','EE2','ME1','ME2'];

const LEVEL_COL = {
  EE1:'#15803d', EE2:'#15803d', ME1:'#1d4ed8', ME2:'#1d4ed8',
  AE1:'#b45309', AE2:'#b45309', BE1:'#b91c1c', BE2:'#b91c1c', X:'#555555',
};

/* ── Helpers ───────────────────────────────────────────────── */
const esc = (t) => String(t ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const normName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const r1   = (n) => (Math.round(n * 10) / 10).toFixed(1);
const r2   = (n) => (Math.round(n * 100) / 100).toFixed(2);

const levelOfScore = (n) => {
  const v = Math.round(Number(n));
  const g = SCALE.find(x => v >= x.min && v <= x.max);
  return g ? g.grade : (Number(n) > 0 ? 'BE2' : 'X');
};
const pointsOf = (grade) => SCALE.find(g => g.grade === grade)?.points ?? 0;
const lv  = (g) => `<b class="lv lv-${esc(g)}">${esc(g)}</b>`;
const sex = (r) => {
  const g = String(r.gender || '').toLowerCase();
  return g.startsWith('f') ? 'F' : g.startsWith('m') ? 'M' : '';
};
const pad = (n) => String(n).padStart(2, '0');

/* ══════════════════════════════════════════════════════════
   1. PREPARE — every number the sheet shows
══════════════════════════════════════════════════════════ */
const prepare = (input) => {
  const { results = [], subjects = [], classes = [], meta = {}, teacherMaps = {} } = input;
  const gradeMode = meta.scope === 'grade';

  const classByName = (n) => classes.find(c => c.name === n);
  const streamOf = (r) => gradeMode
    ? (classByName(r.streamName)?.stream || r.streamName || '')
    : (meta.streamLabel || '');

  /* rows */
  const rows = results.map(r => {
    const x = (r.subjectCount || 0) < CONFIG.MIN_SUBJECTS;
    return {
      r, x,
      stream: streamOf(r),
      level : x ? 'X' : levelOfScore(r.avgScore),
      pos: null, spos: null,
    };
  });

  const considered = rows.filter(w => !w.x)
    .sort((a, b) => b.r.totalScore - a.r.totalScore || String(a.r.fullName).localeCompare(String(b.r.fullName)));
  const unranked = rows.filter(w => w.x)
    .sort((a, b) => String(a.r.fullName).localeCompare(String(b.r.fullName)));

  /* position by total marks — ties share a position (1,2,2,4…) */
  const assignRank = (list, key) => {
    let last = null, rk = 0;
    list.forEach((w, i) => {
      if (w.r.totalScore !== last) { rk = i + 1; last = w.r.totalScore; }
      w[key] = rk;
    });
  };
  assignRank(considered, 'pos');

  const streams = [...new Set(considered.map(w => w.stream))].filter(Boolean);
  if (gradeMode) streams.forEach(st => assignRank(considered.filter(w => w.stream === st), 'spos'));

  const ordered = [...considered, ...unranked];

  /* per-subject statistics */
  const subjStats = subjects.map(sub => {
    const entries = [];
    considered.forEach(w => {
      const sr = (w.r.subjectResults || []).find(x => x.code === sub.code);
      if (sr && !sr.notEntered && !sr.absent && sr.score !== null && sr.score !== undefined) {
        entries.push({ w, sr, score: Number(sr.score), grade: sr.grade || levelOfScore(sr.score) });
      }
    });
    const scores = entries.map(e => e.score);
    const avg    = mean(scores);

    const counts = {}; SCALE.forEach(g => { counts[g.grade] = 0; });
    entries.forEach(e => { if (counts[e.grade] !== undefined) counts[e.grade]++; });

    const m = entries.filter(e => sex(e.w.r) === 'M').map(e => e.score);
    const f = entries.filter(e => sex(e.w.r) === 'F').map(e => e.score);

    return {
      sub, entries, count: scores.length,
      avg, level: scores.length ? levelOfScore(avg) : 'X',
      pts: mean(entries.map(e => e.sr.points || pointsOf(e.grade))),
      counts,
      top3: [...entries].sort((a, b) => b.score - a.score).slice(0, 3),
      mAvg: mean(m), fAvg: mean(f), mN: m.length, fN: f.length,
    };
  });

  /* class totals */
  const classAvg      = mean(considered.map(w => w.r.avgScore));
  const meanAvgPts    = mean(considered.map(w => w.r.avgPoints));
  const classTotalAvg = mean(considered.map(w => w.r.totalScore));
  const classTotalPts = mean(considered.map(w => w.r.totalPoints));
  const classLevel    = considered.length ? levelOfScore(classAvg) : 'X';

  const dist = {}; SCALE.forEach(g => { dist[g.grade] = 0; }); dist.X = 0;
  rows.forEach(w => { if (dist[w.level] !== undefined) dist[w.level]++; });
  const meeting = considered.filter(w => MEETING.includes(w.level)).length;

  /* stream comparison (whole grade only) */
  const streamRows = streams.map(st => {
    const list = considered.filter(w => w.stream === st);
    return {
      stream: st, n: list.length,
      avg: mean(list.map(w => w.r.avgScore)),
      pts: mean(list.map(w => w.r.avgPoints)),
      level: levelOfScore(mean(list.map(w => w.r.avgScore))),
      subj: subjects.map(sub => {
        const sc = [];
        list.forEach(w => {
          const sr = (w.r.subjectResults || []).find(x => x.code === sub.code);
          if (sr && !sr.notEntered && !sr.absent && sr.score != null) sc.push(Number(sr.score));
        });
        return sc.length ? mean(sc) : null;
      }),
    };
  });

  /* pathway averages (only when the caller computed r.pathways) */
  const PATHWAY_NAMES = { stem:'STEM', social:'Social Sciences', creative:'Creative Arts' };
  const pathwayRows = Object.keys(PATHWAY_NAMES).map(key => {
    const vals = considered.map(w => w.r.pathways?.[key]).filter(p => p && p.avg !== null && p.count > 0);
    return vals.length ? {
      name: PATHWAY_NAMES[key],
      avg : mean(vals.map(p => p.avg)),
      pts : mean(vals.map(p => p.points / p.count)),
    } : null;
  }).filter(Boolean);

  /* gender */
  const boys  = considered.filter(w => sex(w.r) === 'M');
  const girls = considered.filter(w => sex(w.r) === 'F');
  const gStat = (list) => ({
    n: list.length,
    avg: mean(list.map(w => w.r.avgScore)),
    pts: mean(list.map(w => w.r.avgPoints)),
  });
  const gm = gStat(boys), gf = gStat(girls);
  const subjGender = subjStats
    .filter(t => t.mN && t.fN)
    .map(t => ({
      name: t.sub.name, m: t.mAvg, f: t.fAvg, gap: Math.abs(t.mAvg - t.fAvg),
      lead: t.mAvg === t.fAvg ? 'Equal' : t.fAvg > t.mAvg ? 'Female' : 'Male',
    }))
    .sort((a, b) => b.gap - a.gap);

  /* most improved */
  const anyVap = considered.some(w => w.r.vap !== null && w.r.vap !== undefined);
  const improved = considered
    .filter(w => w.r.vap !== null && w.r.vap !== undefined && w.r.vap > 0)
    .sort((a, b) => b.r.vap - a.r.vap)
    .slice(0, 5);

  /* subject teacher(s): typed names per class, else the subject's own teacher */
  const mapKeys = Object.keys(teacherMaps || {});
  const teachersFor = (sub) => {
    const key = normName(sub.name);
    const found = mapKeys
      .map(cn => ({ stream: classByName(cn)?.stream || cn, name: (teacherMaps[cn] || {})[key] || '' }))
      .filter(e => e.name);
    if (!found.length) return sub.teacherName || '—';
    const uniq = [...new Set(found.map(e => e.name))];
    if (mapKeys.length === 1) return found[0].name;
    if (uniq.length === 1 && found.length === mapKeys.length) return uniq[0];
    return found.map(e => `${e.stream}: ${e.name}`).join(' / ');
  };

  return {
    meta, subjects, gradeMode, rows, ordered, considered, subjStats, streams,
    classAvg, meanAvgPts, classTotalAvg, classTotalPts, classLevel,
    dist, meeting, streamRows, pathwayRows,
    gm, gf, subjGender, anyVap, improved, teachersFor,
    xCount: unranked.length,
  };
};

/* ══════════════════════════════════════════════════════════
   2. STYLE — thin black lines, white paper, text-only colour
══════════════════════════════════════════════════════════ */
const css = () => `
.cs{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;font-size:9px;line-height:1.3;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.cs *{box-sizing:border-box;}
.cs b{font-weight:700;}
.cs .lv{font-weight:800;}
${Object.keys(LEVEL_COL).map(k => `.cs .lv-${k}{color:${LEVEL_COL[k]};}`).join('')}

/* letterhead */
.cs-head{display:flex;align-items:center;gap:12px;padding-bottom:6px;}
.cs-logo{width:40px;height:40px;border:1.5px solid #0d3349;border-radius:5px;display:flex;align-items:center;
         justify-content:center;font-weight:800;font-size:15px;color:#0d3349;flex-shrink:0;}
.cs-school{font-size:16px;font-weight:800;color:#0d3349;letter-spacing:.3px;line-height:1.1;}
.cs-sub{font-size:9px;color:#444;margin-top:2px;}
.cs-title{margin-left:auto;text-align:right;}
.cs-title b{display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;}
.cs-title span{font-size:8.5px;color:#444;}

.cs-meta{display:flex;border:1px solid #000;margin-bottom:6px;}
.cs-mc{flex:1;padding:3px 8px;border-right:1px solid #000;}
.cs-mc:first-child{flex:2.2;}
.cs-mc:last-child{border-right:none;}
.cs-mc span{display:block;font-size:7px;letter-spacing:.7px;text-transform:uppercase;color:#555;}
.cs-mc b{font-size:10.5px;}

/* merit list */
.cs-main{border-collapse:collapse;width:100%;}
.cs-main th,.cs-main td{border:1px solid #000;padding:2px 3px;text-align:center;white-space:nowrap;font-size:8.5px;}
.cs-main th{font-size:7.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;background:#fff;}
.cs-main thead tr:last-child th{border-bottom:1.5px solid #000;}
.cs-main th.grp{font-size:7px;letter-spacing:.8px;color:#0d3349;}
.cs-main .l{text-align:left;white-space:normal;}
.cs-main td.nm{font-weight:700;min-width:135px;}
.cs-main thead{display:table-header-group;}
.cs-main tr{break-inside:avoid;page-break-inside:avoid;}
.cs-main tr.x td{color:#555;font-style:italic;}
.cs-main tr.sum td{border-top:1.5px solid #000;font-weight:700;}
.cs-main tr.sum td.lbl{text-align:right;letter-spacing:.5px;text-transform:uppercase;font-size:7.5px;}
.cs-notes{margin-top:5px;font-size:8px;color:#333;}
.cs-notes div{margin-top:2px;}
.cs-key b{margin-left:6px;}

/* analysis pages */
.cs-h{font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#0d3349;
      border-bottom:1.5px solid #000;padding-bottom:2px;margin:12px 0 6px;break-after:avoid;page-break-after:avoid;}
.cs-t{border-collapse:collapse;width:100%;}
.cs-t th,.cs-t td{border:1px solid #000;padding:2px 5px;text-align:center;font-size:8.5px;}
.cs-t th{font-size:7.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;background:#fff;border-bottom:1.5px solid #000;}
.cs-t .l{text-align:left;}
.cs-t tr{break-inside:avoid;page-break-inside:avoid;}
.cs-g2{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;align-items:start;}
.cs-g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 10px;}
.cs-box{break-inside:avoid;page-break-inside:avoid;}
.cs-box .cap{font-weight:800;font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;}
.cs-box .cap span{font-weight:400;color:#555;text-transform:none;letter-spacing:0;}
.cs-note{font-size:8px;color:#444;margin-top:4px;}
.cs-sign{display:flex;gap:26px;margin-top:26px;break-inside:avoid;page-break-inside:avoid;}
.cs-sign div{flex:1;border-top:1px solid #000;padding-top:3px;font-size:8px;color:#333;}
.cs-sign b{display:block;font-size:9px;color:#111;min-height:11px;}
.cs-pb{break-before:page;page-break-before:always;}
`;

/* ══════════════════════════════════════════════════════════
   3. BODY
══════════════════════════════════════════════════════════ */
const body = (d) => {
  const { meta, subjects, gradeMode, ordered, subjStats, streamRows, pathwayRows } = d;
  const nSub = subjects.length;
  const school = String(meta.schoolName || 'School').toUpperCase();
  const initials = school.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('');
  const lead = 5 + (gradeMode ? 2 : 1);   // columns before the subjects

  /* ── header ── */
  const head = `
  <div class="cs-head">
    <div class="cs-logo">${esc(initials)}</div>
    <div>
      <div class="cs-school">${esc(school)}</div>
      <div class="cs-sub">Junior Secondary School${meta.schoolMotto ? ' &bull; <i>' + esc(meta.schoolMotto) + '</i>' : ''}</div>
    </div>
    <div class="cs-title"><b>Students&rsquo; Performance Merit List</b><span>Results analysis &bull; ${esc(meta.exam)} Examination</span></div>
  </div>
  <div class="cs-meta">
    <div class="cs-mc"><span>Class</span><b>${esc(meta.className)}</b></div>
    <div class="cs-mc"><span>Term</span><b>${esc(meta.term)}</b></div>
    <div class="cs-mc"><span>Year</span><b>${esc(meta.year)}</b></div>
    <div class="cs-mc"><span>Exam</span><b>${esc(meta.exam)}</b></div>
    <div class="cs-mc"><span>Learners</span><b>${d.considered.length} of ${d.rows.length}</b></div>
  </div>`;

  /* ── merit list header (two rows) ── */
  const thead = `
  <thead>
    <tr>
      <th rowspan="2">S.No</th><th rowspan="2">ADM NO.</th><th rowspan="2" class="l">STUDENT NAME</th>
      <th rowspan="2">ASS NO.</th><th rowspan="2">STREAM</th>
      ${gradeMode ? '<th class="grp" colspan="2">POSITION</th>' : '<th rowspan="2">POS</th>'}
      <th class="grp" colspan="${nSub}">LEARNING AREAS &mdash; MARK &amp; LEVEL</th>
      <th class="grp" colspan="6">SUMMARY</th>
    </tr>
    <tr>
      ${gradeMode ? '<th>STREAM</th><th>OVERALL</th>' : ''}
      ${subjects.map(s => `<th title="${esc(s.name)}">${esc(s.code)}</th>`).join('')}
      <th title="Subjects entered">ENTRY</th><th title="Total marks">TOTAL</th><th title="Average marks">AVG</th><th title="Total points">POINTS</th><th title="Average points">AVG PTS</th><th>LEVEL</th>
    </tr>
  </thead>`;

  /* ── merit list rows ── */
  const bodyRows = ordered.map((w, i) => {
    const r = w.r;
    const cells = subjects.map(sub => {
      const sr = (r.subjectResults || []).find(x => x.code === sub.code);
      if (!sr || sr.notEntered) return '<td>&ndash;</td>';
      if (sr.absent) return '<td>ABS</td>';
      const g = sr.grade || levelOfScore(sr.score);
      return `<td>${esc(sr.score)} ${lv(g)}</td>`;
    }).join('');

    const pos = w.x
      ? (gradeMode ? '<td>X</td><td>X</td>' : '<td>X</td>')
      : (gradeMode ? `<td>${w.spos}</td><td><b>${w.pos}</b></td>` : `<td><b>${w.pos}</b></td>`);

    const totals = w.x
      ? '<td>X</td><td>X</td><td>X</td><td>X</td><td>X</td>'
      : `<td><b>${r.totalScore}</b></td><td>${r1(r.avgScore)}</td><td>${r.totalPoints}</td><td>${r2(r.avgPoints)}</td>`
        + `<td>${lv(w.level)}</td>`;

    return `<tr class="${w.x ? 'x' : ''}">
      <td>${i + 1}</td><td>${esc(r.upiNumber || '')}</td><td class="l nm">${esc(r.fullName)}</td>
      <td>${esc(r.assessmentNo || '')}</td><td>${esc(w.stream)}</td>${pos}${cells}
      <td>${r.subjectCount || 0}</td>${totals}</tr>`;
  }).join('');

  /* ── class averages (bottom of the merit list, aligned to the columns) ── */
  const avgRow = `<tr class="sum"><td class="lbl" colspan="${lead}">AVG. MARKS (%)</td>
      ${subjStats.map(t => `<td>${t.count ? r1(t.avg) + '%' : '&ndash;'}</td>`).join('')}
      <td></td><td>${r1(d.classTotalAvg)}</td><td>${r1(d.classAvg)}</td><td>${r1(d.classTotalPts)}</td><td>${r2(d.meanAvgPts)}</td><td>${lv(d.classLevel)}</td></tr>`;
  const ptsRow = `<tr class="sum"><td class="lbl" colspan="${lead}">AVG. POINTS &amp; LEVEL</td>
      ${subjStats.map(t => `<td>${t.count ? r2(t.pts) + ' ' + lv(t.level) : '&ndash;'}</td>`).join('')}
      <td colspan="6" style="text-align:left;">&nbsp;Class average marks: <b>${r1(d.classTotalAvg)}</b></td></tr>`;

  const key = SCALE.map(g => `${lv(g.grade)} ${g.min}&ndash;${g.max}% (${g.points})`).join(' &nbsp;&bull;&nbsp; ');
  const notes = `
  <div class="cs-notes">
    <div><b>Position</b> is assigned by total marks (learners with the same total share a position). <b>Level</b> is calculated from the average mark.
      <b>X</b> = no marks entered; X learners are not counted in any average.</div>
    <div class="cs-key"><b style="margin-left:0">KEY (points in brackets):</b> ${key}</div>
  </div>`;

  const main = `<table class="cs-main">${thead}<tbody>${bodyRows}${avgRow}${ptsRow}</tbody></table>${notes}`;

  /* ── analysis: distribution + summary (+ pathways) ── */
  const distKeys = [...SCALE.map(g => g.grade), 'X'];
  const distTable = `
    <table class="cs-t">
      <tr>${distKeys.map(k => `<th>${k}</th>`).join('')}</tr>
      <tr>${distKeys.map(k => `<td>${lv(k)}: <b>${d.dist[k]}</b></td>`).join('')}</tr>
    </table>`;

  const pctMeeting = d.considered.length ? Math.round(d.meeting / d.considered.length * 100) : 0;
  const summary = `
    <table class="cs-t">
      <tr><th class="l">Description</th><th>Value</th></tr>
      <tr><td class="l">Average marks</td><td><b>${r1(d.classAvg)}</b></td></tr>
      <tr><td class="l">Mean level</td><td>${lv(d.classLevel)}</td></tr>
      <tr><td class="l">Mean points</td><td><b>${r2(d.meanAvgPts)}</b></td></tr>
      <tr><td class="l">Learners considered</td><td>${d.considered.length}</td></tr>
      <tr><td class="l">Learners with X (no marks)</td><td>${d.xCount}</td></tr>
      <tr><td class="l">Meeting expectation or above</td><td>${d.meeting} (${pctMeeting}%)</td></tr>
    </table>`;

  const pathways = pathwayRows.length ? `
    <div class="cs-h" style="margin-top:10px;">Pathway averages (KNEC subjects)</div>
    <table class="cs-t">
      <tr><th class="l">Pathway</th><th>Avg score</th><th>Avg points</th></tr>
      ${pathwayRows.map(p => `<tr><td class="l">${esc(p.name)}</td><td>${r1(p.avg)}%</td><td>${r2(p.pts)}</td></tr>`).join('')}
    </table>` : '';

  const streamCmp = (gradeMode && streamRows.length > 1) ? `
    <div class="cs-h">Stream comparison</div>
    <table class="cs-t">
      <tr><th class="l">Stream</th><th>Learners</th><th>Avg mark</th><th>Mean pts</th><th>Level</th>
        ${subjects.map(s => `<th>${esc(s.code)}</th>`).join('')}</tr>
      ${streamRows.map(s => `<tr><td class="l"><b>${esc(s.stream)}</b></td><td>${s.n}</td><td><b>${r1(s.avg)}</b></td>
        <td>${r2(s.pts)}</td><td>${lv(s.level)}</td>
        ${s.subj.map(v => `<td>${v === null ? '&ndash;' : r1(v)}</td>`).join('')}</tr>`).join('')}
    </table>` : '';

  /* ── subject-wise summary ── */
  const ranked = [...subjStats].filter(t => t.count).sort((a, b) => b.avg - a.avg);
  const subjTable = `
    <table class="cs-t">
      <tr><th>Rank</th><th class="l">Learning area</th><th>Avg mark</th><th>Level</th><th>Avg pts</th>
        ${SCALE.map(g => `<th>${g.grade}</th>`).join('')}<th class="l">Subject teacher${gradeMode ? 's' : ''}</th></tr>
      ${ranked.map((t, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(t.sub.name)}</b></td><td><b>${r1(t.avg)}</b></td>
        <td>${lv(t.level)}</td><td>${r2(t.pts)}</td>
        ${SCALE.map(g => `<td>${t.counts[g.grade] || '&ndash;'}</td>`).join('')}
        <td class="l">${esc(d.teachersFor(t.sub))}</td></tr>`).join('')}
    </table>`;

  /* ── top 3 per subject ── */
  const topBoxes = subjStats.filter(t => t.count).map(t => `
    <div class="cs-box">
      <div class="cap">${esc(t.sub.name)} <span>&mdash; top 3</span></div>
      <table class="cs-t">
        <tr><th>No</th><th class="l">Student</th><th>Mark</th><th>Level</th></tr>
        ${t.top3.map((e, i) => `<tr><td>${i + 1}</td>
          <td class="l">${esc(e.w.r.fullName)}${gradeMode && e.w.stream ? ' <span style="color:#555">(' + esc(e.w.stream) + ')</span>' : ''}</td>
          <td><b>${esc(e.score)}</b></td><td>${lv(e.grade)}</td></tr>`).join('')}
      </table>
    </div>`).join('');

  /* ── gender ── */
  const better = d.gf.n && d.gm.n
    ? (d.gf.avg === d.gm.avg ? 'Equal' : d.gf.avg > d.gm.avg ? 'Female' : 'Male') : '—';
  const ledBoys  = d.subjGender.filter(x => x.lead === 'Male').length;
  const ledGirls = d.subjGender.filter(x => x.lead === 'Female').length;
  const gender = `
    <div class="cs-g2">
      <div>
        <table class="cs-t">
          <tr><th class="l">Gender</th><th>Learners</th><th>Avg mark</th><th>Avg points</th><th>Level</th></tr>
          <tr><td class="l">Male</td><td>${d.gm.n}</td><td>${d.gm.n ? r1(d.gm.avg) : '&ndash;'}</td><td>${d.gm.n ? r2(d.gm.pts) : '&ndash;'}</td><td>${d.gm.n ? lv(levelOfScore(d.gm.avg)) : '&ndash;'}</td></tr>
          <tr><td class="l">Female</td><td>${d.gf.n}</td><td>${d.gf.n ? r1(d.gf.avg) : '&ndash;'}</td><td>${d.gf.n ? r2(d.gf.pts) : '&ndash;'}</td><td>${d.gf.n ? lv(levelOfScore(d.gf.avg)) : '&ndash;'}</td></tr>
        </table>
        <div class="cs-note"><b>Better performing gender:</b> ${better}${d.gm.n && d.gf.n ? ' &nbsp;|&nbsp; Gap: ' + r1(Math.abs(d.gf.avg - d.gm.avg)) + ' marks' : ''}
          <br/><b>Learning areas led by boys:</b> ${ledBoys} &nbsp;|&nbsp; <b>led by girls:</b> ${ledGirls}</div>
      </div>
      <table class="cs-t">
        <tr><th class="l">Learning area</th><th>Male avg</th><th>Female avg</th><th>Gap</th><th>Leading</th></tr>
        ${d.subjGender.map(x => `<tr><td class="l">${esc(x.name)}</td><td>${r1(x.m)}</td><td>${r1(x.f)}</td><td>${r1(x.gap)}</td><td>${x.lead}</td></tr>`).join('')}
      </table>
    </div>`;

  /* ── most improved ── */
  let improvedHtml;
  if (d.improved.length) {
    improvedHtml = `<table class="cs-t" style="max-width:520px;">
      <tr><th>Rank</th><th class="l">Learner</th><th>Prev points</th><th>Current points</th><th>VAP (+/-)</th></tr>
      ${d.improved.map((w, i) => `<tr><td>${i + 1}</td><td class="l">${esc(w.r.fullName)}${gradeMode && w.stream ? ' <span style="color:#555">(' + esc(w.stream) + ')</span>' : ''}</td>
        <td>${r2(w.r.prevPoints ?? 0)}</td><td>${r2(w.r.avgPoints)}</td><td><b>+${r2(w.r.vap)}</b></td></tr>`).join('')}
    </table>`;
  } else {
    improvedHtml = `<div class="cs-note">${
      d.anyVap ? 'No learner improved on the previous exam.'
      : gradeMode ? 'Not available for a whole-grade sheet. Open a single class (e.g. East or West) to see the most improved learners.'
                  : 'No earlier exam found to compare with.'}</div>`;
  }

  const sign = `
    <div class="cs-sign">
      <div><b>${esc(meta.teacher || '')}</b>Class teacher &mdash; signature &amp; date</div>
      <div><b>&nbsp;</b>Dean of studies &mdash; signature &amp; date</div>
      <div><b>${esc(meta.principal || '')}</b>Principal / Headteacher &mdash; signature &amp; date</div>
      <div><b>&nbsp;</b>School stamp</div>
    </div>`;

  return `<div class="cs">
    ${head}
    ${main}
    <div class="cs-pb"></div>
    ${head}
    <div class="cs-h" style="margin-top:6px;">Overall grade distribution</div>
    ${distTable}
    <div class="cs-g2" style="margin-top:10px;">
      <div><div class="cs-h" style="margin-top:0;">Class performance summary</div>${summary}</div>
      <div>${pathways || ''}</div>
    </div>
    ${streamCmp}
    <div class="cs-h">Subject-wise performance summary</div>
    ${subjTable}
    <div class="cs-h">Top 3 learners per subject</div>
    <div class="cs-g3">${topBoxes}</div>
    <div class="cs-h">Gender performance analysis</div>
    ${gender}
    <div class="cs-h">Most improved learners (VAP)</div>
    ${improvedHtml}
    ${sign}
  </div>`;
};

/* ══════════════════════════════════════════════════════════
   4. PUBLIC API
══════════════════════════════════════════════════════════ */
const safeName = (s) => String(s || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const fileName = (meta) => {
  const d = new Date();
  return `Class_Results_${safeName(meta.className)}_T${safeName(meta.term)}_${safeName(meta.exam)}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* On-page preview: scrolls sideways if the panel is narrower than the sheet */
const preview = (input) => {
  const d = prepare(input);
  return `<div style="overflow-x:auto;background:#fff;border:1px solid #cbd5e1;padding:12px;">
    <style>${css()}</style>
    <div style="min-width:1040px;">${body(d)}</div>
  </div>`;
};

/* Full print-ready document */
const documentHtml = (input) => {
  const d   = prepare(input);
  const now = new Date();
  const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} at ${now.toLocaleTimeString('en-GB')}`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${esc(fileName(input.meta || {}))}</title>
<style>
@page { size: A4 landscape; margin: 9mm 9mm 13mm 9mm; }
@page { @bottom-left  { content: "Report generated on: ${stamp}"; font: 8px Arial, sans-serif; color: #444; }
        @bottom-right { content: "Page " counter(page) " / " counter(pages); font: 8px Arial, sans-serif; color: #444; } }
html,body{margin:0;padding:0;background:#fff;}
${css()}
</style></head><body>${body(d)}</body></html>`;
};

const openPrintWindow = (input) => {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(documentHtml(input));
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
  return true;
};

window.ClassSheet = { preview, documentHtml, openPrintWindow, fileName, CONFIG };

})();
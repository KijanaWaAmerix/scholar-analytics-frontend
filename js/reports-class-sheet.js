/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Class Result Sheet (Chebarus-style)
   File: js/reports-class-sheet.js   (load AFTER reports.js)
   - Defines buildClassSheet (missing/commented-out in reports.js)
   - Levels (KNEC) beside every subject score, no VAP
   - Subjects in order ENG, MATH, KISW, INTER, SST, CRE, CAS, AGN, PRETECH
   - Landscape PDF download for the Class Result Sheet tab
═══════════════════════════════════════════════════════════ */
(() => {

const ORDER = [
  ['ENG'], ['MATH','MAT'], ['KISW','KIS'], ['INTER','INT'],
  ['SST'], ['CRE'], ['CAS'], ['AGN','AGR','AGRI'], ['PRETECH','PRT'],
];
const idx     = c => { const i = ORDER.findIndex(g => g.includes((c || '').toUpperCase())); return i === -1 ? 99 : i; };
const sortSub = a => [...a].sort((x, y) => idx(x.code) - idx(y.code));
const label   = s => ORDER[idx(s.code)]?.[0] || s.code;

const GR  = ['EE1','EE2','ME1','ME2','AE1','AE2','BE1','BE2'];
const TXT = { EE1:'#1e8449', EE2:'#27ae60', ME1:'#1a6fa8', ME2:'#2980b9', AE1:'#d68910', AE2:'#ca6f1e', BE1:'#c0392b', BE2:'#922b21' };
const BG  = { EE1:'#d5f5e3', EE2:'#d5f5e3', ME1:'#d6eaf8', ME2:'#d6eaf8', AE1:'#fef9e7', AE2:'#fdebd0', BE1:'#fce4e4', BE2:'#f9d6d6' };

const esc  = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const r2   = n => Math.round(n * 100) / 100;
const lvl  = n => { if (n === null || n === undefined || isNaN(n)) return 'X'; const g = KJSEA.getGrade(Math.round(n)); return g ? g.grade : 'X'; };
const lb   = g => `<b style="color:${TXT[g] || '#333'}">${g}</b>`;
const sex  = r => { const g = (r.gender || '').toLowerCase(); return g.startsWith('f') ? 'F' : g.startsWith('m') ? 'M' : ''; };

const TH  = 'padding:4px 3px;border:1px solid #94a3b8;background:#e8eef5;font-size:9px;font-weight:700;';
const TD  = 'padding:3px 4px;border:1px solid #cbd5e1;text-align:center;font-size:9.5px;white-space:nowrap;';
const TDL = TD + 'text-align:left;';
const BAR = t => `<div style="background:#0d3349;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;">${t}</div>`;
const sec = (inner, extra = '') => `<div data-sec="1" style="margin-bottom:6px;${extra}">${inner}</div>`;

/* ══════════════════════════════════════════════════════════
   BUILD CLASS SHEET
══════════════════════════════════════════════════════════ */
window.buildClassSheet = (results, s) => {
  const subs       = sortSub(state.subjects);
  const showStream = state.scope === 'grade';
  const isX        = r => !r.meanGrade || !r.subjectCount;
  const considered = results.filter(r => !isX(r));

  /* Per-subject statistics (matched by subject CODE) */
  const stats = subs.map(sub => {
    const entries = results
      .map(r => ({ r, sr: (r.subjectResults || []).find(x => x.code === sub.code) }))
      .filter(e => e.sr && !e.sr.absent && !e.sr.notEntered && e.sr.score !== null && e.sr.score !== undefined);
    const scores = entries.map(e => Number(e.sr.score));
    const counts = {}; GR.forEach(g => counts[g] = 0);
    entries.forEach(e => { if (counts[e.sr.grade] !== undefined) counts[e.sr.grade]++; });
    const teacher = entries.map(e => e.sr.teacherName).find(Boolean) || '—';
    const avg = mean(scores);
    return { sub, entries, total: scores.reduce((a, b) => a + b, 0), avg, avgPts: mean(entries.map(e => e.sr.points || 0)), level: lvl(avg), counts, teacher };
  });

  /* ── Header ── */
  const header = `
    <div style="background:#0d3349;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:18px;font-weight:700;">${esc(String(s.schoolName).toUpperCase())}</div>
        <div style="font-size:11px;opacity:.7;">${esc(s.schoolMotto)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:14px;font-weight:700;letter-spacing:.5px;">ASSESSMENT RESULTS</div>
        <div style="font-size:11px;opacity:.85;">Grade: ${esc(s.cls)} &nbsp;|&nbsp; Term: ${esc(s.term)} &nbsp;|&nbsp; Exam: ${esc(String(s.exam).toUpperCase())} &nbsp;|&nbsp; ${esc(s.year)}</div>
      </div>
    </div>`;

  /* ── Results table (split into page-sized chunks) ── */
  const thead = `<tr>
    <th style="${TH}">#</th><th style="${TH}text-align:left;">LEARNER'S NAME</th>
    ${showStream ? `<th style="${TH}">STREAM</th>` : ''}
    ${subs.map(x => `<th style="${TH}" title="${esc(x.name)}">${esc(label(x))}</th>`).join('')}
    <th style="${TH}">TOTAL</th><th style="${TH}">AVG</th><th style="${TH}">LEVEL</th><th style="${TH}">PTS</th></tr>`;

  const rowHtml = r => {
    const cells = subs.map(sub => {
      const sr = (r.subjectResults || []).find(x => x.code === sub.code);
      if (!sr || sr.notEntered) return `<td style="${TD}">-</td>`;
      if (sr.absent)            return `<td style="${TD}">ABS</td>`;
      const g = sr.grade || lvl(sr.score);
      return `<td style="${TD}">${sr.score} ${lb(g)}</td>`;
    }).join('');
    const x = isX(r);
    return `<tr>
      <td style="${TD}">${r.position ?? ''}</td>
      <td style="${TDL}font-weight:600;">${esc(r.fullName)}</td>
      ${showStream ? `<td style="${TD}">${esc(r.streamName || '')}</td>` : ''}
      ${cells}
      <td style="${TD}font-weight:700;">${r.totalScore ?? ''}</td>
      <td style="${TD}">${x ? 'X' : r2(r.avgScore)}</td>
      <td style="${TD}">${x ? 'X' : lb(r.meanGrade)}</td>
      <td style="${TD}">${x ? 'X' : r.totalPoints}</td></tr>`;
  };

  const lead = showStream ? 3 : 2;
  const classAvg = state.stats?.avg !== undefined ? Number(state.stats.avg) : mean(considered.map(r => r.avgScore));
  const meanPts  = mean(considered.map(r => r.totalPoints / r.subjectCount));
  const FT = 'background:#f3f6fa;font-weight:700;';

  const footRows = `
    <tr><td style="${TDL}${FT}" colspan="${lead}">TOTAL MARKS</td>${stats.map(t => `<td style="${TD}${FT}">${t.total}</td>`).join('')}<td style="${TD}${FT}">${results.reduce((a, r) => a + (r.totalScore || 0), 0)}</td><td style="${TD}${FT}" colspan="3"></td></tr>
    <tr><td style="${TDL}${FT}" colspan="${lead}">AVG MARK</td>${stats.map(t => `<td style="${TD}${FT}">${r2(t.avg)}</td>`).join('')}<td style="${TD}${FT}"></td><td style="${TD}${FT}">${r2(classAvg)}</td><td style="${TD}${FT}" colspan="2"></td></tr>
    <tr><td style="${TDL}${FT}" colspan="${lead}">LEVEL</td>${stats.map(t => `<td style="${TD}${FT}">${lb(t.level)}</td>`).join('')}<td style="${TD}${FT}" colspan="4"></td></tr>
    <tr><td style="${TDL}${FT}" colspan="${lead}">AVG POINTS</td>${stats.map(t => `<td style="${TD}${FT}">${r2(t.avgPts)}</td>`).join('')}<td style="${TD}${FT}" colspan="4"></td></tr>`;

  const CHUNK = 28;
  const tableSecs = [];
  for (let i = 0; i < results.length; i += CHUNK) {
    const part = results.slice(i, i + CHUNK);
    const last = i + CHUNK >= results.length;
    tableSecs.push(sec(`
      ${i === 0 ? header : ''}
      <table style="width:100%;border-collapse:collapse;">
        <thead>${thead}</thead>
        <tbody>${part.map(rowHtml).join('')}</tbody>
        ${last ? `<tfoot>${footRows}</tfoot>` : ''}
      </table>`));
  }

  /* ── Grade distribution + class summary ── */
  const dist = {}; GR.forEach(g => dist[g] = 0); let xCount = 0;
  results.forEach(r => { if (isX(r)) xCount++; else if (dist[r.meanGrade] !== undefined) dist[r.meanGrade]++; });
  const distKeys = [...GR, 'X'];

  const summarySec = sec(`
    ${BAR('Overall Grade Distribution')}
    <table style="width:100%;border-collapse:collapse;">
      <tr>${distKeys.map(k => `<th style="${TH}">${k}</th>`).join('')}</tr>
      <tr>${distKeys.map(k => `<td style="${TD}font-weight:700;">${k === 'X' ? xCount : dist[k]}</td>`).join('')}</tr>
    </table>
    ${BAR('Class Performance Summary')}
    <table style="width:60%;border-collapse:collapse;">
      <tr><th style="${TH}text-align:left;">Description</th><th style="${TH}">Value</th></tr>
      <tr><td style="${TDL}">Average Marks</td><td style="${TD}">${r2(classAvg)}</td></tr>
      <tr><td style="${TDL}">Mean Grade</td><td style="${TD}">${lb(lvl(classAvg))}</td></tr>
      <tr><td style="${TDL}">Mean Points</td><td style="${TD}">${r2(meanPts)}</td></tr>
      <tr><td style="${TDL}">Students Considered</td><td style="${TD}">${considered.length}</td></tr>
    </table>
    <div style="display:flex;justify-content:space-between;font-size:10px;margin-top:22px;padding:0 10px;">
      <span>Dean of Studies: ____________________</span>
      <span>Principal/Headteacher: ____________________</span>
      <span>School Stamp: ____________________</span>
    </div>`);

  /* ── Subject-wise performance ── */
  const ranked = [...stats].sort((a, b) => b.avg - a.avg);
  const subjectSec = sec(`
    ${BAR('Subject-wise Performance Summary')}
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <th style="${TH}">RANK</th><th style="${TH}text-align:left;">LEARNING AREA</th>
        <th style="${TH}">AVG MARK</th><th style="${TH}">LEVEL</th><th style="${TH}">AVG PTS</th>
        ${GR.map(g => `<th style="${TH}">${g}</th>`).join('')}
        <th style="${TH}">SUBJECT TEACHER</th>
      </tr>
      ${ranked.map((t, i) => `<tr>
        <td style="${TD}">${i + 1}</td>
        <td style="${TDL}font-weight:600;">${esc(t.sub.name)}</td>
        <td style="${TD}">${r2(t.avg)}</td><td style="${TD}">${lb(t.level)}</td><td style="${TD}">${r2(t.avgPts)}</td>
        ${GR.map(g => `<td style="${TD}">${t.counts[g]}</td>`).join('')}
        <td style="${TDL}">${esc(t.teacher)}</td></tr>`).join('')}
    </table>`);

  /* ── Top 3 per subject ── */
  const top3Cards = stats.map(t => {
    const top = [...t.entries].sort((a, b) => b.sr.score - a.sr.score).slice(0, 3);
    return `<div style="border:1px solid #cbd5e1;">
      <div style="background:#e8eef5;padding:3px 6px;font-size:10px;font-weight:700;">${esc(t.sub.name)} — Top 3</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><th style="${TH}">No</th><th style="${TH}text-align:left;">Student</th><th style="${TH}">Mark</th><th style="${TH}">Level</th><th style="${TH}">Pts</th></tr>
        ${top.map((e, i) => `<tr><td style="${TD}">${i + 1}</td><td style="${TDL}">${esc(e.r.fullName)}</td><td style="${TD}">${e.sr.score}</td><td style="${TD}">${lb(e.sr.grade || lvl(e.sr.score))}</td><td style="${TD}">${e.sr.points ?? ''}</td></tr>`).join('')}
      </table></div>`;
  }).join('');
  const topSec = sec(`${BAR('Top 3 Learners Per Subject')}<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px 0;">${top3Cards}</div>`);

  /* ── Gender analytics ── */
  const boys  = considered.filter(r => sex(r) === 'M');
  const girls = considered.filter(r => sex(r) === 'F');
  const gs = arr => ({ n: arr.length, avg: mean(arr.map(r => r.avgScore)), pts: mean(arr.map(r => r.totalPoints / r.subjectCount)) });
  const gm = gs(boys), gf = gs(girls);
  const better = gf.avg === gm.avg ? 'EQUAL' : gf.avg > gm.avg ? 'FEMALE' : 'MALE';

  const sg = stats.map(t => {
    const m = t.entries.filter(e => sex(e.r) === 'M').map(e => Number(e.sr.score));
    const f = t.entries.filter(e => sex(e.r) === 'F').map(e => Number(e.sr.score));
    const ma = mean(m), fa = mean(f);
    return { name: t.sub.name, ma, fa, gap: Math.abs(ma - fa), lead: ma === fa ? '-' : fa > ma ? 'Female' : 'Male' };
  }).sort((a, b) => b.gap - a.gap);

  const genderSec = sec(`
    ${BAR('Gender Performance Analytics')}
    <table style="width:60%;border-collapse:collapse;">
      <tr><th style="${TH}">Gender</th><th style="${TH}">Learners</th><th style="${TH}">Avg Mark</th><th style="${TH}">Avg Points</th><th style="${TH}">Level</th></tr>
      <tr><td style="${TD}">Male</td><td style="${TD}">${gm.n}</td><td style="${TD}">${r2(gm.avg)}</td><td style="${TD}">${r2(gm.pts)}</td><td style="${TD}">${lb(lvl(gm.avg))}</td></tr>
      <tr><td style="${TD}">Female</td><td style="${TD}">${gf.n}</td><td style="${TD}">${r2(gf.avg)}</td><td style="${TD}">${r2(gf.pts)}</td><td style="${TD}">${lb(lvl(gf.avg))}</td></tr>
    </table>
    <div style="font-size:10px;font-weight:700;margin:4px 0;">BETTER PERFORMING GENDER: ${better} &nbsp;|&nbsp; Performance Gap: ${r2(Math.abs(gf.avg - gm.avg))} Marks</div>
    ${BAR('Subject Gender Performance Analysis')}
    <table style="width:100%;border-collapse:collapse;">
      <tr><th style="${TH}text-align:left;">Learning Area</th><th style="${TH}">Male Avg</th><th style="${TH}">Female Avg</th><th style="${TH}">Gap</th><th style="${TH}">Leading Gender</th></tr>
      ${sg.map(x => `<tr><td style="${TDL}">${esc(x.name)}</td><td style="${TD}">${r2(x.ma)}</td><td style="${TD}">${r2(x.fa)}</td><td style="${TD}">${r2(x.gap)}</td><td style="${TD}">${x.lead}</td></tr>`).join('')}
    </table>
    <div style="font-size:10px;font-weight:700;margin:4px 0;">Subjects led by Boys: ${sg.filter(x => x.lead === 'Male').length} &nbsp;|&nbsp; Subjects led by Girls: ${sg.filter(x => x.lead === 'Female').length}</div>`);

  return `<div style="width:1100px;background:#ffffff;font-family:'DM Sans',Arial,sans-serif;color:#1e293b;">
    ${tableSecs.join('')}${summarySec}${subjectSec}${topSec}${genderSec}
  </div>`;
};

/* ══════════════════════════════════════════════════════════
   PDF DOWNLOAD — Class Result Sheet (landscape, section by section)
══════════════════════════════════════════════════════════ */
const originalDownload = window.downloadSinglePDF;

const downloadClassPDF = async () => {
  const root = el.previewPaper?.querySelector('div');
  if (!root) { showToast('Generate a preview first.', 'warning'); return; }

  setDownloadLoading(true);
  let wrap;

  try {
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:0;top:0;width:1100px;background:#fff;z-index:-1;';
    wrap.appendChild(root.cloneNode(true));
    document.body.appendChild(wrap);

    const secs = [...wrap.querySelectorAll('[data-sec]')];
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format: state.paperSize === 'Letter' ? 'letter' : 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const M = 6, uw = pw - 2 * M, uh = ph - 2 * M;
    let y = M, first = true;

    for (const sc of secs) {
      const canvas = await html2canvas(sc, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false, windowWidth:1100, scrollX:0, scrollY:0 });
      let w = uw, h = canvas.height * w / canvas.width;
      if (h > uh) { const k = uh / h; h = uh; w = w * k; }
      if (!first && y + h > ph - M) { pdf.addPage(); y = M; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', M, y, w, h);
      y += h + 2;
      first = false;
    }

    const ctx  = state.context || {};
    const cls  = String(ctx.cls || 'Class').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const date = new Date().toISOString().split('T')[0];
    pdf.save(`Class_Results_${cls}_T${ctx.term}_${ctx.exam}_${date}.pdf`);

    showToast('PDF downloaded!', 'success');
    addToRecent(ctx);

  } catch (err) {
    console.error(err);
    showToast('Failed to generate PDF. Please try again.', 'error');
  } finally {
    wrap?.remove();
    setDownloadLoading(false);
  }
};

window.downloadSinglePDF = function () {
  return state.activeTab === 'class' ? downloadClassPDF() : originalDownload();
};

})();
/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Whole-grade marks import (admin)
   File: js/import-grade.js

   One broad sheet for a whole grade (e.g. Grade 9 East + West).
   Each name is matched to a learner in the classes of that grade,
   and the marks are saved into the learner's own class.

   Flow:  upload → preview (nothing saved) → fix any unmatched
          names → import.
   Talks to POST /api/marks/import-grade (dryRun true / false).
═══════════════════════════════════════════════════════════ */
(() => {
  const me = (typeof requireAuth === 'function') ? requireAuth() : null;
  if (!me || me.role !== 'admin') return;          // teachers keep the one-class import

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof showToast === 'function' ? showToast(m, t) : alert(m));

  const el = {
    bar: $('importModeBar'), single: $('singleFlow'), grade: $('gradeFlow'),
    modeSingle: $('modeSingle'), modeGrade: $('modeGrade'),
    gGrade: $('gGrade'), gTerm: $('gTerm'), gExam: $('gExam'), gYear: $('gYear'),
    drop: $('gDrop'), dropTitle: $('gDropTitle'), file: $('gFile'),
    preview: $('gPreview'), summary: $('gSummary'), problems: $('gProblems'),
    run: $('gRun'), reset: $('gReset'), note: $('gRunNote'),
    done: $('gDone'), doneBody: $('gDoneBody'),
  };
  if (!el.bar || !el.grade) return;

  const state = { rows: [], fileName: '', resolutions: {}, createMissing: true, last: null, busy: false, autoExam: false };

  /* ── mode switch ─────────────────────────────────────── */
  el.bar.style.display = 'flex';
  const setMode = (mode) => {
    const g = mode === 'grade';
    el.single.style.display = g ? 'none' : 'flex';
    el.grade.style.display  = g ? 'flex' : 'none';
    el.modeSingle.className = g ? 'btn-secondary' : 'btn-primary';
    el.modeGrade.className  = g ? 'btn-primary' : 'btn-secondary';
  };
  setMode('grade');                                  // the filled broad sheet is the main way to import
  el.modeSingle.addEventListener('click', () => setMode('single'));
  el.modeGrade.addEventListener('click',  () => setMode('grade'));
  if (el.gYear) el.gYear.value = String(new Date().getFullYear());

  /* ── reading the sheet ───────────────────────────────── */
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[`'’´.]/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

  const SLOT_PATTERNS = {
    eng    : /^(eng|english)\b/,
    math   : /^(mat|math|maths|mathematics)\b/,
    kisw   : /^(kis|kisw|kiswahili)\b/,
    inter  : /^(inter|int sci|integrated)/,
    sst    : /^(sst|social)/,
    cre    : /^(cre|ire|hre|religious)/,
    cas    : /^(cas|creative)/,
    agri   : /^(agn|agr|agri|agric|agriculture)\b/,
    pretech: /^(pre ?tech|prt|pre technical|pre vocational|prevocational)/,
  };
  const slotOfHeader = (h) => {
    const n = norm(h);
    if (!n) return null;
    for (const [slot, re] of Object.entries(SLOT_PATTERNS)) if (re.test(n)) return slot;
    return null;
  };
  const NAME_HEADERS = ['names of students', 'names of student', 'names of learners', 'names', 'name',
    'student name', 'students name', 'learner name', 'learners name', 'full name', 'learner', 'student', 'pupil name'];
  const FOOTER = /^(total|totals|mean|average|avg|sum|grand total|mean score|rank|position)$/i;

  const parseSheet = (aoa) => {
    let hr = -1, nc = 0;
    for (let r = 0; r < Math.min(aoa.length, 40) && hr < 0; r++) {
      for (let c = 0; c < (aoa[r] || []).length; c++) {
        if (NAME_HEADERS.includes(norm(aoa[r][c]))) { hr = r; nc = c; break; }
      }
    }
    if (hr < 0) return { rows: [], slots: [], error: 'Could not find a "Names of students" column. Check the first rows of your sheet.' };

    const cols = {};                                   // column index -> slot
    (aoa[hr] || []).forEach((h, c) => { const s = slotOfHeader(h); if (s && c !== nc && !Object.values(cols).includes(s)) cols[c] = s; });
    if (!Object.keys(cols).length) return { rows: [], slots: [], error: 'No subject columns (ENG, MAT, KISW ...) were found.' };

    const rows = [];
    for (let r = hr + 1; r < aoa.length; r++) {
      const line = aoa[r] || [];
      const name = String(line[nc] ?? '').replace(/[`´]/g, '').replace(/\s+/g, ' ').trim();
      if (!name || FOOTER.test(name) || /^[\d.\s-]+$/.test(name)) continue;
      const scores = {};
      Object.entries(cols).forEach(([c, slot]) => {
        const v = line[c];
        if (v !== '' && v !== null && v !== undefined) scores[slot] = typeof v === 'string' ? v.trim() : v;
      });
      rows.push({ name, scores });
    }
    return { rows, slots: Object.values(cols) };
  };

  /* The title rows above the table usually say it all, e.g. "BROAD SHEET END TERM 1 GRADE 9 ASSESSMENT".
     Fill Grade, Term and Exam name from it, so the teacher only checks them. */
  const detectMeta = (aoa) => {
    let hr = 0;
    for (let r = 0; r < Math.min(aoa.length, 40); r++) {
      if ((aoa[r] || []).some(c => NAME_HEADERS.includes(norm(c)))) { hr = r; break; }
    }
    const text = aoa.slice(0, hr).map(row => (row || []).filter(c => typeof c === 'string').join(' ')).join(' ')
      .replace(/\s+/g, ' ');
    const out = {};
    let m = text.match(/grade\s*(\d{1,2})\b/i);              if (m) out.grade = m[1];
    m = text.match(/term\s*([123])\b/i) || text.match(/\bt\s*([123])\b/i); if (m) out.term = m[1];
    if (/end\s*-?\s*(of\s*)?term|\beot\b/i.test(text)) out.exam = 'End Term';
    else if (/mid\s*-?\s*term/i.test(text))               out.exam = 'Mid-term';
    else if (/opener|opening/i.test(text))                  out.exam = 'Opener';
    return out;
  };

  const applyMeta = (meta) => {
    const bits = [];
    if (meta.grade && [...el.gGrade.options].some(o => o.value === meta.grade)) { el.gGrade.value = meta.grade; bits.push('Grade ' + meta.grade); }
    if (meta.term) { el.gTerm.value = meta.term; bits.push('Term ' + meta.term); }
    if (meta.exam && (!el.gExam.value.trim() || state.autoExam)) { el.gExam.value = meta.exam; state.autoExam = true; bits.push(meta.exam); }
    if (bits.length) toast('Read from the sheet: ' + bits.join(', ') + '. Change them above if that is wrong.', 'info');
  };

  const readFile = (file) => {
    if (!file) return;
    if (typeof XLSX === 'undefined') return toast('Excel reader did not load. Please refresh the page.', 'error');
    if (!/\.(xlsx|xls)$/i.test(file.name)) return toast('Please choose an .xlsx or .xls file.', 'warning');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        let parsed = { rows: [] };
        for (const sn of wb.SheetNames) {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true, blankrows: false });
          const p = parseSheet(aoa);
          if (p.rows && p.rows.length) { parsed = p; applyMeta(detectMeta(aoa)); break; }
          if (p.error) parsed.error = p.error;
        }
        if (!parsed.rows.length) return toast(parsed.error || 'No learners found in that file.', 'warning');

        state.rows = parsed.rows;
        state.fileName = file.name;
        state.resolutions = {};
        el.dropTitle.textContent = `${file.name} — ${parsed.rows.length} learners, ${parsed.slots.length} subjects`;
        el.done.style.display = 'none';
        await runPreview();
      } catch (err) {
        console.error(err);
        toast('Could not read that file. Is it a valid Excel file?', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  el.drop.addEventListener('click', () => el.file.click());
  el.file.addEventListener('change', (e) => readFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(ev => el.drop.addEventListener(ev, (e) => { e.preventDefault(); el.drop.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => el.drop.addEventListener(ev, (e) => { e.preventDefault(); el.drop.classList.remove('dragover'); }));
  el.drop.addEventListener('drop', (e) => readFile(e.dataTransfer?.files?.[0]));

  /* ── talking to the server ───────────────────────────── */
  const payload = (dryRun) => ({
    grade: Number(el.gGrade.value),
    term: Number(el.gTerm.value),
    examName: el.gExam.value.trim(),
    academicYear: el.gYear.value.trim() || undefined,
    createMissingExams: state.createMissing,
    dryRun,
    rows: state.rows,
    resolutions: state.resolutions,
  });

  /* The grade list comes from the classes the school has made (no fixed Grade 7-9) */
  const loadGrades = async () => {
    const r = await API.get('/classes');
    const grades = [...new Set((r?.ok ? (r.data.classes || []) : []).map(c => Number(c.grade)).filter(Boolean))]
      .sort((a, b) => a - b);
    const keep = el.gGrade.value;
    el.gGrade.innerHTML = '<option value="">-- Grade --</option>' +
      grades.map(g => `<option value="${g}">Grade ${g}</option>`).join('');
    if (keep && grades.includes(Number(keep))) el.gGrade.value = keep;
  };
  el.gGrade.innerHTML = '<option value="">-- Grade --</option>';        // no preset grade
  loadGrades();

  const validSettings = () => {
    if (!el.gGrade.value) { toast('Choose the grade first.', 'warning'); el.gGrade.focus(); return false; }
    if (!el.gExam.value.trim()) { toast('Type the exam name first (e.g. Mid-term).', 'warning'); el.gExam.focus(); return false; }
    return true;
  };

  async function runPreview() {
    if (!state.rows.length) return;
    if (!validSettings()) return;
    if (state.busy) return;
    state.busy = true;
    el.run.disabled = true;
    el.note.textContent = 'Checking…';
    const r = await API.post('/marks/import-grade', payload(true));
    state.busy = false;
    if (!r?.ok) {
      el.note.textContent = '';
      return toast(r?.data?.message || 'Could not check the file.', 'error');
    }
    state.last = r.data;
    render();
  }

  /* ── drawing the preview ─────────────────────────────── */
  const EXAM_BADGE = {
    found       : ['g-ok',   'Exam found'],
    created     : ['g-ok',   'Exam created'],
    'will-create': ['g-warn', 'Will be created'],
    missing     : ['g-bad',  'No exam yet'],
    closed      : ['g-bad',  'Exam is closed'],
  };

  const learnerOptions = (d, key, current) => {
    const sel = (id) => (String(current) === String(id) ? ' selected' : '');
    const sug = (d.suggestions || []).map(s => `<option value="${esc(s.id)}"${sel(s.id)}>${esc(s.name)} — ${esc(s.className)}</option>`).join('');
    const all = (d.learners || []).map(s => `<option value="${esc(s.id)}"${sel(s.id)}>${esc(s.name)} — ${esc(s.className)}</option>`).join('');
    return `<option value=""${current === '' ? ' selected' : ''}>Skip this name</option>` +
      (sug ? `<optgroup label="Suggestions">${sug}</optgroup>` : '') +
      `<optgroup label="All learners in this grade">${all}</optgroup>`;
  };

  function render() {
    const d = state.last;
    el.preview.style.display = 'block';

    const anyMissing = d.classes.some(c => c.exam === 'missing' || c.exam === 'will-create');
    const totalMarks = d.classes.reduce((a, c) => a + c.marks, 0);
    const totalLearners = d.classes.reduce((a, c) => a + c.learnersMatched, 0);

    el.summary.innerHTML = `
      <p style="margin:0 0 10px;font-size:var(--text-sm);">
        <strong>${esc(state.fileName)}</strong> &mdash; ${state.rows.length} names in the file.
        <strong>${totalLearners}</strong> matched to learners, <strong>${totalMarks}</strong> marks ready.
      </p>
      <div style="overflow-x:auto;"><table class="g-table">
        <thead><tr><th>Class</th><th>Learners</th><th>Matched</th><th>Marks</th><th>Exam</th></tr></thead>
        <tbody>${d.classes.map(c => {
          const b = EXAM_BADGE[c.exam] || ['g-warn', c.exam];
          return `<tr><td><strong>${esc(c.className)}</strong></td><td>${c.learnersInClass}</td>
            <td>${c.learnersMatched}</td><td>${c.marks}</td><td><span class="g-badge ${b[0]}">${b[1]}</span></td></tr>`;
        }).join('')}</tbody>
      </table></div>
      ${anyMissing ? `<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:var(--text-sm);cursor:pointer;">
          <input type="checkbox" id="gCreate" ${state.createMissing ? 'checked' : ''}/>
          Create the missing exam for the class(es) above (${esc(el.gExam.value.trim())}, Term ${esc(el.gTerm.value)}, ${esc(el.gYear.value)})
        </label>` : ''}
      ${d.classes.some(c => c.exam === 'closed') ? `<p style="color:#c0392b;font-size:var(--text-sm);margin-top:10px;">A closed exam cannot take marks. Open it on the Exams page first.</p>` : ''}`;

    $('gCreate')?.addEventListener('change', (e) => { state.createMissing = e.target.checked; runPreview(); });

    let html = '';

    if (d.unmatched.length) {
      html += `<div class="g-box"><h4><span class="g-badge g-warn">${d.unmatched.length}</span> Names not found &mdash; choose the right learner, or skip</h4>
        <table class="g-table"><tbody>${d.unmatched.map(u => `
          <tr><td style="width:40%;font-weight:600;">${esc(u.fileName)}</td>
          <td><select class="marks-select g-resolve" data-key="${esc(u.key)}" style="width:100%;">
            ${learnerOptions({ suggestions: u.suggestions, learners: d.learners }, u.key, state.resolutions[u.key] ?? '')}
          </select></td></tr>`).join('')}</tbody></table></div>`;
    }

    if (d.ambiguous.length) {
      html += `<div class="g-box"><h4><span class="g-badge g-warn">${d.ambiguous.length}</span> Same name in more than one class &mdash; pick the right one</h4>
        <table class="g-table"><tbody>${d.ambiguous.map(a => `
          <tr><td style="width:40%;font-weight:600;">${esc(a.fileName)}</td>
          <td><select class="marks-select g-resolve" data-key="${esc(a.key)}" style="width:100%;">
            <option value="">Skip this name</option>
            ${a.options.map(o => `<option value="${esc(o.id)}"${String(state.resolutions[a.key]) === String(o.id) ? ' selected' : ''}>${esc(o.name)} — ${esc(o.className)}</option>`).join('')}
          </select></td></tr>`).join('')}</tbody></table></div>`;
    }

    if (d.conflicts.length) {
      html += `<div class="g-box"><h4><span class="g-badge g-warn">${d.conflicts.length}</span> Same learner listed twice with different marks (first value kept)</h4>
        <table class="g-table"><tbody>${d.conflicts.map(c => `<tr><td>${esc(c.learner)}</td><td>${esc(c.slot)}</td><td>kept ${esc(c.kept)}</td><td>ignored ${esc(c.ignored)}</td></tr>`).join('')}</tbody></table></div>`;
    }

    if (d.invalidCells.length) {
      html += `<div class="g-box"><h4><span class="g-badge g-bad">${d.invalidCells.length}</span> Marks that are not valid (must be 0–100 or AB) &mdash; skipped</h4>
        <table class="g-table"><tbody>${d.invalidCells.slice(0, 50).map(c => `<tr><td>${esc(c.learner)}</td><td>${esc(c.subject)}</td><td>${esc(c.value)}</td></tr>`).join('')}</tbody></table></div>`;
    }

    const ms = Object.entries(d.missingSubjects || {});
    if (ms.length) {
      html += `<div class="g-box"><h4><span class="g-badge g-bad">${ms.length}</span> Subjects missing in a class &mdash; those marks are skipped</h4>
        <div style="padding:10px 14px;font-size:13px;">${ms.map(([cn, sl]) => `<strong>${esc(cn)}</strong>: ${esc(sl.join(', '))}`).join('<br/>')}<br/>Add them on the Subjects page, then import again.</div></div>`;
    }

    if (d.learnersNotInFile.length) {
      html += `<details class="g-box"><summary style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:600;">
        ${d.learnersNotInFile.length} enrolled learners are not in the file (they get no marks)</summary>
        <div style="padding:8px 14px 12px;font-size:13px;line-height:1.7;">${d.learnersNotInFile.map(l => `${esc(l.name)} <span style="color:var(--text-soft);">(${esc(l.className)})</span>`).join(', ')}</div></details>`;
    }

    el.problems.innerHTML = html;
    el.problems.querySelectorAll('.g-resolve').forEach(sel => sel.addEventListener('change', () => {
      state.resolutions[sel.dataset.key] = sel.value;
      runPreview();
    }));

    const canSave = totalMarks > 0 && d.classes.some(c => ['found', 'created', 'will-create'].includes(c.exam));
    el.run.disabled = !canSave;
    const left = d.unmatched.filter(u => state.resolutions[u.key] === undefined).length + d.ambiguous.filter(a => !state.resolutions[a.key]).length;
    el.note.textContent = canSave
      ? (left ? `${left} name(s) will be skipped.` : 'Everything is matched.')
      : 'Nothing to save yet — check the exam above.';
  }

  /* ── confirm ─────────────────────────────────────────── */
  el.run.addEventListener('click', async () => {
    const d = state.last;
    if (!d || state.busy) return;
    const left = d.unmatched.filter(u => state.resolutions[u.key] === undefined).length + d.ambiguous.filter(a => !state.resolutions[a.key]).length;
    if (left && !confirm(`${left} name(s) are not matched and will be skipped. Import the rest?`)) return;

    state.busy = true;
    el.run.disabled = true;
    el.note.textContent = 'Importing…';
    const r = await API.post('/marks/import-grade', payload(false));
    state.busy = false;

    if (!r?.ok) {
      el.run.disabled = false;
      el.note.textContent = '';
      return toast(r?.data?.message || 'Import failed.', 'error');
    }

    const x = r.data;
    toast(x.message || 'Marks imported.', 'success');
    el.preview.style.display = 'none';
    el.done.style.display = 'block';
    el.doneBody.innerHTML = `
      <h3 style="margin:0 0 6px;font-size:1.05rem;"><i class="fas fa-circle-check" style="color:#27ae60;"></i> Marks imported</h3>
      <p style="margin:0 0 12px;font-size:var(--text-sm);">${esc(x.message || '')}</p>
      <table class="g-table"><thead><tr><th>Class</th><th>Learners</th><th>Marks</th></tr></thead>
        <tbody>${x.classes.map(c => `<tr><td><strong>${esc(c.className)}</strong></td><td>${c.learnersMatched}</td><td>${c.marks}</td></tr>`).join('')}</tbody></table>
      <p style="margin:14px 0 0;font-size:var(--text-sm);">
        <a href="reports.html" class="btn-primary" style="display:inline-block;padding:9px 16px;text-decoration:none;">Go to Reports</a>
      </p>`;
    state.rows = [];
    state.resolutions = {};
    el.dropTitle.textContent = 'Click to upload or drag & drop the grade sheet';
    el.file.value = '';
  });

  el.reset.addEventListener('click', () => {
    state.rows = []; state.resolutions = {}; state.last = null;
    el.preview.style.display = 'none'; el.done.style.display = 'none';
    el.dropTitle.textContent = 'Click to upload or drag & drop the grade sheet';
    el.file.value = '';
  });

  /* changing the exam settings after a file is loaded re-checks it */
  [el.gGrade, el.gTerm].forEach(e => e.addEventListener('change', () => { state.resolutions = {}; runPreview(); }));
  [el.gExam, el.gYear].forEach(e => e.addEventListener('change', () => runPreview()));
  el.gExam.addEventListener('input', () => { state.autoExam = false; });
})();
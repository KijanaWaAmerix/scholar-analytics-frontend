/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Import Marks Page
   File: js/import.js
   Reads your broad sheet Excel format and imports to MongoDB
═══════════════════════════════════════════════════════════ */

const user = requireAuth();
if (!user) throw new Error('Not authenticated');
initSidebar(user);

/* ══════════════════════════════════════════════════════════
   SUBJECT CODE MAP
   Maps Excel column headers → your database subject codes
══════════════════════════════════════════════════════════ */
const SUBJECT_MAP = {
  'ENG'      : 'ENG',
  'ENGLISH'  : 'ENG',
  'MAT'      : 'MATH',
  'MATH'     : 'MATH',
  'MATHS'    : 'MATH',
  'MATHEMATICS': 'MATH',
  'KISW'     : 'KIS',
  'KISWAHILI': 'KIS',
  'KIS'      : 'KIS',
  'INTER'    : 'INTER',
  'INTEGRATED SCIENCE': 'INTER',
  'INTEGRATED': 'INTER',
  'SST'      : 'SST',
  'SOCIAL STUDIES': 'SST',
  'SOCIAL'   : 'SST',
  'CRE'      : 'CRE',
  'RELIGIOUS EDUCATION': 'CRE',
  'IRE'      : 'CRE',
  'HRE'      : 'CRE',
  'CAS'      : 'CAS',
  'CREATIVE ARTS': 'CAS',
  'CREATIVE ARTS & SPORTS': 'CAS',
  'CREATIVE': 'CAS',
  'AGN'      : 'AGR',
  'AGR'      : 'AGR',
  'AGRICULTURE': 'AGR',
  'PRE-TECH' : 'PRT',
  'PRE TECH' : 'PRT',
  'PRT'      : 'PRT',
  'PRE TECHNICAL': 'PRT',
  'PRETECH'  : 'PRT',
};

/* Name columns to skip */
const SKIP_COLS = [
  'NAMES OF STUDENTS', 'NAME', 'STUDENT NAME', 'FULL NAME',
  'NAMES', 'TOTAL', 'RANK', 'AVERAGE', 'AVG', 'POSITION',
  'MEAN GRADE', 'POINTS', 'MEAN POINTS', 'GENDER', 'UPI',
  'UPI NUMBER', 'ADMISSION NO', 'ASSESSMENT NO',
];

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
const state = {
  rows        : [],     /* Parsed rows from Excel */
  subjects    : [],     /* Subject columns detected */
  nameCol     : '',     /* Name column key */
  dbSubjects  : [],     /* Subjects from DB for selected class */
  classId     : '',
  examId      : '',
};

/* ══════════════════════════════════════════════════════════
   LOAD DROPDOWNS
══════════════════════════════════════════════════════════ */
const loadClasses = async () => {
  const result = await API.get('/classes');
  if (!result?.ok) return;
  const sel = document.getElementById('importClass');
  if (sel) {
    sel.innerHTML = '<option value="">-- Select Class --</option>' +
      (result.data.classes || []).map(c =>
        `<option value="${c._id}">${c.name}</option>`
      ).join('');
  }
};

const loadExams = async () => {
  const classId = document.getElementById('importClass')?.value;
  const term    = document.getElementById('importTerm')?.value;
  if (!classId || !term) return;

  const sel = document.getElementById('importExam');
  if (sel) sel.innerHTML = '<option value="">Loading...</option>';

  const result = await API.get(`/exams?class=${classId}&term=${term}`);
  if (!result?.ok || !result.data.exams?.length) {
    if (sel) sel.innerHTML = '<option value="">No exams found</option>';
    return;
  }

  if (sel) {
    sel.innerHTML = '<option value="">-- Select Exam --</option>' +
      result.data.exams.map(e =>
        `<option value="${e._id}">${e.name}</option>`
      ).join('');
  }
};

/* Load DB subjects when class changes */
const loadDbSubjects = async (classId) => {
  const result = await API.get(`/subjects?class=${classId}`);
  state.dbSubjects = result?.data?.subjects || [];
};

document.getElementById('importClass')?.addEventListener('change', async (e) => {
  state.classId = e.target.value;
  await Promise.all([loadExams(), loadDbSubjects(e.target.value)]);
  if (state.rows.length) buildColumnMap();
});

document.getElementById('importTerm')?.addEventListener('change', loadExams);
document.getElementById('importExam')?.addEventListener('change', (e) => {
  state.examId = e.target.value;
});

/* ══════════════════════════════════════════════════════════
   FILE UPLOAD — DRAG + DROP + CLICK
══════════════════════════════════════════════════════════ */
const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('excelFileInput');

dropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone?.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) readExcelFile(file);
});

fileInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) readExcelFile(file);
});

/* ══════════════════════════════════════════════════════════
   READ EXCEL FILE
══════════════════════════════════════════════════════════ */
const readExcelFile = (file) => {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showToast('Please upload an .xlsx or .xls file.', 'error');
    return;
  }

  const reader = new FileReader();

  reader.onload = (ev) => {
    try {
      const wb       = XLSX.read(ev.target.result, { type: 'binary' });
      const sheetName= wb.SheetNames[0];
      const ws       = wb.Sheets[sheetName];
      const rawRows  = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rawRows.length) {
        showToast('No data found in the file.', 'warning');
        return;
      }

      /* Find header row — skip school name / title rows */
      let dataRows = rawRows;
      const headers = Object.keys(rawRows[0]);

      /* Detect name column */
      state.nameCol = headers.find(h =>
        ['NAMES OF STUDENTS', 'NAME', 'STUDENT NAME', 'FULL NAME', 'NAMES'].includes(h.trim().toUpperCase())
      ) || headers[0];

      /* Filter out rows where name is empty or is a header/title */
      dataRows = rawRows.filter(row => {
        const name = String(row[state.nameCol] || '').trim();
        return name.length > 2 &&
               !name.toUpperCase().includes('SCHOOL') &&
               !name.toUpperCase().includes('BROAD SHEET') &&
               !name.toUpperCase().includes('ASSESSMENT') &&
               !name.toUpperCase().includes('GRADE') &&
               !/^\d+$/.test(name);
      });

      /* Detect subject columns */
      state.subjects = headers.filter(h => {
        const upper = h.trim().toUpperCase();
        return !SKIP_COLS.includes(upper) &&
               h !== state.nameCol &&
               SUBJECT_MAP[upper] !== undefined;
      });

      state.rows = dataRows;

      showToast(`Found ${dataRows.length} students and ${state.subjects.length} subjects.`, 'success');

      buildColumnMap();
      buildPreview();

    } catch (err) {
      console.error(err);
      showToast('Failed to read Excel file. Check the format.', 'error');
    }
  };

  reader.readAsBinaryString(file);
};

/* ══════════════════════════════════════════════════════════
   BUILD COLUMN MAP
══════════════════════════════════════════════════════════ */
const buildColumnMap = () => {
  const wrap = document.getElementById('columnMapWrap');
  const body = document.getElementById('columnMapBody');
  if (!wrap || !body) return;

  wrap.style.display = 'block';

  const rows = [
    {
      excel  : state.nameCol,
      db     : 'Student Name (matched by name)',
      matched: true,
    },
    ...state.subjects.map(col => {
      const upper   = col.trim().toUpperCase();
      const dbCode  = SUBJECT_MAP[upper];
      const dbSubj  = state.dbSubjects.find(s =>
        s.code?.toUpperCase() === dbCode ||
        s.name?.toUpperCase().includes(col.trim().toUpperCase())
      );
      return {
        excel  : col,
        db     : dbSubj ? `${dbSubj.name} (${dbSubj.code})` : `Code: ${dbCode || '?'} — add to Subjects`,
        matched: !!dbSubj,
      };
    }),
  ];

  body.innerHTML = rows.map(r => `
    <div class="import-column-row">
      <span class="import-col-excel">${r.excel}</span>
      <span class="import-col-arrow"><i class="fas fa-arrow-right"></i></span>
      <span class="import-col-db">${r.db}</span>
      <span class="import-col-status ${r.matched ? 'matched' : 'unmatched'}">
        ${r.matched ? '<i class="fas fa-circle-check"></i> Matched' : '<i class="fas fa-circle-xmark"></i> Not found'}
      </span>
    </div>
  `).join('');
};

/* ══════════════════════════════════════════════════════════
   BUILD PREVIEW TABLE
══════════════════════════════════════════════════════════ */
const buildPreview = () => {
  const card     = document.getElementById('previewCard');
  const head     = document.getElementById('previewHead');
  const body     = document.getElementById('previewBody');
  const subtitle = document.getElementById('previewSubtitle');
  if (!card || !head || !body) return;

  card.style.display = 'block';
  if (subtitle) subtitle.textContent = `${state.rows.length} students detected`;

  const previewCols = [state.nameCol, ...state.subjects];

  head.innerHTML = `<tr>${previewCols.map(c => `<th>${c}</th>`).join('')}</tr>`;

  const preview = state.rows.slice(0, 10);

  body.innerHTML = preview.map(row => `
    <tr>
      ${previewCols.map(col => `<td>${row[col] ?? '—'}</td>`).join('')}
    </tr>
  `).join('') + (state.rows.length > 10 ? `
    <tr>
      <td colspan="${previewCols.length}" style="text-align:center;padding:12px;color:var(--text-soft);font-style:italic;">
        ... and ${state.rows.length - 10} more rows
      </td>
    </tr>` : '');
};

/* ══════════════════════════════════════════════════════════
   CLEAR
══════════════════════════════════════════════════════════ */
document.getElementById('clearImportBtn')?.addEventListener('click', () => {
  state.rows     = [];
  state.subjects = [];
  state.nameCol  = '';

  document.getElementById('previewCard').style.display    = 'none';
  document.getElementById('columnMapWrap').style.display  = 'none';
  document.getElementById('resultsCard').style.display    = 'none';
  document.getElementById('progressCard').style.display   = 'none';

  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) fileInput.value = '';
});

/* ══════════════════════════════════════════════════════════
   RUN IMPORT
══════════════════════════════════════════════════════════ */
document.getElementById('runImportBtn')?.addEventListener('click', runImport);

async function runImport() {
  const classId = document.getElementById('importClass')?.value;
  const examId  = document.getElementById('importExam')?.value;

  if (!classId) { showToast('Please select a class.', 'warning'); return; }
  if (!examId)  { showToast('Please select an exam.',  'warning'); return; }
  if (!state.rows.length) { showToast('No data to import.', 'warning'); return; }

  /* Build rows payload */
  const rows = state.rows.map(row => {
    const name   = String(row[state.nameCol] || '').trim();
    const scores = {};

    state.subjects.forEach(col => {
      const upper = col.trim().toUpperCase();
      const code  = SUBJECT_MAP[upper];
      if (!code) return;
      const val = parseFloat(row[col]);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        scores[code] = val;
      }
    });

    return { name, scores };
  }).filter(r => r.name);

  /* Show progress */
  document.getElementById('progressCard').style.display = 'block';
  document.getElementById('previewCard').style.display  = 'none';
  document.getElementById('resultsCard').style.display  = 'none';

  const fill = document.getElementById('importProgressFill');
  const text = document.getElementById('importProgressText');

  if (fill) fill.style.width = '30%';
  if (text) text.textContent = `Importing ${rows.length} students...`;

  /* Call API */
  const result = await API.post('/results/import-marks', {
    classId,
    examId,
    rows,
  });

  if (fill) fill.style.width = '100%';

  setTimeout(() => {
    document.getElementById('progressCard').style.display = 'none';

    if (!result?.ok) {
      showToast(result?.data?.message || 'Import failed.', 'error');
      document.getElementById('previewCard').style.display = 'block';
      return;
    }

    /* Show results */
    const data = result.data;
    document.getElementById('resultsCard').style.display = 'block';

    const setEl = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };

    setEl('importedCount',  data.imported || 0);
    setEl('skippedCount',   data.skipped  || 0);
    setEl('totalRowsCount', rows.length);

    /* Skipped list */
    const listEl = document.getElementById('importResultsList');
    if (listEl) {
      if (data.errors?.length) {
        listEl.innerHTML = `
          <p style="font-size:var(--text-xs);font-weight:700;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
            Students Not Matched (${data.errors.length})
          </p>
          ${data.errors.map(e => `
            <div class="import-result-item">
              <span class="import-result-icon" style="color:#e74c3c;"><i class="fas fa-circle-xmark"></i></span>
              <span style="font-size:var(--text-sm);color:var(--text-dark);">${e}</span>
              <span style="font-size:var(--text-xs);color:var(--text-soft);margin-left:auto;">Not found in database</span>
            </div>
          `).join('')}
          <div style="margin-top:14px;padding:12px 14px;background:var(--info-light);border:1px solid var(--info-border);border-radius:var(--radius-sm);font-size:var(--text-sm);color:#1a6fa8;">
            <i class="fas fa-circle-info"></i>
            Unmatched students need to be added to the Students page first, 
            with names matching exactly as in your Excel sheet.
          </div>
        `;
      } else {
        listEl.innerHTML = `
          <div style="text-align:center;padding:24px;color:#27ae60;">
            <i class="fas fa-circle-check" style="font-size:32px;display:block;margin-bottom:10px;"></i>
            <p style="font-weight:700;">All students matched successfully!</p>
          </div>`;
      }
    }

    showToast(`${data.imported} marks imported successfully!`, 'success');

  }, 800);
}

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
loadClasses();
/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Downloadable Results Report
   File: js/results-report.js   (load AFTER results.js and class-sheet.js)
   Adds a "Download Report" button next to "Export CSV".
   Opens the print-ready class sheet (same design as the Reports
   page); choose "Save as PDF" in the print window.

   Add  <script src="../js/class-sheet.js"></script>  in results.html
   BEFORE this file.
═══════════════════════════════════════════════════════════ */
(() => {

/* Teacher names typed on the Reports page are saved in this browser per class.
   Read the ones for the class(es) being shown so the sheet can print them. */
const TEACHER_STORE_KEY = 'sa_report_subject_teachers_v1';

const classesInView = () => {
  if (state.scope === 'grade') {
    return state.classes.filter(c => String(c.grade) === String(state.gradeValue));
  }
  const id = state.classInfo?._id;
  const c  = state.classes.find(x => x._id === id);
  return c ? [c] : [];
};

const loadTeacherMaps = () => {
  let store = {};
  try { store = JSON.parse(localStorage.getItem(TEACHER_STORE_KEY)) || {}; } catch { store = {}; }
  const maps = {};
  classesInView().forEach(c => {
    const m = store[`class:${c._id}`];
    if (m && Object.values(m).some(Boolean)) maps[c.name] = m;
  });
  return maps;
};

const buildInput = () => {
  const school = (typeof Auth !== 'undefined' && Auth.getSchool && Auth.getSchool()) || {};
  const exam   = state.examInfo || {};
  const cls    = state.classes.find(c => c._id === state.classInfo?._id);

  return {
    results    : state.results,
    subjects   : state.subjects,
    classes    : state.classes,
    teacherMaps: loadTeacherMaps(),
    meta: {
      schoolName : school.name || school.schoolName || 'School',
      schoolMotto: school.motto || '',
      className  : state.classInfo?.name || 'Class',
      term       : exam.term || '',
      exam       : exam.name || '',
      year       : exam.academicYear || '',
      scope      : state.scope,
      streamLabel: state.scope === 'class' ? (cls?.stream || state.classInfo?.name || '') : '',
      teacher    : '',
      principal  : '',
    },
  };
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

    if (!window.ClassSheet) {
      showToast('class-sheet.js is not loaded. Add it to results.html before results-report.js.', 'error');
      return;
    }

    if (!window.ClassSheet.openPrintWindow(buildInput())) {
      showToast('Please allow pop-ups for this site, then try again.', 'warning');
      return;
    }
    showToast('In the print window, choose "Save as PDF" (landscape A4).', 'info');
  });
}

})();
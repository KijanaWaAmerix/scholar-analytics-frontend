/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Class sheet from the Results page
   File: js/results-report.js   (load AFTER results.js)

   "Download Class Sheet" opens the Reports page with this class,
   term and exam already selected and the class sheet ready, so the
   sheet is exactly the one the Reports page makes (same layout,
   same PDF). There is only one class-sheet design to maintain.
═══════════════════════════════════════════════════════════ */
(() => {
  const link = document.getElementById('classSheetLink');
  if (!link) return;

  link.addEventListener('click', (e) => {
    e.preventDefault();

    const cls  = document.getElementById('selClass')?.value;
    const term = document.getElementById('selTerm')?.value;
    const exam = document.getElementById('selExam')?.value;

    if (!(typeof state !== 'undefined' && state.results?.length) || !cls || !term || !exam) {
      showToast('Load the results first, then download the class sheet.', 'warning');
      return;
    }

    const q = new URLSearchParams({ cls, term, exam });
    window.location.href = 'reports.html?' + q.toString();
  });
})();
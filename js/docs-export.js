/* ═══════════════════════════════════════════════════════════
   SCHOLAR ANALYTICS — Document export (PDF, Word, Print)
   File: js/docs-export.js  Version: 1.0

   Used by: Schemes of Work (now), Lesson Plans and Record of Work.
   Needs on the page:  jsPDF 2.5.1, jspdf-autotable 3.8.2, docx 7.8.2

   Every document is described once, as a "spec", and then drawn as a
   PDF or a Word file from that same spec, so the two always say the
   same thing. Print opens the PDF itself, so what prints is exactly
   what downloads.

   Look: white page, black text, black gridlines, large clear print
   (same as the report cards).

   spec = {
     orientation : 'landscape' | 'portrait',
     title       : 'SCHEME OF WORK',
     subtitle    : 'GRADE 8 INTEGRATED SCIENCE – TERM 1 – 2026',
     meta        : [ [ [label, value], [label, value] ], [ [label, value] ] ],
                   (each inner list is one row of the title block: one or two label/value pairs)
     columns     : [ { header:'Week', width: 5 }, ... ]          (widths are percentages, sum 100)
     rows        : [ ['1','1',...] , { band:'HALF TERM · 16 Feb – 20 Feb' } ],
     extra       : { columns:[{header,width}], rows:[[...]] }     (optional second table, e.g. sign-off)
     endLine     : 'REFLECTION / INSPECTOR:'                      (optional)
   }
═══════════════════════════════════════════════════════════ */

const DocExport = (() => {

  /* ── Text safety ───────────────────────────────────────────
     The PDF's built-in font covers Western European letters, so a few
     special characters are replaced by plain equivalents (H₂O -> H2O).
     Word files keep the original characters. */
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const SUP = { '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  const KEEP = new Set([0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026]);

  const forPdf = (value) =>
    String(value ?? '')
      .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))
      .replace(/[⁰⁴-⁹]/g, (c) => SUP[c])
      .replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=')
      .replace(/[^\u0000-ÿ]/g, (c) => (KEEP.has(c.codePointAt(0)) ? c : '?'));

  const forWord = (value) => String(value ?? '');

  const safeName = (text) =>
    String(text || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  /* ── PDF ─────────────────────────────────────────────────── */
  const MARGIN   = 10;                 // mm
  const LINE_W   = 0.3;                // mm, clear black gridlines
  const BLACK    = [0, 0, 0];
  const WHITE    = [255, 255, 255];

  /* Share of the page width for the four columns of the title block (label, value, label, value) */
const META_LANDSCAPE = [0.16, 0.34, 0.16, 0.34];
const META_PORTRAIT  = [0.21, 0.29, 0.21, 0.29];

const lineStyles = { lineColor: BLACK, lineWidth: LINE_W, textColor: BLACK, fillColor: WHITE };

  const buildPdf = (specs) => {
    const { jsPDF } = window.jspdf;
    const first = specs[0];
    const doc = new jsPDF({ orientation: first.orientation, unit: 'mm', format: 'a4' });

    specs.forEach((spec, index) => {
      if (index > 0) doc.addPage('a4', spec.orientation);

      const pageW  = doc.internal.pageSize.getWidth();
      const pageH  = doc.internal.pageSize.getHeight();
      const usable = pageW - MARGIN * 2;
      const big    = spec.orientation === 'landscape';

      /* Title */
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(big ? 17 : 16);
      doc.text(forPdf(spec.title), pageW / 2, MARGIN + 6, { align: 'center' });
      doc.setFontSize(big ? 11.5 : 11);
      doc.text(forPdf(spec.subtitle), pageW / 2, MARGIN + 12.5, { align: 'center' });

      /* Title block (school, teacher, TSC No ...) */
      const metaBody = spec.meta.map((row) => {
        if (row.length === 1) {
          return [
            { content: forPdf(row[0][0]), styles: { fontStyle: 'bold' } },
            { content: forPdf(row[0][1]), colSpan: 3 },
          ];
        }
        return [
          { content: forPdf(row[0][0]), styles: { fontStyle: 'bold' } },
          { content: forPdf(row[0][1]) },
          { content: forPdf(row[1][0]), styles: { fontStyle: 'bold' } },
          { content: forPdf(row[1][1]) },
        ];
      });

      const share = big ? META_LANDSCAPE : META_PORTRAIT;

      doc.autoTable({
        startY: MARGIN + 16,
        body: metaBody,
        theme: 'grid',
        margin: { left: MARGIN, right: MARGIN },
        styles: { ...lineStyles, font: 'helvetica', fontSize: big ? 10.5 : 10.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: usable * share[0] },
          1: { cellWidth: usable * share[1] },
          2: { cellWidth: usable * share[2] },
          3: { cellWidth: usable * share[3] },
        },
      });

      /* Main table */
      const fontSize = big ? 8.6 : 10;
      const columnStyles = {};
      spec.columns.forEach((c, i) => { columnStyles[i] = { cellWidth: (usable * c.width) / 100 }; });

      const body = spec.rows.map((row) =>
        row.band !== undefined
          ? [{
              content: forPdf(row.band),
              colSpan: spec.columns.length,
              styles: { halign: 'center', fontStyle: 'bold', fontSize: fontSize + 1.5, cellPadding: 3 },
            }]
          : row.map((cell) => forPdf(cell))
      );

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 4,
        head: [spec.columns.map((c) => forPdf(c.header).toUpperCase())],
        body,
        theme: 'grid',
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
        margin: { left: MARGIN, right: MARGIN, bottom: 14 },
        styles: { ...lineStyles, font: 'helvetica', fontSize, cellPadding: 1.8, valign: 'top', overflow: 'linebreak' },
        headStyles: { ...lineStyles, fontStyle: 'bold', fontSize: fontSize - (big ? 1.0 : 0.4), valign: 'middle' },
        columnStyles,
      });

      /* Optional second table (sign-off rows) */
      if (spec.extra) {
        const extraColumns = {};
        spec.extra.columns.forEach((c, i) => { extraColumns[i] = { cellWidth: (usable * c.width) / 100 }; });
        let startY = doc.lastAutoTable.finalY + 6;
        if (startY + 30 > pageH - 14) { doc.addPage('a4', spec.orientation); startY = MARGIN; }

        doc.autoTable({
          startY,
          head: [spec.extra.columns.map((c) => forPdf(c.header).toUpperCase())],
          body: spec.extra.rows.map((r) => r.map((c, i) => (
            i === 0 ? { content: forPdf(c), styles: { fontStyle: 'bold' } } : forPdf(c)
          ))),
          theme: 'grid',
          margin: { left: MARGIN, right: MARGIN, bottom: 14 },
          styles: { ...lineStyles, font: 'helvetica', fontSize: 10, cellPadding: 3.2, minCellHeight: 11 },
          headStyles: { ...lineStyles, fontStyle: 'bold' },
          columnStyles: extraColumns,
        });
      }

      /* Optional closing line, e.g. REFLECTION / INSPECTOR */
      if (spec.endLine) {
        let y = doc.lastAutoTable.finalY + 10;
        if (y > pageH - 16) { doc.addPage('a4', spec.orientation); y = MARGIN + 6; }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(0, 0, 0);
        const label = forPdf(spec.endLine);
        doc.text(label, MARGIN, y);
        const x = MARGIN + doc.getTextWidth(label) + 2;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(LINE_W);
        doc.line(x, y + 0.5, pageW - MARGIN, y + 0.5);
      }
    });

    /* Page numbers on every page */
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(`Page ${p} of ${total}`, w - MARGIN, h - 6, { align: 'right' });
    }
    return doc;
  };

  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const downloadPdf = (specs, filenameBase) => {
    const doc = buildPdf(specs);
    doc.save(`${filenameBase}.pdf`);
    return doc.getNumberOfPages();
  };

  /* Print: open the very same PDF in a hidden frame and print it */
  const printPdf = (specs) => {
    const doc  = buildPdf(specs);
    const url  = URL.createObjectURL(doc.output('blob'));
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        window.open(url, '_blank');          // the browser would not print inside the frame
      }
      setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
    };
    document.body.appendChild(frame);
  };

  /* ── Word ────────────────────────────────────────────────── */
  const buildDocx = (specs) => {
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
      BorderStyle, PageOrientation, Footer, PageNumber, VerticalAlign,
    } = window.docx;

    const border  = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const borders = { top: border, bottom: border, left: border, right: border };
    const FONT    = 'Arial';

    const run = (text, opts = {}) => new TextRun({ text: forWord(text), font: FONT, color: '000000', ...opts });

    const cell = (text, width, { bold = false, size = 20, columnSpan, align } = {}) =>
      new TableCell({
        width: { size: width, type: WidthType.DXA },
        columnSpan,
        borders,
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
        children: String(text ?? '').split('\n').map((line) => new Paragraph({
          alignment: align,
          children: [run(line, { bold, size })],
        })),
      });

    const sections = specs.map((spec) => {
      const landscape = spec.orientation === 'landscape';
      const pageW = 11906, pageH = 16838, margin = 720;
      const usable = (landscape ? pageH : pageW) - margin * 2;
      const dxa = (pct) => Math.round((usable * pct) / 100);
      const children = [];

      children.push(new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [run(spec.title, { bold: true, size: 34 })],
      }));
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 160 },
        children: [run(spec.subtitle, { bold: true, size: 24 })],
      }));

      /* Title block */
      const sh = landscape ? META_LANDSCAPE : META_PORTRAIT;
      const w = sh.map((x) => dxa(x * 100));
      children.push(new Table({
        width: { size: usable, type: WidthType.DXA },
        columnWidths: w,
        rows: spec.meta.map((row) => new TableRow({
          cantSplit: true,
          children: row.length === 1
            ? [cell(row[0][0], w[0], { bold: true, size: 22 }),
               cell(row[0][1], w[1] + w[2] + w[3], { size: 22, columnSpan: 3 })]
            : [cell(row[0][0], w[0], { bold: true, size: 22 }), cell(row[0][1], w[1], { size: 22 }),
               cell(row[1][0], w[2], { bold: true, size: 22 }), cell(row[1][1], w[3], { size: 22 })],
        })),
      }));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

      /* Main table */
      const cw   = spec.columns.map((c) => dxa(c.width));
      const size = landscape ? 17 : 20;
      children.push(new Table({
        width: { size: usable, type: WidthType.DXA },
        columnWidths: cw,
        rows: [
          new TableRow({
            tableHeader: true, cantSplit: true,
            children: spec.columns.map((c, i) => cell(String(c.header).toUpperCase(), cw[i], { bold: true, size: size - 1 })),
          }),
          ...spec.rows.map((row) => new TableRow({
            cantSplit: true,
            children: row.band !== undefined
              ? [cell(row.band, usable, { bold: true, size: size + 3, columnSpan: spec.columns.length, align: AlignmentType.CENTER })]
              : row.map((c, i) => cell(c, cw[i], { size })),
          })),
        ],
      }));

      /* Sign-off table */
      if (spec.extra) {
        const ew = spec.extra.columns.map((c) => dxa(c.width));
        children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
        children.push(new Table({
          width: { size: usable, type: WidthType.DXA },
          columnWidths: ew,
          rows: [
            new TableRow({
              cantSplit: true,
              children: spec.extra.columns.map((c, i) => cell(String(c.header).toUpperCase(), ew[i], { bold: true })),
            }),
            ...spec.extra.rows.map((r) => new TableRow({
              cantSplit: true, height: { value: 520, rule: 'atLeast' },
              children: r.map((c, i) => cell(c, ew[i], { bold: i === 0 })),
            })),
          ],
        }));
      }

      if (spec.endLine) {
        children.push(new Paragraph({
          spacing: { before: 300 },
          children: [run(`${spec.endLine} ______________________________________________________________________`, { size: 21 })],
        }));
      }

      return {
        properties: {
          page: {
            size: { width: pageW, height: pageH, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                run('Page ', { size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '000000' }),
                run(' of ', { size: 18 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: '000000' }),
              ],
            })],
          }),
        },
        children,
      };
    });

    return new Document({
      creator: 'Scholar Analytics',
      title: specs[0].title,
      styles: { default: { document: { run: { font: FONT, color: '000000' } } } },
      sections,
    });
  };

  const downloadDocx = async (specs, filenameBase) => {
    const blob = await window.docx.Packer.toBlob(buildDocx(specs));
    saveBlob(blob, `${filenameBase}.docx`);
  };

  return { downloadPdf, downloadDocx, printPdf, safeName };
})();

window.DocExport = DocExport;

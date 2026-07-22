import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Build a structured PDF report from the auditor session data.
 * Uses native jsPDF text/table rendering — no html2canvas dependency.
 */
export function exportAuditorReport({ modelName, engine, modelType, history, filename }) {
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const usable = pageWidth - margin * 2;
  let y = margin;

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(10, 10, 12);
  doc.rect(0, 0, pageWidth, 90, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(197, 160, 89); // gold
  doc.text("RayCtify — Audit Report", margin, 52);

  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, 72);

  y = 110;

  // ── Model metadata ──────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Model Details", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);

  const safeHistory = Array.isArray(history) ? history : [];

  const meta = [
    ["Model File", modelName || "N/A"],
    ["Engine", engine || "N/A"],
    ["Model Type", modelType === "rayctified" ? "RayCtified (Post-Processed)" : "Standard (Unmitigated)"],
    ["Session Entries", String(safeHistory.length)]
  ];

  meta.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 100, y);
    y += 16;
  });

  y += 12;

  // ── Session log table ───────────────────────────────
  if (safeHistory.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("Session Log", margin, y);
    y += 8;

    const head = [["#", "Case ID", "Time", "Mode", "Decision", "Summary"]];
    const body = safeHistory.map((row, i) => [
      String(i + 1),
      row.caseId || row.case_id || "manual",
      row.timestamp || "",
      row.mode || "",
      row.decision || "",
      (row.summary || "").substring(0, 80)
    ]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 5,
        lineColor: [220, 220, 220],
        lineWidth: 0.5,
        textColor: [50, 50, 50]
      },
      headStyles: {
        fillColor: [10, 10, 12],
        textColor: [197, 160, 89],
        fontStyle: "bold",
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 80 },
        5: { cellWidth: usable * 0.3 }
      }
    });

    y = doc.lastAutoTable.finalY + 20;

    // ── Parameter snapshots for each entry ────────────
    safeHistory.forEach((row, i) => {
      if (!row.parameters || Object.keys(row.parameters).length === 0) return;

      // Check if we need a new page
      if (y > doc.internal.pageSize.getHeight() - 120) {
        doc.addPage();
        y = margin;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(`Parameters — ${row.caseId || row.case_id || `Case ${i + 1}`}`, margin, y);
      y += 6;

      const paramHead = [["Parameter", "Value"]];
      const paramBody = Object.entries(row.parameters).map(([k, v]) => [
        k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        String(v)
      ]);

      autoTable(doc, {
        startY: y,
        head: paramHead,
        body: paramBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 4, textColor: [60, 60, 60] },
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: [197, 160, 89],
          fontStyle: "bold",
          fontSize: 7.5
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 140 } }
      });

      y = doc.lastAutoTable.finalY + 16;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(140, 140, 140);
    doc.text("No session entries recorded.", margin, y);
  }

  // ── Footer on every page ────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `RayCtify — Zero-Retention Audit Report  |  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
  }

  // Robust manual download to bypass Safari/macOS async click issues
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Legacy wrapper — keeps the old function signature working for
 * non-auditor sections that still use the html2canvas approach.
 */
export async function exportElementToPdf(element, filename) {
  if (!element) {
    throw new Error("No report surface was available for export.");
  }

  // Dynamic import so html2canvas isn't bundled unless needed
  const html2canvas = (await import("html2canvas")).default;

  const canvas = await html2canvas(element, {
    backgroundColor: "#0A0A0C",
    scale: 2,
    useCORS: true
  });

  const image = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "pt", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const m = 24;
  const printW = pageW - m * 2;
  const ratio = printW / canvas.width;
  const height = canvas.height * ratio;
  let heightLeft = height;
  let offsetY = m;

  pdf.addImage(image, "PNG", m, offsetY, printW, height, undefined, "FAST");
  heightLeft -= pageH - m * 2;

  while (heightLeft > 0) {
    offsetY = m - (height - heightLeft);
    pdf.addPage();
    pdf.addImage(image, "PNG", m, offsetY, printW, height, undefined, "FAST");
    heightLeft -= pageH - m * 2;
  }

  // Robust manual download to bypass Safari/macOS async click issues
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

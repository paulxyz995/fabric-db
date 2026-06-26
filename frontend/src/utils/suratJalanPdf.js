import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const fmt = (v) => Number(v ?? 0).toLocaleString('id-ID');
// Weights/kg always show 2 decimals to match the printed form (26,00 not 26)
const fmt2 = (v) => Number(v ?? 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Normalize items (array of numbers, or [{kg}]) to a plain number array.
export function itemWeights(items) {
  return (Array.isArray(items) ? items : []).map((v) =>
    typeof v === 'object' && v !== null ? Number(v.kg) : Number(v)
  );
}

// Arrange weights into a grid that fills DOWN each column (like the printed form).
// 30 rolls -> 3 columns of 10. Returns { cols, rows, matrix:[row][col] }.
export function rincianGrid(items) {
  const arr = itemWeights(items);
  const n = arr.length;
  const cols = Math.min(6, Math.max(1, Math.ceil(n / 10)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const matrix = [];
  for (let r = 0; r < rows; r++) {
    const line = [];
    for (let c = 0; c < cols; c++) {
      const idx = c * rows + r;
      line.push(idx < n ? arr[idx] : null);
    }
    matrix.push(line);
  }
  return { cols, rows, matrix };
}

// Render a Surat Jalan that mirrors the printed continuous-form layout:
// header fields (No / Jenis Kain | Tanggal / Kepada), centered "Rincian",
// plain weight columns, a boxed Total row, and signature labels.
// Continuous-form page size: 24 cm x 14 cm (landscape).
export const PAGE_W_MM = 240;
export const PAGE_H_MM = 140;

export function exportSuratJalan(sj) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_W_MM, PAGE_H_MM] });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;
  const midX = pageW / 2 + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  // Header fields
  let y = 12;
  const fieldL = (x, label, val, lw) => {
    doc.text(label, x, y);
    doc.text(`:  ${val ?? ''}`, x + lw, y);
  };
  fieldL(M, 'Surat Jalan No', sj.number, 28);
  fieldL(midX, 'Tanggal', sj.tanggal ? dayjs(sj.tanggal).format('DD MMMM YYYY') : '', 20);
  y += 7;
  fieldL(M, 'Jenis Kain', sj.jenis_kain, 28);
  fieldL(midX, 'Kepada', sj.kepada, 20);

  // Divider under header
  y += 4;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(M, y, pageW - M, y);

  // Rincian (centered label)
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Rincian', pageW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  // Weight columns — plain (no cell borders), left aligned
  const { matrix } = rincianGrid(sj.items);
  const body = matrix.map((line) => line.map((v) => (v == null ? '' : fmt2(v))));
  autoTable(doc, {
    startY: y + 3,
    body,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 0.4, bottom: 0.4, left: 1.5, right: 9 }, halign: 'left' },
    margin: { left: M, right: M },
    tableWidth: 'wrap',
  });

  // Total box: | Total | N ROLL | X KG |
  const ty = doc.lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: ty,
    body: [['Total', `${fmt(sj.total_rolls)} ROLL`, `${fmt2(sj.total_kg)} KG`]],
    theme: 'grid',
    styles: { fontSize: 10, fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.3, cellPadding: 2.2 },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 42 }, 2: { cellWidth: 42 } },
    margin: { left: M },
  });

  if (sj.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Catatan: ${sj.notes}`, M, doc.lastAutoTable.finalY + 6);
  }

  // Signature labels at the bottom
  const sigY = pageH - 10;
  doc.setFontSize(10);
  doc.text('Tanda Terima', M, sigY);
  doc.text('Hormat Kami,', pageW - M, sigY, { align: 'right' });

  doc.save(`SuratJalan_${sj.number || 'draft'}.pdf`);
}

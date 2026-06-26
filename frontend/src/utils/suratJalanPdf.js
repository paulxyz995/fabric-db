import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const fmt = (v) => Number(v ?? 0).toLocaleString('id-ID');

// Normalize items (array of numbers, or [{kg}]) to a plain number array.
export function itemWeights(items) {
  return (Array.isArray(items) ? items : []).map((v) =>
    typeof v === 'object' && v !== null ? Number(v.kg) : Number(v)
  );
}

// Arrange weights into a grid that fills DOWN each column (like the Excel sheet).
// 37 rolls -> 4 columns of 10. Returns { cols, rows, matrix:[row][col] }.
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

// Render a Surat Jalan (delivery note) PDF mirroring the spreadsheet layout.
export function exportSuratJalan(sj, { company = 'MAKLOON' } = {}) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const M = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SURAT JALAN', pageW / 2, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(company, pageW / 2, 24, { align: 'center' });
  doc.setDrawColor(150);
  doc.line(M, 28, pageW - M, 28);

  // Header fields: left column (No / Jenis Kain), right column (Tanggal / Kepada)
  doc.setFontSize(11);
  const midX = pageW / 2 + 4;
  let y = 37;
  const field = (x, label, val, lw) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, x, y);
    doc.setFont('helvetica', 'normal'); doc.text(`: ${val ?? '-'}`, x + lw, y);
  };
  field(M, 'Surat Jalan No', sj.number, 32);
  field(midX, 'Tanggal', sj.tanggal ? dayjs(sj.tanggal).format('DD MMMM YYYY') : '-', 22);
  y += 8;
  field(M, 'Jenis Kain', sj.jenis_kain, 32);
  field(midX, 'Kepada', sj.kepada, 22);

  // Rincian grid (column-major fill)
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Rincian (kg)', M, y);

  const { matrix } = rincianGrid(sj.items);
  const body = matrix.map((line) => line.map((v) => (v == null ? '' : fmt(v))));
  autoTable(doc, {
    startY: y + 3,
    body,
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center', cellPadding: 2, lineColor: [120, 120, 120], lineWidth: 0.2 },
    margin: { left: M, right: M },
  });

  // Total line
  let ty = doc.lastAutoTable.finalY + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total', M, ty);
  doc.text(`${fmt(sj.total_rolls)} ROLL`, M + 30, ty);
  doc.text(`${fmt(sj.total_kg)} KG`, M + 80, ty);

  if (sj.notes) {
    ty += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Catatan: ${sj.notes}`, M, ty);
  }

  // Signature blocks
  const sigY = Math.max(ty + 26, doc.internal.pageSize.getHeight() - 45);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Tanda Terima,', M + 8, sigY);
  doc.text('Hormat Kami,', pageW - M - 52, sigY);
  doc.text('(________________)', M, sigY + 26);
  doc.text('(________________)', pageW - M - 62, sigY + 26);

  doc.save(`SuratJalan_${sj.number || 'draft'}.pdf`);
}

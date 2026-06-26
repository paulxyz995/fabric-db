import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const fmt = (v) => Number(v ?? 0).toLocaleString('id-ID');

// Render a Surat Jalan (delivery note) PDF that mirrors the spreadsheet layout:
// header (No / Tanggal / Jenis Kain / Kepada), Rincian grid of roll weights,
// Total ROLL + KG, and Tanda Terima / Hormat Kami signature lines.
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

  doc.setDrawColor(180);
  doc.line(M, 28, pageW - M, 28);

  // Header fields (two columns)
  doc.setFontSize(11);
  const labelX = M, valX = M + 38;
  const rightLabelX = pageW / 2 + 6, rightValX = pageW / 2 + 34;
  let y = 38;
  const row = (lL, lV, rL, rV) => {
    doc.setFont('helvetica', 'bold'); doc.text(lL, labelX, y);
    doc.setFont('helvetica', 'normal'); doc.text(`: ${lV ?? '-'}`, valX, y);
    if (rL) {
      doc.setFont('helvetica', 'bold'); doc.text(rL, rightLabelX, y);
      doc.setFont('helvetica', 'normal'); doc.text(`: ${rV ?? '-'}`, rightValX, y);
    }
    y += 8;
  };
  row('Surat Jalan No', sj.number, 'Tanggal', sj.tanggal ? dayjs(sj.tanggal).format('DD MMMM YYYY') : '-');
  row('Jenis Kain', sj.jenis_kain, 'Kepada', sj.kepada);

  // Rincian grid: per-roll weights in 5 columns
  const items = (Array.isArray(sj.items) ? sj.items : []).map((v) =>
    typeof v === 'object' && v !== null ? Number(v.kg) : Number(v)
  );
  const COLS = 5;
  const body = [];
  for (let i = 0; i < items.length; i += COLS) {
    const chunk = items.slice(i, i + COLS).map((n) => fmt(n));
    while (chunk.length < COLS) chunk.push('');
    body.push(chunk);
  }
  if (body.length === 0) body.push(Array(COLS).fill(''));

  doc.setFont('helvetica', 'bold');
  doc.text('Rincian (kg per roll)', M, y + 2);
  autoTable(doc, {
    startY: y + 5,
    head: [['', '', '', '', '']],
    body,
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center', cellPadding: 1.8 },
    headStyles: { fillColor: [240, 240, 240], minCellHeight: 1 },
    showHead: false,
    margin: { left: M, right: M },
  });

  // Total line
  let ty = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Total: ${fmt(sj.total_rolls)} ROLL`, M, ty);
  doc.text(`${fmt(sj.total_kg)} KG`, pageW / 2, ty);

  if (sj.notes) {
    ty += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Catatan: ${sj.notes}`, M, ty);
  }

  // Signature blocks
  const sigY = Math.max(ty + 30, doc.internal.pageSize.getHeight() - 45);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Tanda Terima,', M + 10, sigY);
  doc.text('Hormat Kami,', pageW - M - 50, sigY);
  doc.text('(________________)', M, sigY + 28);
  doc.text('(________________)', pageW - M - 60, sigY + 28);

  doc.save(`SuratJalan_${sj.number || 'draft'}.pdf`);
}

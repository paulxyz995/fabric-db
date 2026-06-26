import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const fmt = (v) => Number(v ?? 0).toLocaleString('id-ID');
const fmtMonth = (m) => dayjs(m).format('MMM YYYY');

// Shared report: monthly leftover (SISA) table + a detail table.
// summary: [{month, yarn_in_kg, sent_kg, sent_rolls, leftover_kg}]
export function exportReport({ title, customerName, periodLabel, summary, detailTitle, detailHead, detailBody }) {
  const doc = new jsPDF();

  doc.setFontSize(15);
  doc.text(periodLabel ? `${title} — ${periodLabel}` : title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${customerName}`, 14, 23);
  doc.text(`Generated ${dayjs().format('DD MMM YYYY HH:mm')}`, 14, 28);
  doc.setTextColor(0);

  // Monthly leftover (SISA BENANG): Net = in - sent (this month); Running = carryover
  doc.setFontSize(11);
  doc.text('Leftover Yarn (SISA)', 14, 37);
  autoTable(doc, {
    startY: 40,
    head: [['Month', 'Opening (kg)', 'Yarn In (kg)', 'Sent (kg)', 'Sent (rolls)', 'Net (kg)', 'Closing SISA (kg)']],
    body: summary.map((s) => [
      fmtMonth(s.month), fmt(s.opening_kg ?? 0), fmt(s.yarn_in_kg), fmt(s.sent_kg), fmt(s.sent_rolls),
      fmt(s.net_kg ?? (s.yarn_in_kg - s.sent_kg)), fmt(s.leftover_kg),
    ]),
    styles: { fontSize: 8, halign: 'right' },
    columnStyles: { 0: { halign: 'left' } },
    headStyles: { fillColor: [22, 119, 255], halign: 'right' },
  });

  // Detail table (yarn log or production log)
  let y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text(detailTitle, 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [detailHead],
    body: detailBody,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [82, 82, 82] },
  });

  const safe = customerName.replace(/[^a-z0-9]+/gi, '_');
  doc.save(`${title.replace(/\s+/g, '_')}_${safe}.pdf`);
}

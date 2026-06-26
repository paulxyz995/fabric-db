// One-off: remove unused customer sheets from the maklon workbook.
// Backup must already exist. Usage: node src/db/clean-excel.js <path-to-xlsx>
const XLSX = require('xlsx');
const path = require('path');

const REMOVE = new Set(['TKA', 'H URBAN', 'MERYMESH', 'BDI', 'Sheet1', 'H DANI']);
const KEEP = ['LYBRATEX', 'SPR', 'MCH BARU', 'H YUSUP', 'CFY'];

const file = process.argv[2];
if (!file) {
  console.error('Usage: node clean-excel.js <path-to-xlsx>');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellStyles: true });
const originalNames = [...wb.SheetNames]; // index -> name, before deletion
console.log('Sheets before:', originalNames.join(', '));

for (const name of [...wb.SheetNames]) {
  if (REMOVE.has(name)) {
    delete wb.Sheets[name];
    wb.SheetNames = wb.SheetNames.filter((n) => n !== name);
    console.log('  removed:', name);
  }
}

// Drop local defined names (e.g. _xlnm.Print_Area) that pointed at removed
// sheets; stale 0-based Sheet indices would otherwise corrupt the workbook.
if (wb.Workbook && Array.isArray(wb.Workbook.Names)) {
  wb.Workbook.Names = wb.Workbook.Names.filter((d) => {
    if (d.Sheet === undefined || d.Sheet === null) return true; // global name
    const srcName = originalNames[d.Sheet];
    return srcName !== undefined && !REMOVE.has(srcName);
  });
}

console.log('Sheets after:', wb.SheetNames.join(', '));

// Sanity: confirm only the 5 active customers remain
const remaining = new Set(wb.SheetNames);
const missing = KEEP.filter((k) => !remaining.has(k));
const extra = wb.SheetNames.filter((n) => !KEEP.includes(n));
if (missing.length) console.warn('WARNING missing expected sheets:', missing.join(', '));
if (extra.length) console.warn('WARNING unexpected sheets remain:', extra.join(', '));

XLSX.writeFile(wb, file, { bookType: 'xlsx' });
console.log('Wrote cleaned workbook:', path.basename(file));

// ============================================================
// Excel importer for the maklon workbook (5 active customers).
// Header-driven: detects "NAMA KAIN" (production) and
// "BENANG MASUK" / "KIRIM BENANG" (yarn in) blocks, then reads
// data rows with fixed offsets relative to those headers.
//
// Usage:
//   node src/db/import-excel.js <file.xlsx>            (dry-run, default)
//   node src/db/import-excel.js <file.xlsx> --commit   (write to DB)
// ============================================================
require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const ACTIVE = ['LYBRATEX', 'SPR', 'MCH BARU', 'H YUSUP', 'CFY'];
const PROD_HEADER = 'NAMA KAIN';
const YARN_HEADERS = ['BENANG MASUK', 'KIRIM BENANG'];

const file = process.argv[2];
const COMMIT = process.argv.includes('--commit');
if (!file) {
  console.error('Usage: node import-excel.js <file.xlsx> [--commit]');
  process.exit(1);
}

// --- helpers ---
const colToIdx = (col) => { let n = 0; for (const c of col) n = n * 26 + (c.charCodeAt(0) - 64); return n; };
const idxToCol = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

function serialToISO(v) {
  if (typeof v !== 'number') return null;
  if (v < 40000 || v > 50000) return null; // plausible 2009–2036
  const ms = Math.round((v - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}
const num = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
};
const cleanType = (v) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().toUpperCase() : '';
const isLabel = (v) => {
  const s = cleanType(v);
  return ['TOTAL', 'SISA', 'JUMLAH', 'NAMA KAIN', 'ROLL', 'KG', 'TGL', 'NO SJ',
          'BENANG MASUK', 'KIRIM BENANG', 'HASIL JADI', 'KET.', 'KET'].includes(s);
};

function get(row, idx) { return row[idxToCol(idx)]; }

// Build production + yarn column blocks from a header row
function blocksFromHeader(row) {
  const prod = [];
  const yarn = [];
  for (const [col, val] of Object.entries(row)) {
    const label = cleanType(val);
    const idx = colToIdx(col);
    if (label === PROD_HEADER) {
      prod.push({ dateCol: idx - 1, fabricCol: idx, rollCol: idx + 1, kgCol: idx + 2 });
    }
    if (YARN_HEADERS.includes(label)) {
      yarn.push({ dateCol: idx - 2, typeCol: idx, baleCol: idx + 1, kgCol: idx + 2 });
    }
  }
  return { prod, yarn };
}

function isHeaderRow(row) {
  return Object.values(row).some((v) => {
    const s = cleanType(v);
    return s === PROD_HEADER || YARN_HEADERS.includes(s);
  });
}

async function run() {
  const wb = XLSX.readFile(file);
  const report = { mode: COMMIT ? 'commit' : 'dry-run', customers: {}, fabric_types: new Set(), totals: { production: 0, yarn: 0, skipped: 0 } };
  const parsed = {}; // customer -> { production:[], yarn:[] }

  for (const name of wb.SheetNames) {
    if (!ACTIVE.includes(name)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 'A', raw: true, defval: '' });

    let prodBlocks = [], yarnBlocks = [];
    const lastDate = { prod: {}, yarn: {} };
    const out = { production: [], yarn: [] };
    let skipped = 0;

    rows.forEach((row, ri) => {
      if (isHeaderRow(row)) {
        // Headers span two rows (main labels then DUS/KRG·KG sub-labels), and
        // the sub-row repeats NAMA KAIN but not BENANG MASUK. Only replace a
        // block set when the current row actually defines it, so the yarn
        // blocks from the main header survive the sub-header row.
        const b = blocksFromHeader(row);
        if (b.prod.length) { prodBlocks = b.prod; lastDate.prod = {}; }
        if (b.yarn.length) { yarnBlocks = b.yarn; lastDate.yarn = {}; }
        return;
      }

      // Production blocks
      prodBlocks.forEach((blk, bi) => {
        const fabric = get(row, blk.fabricCol);
        const kg = num(get(row, blk.kgCol));
        const roll = num(get(row, blk.rollCol)) || 0;
        const d = serialToISO(num(get(row, blk.dateCol)));
        if (d) lastDate.prod[bi] = d;
        const date = lastDate.prod[bi];
        const fabricName = cleanType(fabric);

        if (fabricName && !isLabel(fabric) && isNaN(Number(fabric)) && kg && kg > 0) {
          if (!date) { skipped++; return; }
          out.production.push({ date, fabric: fabricName, roll: Math.round(roll), kg });
          report.fabric_types.add(fabricName);
        }
      });

      // Yarn blocks
      yarnBlocks.forEach((blk, bi) => {
        const type = get(row, blk.typeCol);
        const kg = num(get(row, blk.kgCol));
        const bale = num(get(row, blk.baleCol));
        const d = serialToISO(num(get(row, blk.dateCol)));
        if (d) lastDate.yarn[bi] = d;
        const date = lastDate.yarn[bi];
        const typeName = cleanType(type);

        if (typeName && !isLabel(type) && isNaN(Number(type)) && kg && kg > 0) {
          if (!date) { skipped++; return; }
          out.yarn.push({ date, yarn_type: typeName, bale: bale ? Math.round(bale) : null, kg });
        }
      });
    });

    parsed[name] = out;
    report.customers[name] = {
      production: out.production.length,
      yarn: out.yarn.length,
      skipped,
      production_date_range: dateRange(out.production),
    };
    report.totals.production += out.production.length;
    report.totals.yarn += out.yarn.length;
    report.totals.skipped += skipped;
  }

  report.fabric_types = [...report.fabric_types].sort();

  // Console summary
  console.log(`\n=== IMPORT ${report.mode.toUpperCase()} ===`);
  for (const [c, s] of Object.entries(report.customers)) {
    console.log(`${c.padEnd(10)} | production: ${String(s.production).padStart(4)} | yarn: ${String(s.yarn).padStart(4)} | skipped: ${String(s.skipped).padStart(3)} | dates: ${s.production_date_range}`);
  }
  console.log(`TOTAL      | production: ${report.totals.production} | yarn: ${report.totals.yarn} | skipped: ${report.totals.skipped}`);
  console.log(`Distinct fabric types (${report.fabric_types.length}): ${report.fabric_types.join(', ')}`);

  const reportPath = path.join(__dirname, 'import-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${reportPath}`);

  if (!COMMIT) {
    console.log('\nDry-run only. Re-run with --commit to write to the database.');
    await pool.end();
    return;
  }

  await commit(parsed);
  await pool.end();
}

function dateRange(rows) {
  if (!rows.length) return '—';
  const ds = rows.map((r) => r.date).sort();
  return `${ds[0]} … ${ds[ds.length - 1]}`;
}

async function commit(parsed) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Map customer name -> id (create if missing)
    const custId = {};
    let codeSeq = 1;
    for (const name of Object.keys(parsed)) {
      const { rows } = await client.query('SELECT id FROM customers WHERE name = $1', [name]);
      if (rows[0]) { custId[name] = rows[0].id; continue; }
      const code = `IMP-${String(codeSeq++).padStart(3, '0')}`;
      const ins = await client.query(
        'INSERT INTO customers (code, name) VALUES ($1,$2) RETURNING id', [code, name]
      );
      custId[name] = ins.rows[0].id;
    }

    // Map fabric type name -> id (create if missing)
    const fabId = {};
    async function fabricId(nameRaw) {
      const name = nameRaw;
      if (fabId[name]) return fabId[name];
      const { rows } = await client.query('SELECT id FROM fabric_types WHERE name = $1', [name]);
      if (rows[0]) { fabId[name] = rows[0].id; return rows[0].id; }
      const ins = await client.query('INSERT INTO fabric_types (name) VALUES ($1) RETURNING id', [name]);
      fabId[name] = ins.rows[0].id;
      return ins.rows[0].id;
    }

    let prodCount = 0, yarnCount = 0, yarnSeq = 1;
    for (const [name, out] of Object.entries(parsed)) {
      const cid = custId[name];
      for (const p of out.production) {
        const fid = await fabricId(p.fabric);
        await client.query(
          `INSERT INTO production_records (customer_id, production_date, fabric_type_id, roll_count, fabric_kg)
           VALUES ($1,$2,$3,$4,$5)`,
          [cid, p.date, fid, p.roll, p.kg]
        );
        prodCount++;
      }
      for (const y of out.yarn) {
        const rn = `IMP-${String(yarnSeq++).padStart(5, '0')}`;
        await client.query(
          `INSERT INTO yarn_receipts (receipt_number, customer_id, received_date, source, yarn_type, bale_count, quantity_kg)
           VALUES ($1,$2,$3,'customer',$4,$5,$6)`,
          [rn, cid, y.date, y.yarn_type, y.bale, y.kg]
        );
        yarnCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`\nCommitted: ${prodCount} production records, ${yarnCount} yarn receipts.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });

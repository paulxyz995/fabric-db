const router = require('express').Router();
const pool = require('../db/pool');
const { ownerOnly } = require('../middleware/auth');

// Semua data invoice = uang -> hanya owner (termasuk daftar & detail)
router.use(ownerOnly);

// Resolve the maklon rate for a (customer, fabric_type) on a given date.
// Most specific (matching fabric_type) wins over the catch-all (NULL) rate.
async function resolveRate(client, customerId, fabricTypeId, onDate) {
  const { rows } = await client.query(
    `SELECT rate_per_kg FROM customer_rates
     WHERE customer_id = $1
       AND (fabric_type_id = $2 OR fabric_type_id IS NULL)
       AND effective_from <= $3
       AND (effective_to IS NULL OR effective_to >= $3)
     ORDER BY fabric_type_id NULLS LAST, effective_from DESC
     LIMIT 1`,
    [customerId, fabricTypeId, onDate]
  );
  return rows[0] ? Number(rows[0].rate_per_kg) : null;
}

// POST /api/invoices/preview  (admin) — compute line items WITHOUT saving
router.post('/preview', ownerOnly, async (req, res) => {
  const { customer_id, period_start, period_end } = req.body;
  if (!customer_id || !period_start || !period_end) {
    return res.status(400).json({ error: 'customer_id, period_start, period_end required' });
  }
  try {
    const { rows: agg } = await pool.query(
      `SELECT pr.fabric_type_id, ft.name AS fabric_type,
              SUM(pr.fabric_kg) AS total_kg, SUM(pr.roll_count) AS total_rolls
       FROM production_records pr
       JOIN fabric_types ft ON ft.id = pr.fabric_type_id
       WHERE pr.customer_id = $1
         AND pr.production_date BETWEEN $2 AND $3
       GROUP BY pr.fabric_type_id, ft.name
       ORDER BY ft.name`,
      [customer_id, period_start, period_end]
    );
    const lines = [];
    const missing = [];
    for (const r of agg) {
      const rate = await resolveRate(pool, customer_id, r.fabric_type_id, period_end);
      if (rate === null) {
        missing.push(r.fabric_type);
        continue;
      }
      const total_kg = Number(r.total_kg);
      lines.push({
        fabric_type_id: r.fabric_type_id,
        fabric_type: r.fabric_type,
        total_kg,
        total_rolls: Number(r.total_rolls),
        rate_per_kg: rate,
        amount: Math.round(total_kg * rate * 100) / 100,
      });
    }
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    res.json({ lines, subtotal, missing_rates: missing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/generate  (admin) — build + persist invoice with lines
router.post('/generate', ownerOnly, async (req, res) => {
  const { customer_id, period_start, period_end, invoice_date, due_date, tax_percent } = req.body;
  if (!customer_id || !period_start || !period_end) {
    return res.status(400).json({ error: 'customer_id, period_start, period_end required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: agg } = await client.query(
      `SELECT pr.fabric_type_id, SUM(pr.fabric_kg) AS total_kg
       FROM production_records pr
       WHERE pr.customer_id = $1 AND pr.production_date BETWEEN $2 AND $3
       GROUP BY pr.fabric_type_id`,
      [customer_id, period_start, period_end]
    );
    if (agg.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No production in this period' });
    }

    const lines = [];
    for (const r of agg) {
      const rate = await resolveRate(client, customer_id, r.fabric_type_id, period_end);
      if (rate === null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `No rate set for fabric type id ${r.fabric_type_id}` });
      }
      const total_kg = Number(r.total_kg);
      lines.push({
        fabric_type_id: r.fabric_type_id,
        total_kg,
        rate_per_kg: rate,
        amount: Math.round(total_kg * rate * 100) / 100,
      });
    }

    const subtotal   = lines.reduce((s, l) => s + l.amount, 0);
    const taxPct     = Number(tax_percent ?? 0);
    const tax_amount = Math.round(subtotal * (taxPct / 100) * 100) / 100;
    const total      = subtotal + tax_amount;

    const year = new Date().getFullYear();
    const { rows: cnt } = await client.query(
      `SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE $1`, [`INV-${year}-%`]
    );
    const seq = String(Number(cnt[0].count) + 1).padStart(3, '0');
    const invoice_number = `INV-${year}-${seq}`;

    const { rows: inv } = await client.query(
      `INSERT INTO invoices
         (invoice_number, customer_id, period_start, period_end, invoice_date, due_date,
          subtotal, tax_percent, tax_amount, total_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [invoice_number, customer_id, period_start, period_end,
       invoice_date || new Date(), due_date || null,
       subtotal, taxPct, tax_amount, total, req.user.id]
    );

    for (const l of lines) {
      await client.query(
        `INSERT INTO invoice_lines (invoice_id, fabric_type_id, total_kg, rate_per_kg, amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [inv[0].id, l.fabric_type_id, l.total_kg, l.rate_per_kg, l.amount]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(inv[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/invoices
router.get('/', async (req, res) => {
  const { customer_id, status } = req.query;
  let query = 'SELECT * FROM v_invoice_summary WHERE 1=1';
  const params = [];
  if (customer_id) { params.push(customer_id); query += ` AND id IN (SELECT id FROM invoices WHERE customer_id = $${params.length})`; }
  if (status)      { params.push(status);      query += ` AND status = $${params.length}`; }
  query += ' ORDER BY invoice_date DESC, id DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/invoices/:id  — header + lines
router.get('/:id', async (req, res) => {
  const [hdr, lines] = await Promise.all([
    pool.query('SELECT * FROM v_invoice_summary WHERE id = $1', [req.params.id]),
    pool.query(
      `SELECT il.*, ft.name AS fabric_type
       FROM invoice_lines il JOIN fabric_types ft ON ft.id = il.fabric_type_id
       WHERE il.invoice_id = $1 ORDER BY ft.name`,
      [req.params.id]
    ),
  ]);
  if (!hdr.rows[0]) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ ...hdr.rows[0], lines: lines.rows });
});

// PATCH /api/invoices/:id/status  (admin only)
router.patch('/:id/status', ownerOnly, async (req, res) => {
  const { status, paid_date } = req.body;
  const valid = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await pool.query(
    `UPDATE invoices SET status=$1, paid_date=$2 WHERE id=$3 RETURNING *`,
    [status, paid_date || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invoice not found' });
  res.json(rows[0]);
});

module.exports = router;

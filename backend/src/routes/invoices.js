const router = require('express').Router();
const pool = require('../db/pool');
const { adminOnly } = require('../middleware/auth');

// GET /api/invoices  (HR and admin)
router.get('/', async (req, res) => {
  const { customer_id, status, from, to } = req.query;
  let query = 'SELECT * FROM v_invoice_summary WHERE 1=1';
  const params = [];
  if (customer_id) { params.push(customer_id); query += ` AND id IN (SELECT id FROM invoices WHERE customer_id = $${params.length})`; }
  if (status)      { params.push(status);       query += ` AND status = $${params.length}`; }
  if (from)        { params.push(from);         query += ` AND invoice_date >= $${params.length}`; }
  if (to)          { params.push(to);           query += ` AND invoice_date <= $${params.length}`; }
  query += ' ORDER BY invoice_date DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM v_invoice_summary WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invoice not found' });
  res.json(rows[0]);
});

// POST /api/invoices — create from a production job  (admin only)
router.post('/', adminOnly, async (req, res) => {
  const { production_job_id, invoice_date, due_date, tax_percent, notes } = req.body;
  if (!production_job_id) return res.status(400).json({ error: 'production_job_id required' });

  try {
    // Get job summary totals
    const { rows: jobRows } = await pool.query(
      'SELECT * FROM v_job_summary WHERE id = $1',
      [production_job_id]
    );
    if (!jobRows[0]) return res.status(404).json({ error: 'Job not found' });
    const job = jobRows[0];

    if (job.total_fabric_kg === 0) {
      return res.status(400).json({ error: 'No production output recorded for this job yet' });
    }

    // Get the applicable customer rate
    const { rows: jobDetail } = await pool.query(
      'SELECT customer_id, fabric_type_id FROM production_jobs WHERE id = $1',
      [production_job_id]
    );
    const { customer_id, fabric_type_id } = jobDetail[0];

    const { rows: rateRows } = await pool.query(
      `SELECT rate_per_kg FROM customer_rates
       WHERE customer_id = $1
         AND (fabric_type_id = $2 OR fabric_type_id IS NULL)
         AND effective_from <= CURRENT_DATE
         AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
       ORDER BY fabric_type_id NULLS LAST, effective_from DESC
       LIMIT 1`,
      [customer_id, fabric_type_id]
    );
    if (!rateRows[0]) {
      return res.status(400).json({ error: 'No rate configured for this customer / fabric type' });
    }
    const rate_per_kg = Number(rateRows[0].rate_per_kg);
    const fabric_kg   = Number(job.total_fabric_kg);
    const taxPct      = Number(tax_percent ?? 11);
    const subtotal    = fabric_kg * rate_per_kg;
    const tax_amount  = subtotal * (taxPct / 100);
    const total_amount = subtotal + tax_amount;

    // Auto invoice number
    const year = new Date().getFullYear();
    const { rows: cntRows } = await pool.query(
      `SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE $1`,
      [`INV-${year}-%`]
    );
    const seq = String(Number(cntRows[0].count) + 1).padStart(3, '0');
    const invoice_number = `INV-${year}-${seq}`;

    const { rows } = await pool.query(
      `INSERT INTO invoices
         (invoice_number, production_job_id, customer_id, invoice_date, due_date,
          fabric_kg, rate_per_kg, subtotal, tax_percent, tax_amount, total_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [invoice_number, production_job_id, customer_id,
       invoice_date || new Date(),
       due_date || null,
       fabric_kg, rate_per_kg, subtotal, taxPct, tax_amount, total_amount, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/invoices/:id/status  (admin only)
router.patch('/:id/status', adminOnly, async (req, res) => {
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

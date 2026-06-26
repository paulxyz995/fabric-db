const router = require('express').Router();
const pool = require('../db/pool');
const { adminOnly } = require('../middleware/auth');

// GET /api/yarn-receipts
router.get('/', async (req, res) => {
  const { customer_id, from, to } = req.query;
  let query = `
    SELECT yr.*, c.name AS customer_name
    FROM yarn_receipts yr
    JOIN customers c ON c.id = yr.customer_id
    WHERE 1=1
  `;
  const params = [];
  if (customer_id) { params.push(customer_id); query += ` AND yr.customer_id = $${params.length}`; }
  if (from)        { params.push(from);        query += ` AND yr.received_date >= $${params.length}`; }
  if (to)          { params.push(to);          query += ` AND yr.received_date <= $${params.length}`; }
  query += ' ORDER BY yr.created_at DESC, yr.id DESC'; // most recently logged first
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/yarn-receipts/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT yr.*, c.name AS customer_name
     FROM yarn_receipts yr
     JOIN customers c ON c.id = yr.customer_id
     WHERE yr.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Receipt not found' });
  res.json(rows[0]);
});

// POST /api/yarn-receipts
router.post('/', async (req, res) => {
  const { customer_id, received_date, source, yarn_type, yarn_color, bale_count, quantity_kg, delivery_note, notes } = req.body;
  if (!customer_id || !yarn_type || !quantity_kg) {
    return res.status(400).json({ error: 'customer_id, yarn_type, and quantity_kg are required' });
  }
  try {
    // Auto-generate receipt number: YR-YYYY-NNN
    const year = new Date().getFullYear();
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM yarn_receipts WHERE receipt_number LIKE $1`,
      [`YR-${year}-%`]
    );
    const seq = String(Number(countRows[0].count) + 1).padStart(3, '0');
    const receipt_number = `YR-${year}-${seq}`;

    const { rows } = await pool.query(
      `INSERT INTO yarn_receipts
         (receipt_number, customer_id, received_date, source, yarn_type, yarn_color, bale_count, quantity_kg, delivery_note, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [receipt_number, customer_id, received_date || new Date(), source || 'customer', yarn_type, yarn_color,
       bale_count || null, quantity_kg, delivery_note, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/yarn-receipts/:id  (admin only)
router.put('/:id', adminOnly, async (req, res) => {
  const { source, yarn_type, yarn_color, bale_count, quantity_kg, delivery_note, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE yarn_receipts SET source=$1, yarn_type=$2, yarn_color=$3, bale_count=$4, quantity_kg=$5, delivery_note=$6, notes=$7
     WHERE id=$8 RETURNING *`,
    [source || 'customer', yarn_type, yarn_color, bale_count || null, quantity_kg, delivery_note, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Receipt not found' });
  res.json(rows[0]);
});

// DELETE /api/yarn-receipts/:id  (admin only — block if linked to production)
router.delete('/:id', adminOnly, async (req, res) => {
  const { rows: used } = await pool.query(
    'SELECT 1 FROM production_records WHERE yarn_receipt_id = $1 LIMIT 1', [req.params.id]
  );
  if (used[0]) return res.status(409).json({ error: 'Cannot delete: linked to production records' });
  const { rowCount } = await pool.query('DELETE FROM yarn_receipts WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Receipt not found' });
  res.json({ ok: true });
});

module.exports = router;

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
  query += ' ORDER BY yr.received_date DESC';
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
  const { customer_id, received_date, yarn_type, yarn_color, quantity_kg, delivery_note, notes } = req.body;
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
         (receipt_number, customer_id, received_date, yarn_type, yarn_color, quantity_kg, delivery_note, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [receipt_number, customer_id, received_date || new Date(), yarn_type, yarn_color,
       quantity_kg, delivery_note, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/yarn-receipts/:id  (admin only — once a job is linked, restrict changes)
router.put('/:id', adminOnly, async (req, res) => {
  const { yarn_type, yarn_color, quantity_kg, delivery_note, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE yarn_receipts SET yarn_type=$1, yarn_color=$2, quantity_kg=$3, delivery_note=$4, notes=$5
     WHERE id=$6 RETURNING *`,
    [yarn_type, yarn_color, quantity_kg, delivery_note, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Receipt not found' });
  res.json(rows[0]);
});

module.exports = router;

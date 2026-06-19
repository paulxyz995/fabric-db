const router = require('express').Router();
const pool = require('../db/pool');
const { adminOnly } = require('../middleware/auth');

// GET /api/customers
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM customers WHERE is_active = true ORDER BY name'
  );
  res.json(rows);
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
  res.json(rows[0]);
});

// GET /api/customers/:id/rates
router.get('/:id/rates', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cr.*, ft.name AS fabric_type_name
     FROM customer_rates cr
     LEFT JOIN fabric_types ft ON ft.id = cr.fabric_type_id
     WHERE cr.customer_id = $1
     ORDER BY cr.effective_from DESC`,
    [req.params.id]
  );
  res.json(rows);
});

// POST /api/customers  (admin only)
router.post('/', adminOnly, async (req, res) => {
  const { code, name, contact_person, phone, email, address } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (code, name, contact_person, phone, email, address)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, name, contact_person, phone, email, address]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Customer code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id  (admin only)
router.put('/:id', adminOnly, async (req, res) => {
  const { name, contact_person, phone, email, address, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE customers SET name=$1, contact_person=$2, phone=$3, email=$4, address=$5, is_active=$6
     WHERE id=$7 RETURNING *`,
    [name, contact_person, phone, email, address, is_active ?? true, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
  res.json(rows[0]);
});

// POST /api/customers/:id/rates  (admin only)
router.post('/:id/rates', adminOnly, async (req, res) => {
  const { fabric_type_id, rate_per_kg, effective_from } = req.body;
  if (!rate_per_kg) return res.status(400).json({ error: 'rate_per_kg required' });
  const { rows } = await pool.query(
    `INSERT INTO customer_rates (customer_id, fabric_type_id, rate_per_kg, effective_from)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, fabric_type_id || null, rate_per_kg, effective_from || new Date()]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;

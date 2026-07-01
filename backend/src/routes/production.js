const router = require('express').Router();
const pool = require('../db/pool');
const { canWriteOps } = require('../middleware/auth');

// GET /api/production  — flat daily log, filterable by customer + month
// query: customer_id, month (YYYY-MM), from, to
router.get('/', async (req, res) => {
  const { customer_id, month, from, to } = req.query;
  let query = `
    SELECT pr.*, c.name AS customer_name, ft.name AS fabric_type
    FROM production_records pr
    JOIN customers c     ON c.id = pr.customer_id
    JOIN fabric_types ft ON ft.id = pr.fabric_type_id
    WHERE 1=1
  `;
  const params = [];
  if (customer_id) { params.push(customer_id); query += ` AND pr.customer_id = $${params.length}`; }
  if (month) {
    params.push(`${month}-01`);
    query += ` AND pr.production_date >= $${params.length}::date
               AND pr.production_date < ($${params.length}::date + INTERVAL '1 month')`;
  }
  if (from) { params.push(from); query += ` AND pr.production_date >= $${params.length}`; }
  if (to)   { params.push(to);   query += ` AND pr.production_date <= $${params.length}`; }
  query += ' ORDER BY pr.created_at DESC, pr.id DESC'; // most recently logged first
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/production/summary — rolled up per customer/month/fabric type
router.get('/summary', async (req, res) => {
  const { customer_id, month } = req.query;
  let query = 'SELECT * FROM v_production_summary WHERE 1=1';
  const params = [];
  if (customer_id) { params.push(customer_id); query += ` AND customer_id = $${params.length}`; }
  if (month)       { params.push(`${month}-01`); query += ` AND period_month = $${params.length}::date`; }
  query += ' ORDER BY period_month DESC, customer_name, fabric_type';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// POST /api/production  (admin only)
router.post('/', canWriteOps, async (req, res) => {
  const { customer_id, production_date, fabric_type_id, roll_count, fabric_kg, yarn_receipt_id, notes } = req.body;
  if (!customer_id || !fabric_type_id || !fabric_kg) {
    return res.status(400).json({ error: 'customer_id, fabric_type_id, and fabric_kg are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO production_records
         (customer_id, production_date, fabric_type_id, roll_count, fabric_kg, yarn_receipt_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [customer_id, production_date || new Date(), fabric_type_id, roll_count || 0, fabric_kg,
       yarn_receipt_id || null, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/production/:id  (admin only)
router.put('/:id', canWriteOps, async (req, res) => {
  const { customer_id, production_date, fabric_type_id, roll_count, fabric_kg, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE production_records
       SET customer_id=$1, production_date=$2, fabric_type_id=$3, roll_count=$4, fabric_kg=$5, notes=$6
     WHERE id=$7 RETURNING *`,
    [customer_id, production_date, fabric_type_id, roll_count || 0, fabric_kg, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
  res.json(rows[0]);
});

// DELETE /api/production/:id  (admin only)
router.delete('/:id', canWriteOps, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM production_records WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Record not found' });
  res.json({ ok: true });
});

module.exports = router;

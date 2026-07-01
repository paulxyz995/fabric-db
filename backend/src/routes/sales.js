const router = require('express').Router();
const pool = require('../db/pool');
const { ownerOnly } = require('../middleware/auth');

// Penjualan kain produksi sendiri = data uang -> hanya owner
router.use(ownerOnly);

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000;

// GET /api/sales — daftar penjualan (filter: month=YYYY-MM, from, to)
router.get('/', async (req, res) => {
  const { month, from, to } = req.query;
  let query = `
    SELECT s.*, ft.name AS fabric_type
    FROM sales s
    LEFT JOIN fabric_types ft ON ft.id = s.fabric_type_id
    WHERE 1=1
  `;
  const params = [];
  if (month) {
    params.push(`${month}-01`);
    query += ` AND s.sale_date >= $${params.length}::date
               AND s.sale_date < ($${params.length}::date + INTERVAL '1 month')`;
  }
  if (from) { params.push(from); query += ` AND s.sale_date >= $${params.length}`; }
  if (to)   { params.push(to);   query += ` AND s.sale_date <= $${params.length}`; }
  query += ' ORDER BY s.sale_date DESC, s.id DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// Hitung amount/cost_total/profit dari input
function compute(body) {
  const quantity_kg = r3(body.quantity_kg);
  const sell = r2(body.sell_price_per_kg);
  const cost = r2(body.cost_per_kg);
  const amount = r2(quantity_kg * sell);
  const cost_total = r2(quantity_kg * cost);
  const profit = r2(amount - cost_total);
  return { quantity_kg, sell, cost, amount, cost_total, profit };
}

// POST /api/sales — catat penjualan
router.post('/', async (req, res) => {
  const { sale_date, buyer, fabric_type_id, roll_count, notes } = req.body;
  if (!req.body.quantity_kg || Number(req.body.quantity_kg) <= 0) {
    return res.status(400).json({ error: 'quantity_kg wajib > 0' });
  }
  const { quantity_kg, sell, cost, amount, cost_total, profit } = compute(req.body);
  try {
    const year = new Date().getFullYear();
    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*) FROM sales WHERE sale_number LIKE $1`, [`SALE-${year}-%`]
    );
    const seq = String(Number(cnt[0].count) + 1).padStart(3, '0');
    const sale_number = `SALE-${year}-${seq}`;

    const { rows } = await pool.query(
      `INSERT INTO sales
         (sale_number, sale_date, buyer, fabric_type_id, roll_count, quantity_kg,
          sell_price_per_kg, cost_per_kg, amount, cost_total, profit, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [sale_number, sale_date || new Date(), buyer || null, fabric_type_id || null,
       roll_count || 0, quantity_kg, sell, cost, amount, cost_total, profit,
       notes || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sales/:id
router.put('/:id', async (req, res) => {
  if (!req.body.quantity_kg || Number(req.body.quantity_kg) <= 0) {
    return res.status(400).json({ error: 'quantity_kg wajib > 0' });
  }
  const { sale_date, buyer, fabric_type_id, roll_count, notes } = req.body;
  const { quantity_kg, sell, cost, amount, cost_total, profit } = compute(req.body);
  const { rows } = await pool.query(
    `UPDATE sales SET sale_date=$1, buyer=$2, fabric_type_id=$3, roll_count=$4,
        quantity_kg=$5, sell_price_per_kg=$6, cost_per_kg=$7, amount=$8, cost_total=$9, profit=$10, notes=$11
     WHERE id=$12 RETURNING *`,
    [sale_date || new Date(), buyer || null, fabric_type_id || null, roll_count || 0,
     quantity_kg, sell, cost, amount, cost_total, profit, notes || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Penjualan tidak ditemukan' });
  res.json(rows[0]);
});

// DELETE /api/sales/:id
router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM sales WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Penjualan tidak ditemukan' });
  res.json({ ok: true });
});

module.exports = router;

const router = require('express').Router();
const pool = require('../db/pool');
const { canWriteOps, ownerOnly } = require('../middleware/auth');

// GET /api/customers  (sorted by customer code/number)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM customers WHERE is_active = true ORDER BY code ASC'
  );
  res.json(rows);
});

// Helper: round to 3 decimals
const r3 = (n) => Math.round(n * 1000) / 1000;

// GET /api/customers/:id/monthly-summary
// SISA BENANG ledger. For each month:
//   opening  = admin-set opening for that month, else previous month's closing
//   closing  = opening + yarn_in - sent   (carries forward)
//   net      = yarn_in - sent             (this month only)
router.get('/:id/monthly-summary', async (req, res) => {
  const { rows } = await pool.query(
    `WITH months AS (
       SELECT date_trunc('month', received_date)::date AS m FROM yarn_receipts WHERE customer_id = $1
       UNION
       SELECT date_trunc('month', production_date)::date FROM production_records WHERE customer_id = $1
       UNION
       SELECT month FROM yarn_opening WHERE customer_id = $1
     ),
     yin AS (
       SELECT date_trunc('month', received_date)::date m, COALESCE(SUM(quantity_kg),0) kg
       FROM yarn_receipts WHERE customer_id = $1 GROUP BY 1
     ),
     pout AS (
       SELECT date_trunc('month', production_date)::date m,
              COALESCE(SUM(fabric_kg),0) kg, COALESCE(SUM(roll_count),0) rolls
       FROM production_records WHERE customer_id = $1 GROUP BY 1
     ),
     op AS (
       SELECT month m, opening_kg FROM yarn_opening WHERE customer_id = $1
     )
     SELECT m.m AS month,
            COALESCE(yin.kg,0)    AS yarn_in_kg,
            COALESCE(pout.kg,0)   AS sent_kg,
            COALESCE(pout.rolls,0) AS sent_rolls,
            op.opening_kg          AS set_opening
     FROM months m
     LEFT JOIN yin  ON yin.m  = m.m
     LEFT JOIN pout ON pout.m = m.m
     LEFT JOIN op   ON op.m   = m.m
     ORDER BY m.m ASC`,
    [req.params.id]
  );

  let prevClosing = 0;
  const out = rows.map((r) => {
    const yarn_in_kg = Number(r.yarn_in_kg);
    const sent_kg    = Number(r.sent_kg);
    const opening_kg = r.set_opening != null ? Number(r.set_opening) : prevClosing;
    const net_kg     = r3(yarn_in_kg - sent_kg);
    const closing_kg = r3(opening_kg + yarn_in_kg - sent_kg);
    prevClosing = closing_kg;
    return {
      month: r.month,
      opening_kg: r3(opening_kg),
      is_opening_set: r.set_opening != null,
      yarn_in_kg,
      sent_kg,
      sent_rolls: Number(r.sent_rolls),
      net_kg,
      leftover_kg: closing_kg, // closing SISA, carried forward
    };
  });
  res.json(out);
});

// GET /api/customers/:id/openings — list admin-set opening SISA rows
router.get('/:id/openings', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, month, opening_kg FROM yarn_opening WHERE customer_id = $1 ORDER BY month DESC',
    [req.params.id]
  );
  res.json(rows);
});

// POST /api/customers/:id/opening — set/replace opening SISA for a month  (admin)
router.post('/:id/opening', canWriteOps, async (req, res) => {
  const { month, opening_kg } = req.body;
  if (!month || opening_kg == null) {
    return res.status(400).json({ error: 'month and opening_kg required' });
  }
  // Normalize to first of month
  const m = `${String(month).slice(0, 7)}-01`;
  const { rows } = await pool.query(
    `INSERT INTO yarn_opening (customer_id, month, opening_kg)
     VALUES ($1, $2, $3)
     ON CONFLICT (customer_id, month) DO UPDATE SET opening_kg = EXCLUDED.opening_kg
     RETURNING *`,
    [req.params.id, m, opening_kg]
  );
  res.status(201).json(rows[0]);
});

// DELETE /api/customers/:id/opening/:month — remove an opening override  (admin)
router.delete('/:id/opening/:month', canWriteOps, async (req, res) => {
  const m = `${req.params.month.slice(0, 7)}-01`;
  await pool.query('DELETE FROM yarn_opening WHERE customer_id = $1 AND month = $2', [req.params.id, m]);
  res.json({ ok: true });
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
router.post('/', canWriteOps, async (req, res) => {
  const { code, name, short_code, type, contact_person, phone, email, address } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (code, name, short_code, type, contact_person, phone, email, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [code, name, short_code || null, type === 'own' ? 'own' : 'maklon', contact_person, phone, email, address]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Customer code already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id  (admin only)
router.put('/:id', canWriteOps, async (req, res) => {
  const { name, short_code, type, contact_person, phone, email, address, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE customers SET name=$1, short_code=$2, type=$3, contact_person=$4, phone=$5, email=$6, address=$7, is_active=$8
     WHERE id=$9 RETURNING *`,
    [name, short_code || null, type === 'own' ? 'own' : 'maklon', contact_person, phone, email, address, is_active ?? true, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
  res.json(rows[0]);
});

// POST /api/customers/:id/rates  (harga maklon = uang -> owner only)
router.post('/:id/rates', ownerOnly, async (req, res) => {
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

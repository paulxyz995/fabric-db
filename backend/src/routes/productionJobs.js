const router = require('express').Router();
const pool = require('../db/pool');
const { adminOnly } = require('../middleware/auth');

// GET /api/production-jobs  (HR and admin)
router.get('/', async (req, res) => {
  const { status, customer_id } = req.query;
  let query = 'SELECT * FROM v_job_summary WHERE 1=1';
  const params = [];
  if (status)      { params.push(status);      query += ` AND status = $${params.length}`; }
  if (customer_id) { params.push(customer_id); query += ` AND id IN (SELECT id FROM production_jobs WHERE customer_id = $${params.length})`; }
  query += ' ORDER BY id DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /api/production-jobs/:id
router.get('/:id', async (req, res) => {
  const [job, outputs] = await Promise.all([
    pool.query('SELECT * FROM v_job_summary WHERE id = $1', [req.params.id]),
    pool.query(
      'SELECT * FROM production_outputs WHERE production_job_id = $1 ORDER BY output_date',
      [req.params.id]
    ),
  ]);
  if (!job.rows[0]) return res.status(404).json({ error: 'Job not found' });
  res.json({ ...job.rows[0], outputs: outputs.rows });
});

// POST /api/production-jobs  (admin only)
router.post('/', adminOnly, async (req, res) => {
  const { yarn_receipt_id, customer_id, fabric_type_id, start_date, notes } = req.body;
  if (!yarn_receipt_id || !customer_id) {
    return res.status(400).json({ error: 'yarn_receipt_id and customer_id are required' });
  }
  try {
    const year = new Date().getFullYear();
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM production_jobs WHERE job_number LIKE $1`,
      [`JOB-${year}-%`]
    );
    const seq = String(Number(countRows[0].count) + 1).padStart(3, '0');
    const job_number = `JOB-${year}-${seq}`;

    const { rows } = await pool.query(
      `INSERT INTO production_jobs
         (job_number, yarn_receipt_id, customer_id, fabric_type_id, start_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [job_number, yarn_receipt_id, customer_id, fabric_type_id || null, start_date || null, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/production-jobs/:id/status  (admin only)
router.patch('/:id/status', adminOnly, async (req, res) => {
  const { status, end_date } = req.body;
  const valid = ['pending', 'in_progress', 'completed', 'dispatched', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await pool.query(
    `UPDATE production_jobs SET status=$1, end_date=$2 WHERE id=$3 RETURNING *`,
    [status, end_date || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Job not found' });
  res.json(rows[0]);
});

// POST /api/production-jobs/:id/outputs  (admin only)
router.post('/:id/outputs', adminOnly, async (req, res) => {
  const { output_date, fabric_kg, yarn_consumed_kg, wastage_kg, notes } = req.body;
  if (!fabric_kg || !yarn_consumed_kg) {
    return res.status(400).json({ error: 'fabric_kg and yarn_consumed_kg required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO production_outputs
       (production_job_id, output_date, fabric_kg, yarn_consumed_kg, wastage_kg, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.id, output_date || new Date(), fabric_kg, yarn_consumed_kg, wastage_kg || 0, notes, req.user.id]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;

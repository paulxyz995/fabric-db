const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/dashboard  — summary stats for HR & admin home screen
router.get('/', async (req, res) => {
  const [jobs, invoices, yarn] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')   AS completed,
        COUNT(*) FILTER (WHERE status = 'dispatched')  AS dispatched
      FROM production_jobs
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft')    AS draft,
        COUNT(*) FILTER (WHERE status = 'sent')     AS sent,
        COUNT(*) FILTER (WHERE status = 'overdue')  AS overdue,
        COUNT(*) FILTER (WHERE status = 'paid')     AS paid,
        COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS total_billed,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0)             AS total_paid
      FROM invoices
    `),
    pool.query(`
      SELECT COALESCE(SUM(quantity_kg), 0) AS total_yarn_received_kg
      FROM yarn_receipts
      WHERE received_date >= date_trunc('month', CURRENT_DATE)
    `),
  ]);

  res.json({
    jobs:     jobs.rows[0],
    invoices: invoices.rows[0],
    yarn:     yarn.rows[0],
  });
});

module.exports = router;

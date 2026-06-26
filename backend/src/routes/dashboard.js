const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/dashboard  — summary stats for HR & admin home screen
router.get('/', async (req, res) => {
  const [production, invoices, yarn, topCustomers] = await Promise.all([
    // Production this month
    pool.query(`
      SELECT
        COALESCE(SUM(fabric_kg), 0)  AS total_kg,
        COALESCE(SUM(roll_count), 0) AS total_rolls,
        COUNT(*)                     AS entries
      FROM production_records
      WHERE production_date >= date_trunc('month', CURRENT_DATE)
    `),
    // Invoice status + money
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft')   AS draft,
        COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
        COUNT(*) FILTER (WHERE status = 'overdue') AS overdue,
        COUNT(*) FILTER (WHERE status = 'paid')    AS paid,
        COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled','paid')), 0) AS outstanding,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0)                    AS total_paid
      FROM invoices
    `),
    // Yarn received this month
    pool.query(`
      SELECT COALESCE(SUM(quantity_kg), 0) AS total_yarn_received_kg
      FROM yarn_receipts
      WHERE received_date >= date_trunc('month', CURRENT_DATE)
    `),
    // Top customers by production kg this month
    pool.query(`
      SELECT c.name AS customer_name, COALESCE(SUM(pr.fabric_kg), 0) AS total_kg
      FROM production_records pr
      JOIN customers c ON c.id = pr.customer_id
      WHERE pr.production_date >= date_trunc('month', CURRENT_DATE)
      GROUP BY c.name
      ORDER BY total_kg DESC
      LIMIT 5
    `),
  ]);

  res.json({
    production:    production.rows[0],
    invoices:      invoices.rows[0],
    yarn:          yarn.rows[0],
    top_customers: topCustomers.rows,
  });
});

module.exports = router;

const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/dashboard  — ringkasan untuk beranda.
// Data uang (pendapatan/invoice) HANYA dikirim untuk role 'owner'.
router.get('/', async (req, res) => {
  const isOwner = req.user?.role === 'owner';

  // Data non-uang: dilihat semua peran
  const [production, yarn, topCustomers] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(SUM(fabric_kg), 0)  AS total_kg,
        COALESCE(SUM(roll_count), 0) AS total_rolls,
        COUNT(*)                     AS entries
      FROM production_records
      WHERE production_date >= date_trunc('month', CURRENT_DATE)
    `),
    pool.query(`
      SELECT COALESCE(SUM(quantity_kg), 0) AS total_yarn_received_kg
      FROM yarn_receipts
      WHERE received_date >= date_trunc('month', CURRENT_DATE)
    `),
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

  const payload = {
    production:    production.rows[0],
    yarn:          yarn.rows[0],
    top_customers: topCustomers.rows,
    is_owner:      isOwner,
  };

  // Data uang: hanya owner
  if (isOwner) {
    const [invoices, revenueMonth, trend] = await Promise.all([
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
      // Pendapatan bulan ini = total semua invoice untuk periode bulan berjalan
      pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS revenue
        FROM invoices
        WHERE status <> 'cancelled'
          AND date_trunc('month', period_start) = date_trunc('month', CURRENT_DATE)
      `),
      // Tren 6 bulan terakhir (per bulan periode invoice)
      pool.query(`
        SELECT to_char(date_trunc('month', period_start), 'YYYY-MM') AS month,
               COALESCE(SUM(total_amount), 0) AS revenue
        FROM invoices
        WHERE status <> 'cancelled'
          AND period_start >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')
        GROUP BY 1
        ORDER BY 1
      `),
    ]);
    payload.invoices           = invoices.rows[0];
    payload.revenue_this_month = Number(revenueMonth.rows[0].revenue);
    payload.monthly_revenue    = trend.rows.map((r) => ({ month: r.month, revenue: Number(r.revenue) }));
  }

  res.json(payload);
});

module.exports = router;

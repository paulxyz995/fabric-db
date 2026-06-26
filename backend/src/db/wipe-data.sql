-- ============================================================
-- Wipe transactional data, keep config (users, customers, fabric
-- types, rates). Adds the yarn_opening (SISA) table if missing.
-- Admin re-enters opening SISA + logs going forward.
-- ============================================================

CREATE TABLE IF NOT EXISTS yarn_opening (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  month       DATE NOT NULL,
  opening_kg  NUMERIC(12, 3) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, month)
);
CREATE INDEX IF NOT EXISTS idx_yarn_opening_customer ON yarn_opening(customer_id);

-- Clear all transactional records (config tables untouched)
TRUNCATE invoice_lines, invoices, production_records, yarn_receipts, yarn_opening
  RESTART IDENTITY CASCADE;

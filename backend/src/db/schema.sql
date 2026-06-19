-- ============================================================
-- FABRIC-DB: Company Database Schema
-- Business: Subcontract fabric manufacturing (job-work / toll)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS (auth + role-based access)
-- ============================================================
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'hr' CHECK (role IN ('admin', 'hr')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) NOT NULL UNIQUE,   -- e.g. CUST-001
  name            VARCHAR(150) NOT NULL,
  contact_person  VARCHAR(100),
  phone           VARCHAR(30),
  email           VARCHAR(150),
  address         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FABRIC TYPES
-- Different fabric constructions a customer can order
-- ============================================================
CREATE TABLE fabric_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,  -- e.g. "Cotton Plain 30s", "Polyester Twill 75D"
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMER RATES
-- Rate per kg per customer, optionally per fabric type.
-- If fabric_type_id IS NULL, rate applies to all fabric types for that customer.
-- More specific rate (with fabric_type_id) takes precedence.
-- ============================================================
CREATE TABLE customer_rates (
  id              SERIAL PRIMARY KEY,
  customer_id     INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  fabric_type_id  INT REFERENCES fabric_types(id) ON DELETE SET NULL,
  rate_per_kg     NUMERIC(10, 2) NOT NULL CHECK (rate_per_kg > 0),
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,                          -- NULL = currently active
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_overlapping_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- ============================================================
-- YARN RECEIPTS
-- Logged when a customer delivers yarn to the factory
-- ============================================================
CREATE TABLE yarn_receipts (
  id              SERIAL PRIMARY KEY,
  receipt_number  VARCHAR(30) NOT NULL UNIQUE,  -- e.g. YR-2025-001
  customer_id     INT NOT NULL REFERENCES customers(id),
  received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  yarn_type       VARCHAR(100) NOT NULL,         -- e.g. "Cotton 30s", "Polyester 75D"
  yarn_color      VARCHAR(100),
  quantity_kg     NUMERIC(10, 3) NOT NULL CHECK (quantity_kg > 0),
  delivery_note   VARCHAR(100),                  -- customer's delivery note / challan no.
  notes           TEXT,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION JOBS
-- One job per yarn receipt batch (can be split into multiple outputs)
-- ============================================================
CREATE TABLE production_jobs (
  id              SERIAL PRIMARY KEY,
  job_number      VARCHAR(30) NOT NULL UNIQUE,  -- e.g. JOB-2025-001
  yarn_receipt_id INT NOT NULL REFERENCES yarn_receipts(id),
  customer_id     INT NOT NULL REFERENCES customers(id),
  fabric_type_id  INT REFERENCES fabric_types(id),
  start_date      DATE,
  end_date        DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'dispatched', 'cancelled')),
  notes           TEXT,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION OUTPUTS
-- Actual fabric produced against a job (can log in multiple batches)
-- ============================================================
CREATE TABLE production_outputs (
  id                  SERIAL PRIMARY KEY,
  production_job_id   INT NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  output_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  fabric_kg           NUMERIC(10, 3) NOT NULL CHECK (fabric_kg > 0),   -- fabric produced
  yarn_consumed_kg    NUMERIC(10, 3) NOT NULL CHECK (yarn_consumed_kg > 0),
  wastage_kg          NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (wastage_kg >= 0),
  notes               TEXT,
  created_by          INT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- Auto-generated from completed production jobs
-- ============================================================
CREATE TABLE invoices (
  id                  SERIAL PRIMARY KEY,
  invoice_number      VARCHAR(30) NOT NULL UNIQUE,  -- e.g. INV-2025-001
  production_job_id   INT NOT NULL REFERENCES production_jobs(id),
  customer_id         INT NOT NULL REFERENCES customers(id),
  invoice_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  fabric_kg           NUMERIC(10, 3) NOT NULL,      -- total fabric billed
  rate_per_kg         NUMERIC(10, 2) NOT NULL,      -- rate at time of billing (snapshot)
  subtotal            NUMERIC(12, 2) NOT NULL,      -- fabric_kg × rate_per_kg
  tax_percent         NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(12, 2) NOT NULL,      -- subtotal + tax_amount
  status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  paid_date           DATE,
  notes               TEXT,
  created_by          INT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_yarn_receipts_customer   ON yarn_receipts(customer_id);
CREATE INDEX idx_yarn_receipts_date       ON yarn_receipts(received_date);
CREATE INDEX idx_production_jobs_customer ON production_jobs(customer_id);
CREATE INDEX idx_production_jobs_status   ON production_jobs(status);
CREATE INDEX idx_production_outputs_job   ON production_outputs(production_job_id);
CREATE INDEX idx_invoices_customer        ON invoices(customer_id);
CREATE INDEX idx_invoices_status          ON invoices(status);

-- ============================================================
-- VIEWS
-- ============================================================

-- Job summary with totals
CREATE VIEW v_job_summary AS
SELECT
  pj.id,
  pj.job_number,
  c.name                              AS customer_name,
  yr.receipt_number,
  yr.yarn_type,
  yr.quantity_kg                      AS yarn_received_kg,
  ft.name                             AS fabric_type,
  pj.status,
  pj.start_date,
  pj.end_date,
  COALESCE(SUM(po.fabric_kg), 0)      AS total_fabric_kg,
  COALESCE(SUM(po.wastage_kg), 0)     AS total_wastage_kg,
  COALESCE(SUM(po.yarn_consumed_kg), 0) AS total_yarn_consumed_kg,
  ROUND(
    CASE WHEN SUM(po.yarn_consumed_kg) > 0
      THEN SUM(po.fabric_kg) / SUM(po.yarn_consumed_kg) * 100
      ELSE 0
    END, 2
  )                                   AS yield_percent
FROM production_jobs pj
JOIN customers c       ON c.id = pj.customer_id
JOIN yarn_receipts yr  ON yr.id = pj.yarn_receipt_id
LEFT JOIN fabric_types ft ON ft.id = pj.fabric_type_id
LEFT JOIN production_outputs po ON po.production_job_id = pj.id
GROUP BY pj.id, c.name, yr.receipt_number, yr.yarn_type, yr.quantity_kg, ft.name;

-- Invoice summary with customer details
CREATE VIEW v_invoice_summary AS
SELECT
  i.id,
  i.invoice_number,
  c.name          AS customer_name,
  c.code          AS customer_code,
  pj.job_number,
  i.invoice_date,
  i.due_date,
  i.fabric_kg,
  i.rate_per_kg,
  i.subtotal,
  i.tax_amount,
  i.total_amount,
  i.status,
  i.paid_date
FROM invoices i
JOIN customers c         ON c.id = i.customer_id
JOIN production_jobs pj  ON pj.id = i.production_job_id;

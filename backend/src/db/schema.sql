-- ============================================================
-- FABRIC-DB: Company Database Schema (v2 — maklon/toll model)
-- Business: Subcontract fabric manufacturing (job-work / maklon)
-- Customer sends/buys yarn -> we knit fabric -> bill per kg by fabric type
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop old objects (only seed data exists; safe to recreate)
DROP VIEW  IF EXISTS v_invoice_summary    CASCADE;
DROP VIEW  IF EXISTS v_job_summary        CASCADE;
DROP VIEW  IF EXISTS v_production_summary  CASCADE;
DROP TABLE IF EXISTS yarn_opening         CASCADE;
DROP TABLE IF EXISTS invoice_lines        CASCADE;
DROP TABLE IF EXISTS invoices             CASCADE;
DROP TABLE IF EXISTS production_outputs    CASCADE;
DROP TABLE IF EXISTS production_jobs       CASCADE;
DROP TABLE IF EXISTS production_records    CASCADE;
DROP TABLE IF EXISTS yarn_receipts         CASCADE;
DROP TABLE IF EXISTS customer_rates        CASCADE;
DROP TABLE IF EXISTS branches              CASCADE;
DROP TABLE IF EXISTS fabric_types          CASCADE;
DROP TABLE IF EXISTS customers             CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;

-- ============================================================
-- USERS (auth + role-based access)
-- ============================================================
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'hr')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS  (one per maklon sheet: LYBRATEX, SPR, MCH BARU, ...)
-- ============================================================
CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) NOT NULL UNIQUE,   -- e.g. CUST-001
  name            VARCHAR(150) NOT NULL,
  short_code      VARCHAR(20),                   -- admin nickname/initial, e.g. LYB, FRS (used in PDF filenames)
  type            VARCHAR(20) NOT NULL DEFAULT 'maklon'
                    CHECK (type IN ('maklon', 'own')),  -- maklon (jasa) vs own (produksi sendiri)
  contact_person  VARCHAR(100),
  phone           VARCHAR(30),
  email           VARCHAR(150),
  address         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FABRIC TYPES  (LOTTO/LT, HYGET, RIB, GRG FLC, BBTERY, ...)
-- ============================================================
CREATE TABLE fabric_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BRANCHES (CABANG PRODUKSI) — cabang tempat kain diproduksi.
-- Dipakai internal (dicatat di surat jalan), TIDAK dicetak di PDF.
-- ============================================================
CREATE TABLE branches (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMER RATES (maklon fee per kg, per customer per fabric type)
-- fabric_type_id NULL = applies to all fabric types for that customer.
-- Most specific (with fabric_type_id) wins.
-- ============================================================
CREATE TABLE customer_rates (
  id              SERIAL PRIMARY KEY,
  customer_id     INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  fabric_type_id  INT REFERENCES fabric_types(id) ON DELETE SET NULL,
  rate_per_kg     NUMERIC(10, 2) NOT NULL CHECK (rate_per_kg > 0),
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_overlapping_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- ============================================================
-- YARN RECEIPTS  (yarn IN: customer-sent or factory-purchased)
-- ============================================================
CREATE TABLE yarn_receipts (
  id              SERIAL PRIMARY KEY,
  receipt_number  VARCHAR(30) NOT NULL UNIQUE,   -- YR-2025-001
  customer_id     INT NOT NULL REFERENCES customers(id),
  received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  source          VARCHAR(20) NOT NULL DEFAULT 'customer'
                    CHECK (source IN ('customer', 'purchased')),  -- customer-sent vs BELI BENANG
  yarn_type       VARCHAR(100) NOT NULL,         -- PE 20S, DTY 75/36, POLY 75 ...
  yarn_color      VARCHAR(100),
  bale_count      INT,                           -- number of bales/cones
  quantity_kg     NUMERIC(10, 3) NOT NULL CHECK (quantity_kg > 0),
  delivery_note   VARCHAR(100),                  -- customer DO / challan no.
  notes           TEXT,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION RECORDS  (flat daily log — matches the maklon sheet)
-- date | fabric type | roll count (gulungan) | kg produced
-- ============================================================
CREATE TABLE production_records (
  id              SERIAL PRIMARY KEY,
  customer_id     INT NOT NULL REFERENCES customers(id),
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fabric_type_id  INT NOT NULL REFERENCES fabric_types(id),
  roll_count      INT NOT NULL DEFAULT 0 CHECK (roll_count >= 0),   -- gulungan
  fabric_kg       NUMERIC(10, 3) NOT NULL CHECK (fabric_kg > 0),
  yarn_receipt_id INT REFERENCES yarn_receipts(id) ON DELETE SET NULL,
  surat_jalan_id  INT,   -- set when auto-created from a Surat Jalan (FK added after surat_jalan table below)
  notes           TEXT,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVOICES (monthly maklon bill: header + lines per fabric type)
-- ============================================================
CREATE TABLE invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(30) NOT NULL UNIQUE,   -- INV-2025-001
  customer_id     INT NOT NULL REFERENCES customers(id),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_percent     NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  paid_date       DATE,
  notes           TEXT,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT period_valid CHECK (period_end >= period_start)
);

CREATE TABLE invoice_lines (
  id              SERIAL PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  fabric_type_id  INT NOT NULL REFERENCES fabric_types(id),
  total_kg        NUMERIC(10, 3) NOT NULL,
  rate_per_kg     NUMERIC(10, 2) NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL
);

-- ============================================================
-- YARN OPENING (SISA BENANG): admin-set leftover carried into a month.
-- One total kg per customer per month. Acts as a re-baseline point;
-- months without an explicit row inherit the previous month's closing.
-- ============================================================
CREATE TABLE yarn_opening (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  month       DATE NOT NULL,              -- first day of the month
  opening_kg  NUMERIC(12, 3) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, month)
);

-- ============================================================
-- SURAT JALAN (delivery note): printable doc with auto number
-- Number = <prefix>-NNNNNN where prefix = customer short_code.
-- Sequence runs per prefix; assigned when the doc is printed.
-- items = JSON array of per-roll weights (kg); totals derived.
-- ============================================================
CREATE TABLE surat_jalan (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(30) UNIQUE,            -- e.g. LYB-000001
  prefix       VARCHAR(20) NOT NULL,          -- customer short_code at print time
  seq          INT NOT NULL,                  -- running number within prefix
  customer_id  INT REFERENCES customers(id) ON DELETE SET NULL,
  branch_id    INT REFERENCES branches(id) ON DELETE SET NULL,  -- cabang produksi (internal, tak dicetak)
  jenis_kain   VARCHAR(150),
  tanggal      DATE NOT NULL DEFAULT CURRENT_DATE,
  kepada       VARCHAR(200),                  -- tujuan / recipient
  items        JSONB NOT NULL DEFAULT '[]',   -- array of roll weights (kg)
  total_rolls  INT NOT NULL DEFAULT 0,
  total_kg     NUMERIC(12, 3) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prefix, seq)
);

-- Link production records created from a Surat Jalan (deleting the SJ removes its production)
ALTER TABLE production_records
  ADD CONSTRAINT fk_prod_surat_jalan
  FOREIGN KEY (surat_jalan_id) REFERENCES surat_jalan(id) ON DELETE CASCADE;

-- ============================================================
-- SALES (PENJUALAN KAIN SENDIRI) — hasil produksi sendiri yang DIJUAL.
-- Terpisah dari invoice maklon. Menyimpan harga jual + modal -> untung.
-- Hanya diakses owner. amount/cost_total/profit dihitung di backend.
-- ============================================================
CREATE TABLE sales (
  id                SERIAL PRIMARY KEY,
  sale_number       VARCHAR(30) UNIQUE,             -- SALE-2026-001
  sale_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  buyer             VARCHAR(200),                   -- pembeli (bebas)
  fabric_type_id    INT REFERENCES fabric_types(id),
  roll_count        INT NOT NULL DEFAULT 0 CHECK (roll_count >= 0),
  quantity_kg       NUMERIC(12, 3) NOT NULL CHECK (quantity_kg > 0),
  sell_price_per_kg NUMERIC(12, 2) NOT NULL CHECK (sell_price_per_kg >= 0),  -- harga jual/kg
  cost_per_kg       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_kg >= 0), -- modal/HPP per kg
  amount            NUMERIC(14, 2) NOT NULL DEFAULT 0,   -- kg * harga jual
  cost_total        NUMERIC(14, 2) NOT NULL DEFAULT 0,   -- kg * modal
  profit            NUMERIC(14, 2) NOT NULL DEFAULT 0,   -- amount - cost_total (untung)
  notes             TEXT,
  created_by        INT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_yarn_receipts_customer    ON yarn_receipts(customer_id);
CREATE INDEX idx_yarn_receipts_date        ON yarn_receipts(received_date);
CREATE INDEX idx_prod_records_customer     ON production_records(customer_id);
CREATE INDEX idx_prod_records_date         ON production_records(production_date);
CREATE INDEX idx_prod_records_fabric       ON production_records(fabric_type_id);
CREATE INDEX idx_invoices_customer         ON invoices(customer_id);
CREATE INDEX idx_invoices_status           ON invoices(status);
CREATE INDEX idx_invoice_lines_invoice     ON invoice_lines(invoice_id);
CREATE INDEX idx_yarn_opening_customer     ON yarn_opening(customer_id);
CREATE INDEX idx_surat_jalan_prefix        ON surat_jalan(prefix);
CREATE INDEX idx_surat_jalan_customer      ON surat_jalan(customer_id);
CREATE INDEX idx_surat_jalan_branch        ON surat_jalan(branch_id);
CREATE INDEX idx_prod_records_sj           ON production_records(surat_jalan_id);
CREATE INDEX idx_sales_date                ON sales(sale_date);
CREATE INDEX idx_sales_fabric              ON sales(fabric_type_id);

-- ============================================================
-- VIEWS
-- ============================================================

-- Production rolled up per customer / month / fabric type
CREATE VIEW v_production_summary AS
SELECT
  pr.customer_id,
  c.name                                   AS customer_name,
  date_trunc('month', pr.production_date)::date AS period_month,
  pr.fabric_type_id,
  ft.name                                  AS fabric_type,
  COUNT(*)                                 AS entry_count,
  SUM(pr.roll_count)                       AS total_rolls,
  SUM(pr.fabric_kg)                        AS total_kg
FROM production_records pr
JOIN customers c    ON c.id = pr.customer_id
JOIN fabric_types ft ON ft.id = pr.fabric_type_id
GROUP BY pr.customer_id, c.name, date_trunc('month', pr.production_date), pr.fabric_type_id, ft.name;

-- Invoice header with customer details
CREATE VIEW v_invoice_summary AS
SELECT
  i.id,
  i.invoice_number,
  c.name          AS customer_name,
  c.code          AS customer_code,
  i.period_start,
  i.period_end,
  i.invoice_date,
  i.due_date,
  i.subtotal,
  i.tax_percent,
  i.tax_amount,
  i.total_amount,
  i.status,
  i.paid_date
FROM invoices i
JOIN customers c ON c.id = i.customer_id;

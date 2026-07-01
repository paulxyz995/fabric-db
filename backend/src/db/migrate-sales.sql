-- ============================================================
-- Migration: tipe pelanggan (maklon/own) + modul Penjualan kain sendiri.
--   customers.type: 'maklon' (jasa) atau 'own' (produksi sendiri)
--   tabel sales: harga jual + modal -> untung (hanya diakses owner)
-- Aman dijalankan pada DB yang sudah ada (idempotent).
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'maklon';

-- Pastikan constraint tipe ada (drop dulu agar aman diulang)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_type_check;
ALTER TABLE customers
  ADD CONSTRAINT customers_type_check CHECK (type IN ('maklon', 'own'));

CREATE TABLE IF NOT EXISTS sales (
  id                SERIAL PRIMARY KEY,
  sale_number       VARCHAR(30) UNIQUE,
  sale_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  buyer             VARCHAR(200),
  fabric_type_id    INT REFERENCES fabric_types(id),
  roll_count        INT NOT NULL DEFAULT 0 CHECK (roll_count >= 0),
  quantity_kg       NUMERIC(12, 3) NOT NULL CHECK (quantity_kg > 0),
  sell_price_per_kg NUMERIC(12, 2) NOT NULL CHECK (sell_price_per_kg >= 0),
  cost_per_kg       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_kg >= 0),
  amount            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cost_total        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  profit            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_by        INT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_date   ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_fabric ON sales(fabric_type_id);

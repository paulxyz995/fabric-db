-- ============================================================
-- Migration: add surat_jalan (delivery note) table.
-- Number = <prefix>-NNNNNN, sequenced per prefix (customer short_code).
-- Safe to run on an existing DB.
-- ============================================================

CREATE TABLE IF NOT EXISTS surat_jalan (
  id           SERIAL PRIMARY KEY,
  number       VARCHAR(30) UNIQUE,
  prefix       VARCHAR(20) NOT NULL,
  seq          INT NOT NULL,
  customer_id  INT REFERENCES customers(id) ON DELETE SET NULL,
  jenis_kain   VARCHAR(150),
  tanggal      DATE NOT NULL DEFAULT CURRENT_DATE,
  kepada       VARCHAR(200),
  items        JSONB NOT NULL DEFAULT '[]',
  total_rolls  INT NOT NULL DEFAULT 0,
  total_kg     NUMERIC(12, 3) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prefix, seq)
);

CREATE INDEX IF NOT EXISTS idx_surat_jalan_prefix   ON surat_jalan(prefix);
CREATE INDEX IF NOT EXISTS idx_surat_jalan_customer ON surat_jalan(customer_id);

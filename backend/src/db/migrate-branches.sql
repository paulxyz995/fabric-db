-- ============================================================
-- Migration: cabang produksi (branches) + pilihan cabang di surat jalan.
--   - tabel branches (bisa dikelola lewat menu Cabang)
--   - surat_jalan.branch_id (dicatat internal, TIDAK dicetak di PDF)
-- Aman dijalankan pada DB yang sudah ada (idempotent).
-- ============================================================

CREATE TABLE IF NOT EXISTS branches (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE surat_jalan
  ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_surat_jalan_branch ON surat_jalan(branch_id);

-- Isi 2 cabang default bila belum ada satu pun (nama bisa diganti di aplikasi)
INSERT INTO branches (name)
SELECT v.name FROM (VALUES ('Cabang 1'), ('Cabang 2')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM branches);

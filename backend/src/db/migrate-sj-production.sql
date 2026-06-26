-- ============================================================
-- Migration: link production_records to surat_jalan.
-- When a Surat Jalan is issued, a production record (HASIL JADI /
-- "Already sent") is created for the customer, which feeds the SISA
-- leftover (opening + yarn_in - sent). Deleting the SJ cascades.
-- Safe to run on an existing DB.
-- ============================================================

ALTER TABLE production_records
  ADD COLUMN IF NOT EXISTS surat_jalan_id INT REFERENCES surat_jalan(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_prod_records_sj ON production_records(surat_jalan_id);

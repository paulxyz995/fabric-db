-- ============================================================
-- Migration: add customers.short_code (admin nickname / initial)
-- Used as a clean tag in downloaded PDF filenames.
-- Safe to run on an existing DB with config data.
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS short_code VARCHAR(20);

-- Seed sensible defaults for the current active customers (idempotent;
-- only fills when empty so admin edits are never overwritten).
UPDATE customers SET short_code = 'LYB' WHERE name = 'LYBRATEX'  AND (short_code IS NULL OR short_code = '');
UPDATE customers SET short_code = 'FRS' WHERE name = 'H YUSUP'   AND (short_code IS NULL OR short_code = '');
UPDATE customers SET short_code = 'CFY' WHERE name = 'CFY'       AND (short_code IS NULL OR short_code = '');
UPDATE customers SET short_code = 'MCH' WHERE name = 'MCH BARU'  AND (short_code IS NULL OR short_code = '');
UPDATE customers SET short_code = 'SPR' WHERE name = 'SPR'       AND (short_code IS NULL OR short_code = '');

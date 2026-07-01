-- ============================================================
-- SEED DATA (v2) — minimal: users + 5 active customers.
-- Fabric types, production, and yarn come from import-excel.js.
-- Set maklon rates per customer in the app (Customers → Rates).
-- ============================================================

-- Users (ganti password sebelum dipakai produksi)
--   Owner : owner@company.com / Owner@123
--   Admin : admin@company.com / Admin@123
--   HR    : hr@company.com    / Hr@123456
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Owner',    'owner@company.com', crypt('Owner@123', gen_salt('bf')), 'owner'),
  ('Admin',    'admin@company.com', crypt('Admin@123', gen_salt('bf')), 'admin'),
  ('HR Staff', 'hr@company.com',    crypt('Hr@123456', gen_salt('bf')), 'hr');

-- Pelanggan contoh (dummy) — ganti/isi data asli lewat menu Pelanggan.
INSERT INTO customers (code, name, short_code) VALUES
  ('CUST-001', 'PT Contoh Tekstil',   'CTX'),
  ('CUST-002', 'CV Sumber Kain',       'SBK'),
  ('CUST-003', 'PT Maju Sandang',      'MJS'),
  ('CUST-004', 'CV Rejeki Benang',     'RJB'),
  ('CUST-005', 'PT Sentosa Fabric',    'STF');

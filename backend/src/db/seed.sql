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

-- Active customers (from the cleaned workbook). Import matches by name.
INSERT INTO customers (code, name) VALUES
  ('CUST-001', 'LYBRATEX'),
  ('CUST-002', 'SPR'),
  ('CUST-003', 'MCH BARU'),
  ('CUST-004', 'H YUSUP'),
  ('CUST-005', 'CFY');

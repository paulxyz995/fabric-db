-- ============================================================
-- Migration: tambah peran 'owner' (owner > hr > admin).
--   owner: akses penuh + pendapatan/uang + kelola user
--   hr:    kelola user, tidak lihat pendapatan
--   admin: input data operasional saja
-- Aman dijalankan pada DB yang sudah ada.
-- ============================================================

-- Perbarui constraint peran agar menerima 'owner'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'hr'));

-- Buat akun owner default bila belum ada satu pun owner
-- (password: Owner@123 — ganti setelah login pertama)
INSERT INTO users (name, email, password_hash, role)
SELECT 'Owner', 'owner@company.com', crypt('Owner@123', gen_salt('bf')), 'owner'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner');

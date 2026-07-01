const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { canManageUsers } = require('../middleware/auth');

const ROLES = ['owner', 'admin', 'hr'];

// Semua endpoint di sini butuh hak kelola user (owner atau HR)
router.use(canManageUsers);

// GET /api/users — daftar user (tanpa password)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY role, name'
  );
  res.json(rows);
});

// POST /api/users — tambah user baru
// Hanya owner yang boleh membuat akun ber-role 'owner'.
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Nama, email, password, dan peran wajib diisi' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Peran tidak valid' });
  }
  if (role === 'owner' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Hanya owner yang boleh membuat akun owner' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email, hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email sudah terdaftar' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — ubah nama/peran/status, dan opsional reset password
router.put('/:id', async (req, res) => {
  const { name, role, is_active, password } = req.body;
  const id = Number(req.params.id);
  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ error: 'Peran tidak valid' });
  }
  // Ambil target dulu untuk aturan keamanan
  const { rows: cur } = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
  if (!cur[0]) return res.status(404).json({ error: 'User tidak ditemukan' });

  // HR tidak boleh mengubah akun owner, dan tidak boleh menaikkan peran ke owner
  if (req.user.role !== 'owner') {
    if (cur[0].role === 'owner') {
      return res.status(403).json({ error: 'Hanya owner yang boleh mengubah akun owner' });
    }
    if (role === 'owner') {
      return res.status(403).json({ error: 'Hanya owner yang boleh menetapkan peran owner' });
    }
  }
  // Cegah menonaktifkan diri sendiri
  if (id === req.user.id && is_active === false) {
    return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users
         SET name = COALESCE($1, name),
             role = COALESCE($2, role),
             is_active = COALESCE($3, is_active),
             password_hash = COALESCE($4, password_hash)
       WHERE id = $5
       RETURNING id, name, email, role, is_active, created_at`,
      [
        name ?? null,
        role ?? null,
        typeof is_active === 'boolean' ? is_active : null,
        password ? bcrypt.hashSync(password, 10) : null,
        id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

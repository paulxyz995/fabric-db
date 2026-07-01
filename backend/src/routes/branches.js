const router = require('express').Router();
const pool = require('../db/pool');
const { canWriteOps } = require('../middleware/auth');

// GET /api/branches — daftar cabang (semua peran boleh lihat)
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM branches ORDER BY name');
  res.json(rows);
});

// POST /api/branches (owner + admin)
router.post('/', canWriteOps, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama cabang wajib diisi' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO branches (name) VALUES ($1) RETURNING *', [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Nama cabang sudah ada' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/branches/:id (owner + admin)
router.put('/:id', canWriteOps, async (req, res) => {
  const { name, is_active } = req.body;
  const { rows } = await pool.query(
    'UPDATE branches SET name = COALESCE($1, name), is_active = COALESCE($2, is_active) WHERE id = $3 RETURNING *',
    [name ?? null, typeof is_active === 'boolean' ? is_active : null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cabang tidak ditemukan' });
  res.json(rows[0]);
});

// DELETE /api/branches/:id (owner + admin) — tolak bila sudah dipakai surat jalan
router.delete('/:id', canWriteOps, async (req, res) => {
  const { rows: used } = await pool.query(
    'SELECT 1 FROM surat_jalan WHERE branch_id = $1 LIMIT 1', [req.params.id]
  );
  if (used[0]) return res.status(409).json({ error: 'Tidak bisa dihapus: cabang dipakai di surat jalan' });
  const { rowCount } = await pool.query('DELETE FROM branches WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Cabang tidak ditemukan' });
  res.json({ ok: true });
});

module.exports = router;

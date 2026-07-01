const router = require('express').Router();
const pool = require('../db/pool');
const { canWriteOps } = require('../middleware/auth');

// GET /api/fabric-types
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM fabric_types ORDER BY name');
  res.json(rows);
});

// POST /api/fabric-types  (admin only)
router.post('/', canWriteOps, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO fabric_types (name, description) VALUES ($1,$2) RETURNING *',
      [name, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Fabric type already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fabric-types/:id  (admin only)
router.put('/:id', canWriteOps, async (req, res) => {
  const { name, description } = req.body;
  const { rows } = await pool.query(
    'UPDATE fabric_types SET name=$1, description=$2 WHERE id=$3 RETURNING *',
    [name, description, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Fabric type not found' });
  res.json(rows[0]);
});

// DELETE /api/fabric-types/:id  (admin only — block if in use)
router.delete('/:id', canWriteOps, async (req, res) => {
  try {
    const { rows: used } = await pool.query(
      'SELECT 1 FROM production_records WHERE fabric_type_id = $1 LIMIT 1',
      [req.params.id]
    );
    if (used[0]) {
      return res.status(409).json({ error: 'Cannot delete: fabric type is used in production records' });
    }
    const { rowCount } = await pool.query('DELETE FROM fabric_types WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Fabric type not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const router = require('express').Router();
const pool = require('../db/pool');
const { adminOnly } = require('../middleware/auth');

const pad6 = (n) => String(n).padStart(6, '0');
const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000;

// Normalize incoming items into a clean array of positive weights (kg)
function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((v) => (typeof v === 'object' && v !== null ? Number(v.kg) : Number(v)))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map(r3);
}

// GET /api/surat-jalan — list issued delivery notes (newest first)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT sj.*, c.name AS customer_name
     FROM surat_jalan sj
     LEFT JOIN customers c ON c.id = sj.customer_id
     ORDER BY sj.created_at DESC, sj.id DESC`
  );
  res.json(rows);
});

// GET /api/surat-jalan/next-number?prefix=LYB — preview the next number
router.get('/next-number', async (req, res) => {
  const prefix = String(req.query.prefix || '').trim().toUpperCase();
  if (!prefix) return res.status(400).json({ error: 'prefix required' });
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM surat_jalan WHERE prefix = $1',
    [prefix]
  );
  const seq = Number(rows[0].next);
  res.json({ prefix, seq, number: `${prefix}-${pad6(seq)}` });
});

// GET /api/surat-jalan/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT sj.*, c.name AS customer_name
     FROM surat_jalan sj
     LEFT JOIN customers c ON c.id = sj.customer_id
     WHERE sj.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Surat Jalan not found' });
  res.json(rows[0]);
});

// POST /api/surat-jalan/issue — assign the next number for the prefix and save (admin)
// body: { prefix, customer_id, jenis_kain, tanggal, kepada, items, notes }
router.post('/issue', adminOnly, async (req, res) => {
  const prefix = String(req.body.prefix || '').trim().toUpperCase();
  if (!prefix) return res.status(400).json({ error: 'prefix (customer short code) required' });

  const items = cleanItems(req.body.items);
  const total_rolls = items.length;
  const total_kg = r3(items.reduce((s, n) => s + n, 0));
  const { customer_id, jenis_kain, tanggal, kepada, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize number assignment per prefix to avoid duplicate sequences.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefix]);
    const { rows: seqRows } = await client.query(
      'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM surat_jalan WHERE prefix = $1',
      [prefix]
    );
    const seq = Number(seqRows[0].next);
    const number = `${prefix}-${pad6(seq)}`;

    const { rows } = await client.query(
      `INSERT INTO surat_jalan
         (number, prefix, seq, customer_id, jenis_kain, tanggal, kepada, items, total_rolls, total_kg, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [number, prefix, seq, customer_id || null, jenis_kain || null,
       tanggal || new Date(), kepada || null, JSON.stringify(items),
       total_rolls, total_kg, notes || null, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/surat-jalan/:id — edit an issued note (keeps its number) (admin)
router.put('/:id', adminOnly, async (req, res) => {
  const items = cleanItems(req.body.items);
  const total_rolls = items.length;
  const total_kg = r3(items.reduce((s, n) => s + n, 0));
  const { customer_id, jenis_kain, tanggal, kepada, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE surat_jalan
       SET customer_id=$1, jenis_kain=$2, tanggal=$3, kepada=$4,
           items=$5, total_rolls=$6, total_kg=$7, notes=$8
     WHERE id=$9 RETURNING *`,
    [customer_id || null, jenis_kain || null, tanggal || new Date(), kepada || null,
     JSON.stringify(items), total_rolls, total_kg, notes || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Surat Jalan not found' });
  res.json(rows[0]);
});

// DELETE /api/surat-jalan/:id (admin)
router.delete('/:id', adminOnly, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM surat_jalan WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Surat Jalan not found' });
  res.json({ ok: true });
});

module.exports = router;

const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
}

// Roles: 'owner' (pemilik) > 'hr' > 'admin'
//  - owner: akses penuh, termasuk pendapatan/uang & kelola user
//  - hr:    kelola user, TIDAK lihat pendapatan
//  - admin: input data operasional saja
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }
    next();
  };
}

// Pendapatan / invoice / harga: hanya owner
const ownerOnly = requireRoles('owner');
// Input data operasional (pelanggan, benang, produksi, surat jalan): owner + admin
const canWriteOps = requireRoles('owner', 'admin');
// Kelola user (tambah admin): owner + hr
const canManageUsers = requireRoles('owner', 'hr');

module.exports = { authenticate, requireRoles, ownerOnly, canWriteOps, canManageUsers };

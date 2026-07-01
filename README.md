# Fabric DB — Database Maklon Kain

Aplikasi web untuk usaha **maklon (jasa produksi) kain**: pelanggan kirim benang → pabrik
merajut jadi kain → ditagih per kg sesuai jenis kain. Mencatat benang masuk, produksi
harian, sisa benang (SISA), surat jalan, dan invoice bulanan.

- **Frontend:** React 18 + Ant Design 5 + Vite
- **Backend:** Node.js + Express + JWT
- **Database:** PostgreSQL

> Panduan ini dibuat lengkap supaya tidak bolak-balik: ada **setup lokal** dan
> **deploy ke VPS** dari nol sampai online.

---

## Daftar Isi
1. [Peran & Hak Akses](#1-peran--hak-akses)
2. [Akun Default](#2-akun-default)
3. [Setup Lokal (Development)](#3-setup-lokal-development)
4. [Variabel Environment](#4-variabel-environment)
5. [Database: Skema & Migrasi](#5-database-skema--migrasi)
6. [Deploy ke VPS (Produksi)](#6-deploy-ke-vps-produksi) — Cara A: Docker · Cara B: Manual
7. [Cara Update Setelah Deploy](#7-cara-update-setelah-deploy)
8. [Backup Database](#8-backup-database)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Peran & Hak Akses

Ada 3 peran: **Owner > HR > Admin**.

| Fitur | Owner | HR | Admin |
|-------|:-----:|:--:|:-----:|
| Lihat data operasional (pelanggan, benang, produksi, surat jalan) | ✅ | ✅ | ✅ |
| Input/edit data operasional | ✅ | ❌ | ✅ |
| Buat/cetak Surat Jalan | ✅ | ❌ | ✅ |
| **Invoice / Pendapatan (lihat & buat)** | ✅ | ❌ | ❌ |
| **Dashboard: kartu pendapatan** | ✅ | ❌ | ❌ |
| Kelola user (tambah admin) | ✅ | ✅ | ❌ |

Catatan:
- Semua data uang (invoice, tarif maklon, pendapatan) **hanya bisa diakses Owner**.
- **Hanya Owner** yang boleh membuat akun ber-peran Owner. HR hanya bisa membuat Admin/HR.

---

## 2. Akun Default

Dibuat otomatis oleh `seed.sql` (fresh install) atau `migrate-roles.sql` (owner).

| Peran | Email | Password |
|-------|-------|----------|
| Owner | owner@company.com | Owner@123 |
| Admin | admin@company.com | Admin@123 |
| HR    | hr@company.com    | Hr@123456 |

> **WAJIB ganti password ini** setelah login pertama (menu **Pengguna**).

---

## 3. Setup Lokal (Development)

**Prasyarat:** Node.js 18+, PostgreSQL 14+, npm.

```bash
# 1. Clone
git clone https://github.com/paulxyz995/fabric-db.git
cd fabric-db

# 2. Buat database
psql -U postgres -c "CREATE DATABASE fabricdb;"

# 3. Backend
cd backend
npm install
cp .env.example .env        # lalu edit .env (lihat bagian 4)
psql "$DATABASE_URL" -f src/db/schema.sql   # buat tabel + akun default
psql "$DATABASE_URL" -f src/db/seed.sql     # data awal (pelanggan contoh)
npm run dev                 # API jalan di http://localhost:4000

# 4. Frontend (terminal baru)
cd ../frontend
npm install
npm run dev                 # buka http://localhost:3000
```

Saat development, Vite otomatis mem-proxy `/api` ke `http://localhost:4000`
(lihat `frontend/vite.config.js`), jadi tidak perlu setting tambahan.

---

## 4. Variabel Environment

File `backend/.env` (jangan pernah di-commit — sudah di `.gitignore`):

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/fabricdb
JWT_SECRET=ganti_dengan_string_acak_yang_panjang
JWT_EXPIRES_IN=8h
PORT=4000
```

- `DATABASE_URL` — koneksi PostgreSQL.
- `JWT_SECRET` — kunci rahasia token login. **Wajib diganti** dengan string acak panjang.
  Contoh membuat: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `JWT_EXPIRES_IN` — masa berlaku sesi login (default 8 jam).
- `PORT` — port backend (default 4000).

Frontend tidak perlu `.env` — ia memanggil `/api` secara relatif dan diteruskan
oleh Nginx (produksi) atau Vite (development).

---

## 5. Database: Skema & Migrasi

### Install baru (database kosong)
Cukup dua file — akun `owner` sudah termasuk:
```bash
psql "$DATABASE_URL" -f src/db/schema.sql
psql "$DATABASE_URL" -f src/db/seed.sql
```

### Upgrade database lama (sudah ada data)
Jalankan migrasi yang belum pernah dijalankan (aman diulang, pakai `IF NOT EXISTS`):
```bash
psql "$DATABASE_URL" -f src/db/migrate-short-code.sql     # inisial pelanggan
psql "$DATABASE_URL" -f src/db/migrate-surat-jalan.sql    # tabel surat jalan
psql "$DATABASE_URL" -f src/db/migrate-sj-production.sql   # surat jalan -> produksi
psql "$DATABASE_URL" -f src/db/migrate-roles.sql          # peran owner + akun owner
```

> **Penting:** `migrate-roles.sql` wajib dijalankan pada database lama agar peran
> **Owner** aktif dan akun owner default dibuat.

---

## 6. Deploy ke VPS (Produksi)

Ada dua cara. **Cara A (Docker) paling mudah** — cukup satu perintah. Cara B manual
kalau tidak mau pakai Docker.

---

### Cara A — Docker (Direkomendasikan)

Semua (PostgreSQL + backend + frontend/Nginx) dijalankan otomatis oleh
`docker-compose.yml`. Cocok untuk VPS **Ubuntu 22.04/24.04**.

```bash
# 1. Install Docker (sekali saja)
ssh root@IP_SERVER
curl -fsSL https://get.docker.com | sh

# 2. Ambil kode
cd /opt
git clone https://github.com/paulxyz995/fabric-db.git
cd fabric-db

# 3. Buat file .env dari contoh, lalu isi password & JWT_SECRET
cp .env.example .env
nano .env          # ganti POSTGRES_PASSWORD dan JWT_SECRET

# 4. Jalankan semuanya
docker compose up -d --build
```

Buka **http://IP_SERVER:8080** — aplikasi langsung online. Database, tabel, dan
akun default dibuat otomatis saat pertama kali jalan.

Perintah harian:
```bash
docker compose ps            # status
docker compose logs -f       # lihat log
docker compose down          # matikan (data tetap aman di volume)
docker compose up -d --build # nyalakan lagi / setelah update kode
```

> **Ganti port:** ubah `WEB_PORT` di `.env` (mis. `WEB_PORT=80` agar diakses tanpa `:8080`).
>
> **HTTPS + domain:** taruh Caddy/Nginx sebagai reverse proxy di depan port 8080,
> atau tambah layanan Caddy ke compose. (Bisa saya bantu kalau sudah punya domain.)
>
> **Upgrade DB lama:** init otomatis hanya jalan saat volume kosong. Kalau volume
> sudah berisi data lama, jalankan migrasi manual sekali:
> `docker compose exec -T db psql -U postgres -d fabricdb < backend/src/db/migrate-roles.sql`

---

### Cara B — Manual (Nginx + PM2)

Tanpa Docker. Pakai **Ubuntu 22.04/24.04** + **Nginx** + **PM2**.

### 6.1 Install kebutuhan di server
```bash
ssh root@IP_SERVER

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# PostgreSQL, Nginx, Git, PM2
apt-get install -y postgresql nginx git
npm install -g pm2
```

### 6.2 Siapkan database
```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE fabricdb;
CREATE USER fabric WITH PASSWORD 'password_kuat_disini';
GRANT ALL PRIVILEGES ON DATABASE fabricdb TO fabric;
\c fabricdb
GRANT ALL ON SCHEMA public TO fabric;
SQL
```

### 6.3 Ambil kode & setup backend
```bash
cd /opt
git clone https://github.com/paulxyz995/fabric-db.git
cd fabric-db/backend
npm install --omit=dev

# Buat .env
cat > .env <<'ENV'
DATABASE_URL=postgresql://fabric:password_kuat_disini@localhost:5432/fabricdb
JWT_SECRET=GANTI_STRING_ACAK_PANJANG
JWT_EXPIRES_IN=8h
PORT=4000
ENV

# Buat tabel + akun default
psql "$(grep DATABASE_URL .env | cut -d= -f2-)" -f src/db/schema.sql
psql "$(grep DATABASE_URL .env | cut -d= -f2-)" -f src/db/seed.sql

# Jalankan backend sebagai service via PM2
pm2 start src/index.js --name fabric-api
pm2 save
pm2 startup     # ikuti perintah yang muncul agar auto-start saat reboot
```

### 6.4 Build frontend
```bash
cd /opt/fabric-db/frontend
npm install
npm run build            # hasil ada di folder dist/
```

### 6.5 Konfigurasi Nginx
Buat `/etc/nginx/sites-available/fabric`:
```nginx
server {
    listen 80;
    server_name domain-anda.com;   # atau IP server

    # Frontend (file statis hasil build)
    root /opt/fabric-db/frontend/dist;
    index index.html;

    # SPA: semua route diarahkan ke index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API diteruskan ke backend
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Aktifkan:
```bash
ln -s /etc/nginx/sites-available/fabric /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Buka `http://domain-anda.com` (atau `http://IP_SERVER`). Aplikasi sudah online.

### 6.6 (Opsional) HTTPS dengan domain
Kalau punya domain (arahkan A record ke IP server dulu):
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d domain-anda.com
```
Certbot otomatis pasang sertifikat SSL gratis + perpanjang sendiri.

---

## 7. Cara Update Setelah Deploy

Setiap ada perubahan kode baru di GitHub:
```bash
cd /opt/fabric-db
git pull

# Backend
cd backend && npm install --omit=dev
# jalankan migrasi baru bila ada (lihat bagian 5)
pm2 restart fabric-api

# Frontend
cd ../frontend && npm install && npm run build
# tidak perlu restart Nginx; file dist langsung terpakai
```

---

## 8. Backup Database

```bash
# Backup (jalankan rutin, mis. lewat cron harian)
pg_dump "postgresql://fabric:password@localhost:5432/fabricdb" > backup_$(date +%F).sql

# Restore
psql "postgresql://fabric:password@localhost:5432/fabricdb" < backup_2026-07-01.sql
```
Disarankan menyalin file backup ke luar server (mis. ke komputer sendiri) secara berkala.

---

## 9. Troubleshooting

| Masalah | Penyebab & Solusi |
|---------|-------------------|
| Login gagal / "Token tidak valid" | `JWT_SECRET` berubah setelah user login → cukup login ulang. |
| Halaman putih / API error 500 | Cek log backend: `pm2 logs fabric-api`. Biasanya `DATABASE_URL` salah. |
| Peran Owner tidak muncul | Database lama belum dimigrasi → jalankan `migrate-roles.sql` (bagian 5). |
| `/api` 404 di produksi | Blok `location /api/` di Nginx belum benar atau backend mati (`pm2 status`). |
| Perubahan frontend tak muncul | Belum `npm run build` ulang, atau cache browser → hard refresh (Ctrl+F5). |
| Postgres tak bisa diakses (Windows lokal) | Pastikan service PostgreSQL jalan; matikan Smart App Control bila memblokir. |

---

## Struktur Proyek
```
fabric-db/
├── backend/
│   ├── src/
│   │   ├── db/           # schema.sql, seed.sql, migrate-*.sql
│   │   ├── middleware/   # auth.js (JWT + cek peran)
│   │   ├── routes/       # auth, customers, production, invoices, surat-jalan, users, dashboard
│   │   └── index.js      # entry Express
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/    # AppLayout (sidebar + header)
    │   ├── hooks/         # useAuth (peran & hak akses)
    │   ├── pages/         # Dashboard, Customers, CustomerDetail, Invoices, SuratJalan, Pengguna, ...
    │   └── utils/         # api.js (axios + JWT), pdf.js, suratJalanPdf.js
    └── vite.config.js
```

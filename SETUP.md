# Fabric DB — Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

---

## 1. Create the Database

```bash
psql -U postgres
CREATE DATABASE fabricdb;
\q
```

---

## 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/fabricdb
JWT_SECRET=pick_a_long_random_string_here
PORT=4000
```

Run the schema and seed:
```bash
psql $DATABASE_URL -f src/db/schema.sql
psql $DATABASE_URL -f src/db/seed.sql
```

Start the API:
```bash
npm run dev
```

API is now running at http://localhost:4000

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Default Logins

| Role  | Email                | Password   |
|-------|----------------------|------------|
| Admin | admin@company.com    | Admin@123  |
| HR    | hr@company.com       | Hr@123456  |

**Change these passwords before going to production.**

---

## Access Control

| Feature               | Admin | HR  |
|-----------------------|-------|-----|
| View dashboard        | Yes   | Yes |
| View customers        | Yes   | Yes |
| Add/edit customers    | Yes   | No  |
| Log yarn receipts     | Yes   | Yes |
| Create production jobs| Yes   | No  |
| Log production output | Yes   | No  |
| View jobs & invoices  | Yes   | Yes |
| Generate invoices     | Yes   | No  |
| Mark invoice paid     | Yes   | No  |

---

## Project Structure

```
fabric-db/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql      ← database tables + views
│   │   │   ├── seed.sql        ← sample data
│   │   │   └── pool.js         ← PostgreSQL connection
│   │   ├── middleware/
│   │   │   └── auth.js         ← JWT + role check
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── customers.js
│   │   │   ├── yarnReceipts.js
│   │   │   ├── productionJobs.js
│   │   │   ├── invoices.js
│   │   │   └── dashboard.js
│   │   └── index.js            ← Express app entry
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── AppLayout.jsx   ← sidebar + header
    │   ├── hooks/
    │   │   └── useAuth.js
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Customers.jsx
    │   │   ├── YarnReceipts.jsx
    │   │   ├── ProductionJobs.jsx
    │   │   └── Invoices.jsx
    │   ├── utils/
    │   │   └── api.js          ← axios with JWT header
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

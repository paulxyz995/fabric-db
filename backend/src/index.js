require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { authenticate } = require('./middleware/auth');
const authRoutes       = require('./routes/auth');
const customerRoutes   = require('./routes/customers');
const fabricTypeRoutes = require('./routes/fabricTypes');
const yarnRoutes       = require('./routes/yarnReceipts');
const productionRoutes = require('./routes/production');
const invoiceRoutes    = require('./routes/invoices');
const suratJalanRoutes = require('./routes/suratJalan');
const dashboardRoutes  = require('./routes/dashboard');
const userRoutes       = require('./routes/users');
const salesRoutes      = require('./routes/sales');

const app = express();
app.use(cors());
app.use(express.json());

// Public
app.use('/api/auth', authRoutes);

// Protected — all routes below require a valid JWT
app.use('/api', authenticate);
app.use('/api/dashboard',        dashboardRoutes);
app.use('/api/customers',        customerRoutes);
app.use('/api/fabric-types',     fabricTypeRoutes);
app.use('/api/yarn-receipts',    yarnRoutes);
app.use('/api/production',        productionRoutes);
app.use('/api/invoices',         invoiceRoutes);
app.use('/api/surat-jalan',      suratJalanRoutes);
app.use('/api/users',            userRoutes);
app.use('/api/sales',            salesRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

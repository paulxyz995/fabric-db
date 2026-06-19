-- ============================================================
-- SEED DATA: Sample records for development / testing
-- ============================================================

-- Admin user (password: Admin@123 — change before production)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin', 'admin@company.com', crypt('Admin@123', gen_salt('bf')), 'admin'),
  ('HR Staff', 'hr@company.com',  crypt('Hr@123456', gen_salt('bf')), 'hr');

-- Fabric types
INSERT INTO fabric_types (name, description) VALUES
  ('Cotton Plain 30s',     'Plain weave cotton, 30 count'),
  ('Cotton Twill 40s',     'Twill weave cotton, 40 count'),
  ('Polyester Plain 75D',  'Plain weave polyester, 75 denier'),
  ('TC Blend 45s',         'Poly-cotton blended fabric, 45 count');

-- Customers
INSERT INTO customers (code, name, contact_person, phone, email, address) VALUES
  ('CUST-001', 'Budi Santoso Textile',  'Budi Santoso',  '08123456789', 'budi@bstextile.com',  'Jl. Industri No. 12, Bandung'),
  ('CUST-002', 'Mitra Kain Nusantara',  'Rina Dewi',     '08234567890', 'rina@mitrakain.com',  'Jl. Raya Tekstil No. 5, Solo'),
  ('CUST-003', 'Cahaya Benang Mas',     'Hendra Wijaya', '08345678901', 'hendra@cahayabm.com', 'Jl. Garment No. 8, Surabaya');

-- Customer rates (per kg per fabric type)
INSERT INTO customer_rates (customer_id, fabric_type_id, rate_per_kg, effective_from) VALUES
  (1, 1, 4500.00, '2025-01-01'),   -- CUST-001 Cotton Plain 30s
  (1, 2, 5200.00, '2025-01-01'),   -- CUST-001 Cotton Twill 40s
  (2, 1, 4300.00, '2025-01-01'),   -- CUST-002 Cotton Plain 30s
  (2, 3, 3800.00, '2025-01-01'),   -- CUST-002 Polyester Plain 75D
  (3, 4, 4800.00, '2025-01-01'),   -- CUST-003 TC Blend 45s
  (3, 1, 4400.00, '2025-01-01');   -- CUST-003 Cotton Plain 30s

-- Yarn receipts
INSERT INTO yarn_receipts (receipt_number, customer_id, received_date, yarn_type, yarn_color, quantity_kg, delivery_note) VALUES
  ('YR-2025-001', 1, '2025-06-01', 'Cotton 30s',      'White',   500.000, 'DN-BST-001'),
  ('YR-2025-002', 2, '2025-06-05', 'Polyester 75D',   'Navy',    300.000, 'DN-MKN-012'),
  ('YR-2025-003', 3, '2025-06-10', 'TC Blend 45s',    'Cream',   400.000, 'DN-CBM-007');

-- Production jobs
INSERT INTO production_jobs (job_number, yarn_receipt_id, customer_id, fabric_type_id, start_date, status) VALUES
  ('JOB-2025-001', 1, 1, 1, '2025-06-02', 'completed'),
  ('JOB-2025-002', 2, 2, 3, '2025-06-06', 'in_progress'),
  ('JOB-2025-003', 3, 3, 4, '2025-06-11', 'pending');

-- Production outputs (for completed job)
INSERT INTO production_outputs (production_job_id, output_date, fabric_kg, yarn_consumed_kg, wastage_kg) VALUES
  (1, '2025-06-08', 462.500, 485.000, 15.000),  -- JOB-2025-001 done
  (2, '2025-06-12', 150.000, 160.000,  8.000);  -- JOB-2025-002 partial

-- Invoice for completed job
INSERT INTO invoices (
  invoice_number, production_job_id, customer_id,
  invoice_date, due_date,
  fabric_kg, rate_per_kg,
  subtotal, tax_percent, tax_amount, total_amount,
  status
) VALUES (
  'INV-2025-001', 1, 1,
  '2025-06-09', '2025-06-23',
  462.500, 4500.00,
  2081250.00, 11, 229137.50, 2310387.50,
  'sent'
);

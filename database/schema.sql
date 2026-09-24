-- RDS Inventory Management Database Schema
-- This schema defines all tables for the inventory management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Segments table (DTF, UV DTF, etc.)
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table (Inks, Films, Powders, etc.)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW(),
  UNIQUE(name, segment_id)
);

-- Sub-categories table (Premium/Standard, SC/DC, etc.)
CREATE TABLE sub_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW(),
  UNIQUE(name, category_id)
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  sku_code VARCHAR(100) UNIQUE,
  unit VARCHAR(20) NOT NULL CHECK (unit IN ('L', 'PCS', 'KG')),
  hsn_code VARCHAR(20) NOT NULL,
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  price_gst DECIMAL(10,2) NOT NULL,
  price_non_gst DECIMAL(10,2) NOT NULL,
  min_stock_level DECIMAL(10,2) NOT NULL DEFAULT 0,
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  segment_id UUID REFERENCES segments(id),
  category_id UUID REFERENCES categories(id),
  sub_category_id UUID REFERENCES sub_categories(id),
  default_supplier_id UUID,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(20) NOT NULL,
  whatsapp VARCHAR(20),
  email VARCHAR(200),
  address TEXT,
  gstin VARCHAR(15),
  is_gst_customer BOOLEAN DEFAULT FALSE,
  is_dealer BOOLEAN DEFAULT FALSE,
  default_due_days INTEGER DEFAULT 7,
  credit_limit DECIMAL(12,2),
  opening_balance DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(20) NOT NULL,
  whatsapp VARCHAR(20),
  email VARCHAR(200),
  address TEXT,
  gstin VARCHAR(15),
  is_gst_supplier BOOLEAN DEFAULT FALSE,
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  bank_name VARCHAR(100),
  bank_branch VARCHAR(100),
  default_credit_days INTEGER DEFAULT 30,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Purchase Orders table
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  delivery_charges DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'Ordered' CHECK (status IN ('Ordered', 'Partially Received', 'Received', 'Cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Purchase Order Lines table
CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost + gst_amount) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Receipts table (Goods Received Notes)
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  receipt_date DATE NOT NULL,
  delivery_charges DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'Received' CHECK (status IN ('Received', 'Partially Received')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Receipt Lines table
CREATE TABLE receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity_received DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity_received * unit_cost + gst_amount) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Sales Orders table
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_date DATE NOT NULL,
  delivery_address TEXT,
  expected_delivery_date DATE,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Confirmed', 'Partially Delivered', 'Delivered', 'Invoiced', 'Cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Sales Order Lines table
CREATE TABLE sales_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50), -- Reference to Tally invoice
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Stock Adjustments table (for manual stock changes)
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('In', 'Out')),
  quantity DECIMAL(10,2) NOT NULL,
  reason VARCHAR(200),
  reference_type VARCHAR(50), -- e.g., 'PO', 'Receipt', 'SO', 'Return', 'Manual'
  reference_id UUID,
  adjusted_by UUID REFERENCES auth.users(id), -- Supabase auth user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Returns table
CREATE TABLE customer_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  original_invoice_number VARCHAR(50), -- Reference to Tally invoice
  return_date DATE NOT NULL,
  resolution_type VARCHAR(20) NOT NULL CHECK (resolution_type IN ('Replacement', 'Refund', 'Credit Note')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Customer Return Lines table
CREATE TABLE customer_return_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_return_id UUID REFERENCES customer_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity_returned DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity_returned * unit_price) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Supplier Returns table
CREATE TABLE supplier_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  original_po_number VARCHAR(50),
  return_date DATE NOT NULL,
  resolution_type VARCHAR(20) NOT NULL CHECK (resolution_type IN ('Replacement', 'Refund', 'Credit Note')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Supplier Return Lines table
CREATE TABLE supplier_return_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_return_id UUID REFERENCES supplier_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity_returned DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity_returned * unit_cost) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  reminder_type VARCHAR(50) NOT NULL, -- e.g., 'low_stock', 'payment_due', 'follow_up', 'manual'
  related_entity_type VARCHAR(50), -- e.g., 'product', 'customer', 'so', 'po'
  related_entity_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  assigned_to VARCHAR(20) DEFAULT 'owner' CHECK (assigned_to IN ('owner', 'staff')),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH Time Zone DEFAULT NOW()
);

-- Company Settings table
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(200) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(200),
  gstin VARCHAR(15),
  pan VARCHAR(20),
  logo_url TEXT,
  default_due_days INTEGER DEFAULT 7,
  so_prefix VARCHAR(10) DEFAULT 'SO-',
  po_prefix VARCHAR(10) DEFAULT 'PO-',
  payment_prefix VARCHAR(10) DEFAULT 'PAY-',
  receipt_prefix VARCHAR(10) DEFAULT 'REC-',
  currency_symbol VARCHAR(10) DEFAULT '₹',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  digest_time TIME DEFAULT '08:00:00',
  customer_followup_days_30 INTEGER DEFAULT 30,
  customer_followup_days_60 INTEGER DEFAULT 60,
  customer_followup_days_90 INTEGER DEFAULT 90,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_products_segment ON products(segment_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sub_category ON products(sub_category_id);
CREATE INDEX idx_products_current_stock ON products(current_stock);
CREATE INDEX idx_products_is_deleted ON products(is_deleted);
CREATE INDEX idx_customers_is_gst ON customers(is_gst_customer);
CREATE INDEX idx_suppliers_is_gst ON suppliers(is_gst_supplier);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_po ON receipts(purchase_order_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_stock_adjustments_product ON stock_adjustments(product_id);
CREATE INDEX idx_reminders_due_date ON reminders(due_date);
CREATE INDEX idx_reminders_is_active ON reminders(is_active);
CREATE INDEX idx_reminders_assigned_to ON reminders(assigned_to);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
  tables TEXT[] := ARRAY['segments', 'categories', 'sub_categories', 'products', 'customers', 'suppliers',
                        'purchase_orders', 'purchase_order_lines', 'receipts', 'receipt_lines',
                        'sales_orders', 'sales_order_lines', 'payments', 'stock_adjustments',
                        'customer_returns', 'customer_return_lines', 'supplier_returns',
                        'supplier_return_lines', 'reminders', 'company_settings'];
  i INT;
BEGIN
  FOREACH i IN ARRAY tables
  LOOP
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column();
    ', i, i);
  END LOOP;
END $$;

-- Insert initial company settings
INSERT INTO company_settings (
  company_name, address, phone, email, gstin, pan,
  default_due_days, so_prefix, po_prefix, payment_prefix, receipt_prefix,
  currency_symbol, date_format, timezone, digest_time,
  customer_followup_days_30, customer_followup_days_60, customer_followup_days_90
) VALUES (
  'Rainbow Digital Solutions',
  '123 Park Street, Kolkata 700016',
  '+91 98765 43210',
  'info@rds.in',
  '19ABCDE1234F1Z5',
  'ABCDE1234F',
  7,
  'SO-',
  'PO-',
  'PAY-',
  'REC-',
  '₹',
  'DD/MM/YYYY',
  'Asia/Kolkata',
  '08:00:00',
  30,
  60,
  90
);
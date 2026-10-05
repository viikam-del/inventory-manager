-- Migration: Replace unconditional unique constraints with partial unique indexes on soft-deletable entities
-- This allows soft-deleted records (is_deleted = true) to free up their numbers/SKUs so new records do not collide.

-- 1. Drop unconditional constraints if they exist
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_so_number_key;
ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS receipts_receipt_number_key;
ALTER TABLE public.customer_returns DROP CONSTRAINT IF EXISTS customer_returns_return_number_key;
ALTER TABLE public.supplier_returns DROP CONSTRAINT IF EXISTS supplier_returns_return_number_key;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_number_key;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_code_key;

-- 2. Create partial unique indexes (active records only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_active_po_number ON public.purchase_orders (po_number) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_active_order_number ON public.sales_orders (order_number) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_active_receipt_number ON public.receipts (receipt_number) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_returns_active_return_number ON public.customer_returns (return_number) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_returns_active_return_number ON public.supplier_returns (return_number) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_payment_number ON public.payments (payment_number) WHERE is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_active_sku_code ON public.products (sku_code) WHERE is_deleted = false;

-- 3. Archive existing soft-deleted records with -DEL- suffix for defense in depth
UPDATE public.purchase_orders
SET po_number = po_number || '-DEL-' || substring(id::text, 1, 8)
WHERE is_deleted = true AND po_number IS NOT NULL AND po_number NOT LIKE '%-DEL-%';

UPDATE public.sales_orders
SET order_number = order_number || '-DEL-' || substring(id::text, 1, 8)
WHERE is_deleted = true AND order_number IS NOT NULL AND order_number NOT LIKE '%-DEL-%';

UPDATE public.receipts
SET receipt_number = receipt_number || '-DEL-' || substring(id::text, 1, 8)
WHERE is_deleted = true AND receipt_number IS NOT NULL AND receipt_number NOT LIKE '%-DEL-%';

UPDATE public.customer_returns
SET return_number = return_number || '-DEL-' || substring(id::text, 1, 8)
WHERE is_deleted = true AND return_number IS NOT NULL AND return_number NOT LIKE '%-DEL-%';

UPDATE public.supplier_returns
SET return_number = return_number || '-DEL-' || substring(id::text, 1, 8)
WHERE is_deleted = true AND return_number IS NOT NULL AND return_number NOT LIKE '%-DEL-%';

UPDATE public.payments
SET payment_number = payment_number || '-DEL-' || substring(id::text, 1, 8)
WHERE is_deleted = true AND payment_number IS NOT NULL AND payment_number NOT LIKE '%-DEL-%';

UPDATE public.products
SET sku_code = sku_code || '-DEL-' || substring(id::text, 1, 8)
WHERE is_deleted = true AND sku_code IS NOT NULL AND sku_code NOT LIKE '%-DEL-%';

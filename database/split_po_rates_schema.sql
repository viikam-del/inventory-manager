-- Migration: Add split commercial rates (billed_rate, cash_rate) to purchase order lines and receipt lines
-- Enables decoupled physical vs commercial valuation (1 physical quantity, split bill/cash valuation)

ALTER TABLE public.purchase_order_lines
ADD COLUMN IF NOT EXISTS billed_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_rate numeric DEFAULT 0;

UPDATE public.purchase_order_lines
SET billed_rate = CASE WHEN is_billed = true THEN COALESCE(unit_cost, 0) ELSE 0 END,
    cash_rate = CASE WHEN is_billed = false THEN COALESCE(unit_cost, 0) ELSE 0 END
WHERE (billed_rate IS NULL OR billed_rate = 0) AND (cash_rate IS NULL OR cash_rate = 0);

ALTER TABLE public.receipt_lines
ADD COLUMN IF NOT EXISTS billed_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_rate numeric DEFAULT 0;

UPDATE public.receipt_lines
SET billed_rate = CASE WHEN is_billed = true THEN COALESCE(unit_cost, 0) ELSE 0 END,
    cash_rate = CASE WHEN is_billed = false THEN COALESCE(unit_cost, 0) ELSE 0 END
WHERE (billed_rate IS NULL OR billed_rate = 0) AND (cash_rate IS NULL OR cash_rate = 0);

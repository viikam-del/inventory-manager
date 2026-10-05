-- Run this script in the Supabase SQL Editor to create the audit_logs table

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,          -- 'sales_order' | 'product' | 'customer' | 'payment' | 'stock_adjustment'
    entity_id uuid NOT NULL,
    action text NOT NULL,               -- 'create' | 'update' | 'delete' | 'fulfill' | 'restock' | 'adjust_stock'
    actor_name text,
    actor_email text,
    changes jsonb,                      -- {"field": {"old": val, "new": val}}
    metadata jsonb,                     -- extra context (e.g. quantity, stock_delta, note)
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optimize querying by entity, action, and chronological ordering
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies matching the rest of the tables (anon & authenticated allowed for internal ERP use)
CREATE POLICY "Enable all access for authenticated users" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for anon users" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);

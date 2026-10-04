-- Run this script in the Supabase SQL Editor to create the reminders table

CREATE TABLE IF NOT EXISTS public.reminders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL DEFAULT 'Manual',
    title text NOT NULL,
    description text,
    reference_type text DEFAULT 'Manual',
    reference_id uuid,
    whatsapp_number text,
    whatsapp_template text,
    priority text NOT NULL DEFAULT 'Medium',
    status text NOT NULL DEFAULT 'Pending',
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add some basic indexes to optimize querying by status and type
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_reminders_type ON public.reminders(type) WHERE is_deleted = false;

-- Enable Row Level Security (RLS)
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Note: In this project, many tables have RLS enabled but are accessible to anon/authenticated.
-- Below are basic policies assuming anon and authenticated can perform CRU operations.
CREATE POLICY "Enable all access for authenticated users" ON public.reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for anon users" ON public.reminders FOR ALL TO anon USING (true) WITH CHECK (true);

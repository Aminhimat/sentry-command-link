-- Add logo_url column to companies table
ALTER TABLE public.companies 
ADD COLUMN logo_url TEXT;
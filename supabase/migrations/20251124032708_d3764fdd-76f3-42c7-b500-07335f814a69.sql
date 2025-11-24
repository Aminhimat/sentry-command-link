-- Add location_address column to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS location_address TEXT;
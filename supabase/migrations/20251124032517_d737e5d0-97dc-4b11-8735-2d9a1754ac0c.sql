-- Add missing columns to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add foreign key for assigned_property_id in profiles
ALTER TABLE public.profiles
ADD CONSTRAINT fk_assigned_property
FOREIGN KEY (assigned_property_id) 
REFERENCES public.properties(id) 
ON DELETE SET NULL;
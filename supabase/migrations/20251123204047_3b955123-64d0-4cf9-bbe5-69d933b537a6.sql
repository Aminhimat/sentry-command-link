-- Add missing columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_admin_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS login_location_lat NUMERIC,
ADD COLUMN IF NOT EXISTS login_location_lng NUMERIC,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS assigned_property_id UUID;

-- Add missing columns to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add missing columns to guard_reports table (rename images to image_url for consistency)
ALTER TABLE public.guard_reports
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add missing columns to checkpoints table
ALTER TABLE public.checkpoints
ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add missing columns to guard_locations table
ALTER TABLE public.guard_locations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add missing columns to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Add missing columns to guard_shifts table
ALTER TABLE public.guard_shifts
ADD COLUMN IF NOT EXISTS property_id UUID,
ADD COLUMN IF NOT EXISTS hourly_report TEXT;

-- Create trigger for guard_locations updated_at
DROP TRIGGER IF EXISTS update_guard_locations_updated_at ON public.guard_locations;
CREATE TRIGGER update_guard_locations_updated_at
  BEFORE UPDATE ON public.guard_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
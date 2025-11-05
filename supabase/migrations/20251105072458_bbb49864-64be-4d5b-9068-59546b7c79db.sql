-- Add location tracking and approval columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS login_location_lat numeric,
ADD COLUMN IF NOT EXISTS login_location_lng numeric,
ADD COLUMN IF NOT EXISTS requires_admin_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_reason text;

-- Create index for faster queries on guards requiring approval
CREATE INDEX IF NOT EXISTS idx_profiles_requires_approval 
ON public.profiles(requires_admin_approval, company_id) 
WHERE requires_admin_approval = true;
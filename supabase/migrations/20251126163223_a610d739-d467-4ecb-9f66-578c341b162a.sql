-- Fix infinite recursion in profiles RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Company admins can manage their company profiles" ON public.profiles;

-- Create a security definer function to check company admin status
-- This bypasses RLS to prevent recursion
CREATE OR REPLACE FUNCTION public.is_company_admin_for_profile(profile_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'company_admin'
    AND company_id = profile_company_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Company admins can manage their company profiles" 
ON public.profiles 
FOR ALL 
USING (
  public.is_company_admin_for_profile(company_id)
);

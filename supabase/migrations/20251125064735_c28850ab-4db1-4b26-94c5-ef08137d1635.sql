-- Fix RLS policy for company admins to view their guards
DROP POLICY IF EXISTS "Company admins can manage their company profiles" ON public.profiles;

CREATE POLICY "Company admins can manage their company profiles" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS admin_profile
    WHERE admin_profile.user_id = auth.uid()
    AND admin_profile.role = 'company_admin'
    AND admin_profile.company_id = profiles.company_id
  )
);
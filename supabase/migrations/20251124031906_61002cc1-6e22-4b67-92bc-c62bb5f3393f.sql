-- Create security definer function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Company admins can manage their company profiles" ON public.profiles;

-- Recreate without self-referencing profiles table
CREATE POLICY "Company admins can manage their company profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'company_admin'::user_role)
  AND company_id = public.get_user_company_id(auth.uid())
);
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Company admins can manage their company's profiles" ON public.profiles;
DROP POLICY IF EXISTS "Platform admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Guards can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Guards can view their own profile" ON public.profiles;

-- Recreate the get_user_role function with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- Create new non-recursive policies
CREATE POLICY "Platform admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'platform_admin'::user_role);

CREATE POLICY "Company admins can manage their company's profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  public.get_user_role(auth.uid()) = 'company_admin'::user_role
  AND company_id IN (
    SELECT p.company_id 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Guards can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Guards can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
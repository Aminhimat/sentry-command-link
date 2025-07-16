-- First drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Company admins can manage their company's profiles" ON public.profiles;
DROP POLICY IF EXISTS "Guards can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Guards can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Platform admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can manage their company profiles" ON public.profiles;

-- Create helper functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id 
  FROM public.profiles 
  WHERE user_id = auth.uid();
$$;

-- Recreate policies with non-recursive logic
CREATE POLICY "Platform admins full access" 
ON public.profiles 
FOR ALL 
USING (public.is_platform_admin());

CREATE POLICY "Company admins company access" 
ON public.profiles 
FOR ALL 
USING (
  company_id = public.get_user_company_id() 
  AND public.get_user_role(auth.uid()) = 'company_admin'
);

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());
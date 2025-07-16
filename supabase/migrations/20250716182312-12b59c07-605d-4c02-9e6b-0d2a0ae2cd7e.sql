-- Fix the infinite recursion issue in RLS policies by using a different approach

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Company admins can manage their company's profiles" ON public.profiles;
DROP POLICY IF EXISTS "Platform admins can manage all profiles" ON public.profiles;

-- Create a simple function to check if user is platform admin
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

-- Create a function to get user's company_id
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

-- Recreate policies with proper logic to avoid recursion
CREATE POLICY "Platform admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (public.is_platform_admin());

CREATE POLICY "Company admins can manage their company profiles" 
ON public.profiles 
FOR ALL 
USING (
  NOT public.is_platform_admin() 
  AND company_id = public.get_user_company_id() 
  AND public.get_user_role(auth.uid()) = 'company_admin'
);

CREATE POLICY "Guards can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Guards can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());
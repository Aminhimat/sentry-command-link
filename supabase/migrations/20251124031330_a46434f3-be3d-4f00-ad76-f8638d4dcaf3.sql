-- Create user_roles table using existing user_role enum
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Create security definer function to check roles (non-recursive)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get primary role
CREATE OR REPLACE FUNCTION public.get_primary_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'platform_admin' THEN 1
      WHEN 'company_admin' THEN 2
      WHEN 'guard' THEN 3
    END
  LIMIT 1
$$;

-- Drop and recreate profiles RLS policies using the new has_role function
DROP POLICY IF EXISTS "Platform admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can manage their company's profiles" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can manage their company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Guards can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Guards can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- New non-recursive policies for profiles
CREATE POLICY "Platform admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::user_role));

CREATE POLICY "Company admins can manage their company profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'company_admin'::user_role)
  AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policies for user_roles table
CREATE POLICY "Platform admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::user_role));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
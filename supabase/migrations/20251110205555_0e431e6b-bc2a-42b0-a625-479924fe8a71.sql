-- 1) Create a safe mapping table to avoid recursion when policies need company_id
CREATE TABLE IF NOT EXISTS public.user_companies (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id)
);

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Allow users to read only their own mapping (optional, safe default)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_companies' AND policyname='Users can view own company mapping'
  ) THEN
    CREATE POLICY "Users can view own company mapping"
    ON public.user_companies
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- 2) Backfill from profiles once
INSERT INTO public.user_companies (user_id, company_id)
SELECT p.user_id, p.company_id
FROM public.profiles p
WHERE p.company_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

-- 3) Keep in sync via trigger
CREATE OR REPLACE FUNCTION public.sync_user_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO public.user_companies (user_id, company_id)
    VALUES (NEW.user_id, NEW.company_id)
    ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_company ON public.profiles;
CREATE TRIGGER trg_sync_user_company
AFTER INSERT OR UPDATE OF company_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_user_company();

-- 4) Replace helper functions to avoid referencing profiles
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
$$;

-- get_user_role now derives from user_roles only to avoid recursion
-- Prioritize platform_admin > company_admin > guard
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE role
               WHEN 'platform_admin' THEN 'platform_admin'::user_role
               WHEN 'company_admin'  THEN 'company_admin'::user_role
               WHEN 'guard'          THEN 'guard'::user_role
             END
      FROM public.user_roles
      WHERE user_id = _user_id
      ORDER BY 
        CASE role
          WHEN 'platform_admin' THEN 1
          WHEN 'company_admin'  THEN 2
          WHEN 'guard'          THEN 3
          ELSE 99
        END
      LIMIT 1
    ),
    'guard'::user_role
  );
$$;

-- 5) Drop problematic self-referencing UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile limited fields" ON public.profiles;
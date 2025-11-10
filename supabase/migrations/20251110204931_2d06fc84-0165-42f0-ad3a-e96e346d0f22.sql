-- Drop the restrictive policy that blocks company admins
DROP POLICY IF EXISTS "Users can update limited profile fields" ON public.profiles;

-- Create a new policy that only applies to users updating their own profile
CREATE POLICY "Users can update own profile limited fields" 
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
  AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  AND is_active = (SELECT is_active FROM public.profiles WHERE user_id = auth.uid())
);
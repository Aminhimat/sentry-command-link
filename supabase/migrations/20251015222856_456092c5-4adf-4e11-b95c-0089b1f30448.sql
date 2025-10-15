-- Add username column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username text;

-- Add a unique constraint to ensure usernames are unique within a company
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_company_unique 
ON public.profiles(username, company_id) 
WHERE username IS NOT NULL;
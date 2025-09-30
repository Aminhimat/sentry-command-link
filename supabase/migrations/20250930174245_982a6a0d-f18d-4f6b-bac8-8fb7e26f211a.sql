-- Add column to track if user needs to change password
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT FALSE;
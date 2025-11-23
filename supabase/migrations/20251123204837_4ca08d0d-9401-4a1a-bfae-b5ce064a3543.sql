-- Update the platform admin user role
UPDATE public.profiles 
SET role = 'platform_admin'::user_role,
    first_name = 'Ja',
    last_name = 'khan'
WHERE user_id = '48d8924b-e4df-4f21-8ff8-adbf72fd42a7';
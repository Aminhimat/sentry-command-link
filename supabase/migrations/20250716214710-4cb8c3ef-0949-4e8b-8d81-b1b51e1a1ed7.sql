-- Update the user's metadata to remove the must_change_password flag
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{must_change_password}',
  'false'::jsonb
)
WHERE email = 'ariastanikzai28@gmail.com';
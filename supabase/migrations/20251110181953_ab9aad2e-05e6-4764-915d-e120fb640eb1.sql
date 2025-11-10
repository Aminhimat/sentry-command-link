-- Add allow_concurrent_login field to device_logins table
ALTER TABLE public.device_logins 
ADD COLUMN allow_concurrent_login boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.device_logins.allow_concurrent_login IS 'Whether this device is allowed to login concurrently with other devices';
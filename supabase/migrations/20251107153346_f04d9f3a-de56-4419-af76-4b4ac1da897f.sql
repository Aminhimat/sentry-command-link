-- Create device_logins table
CREATE TABLE public.device_logins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id uuid NOT NULL,
  guard_name text NOT NULL,
  device_id text NOT NULL UNIQUE,
  device_model text,
  device_os text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.device_logins ENABLE ROW LEVEL SECURITY;

-- Company admins can view and manage their guards' devices
CREATE POLICY "Company admins can manage their guards' devices"
ON public.device_logins
FOR ALL
USING (
  guard_id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.company_id IN (
      SELECT company_id
      FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'company_admin'
    )
  )
);

-- Guards can view their own devices
CREATE POLICY "Guards can view their own devices"
ON public.device_logins
FOR SELECT
USING (
  guard_id IN (
    SELECT id
    FROM profiles
    WHERE user_id = auth.uid()
  )
);

-- Guards can insert their own devices
CREATE POLICY "Guards can insert their own devices"
ON public.device_logins
FOR INSERT
WITH CHECK (
  guard_id IN (
    SELECT id
    FROM profiles
    WHERE user_id = auth.uid()
  )
);

-- Platform admins can manage all devices
CREATE POLICY "Platform admins can manage all devices"
ON public.device_logins
FOR ALL
USING (get_user_role(auth.uid()) = 'platform_admin');

-- Create updated_at trigger
CREATE TRIGGER update_device_logins_updated_at
BEFORE UPDATE ON public.device_logins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_device_logins_guard_id ON public.device_logins(guard_id);
CREATE INDEX idx_device_logins_device_id ON public.device_logins(device_id);
CREATE INDEX idx_device_logins_approved ON public.device_logins(approved);
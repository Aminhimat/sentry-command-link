-- Create guard_locations table for real-time location tracking
CREATE TABLE public.guard_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL,
  guard_id UUID NOT NULL,
  company_id UUID NOT NULL,
  location_lat NUMERIC NOT NULL,
  location_lng NUMERIC NOT NULL,
  location_address TEXT,
  battery_level INTEGER,
  accuracy NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.guard_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for guard_locations
CREATE POLICY "Company admins can view their company's guard locations" 
ON public.guard_locations 
FOR SELECT 
USING (company_id IN (
  SELECT profiles.company_id
  FROM profiles
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'company_admin'::user_role
));

CREATE POLICY "Guards can insert their own locations" 
ON public.guard_locations 
FOR INSERT 
WITH CHECK (guard_id IN (
  SELECT profiles.id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Guards can update their own locations" 
ON public.guard_locations 
FOR UPDATE 
USING (guard_id IN (
  SELECT profiles.id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Platform admins can view all guard locations" 
ON public.guard_locations 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'platform_admin'::user_role);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_guard_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  return NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_guard_locations_updated_at
  BEFORE UPDATE ON public.guard_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_guard_locations_updated_at();

-- Enable realtime for guard_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.guard_locations;
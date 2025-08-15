-- Create properties table for site management
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  location_address TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create policies for property access
CREATE POLICY "Platform admins can manage all properties" 
ON public.properties 
FOR ALL 
USING (get_user_role(auth.uid()) = 'platform_admin'::user_role);

CREATE POLICY "Company admins can manage their company's properties" 
ON public.properties 
FOR ALL 
USING (company_id IN ( 
  SELECT profiles.company_id
  FROM profiles
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'company_admin'::user_role
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create checkpoints table for QR code patrol points
CREATE TABLE public.checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_address TEXT,
  qr_code_data TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkpoint_scans table to log when guards scan checkpoints
CREATE TABLE public.checkpoint_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkpoint_id UUID NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL,
  company_id UUID NOT NULL,
  shift_id UUID REFERENCES public.guard_shifts(id) ON DELETE SET NULL,
  scan_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_address TEXT,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checkpoints
CREATE POLICY "Company admins can manage their company's checkpoints"
ON public.checkpoints
FOR ALL
USING (company_id IN (
  SELECT company_id FROM profiles 
  WHERE user_id = auth.uid() AND role = 'company_admin'
));

CREATE POLICY "Guards can view their company's active checkpoints"
ON public.checkpoints
FOR SELECT
USING (
  is_active = true AND
  company_id IN (
    SELECT company_id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'guard'
  )
);

CREATE POLICY "Platform admins can manage all checkpoints"
ON public.checkpoints
FOR ALL
USING (get_user_role(auth.uid()) = 'platform_admin');

-- RLS Policies for checkpoint_scans
CREATE POLICY "Company admins can view their company's checkpoint scans"
ON public.checkpoint_scans
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM profiles 
  WHERE user_id = auth.uid() AND role = 'company_admin'
));

CREATE POLICY "Guards can insert their own checkpoint scans"
ON public.checkpoint_scans
FOR INSERT
WITH CHECK (guard_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Guards can view their own checkpoint scans"
ON public.checkpoint_scans
FOR SELECT
USING (guard_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Platform admins can view all checkpoint scans"
ON public.checkpoint_scans
FOR SELECT
USING (get_user_role(auth.uid()) = 'platform_admin');

-- Create indexes for better performance
CREATE INDEX idx_checkpoints_company_id ON public.checkpoints(company_id);
CREATE INDEX idx_checkpoints_property_id ON public.checkpoints(property_id);
CREATE INDEX idx_checkpoints_qr_code_data ON public.checkpoints(qr_code_data);
CREATE INDEX idx_checkpoint_scans_checkpoint_id ON public.checkpoint_scans(checkpoint_id);
CREATE INDEX idx_checkpoint_scans_guard_id ON public.checkpoint_scans(guard_id);
CREATE INDEX idx_checkpoint_scans_company_id ON public.checkpoint_scans(company_id);
CREATE INDEX idx_checkpoint_scans_scan_time ON public.checkpoint_scans(scan_time);

-- Add trigger for updated_at on checkpoints
CREATE TRIGGER update_checkpoints_updated_at
BEFORE UPDATE ON public.checkpoints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
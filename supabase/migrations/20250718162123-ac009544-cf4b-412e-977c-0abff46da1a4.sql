-- Create storage bucket for guard reports
INSERT INTO storage.buckets (id, name, public) VALUES ('guard-reports', 'guard-reports', true);

-- Create guard_reports table
CREATE TABLE public.guard_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES profiles(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  shift_id UUID REFERENCES guard_shifts(id),
  report_text TEXT,
  image_url TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guard_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for guard_reports
CREATE POLICY "Guards can manage their own reports" 
ON public.guard_reports 
FOR ALL 
USING (guard_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins can view their company's reports" 
ON public.guard_reports 
FOR SELECT 
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'));

CREATE POLICY "Platform admins can view all reports" 
ON public.guard_reports 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'platform_admin');

-- Storage policies for guard-reports bucket
CREATE POLICY "Guards can upload their own reports" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'guard-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Guards can view their own uploaded reports" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'guard-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Company admins can view their company's reports" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'guard-reports');

CREATE POLICY "Platform admins can view all guard reports" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'guard-reports');

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_guard_reports_updated_at
BEFORE UPDATE ON public.guard_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
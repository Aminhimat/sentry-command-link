-- Create properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkpoints table
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location_address TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  qr_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkpoint_scans table
CREATE TABLE IF NOT EXISTS public.checkpoint_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkpoint_id UUID NOT NULL,
  guard_id UUID NOT NULL,
  company_id UUID NOT NULL,
  shift_id UUID,
  property_id UUID,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guard_reports table
CREATE TABLE IF NOT EXISTS public.guard_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL,
  company_id UUID NOT NULL,
  shift_id UUID,
  property_id UUID,
  report_type TEXT,
  description TEXT,
  images TEXT[],
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guard_locations table
CREATE TABLE IF NOT EXISTS public.guard_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL,
  location_lat NUMERIC NOT NULL,
  location_lng NUMERIC NOT NULL,
  location_address TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled_shifts table
CREATE TABLE IF NOT EXISTS public.scheduled_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  guard_id UUID NOT NULL,
  property_id UUID NOT NULL,
  shift_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guard_login_constraints table
CREATE TABLE IF NOT EXISTS public.guard_login_constraints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL UNIQUE,
  login_location_lat NUMERIC,
  login_location_lng NUMERIC,
  max_distance_miles NUMERIC DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  guard_id UUID,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_login_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for properties
CREATE POLICY "Company admins can manage their properties" ON public.properties
  FOR ALL USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

CREATE POLICY "Guards can view their company properties" ON public.properties
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Platform admins can view all properties" ON public.properties
  FOR SELECT USING (get_user_role(auth.uid()) = 'platform_admin');

-- Create RLS policies for checkpoints
CREATE POLICY "Company admins can manage checkpoints" ON public.checkpoints
  FOR ALL USING (property_id IN (
    SELECT id FROM properties WHERE company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
    )
  ));

CREATE POLICY "Guards can view checkpoints" ON public.checkpoints
  FOR SELECT USING (property_id IN (
    SELECT id FROM properties WHERE company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Create RLS policies for checkpoint_scans
CREATE POLICY "Company admins can view their checkpoint scans" ON public.checkpoint_scans
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

CREATE POLICY "Guards can manage their own checkpoint scans" ON public.checkpoint_scans
  FOR ALL USING (guard_id = auth.uid());

-- Create RLS policies for guard_reports
CREATE POLICY "Company admins can manage their reports" ON public.guard_reports
  FOR ALL USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

CREATE POLICY "Guards can manage their own reports" ON public.guard_reports
  FOR ALL USING (guard_id = auth.uid());

CREATE POLICY "Platform admins can view all reports" ON public.guard_reports
  FOR SELECT USING (get_user_role(auth.uid()) = 'platform_admin');

-- Create RLS policies for guard_locations
CREATE POLICY "Company admins can view their guard locations" ON public.guard_locations
  FOR SELECT USING (guard_id IN (
    SELECT user_id FROM profiles WHERE company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
    )
  ));

CREATE POLICY "Guards can insert their own locations" ON public.guard_locations
  FOR INSERT WITH CHECK (guard_id = auth.uid());

-- Create RLS policies for scheduled_shifts
CREATE POLICY "Company admins can manage their scheduled shifts" ON public.scheduled_shifts
  FOR ALL USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

CREATE POLICY "Guards can view their scheduled shifts" ON public.scheduled_shifts
  FOR SELECT USING (guard_id = auth.uid());

-- Create RLS policies for guard_login_constraints
CREATE POLICY "Company admins can manage login constraints" ON public.guard_login_constraints
  FOR ALL USING (guard_id IN (
    SELECT user_id FROM profiles WHERE company_id IN (
      SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
    )
  ));

CREATE POLICY "Guards can view their own constraints" ON public.guard_login_constraints
  FOR SELECT USING (guard_id = auth.uid());

-- Create RLS policies for admin_notifications
CREATE POLICY "Company admins can manage their notifications" ON public.admin_notifications
  FOR ALL USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

CREATE POLICY "Platform admins can view all notifications" ON public.admin_notifications
  FOR SELECT USING (get_user_role(auth.uid()) = 'platform_admin');

-- Create triggers for updated_at
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checkpoints_updated_at
  BEFORE UPDATE ON public.checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guard_reports_updated_at
  BEFORE UPDATE ON public.guard_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_shifts_updated_at
  BEFORE UPDATE ON public.scheduled_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guard_login_constraints_updated_at
  BEFORE UPDATE ON public.guard_login_constraints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
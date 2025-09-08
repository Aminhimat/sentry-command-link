-- Create scheduled_shifts table for admin to set active periods for guards
CREATE TABLE public.scheduled_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  guard_id UUID NULL, -- Can be assigned later
  property_id UUID NULL,
  shift_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  recurring_days INTEGER[] NULL, -- Array of weekdays: 0=Sunday, 1=Monday, etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scheduled_shifts ENABLE ROW LEVEL SECURITY;

-- Create policies for scheduled_shifts
CREATE POLICY "Company admins can manage their company's scheduled shifts" 
ON public.scheduled_shifts 
FOR ALL 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Guards can view their assigned scheduled shifts" 
ON public.scheduled_shifts 
FOR SELECT 
USING (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = auth.uid())));

CREATE POLICY "Platform admins can manage all scheduled shifts" 
ON public.scheduled_shifts 
FOR ALL 
USING (get_user_role(auth.uid()) = 'platform_admin'::user_role);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scheduled_shifts_updated_at
BEFORE UPDATE ON public.scheduled_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
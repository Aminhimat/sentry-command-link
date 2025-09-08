-- Create guard_login_constraints table for login period restrictions
CREATE TABLE public.guard_login_constraints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL,
  company_id UUID NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  duration_hours NUMERIC NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guard_id) -- Only one constraint per guard
);

-- Enable Row Level Security
ALTER TABLE public.guard_login_constraints ENABLE ROW LEVEL SECURITY;

-- Create policies for guard_login_constraints
CREATE POLICY "Company admins can manage their company's guard constraints" 
ON public.guard_login_constraints 
FOR ALL 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Guards can view their own login constraints" 
ON public.guard_login_constraints 
FOR SELECT 
USING (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = auth.uid())));

CREATE POLICY "Platform admins can manage all guard constraints" 
ON public.guard_login_constraints 
FOR ALL 
USING (get_user_role(auth.uid()) = 'platform_admin'::user_role);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_guard_login_constraints_updated_at
BEFORE UPDATE ON public.guard_login_constraints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('platform_admin', 'company_admin', 'guard');

-- Create enum for company status
CREATE TYPE public.company_status AS ENUM ('active', 'inactive', 'suspended');

-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  license_limit INTEGER NOT NULL DEFAULT 10,
  status company_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'guard',
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT CHECK (status IN ('open', 'investigating', 'resolved', 'closed')) DEFAULT 'open',
  location_lat DECIMAL,
  location_lng DECIMAL,
  location_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guard_shifts table for tracking check-ins/outs
CREATE TABLE public.guard_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_out_time TIMESTAMP WITH TIME ZONE,
  location_lat DECIMAL,
  location_lng DECIMAL,
  location_address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_shifts ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- RLS Policies for companies table
CREATE POLICY "Platform admins can manage all companies"
ON public.companies
FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'platform_admin');

CREATE POLICY "Company admins can view their own company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND company_id = companies.id 
    AND role = 'company_admin'
  )
);

-- RLS Policies for profiles table
CREATE POLICY "Platform admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.get_user_role(auth.uid()) = 'platform_admin');

CREATE POLICY "Company admins can manage their company's profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'company_admin'
  )
);

CREATE POLICY "Guards can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Guards can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for incidents table
CREATE POLICY "Platform admins can view all incidents"
ON public.incidents
FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'platform_admin');

CREATE POLICY "Company admins can manage their company's incidents"
ON public.incidents
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'company_admin'
  )
);

CREATE POLICY "Guards can manage their own incidents"
ON public.incidents
FOR ALL
TO authenticated
USING (guard_id = auth.uid());

-- RLS Policies for guard_shifts table
CREATE POLICY "Platform admins can view all shifts"
ON public.guard_shifts
FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'platform_admin');

CREATE POLICY "Company admins can manage their company's shifts"
ON public.guard_shifts
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'company_admin'
  )
);

CREATE POLICY "Guards can manage their own shifts"
ON public.guard_shifts
FOR ALL
TO authenticated
USING (guard_id = auth.uid());

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'guard')::user_role
  );
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guard_shifts_updated_at
BEFORE UPDATE ON public.guard_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
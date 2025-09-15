-- Optimize RLS policies for better performance by using SELECT subqueries for auth functions

-- Drop and recreate companies policies
DROP POLICY IF EXISTS "Platform admins can manage all companies" ON public.companies;
DROP POLICY IF EXISTS "Company admins can view their own company" ON public.companies;
DROP POLICY IF EXISTS "Company admins can update their own company" ON public.companies;

CREATE POLICY "Platform admins can manage all companies" 
ON public.companies 
FOR ALL 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);

CREATE POLICY "Company admins can view their own company" 
ON public.companies 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.company_id = companies.id) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Company admins can update their own company" 
ON public.companies 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.company_id = companies.id) AND (profiles.role = 'company_admin'::user_role))))
WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.company_id = companies.id) AND (profiles.role = 'company_admin'::user_role))));

-- Drop and recreate incidents policies
DROP POLICY IF EXISTS "Platform admins can view all incidents" ON public.incidents;
DROP POLICY IF EXISTS "Company admins can manage their company's incidents" ON public.incidents;
DROP POLICY IF EXISTS "Guards can manage their own incidents" ON public.incidents;

CREATE POLICY "Platform admins can view all incidents" 
ON public.incidents 
FOR SELECT 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);

CREATE POLICY "Company admins can manage their company's incidents" 
ON public.incidents 
FOR ALL 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Guards can manage their own incidents" 
ON public.incidents 
FOR ALL 
USING (guard_id = (select auth.uid()));

-- Drop and recreate guard_shifts policies
DROP POLICY IF EXISTS "Platform admins can view all shifts" ON public.guard_shifts;
DROP POLICY IF EXISTS "Company admins can manage their company's shifts" ON public.guard_shifts;
DROP POLICY IF EXISTS "Guards can manage their own shifts" ON public.guard_shifts;

CREATE POLICY "Platform admins can view all shifts" 
ON public.guard_shifts 
FOR SELECT 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);

CREATE POLICY "Company admins can manage their company's shifts" 
ON public.guard_shifts 
FOR ALL 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Guards can manage their own shifts" 
ON public.guard_shifts 
FOR ALL 
USING (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))));

-- Drop and recreate profiles policies
DROP POLICY IF EXISTS "Platform admins full access" ON public.profiles;
DROP POLICY IF EXISTS "Company admins company access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Platform admins full access" 
ON public.profiles 
FOR ALL 
USING (is_platform_admin());

CREATE POLICY "Company admins company access" 
ON public.profiles 
FOR ALL 
USING ((company_id = get_user_company_id()) AND (get_user_role((select auth.uid())) = 'company_admin'::user_role));

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- Drop and recreate guard_reports policies
DROP POLICY IF EXISTS "Guards can manage their own reports" ON public.guard_reports;
DROP POLICY IF EXISTS "Company admins can view their company's reports" ON public.guard_reports;
DROP POLICY IF EXISTS "Platform admins can view all reports" ON public.guard_reports;

CREATE POLICY "Guards can manage their own reports" 
ON public.guard_reports 
FOR ALL 
USING (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))));

CREATE POLICY "Company admins can view their company's reports" 
ON public.guard_reports 
FOR SELECT 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Platform admins can view all reports" 
ON public.guard_reports 
FOR SELECT 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);

-- Drop and recreate properties policies
DROP POLICY IF EXISTS "Guards can view their company's properties" ON public.properties;
DROP POLICY IF EXISTS "Platform admins can manage all properties" ON public.properties;
DROP POLICY IF EXISTS "Company admins can manage their company's properties" ON public.properties;

CREATE POLICY "Guards can view their company's properties" 
ON public.properties 
FOR SELECT 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'guard'::user_role))));

CREATE POLICY "Platform admins can manage all properties" 
ON public.properties 
FOR ALL 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);

CREATE POLICY "Company admins can manage their company's properties" 
ON public.properties 
FOR ALL 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'company_admin'::user_role))));

-- Drop and recreate pdf_generation_status policies
DROP POLICY IF EXISTS "Users can view their own PDF generation status" ON public.pdf_generation_status;
DROP POLICY IF EXISTS "System can insert PDF generation status" ON public.pdf_generation_status;
DROP POLICY IF EXISTS "System can update PDF generation status" ON public.pdf_generation_status;

CREATE POLICY "Users can view their own PDF generation status" 
ON public.pdf_generation_status 
FOR SELECT 
USING ((select auth.uid()) = user_id);

CREATE POLICY "System can insert PDF generation status" 
ON public.pdf_generation_status 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update PDF generation status" 
ON public.pdf_generation_status 
FOR UPDATE 
USING (true);

-- Drop and recreate guard_locations policies
DROP POLICY IF EXISTS "Company admins can view their company's guard locations" ON public.guard_locations;
DROP POLICY IF EXISTS "Guards can insert their own locations" ON public.guard_locations;
DROP POLICY IF EXISTS "Guards can update their own locations" ON public.guard_locations;
DROP POLICY IF EXISTS "Platform admins can view all guard locations" ON public.guard_locations;

CREATE POLICY "Company admins can view their company's guard locations" 
ON public.guard_locations 
FOR SELECT 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Guards can insert their own locations" 
ON public.guard_locations 
FOR INSERT 
WITH CHECK (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))));

CREATE POLICY "Guards can update their own locations" 
ON public.guard_locations 
FOR UPDATE 
USING (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))));

CREATE POLICY "Platform admins can view all guard locations" 
ON public.guard_locations 
FOR SELECT 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);

-- Drop and recreate scheduled_shifts policies
DROP POLICY IF EXISTS "Company admins can manage their company's scheduled shifts" ON public.scheduled_shifts;
DROP POLICY IF EXISTS "Guards can view their assigned scheduled shifts" ON public.scheduled_shifts;
DROP POLICY IF EXISTS "Platform admins can manage all scheduled shifts" ON public.scheduled_shifts;

CREATE POLICY "Company admins can manage their company's scheduled shifts" 
ON public.scheduled_shifts 
FOR ALL 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Guards can view their assigned scheduled shifts" 
ON public.scheduled_shifts 
FOR SELECT 
USING (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))));

CREATE POLICY "Platform admins can manage all scheduled shifts" 
ON public.scheduled_shifts 
FOR ALL 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);

-- Drop and recreate guard_login_constraints policies
DROP POLICY IF EXISTS "Company admins can manage their company's guard constraints" ON public.guard_login_constraints;
DROP POLICY IF EXISTS "Guards can view their own login constraints" ON public.guard_login_constraints;
DROP POLICY IF EXISTS "Platform admins can manage all guard constraints" ON public.guard_login_constraints;

CREATE POLICY "Company admins can manage their company's guard constraints" 
ON public.guard_login_constraints 
FOR ALL 
USING (company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.role = 'company_admin'::user_role))));

CREATE POLICY "Guards can view their own login constraints" 
ON public.guard_login_constraints 
FOR SELECT 
USING (guard_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))));

CREATE POLICY "Platform admins can manage all guard constraints" 
ON public.guard_login_constraints 
FOR ALL 
USING (get_user_role((select auth.uid())) = 'platform_admin'::user_role);
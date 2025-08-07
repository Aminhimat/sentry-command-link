-- Add RLS policy to allow company admins to update their own company
CREATE POLICY "Company admins can update their own company" 
ON public.companies 
FOR UPDATE 
USING (EXISTS ( 
  SELECT 1
  FROM profiles
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = companies.id 
  AND profiles.role = 'company_admin'::user_role
))
WITH CHECK (EXISTS ( 
  SELECT 1
  FROM profiles
  WHERE profiles.user_id = auth.uid() 
  AND profiles.company_id = companies.id 
  AND profiles.role = 'company_admin'::user_role
));
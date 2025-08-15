-- Add RLS policy to allow guards to view properties from their company
CREATE POLICY "Guards can view their company's properties" 
ON public.properties 
FOR SELECT 
USING (
  company_id IN (
    SELECT profiles.company_id
    FROM profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'guard'::user_role
  )
);
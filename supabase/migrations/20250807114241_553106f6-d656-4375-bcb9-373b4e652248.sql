-- Create policy for company admins to upload logos
CREATE POLICY "Company admins can upload logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'guard-reports' 
  AND auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'company_admin'
    AND company_id::text = (storage.foldername(name))[1]
  )
);

-- Create policy for company admins to update logos
CREATE POLICY "Company admins can update logos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'guard-reports' 
  AND auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'company_admin'
    AND company_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'guard-reports' 
  AND auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'company_admin'
    AND company_id::text = (storage.foldername(name))[1]
  )
);

-- Create policy for company admins to delete logos
CREATE POLICY "Company admins can delete logos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'guard-reports' 
  AND auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'company_admin'
    AND company_id::text = (storage.foldername(name))[1]
  )
);
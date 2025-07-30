-- Fix storage policies for guard-reports bucket

-- Drop and recreate the guards upload policy with proper WITH CHECK
DROP POLICY IF EXISTS "Guards can upload their own reports" ON storage.objects;

CREATE POLICY "Guards can upload their own reports" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'guard-reports' AND
  auth.uid() IS NOT NULL
);

-- Add update policy for guards to manage their uploads
CREATE POLICY "Guards can update their own uploads" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'guard-reports' AND
  auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'guard-reports' AND
  auth.uid() IS NOT NULL
);

-- Add delete policy for guards
CREATE POLICY "Guards can delete their own uploads" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'guard-reports' AND
  auth.uid() IS NOT NULL
);
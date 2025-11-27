-- Fix the guard_reports RLS policy to work with profiles.id foreign key
-- The current policy checks guard_id = auth.uid() but guard_id references profiles.id

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Guards can manage their own reports" ON guard_reports;

-- Create the correct policy that checks against the profile relationship
CREATE POLICY "Guards can manage their own reports" 
ON guard_reports 
FOR ALL 
USING (
  guard_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  guard_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);
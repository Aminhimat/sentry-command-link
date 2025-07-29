-- Drop the existing policy
DROP POLICY IF EXISTS "Guards can manage their own shifts" ON guard_shifts;

-- Create new policy that works with the foreign key to profiles
CREATE POLICY "Guards can manage their own shifts" 
ON guard_shifts 
FOR ALL 
USING (guard_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));
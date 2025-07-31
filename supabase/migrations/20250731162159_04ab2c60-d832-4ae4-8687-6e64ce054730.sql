-- Check and fix foreign key constraint for guard_shifts table
-- The guard_id should reference profiles.id, not auth.users directly

-- First, let's see the current constraint
SELECT conname, confrelid::regclass, conkey, confkey 
FROM pg_constraint 
WHERE conrelid = 'guard_shifts'::regclass 
AND contype = 'f';

-- Drop existing foreign key constraint if it exists
ALTER TABLE guard_shifts DROP CONSTRAINT IF EXISTS guard_shifts_guard_id_fkey;
ALTER TABLE guard_shifts DROP CONSTRAINT IF EXISTS guard_shifts_guard_id_fke;

-- Add proper foreign key constraint to reference profiles table
ALTER TABLE guard_shifts 
ADD CONSTRAINT guard_shifts_guard_id_fkey 
FOREIGN KEY (guard_id) REFERENCES profiles(id) ON DELETE CASCADE;
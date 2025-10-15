-- Make guard_id nullable in guard_reports so reports can exist without a guard
ALTER TABLE guard_reports ALTER COLUMN guard_id DROP NOT NULL;

-- Make guard_id nullable in incidents so incidents can exist without a guard
ALTER TABLE incidents ALTER COLUMN guard_id DROP NOT NULL;
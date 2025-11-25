-- Add missing foreign key relationships

-- Add FK from checkpoints to properties
ALTER TABLE public.checkpoints
ADD CONSTRAINT checkpoints_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

-- Add FK from guard_reports to profiles (guard)
ALTER TABLE public.guard_reports
ADD CONSTRAINT guard_reports_guard_id_fkey 
FOREIGN KEY (guard_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add FK from checkpoint_scans to checkpoints
ALTER TABLE public.checkpoint_scans
ADD CONSTRAINT checkpoint_scans_checkpoint_id_fkey 
FOREIGN KEY (checkpoint_id) REFERENCES public.checkpoints(id) ON DELETE CASCADE;
-- Add property_id column to historical tables to preserve property assignments at time of record creation

-- Add property_id to guard_reports
ALTER TABLE public.guard_reports 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- Add property_id to checkpoint_scans
ALTER TABLE public.checkpoint_scans 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- Add property_id to guard_shifts
ALTER TABLE public.guard_shifts 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- Add property_id to incidents
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- Add property_id to guard_locations
ALTER TABLE public.guard_locations 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_guard_reports_property_id ON public.guard_reports(property_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_scans_property_id ON public.checkpoint_scans(property_id);
CREATE INDEX IF NOT EXISTS idx_guard_shifts_property_id ON public.guard_shifts(property_id);
CREATE INDEX IF NOT EXISTS idx_incidents_property_id ON public.incidents(property_id);
CREATE INDEX IF NOT EXISTS idx_guard_locations_property_id ON public.guard_locations(property_id);

-- Backfill existing records with current property assignments (one-time data migration)
UPDATE public.guard_reports gr
SET property_id = p.assigned_property_id
FROM public.profiles p
WHERE gr.guard_id = p.id 
AND gr.property_id IS NULL
AND p.assigned_property_id IS NOT NULL;

UPDATE public.checkpoint_scans cs
SET property_id = p.assigned_property_id
FROM public.profiles p
WHERE cs.guard_id = p.id 
AND cs.property_id IS NULL
AND p.assigned_property_id IS NOT NULL;

UPDATE public.guard_shifts gs
SET property_id = p.assigned_property_id
FROM public.profiles p
WHERE gs.guard_id = p.id 
AND gs.property_id IS NULL
AND p.assigned_property_id IS NOT NULL;

UPDATE public.incidents i
SET property_id = p.assigned_property_id
FROM public.profiles p
WHERE i.guard_id = p.id 
AND i.property_id IS NULL
AND p.assigned_property_id IS NOT NULL;

UPDATE public.guard_locations gl
SET property_id = p.assigned_property_id
FROM public.profiles p
WHERE gl.guard_id = p.id 
AND gl.property_id IS NULL
AND p.assigned_property_id IS NOT NULL;
-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.update_guard_locations_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  return NEW;
END;
$$;
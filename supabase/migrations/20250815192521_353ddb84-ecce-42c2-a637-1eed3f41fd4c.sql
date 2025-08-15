-- Add property assignment column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN assigned_property_id UUID REFERENCES public.properties(id);

-- Create index for better performance
CREATE INDEX idx_profiles_assigned_property_id ON public.profiles(assigned_property_id);
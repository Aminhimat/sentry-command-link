-- Create table to track PDF generation status
CREATE TABLE public.pdf_generation_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  download_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pdf_generation_status ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see their own PDF generation status
CREATE POLICY "Users can view their own PDF generation status" 
ON public.pdf_generation_status 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy for system to insert PDF generation status
CREATE POLICY "System can insert PDF generation status" 
ON public.pdf_generation_status 
FOR INSERT 
WITH CHECK (true);

-- Create policy for system to update PDF generation status
CREATE POLICY "System can update PDF generation status" 
ON public.pdf_generation_status 
FOR UPDATE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_pdf_generation_status_user_created ON public.pdf_generation_status(user_id, created_at DESC);
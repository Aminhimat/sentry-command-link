-- Create admin notifications table for location violations
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  guard_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  distance_miles NUMERIC,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Company admins can view their company's notifications
CREATE POLICY "Company admins can view their company's notifications"
  ON public.admin_notifications
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'company_admin'
    )
  );

-- Company admins can update their company's notifications (mark as read)
CREATE POLICY "Company admins can update their company's notifications"
  ON public.admin_notifications
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'company_admin'
    )
  );

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON public.admin_notifications
  FOR INSERT
  WITH CHECK (true);

-- Platform admins can view all notifications
CREATE POLICY "Platform admins can view all notifications"
  ON public.admin_notifications
  FOR ALL
  USING (get_user_role(auth.uid()) = 'platform_admin');

-- Create index for faster queries
CREATE INDEX idx_admin_notifications_company_id ON public.admin_notifications(company_id);
CREATE INDEX idx_admin_notifications_is_read ON public.admin_notifications(is_read);
CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);
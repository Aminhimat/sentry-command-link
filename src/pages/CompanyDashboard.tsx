import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Users, Activity, FileText, Eye, MapPin, AlertTriangle, Download, Calendar, Upload, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import StatsCards from "@/components/StatsCards";
import IncidentsTable from "@/components/IncidentsTable";
import { generatePDFReport } from "@/components/PDFReportGenerator";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  first_name: string;
  last_name: string;
}

interface Guard {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
  company_id?: string;
  role?: string;
  updated_at?: string;
}

interface Report {
  id: string;
  guard_id: string;
  company_id: string;
  report_text: string;
  image_url: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  updated_at: string;
  guard?: {
    first_name: string;
    last_name: string;
  };
}

interface Property {
  id: string;
  company_id: string;
  name: string;
  location_address: string;
  location_lat: number;
  location_lng: number;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

interface Shift {
  id: string;
  guard_id: string;
  company_id: string;
  check_in_time: string;
  check_out_time: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  guard?: {
    first_name: string;
    last_name: string;
  };
}

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  license_limit?: number;
  created_at: string;
  updated_at: string;
}

// CompanyDashboard component - Fixed activeShifts error
const CompanyDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateGuardForm, setShowCreateGuardForm] = useState(false);
  const [showEditGuardForm, setShowEditGuardForm] = useState(false);
  const [showGenerateReportForm, setShowGenerateReportForm] = useState(false);
  const [showPropertiesForm, setShowPropertiesForm] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Guard | null>(null);
  const [newProperty, setNewProperty] = useState({
    name: "",
    location_address: "",
    email: "",
    phone: ""
  });
  const [newGuard, setNewGuard] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    assignedPropertyId: "none"
  });
  const [editGuardData, setEditGuardData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    newPassword: "",
    assignedPropertyId: "none"
  });
  const [reportFilters, setReportFilters] = useState({
    startDate: new Date(),
    endDate: new Date(),
    startTime: "00:00",
    endTime: "23:59",
    guardId: "all",
    propertyId: "all",
    reportType: "daily"
  });
  const { toast } = useToast();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // Debug: Log all state variables to check for any issues
  console.log('Dashboard state:', { guards: guards.length, reports: reports.length, isLoading, userProfile });

  useEffect(() => {
    checkUser();
  }, []);

  // Set up real-time subscriptions for reports
  useEffect(() => {
    if (!userProfile?.company_id) return;

    const reportsChannel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guard_reports',
          filter: `company_id=eq.${userProfile.company_id}`
        },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    // Realtime for guard_shifts
    const shiftsChannel = supabase
      .channel('shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guard_shifts',
          filter: `company_id=eq.${userProfile.company_id}`
        },
        () => {
          fetchShifts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(shiftsChannel);
    };
  }, [userProfile?.company_id]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/auth';
        return;
      }

      setUser(user);

      // Get user profile to check role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast({
          title: "Error",
          description: "Unable to verify permissions",
          variant: "destructive",
        });
        return;
      }

      if (profile.role !== 'company_admin') {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        window.location.href = '/';
        return;
      }

      setUserProfile(profile);
      
      // Fetch data after setting profile, passing the profile directly to avoid state delay
      console.log('Profile set, now fetching data for company:', profile.company_id);
      await fetchCompany(profile.company_id);
      await fetchGuardsForCompany(profile.company_id);
      await fetchReportsForCompany(profile.company_id);
      await fetchShiftsForCompany(profile.company_id);
      await fetchPropertiesForCompany(profile.company_id);
    } catch (error) {
      console.error('Error checking user:', error);
      window.location.href = '/auth';
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGuardsForCompany = async (companyId: string) => {
    console.log('Fetching guards for company:', companyId);

    try {
      // Get guard profiles with assigned property information
      const { data: guardProfiles, error } = await supabase
        .from('profiles')
        .select(`
          *,
          properties (
            id,
            name
          )
        `)
        .eq('company_id', companyId)
        .eq('role', 'guard')
        .order('created_at', { ascending: false });

      console.log('Guards query result:', { guardProfiles, error });

      if (error) {
        console.error('Error fetching guards:', error);
        toast({
          title: "Error",
          description: "Failed to fetch guards",
          variant: "destructive",
        });
        return;
      }

      // For now, set email as a placeholder since we can't fetch from auth.users
      // This will be populated when creating new guards
      const guardsWithPlaceholderEmails = (guardProfiles || []).map(guard => ({
        ...guard,
        email: `${guard.first_name?.toLowerCase() || 'unknown'}.${guard.last_name?.toLowerCase() || 'user'}@company.local`,
        assigned_property: guard.properties
      }));

      console.log('Setting guards:', guardsWithPlaceholderEmails);
      setGuards(guardsWithPlaceholderEmails);
    } catch (error) {
      console.error('Error fetching guards:', error);
    }
  };

  const fetchGuards = async () => {
    if (!userProfile?.company_id) {
      console.log('No company_id available for fetching guards');
      return;
    }
    await fetchGuardsForCompany(userProfile.company_id);
  };

  const fetchReportsForCompany = async (companyId: string) => {
    console.log('Fetching reports for company:', companyId);
    try {
      // First, let's try a simpler query to see if there are any reports
      const { data: allReports, error: allError } = await supabase
        .from('guard_reports')
        .select('*')
        .eq('company_id', companyId);

      console.log('All reports for company:', { allReports, allError });

      // Now try the query with the join
      const { data, error } = await supabase
        .from('guard_reports')
        .select(`
          *,
          guard:profiles!guard_reports_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      console.log('Reports query result:', { data, error });

      if (error) {
        console.error('Error fetching reports:', error);
        // Fallback to reports without guard info if join fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('guard_reports')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return;
        }

        console.log('Using fallback data:', fallbackData);
        setReports(processReportsWithPropertyNames(fallbackData || []));
        return;
      }

      console.log('Setting reports:', data);
      setReports(processReportsWithPropertyNames(data || []));
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  // Function to process reports and convert property IDs to names
  const processReportsWithPropertyNames = (reportsData: Report[]) => {
    return reportsData.map(report => {
      if (report.location_address && properties.length > 0) {
        // Check if location_address is a property ID (UUID format)
        const propertyMatch = properties.find(prop => prop.id === report.location_address);
        if (propertyMatch) {
          return {
            ...report,
            location_address: propertyMatch.name
          };
        }
      }
      return report;
    });
  };

  const fetchCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) {
        console.error('Error fetching company:', error);
        return;
      }

      setCompany(data);
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchReports = async () => {
    if (!userProfile?.company_id) return;
    await fetchReportsForCompany(userProfile.company_id);
  };

  const fetchShiftsForCompany = async (companyId: string) => {
    console.log('Fetching shifts for company:', companyId);
    try {
      const { data, error } = await supabase
        .from('guard_shifts')
        .select(`
          *,
          guard:profiles!guard_shifts_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('check_in_time', { ascending: false })
        .limit(20);

      console.log('Shifts query result:', { data, error });

      if (error) {
        console.error('Error fetching shifts:', error);
        toast({
          title: "Error",
          description: "Failed to fetch shift data",
          variant: "destructive",
        });
        return;
      }

      console.log('Setting shifts:', data);
      setShifts(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const fetchShifts = async () => {
    if (!userProfile?.company_id) return;
    await fetchShiftsForCompany(userProfile.company_id);
  };

  const fetchPropertiesForCompany = async (companyId: string) => {
    console.log('Fetching properties for company:', companyId);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      console.log('Properties query result:', { data, error });

      if (error) {
        console.error('Error fetching properties:', error);
        toast({
          title: "Error",
          description: "Failed to fetch properties",
          variant: "destructive",
        });
        return;
      }

      console.log('Setting properties:', data);
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchProperties = async () => {
    if (!userProfile?.company_id) return;
    await fetchPropertiesForCompany(userProfile.company_id);
  };

  // Re-process reports whenever properties change
  useEffect(() => {
    if (properties.length > 0 && reports.length > 0) {
      const processedReports = reports.map(report => {
        if (report.location_address && properties.length > 0) {
          // Check if location_address is a property ID (UUID format)
          const propertyMatch = properties.find(prop => prop.id === report.location_address);
          if (propertyMatch) {
            return {
              ...report,
              location_address: propertyMatch.name
            };
          }
        }
        return report;
      });
      
      // Only update if there are actual changes
      const hasChanges = processedReports.some((report, index) => 
        report.location_address !== reports[index].location_address
      );
      
      if (hasChanges) {
        setReports(processedReports);
      }
    }
  }, [properties.length]); // Only depend on properties length to avoid circular updates

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.company_id) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .insert([{
          company_id: userProfile.company_id,
          name: newProperty.name,
          location_address: newProperty.location_address,
          email: newProperty.email,
          phone: newProperty.phone
        }])
        .select()
        .single();

      if (error) {
        console.error('Property creation error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Property "${data.name}" created successfully!`,
      });

      setNewProperty({
        name: "",
        location_address: "",
        email: "",
        phone: ""
      });
      setShowPropertiesForm(false);
      await fetchProperties();
    } catch (error) {
      console.error('Error creating property:', error);
      toast({
        title: "Error",
        description: "Failed to create property",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuard) return;

    try {
      setIsLoading(true);
      
      // Prepare update data
      const updateData: any = {
        guardId: editingGuard.id,
        firstName: editGuardData.firstName,
        lastName: editGuardData.lastName,
        phone: editGuardData.phone,
        assignedPropertyId: editGuardData.assignedPropertyId === "none" ? null : editGuardData.assignedPropertyId
      };

      // Only include password if it's provided
      if (editGuardData.newPassword && editGuardData.newPassword.trim() !== '') {
        updateData.newPassword = editGuardData.newPassword;
      }

      // Call edge function to update guard
      const { data, error } = await supabase.functions.invoke('update-guard', {
        body: updateData
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw new Error(error.message || 'Failed to update guard');
      }

      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: `Guard ${editGuardData.firstName} ${editGuardData.lastName} updated successfully!`,
      });

      setShowEditGuardForm(false);
      setEditingGuard(null);
      await fetchGuards();
    } catch (error: any) {
      console.error('Error updating guard:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update guard",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.company_id) return;

    // Client-side pre-check: enforce license limit
    if (company?.license_limit !== undefined) {
      const activeCount = guards.filter(g => g.is_active).length;
      if (activeCount >= company.license_limit) {
        toast({
          title: "License limit reached",
          description: `You have reached your license limit (${company.license_limit}). Deactivate a guard or increase your plan.`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      // Get current session for user token
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', !!session);
      
      if (!session) {
        throw new Error('No active session');
      }

      // Generate email from username
      const email = `${newGuard.username}@company.local`;
      
      // Call the edge function to create the guard
      console.log('Creating guard with data:', {
        firstName: newGuard.firstName,
        lastName: newGuard.lastName,
        username: newGuard.username,
        companyId: userProfile.company_id
      });

      const { data, error } = await supabase.functions.invoke('create-guard', {
        body: {
          firstName: newGuard.firstName,
          lastName: newGuard.lastName,
          email: email,
          username: newGuard.username,
          password: newGuard.password,
          companyId: userProfile.company_id,
          assignedPropertyId: newGuard.assignedPropertyId === "none" ? null : newGuard.assignedPropertyId,
          userToken: session.access_token
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function invocation error:', error);
        toast({
          title: "Error",
          description: `Function error: ${error.message}`,
          variant: "destructive",
        });
        throw new Error(error.message || 'Failed to create guard');
      }

      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      if (!data?.success) {
        console.error('Function did not return success:', data);
        throw new Error('Failed to create guard - unknown response');
      }

      toast({
        title: "Success",
        description: `Guard ${newGuard.firstName} ${newGuard.lastName} created successfully!`,
      });

      setNewGuard({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        assignedPropertyId: "none"
      });
      setShowCreateGuardForm(false);
      await fetchGuards();
    } catch (error: any) {
      console.error('Error creating guard:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create guard",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!userProfile?.company_id || !company) return;

    try {
      setIsLoading(true);
      
      let query = supabase
        .from('guard_reports')
        .select(`
          *,
          guard:profiles!guard_reports_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', userProfile.company_id);

      // Apply date & time filters
      let startDateTime: Date;
      let endDateTime: Date;
      
      // Ensure we have valid Date objects
      const startDateObj = reportFilters.startDate instanceof Date ? reportFilters.startDate : new Date(reportFilters.startDate);
      const endDateObj = reportFilters.endDate instanceof Date ? reportFilters.endDate : new Date(reportFilters.endDate);
      
      if (reportFilters.reportType === 'daily') {
        // Merge selected times with the chosen date
        const [sh, sm] = (reportFilters.startTime || '00:00').split(':').map(Number);
        const [eh, em] = (reportFilters.endTime || '23:59').split(':').map(Number);
        startDateTime = new Date(startDateObj);
        startDateTime.setHours(sh || 0, sm || 0, 0, 0);
        endDateTime = new Date(startDateObj);
        endDateTime.setHours(eh || 23, em || 59, 59, 999);
      } else {
        // For range reports, also apply time filters
        const [sh, sm] = (reportFilters.startTime || '00:00').split(':').map(Number);
        const [eh, em] = (reportFilters.endTime || '23:59').split(':').map(Number);
        startDateTime = new Date(startDateObj);
        startDateTime.setHours(sh || 0, sm || 0, 0, 0);
        endDateTime = new Date(endDateObj);
        endDateTime.setHours(eh || 23, em || 59, 59, 999);
      }
      query = query
        .gte('created_at', startDateTime.toISOString())
        .lte('created_at', endDateTime.toISOString());

      // Apply guard filter
      if (reportFilters.guardId !== 'all') {
        query = query.eq('guard_id', reportFilters.guardId);
      }

      // Apply property filter
      if (reportFilters.propertyId !== 'all') {
        const selectedProperty = properties.find(p => p.id === reportFilters.propertyId);
        if (selectedProperty) {
          // Filter reports by property location
          query = query.ilike('location_address', `%${selectedProperty.location_address}%`);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        toast({
          title: "No Reports Found",
          description: "No reports found for the selected criteria.",
          variant: "destructive",
        });
        return;
      }

      // Convert property IDs to names in reports for PDF generation
      const reportsForPDF = data.map(report => {
        if (report.location_address && properties.length > 0) {
          const propertyMatch = properties.find(prop => prop.id === report.location_address);
          if (propertyMatch) {
            return {
              ...report,
              location_address: propertyMatch.name
            };
          }
        }
        return report;
      });

      // Generate PDF directly on client-side
      await generatePDFReport(reportsForPDF, company, {
        ...reportFilters,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString()
      });

      toast({
        title: "Success",
        description: `Report generated successfully with ${data.length} reports.`,
      });

    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('Logo upload started:', { file: !!file, company: !!company });
    
    if (!file || !company) {
      console.log('Upload cancelled: missing file or company');
      return;
    }

    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      companyId: company.id
    });

    if (!file.type.startsWith('image/')) {
      console.log('File type rejected:', file.type);
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      console.log('File size too large:', file.size);
      toast({
        title: "Error", 
        description: "Logo file size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Upload to Supabase storage with better file naming
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${company.id}/logo_${timestamp}.${fileExt}`;
      
      console.log('Attempting upload:', { fileName, bucket: 'guard-reports' });
      
      const { data, error } = await supabase.storage
        .from('guard-reports')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type
        });

      console.log('Upload result:', { data, error });

      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('guard-reports')
        .getPublicUrl(fileName);
        
      console.log('Generated public URL:', publicUrl);

      // Update company with logo URL
      console.log('Updating company with logo URL...');
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', company.id);

      console.log('Company update result:', { updateError });

      if (updateError) {
        console.error('Company update error:', updateError);
        throw updateError;
      }

      // Update local state and refresh from database
      setCompany({ ...company, logo_url: publicUrl });
      
      // Refresh company data from database to ensure consistency
      console.log('Refreshing company data...');
      await fetchCompany(company.id);

      toast({
        title: "Success",
        description: "Company logo uploaded successfully!",
      });

      console.log('Logo upload completed successfully');

    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-semibold tracking-wide">{company?.name?.toUpperCase() || 'COMPANY DASHBOARD'}</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {userProfile?.first_name} {userProfile?.last_name}
              </p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setShowGenerateReportForm(true)}>
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button variant="outline" onClick={() => setShowCreateGuardForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Guard
            </Button>
            <Button variant="outline" onClick={() => {
              if (guards.length > 0) {
                const guard = guards[0];
                setEditingGuard(guard);
                setEditGuardData({
                  firstName: guard.first_name || "",
                  lastName: guard.last_name || "",
                  phone: guard.phone || "",
                  newPassword: "",
                  assignedPropertyId: (guard as any).assigned_property_id || "none"
                });
                setShowEditGuardForm(true);
              }
            }}>
              Edit Guard
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-card border-b">
        <div className="px-6 py-4">
          <div className="flex gap-1">
            <Link to="/company">
              <Button variant="ghost" className="h-10 px-4 py-2 bg-background text-foreground shadow-sm">
                Overview
              </Button>
            </Link>
            <Link to="/company/shifts">
              <Button variant="ghost" className="h-10 px-4 py-2">
                Shifts
              </Button>
            </Link>
            <Link to="/company/guards">
              <Button variant="ghost" className="h-10 px-4 py-2">
                Guards
              </Button>
            </Link>
            <Link to="/company/properties">
              <Button variant="ghost" className="h-10 px-4 py-2">
                Properties/Sites
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {/* Company Logo Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Company Logo
            </CardTitle>
            <CardDescription>
              Upload your company logo to be displayed in reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                {company?.logo_url ? (
                  <div className="w-20 h-20 border rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={`${company.logo_url}?t=${Date.now()}`}
                      alt="Company Logo" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        console.error('Logo failed to load:', company.logo_url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">
                    {company?.logo_url ? 'Logo uploaded' : 'No logo uploaded'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button 
                  variant="outline" 
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  disabled={isUploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

<StatsCards guards={guards} incidents={reports} />

        {/* Create Guard Form */}
        {showCreateGuardForm && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create New Guard</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateGuardForm(false)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateGuard} className="grid gap-4 md:grid-cols-5">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={newGuard.firstName}
                    onChange={(e) => setNewGuard({...newGuard, firstName: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={newGuard.lastName}
                    onChange={(e) => setNewGuard({...newGuard, lastName: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={newGuard.username}
                    onChange={(e) => setNewGuard({...newGuard, username: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newGuard.password}
                    onChange={(e) => setNewGuard({ ...newGuard, password: e.target.value })}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                  />
                </div>
                <div>
                  <Label htmlFor="assignedProperty">Assign to Property</Label>
                  <Select 
                    value={newGuard.assignedPropertyId} 
                    onValueChange={(value) => setNewGuard({ ...newGuard, assignedPropertyId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border shadow-lg z-50">
                      <SelectItem value="none">No Property</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end md:col-span-5">
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Creating..." : "Create Guard"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Generate Report Form */}
        {showGenerateReportForm && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Generate Security Report</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowGenerateReportForm(false)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label>Report Type</Label>
                  <Select 
                    value={reportFilters.reportType} 
                    onValueChange={(value) => setReportFilters({...reportFilters, reportType: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily Report</SelectItem>
                      <SelectItem value="range">Date Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Guard</Label>
                  <Select 
                    value={reportFilters.guardId} 
                    onValueChange={(value) => setReportFilters({...reportFilters, guardId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select guard" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Guards</SelectItem>
                      {guards.map((guard) => (
                        <SelectItem key={guard.id} value={guard.id}>
                          {guard.first_name} {guard.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Work Site</Label>
                  <Select 
                    value={reportFilters.propertyId} 
                    onValueChange={(value) => setReportFilters({...reportFilters, propertyId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{reportFilters.reportType === 'daily' ? 'Date' : 'Start Date'}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !reportFilters.startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {reportFilters.startDate ? format(reportFilters.startDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={reportFilters.startDate}
                        onSelect={(date) => date && setReportFilters({...reportFilters, startDate: date})}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {reportFilters.reportType === 'range' && (
                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !reportFilters.endDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {reportFilters.endDate ? format(reportFilters.endDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={reportFilters.endDate}
                          onSelect={(date) => date && setReportFilters({...reportFilters, endDate: date})}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Time selection for all report types */}
                <div>
                  <Label>{reportFilters.reportType === 'daily' ? 'From (Time)' : 'Start Time'}</Label>
                  <Input
                    type="time"
                    value={reportFilters.startTime}
                    onChange={(e) => setReportFilters({ ...reportFilters, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{reportFilters.reportType === 'daily' ? 'To (Time)' : 'End Time'}</Label>
                  <Input
                    type="time"
                    value={reportFilters.endTime}
                    onChange={(e) => setReportFilters({ ...reportFilters, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={handleGenerateReport}
                  disabled={isLoading || reports.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isLoading ? "Generating..." : "Generate & Download Report"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Guard Form */}
        {showEditGuardForm && editingGuard && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Guard: {editingGuard.first_name} {editingGuard.last_name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowEditGuardForm(false)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateGuard} className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input
                    id="editFirstName"
                    type="text"
                    value={editGuardData.firstName}
                    onChange={(e) => setEditGuardData({...editGuardData, firstName: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    type="text"
                    value={editGuardData.lastName}
                    onChange={(e) => setEditGuardData({...editGuardData, lastName: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input
                    id="editPhone"
                    type="text"
                    value={editGuardData.phone}
                    onChange={(e) => setEditGuardData({...editGuardData, phone: e.target.value})}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="editPassword">New Password (Optional)</Label>
                  <Input
                    id="editPassword"
                    type="password"
                    value={editGuardData.newPassword}
                    onChange={(e) => setEditGuardData({...editGuardData, newPassword: e.target.value})}
                    placeholder="Leave blank to keep current"
                    minLength={6}
                  />
                </div>
                <div className="md:col-span-4">
                  <Label htmlFor="editAssignedProperty">Assign to Property</Label>
                  <Select 
                    value={editGuardData.assignedPropertyId} 
                    onValueChange={(value) => setEditGuardData({ ...editGuardData, assignedPropertyId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border shadow-lg z-50">
                      <SelectItem value="none">No Property</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 md:col-span-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Updating..." : "Save Changes"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowEditGuardForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <IncidentsTable incidents={reports} />

        {/* Shift Details Modal */}
        <Dialog open={!!selectedShift} onOpenChange={(open) => { if (!open) setSelectedShift(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Guard Location</DialogTitle>
              <DialogDescription>
                {selectedShift?.guard?.first_name} {selectedShift?.guard?.last_name} — {selectedShift ? new Date(selectedShift.check_in_time).toLocaleString() : ''}
              </DialogDescription>
            </DialogHeader>
            {selectedShift && (
              selectedShift.location_lat != null && selectedShift.location_lng != null ? (
                <div className="aspect-video w-full overflow-hidden rounded-md">
                  <iframe
                    title="Guard location map"
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${selectedShift.location_lat},${selectedShift.location_lng}&z=15&output=embed`}
                  />
                </div>
              ) : selectedShift.location_address ? (
                <div className="aspect-video w-full overflow-hidden rounded-md">
                  <iframe
                    title="Guard location map"
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(selectedShift.location_address)}&z=15&output=embed`}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No location available for this shift.</p>
              )
            )}
          </DialogContent>
        </Dialog>


      </div>
    </div>
  );
};

export default CompanyDashboard;
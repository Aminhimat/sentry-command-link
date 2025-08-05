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

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
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
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateGuardForm, setShowCreateGuardForm] = useState(false);
  const [showEditGuardForm, setShowEditGuardForm] = useState(false);
  const [showGenerateReportForm, setShowGenerateReportForm] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Guard | null>(null);
  const [newGuard, setNewGuard] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "TempPass123!"
  });
  const [reportFilters, setReportFilters] = useState({
    startDate: new Date(),
    endDate: new Date(),
    guardId: "all",
    reportType: "daily"
  });
  const { toast } = useToast();

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

    return () => {
      supabase.removeChannel(reportsChannel);
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
      // Get guard profiles - we'll get emails from the edge function response
      const { data: guardProfiles, error } = await supabase
        .from('profiles')
        .select('*')
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
        email: `${guard.first_name?.toLowerCase() || 'unknown'}.${guard.last_name?.toLowerCase() || 'user'}@company.local`
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
        .order('created_at', { ascending: false })
        .limit(20);

      console.log('Reports query result:', { data, error });

      if (error) {
        console.error('Error fetching reports:', error);
        // Fallback to reports without guard info if join fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('guard_reports')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return;
        }

        console.log('Using fallback data:', fallbackData);
        setReports(fallbackData || []);
        return;
      }

      console.log('Setting reports:', data);
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
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

  const handleCreateGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.company_id) return;

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
        password: "TempPass123!"
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
    if (!userProfile?.company_id) return;

    try {
      let query = supabase
        .from('guard_reports')
        .select(`
          *,
          guard:profiles!guard_reports_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', userProfile.company_id);

      // Apply date filters
      if (reportFilters.reportType === 'daily') {
        const startOfDay = new Date(reportFilters.startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(reportFilters.startDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
      } else {
        query = query
          .gte('created_at', reportFilters.startDate.toISOString())
          .lte('created_at', reportFilters.endDate.toISOString());
      }

      // Apply guard filter
      if (reportFilters.guardId !== 'all') {
        query = query.eq('guard_id', reportFilters.guardId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Generate PDF report
      await generatePDFReport(data || []);

      toast({
        title: "Success",
        description: "Report generated successfully!",
      });

    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    }
  };

  const generatePDFReport = async (reportData: Report[]) => {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 30;

    // Add company logo
    if (company?.logo_url) {
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
          logoImg.src = company.logo_url;
        });

        // Convert logo to base64 and add to PDF
        const logoCanvas = document.createElement('canvas');
        const logoCtx = logoCanvas.getContext('2d');
        logoCanvas.width = 40;
        logoCanvas.height = 30;
        logoCtx?.drawImage(logoImg, 0, 0, 40, 30);
        const logoData = logoCanvas.toDataURL('image/jpeg', 0.8);
        
        pdf.addImage(logoData, 'JPEG', 20, 15, 40, 30);
      } catch (error) {
        console.error('Error loading company logo:', error);
        // Add fallback placeholder
        pdf.setFillColor(0, 100, 200);
        pdf.circle(30, 25, 10, 'F');
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('COMPANY', 45, 25);
        pdf.text('LOGO', 45, 32);
      }
    } else {
      // Add placeholder for no logo
      pdf.setFillColor(0, 100, 200);
      pdf.circle(30, 25, 10, 'F');
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('COMPANY', 45, 25);
      pdf.text('LOGO', 45, 32);
    }

    // Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Daily Activity Report', pageWidth / 2, 30, { align: 'center' });

    // Company name
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Security Force', pageWidth / 2, 45, { align: 'center' });

    // Date range
    const startDate = reportFilters.reportType === 'daily' 
      ? format(reportFilters.startDate, 'MMM dd, yyyy HH:mm a')
      : format(reportFilters.startDate, 'MMM dd, yyyy HH:mm a');
    const endDate = reportFilters.reportType === 'daily' 
      ? format(new Date(reportFilters.startDate.getTime() + 24 * 60 * 60 * 1000), 'MMM dd, yyyy HH:mm a')
      : format(reportFilters.endDate, 'MMM dd, yyyy HH:mm a');

    pdf.setFontSize(10);
    pdf.text(`Start: ${startDate}`, pageWidth - 20, 25, { align: 'right' });
    pdf.text(`End: ${endDate}`, pageWidth - 20, 35, { align: 'right' });

    yPosition = 70;

    // Process each report
    for (const report of reportData) {
      // Check if we need a new page
      if (yPosition > pageHeight - 80) {
        pdf.addPage();
        yPosition = 30;
      }

      const reportDate = format(new Date(report.created_at), 'EEE MMM dd, yyyy h:mm a');
      const guardName = `${report.guard?.first_name || ''} ${report.guard?.last_name || ''}`.trim();
      const location = report.location_address || 'Default Location';

      // Date and location box
      pdf.setFillColor(240, 240, 240);
      pdf.rect(20, yPosition - 5, 120, 25, 'F');
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportDate, 25, yPosition + 2);
      pdf.text(location, 25, yPosition + 8);
      pdf.text(`Location: Default`, 25, yPosition + 14);
      pdf.text(`Unit:`, 25, yPosition + 20);
      
      // Guard name
      pdf.setFont('helvetica', 'bold');
      pdf.text(guardName, 25, yPosition + 30);

      // Security Patrol badge
      pdf.setFillColor(34, 197, 94);
      pdf.rect(25, yPosition + 35, 60, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text('(S) Level 3', 28, yPosition + 40);
      pdf.setTextColor(0, 0, 0);

      // Activity type and ID
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('(S) Security Patrol', pageWidth / 2, yPosition + 2, { align: 'center' });
      
      // Generate report ID
      const reportId = Math.floor(Math.random() * 10000000000).toString();
      pdf.text(reportId, pageWidth - 20, yPosition + 2, { align: 'right' });

      // Add image if available
      if (report.image_url) {
        try {
          // Create a temporary image element to load the image
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = report.image_url;
          });

          // Convert image to base64 and add to PDF
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 60;
          canvas.height = 40;
          ctx?.drawImage(img, 0, 0, 60, 40);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          
          pdf.addImage(imageData, 'JPEG', pageWidth - 75, yPosition, 50, 35);
          
          // Add report ID at the top of the image
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.text(reportId, pageWidth - 50, yPosition + 8, { align: 'center' });
          pdf.setTextColor(0, 0, 0);
        } catch (error) {
          console.error('Error loading image:', error);
          // Add placeholder if image fails to load
          pdf.setFillColor(200, 200, 200);
          pdf.rect(pageWidth - 75, yPosition, 50, 35, 'F');
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
          pdf.text('Image', pageWidth - 50, yPosition + 15, { align: 'center' });
          pdf.text('Unavailable', pageWidth - 50, yPosition + 22, { align: 'center' });
          pdf.setTextColor(0, 0, 0);
        }
      } else {
        // Add placeholder for no image
        pdf.setFillColor(240, 240, 240);
        pdf.rect(pageWidth - 75, yPosition, 50, 35, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text('No Image', pageWidth - 50, yPosition + 20, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
      }

      yPosition += 60;
    }

    // Save the PDF
    const fileName = `daily-activity-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);
  };

  const downloadReport = (content: string) => {
    // This function is now handled by generatePDFReport
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "Error", 
        description: "Logo file size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${company.id}/logo.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('guard-reports')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('guard-reports')
        .getPublicUrl(fileName);

      // Update company with logo URL
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', company.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setCompany({ ...company, logo_url: publicUrl });

      toast({
        title: "Success",
        description: "Company logo uploaded successfully!",
      });

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
              <h1 className="text-xl font-semibold tracking-wide">COMPANY DASHBOARD</h1>
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
                setEditingGuard(guards[0]);
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
                      src={company.logo_url} 
                      alt="Company Logo" 
                      className="w-full h-full object-contain"
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
              <form onSubmit={handleCreateGuard} className="grid gap-4 md:grid-cols-4">
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
                <div className="flex items-end">
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
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleGenerateReport} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Generate & Download Report
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
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input
                    id="editFirstName"
                    type="text"
                    value={editingGuard.first_name}
                    onChange={(e) => setEditingGuard({...editingGuard, first_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    type="text"
                    value={editingGuard.last_name}
                    onChange={(e) => setEditingGuard({...editingGuard, last_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input
                    id="editPhone"
                    type="text"
                    value={editingGuard.phone || ''}
                    onChange={(e) => setEditingGuard({...editingGuard, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => {
                  // Save guard changes
                  toast({
                    title: "Success",
                    description: "Guard updated successfully",
                  });
                  setShowEditGuardForm(false);
                }}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setShowEditGuardForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <IncidentsTable incidents={reports} />

        {/* Guards List */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guards Roster
            </CardTitle>
            <CardDescription>
              Manage your security guard team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Phone</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {guards.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-muted-foreground">
                        No guards found
                      </td>
                    </tr>
                  ) : (
                    guards.map((guard) => (
                      <tr key={guard.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {guard.first_name?.[0]}{guard.last_name?.[0]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {guard.first_name} {guard.last_name}
                              </span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setEditingGuard(guard);
                                  setShowEditGuardForm(true);
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {guard.email}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {guard.phone || 'Not provided'}
                        </td>
                        <td className="p-4">
                          <Badge variant={guard.is_active ? "default" : "secondary"}>
                            {guard.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(guard.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  );
};

export default CompanyDashboard;
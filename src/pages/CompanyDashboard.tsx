import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Users, Activity, FileText, Eye, MapPin, AlertTriangle, Download, Calendar } from "lucide-react";
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

// CompanyDashboard component - Fixed activeShifts error
const CompanyDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateGuardForm, setShowCreateGuardForm] = useState(false);
  const [showEditGuardForm, setShowEditGuardForm] = useState(false);
  const [showGenerateReportForm, setShowGenerateReportForm] = useState(false);
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

      // Generate report content
      const reportContent = generateReportContent(data || []);
      downloadReport(reportContent);

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

  const generateReportContent = (reportData: Report[]) => {
    const guardName = reportFilters.guardId === 'all' 
      ? 'All Guards' 
      : guards.find(g => g.id === reportFilters.guardId)?.first_name + ' ' + guards.find(g => g.id === reportFilters.guardId)?.last_name;
    
    const dateRange = reportFilters.reportType === 'daily' 
      ? format(reportFilters.startDate, 'PPP')
      : `${format(reportFilters.startDate, 'PPP')} - ${format(reportFilters.endDate, 'PPP')}`;

    let content = `SECURITY REPORT\n`;
    content += `Company: ${userProfile?.company_id}\n`;
    content += `Guard: ${guardName}\n`;
    content += `Period: ${dateRange}\n`;
    content += `Generated: ${format(new Date(), 'PPP pp')}\n`;
    content += `\n${'='.repeat(50)}\n\n`;

    if (reportData.length === 0) {
      content += 'No reports found for the selected period.\n';
    } else {
      content += `Total Reports: ${reportData.length}\n\n`;
      
      reportData.forEach((report, index) => {
        content += `Report #${index + 1}\n`;
        content += `Date: ${format(new Date(report.created_at), 'PPP pp')}\n`;
        content += `Guard: ${report.guard?.first_name} ${report.guard?.last_name}\n`;
        content += `Location: ${report.location_address || 'Not specified'}\n`;
        content += `Description: ${report.report_text || 'No description'}\n`;
        if (report.image_url) {
          content += `Photo: Yes\n`;
        }
        content += `\n${'-'.repeat(30)}\n\n`;
      });
    }

    return content;
  };

  const downloadReport = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security-report-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Users, Activity, FileText, Eye, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

interface GuardShift {
  id: string;
  guard_id: string;
  check_in_time: string;
  check_out_time: string | null;
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  notes: string;
  guard: {
    first_name: string;
    last_name: string;
  };
}

const CompanyDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [activeShifts, setActiveShifts] = useState<GuardShift[]>([]);
  const [guardReports, setGuardReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateGuardForm, setShowCreateGuardForm] = useState(false);
  const [newGuard, setNewGuard] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "TempPass123!"
  });
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  // Set up real-time subscriptions for shifts and reports
  useEffect(() => {
    if (!userProfile?.company_id) return;

    const shiftsChannel = supabase
      .channel('guard-shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guard_shifts',
          filter: `company_id=eq.${userProfile.company_id}`
        },
        () => {
          fetchActiveShifts();
        }
      )
      .subscribe();

    const reportsChannel = supabase
      .channel('guard-reports-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guard_reports',
          filter: `company_id=eq.${userProfile.company_id}`
        },
        () => {
          fetchGuardReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shiftsChannel);
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
      await fetchGuards();
      await fetchActiveShifts();
      await fetchGuardReports();
    } catch (error) {
      console.error('Error checking user:', error);
      window.location.href = '/auth';
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGuards = async () => {
    if (!userProfile?.company_id) return;

    try {
      // Get guard profiles - we'll get emails from the edge function response
      const { data: guardProfiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .eq('role', 'guard')
        .order('created_at', { ascending: false });

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
        email: `${guard.first_name.toLowerCase()}.${guard.last_name.toLowerCase()}@company.local`
      }));

      setGuards(guardsWithPlaceholderEmails);
    } catch (error) {
      console.error('Error fetching guards:', error);
    }
  };

  const fetchActiveShifts = async () => {
    if (!userProfile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('guard_shifts')
        .select(`
          *,
          guard:profiles!guard_shifts_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', userProfile.company_id)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error('Error fetching active shifts:', error);
        return;
      }

      setActiveShifts(data || []);
    } catch (error) {
      console.error('Error fetching active shifts:', error);
    }
  };

  const fetchGuardReports = async () => {
    if (!userProfile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('guard_reports')
        .select(`
          *,
          guard:profiles!guard_reports_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', userProfile.company_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching guard reports:', error);
        return;
      }

      setGuardReports(data || []);
    } catch (error) {
      console.error('Error fetching guard reports:', error);
    }
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
              <h1 className="text-xl font-semibold">Company Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {userProfile?.first_name} {userProfile?.last_name}
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guards</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{guards.length}</div>
              <p className="text-xs text-muted-foreground">
                {guards.filter(g => g.is_active).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeShifts.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently on duty
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{guardReports.length}</div>
              <p className="text-xs text-muted-foreground">
                Total guard reports
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Shifts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Shifts
            </CardTitle>
            <CardDescription>
              Guards currently on duty
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeShifts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active shifts</p>
            ) : (
              <div className="space-y-4">
                 {activeShifts.map((shift) => (
                   <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                     <div className="flex items-center space-x-4">
                       <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                       <div className="flex-1">
                         <p className="font-medium">
                           {shift.guard?.first_name} {shift.guard?.last_name}
                         </p>
                         <p className="text-sm text-muted-foreground">
                           Started: {new Date(shift.check_in_time).toLocaleString()}
                         </p>
                         <div className="flex items-center gap-4 mt-1">
                           {shift.location_address && (
                             <p className="text-sm text-muted-foreground flex items-center gap-1">
                               <MapPin className="h-3 w-3" />
                               {shift.location_address}
                             </p>
                           )}
                           {shift.location_lat && shift.location_lng && (
                             <button
                               onClick={() => window.open(`https://maps.google.com/?q=${shift.location_lat},${shift.location_lng}`, '_blank')}
                               className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                             >
                               <Eye className="h-3 w-3" />
                               View on Map
                             </button>
                           )}
                         </div>
                       </div>
                     </div>
                     <div className="flex flex-col items-end gap-2">
                       <Badge variant="secondary" className="bg-green-100 text-green-800">
                         On Duty
                       </Badge>
                       <span className="text-xs text-muted-foreground">
                         {(() => {
                           const duration = Date.now() - new Date(shift.check_in_time).getTime();
                           const hours = Math.floor(duration / (1000 * 60 * 60));
                           const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
                           return `${hours}h ${minutes}m`;
                         })()}
                       </span>
                     </div>
                   </div>
                 ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guard Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Guard Reports
            </CardTitle>
            <CardDescription>
              Latest reports submitted by your guards
            </CardDescription>
          </CardHeader>
          <CardContent>
            {guardReports.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No reports yet</p>
            ) : (
              <div className="space-y-4">
                {guardReports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">
                          {report.guard?.first_name} {report.guard?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      {report.location_address && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1" />
                          {report.location_address}
                        </div>
                      )}
                    </div>
                    <p className="text-sm mb-3">{report.report_text}</p>
                    {report.image_url && (
                      <div className="mt-2">
                        <img 
                          src={report.image_url} 
                          alt="Report" 
                          className="max-w-xs max-h-48 object-cover rounded cursor-pointer"
                          onClick={() => window.open(report.image_url, '_blank')}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guards Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Guards Management
                </CardTitle>
                <CardDescription>
                  Manage your security guards
                </CardDescription>
              </div>
              <Button onClick={() => setShowCreateGuardForm(!showCreateGuardForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Guard
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create Guard Form */}
            {showCreateGuardForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Create New Guard</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateGuard} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={newGuard.firstName}
                          onChange={(e) => setNewGuard({ ...newGuard, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={newGuard.lastName}
                          onChange={(e) => setNewGuard({ ...newGuard, lastName: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={newGuard.username}
                        onChange={(e) => setNewGuard({ ...newGuard, username: e.target.value })}
                        required
                        placeholder="e.g., john.smith"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        value={newGuard.password}
                        onChange={(e) => setNewGuard({ ...newGuard, password: e.target.value })}
                        required
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? "Creating..." : "Create Guard"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowCreateGuardForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Guards List */}
            <div className="space-y-4">
              {guards.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No guards found. Create your first guard above.
                </p>
              ) : (
                guards.map((guard) => (
                  <div key={guard.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Shield className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {guard.first_name} {guard.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{guard.email}</p>
                        <p className="text-sm text-muted-foreground">{guard.phone}</p>
                        <p className="text-sm text-muted-foreground">
                          Created: {new Date(guard.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={guard.is_active ? "default" : "secondary"}>
                        {guard.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanyDashboard;
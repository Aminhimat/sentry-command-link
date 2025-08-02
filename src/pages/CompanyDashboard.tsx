import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Users, Activity, FileText, Eye, MapPin, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface Incident {
  id: string;
  guard_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  guard: {
    first_name: string;
    last_name: string;
  };
}

// CompanyDashboard component - Fixed activeShifts error
const CompanyDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateGuardForm, setShowCreateGuardForm] = useState(false);
  const [newGuard, setNewGuard] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "TempPass123!"
  });
  const { toast } = useToast();

  // Debug: Log all state variables to check for any issues
  console.log('Dashboard state:', { guards: guards.length, incidents: incidents.length, isLoading, userProfile });

  useEffect(() => {
    checkUser();
  }, []);

  // Set up real-time subscriptions for incidents
  useEffect(() => {
    if (!userProfile?.company_id) return;

    const incidentsChannel = supabase
      .channel('incidents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
          filter: `company_id=eq.${userProfile.company_id}`
        },
        () => {
          fetchIncidents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentsChannel);
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
      await fetchIncidentsForCompany(profile.company_id);
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

  const fetchIncidentsForCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          guard:profiles!incidents_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching incidents:', error);
        return;
      }

      setIncidents(data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    }
  };

  const fetchIncidents = async () => {
    if (!userProfile?.company_id) return;
    await fetchIncidentsForCompany(userProfile.company_id);
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

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      'low': { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Low' },
      'medium': { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Medium' },
      'high': { className: 'bg-red-100 text-red-800 border-red-200', label: 'High' },
      'none': { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'None' }
    };
    
    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.none;
    return <Badge className={config.className}>{config.label}</Badge>;
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
            <Button variant="outline" onClick={() => setShowCreateGuardForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Guard
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <StatsCards guards={guards} incidents={incidents} />

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

        <IncidentsTable incidents={incidents} />


      </div>
    </div>
  );
};

export default CompanyDashboard;
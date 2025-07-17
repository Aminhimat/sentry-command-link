import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Clock, MapPin, FileText, LogOut, User as UserIcon } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_active: boolean;
}

interface ActiveShift {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  location_address: string;
  notes: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  location_address: string;
}

const GuardDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        window.location.href = '/auth';
        return;
      }

      setUser(session.user);
      await fetchUserProfile(session.user.id);
      setIsLoading(false);
    };

    checkUser();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setUserProfile(data);
      await fetchActiveShift(data.id);
      await fetchRecentIncidents(data.id);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchActiveShift = async (guardId: string) => {
    try {
      const { data, error } = await supabase
        .from('guard_shifts')
        .select('*')
        .eq('guard_id', guardId)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching active shift:', error);
        return;
      }

      setActiveShift(data);
    } catch (error) {
      console.error('Error fetching active shift:', error);
    }
  };

  const fetchRecentIncidents = async (guardId: string) => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('guard_id', guardId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching incidents:', error);
        return;
      }

      setRecentIncidents(data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Success",
      description: "Signed out successfully!",
    });
    window.location.href = '/auth';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Unable to load your profile. Please contact your administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Guard Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {userProfile.first_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={userProfile.is_active ? "default" : "destructive"}>
                {userProfile.is_active ? "Active" : "Inactive"}
              </Badge>
              <Button onClick={handleSignOut} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserIcon className="h-5 w-5 mr-2" />
                Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{userProfile.first_name} {userProfile.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{userProfile.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge variant="secondary">{userProfile.role}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Active Shift Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Current Shift
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeShift ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Check-in Time</p>
                    <p className="font-medium">
                      {new Date(activeShift.check_in_time).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{activeShift.location_address || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="default">On Duty</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No active shift</p>
                  <p className="text-sm text-muted-foreground">Check in to start your shift</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Incidents */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Recent Incidents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentIncidents.length > 0 ? (
                <div className="space-y-3">
                  {recentIncidents.map((incident) => (
                    <div key={incident.id} className="border-l-4 border-primary pl-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{incident.title}</p>
                        <Badge 
                          variant={
                            incident.severity === 'high' ? 'destructive' :
                            incident.severity === 'medium' ? 'default' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {incident.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No incidents reported</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col">
              <Clock className="h-6 w-6 mb-2" />
              Check In/Out
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <FileText className="h-6 w-6 mb-2" />
              Report Incident
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <MapPin className="h-6 w-6 mb-2" />
              Update Location
            </Button>
            <Button variant="outline" className="h-20 flex-col">
              <UserIcon className="h-6 w-6 mb-2" />
              View Schedule
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GuardDashboard;
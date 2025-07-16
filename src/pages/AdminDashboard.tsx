import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Building, Users, Activity, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  license_limit: number;
  status: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  role: string;
  first_name: string;
  last_name: string;
}

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    license_limit: 10,
    status: "active" as "active" | "inactive" | "suspended"
  });
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

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
          description: "Unable to verify admin permissions",
          variant: "destructive",
        });
        return;
      }

      if (profile.role !== 'platform_admin') {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        window.location.href = '/';
        return;
      }

      setUserProfile(profile);
      await fetchCompanies();
    } catch (error) {
      console.error('Error checking user:', error);
      window.location.href = '/auth';
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([newCompany])
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Company "${data.name}" created successfully!`,
      });

      setNewCompany({
        name: "",
        email: "",
        phone: "",
        address: "",
        license_limit: 10,
        status: "active" as "active" | "inactive" | "suspended"
      });
      setShowCreateForm(false);
      await fetchCompanies();
    } catch (error) {
      console.error('Error creating company:', error);
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { variant: "default" as const, className: "bg-success text-success-foreground" },
      inactive: { variant: "secondary" as const, className: "" },
      suspended: { variant: "destructive" as const, className: "" }
    } as const;

    const statusConfig = config[status as keyof typeof config] || config.inactive;

    return (
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse-glow" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-primary mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">SecureOps Admin</h1>
              <p className="text-sm text-muted-foreground">Platform Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {userProfile?.first_name} {userProfile?.last_name}
            </span>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Companies</p>
                  <p className="text-2xl font-bold">{companies.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-success" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Active Companies</p>
                  <p className="text-2xl font-bold">
                    {companies.filter(c => c.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-warning" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Licenses</p>
                  <p className="text-2xl font-bold">
                    {companies.reduce((sum, c) => sum + c.license_limit, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-accent" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">$0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Security Companies</h2>
          <Button variant="hero" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Company
          </Button>
        </div>

        {/* Create Company Form */}
        {showCreateForm && (
          <Card className="mb-6 shadow-elevated">
            <CardHeader>
              <CardTitle>Create New Security Company</CardTitle>
              <CardDescription>
                Add a new security company to the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCompany} className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input
                    id="name"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="license_limit">License Limit</Label>
                  <Input
                    id="license_limit"
                    type="number"
                    min="1"
                    value={newCompany.license_limit}
                    onChange={(e) => setNewCompany({ ...newCompany, license_limit: parseInt(e.target.value) })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={newCompany.status} 
                    onValueChange={(value: "active" | "inactive" | "suspended") => 
                      setNewCompany({ ...newCompany, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                  />
                </div>
                
                <div className="md:col-span-2 flex gap-4">
                  <Button type="submit" className="bg-success hover:bg-success/90 text-success-foreground" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Company"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Companies List */}
        <div className="grid gap-6">
          {companies.map((company) => (
            <Card key={company.id} className="shadow-card hover:shadow-elevated transition-smooth">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{company.name}</h3>
                      {getStatusBadge(company.status)}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <p><strong>Email:</strong> {company.email || 'Not provided'}</p>
                        <p><strong>Phone:</strong> {company.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p><strong>License Limit:</strong> {company.license_limit} users</p>
                        <p><strong>Created:</strong> {new Date(company.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {company.address && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Address:</strong> {company.address}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {companies.length === 0 && (
            <Card className="shadow-card">
              <CardContent className="p-12 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Companies Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by creating your first security company
                </p>
                <Button variant="hero" onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Company
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
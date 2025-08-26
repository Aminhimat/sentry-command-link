import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Building, Users, Activity, BarChart3, Trash2, MapPin, Calendar, FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  license_limit: number;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
  logo_url: string | null;
}

interface Profile {
  id: string;
  user_id: string;
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
  company_id: string;
  company_name: string;
  is_active: boolean;
  created_at: string;
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
  company?: {
    name: string;
  };
}

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [guardsCount, setGuardsCount] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [newProperty, setNewProperty] = useState({
    name: "",
    location_address: "",
    email: "",
    phone: "",
    company_id: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [newCompany, setNewCompany] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    license_limit: 10,
    status: "active" as "active" | "inactive" | "suspended",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPhone: ""
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
      await fetchGuards();
      await fetchProperties();
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

  const fetchGuards = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          phone,
          company_id,
          is_active,
          created_at,
          companies (
            name
          )
        `)
        .eq('role', 'guard')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const guardsWithCompany = data?.map((guard: any) => ({
        ...guard,
        company_name: guard.companies?.name || 'No Company'
      })) || [];

      setGuards(guardsWithCompany);
      setGuardsCount(guardsWithCompany.length);
    } catch (error) {
      console.error('Error fetching guards:', error);
      toast({
        title: "Error",
        description: "Failed to load guards",
        variant: "destructive",
      });
    }
  };


  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          companies (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const propertiesWithCompany = data?.map((property: any) => ({
        ...property,
        company: property.companies
      })) || [];

      setProperties(propertiesWithCompany);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast({
        title: "Error",
        description: "Failed to load properties",
        variant: "destructive",
      });
    }
  };


  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Creating company with data:', newCompany);
      
      // Create company first
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([{
          name: newCompany.name,
          email: newCompany.email,
          phone: newCompany.phone,
          address: newCompany.address,
          license_limit: newCompany.license_limit,
          status: newCompany.status
        }])
        .select()
        .single();

      if (companyError) {
        console.error('Company creation error:', companyError);
        throw companyError;
      }

      // Create company admin user
      const { data: adminData, error: adminError } = await supabase.functions.invoke('create-company-admin', {
        body: {
          companyId: companyData.id,
          adminEmail: newCompany.adminEmail,
          adminFirstName: newCompany.adminFirstName,
          adminLastName: newCompany.adminLastName,
          adminPhone: newCompany.adminPhone
        }
      });

      if (adminError) {
        console.error('Admin creation error:', adminError);
        throw adminError;
      }

      const tempPassword = adminData.temporaryPassword;

      toast({
        title: "Success",
        description: `Company "${companyData.name}" created successfully! Admin password: ${tempPassword}`,
        duration: 10000,
      });

      // Show success dialog with admin credentials
      alert(`Company created successfully!\n\nAdmin Login Details:\nEmail: ${newCompany.adminEmail}\nTemporary Password: ${tempPassword}\n\nPlease save these credentials and share them with the company admin. They must change the password on first login.`);

      setNewCompany({
        name: "",
        email: "",
        phone: "",
        address: "",
        license_limit: 10,
        status: "active" as "active" | "inactive" | "suspended",
        adminFirstName: "",
        adminLastName: "",
        adminEmail: "",
        adminPhone: ""
      });
      setShowCreateForm(false);
      await fetchCompanies();
      await fetchGuards();
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

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProperty.company_id) {
      toast({
        title: "Error",
        description: "Please select a company",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .insert([{
          company_id: newProperty.company_id,
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
        phone: "",
        company_id: ""
      });
      setShowPropertyForm(false);
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

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${companyName}"?\n\nThis action will permanently delete:\n- The company record\n- All associated user profiles\n- All guard shifts\n- All incidents\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      setIsLoading(true);
      
      console.log(`Starting deletion process for company: ${companyId}`);
      
      // Step 1: Get all profile IDs for this company first
      console.log('Fetching all profiles for company...');
      const { data: profiles, error: profilesFetchError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('company_id', companyId);

      if (profilesFetchError) {
        console.error('Error fetching profiles:', profilesFetchError);
        throw new Error(`Failed to fetch profiles: ${profilesFetchError.message}`);
      }

      const profileIds = profiles?.map(p => p.id) || [];
      console.log(`Found ${profileIds.length} profiles:`, profileIds);

      // Step 2: Delete ALL guard reports for this company (by company_id AND by guard_id)
      console.log('Deleting all guard reports for company...');
      
      // First delete by company_id
      const { error: reportsCompanyError } = await supabase
        .from('guard_reports')
        .delete()
        .eq('company_id', companyId);

      if (reportsCompanyError) {
        console.error('Error deleting reports by company_id:', reportsCompanyError);
      }

      // Then delete any remaining by guard_id (profile_id)
      if (profileIds.length > 0) {
        const { error: reportsGuardError } = await supabase
          .from('guard_reports')
          .delete()
          .in('guard_id', profileIds);

        if (reportsGuardError) {
          console.error('Error deleting reports by guard_id:', reportsGuardError);
        }
      }

      // Step 3: Delete guard shifts
      console.log('Deleting guard shifts...');
      const { error: shiftsError } = await supabase
        .from('guard_shifts')
        .delete()
        .eq('company_id', companyId);

      if (shiftsError) {
        console.error('Error deleting guard shifts:', shiftsError);
      }

      // Step 4: Delete incidents
      console.log('Deleting incidents...');
      const { error: incidentsError } = await supabase
        .from('incidents')
        .delete()
        .eq('company_id', companyId);

      if (incidentsError) {
        console.error('Error deleting incidents:', incidentsError);
      }

      // Step 5: Delete properties
      console.log('Deleting properties...');
      const { error: propertiesError } = await supabase
        .from('properties')
        .delete()
        .eq('company_id', companyId);

      if (propertiesError) {
        console.error('Error deleting properties:', propertiesError);
      }

      // Step 6: Double-check no guard_reports remain that reference our profiles
      console.log('Checking for remaining guard_reports...');
      if (profileIds.length > 0) {
        const { data: remainingReports, error: checkError } = await supabase
          .from('guard_reports')
          .select('id, guard_id')
          .in('guard_id', profileIds);

        if (remainingReports && remainingReports.length > 0) {
          console.log('Found remaining reports, force deleting:', remainingReports);
          const { error: forceDeleteError } = await supabase
            .from('guard_reports')
            .delete()
            .in('guard_id', profileIds);
          
          if (forceDeleteError) {
            console.error('Force delete failed:', forceDeleteError);
            throw new Error(`Cannot delete remaining guard reports: ${forceDeleteError.message}`);
          }
        }
      }

      // Step 7: Now delete profiles
      console.log('Deleting profiles...');
      const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .eq('company_id', companyId);

      if (profilesError) {
        console.error('Error deleting profiles:', profilesError);
        throw new Error(`Failed to delete user profiles: ${profilesError.message}`);
      }
      console.log('Profiles deleted successfully');

      // Step 8: Finally delete the company
      console.log('Deleting company...');
      const { error: companyError } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (companyError) {
        console.error('Error deleting company:', companyError);
        throw new Error(`Failed to delete company: ${companyError.message}`);
      }
      console.log('Company deleted successfully');

      toast({
        title: "Success",
        description: `Company "${companyName}" has been permanently deleted`,
        variant: "default",
      });

      // Refresh the companies list
      await fetchCompanies();
      await fetchGuards();
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete company",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setShowEditForm(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: editingCompany.name,
          email: editingCompany.email,
          phone: editingCompany.phone,
          address: editingCompany.address,
          license_limit: editingCompany.license_limit,
          status: editingCompany.status
        })
        .eq('id', editingCompany.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Company "${editingCompany.name}" updated successfully!`,
      });

      setShowEditForm(false);
      setEditingCompany(null);
      await fetchCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: "Error",
        description: "Failed to update company",
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
              <h1 className="text-2xl font-bold text-foreground">GuardHQ</h1>
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
                <Users className="h-8 w-8 text-accent" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Guards</p>
                  <p className="text-2xl font-bold">{guardsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="companies" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="companies">Companies</TabsTrigger>
          </TabsList>
          
          <TabsContent value="companies" className="space-y-6">
            {/* Companies Section */}
            <div className="flex justify-between items-center">
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
                {/* Company Information */}
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Company Information</h3>
                </div>
                
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
                  <Label htmlFor="email">Company Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Company Phone</Label>
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
                  <Label htmlFor="address">Company Address</Label>
                  <Input
                    id="address"
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                  />
                </div>

                {/* Admin Information */}
                <div className="md:col-span-2 mt-6">
                  <h3 className="text-lg font-semibold mb-4 text-primary">Company Admin Details</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminFirstName">Admin First Name</Label>
                  <Input
                    id="adminFirstName"
                    value={newCompany.adminFirstName}
                    onChange={(e) => setNewCompany({ ...newCompany, adminFirstName: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminLastName">Admin Last Name</Label>
                  <Input
                    id="adminLastName"
                    value={newCompany.adminLastName}
                    onChange={(e) => setNewCompany({ ...newCompany, adminLastName: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={newCompany.adminEmail}
                    onChange={(e) => setNewCompany({ ...newCompany, adminEmail: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminPhone">Admin Phone</Label>
                  <Input
                    id="adminPhone"
                    value={newCompany.adminPhone}
                    onChange={(e) => setNewCompany({ ...newCompany, adminPhone: e.target.value })}
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

            {/* Edit Company Form */}
            {showEditForm && editingCompany && (
              <Card className="mb-6 shadow-elevated">
                <CardHeader>
                  <CardTitle>Edit Company: {editingCompany.name}</CardTitle>
                  <CardDescription>
                    Update company information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateCompany} className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Company Name</Label>
                      <Input
                        id="edit-name"
                        value={editingCompany.name}
                        onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Company Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editingCompany.email || ""}
                        onChange={(e) => setEditingCompany({ ...editingCompany, email: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Company Phone</Label>
                      <Input
                        id="edit-phone"
                        value={editingCompany.phone || ""}
                        onChange={(e) => setEditingCompany({ ...editingCompany, phone: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-license_limit">License Limit</Label>
                      <Input
                        id="edit-license_limit"
                        type="number"
                        min="1"
                        value={editingCompany.license_limit}
                        onChange={(e) => setEditingCompany({ ...editingCompany, license_limit: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select 
                        value={editingCompany.status} 
                        onValueChange={(value: "active" | "inactive" | "suspended") => 
                          setEditingCompany({ ...editingCompany, status: value })
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
                      <Label htmlFor="edit-address">Company Address</Label>
                      <Input
                        id="edit-address"
                        value={editingCompany.address || ""}
                        onChange={(e) => setEditingCompany({ ...editingCompany, address: e.target.value })}
                      />
                    </div>
                    
                    <div className="md:col-span-2 flex gap-4">
                      <Button type="submit" className="bg-success hover:bg-success/90 text-success-foreground" disabled={isLoading}>
                        {isLoading ? "Updating..." : "Update Company"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowEditForm(false);
                          setEditingCompany(null);
                        }}
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
                        <Button variant="outline" size="sm" onClick={() => handleEditCompany(company)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteCompany(company.id, company.name)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
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
          </TabsContent>



        </Tabs>

      </div>

    </div>
  );
};

export default AdminDashboard;
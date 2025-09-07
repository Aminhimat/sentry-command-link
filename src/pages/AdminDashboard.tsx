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
import { Shield, Plus, Building, Users, Activity, BarChart3, Trash2, MapPin, Calendar, CalendarIcon, FileText, Download, Database } from "lucide-react";
import CompanyAnalytics from "@/components/CompanyAnalytics";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [deleteStartDate, setDeleteStartDate] = useState<Date>();
  const [deleteEndDate, setDeleteEndDate] = useState<Date>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCompanyForDelete, setSelectedCompanyForDelete] = useState<{ id: string; name: string } | null>(null);
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
      `Are you sure you want to delete company "${companyName}"?\n\nThis action will ONLY delete the company record.\nGuards, incidents, reports, and other data will remain in the system.\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      setIsLoading(true);
      
      console.log(`Deleting company record only: ${companyId}`);
      
      // Only delete the company record - preserve all other data
      const { error: companyError } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (companyError) {
        console.error('Error deleting company:', companyError);
        throw new Error(`Failed to delete company: ${companyError.message}`);
      }
      
      console.log('Company record deleted successfully');

      toast({
        title: "Success",
        description: `Company "${companyName}" record has been deleted. All guards and data preserved.`,
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

  const handleChangePassword = () => {
    window.location.href = '/change-password?voluntary=true';
  };

  const handleBulkDeleteReports = (companyId: string, companyName: string) => {
    setSelectedCompanyForDelete({ id: companyId, name: companyName });
    setShowDatePicker(true);
  };

  const executeBulkDelete = async () => {
    if (!selectedCompanyForDelete) return;

    let confirmMessage = `⚠️ DANGER: Delete Reports for "${selectedCompanyForDelete.name}"?\n\n`;
    
    if (deleteStartDate && deleteEndDate) {
      confirmMessage += `This will permanently delete:\n` +
        `• Guard reports from ${format(deleteStartDate, "PPP")} to ${format(deleteEndDate, "PPP")}\n` +
        `• Associated images from storage\n\n`;
    } else {
      confirmMessage += `This will permanently delete:\n` +
        `• ALL guard reports for this company\n` +
        `• ALL associated images from storage\n\n`;
    }
    
    confirmMessage += `This action CANNOT be undone!\n\nAre you absolutely sure you want to proceed?`;
    
    const confirmed = window.confirm(confirmMessage);
    
    if (!confirmed) return;

    try {
      setIsLoading(true);
      
      const requestBody: any = { 
        companyId: selectedCompanyForDelete.id
      };

      // If date range is selected, calculate days to delete
      if (deleteStartDate && deleteEndDate) {
        const now = new Date();
        const endDate = new Date(deleteEndDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        
        if (endDate < now) {
          const daysOld = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          requestBody.deleteOlderThanDays = daysOld;
        }
      }
      
      console.log(`Bulk deleting reports for company: ${selectedCompanyForDelete.id}`, requestBody);
      
      const { data, error } = await supabase.functions.invoke('bulk-delete-reports', {
        body: requestBody
      });

      if (error) {
        console.error('Error in bulk delete:', error);
        throw new Error(`Failed to delete reports: ${error.message}`);
      }
      
      console.log('Bulk delete result:', data);

      toast({
        title: "Reports Deleted Successfully",
        description: `Deleted ${data.deletedCount} reports and ${data.deletedImagesCount} images for "${selectedCompanyForDelete.name}". Storage space has been freed.`,
        variant: "default",
      });

      setShowDatePicker(false);
      setSelectedCompanyForDelete(null);
      setDeleteStartDate(undefined);
      setDeleteEndDate(undefined);

    } catch (error) {
      console.error('Error deleting reports:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete reports",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">GuardHQ</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Platform Administration</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-full sm:max-w-none">
                Welcome, {userProfile?.first_name} {userProfile?.last_name}
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleChangePassword} className="flex-1 sm:flex-initial">
                  Change Password
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="flex-1 sm:flex-initial">
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Building className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Companies</p>
                  <p className="text-xl sm:text-2xl font-bold">{companies.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-success" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Active Companies</p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {companies.filter(c => c.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-warning" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Licenses</p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {companies.reduce((sum, c) => sum + c.license_limit, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Guards</p>
                  <p className="text-xl sm:text-2xl font-bold">{guardsCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analytics" className="text-sm sm:text-base">Analytics</TabsTrigger>
            <TabsTrigger value="companies" className="text-sm sm:text-base">Companies</TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
            <CompanyAnalytics />
          </TabsContent>
          
          <TabsContent value="companies" className="space-y-4 sm:space-y-6">
            {/* Companies Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <h2 className="text-2xl sm:text-3xl font-bold">Security Companies</h2>
              <Button variant="hero" onClick={() => setShowCreateForm(!showCreateForm)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create Company
              </Button>
            </div>

            {/* Create Company Form */}
            {showCreateForm && (
            <Card className="mb-4 sm:mb-6 shadow-elevated">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Create New Security Company</CardTitle>
              <CardDescription className="text-sm">
                Add a new security company to the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCompany} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Company Information */}
                <div className="sm:col-span-2">
                  <h3 className="text-base sm:text-lg font-semibold mb-4 text-primary">Company Information</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">Company Name</Label>
                  <Input
                    id="name"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    required
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">Company Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                    required
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm">Company Phone</Label>
                  <Input
                    id="phone"
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="license_limit" className="text-sm">License Limit</Label>
                  <Input
                    id="license_limit"
                    type="number"
                    min="1"
                    value={newCompany.license_limit}
                    onChange={(e) => setNewCompany({ ...newCompany, license_limit: parseInt(e.target.value) })}
                    required
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm">Status</Label>
                  <Select 
                    value={newCompany.status} 
                    onValueChange={(value: "active" | "inactive" | "suspended") => 
                      setNewCompany({ ...newCompany, status: value })
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address" className="text-sm">Company Address</Label>
                  <Input
                    id="address"
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                    className="text-sm"
                  />
                </div>

                {/* Admin Information */}
                <div className="sm:col-span-2 mt-4 sm:mt-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-4 text-primary">Company Admin Details</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminFirstName" className="text-sm">Admin First Name</Label>
                  <Input
                    id="adminFirstName"
                    value={newCompany.adminFirstName}
                    onChange={(e) => setNewCompany({ ...newCompany, adminFirstName: e.target.value })}
                    required
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminLastName" className="text-sm">Admin Last Name</Label>
                  <Input
                    id="adminLastName"
                    value={newCompany.adminLastName}
                    onChange={(e) => setNewCompany({ ...newCompany, adminLastName: e.target.value })}
                    required
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminEmail" className="text-sm">Admin Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={newCompany.adminEmail}
                    onChange={(e) => setNewCompany({ ...newCompany, adminEmail: e.target.value })}
                    required
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adminPhone" className="text-sm">Admin Phone</Label>
                  <Input
                    id="adminPhone"
                    value={newCompany.adminPhone}
                    onChange={(e) => setNewCompany({ ...newCompany, adminPhone: e.target.value })}
                    className="text-sm"
                  />
                </div>
                
                <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Button type="submit" className="bg-success hover:bg-success/90 text-success-foreground w-full sm:w-auto" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Company"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateForm(false)}
                    className="w-full sm:w-auto"
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
              <Card className="mb-4 sm:mb-6 shadow-elevated">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Edit Company: {editingCompany.name}</CardTitle>
                  <CardDescription className="text-sm">
                    Update company information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateCompany} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name" className="text-sm">Company Name</Label>
                      <Input
                        id="edit-name"
                        value={editingCompany.name}
                        onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                        required
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-email" className="text-sm">Company Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editingCompany.email || ""}
                        onChange={(e) => setEditingCompany({ ...editingCompany, email: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone" className="text-sm">Company Phone</Label>
                      <Input
                        id="edit-phone"
                        value={editingCompany.phone || ""}
                        onChange={(e) => setEditingCompany({ ...editingCompany, phone: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-license_limit" className="text-sm">License Limit</Label>
                      <Input
                        id="edit-license_limit"
                        type="number"
                        min="1"
                        value={editingCompany.license_limit}
                        onChange={(e) => setEditingCompany({ ...editingCompany, license_limit: parseInt(e.target.value) })}
                        required
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-status" className="text-sm">Status</Label>
                      <Select 
                        value={editingCompany.status} 
                        onValueChange={(value: "active" | "inactive" | "suspended") => 
                          setEditingCompany({ ...editingCompany, status: value })
                        }
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="edit-address" className="text-sm">Company Address</Label>
                      <Input
                        id="edit-address"
                        value={editingCompany.address || ""}
                        onChange={(e) => setEditingCompany({ ...editingCompany, address: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Button type="submit" className="bg-success hover:bg-success/90 text-success-foreground w-full sm:w-auto" disabled={isLoading}>
                        {isLoading ? "Updating..." : "Update Company"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowEditForm(false);
                          setEditingCompany(null);
                        }}
                        className="w-full sm:w-auto"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Companies List */}
            <div className="grid gap-4 sm:gap-6">
              {companies.map((company) => (
                <Card key={company.id} className="shadow-card hover:shadow-elevated transition-smooth">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                            <h3 className="text-lg sm:text-xl font-semibold break-words">{company.name}</h3>
                            {getStatusBadge(company.status)}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm text-muted-foreground">
                            <div className="space-y-1">
                              <p><strong>Email:</strong> <span className="break-all">{company.email || 'Not provided'}</span></p>
                              <p><strong>Phone:</strong> {company.phone || 'Not provided'}</p>
                            </div>
                            <div className="space-y-1">
                              <p><strong>License Limit:</strong> {company.license_limit} users</p>
                              <p><strong>Guards Created:</strong> <span className="font-semibold text-primary">{guards.filter(guard => guard.company_id === company.id).length}</span> guards</p>
                              <p><strong>Created:</strong> {new Date(company.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          {company.address && (
                            <p className="text-sm text-muted-foreground mt-2 break-words">
                              <strong>Address:</strong> {company.address}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCompany(company)}
                          className="w-full sm:w-auto text-xs sm:text-sm"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm"
                        >
                          View Details
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => handleBulkDeleteReports(company.id, company.name)}
                          disabled={isLoading}
                          className="bg-warning text-warning-foreground hover:bg-warning/90 w-full sm:w-auto text-xs sm:text-sm"
                        >
                          <Database className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Delete Reports
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteCompany(company.id, company.name)}
                          disabled={isLoading}
                          className="w-full sm:w-auto text-xs sm:text-sm"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {companies.length === 0 && (
                <Card className="shadow-card">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <Building className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold mb-2">No Companies Yet</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4">
                      Get started by creating your first security company
                    </p>
                    <Button variant="hero" onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Company
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>



        </Tabs>

        {/* Date Range Picker Modal for Bulk Delete */}
        {showDatePicker && selectedCompanyForDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Delete Reports for {selectedCompanyForDelete.name}</CardTitle>
                <CardDescription className="text-sm">
                  Select date range to delete reports, or leave empty to delete all reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">From Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-sm",
                          !deleteStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deleteStartDate ? format(deleteStartDate, "PPP") : "Select start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={deleteStartDate}
                        onSelect={setDeleteStartDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">To Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-sm",
                          !deleteEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deleteEndDate ? format(deleteEndDate, "PPP") : "Select end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={deleteEndDate}
                        onSelect={setDeleteEndDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDatePicker(false);
                      setSelectedCompanyForDelete(null);
                      setDeleteStartDate(undefined);
                      setDeleteEndDate(undefined);
                    }}
                    className="flex-1 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={executeBulkDelete}
                    disabled={isLoading}
                    className="flex-1 text-sm"
                  >
                    {isLoading ? "Deleting..." : "Delete Reports"}
                   </Button>
                 </div>
               </CardContent>
             </Card>
           </div>
         )}

       </div>

     </div>
   );
 };

 export default AdminDashboard;
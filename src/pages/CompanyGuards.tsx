import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Users, ArrowLeft, Eye, Edit, Trash2, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";

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
  username?: string;
  is_active: boolean;
  created_at: string;
  company_id?: string;
  role?: string;
  updated_at?: string;
  assigned_property_id?: string;
  assigned_property?: {
    id: string;
    name: string;
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

const CompanyGuards = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateGuardForm, setShowCreateGuardForm] = useState(false);
  const [showEditGuardForm, setShowEditGuardForm] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Guard | null>(null);
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
    username: "",
    newPassword: "",
    assignedPropertyId: "none"
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
      await fetchCompany(profile.company_id);
      await fetchGuards(profile.company_id);
      await fetchProperties(profile.company_id);
    } catch (error) {
      console.error('Error checking user:', error);
      window.location.href = '/auth';
    } finally {
      setIsLoading(false);
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

  const fetchGuards = async (companyId: string) => {
    console.log('Fetching guards for company:', companyId);

    try {
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

      const guardsWithData = (guardProfiles || []).map(guard => ({
        ...guard,
        email: guard.username ? `${guard.username}@company.local` : `${guard.first_name?.toLowerCase() || 'unknown'}.${guard.last_name?.toLowerCase() || 'user'}@company.local`,
        assigned_property: guard.properties,
        assigned_property_id: guard.assigned_property_id
      }));

      setGuards(guardsWithData);
    } catch (error) {
      console.error('Error fetching guards:', error);
    }
  };

  const fetchProperties = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        return;
      }

      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleCreateGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.company_id) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-guard', {
        body: {
          firstName: newGuard.firstName,
          lastName: newGuard.lastName,
          username: newGuard.username,
          password: newGuard.password,
          companyId: userProfile.company_id,
          assignedPropertyId: newGuard.assignedPropertyId !== "none" ? newGuard.assignedPropertyId : null
        }
      });

      if (error) {
        console.error('Guard creation error:', error);
        throw error;
      }

      if (data?.error) {
        // Check if it's a duplicate username/email error
        if (data.error.includes('email address has already been registered')) {
          throw new Error(`Username "${newGuard.username}" is already taken. Please choose a different username.`);
        }
        throw new Error(data.error);
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
      await fetchGuards(userProfile.company_id);
    } catch (error) {
      console.error('Error creating guard:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create guard",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuard) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('update-guard', {
        body: {
          guardId: editingGuard.id,
          firstName: editGuardData.firstName,
          lastName: editGuardData.lastName,
          phone: editGuardData.phone,
          username: editGuardData.username || "none",
          newPassword: editGuardData.newPassword || "none",
          assignedPropertyId: editGuardData.assignedPropertyId !== "none" ? editGuardData.assignedPropertyId : null
        }
      });

      if (error) {
        console.error('Guard update error:', error);
        throw new Error(error.message || 'Failed to update guard');
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to update guard');
      }

      toast({
        title: "Success",
        description: `Guard ${editGuardData.firstName} ${editGuardData.lastName} updated successfully!`,
      });

      setEditingGuard(null);
      setShowEditGuardForm(false);
      setEditGuardData({
        firstName: "",
        lastName: "",
        phone: "",
        username: "",
        newPassword: "",
        assignedPropertyId: "none"
      });
      
      if (userProfile?.company_id) {
        await fetchGuards(userProfile.company_id);
      }
    } catch (error) {
      console.error('Error updating guard:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update guard",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleGuardActive = async (guard: Guard) => {
    const newStatus = !guard.is_active;
    const action = newStatus ? "activate" : "deactivate";
    
    if (!confirm(`Are you sure you want to ${action} ${guard.first_name} ${guard.last_name}? ${!newStatus ? 'They will not be able to login.' : 'They will be able to login.'}`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', guard.id);

      if (error) {
        console.error('Guard status update error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Guard ${guard.first_name} ${guard.last_name} has been ${newStatus ? 'activated' : 'deactivated'}.`,
      });

      if (userProfile?.company_id) {
        await fetchGuards(userProfile.company_id);
      }
    } catch (error) {
      console.error('Error updating guard status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update guard status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGuard = async (guard: Guard) => {
    if (!confirm(`Are you sure you want to delete ${guard.first_name} ${guard.last_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('delete-guard', {
        body: {
          guardId: guard.id
        }
      });

      if (error) {
        console.error('Guard deletion error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Guard ${guard.first_name} ${guard.last_name} deleted successfully!`,
      });

      if (userProfile?.company_id) {
        await fetchGuards(userProfile.company_id);
      }
    } catch (error) {
      console.error('Error deleting guard:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete guard",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading guards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 font-sans">
      {/* Enhanced Header with Gradient */}
      <div className="border-b bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="flex h-20 items-center px-6 max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link to="/company">
              <Button variant="outline" size="sm" className="shadow-sm hover:shadow-md transition-all">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-10 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-md">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  Guards Roster
                </h1>
                <p className="text-sm text-muted-foreground">
                  {company?.name} • Manage Security Guard Team
                </p>
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <Button 
              onClick={() => setShowCreateGuardForm(true)}
              className="shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary to-primary-glow"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Guard
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Create Guard Form */}
        {showCreateGuardForm && (
          <Card className="mb-6 shadow-lg border-primary/20 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary-glow/5 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Create New Guard</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateGuardForm(false)} className="hover:bg-destructive/10 hover:text-destructive">
                  ×
                </Button>
              </div>
              <CardDescription className="mt-2">
                Add a new security guard to your team
              </CardDescription>
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

        {/* Edit Guard Form */}
        {showEditGuardForm && editingGuard && (
          <Card className="mb-6 shadow-lg border-primary/20 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary-glow/5 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Edit className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Edit Guard: {editingGuard.first_name} {editingGuard.last_name}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowEditGuardForm(false);
                  setEditingGuard(null);
                }} className="hover:bg-destructive/10 hover:text-destructive">
                  ×
                </Button>
              </div>
              <CardDescription className="mt-2">
                Update guard information and assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditGuard} className="space-y-6">
                {/* Basic Information */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      type="tel"
                      value={editGuardData.phone}
                      onChange={(e) => setEditGuardData({...editGuardData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editUsername">Username</Label>
                    <Input
                      id="editUsername"
                      type="text"
                      value={editGuardData.username}
                      onChange={(e) => setEditGuardData({...editGuardData, username: e.target.value})}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Current: {editingGuard?.user_id ? guards.find(g => g.id === editingGuard.id)?.user_id?.split('@')[0] || 'N/A' : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="editPassword">New Password (Optional)</Label>
                    <Input
                      id="editPassword"
                      type="password"
                      value={editGuardData.newPassword}
                      onChange={(e) => setEditGuardData({ ...editGuardData, newPassword: e.target.value })}
                      minLength={6}
                      placeholder="Leave blank to keep current password"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Only enter a password if you want to change it
                    </p>
                  </div>
                  <div>
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
                </div>
                
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Updating..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg border-primary/10">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary-glow/5 border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Guards Roster
            </CardTitle>
            <CardDescription>
              Manage your security guard team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {guards.length === 0 ? (
                <div className="text-center p-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Guards Added</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by adding your first security guard to manage your team
                  </p>
                  <Button variant="outline" onClick={() => setShowCreateGuardForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Guard
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guard Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Assigned Property</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guards.map((guard) => (
                      <TableRow key={guard.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {guard.first_name?.charAt(0) || 'G'}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{guard.first_name} {guard.last_name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{guard.email}</TableCell>
                        <TableCell className="text-sm">{guard.phone || 'Not provided'}</TableCell>
                        <TableCell className="text-sm">{guard.assigned_property?.name || 'None'}</TableCell>
                        <TableCell>
                          <Badge variant={guard.is_active ? "default" : "secondary"}>
                            {guard.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(guard.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleToggleGuardActive(guard)}
                              className={guard.is_active ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                              disabled={isLoading}
                              title={guard.is_active ? "Deactivate Guard" : "Activate Guard"}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setEditingGuard(guard);
                                
                                setEditGuardData({
                                  firstName: guard.first_name || "",
                                  lastName: guard.last_name || "",
                                  phone: guard.phone || "",
                                  username: guard.username || "",
                                  newPassword: "",
                                  assignedPropertyId: guard.assigned_property_id || "none"
                                });
                                setShowEditGuardForm(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDeleteGuard(guard)}
                              className="text-destructive hover:text-destructive"
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanyGuards;
import { useState, useEffect } from "react";
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
    newPassword: "",
    assignedPropertyId: "none",
    // Login constraints
    hasLoginConstraints: false,
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    durationHours: ""
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

      const guardsWithPlaceholderEmails = (guardProfiles || []).map(guard => ({
        ...guard,
        email: `${guard.first_name?.toLowerCase() || 'unknown'}.${guard.last_name?.toLowerCase() || 'user'}@company.local`,
        assigned_property: guard.properties,
        assigned_property_id: guard.assigned_property_id // Make sure this is available for the edit form
      }));

      setGuards(guardsWithPlaceholderEmails);
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
          newPassword: editGuardData.newPassword || null,
          assignedPropertyId: editGuardData.assignedPropertyId !== "none" ? editGuardData.assignedPropertyId : null
        }
      });

      if (error) {
        console.error('Guard update error:', error);
        throw error;
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
        newPassword: "",
        assignedPropertyId: "none",
        hasLoginConstraints: false,
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        durationHours: ""
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <Link to="/company">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-semibold tracking-wide">GUARDS ROSTER</h1>
              <p className="text-sm text-muted-foreground">
                {company?.name} - Manage your security guard team
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setShowCreateGuardForm(true)}>
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

        {/* Edit Guard Form */}
        {showEditGuardForm && editingGuard && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Guard: {editingGuard.first_name} {editingGuard.last_name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowEditGuardForm(false);
                  setEditingGuard(null);
                }}>
                  ×
                </Button>
              </div>
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
                    <Label htmlFor="editPassword">New Password (optional)</Label>
                    <Input
                      id="editPassword"
                      type="password"
                      value={editGuardData.newPassword}
                      onChange={(e) => setEditGuardData({ ...editGuardData, newPassword: e.target.value })}
                      placeholder="Leave blank to keep current"
                    />
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

                {/* Login Constraints Section - VISIBLE BOX */}
                <div className="bg-blue-50 border-4 border-blue-300 rounded-lg p-8 my-6">
                  <h3 className="text-xl font-bold text-blue-800 mb-4">
                    🕒 LOGIN TIME RESTRICTIONS
                  </h3>
                  <div className="flex items-center space-x-3 mb-6">
                    <input
                      type="checkbox"
                      id="hasLoginConstraints"
                      checked={editGuardData.hasLoginConstraints}
                      onChange={(e) => setEditGuardData({...editGuardData, hasLoginConstraints: e.target.checked})}
                      className="h-6 w-6 rounded border-2 border-blue-500 text-blue-600"
                    />
                    <Label htmlFor="hasLoginConstraints" className="text-lg font-semibold text-blue-800">
                      Enable login time restrictions for this guard
                    </Label>
                  </div>
                  <p className="text-blue-700 mb-6 text-base">
                    Check the box above to set specific dates, times, and duration when this guard can log into the system.
                  </p>
                  
                  {editGuardData.hasLoginConstraints && (
                    <div className="bg-white p-6 rounded-lg border-2 border-blue-200">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <Label htmlFor="startDate" className="text-blue-800 font-medium">Start Date</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={editGuardData.startDate}
                            onChange={(e) => setEditGuardData({...editGuardData, startDate: e.target.value})}
                            className="border-blue-300"
                          />
                        </div>
                        <div>
                          <Label htmlFor="endDate" className="text-blue-800 font-medium">End Date</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={editGuardData.endDate}
                            onChange={(e) => setEditGuardData({...editGuardData, endDate: e.target.value})}
                            className="border-blue-300"
                          />
                        </div>
                        <div>
                          <Label htmlFor="durationHours" className="text-blue-800 font-medium">Duration (Hours)</Label>
                          <Input
                            id="durationHours"
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={editGuardData.durationHours}
                            onChange={(e) => setEditGuardData({...editGuardData, durationHours: e.target.value})}
                            placeholder="e.g., 8"
                            className="border-blue-300"
                          />
                        </div>
                        <div>
                          <Label htmlFor="startTime" className="text-blue-800 font-medium">Start Time</Label>
                          <Input
                            id="startTime"
                            type="time"
                            value={editGuardData.startTime}
                            onChange={(e) => setEditGuardData({...editGuardData, startTime: e.target.value})}
                            className="border-blue-300"
                          />
                        </div>
                        <div>
                          <Label htmlFor="endTime" className="text-blue-800 font-medium">End Time</Label>
                          <Input
                            id="endTime"
                            type="time"
                            value={editGuardData.endTime}
                            onChange={(e) => setEditGuardData({...editGuardData, endTime: e.target.value})}
                            className="border-blue-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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

        <Card>
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
                              onClick={async () => {
                                setEditingGuard(guard);
                                
                                // Fetch existing login constraints
                                const { data: constraints } = await supabase
                                  .from('guard_login_constraints')
                                  .select('*')
                                  .eq('guard_id', guard.id)
                                  .maybeSingle();
                                
                                setEditGuardData({
                                  firstName: guard.first_name || "",
                                  lastName: guard.last_name || "",
                                  phone: guard.phone || "",
                                  newPassword: "",
                                  assignedPropertyId: guard.assigned_property_id || "none",
                                  hasLoginConstraints: !!constraints,
                                  startDate: constraints?.start_date || "",
                                  endDate: constraints?.end_date || "",
                                  startTime: constraints?.start_time || "",
                                  endTime: constraints?.end_time || "",
                                  durationHours: constraints?.duration_hours?.toString() || ""
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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, MapPin, ArrowLeft, Eye, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  first_name: string;
  last_name: string;
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

const CompanyProperties = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPropertiesForm, setShowPropertiesForm] = useState(false);
  const [newProperty, setNewProperty] = useState({
    name: "",
    location_address: "",
    email: "",
    phone: ""
  });
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
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

      if (profile.role !== 'company_admin' && profile.role !== 'platform_admin') {
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

  const fetchProperties = async (companyId: string) => {
    console.log('Fetching properties for company:', companyId);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        toast({
          title: "Error",
          description: "Failed to fetch properties",
          variant: "destructive",
        });
        return;
      }

      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.company_id) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .insert([{
          company_id: userProfile.company_id,
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
        phone: ""
      });
      setShowPropertiesForm(false);
      await fetchProperties(userProfile.company_id);
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

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setNewProperty({
      name: property.name,
      location_address: property.location_address || "",
      email: property.email || "",
      phone: property.phone || ""
    });
    setShowEditForm(true);
  };

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .update({
          name: newProperty.name,
          location_address: newProperty.location_address,
          email: newProperty.email,
          phone: newProperty.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProperty.id)
        .select()
        .single();

      if (error) {
        console.error('Property update error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Property "${data.name}" updated successfully!`,
      });

      setNewProperty({
        name: "",
        location_address: "",
        email: "",
        phone: ""
      });
      setShowEditForm(false);
      setEditingProperty(null);
      
      // Re-fetch properties for the correct company
      const companyId = userProfile?.role === 'platform_admin' ? editingProperty.company_id : userProfile?.company_id;
      if (companyId) {
        await fetchProperties(companyId);
      }
    } catch (error) {
      console.error('Error updating property:', error);
      toast({
        title: "Error",
        description: "Failed to update property",
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
          <p className="text-muted-foreground">Loading properties...</p>
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
              <h1 className="text-xl font-semibold tracking-wide">PROPERTIES & SITES</h1>
              <p className="text-sm text-muted-foreground">
                {company?.name} - Manage your security locations
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setShowPropertiesForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Create Property Form */}
        {showPropertiesForm && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Property/Site</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowPropertiesForm(false)}>
                  ×
                </Button>
              </div>
              <CardDescription>
                Add a new property or site location for your security operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProperty} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="property-name">Property Name *</Label>
                    <Input
                      id="property-name"
                      value={newProperty.name}
                      onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                      placeholder="e.g., Downtown Office Complex"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="property-email">Contact Email</Label>
                    <Input
                      id="property-email"
                      type="email"
                      value={newProperty.email}
                      onChange={(e) => setNewProperty({ ...newProperty, email: e.target.value })}
                      placeholder="contact@property.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="property-address">Full Address *</Label>
                  <Input
                    id="property-address"
                    value={newProperty.location_address}
                    onChange={(e) => setNewProperty({ ...newProperty, location_address: e.target.value })}
                    placeholder="Full address of the property"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="property-phone">Contact Phone</Label>
                  <Input
                    id="property-phone"
                    value={newProperty.phone}
                    onChange={(e) => setNewProperty({ ...newProperty, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="flex gap-4 items-end">
                  <Button type="submit" className="bg-success hover:bg-success/90 text-success-foreground" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Add Property"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowPropertiesForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Edit Property Form */}
        {showEditForm && editingProperty && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Property/Site</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowEditForm(false);
                  setEditingProperty(null);
                  setNewProperty({
                    name: "",
                    location_address: "",
                    email: "",
                    phone: ""
                  });
                }}>
                  ×
                </Button>
              </div>
              <CardDescription>
                Update property or site location details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProperty} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-property-name">Property Name *</Label>
                    <Input
                      id="edit-property-name"
                      value={newProperty.name}
                      onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                      placeholder="e.g., Downtown Office Complex"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-property-email">Contact Email</Label>
                    <Input
                      id="edit-property-email"
                      type="email"
                      value={newProperty.email}
                      onChange={(e) => setNewProperty({ ...newProperty, email: e.target.value })}
                      placeholder="contact@property.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-property-address">Full Address *</Label>
                  <Input
                    id="edit-property-address"
                    value={newProperty.location_address}
                    onChange={(e) => setNewProperty({ ...newProperty, location_address: e.target.value })}
                    placeholder="Full address of the property"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-property-phone">Contact Phone</Label>
                  <Input
                    id="edit-property-phone"
                    value={newProperty.phone}
                    onChange={(e) => setNewProperty({ ...newProperty, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="flex gap-4 items-end">
                  <Button type="submit" className="bg-success hover:bg-success/90 text-success-foreground" disabled={isLoading}>
                    {isLoading ? "Updating..." : "Update Property"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowEditForm(false);
                      setEditingProperty(null);
                      setNewProperty({
                        name: "",
                        location_address: "",
                        email: "",
                        phone: ""
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Properties & Sites Management
            </CardTitle>
            <CardDescription>
              Manage the locations where your security services are provided
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {properties.length === 0 ? (
                <div className="text-center p-12">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Properties Added</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by adding your first property or site location to manage your security operations
                  </p>
                  <Button variant="outline" onClick={() => setShowPropertiesForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Property
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {properties.map((property) => (
                    <Card key={property.id} className="shadow-card hover:shadow-elevated transition-smooth">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <MapPin className="h-5 w-5 text-primary" />
                              <h3 className="text-xl font-semibold">{property.name}</h3>
                              <Badge variant={property.is_active ? "default" : "secondary"}>
                                {property.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                              <div>
                                <p><strong>Address:</strong> {property.location_address || 'Not provided'}</p>
                                <p><strong>Email:</strong> {property.email || 'Not provided'}</p>
                              </div>
                              <div>
                                <p><strong>Phone:</strong> {property.phone || 'Not provided'}</p>
                                <p><strong>Created:</strong> {new Date(property.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditProperty(property)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanyProperties;
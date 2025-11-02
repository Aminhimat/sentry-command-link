import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, MapPin, ArrowLeft, Eye, Edit, Activity, Calendar } from "lucide-react";
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
                <MapPin className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  Properties & Sites
                </h1>
                <p className="text-xs text-muted-foreground">
                  {company?.name} • Security Locations Management
                </p>
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <Button 
              onClick={() => setShowPropertiesForm(true)}
              className="shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-primary to-primary-glow"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Property
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* Create Property Form */}
        {showPropertiesForm && (
          <Card className="mb-6 shadow-lg border-primary/20 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary-glow/5 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Add New Property/Site</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPropertiesForm(false)} className="hover:bg-destructive/10 hover:text-destructive">
                  ×
                </Button>
              </div>
              <CardDescription className="mt-2">
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
          <Card className="mb-6 shadow-lg border-accent/20 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-accent/5 to-accent/10 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Edit className="h-5 w-5 text-accent" />
                  </div>
                  <CardTitle className="text-xl">Edit Property/Site</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowEditForm(false);
                  setEditingProperty(null);
                  setNewProperty({
                    name: "",
                    location_address: "",
                    email: "",
                    phone: ""
                  });
                }} className="hover:bg-destructive/10 hover:text-destructive">
                  ×
                </Button>
              </div>
              <CardDescription className="mt-2">
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

        <Card className="shadow-lg border-border/50">
          <CardHeader className="bg-gradient-to-r from-secondary/30 to-secondary/10 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  All Properties & Sites
                </CardTitle>
                <CardDescription className="mt-2 text-xs">
                  {properties.length} {properties.length === 1 ? 'location' : 'locations'} where your security services are provided
                </CardDescription>
              </div>
              {properties.length > 0 && (
                <Badge variant="outline" className="text-xs px-3 py-1">
                  {properties.length} Total
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {properties.length === 0 ? (
                <div className="text-center p-16 bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-xl border-2 border-dashed border-border">
                  <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                    <MapPin className="h-16 w-16 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">No Properties Added Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-lg">
                    Start by adding your first property or site location to manage your security operations effectively
                  </p>
                  <Button 
                    onClick={() => setShowPropertiesForm(true)}
                    size="lg"
                    className="shadow-lg bg-gradient-to-r from-primary to-primary-glow"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Your First Property
                  </Button>
                </div>
              ) : (
                <div className="grid gap-5">
                  {properties.map((property, index) => (
                    <Card 
                      key={property.id} 
                      className="shadow-md hover:shadow-xl transition-all duration-300 border-l-4 hover:scale-[1.01] animate-fade-in"
                      style={{ 
                        borderLeftColor: property.is_active ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary-glow/20 shadow-sm">
                                <MapPin className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-base font-bold text-foreground">{property.name}</h3>
                                <Badge 
                                  variant={property.is_active ? "default" : "secondary"}
                                  className="mt-1 text-xs"
                                >
                                  {property.is_active ? '✓ Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-6 text-xs bg-secondary/20 rounded-lg p-4">
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-foreground text-xs">Address</p>
                                    <p className="text-muted-foreground text-xs">{property.location_address || 'Not provided'}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Activity className="h-3 w-3 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-foreground text-xs">Email</p>
                                    <p className="text-muted-foreground text-xs">{property.email || 'Not provided'}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <Shield className="h-3 w-3 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-foreground text-xs">Phone</p>
                                    <p className="text-muted-foreground text-xs">{property.phone || 'Not provided'}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="font-semibold text-foreground text-xs">Created</p>
                                    <p className="text-muted-foreground text-xs">{new Date(property.created_at).toLocaleDateString()}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button variant="outline" size="sm" className="shadow-sm hover:shadow-md transition-all">
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditProperty(property)}
                              className="shadow-sm hover:shadow-md transition-all hover:bg-accent/10"
                            >
                              <Edit className="h-4 w-4 mr-2" />
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
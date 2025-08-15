import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Lock, MapPin } from "lucide-react";

const AuthPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "platform_admin"
  });
  const [isGuardLogin, setIsGuardLogin] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedWorkSite, setSelectedWorkSite] = useState("");
  const [loadingProperties, setLoadingProperties] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle redirect after authentication
        if (session?.user) {
          console.log('AuthPage: User session detected', {
            email: session.user.email,
            role: session.user.user_metadata?.role,
            must_change_password: session.user.user_metadata?.must_change_password,
            metadata: session.user.user_metadata
          });
          
          // Check if user needs to change password
          if (session.user.user_metadata?.must_change_password === true) {
            console.log('AuthPage: Redirecting to change-password');
            window.location.href = '/change-password';
          } else {
            // Redirect based on role
            const role = session.user.user_metadata?.role;
            console.log('AuthPage: Redirecting based on role:', role);
            if (role === 'platform_admin') {
              window.location.href = '/admin';
            } else if (role === 'company_admin') {
              window.location.href = '/company';
            } else if (role === 'guard') {
              window.location.href = '/guard';
            } else {
              window.location.href = '/';
            }
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Handle redirect for existing session
      if (session?.user) {
        console.log('AuthPage: Existing session detected', {
          email: session.user.email,
          role: session.user.user_metadata?.role,
          must_change_password: session.user.user_metadata?.must_change_password,
          metadata: session.user.user_metadata
        });
        
        // Check if user needs to change password
        if (session.user.user_metadata?.must_change_password === true) {
          console.log('AuthPage: Redirecting to change-password');
          window.location.href = '/change-password';
        } else {
          // Redirect based on role
          const role = session.user.user_metadata?.role;
          console.log('AuthPage: Redirecting based on role:', role);
          if (role === 'platform_admin') {
            window.location.href = '/admin';
          } else if (role === 'company_admin') {
            window.location.href = '/company';
          } else if (role === 'guard') {
            window.location.href = '/guard';
          } else {
            window.location.href = '/';
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch properties when guard login is enabled
  useEffect(() => {
    if (isGuardLogin) {
      fetchProperties();
    } else {
      setProperties([]);
      setSelectedWorkSite("");
    }
  }, [isGuardLogin]);

  const fetchProperties = async () => {
    setLoadingProperties(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          name,
          location_address,
          companies (
            name
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching properties:', error);
        toast({
          title: "Warning",
          description: "Could not load work sites. You can still sign in.",
          variant: "destructive",
        });
      } else {
        setProperties(data || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoadingProperties(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate work site selection for guards
    if (isGuardLogin && !selectedWorkSite) {
      toast({
        title: "Work Site Required",
        description: "Please select your work site before signing in.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Check if input is username (no @ symbol) and convert to email format
      let emailToUse = formData.email;
      if (isGuardLogin && !formData.email.includes('@')) {
        emailToUse = `${formData.email}@company.local`;
      }
      
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: formData.password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // If guard login and work site selected, update the profile with current work site
      if (isGuardLogin && selectedWorkSite && authData.user) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              assigned_property_id: selectedWorkSite,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', authData.user.id);

          if (profileError) {
            console.error('Error updating work site assignment:', profileError);
            // Don't prevent login, just log the error
          } else {
            console.log('Work site assignment updated successfully:', selectedWorkSite);
          }
        } catch (updateError) {
          console.error('Error updating profile:', updateError);
          // Don't prevent login, just log the error
        }
      }

      toast({
        title: "Success",
        description: isGuardLogin 
          ? `Signed in successfully! Assigned to ${properties.find(p => p.id === selectedWorkSite)?.name || 'selected work site'}`
          : "Signed in successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            role: formData.role
          }
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Account created successfully! Check your email for verification.",
        });
        setIsSignUp(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Success",
      description: "Signed out successfully!",
    });
  };

  if (user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl">Welcome!</CardTitle>
            <CardDescription>You are signed in as {user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleSignOut} 
              variant="outline" 
              className="w-full"
            >
              Sign Out
            </Button>
            <Button 
              onClick={() => window.location.href = '/admin'}
              variant="hero" 
              className="w-full"
            >
              Go to Admin Panel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">
            {isSignUp ? "Create Admin Account" : isGuardLogin ? "GuardHQ Sign In" : "Admin Sign In"}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? "Create your platform administrator account" 
              : isGuardLogin
              ? "Sign in with your username and password"
              : "Sign in to manage your security platform"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">{isGuardLogin ? "Username" : "Email"}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type={isGuardLogin ? "text" : "email"}
                  placeholder={isGuardLogin ? "username" : "admin@example.com"}
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
            </div>
            
            {/* Work Site Selection for Guards */}
            {isGuardLogin && (
              <div className="space-y-2">
                <Label htmlFor="workSite">Work Site *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Select 
                    value={selectedWorkSite} 
                    onValueChange={setSelectedWorkSite}
                    required
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder={loadingProperties ? "Loading sites..." : "Select your work site"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border shadow-lg z-50">
                      {loadingProperties ? (
                        <SelectItem value="loading" disabled>Loading work sites...</SelectItem>
                      ) : properties.length === 0 ? (
                        <SelectItem value="no-sites" disabled>No work sites available</SelectItem>
                      ) : (
                        properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{property.name}</span>
                              {property.companies?.name && (
                                <span className="text-xs text-muted-foreground">{property.companies.name}</span>
                              )}
                              {property.location_address && (
                                <span className="text-xs text-muted-foreground">{property.location_address}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {isGuardLogin && !loadingProperties && properties.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No work sites found. Contact your administrator to set up work sites.
                  </p>
                )}
              </div>
            )}
            
            <Button 
              type="submit" 
              variant="hero" 
              className="w-full" 
              disabled={isLoading || (isGuardLogin && !selectedWorkSite)}
            >
              {isLoading 
                ? "Loading..." 
                : isSignUp ? "Create Account" : "Sign In"
              }
            </Button>
            
            <div className="text-center space-y-2">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  if (!isSignUp) {
                    setIsGuardLogin(!isGuardLogin);
                    setFormData({ ...formData, email: "" });
                  }
                }}
                className="text-sm"
              >
                {isGuardLogin ? "Admin Login" : "GuardHQ Login"}
              </Button>
              
              {!isGuardLogin && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm block mx-auto"
                >
                  {isSignUp 
                    ? "Already have an account? Sign in" 
                    : "Need an admin account? Sign up"
                  }
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
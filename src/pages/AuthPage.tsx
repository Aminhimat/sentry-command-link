import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Lock } from "lucide-react";

const AuthPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "platform_admin"
  });
  const [isGuardLogin, setIsGuardLogin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Don't redirect if already on change-password page
    if (window.location.pathname === '/change-password') {
      return;
    }
    
    // Check URL params for guard mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'guard') {
      setIsGuardLogin(true);
    }
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Don't redirect if already on change-password page
        if (window.location.pathname === '/change-password') {
          return;
        }
        
        // Handle redirect after authentication
        if (session?.user) {
          console.log('AuthPage: User session detected', {
            email: session.user.email,
            role: session.user.user_metadata?.role,
            must_change_password: session.user.user_metadata?.must_change_password,
            metadata: session.user.user_metadata
          });
          
          setIsRedirecting(true);
          
          // Check if user needs to change password (database flag)
          setTimeout(() => {
            supabase
              .from('profiles')
              .select('requires_password_change')
              .eq('user_id', session.user!.id)
              .single()
              .then(({ data: profile }) => {
                if (profile?.requires_password_change) {
                  navigate('/change-password');
                  return;
                }
                
                // Check if user needs to change password (metadata flag)
                if (session.user!.user_metadata?.must_change_password === true) {
                  console.log('AuthPage: Redirecting to change-password');
                  navigate('/change-password');
                } else {
                  // Redirect based on role
                  const role = session.user!.user_metadata?.role;
                  console.log('AuthPage: Redirecting based on role:', role);
                  if (role === 'platform_admin') {
                    navigate('/admin');
                  } else if (role === 'company_admin') {
                    navigate('/company');
              } else if (role === 'guard') {
                // Validate guard login constraints before navigating
                validateGuardLoginAllowed(session.user!.id).then((allowed) => {
                  if (allowed) {
                    navigate('/guard');
                  } else {
                    setIsRedirecting(false);
                  }
                });
              } else {
                    navigate('/');
                  }
                }
              });
          }, 0);
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
        
        // Check if user needs to change password (database flag)
        supabase
          .from('profiles')
          .select('requires_password_change')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.requires_password_change) {
              navigate('/change-password');
              return;
            }
            
            // Check if user needs to change password (metadata flag)
            if (session.user!.user_metadata?.must_change_password === true) {
              console.log('AuthPage: Redirecting to change-password');
              navigate('/change-password');
            } else {
              // Redirect based on role
              const role = session.user!.user_metadata?.role;
              console.log('AuthPage: Redirecting based on role:', role);
              if (role === 'platform_admin') {
                navigate('/admin');
              } else if (role === 'company_admin') {
                navigate('/company');
              } else if (role === 'guard') {
                // Single session enforcement is handled by the realtime hook in GuardDashboard
                // Validate guard login constraints before navigating
                (async () => {
                  validateGuardLoginAllowed(session.user!.id).then((allowed) => {
                    if (allowed) {
                      navigate('/guard');
                    }
                  });
                })();
              } else {
                navigate('/');
              }
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Validate guard login constraints before allowing access
  const validateGuardLoginAllowed = async (userId: string): Promise<boolean> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, requires_admin_approval')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile?.id) return true; // No profile found, do not block

      // Admin approval disabled - ignore requires_admin_approval flag and proceed


      // For guards, save their current login location
      if (profile.role === 'guard') {
        // Enforce single session by revoking all other refresh tokens
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await supabase.functions.invoke('enforce-single-session', {
              body: { userId },
              headers: { Authorization: `Bearer ${session.access_token}` }
            });
            console.log('Single session enforced - all other sessions logged out');
          }
        } catch (sessionError) {
          console.error('Failed to enforce single session:', sessionError);
        }

        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });

          // Save login location to profile
          await supabase
            .from('profiles')
            .update({
              login_location_lat: position.coords.latitude,
              login_location_lng: position.coords.longitude
            })
            .eq('id', profile.id);

          console.log('Saved guard login location:', position.coords.latitude, position.coords.longitude);
        } catch (locationError) {
          console.error('Failed to get location:', locationError);
          // Allow login even if location fails - they can enable it later
        }
      }

      const { data: constraints } = await supabase
        .from('guard_login_constraints')
        .select('*')
        .eq('guard_id', profile.id)
        .eq('is_active', true);

      if (!constraints || constraints.length === 0) return true; // No constraints means no restriction

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const currentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // Local date
      const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`; // Local time HH:MM:SS

      const isAllowed = constraints.some((c: any) => {
        const hasBoundary = !!(c.start_date || c.end_date || c.start_time || c.end_time);
        if (!hasBoundary) return false;
        // Date checks
        if (c.start_date && currentDate < c.start_date) return false;
        if (c.end_date && currentDate > c.end_date) return false;
        // Time checks (if provided)
        const st = c.start_time ? String(c.start_time).slice(0, 8) : null;
        const et = c.end_time ? String(c.end_time).slice(0, 8) : null;
        if (st && currentTime < st) return false;
        if (et && currentTime > et) return false;
        return true;
      });

      if (!isAllowed) {
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: "Access Restricted",
          description: "Login allowed only during scheduled window. Please try again later.",
        });
        return false;
      }

      return true;
    } catch (err) {
      console.error('Constraint validation error', err);
      await supabase.auth.signOut();
      toast({
        variant: "destructive",
        title: "Access Restricted",
        description: "Unable to verify login restrictions. Please contact your admin.",
      });
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check if input is username (no @ symbol) and convert to email format
      let emailToUse = formData.email;
      if (isGuardLogin && !formData.email.includes('@')) {
        emailToUse = `${formData.email}@company.local`;
      }
      
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: formData.password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
      // Remove success toast for faster login - navigation will happen immediately
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

  if (user && isRedirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
            <CardTitle className="text-2xl">Redirecting...</CardTitle>
            <CardDescription>Please wait</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
              onClick={() => navigate('/admin')}
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center space-y-3">
          <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-primary mx-auto" />
          <CardTitle className="text-xl sm:text-2xl">
            {isSignUp 
              ? "Create Admin Account" 
              : isGuardLogin 
              ? "GuardHQ Sign In" 
              : "Admin Sign In"
            }
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
                    className="pl-10 min-h-[44px]"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
              </div>
            </div>
            
            {!isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-10 min-h-[44px]"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}
            
            <Button 
              type="submit" 
              variant="hero" 
              className="w-full min-h-[48px]" 
              disabled={isLoading}
            >
              {isLoading 
                ? "Processing..." 
                : isSignUp 
                ? "Create Account" 
                : "Sign In"
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
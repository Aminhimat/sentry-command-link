import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Lock, QrCode, Camera } from "lucide-react";
import QrScanner from 'react-qr-scanner';

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
  const [showQrScanner, setShowQrScanner] = useState(false);
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
      } else {
        toast({
          title: "Success",
          description: "Signed in successfully!",
        });
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

  const handleQrCodeScan = async (data: string | null) => {
    if (data) {
      try {
        // Parse QR code data - expected format: "username:password"
        const [username, password] = data.split(':');
        
        if (username && password) {
          setIsLoading(true);
          const emailToUse = `${username}@company.local`;
          
          const { error } = await supabase.auth.signInWithPassword({
            email: emailToUse,
            password: password,
          });

          if (error) {
            toast({
              title: "QR Login Failed",
              description: error.message,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Success",
              description: "QR code login successful!",
            });
            setShowQrScanner(false);
          }
        } else {
          toast({
            title: "Invalid QR Code",
            description: "QR code format is invalid",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "QR Scan Error",
          description: "Failed to process QR code",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleQrError = (err: any) => {
    console.error('QR Scanner error:', err);
    toast({
      title: "Camera Error",
      description: "Failed to access camera. Please check permissions.",
      variant: "destructive",
    });
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
            {isSignUp ? "Create Admin Account" : isGuardLogin ? "Guard Sign In" : "Admin Sign In"}
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
          {isGuardLogin ? (
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Manual Login
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  QR Scan
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Username</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="text"
                        placeholder="username"
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
                  
                  <Button 
                    type="submit" 
                    variant="hero" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="qr" className="space-y-4">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-64 h-64 bg-muted rounded-lg flex flex-col items-center justify-center">
                    {showQrScanner ? (
                      <div className="w-full h-full relative overflow-hidden rounded-lg">
                        <QrScanner
                          delay={300}
                          onError={handleQrError}
                          onScan={handleQrCodeScan}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    ) : (
                      <>
                        <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Click below to start QR code scanning
                        </p>
                        <Button
                          onClick={() => setShowQrScanner(true)}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <QrCode className="h-4 w-4" />
                          Start Scanner
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {showQrScanner && (
                    <Button
                      onClick={() => setShowQrScanner(false)}
                      variant="outline"
                      className="w-full"
                    >
                      Stop Scanner
                    </Button>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Point your camera at a QR code containing guard credentials
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
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
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
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
              
              <Button 
                type="submit" 
                variant="hero" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading 
                  ? "Loading..." 
                  : isSignUp ? "Create Account" : "Sign In"
                }
              </Button>
            </form>
          )}
          
          <div className="text-center space-y-2 mt-4">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                if (!isSignUp) {
                  setIsGuardLogin(!isGuardLogin);
                  setFormData({ ...formData, email: "" });
                  setShowQrScanner(false);
                }
              }}
              className="text-sm"
            >
              {isGuardLogin ? "Admin Login" : "Guard Login"}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
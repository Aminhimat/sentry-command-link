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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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
            navigate('/change-password');
          } else {
            // Redirect based on role
            const role = session.user.user_metadata?.role;
            console.log('AuthPage: Redirecting based on role:', role);
            if (role === 'platform_admin') {
              navigate('/admin');
            } else if (role === 'company_admin') {
              navigate('/company');
            } else if (role === 'guard') {
              navigate('/guard');
            } else {
              navigate('/');
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
          navigate('/change-password');
        } else {
          // Redirect based on role
          const role = session.user.user_metadata?.role;
          console.log('AuthPage: Redirecting based on role:', role);
          if (role === 'platform_admin') {
            navigate('/admin');
          } else if (role === 'company_admin') {
            navigate('/company');
          } else if (role === 'guard') {
            navigate('/guard');
          } else {
            navigate('/');
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: redirectUrl,
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
          description: "Password reset email sent! Check your inbox.",
        });
        setIsForgotPassword(false);
        setFormData({ ...formData, email: "" });
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">
            {isForgotPassword 
              ? "Reset Password" 
              : isSignUp 
              ? "Create Admin Account" 
              : isGuardLogin 
              ? "GuardHQ Sign In" 
              : "Admin Sign In"
            }
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Enter your email to receive a password reset link"
              : isSignUp 
              ? "Create your platform administrator account" 
              : isGuardLogin
              ? "Sign in with your username and password"
              : "Sign in to manage your security platform"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isForgotPassword ? handleForgotPassword : isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            {isSignUp && !isForgotPassword && (
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
            
            {!isForgotPassword && (
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
            )}
            
            <Button 
              type="submit" 
              variant="hero" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading 
                ? "Sending..." 
                : isForgotPassword 
                ? "Send Reset Email"
                : isSignUp 
                ? "Create Account" 
                : "Sign In"
              }
            </Button>
            
            <div className="text-center space-y-2">
              {!isForgotPassword && (
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
              )}
              
              {!isSignUp && !isGuardLogin && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setIsForgotPassword(!isForgotPassword);
                    setFormData({ ...formData, email: "", password: "" });
                  }}
                  className="text-sm"
                >
                  {isForgotPassword ? "Back to Sign In" : "Forgot Password?"}
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
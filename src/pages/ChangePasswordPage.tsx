import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff } from "lucide-react";

const ChangePasswordPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

      // Check if user needs to change password
      const mustChangePassword = user.user_metadata?.must_change_password;
      if (!mustChangePassword) {
        // Redirect to appropriate dashboard based on role
        const role = user.user_metadata?.role;
        if (role === 'platform_admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
        return;
      }

      setUser(user);
    } catch (error) {
      console.error('Error checking user:', error);
      window.location.href = '/auth';
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          ...user?.user_metadata,
          must_change_password: false
        }
      });

      if (passwordError) {
        throw passwordError;
      }

      toast({
        title: "Success",
        description: "Password changed successfully! Redirecting...",
      });

      // Redirect after successful password change
      setTimeout(() => {
        const role = user?.user_metadata?.role;
        if (role === 'platform_admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
      }, 2000);

    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Change Your Password</CardTitle>
          <CardDescription>
            You must change your temporary password before continuing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Password requirements:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>At least 8 characters long</li>
                <li>Include uppercase and lowercase letters</li>
                <li>Include at least one number</li>
                <li>Include at least one special character</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-success hover:bg-success/90" 
              disabled={isLoading}
            >
              {isLoading ? "Changing Password..." : "Change Password"}
            </Button>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { User, Session } from '@supabase/supabase-js';
import { getDeviceInfo } from '@/utils/deviceFingerprint';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const GuardAuthPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [devicePendingApproval, setDevicePendingApproval] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Session established. Navigation will be handled after validation in handleSignIn.
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
        return;
      }

      if (authData.user) {
        // Check if user is a guard and validate login constraints
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, company_id, is_active, requires_admin_approval, first_name, last_name')
          .eq('user_id', authData.user.id)
          .single();

        if (profile?.role === 'guard') {
          // Check if guard is active
          if (!profile.is_active) {
            await supabase.auth.signOut();
            toast({
              variant: "destructive",
              title: "Account Inactive",
              description: "Your account has been deactivated. Please contact your administrator.",
            });
            return;
          }

          // Check device approval
          const deviceInfo = getDeviceInfo();
          console.log('Device Info:', deviceInfo);

          // Check if this device is already registered and approved
          const { data: existingDevice, error: deviceCheckError } = await supabase
            .from('device_logins' as any)
            .select('*')
            .eq('guard_id', profile.id)
            .eq('device_id', deviceInfo.deviceId)
            .maybeSingle();

          if (deviceCheckError) {
            console.error('Error checking device:', deviceCheckError);
          }

          // Check for other active approved devices
          const { data: otherDevices } = await supabase
            .from('device_logins' as any)
            .select('*')
            .eq('guard_id', profile.id)
            .eq('approved', true)
            .neq('device_id', deviceInfo.deviceId);

          if (!existingDevice) {
            // New device - check if concurrent login is allowed
            const guardName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || authData.user.email;
            
            if (otherDevices && otherDevices.length > 0) {
              // Check if any other device allows concurrent login
              const hasConcurrentDevice = otherDevices.some((d: any) => d.allow_concurrent_login);
              
              if (!hasConcurrentDevice) {
                // Register device as pending and block access
                await supabase.from('device_logins' as any).insert({
                  guard_id: profile.id,
                  guard_name: guardName,
                  device_id: deviceInfo.deviceId,
                  device_model: deviceInfo.deviceModel,
                  device_os: deviceInfo.deviceOs,
                  approved: false,
                  allow_concurrent_login: false,
                });

                await supabase.auth.signOut();
                setDevicePendingApproval(true);
                toast({
                  variant: "destructive",
                  title: "Multiple Device Login Blocked",
                  description: "You are already logged in on another device. Admin approval required for concurrent access.",
                });
                return;
              }
            }

            // Register new device
            const { error: insertError } = await supabase
              .from('device_logins' as any)
              .insert({
                guard_id: profile.id,
                guard_name: guardName,
                device_id: deviceInfo.deviceId,
                device_model: deviceInfo.deviceModel,
                device_os: deviceInfo.deviceOs,
                approved: false,
                allow_concurrent_login: false,
              });

            if (insertError) {
              console.error('Error registering device:', insertError);
            }

            // Block access - device needs approval
            await supabase.auth.signOut();
            setDevicePendingApproval(true);
            toast({
              variant: "destructive",
              title: "Device Approval Required",
              description: "This is a new device. Please contact your administrator to approve this device.",
            });
            return;
          } else if (!(existingDevice as any).approved) {
            // Device exists but not approved
            await supabase.auth.signOut();
            setDevicePendingApproval(true);
            toast({
              variant: "destructive",
              title: "Device Pending Approval",
              description: "Your device is pending administrator approval. Please wait for approval.",
            });
            return;
          }

          // Device is approved - check concurrent login permission
          if (otherDevices && otherDevices.length > 0 && !(existingDevice as any).allow_concurrent_login) {
            await supabase.auth.signOut();
            toast({
              variant: "destructive",
              title: "Concurrent Login Not Allowed",
              description: "You are already logged in on another device. Please sign out from other devices or contact admin.",
            });
            return;
          }

          // Store login location if geolocation is available
          if ('geolocation' in navigator) {
            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0
                });
              });

              await supabase
                .from('profiles')
                .update({
                  login_location_lat: position.coords.latitude,
                  login_location_lng: position.coords.longitude
                })
                .eq('id', profile.id);

              console.log('Login location stored:', position.coords.latitude, position.coords.longitude);
            } catch (geoError) {
              console.error('Failed to get login location:', geoError);
              // Continue with login even if location storage fails
            }
          }

          // Single session enforcement is handled by the realtime hook in GuardDashboard
          // The hook will automatically log out other devices when this user opens the dashboard
          
          // Get ALL active login constraints for this guard
          const { data: constraints, error: cErr } = await supabase
            .from('guard_login_constraints')
            .select('*')
            .eq('guard_id', profile.id)
            .eq('is_active', true);

          if (cErr) {
            console.error('Failed to load constraints', cErr);
          }

          if (constraints && constraints.length > 0) {
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const currentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // YYYY-MM-DD
            const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`; // HH:MM:SS

            const allowed = constraints.some((c: any) => {
              if (c.start_date && currentDate < c.start_date) return false;
              if (c.end_date && currentDate > c.end_date) return false;
              const st = c.start_time ? String(c.start_time).slice(0, 8) : null;
              const et = c.end_time ? String(c.end_time).slice(0, 8) : null;
              if (st && currentTime < st) return false;
              if (et && currentTime > et) return false;
              return true;
            });

            if (!allowed) {
              await supabase.auth.signOut();
              toast({
                variant: "destructive",
                title: "Access Restricted",
                description: "Login allowed only during scheduled window. Please try again later.",
              });
              return;
            }
          }
        }

        // Revoke other sessions server-side as a fallback
        try {
          await supabase.functions.invoke('enforce-single-session', {
            body: { userId: authData.user.id },
          });
        } catch (fnErr) {
          console.warn('Failed to enforce single session via function', fnErr);
        }

        // Passed validation
        navigate('/guard');
      }
      // Remove success toast for faster login - navigation will happen immediately
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          variant: "destructive",
          title: "Sign out failed",
          description: error.message,
        });
      } else {
        setUser(null);
        setSession(null);
        toast({
          title: "Signed out",
          description: "You have been signed out successfully.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during sign out.",
      });
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-guard flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-blue-600">GuardHQ Mobile</CardTitle>
            <CardDescription>Welcome back, {user.email}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              You are currently signed in. You should be redirected to your dashboard automatically.
            </p>
            <Button onClick={() => navigate('/guard')} className="w-full mb-2">
              Go to Dashboard
            </Button>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={handleSignOut} className="w-full">
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-guard flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-600">GuardHQ Mobile</CardTitle>
          <CardDescription>Sign in to access your guard dashboard</CardDescription>
        </CardHeader>
        
        {devicePendingApproval && (
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Device Approval Required</AlertTitle>
              <AlertDescription>
                Your device needs to be approved by an administrator before you can access the system. 
                Please contact your administrator and try again after approval.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
        
        <form onSubmit={handleSignIn}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default GuardAuthPage;
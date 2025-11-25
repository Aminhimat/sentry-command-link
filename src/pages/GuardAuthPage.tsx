import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { User, Session } from '@supabase/supabase-js';

const GuardAuthPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
          .select('id, role, company_id, is_active, requires_admin_approval, login_location_lat, login_location_lng, assigned_property_id')
          .eq('user_id', authData.user.id)
          .single();

        if (profile?.role === 'guard') {
          // Single session enforcement is handled by useSingleSessionRealtime hook in GuardDashboard
          // Admin approval disabled - skip approval check

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

          // Store login location ONLY on first login (if not already set)
          if ('geolocation' in navigator) {
            try {
              // Check if login location is already stored
              if (!profile.login_location_lat || !profile.login_location_lng) {
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

                console.log('First login location stored:', position.coords.latitude, position.coords.longitude);
              } else {
                console.log('Using existing login location for validation');
              }
            } catch (geoError) {
              console.error('Failed to get login location:', geoError);
              // Continue with login even if location storage fails
            }
          }

          // Single session enforcement is handled by the realtime hook in GuardDashboard
          // The hook will automatically log out other devices when this user opens the dashboard
          
          // Get ALL active login constraints for this guard
          // @ts-ignore - Complex Supabase type
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

        // Passed validation - auto-start shift
        if (profile?.role === 'guard') {
          try {
            // Get current location for shift start
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              });
            });

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const locationAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

            // Create new shift automatically
            const { error: shiftError } = await supabase
              .from('guard_shifts')
              .insert({
                guard_id: profile.id,
                company_id: profile.company_id,
                property_id: profile.assigned_property_id,
                location_lat: latitude,
                location_lng: longitude,
                location_address: locationAddress
              });

            if (shiftError) {
              console.error('Failed to start shift:', shiftError);
            }
          } catch (shiftStartError) {
            console.error('Failed to auto-start shift:', shiftStartError);
            // Continue with login even if shift creation fails
          }
        }

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
      // End active shift before signing out
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          // Find active shift
          const { data: activeShift } = await supabase
            .from('guard_shifts')
            .select('id')
            .eq('guard_id', profile.id)
            .is('check_out_time', null)
            .order('check_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeShift) {
            // End the shift
            await supabase
              .from('guard_shifts')
              .update({ check_out_time: new Date().toISOString() })
              .eq('id', activeShift.id);

            // Clear guard's location data
            // @ts-ignore - Complex Supabase type
            await supabase
              .from('guard_locations')
              .delete()
              .eq('guard_id', profile.id)
              .eq('shift_id', activeShift.id);
          }
        }
      }

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
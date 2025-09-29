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
          // Navigate to guard dashboard immediately
          navigate('/guard');
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
          .select('id, role, company_id')
          .eq('user_id', authData.user.id)
          .single();

        if (profile?.role === 'guard') {
          // Get login constraints for this guard
          const { data: constraints } = await supabase
            .from('guard_login_constraints')
            .select('*')
            .eq('guard_id', profile.id)
            .eq('is_active', true)
            .maybeSingle();

          if (constraints) {
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

            // Check date constraints
            if (constraints.start_date && constraints.end_date) {
              if (currentDate < constraints.start_date || currentDate > constraints.end_date) {
                await supabase.auth.signOut();
                toast({
                  variant: "destructive",
                  title: "Access Restricted",
                  description: `You can only login between ${constraints.start_date} and ${constraints.end_date}.`,
                });
                return;
              }
            }

            // Check time constraints
            if (constraints.start_time && constraints.end_time) {
              if (currentTime < constraints.start_time || currentTime > constraints.end_time) {
                await supabase.auth.signOut();
                toast({
                  variant: "destructive",
                  title: "Access Restricted",
                  description: `You can only login between ${constraints.start_time} and ${constraints.end_time}.`,
                });
                return;
              }
            }
          }
        }
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
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
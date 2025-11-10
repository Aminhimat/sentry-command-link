import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export const useLocationMonitoring = (isGuard: boolean, isActive: boolean = true) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const watchIdRef = useRef<number | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isGuard || !isActive || !('geolocation' in navigator)) {
      return;
    }

    console.log('Starting location monitoring for guard');

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        console.log('Location updated:', position.coords.latitude, position.coords.longitude);
        
        // Check location every time it updates (but throttled by the browser)
        checkLocationDistance(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('Location watch error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );

    // Also set up a periodic check every 2 minutes as backup
    checkIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkLocationDistance(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Periodic location check error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // Accept 1-minute old position for periodic checks
        }
      );
    }, 120000); // Check every 2 minutes

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isGuard, isActive]);

  const checkLocationDistance = async (currentLat: number, currentLng: number) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('check-guard-location', {
        body: { currentLat, currentLng },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) {
        console.error('Error checking location:', error);
        return;
      }

      // If no baseline is stored yet, set it now to avoid immediate logout loop
      if (data?.message && typeof data.message === 'string' && data.message.includes('No login location stored')) {
        const { error: setLocError } = await supabase.functions.invoke('set-login-location', {
          body: { currentLat, currentLng },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (setLocError) {
          console.error('Failed to set baseline login location:', setLocError);
        } else {
          console.log('Baseline login location set from monitoring hook.');
        }
        return;
      }

      if (data && !data.withinRange) {
        // Guard moved too far, they've been logged out by policy
        toast({
          variant: "destructive",
          title: "Location Alert",
          description: "You moved too far from your login location and have been logged out. Please log in again.",
          duration: 10000,
        });

        // Sign out locally and redirect to main auth page
        await supabase.auth.signOut();
        navigate('/auth?mode=guard');
      }
    } catch (err) {
      console.error('Error in location check:', err);
    }
  };

  return null;
};

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export const useLocationMonitoring = (isGuard: boolean, isActive: boolean = true) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const watchIdRef = useRef<number | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    if (!isGuard || !isActive || !('geolocation' in navigator)) {
      return;
    }

    console.log('Starting location monitoring for guard');

    // Request location permission and start monitoring
    const enableLocationTracking = async () => {
      try {
        // First, request permission by getting current position
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });

        // Permission granted, show success toast
        if (!locationEnabled) {
          setLocationEnabled(true);
          toast({
            title: "Location Tracking Enabled",
            description: "Your location is being monitored for security.",
            duration: 3000,
          });
        }
      } catch (error: any) {
        console.error('Location permission error:', error);
        toast({
          variant: "destructive",
          title: "Location Permission Required",
          description: "Please enable location access to continue. This is required for guard duty.",
          duration: 5000,
        });
        
        // Sign out if location permission is denied
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/auth?mode=guard');
        }, 5000);
        return;
      }
    };

    enableLocationTracking();

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

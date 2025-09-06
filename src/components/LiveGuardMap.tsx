import React, { useEffect, useRef, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Users, Clock, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GuardLocation {
  id: string;
  shift_id: string;
  guard_id: string;
  location_lat: number;
  location_lng: number;
  location_address: string | null;
  battery_level: number | null;
  accuracy: number | null;
  created_at: string;
  updated_at: string;
  guard?: {
    first_name: string;
    last_name: string;
  };
  shift?: {
    check_in_time: string;
    check_out_time: string | null;
  };
}

interface LiveGuardMapProps {
  companyId: string;
}

const LiveGuardMap: React.FC<LiveGuardMapProps> = ({ companyId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [guardLocations, setGuardLocations] = useState<GuardLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { toast } = useToast();

  // Create custom guard icon
  const createGuardIcon = (guardName: string, isActive: boolean) => {
    const iconHtml = `
      <div style="
        background: ${isActive ? '#22c55e' : '#6b7280'};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        ${guardName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
      </div>
    `;
    
    return L.divIcon({
      html: iconHtml,
      className: 'custom-guard-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  };

  // Initialize map
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const initializeMap = () => {
      // Wait for the container to be available
      if (!mapRef.current) {
        console.log('LiveGuardMap: Container not ready, retrying...');
        timeoutId = setTimeout(initializeMap, 100);
        return;
      }

      console.log('LiveGuardMap: Initializing map for company:', companyId);
      console.log('LiveGuardMap: Map container element:', mapRef.current);

      // Clean up existing map
      if (mapInstance.current) {
        console.log('LiveGuardMap: Cleaning up existing map');
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      try {
        console.log('LiveGuardMap: Creating Leaflet map instance...');
        
        // Ensure container has proper dimensions
        const container = mapRef.current;
        if (!container.offsetHeight || !container.offsetWidth) {
          console.log('LiveGuardMap: Container has no dimensions, waiting...');
          timeoutId = setTimeout(initializeMap, 100);
          return;
        }
        
        const map = L.map(container, {
          center: [34.0522, -118.2437], // Default to LA area
          zoom: 10,
          zoomControl: true,
          scrollWheelZoom: true,
          preferCanvas: false
        });

        console.log('LiveGuardMap: Adding tile layer...');
        
        // Use OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        mapInstance.current = map;
        console.log('LiveGuardMap: Map initialized successfully');
        
        // Force map to resize and refresh after initialization
        setTimeout(() => {
          if (mapInstance.current) {
            console.log('LiveGuardMap: Invalidating map size...');
            mapInstance.current.invalidateSize();
          }
        }, 100);
        
      } catch (error) {
        console.error('LiveGuardMap: Error initializing map:', error);
        toast({
          title: "Map Error",
          description: "Failed to initialize the map",
          variant: "destructive",
        });
      }
    };

    // Start initialization after a small delay to ensure DOM is ready
    timeoutId = setTimeout(initializeMap, 50);
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [companyId]);

  // Fetch initial guard locations
  const fetchGuardLocations = async () => {
    try {
      console.log('LiveGuardMap: Fetching guard locations for company:', companyId);
      
      // Get all active shifts (not checked out) and recent shifts
      const { data: activeShifts, error: shiftsError } = await supabase
        .from('guard_shifts')
        .select(`
          id, guard_id, check_in_time, check_out_time, location_lat, location_lng, location_address,
          guard:profiles!guard_shifts_guard_id_fkey(id, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('check_in_time', { ascending: false });

      if (shiftsError) {
        console.error('LiveGuardMap: Error fetching shifts:', shiftsError);
        toast({
          title: "Error",
          description: "Failed to fetch guard shifts",
          variant: "destructive",
        });
        return;
      }

      // Get the latest location data from guard_locations table
      const { data: locationData, error: locationError } = await supabase
        .from('guard_locations')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });

      if (locationError) {
        console.error('LiveGuardMap: Error fetching guard locations:', locationError);
      }

      console.log('LiveGuardMap: Fetched data:', { activeShifts, locationData });
      
      // Create a map to store the best location data for each guard
      const guardLocationMap = new Map<string, any>();

      // First, add all guards from active shifts (using check-in location as fallback)
      activeShifts?.forEach(shift => {
        if (!shift.guard || !shift.location_lat || !shift.location_lng) return;
        
        const isActive = !shift.check_out_time;
        const guardId = shift.guard_id;
        
        // Only show recent shifts (within last 24 hours for context)
        const shiftTime = new Date(shift.check_in_time);
        const hoursSinceCheckIn = (new Date().getTime() - shiftTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceCheckIn < 72) { // Show guards from last 3 days
          guardLocationMap.set(guardId, {
            id: `shift-${shift.id}`,
            guard_id: guardId,
            shift_id: shift.id,
            location_lat: shift.location_lat,
            location_lng: shift.location_lng,
            location_address: shift.location_address || 'Check-in Location',
            battery_level: null,
            accuracy: null,
            created_at: shift.check_in_time,
            updated_at: shift.check_in_time,
            guard: shift.guard,
            shift: {
              check_in_time: shift.check_in_time,
              check_out_time: shift.check_out_time
            },
            isFromShift: true
          });
        }
      });

      // Then, overlay with more recent live location data if available
      if (locationData) {
        // Group by guard_id to get the latest location for each guard
        const latestLocationData = new Map<string, any>();
        locationData.forEach(location => {
          const existing = latestLocationData.get(location.guard_id);
          if (!existing || new Date(location.updated_at) > new Date(existing.updated_at)) {
            latestLocationData.set(location.guard_id, location);
          }
        });

        // Get profiles for location data guards
        const locationGuardIds = Array.from(latestLocationData.keys());
        const { data: locationProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', locationGuardIds);

        // Update with live location data where available
        latestLocationData.forEach((location, guardId) => {
          const profile = locationProfiles?.find(p => p.id === guardId);
          const matchingShift = activeShifts?.find(s => s.guard_id === guardId);
          
          // Only show if it's a recent update (within last 4 hours)
          const timeSinceUpdate = new Date().getTime() - new Date(location.updated_at).getTime();
          const hoursSinceUpdate = timeSinceUpdate / (1000 * 60 * 60);
          
          if (hoursSinceUpdate < 4) {
            guardLocationMap.set(guardId, {
              ...location,
              guard: profile,
              shift: matchingShift ? {
                check_in_time: matchingShift.check_in_time,
                check_out_time: matchingShift.check_out_time
              } : null,
              isFromShift: false
            });
          }
        });
      }

      const locations = Array.from(guardLocationMap.values());
      console.log('LiveGuardMap: Final locations to display:', locations);
      
      setGuardLocations(locations);
      setLastUpdated(new Date());
      updateMapMarkers(locations);
      
    } catch (error) {
      console.error('LiveGuardMap: Error fetching guard locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update map markers
  const updateMapMarkers = (locations: GuardLocation[]) => {
    // Wait for map to be initialized
    if (!mapInstance.current) {
      console.log('LiveGuardMap: Map not ready for markers, waiting...');
      setTimeout(() => updateMapMarkers(locations), 100);
      return;
    }

    console.log('LiveGuardMap: Updating markers for', locations.length, 'guards');

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstance.current?.removeLayer(marker);
    });
    markersRef.current.clear();

    if (locations.length === 0) return;

    // Add new markers
    const bounds = L.latLngBounds([]);
    
    locations.forEach(location => {
      if (!mapInstance.current) return;

      // Handle cases where guard data might be missing
      const guardName = location.guard 
        ? `${location.guard.first_name} ${location.guard.last_name}`
        : `Guard ${location.guard_id.substring(0, 8)}`;
      
      const isActiveShift = location.shift && !location.shift.check_out_time;
      const timeSinceUpdate = new Date().getTime() - new Date(location.updated_at).getTime();
      const minutesSinceUpdate = Math.floor(timeSinceUpdate / 60000);

      console.log('LiveGuardMap: Creating marker for guard:', guardName, 'at', location.location_lat, location.location_lng);

      const icon = createGuardIcon(guardName, isActiveShift);
      const marker = L.marker([location.location_lat, location.location_lng], { icon });

      const popupContent = `
        <div style="text-align: center; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937;">${guardName}</h3>
          ${location.location_address ? `<p style="margin: 0 0 6px 0; color: #2563eb;"><strong>📍 ${location.location_address}</strong></p>` : ''}
          <div style="margin: 8px 0; padding: 8px; background: #f3f4f6; border-radius: 6px;">
            <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Status:</strong> ${isActiveShift ? '🟢 Active' : '🔴 Off Duty'}</p>
            <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Last Update:</strong> ${minutesSinceUpdate}m ago</p>
            ${location.battery_level ? `<p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Battery:</strong> ${location.battery_level}%</p>` : ''}
            ${location.accuracy ? `<p style="margin: 0; font-size: 12px;"><strong>Accuracy:</strong> ±${Math.round(location.accuracy)}m</p>` : ''}
          </div>
          <p style="margin: 0; font-size: 10px; color: #6b7280;">${location.location_lat.toFixed(6)}, ${location.location_lng.toFixed(6)}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(mapInstance.current);
      markersRef.current.set(location.guard_id, marker);

      bounds.extend([location.location_lat, location.location_lng]);
      console.log('LiveGuardMap: Marker added successfully for', guardName);
    });

    // Fit map to show all markers
    if (bounds.isValid()) {
      mapInstance.current.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!companyId) return;

    fetchGuardLocations();

    console.log('LiveGuardMap: Setting up realtime subscription for company:', companyId);
    
    const channel = supabase
      .channel('guard-locations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guard_locations',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('LiveGuardMap: Real-time update received:', payload);
          fetchGuardLocations(); // Refresh all data
        }
      )
      .subscribe();

    return () => {
      console.log('LiveGuardMap: Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchGuardLocations();
  };

  const activeGuards = guardLocations.filter(location => 
    location.shift && !location.shift.check_out_time
  ).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Live Guard Locations
          </CardTitle>
          <CardDescription>Real-time tracking of all active guards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading guard locations...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Live Guard Locations
            </CardTitle>
            <CardDescription>Real-time tracking of all active guards</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {activeGuards} Active
            </Badge>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
            <span>{guardLocations.length} guards tracked</span>
          </div>
          
          <div 
            ref={mapRef} 
            className="w-full rounded-lg overflow-hidden border relative"
            style={{ 
              height: '500px',
              minHeight: '500px',
              width: '100%',
              display: 'block'
            }}
          />
          
          {guardLocations.length === 0 && (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No guard locations available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Guards will appear here when they start sharing their location during shifts
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveGuardMap;
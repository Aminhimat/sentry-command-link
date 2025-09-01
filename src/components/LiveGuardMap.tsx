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
    if (!mapRef.current) return;

    console.log('LiveGuardMap: Initializing map for company:', companyId);

    // Clean up existing map
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    try {
      // Initialize map with a default center
      const map = L.map(mapRef.current).setView([34.0522, -118.2437], 10); // Default to LA area

      // Use OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstance.current = map;
      console.log('LiveGuardMap: Map initialized successfully');
    } catch (error) {
      console.error('LiveGuardMap: Error initializing map:', error);
      toast({
        title: "Map Error",
        description: "Failed to initialize the map",
        variant: "destructive",
      });
    }
  }, [companyId]);

  // Fetch initial guard locations
  const fetchGuardLocations = async () => {
    try {
      console.log('LiveGuardMap: Fetching guard locations for company:', companyId);
      
      // First get the raw location data
      const { data: locationData, error: locationError } = await supabase
        .from('guard_locations')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });

      if (locationError) {
        console.error('LiveGuardMap: Error fetching guard locations:', locationError);
        toast({
          title: "Error",
          description: "Failed to fetch guard locations",
          variant: "destructive",
        });
        return;
      }

      // Get unique guard IDs and fetch their profiles
      const guardIds = [...new Set(locationData?.map(loc => loc.guard_id) || [])];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', guardIds);

      if (profilesError) {
        console.error('LiveGuardMap: Error fetching profiles:', profilesError);
      }

      // Get shift data for the location shift IDs
      const shiftIds = [...new Set(locationData?.map(loc => loc.shift_id) || [])];
      
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('guard_shifts')
        .select('id, check_in_time, check_out_time')
        .in('id', shiftIds);

      if (shiftsError) {
        console.error('LiveGuardMap: Error fetching shifts:', shiftsError);
      }

      console.log('LiveGuardMap: Fetched data:', { locationData, profilesData, shiftsData });
      
      // Group by guard_id to get the latest location for each guard
      const latestLocations = new Map<string, any>();
      locationData?.forEach(location => {
        const existing = latestLocations.get(location.guard_id);
        if (!existing || new Date(location.updated_at) > new Date(existing.updated_at)) {
          const profile = profilesData?.find(p => p.id === location.guard_id);
          const shift = shiftsData?.find(s => s.id === location.shift_id);
          
          latestLocations.set(location.guard_id, {
            ...location,
            guard: profile,
            shift: shift
          });
        }
      });

      const locations = Array.from(latestLocations.values());
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
    if (!mapInstance.current) return;

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
      if (!location.guard || !mapInstance.current) return;

      const guardName = `${location.guard.first_name} ${location.guard.last_name}`;
      const isActiveShift = location.shift && !location.shift.check_out_time;
      const timeSinceUpdate = new Date().getTime() - new Date(location.updated_at).getTime();
      const minutesSinceUpdate = Math.floor(timeSinceUpdate / 60000);

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
            className="w-full rounded-lg overflow-hidden border"
            style={{ 
              height: '500px',
              minHeight: '500px'
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
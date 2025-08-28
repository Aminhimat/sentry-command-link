import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  guardName?: string;
  timestamp?: string;
}

const LocationMap: React.FC<LocationMapProps> = ({
  isOpen,
  onClose,
  latitude,
  longitude,
  guardName,
  timestamp
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [mapError, setMapError] = React.useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    console.log('LocationMap: Initializing map for coordinates:', latitude, longitude);

    // Clean up existing map
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    setIsLoading(true);
    setMapError(null);

    try {
      // Initialize map immediately
      const map = L.map(mapRef.current).setView([latitude, longitude], 15);

      // Use OpenStreetMap tiles (most reliable)
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      });

      // Handle tile loading
      let tilesLoaded = false;
      
      tileLayer.on('loading', () => {
        console.log('LocationMap: Tiles loading...');
      });

      tileLayer.on('load', () => {
        console.log('LocationMap: Tiles loaded successfully');
        tilesLoaded = true;
        setIsLoading(false);
      });

      tileLayer.on('tileerror', (e) => {
        console.warn('LocationMap: Tile error:', e);
        if (!tilesLoaded) {
          setIsLoading(false); // Still show the map even with tile errors
        }
      });

      tileLayer.addTo(map);

      // Add marker
      const marker = L.marker([latitude, longitude]).addTo(map);
      
      const popupContent = `
        <div style="text-align: center;">
          <p style="font-weight: 500; margin: 0 0 4px 0;">${guardName || 'Guard Location'}</p>
          ${timestamp ? `<p style="font-size: 12px; color: #666; margin: 0 0 4px 0;">${new Date(timestamp).toLocaleString()}</p>` : ''}
          <p style="font-size: 10px; color: #999; margin: 0;">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
        </div>
      `;
      
      marker.bindPopup(popupContent).openPopup();

      // Set loading to false after a short delay even if tiles don't fire load event
      const loadingTimeout = setTimeout(() => {
        if (!tilesLoaded) {
          console.log('LocationMap: Forcing load completion after timeout');
          setIsLoading(false);
        }
      }, 3000);

      mapInstance.current = map;
      console.log('LocationMap: Map setup complete');

      return () => {
        clearTimeout(loadingTimeout);
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }
      };
    } catch (error) {
      console.error('LocationMap: Error initializing map:', error);
      setMapError('Failed to load map. Showing coordinates instead.');
      setIsLoading(false);
    }
  }, [isOpen, latitude, longitude]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Guard Location
            {guardName && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                - {guardName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div 
          ref={mapRef} 
          className="w-full rounded-lg overflow-hidden border bg-gray-100"
          style={{ 
            height: '384px',
            minHeight: '384px',
            width: '100%',
            position: 'relative'
          }}
        >
          {(isLoading || mapError) && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-100 z-10">
              {mapError ? (
                <div className="text-center">
                  <p className="text-red-500 mb-2">{mapError}</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="text-blue-500 underline text-sm"
                  >
                    Refresh page
                  </button>
                </div>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mr-3"></div>
                  Loading map...
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationMap;
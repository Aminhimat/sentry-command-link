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
  locationAddress?: string;
}

const LocationMap: React.FC<LocationMapProps> = ({
  isOpen,
  onClose,
  latitude,
  longitude,
  guardName,
  timestamp,
  locationAddress
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [mapError, setMapError] = React.useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let loadingTimeout: NodeJS.Timeout;
    
    if (!isOpen) {
      setIsLoading(true);
      setMapError(null);
      return;
    }

    const initializeMap = () => {
      if (!mapRef.current) {
        console.log('LocationMap: Container not ready, retrying...');
        timeoutId = setTimeout(initializeMap, 100);
        return;
      }

      console.log('LocationMap: Initializing map for coordinates:', latitude, longitude);

      // Clean up existing map
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      setMapError(null);

      try {
        // Ensure container has proper dimensions
        const container = mapRef.current;
        if (!container.offsetHeight || !container.offsetWidth) {
          console.log('LocationMap: Container has no dimensions, waiting...');
          timeoutId = setTimeout(initializeMap, 100);
          return;
        }

        // Initialize map
        const map = L.map(container, {
          center: [latitude, longitude],
          zoom: 15,
          zoomControl: true,
          scrollWheelZoom: true
        });

        // Use OpenStreetMap tiles
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        });

        tileLayer.addTo(map);

        // Add marker immediately
        const marker = L.marker([latitude, longitude]).addTo(map);
        
        const popupContent = `
          <div style="text-align: center;">
            ${locationAddress ? `<p style="font-weight: bold; font-size: 14px; margin: 0 0 6px 0; color: #2563eb;">📍 ${locationAddress}</p>` : ''}
            <p style="font-weight: 500; margin: 0 0 4px 0;">${guardName || 'Guard Location'}</p>
            ${timestamp ? `<p style="font-size: 12px; color: #666; margin: 0 0 4px 0;">${new Date(timestamp).toLocaleString()}</p>` : ''}
            <p style="font-size: 10px; color: #999; margin: 0;">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
          </div>
        `;
        
        marker.bindPopup(popupContent).openPopup();

        mapInstance.current = map;
        console.log('LocationMap: Map setup complete');
        
        // Remove loading state quickly since the map is ready
        setTimeout(() => {
          setIsLoading(false);
          if (mapInstance.current) {
            mapInstance.current.invalidateSize();
          }
        }, 100);
        
      } catch (error) {
        console.error('LocationMap: Error initializing map:', error);
        setMapError('Failed to load map. Showing coordinates instead.');
        setIsLoading(false);
      }
    };

    // Force loading to false after maximum wait time
    loadingTimeout = setTimeout(() => {
      console.log('LocationMap: Forcing load completion after timeout');
      setIsLoading(false);
    }, 2000);

    // Start initialization
    timeoutId = setTimeout(initializeMap, 50);
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
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
          {locationAddress && (
            <div className="text-lg font-semibold text-foreground bg-muted/50 px-3 py-2 rounded-md">
              📍 {locationAddress}
            </div>
          )}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-gray-50 z-10 rounded-lg">
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
                <div className="text-center">
                  {locationAddress && (
                    <div className="text-xl font-bold text-primary mb-3">
                      📍 {locationAddress}
                    </div>
                  )}
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3"></div>
                    <span className="text-sm">Loading map details...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationMap;
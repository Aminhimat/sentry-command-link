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
    if (!isOpen) {
      setIsLoading(true);
      setMapError(null);
      return;
    }

    if (!mapRef.current) return;

    // Clean up existing map
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    setIsLoading(true);
    setMapError(null);

    // Create map with proper error handling
    const timer = setTimeout(() => {
      if (!mapRef.current) return;

      try {
        // Force container to have dimensions
        mapRef.current.style.width = '100%';
        mapRef.current.style.height = '384px';

        // Initialize map
        const map = L.map(mapRef.current, {
          preferCanvas: true,
          attributionControl: true,
        }).setView([latitude, longitude], 15);

        // Add tile layer with error handling
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        });

        tileLayer.on('load', () => {
          setIsLoading(false);
        });

        tileLayer.on('tileerror', () => {
          console.warn('Tile loading error, but continuing...');
          setIsLoading(false);
        });

        tileLayer.addTo(map);

        // Configure marker icon with fallback
        const icon = L.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        // Add marker with popup
        const marker = L.marker([latitude, longitude], { icon }).addTo(map);
        
        const popupContent = `
          <div style="text-align: center;">
            <p style="font-weight: 500; margin: 0 0 4px 0;">${guardName || 'Guard Location'}</p>
            ${timestamp ? `<p style="font-size: 12px; color: #666; margin: 0 0 4px 0;">${new Date(timestamp).toLocaleString()}</p>` : ''}
            <p style="font-size: 10px; color: #999; margin: 0;">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
          </div>
        `;
        
        marker.bindPopup(popupContent).openPopup();

        // Force map to resize and invalidate size
        setTimeout(() => {
          map.invalidateSize();
          setIsLoading(false);
        }, 100);

        mapInstance.current = map;
        console.log('Map initialized successfully');
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError('Failed to load map. Please try again.');
        setIsLoading(false);
      }
    }, 300);

    // Fallback timeout in case map doesn't load
    const fallbackTimer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        if (!mapInstance.current) {
          setMapError('Map is taking too long to load. Please check your internet connection.');
        }
      }
    }, 10000); // 10 second timeout

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [isOpen, latitude, longitude, guardName, timestamp, isLoading]);

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
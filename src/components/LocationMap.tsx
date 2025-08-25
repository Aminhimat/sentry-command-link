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

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    // Clean up existing map
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    // Create map with a slight delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!mapRef.current) return;

      // Initialize map
      const map = L.map(mapRef.current).setView([latitude, longitude], 15);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Configure marker icon
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

      mapInstance.current = map;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [isOpen, latitude, longitude, guardName, timestamp]);

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
          className="w-full h-96 rounded-lg overflow-hidden border"
          style={{ minHeight: '384px' }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default LocationMap;
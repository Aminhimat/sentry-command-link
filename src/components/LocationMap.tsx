import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
        <div className="w-full h-96 rounded-lg overflow-hidden border">
          <MapContainer
            center={[latitude, longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[latitude, longitude]}>
              <Popup>
                <div className="text-center">
                  <p className="font-medium">{guardName}</p>
                  {timestamp && (
                    <p className="text-sm text-gray-600">
                      {new Date(timestamp).toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationMap;
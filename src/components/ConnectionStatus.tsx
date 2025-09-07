import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Upload, Clock } from "lucide-react";

interface ConnectionStatusProps {
  isOnline: boolean;
  pendingReports: number;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  isOnline, 
  pendingReports 
}) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Badge 
        variant={isOnline ? "default" : "destructive"}
        className="flex items-center gap-1"
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>
      
      {pendingReports > 0 && (
        <Badge variant="outline" className="flex items-center gap-1">
          {isOnline ? (
            <>
              <Upload className="h-3 w-3" />
              Uploading {pendingReports}
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              {pendingReports} Pending
            </>
          )}
        </Badge>
      )}
    </div>
  );
};
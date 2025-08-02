import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Calendar, AlertTriangle } from "lucide-react";

interface IncidentDetailsModalProps {
  incident: any;
  isOpen: boolean;
  onClose: () => void;
}

const IncidentDetailsModal = ({ incident, isOpen, onClose }: IncidentDetailsModalProps) => {
  if (!incident) return null;

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      'low': { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Low' },
      'medium': { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Medium' },
      'high': { className: 'bg-red-100 text-red-800 border-red-200', label: 'High' },
      'none': { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'None' }
    };
    
    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.none;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Incident Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Issue ID</p>
              <p className="font-mono text-red-600 font-medium">
                {incident.id.split('-')[0].toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Severity</p>
              {getSeverityBadge(incident.severity)}
            </div>
          </div>

          {/* Location */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Property/Site</p>
            </div>
            <p className="text-sm bg-muted/50 p-3 rounded-lg">
              {incident.location_address || 'Location not specified'}
            </p>
            {incident.location_lat && incident.location_lng && (
              <p className="text-xs text-muted-foreground mt-1">
                Coordinates: {incident.location_lat}, {incident.location_lng}
              </p>
            )}
          </div>

          {/* Issue Description */}
          <div>
            <p className="text-sm font-medium mb-2">Reported Issue</p>
            <p className="text-sm bg-muted/50 p-3 rounded-lg">
              {incident.title || 'Security Patrol'}
            </p>
            {incident.description && (
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  {incident.description}
                </p>
              </div>
            )}
          </div>

          {/* Guard Information */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Submitted By</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              {incident.guard ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {incident.guard?.first_name?.[0]}{incident.guard?.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {incident.guard?.first_name} {incident.guard?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">Security Guard</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Guard information not available</p>
              )}
            </div>
          </div>

          {/* Date Information */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Created Date</p>
            </div>
            <p className="text-sm bg-muted/50 p-3 rounded-lg">
              {new Date(incident.created_at).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </p>
          </div>

          {/* Status */}
          <div>
            <p className="text-sm font-medium mb-2">Status</p>
            <Badge variant={incident.status === 'open' ? 'destructive' : 'default'}>
              {incident.status?.toUpperCase() || 'OPEN'}
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentDetailsModal;
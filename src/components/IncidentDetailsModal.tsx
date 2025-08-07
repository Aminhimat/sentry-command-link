import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, User, Calendar, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface IncidentDetailsModalProps {
  incident: any;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

const IncidentDetailsModal = ({ incident, isOpen, onClose, onNext, onPrev, hasNext, hasPrev }: IncidentDetailsModalProps) => {
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Incident Photo - {incident.id.split('-')[0].toUpperCase()}
          </DialogTitle>
        </DialogHeader>
        
<div className="space-y-4">
          {incident.image_url ? (
            <div className="relative bg-black rounded-lg overflow-hidden">
              <img 
                src={incident.image_url} 
                alt="Incident report" 
                className="w-full h-auto max-h-[70vh] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* Watermark overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">
                      {new Date(incident.created_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>
                    <div className="text-xs opacity-90">
                      Guard: {incident.guard ? `${incident.guard.first_name} ${incident.guard.last_name}` : 'Unknown'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      Security Report
                    </div>
                    <div className="text-xs opacity-90">
                      Location: {incident.location_address || 'Unknown Site'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">No photo available for this incident</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={onPrev} disabled={!hasPrev}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Use Next/Previous to navigate incidents
            </div>
            <Button variant="outline" onClick={onNext} disabled={!hasNext}>
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncidentDetailsModal;
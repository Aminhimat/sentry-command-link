import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MapPin, Clock, CheckCircle } from 'lucide-react';

interface Checkpoint {
  id: string;
  name: string;
  description: string | null;
  location_address: string | null;
}

interface CheckpointScanDialogProps {
  open: boolean;
  onClose: () => void;
  checkpoint: Checkpoint | null;
  guardId: string;
  companyId: string;
  shiftId: string | null;
  propertyId: string | null;
}

export function CheckpointScanDialog({
  open,
  onClose,
  checkpoint,
  guardId,
  companyId,
  shiftId,
  propertyId,
}: CheckpointScanDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!checkpoint) return;

    setSubmitting(true);

    try {
      // Get current location
      let location = null;
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          });
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        } catch (err) {
          console.error('Location error:', err);
        }
      }

      // Log the checkpoint scan
      const { error } = await supabase.from('checkpoint_scans').insert({
        checkpoint_id: checkpoint.id,
        guard_id: guardId,
        company_id: companyId,
        shift_id: shiftId,
        property_id: propertyId,
        location_lat: location?.lat,
        location_lng: location?.lng,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast({
        title: 'Checkpoint Scanned',
        description: `Successfully logged scan at ${checkpoint.name}`,
      });

      setNotes('');
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error logging scan',
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!checkpoint) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Checkpoint Found
          </DialogTitle>
          <DialogDescription>
            Confirm your patrol scan at this checkpoint
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">{checkpoint.name}</h3>
            
            {checkpoint.description && (
              <p className="text-sm text-muted-foreground">{checkpoint.description}</p>
            )}
            
            {checkpoint.location_address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{checkpoint.location_address}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{new Date().toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any observations or notes about this checkpoint..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Logging...' : 'Confirm Scan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Property {
  id: string;
  name: string;
}

interface Checkpoint {
  id: string;
  name: string;
  description: string | null;
  location_address: string | null;
  property_id: string | null;
}

interface CheckpointDialogProps {
  open: boolean;
  onClose: (refresh: boolean) => void;
  checkpoint: Checkpoint | null;
  companyId: string | null;
}

export function CheckpointDialog({ open, onClose, checkpoint, companyId }: CheckpointDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location_address: '',
    property_id: '',
  });

  useEffect(() => {
    if (open && companyId) {
      fetchProperties();
    }
  }, [open, companyId]);

  useEffect(() => {
    if (checkpoint) {
      setFormData({
        name: checkpoint.name,
        description: checkpoint.description || '',
        location_address: checkpoint.location_address || '',
        property_id: checkpoint.property_id || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        location_address: '',
        property_id: '',
      });
    }
  }, [checkpoint]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error: any) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Please enter a checkpoint name.',
      });
      return;
    }

    if (!companyId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Company ID not found.',
      });
      return;
    }

    setLoading(true);

    try {
      if (checkpoint) {
        // Update existing checkpoint
        const { error } = await supabase
          .from('checkpoints')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            location_address: formData.location_address.trim() || null,
            property_id: formData.property_id || null,
          })
          .eq('id', checkpoint.id);

        if (error) throw error;

        toast({
          title: 'Checkpoint updated',
          description: 'The checkpoint has been updated successfully.',
        });
      } else {
        // Create new checkpoint - qr_code_data is auto-generated as checkpoint ID
        const checkpointId = crypto.randomUUID();
        
        const { error } = await supabase
          .from('checkpoints')
          .insert({
            id: checkpointId,
            company_id: companyId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            location_address: formData.location_address.trim() || null,
            property_id: formData.property_id || null,
            qr_code_data: checkpointId, // QR code contains the checkpoint ID
          });

        if (error) throw error;

        toast({
          title: 'Checkpoint created',
          description: 'The checkpoint has been created successfully.',
        });
      }

      onClose(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose(false)}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {checkpoint ? 'Edit Checkpoint' : 'Create Checkpoint'}
            </DialogTitle>
            <DialogDescription>
              {checkpoint
                ? 'Update checkpoint information'
                : 'Add a new patrol checkpoint with QR code'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Checkpoint Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Main Entrance, Parking Lot A"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property">Property (Optional)</Label>
              <Select
                value={formData.property_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, property_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_address">Location Address (Optional)</Label>
              <Input
                id="location_address"
                placeholder="e.g., Building A, Floor 2"
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Additional details about this checkpoint..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : checkpoint ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

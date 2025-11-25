import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Clock, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface Guard {
  id: string;
  first_name: string;
  last_name: string;
}

interface Property {
  id: string;
  name: string;
}

interface ScheduledShift {
  id: string;
  shift_name: string;
  company_id: string;
  guard_id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  guard?: {
    first_name: string;
    last_name: string;
  };
  property?: {
    name: string;
  };
}

interface ScheduledShiftsFormProps {
  companyId: string;
  onSuccess?: () => void;
}

const WEEKDAYS = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
];

export const ScheduledShiftsForm = ({ companyId, onSuccess }: ScheduledShiftsFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [formData, setFormData] = useState({
    shift_name: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    guard_id: 'unassigned',
    property_id: 'no_property',
    recurring_days: [] as number[],
    notes: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (companyId) {
      fetchGuards();
      fetchProperties();
      fetchScheduledShifts();
    }
  }, [companyId]);

  const fetchGuards = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('company_id', companyId)
        .eq('role', 'guard')
        .eq('is_active', true);

      if (error) throw error;
      setGuards(data || []);
    } catch (error) {
      console.error('Error fetching guards:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchScheduledShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_shifts')
        .select(`
          *,
          guard:profiles(first_name, last_name),
          property:properties(name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScheduledShifts((data as any) || []);
    } catch (error) {
      console.error('Error fetching scheduled shifts:', error);
    }
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    let diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) {
      // Handle overnight shifts
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const duration = calculateDuration(formData.start_time, formData.end_time);

      const { error } = await supabase
        .from('scheduled_shifts')
        .insert([{
          company_id: companyId,
          shift_name: formData.shift_name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          guard_id: formData.guard_id || '',
          property_id: formData.property_id || '',
          days_of_week: formData.recurring_days || [],
        }] as any);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Scheduled shift created successfully",
      });

      setFormData({
        shift_name: '',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        guard_id: 'unassigned',
        property_id: 'no_property',
        recurring_days: [],
        notes: ''
      });
      
      setIsOpen(false);
      fetchScheduledShifts();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating scheduled shift:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create scheduled shift",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_shifts')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Scheduled shift deleted successfully",
      });

      fetchScheduledShifts();
    } catch (error: any) {
      console.error('Error deleting scheduled shift:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete scheduled shift",
        variant: "destructive",
      });
    }
  };

  const toggleRecurringDay = (dayId: number) => {
    setFormData(prev => ({
      ...prev,
      recurring_days: prev.recurring_days.includes(dayId)
        ? prev.recurring_days.filter(id => id !== dayId)
        : [...prev.recurring_days, dayId].sort()
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Scheduled Shifts</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage guard schedules with specific active periods
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Scheduled Shift</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shift_name">Shift Name *</Label>
                  <Input
                    id="shift_name"
                    value={formData.shift_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, shift_name: e.target.value }))}
                    placeholder="e.g., Night Security"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="guard_id">Assign Guard (Optional)</Label>
                  <Select value={formData.guard_id} onValueChange={(value) => setFormData(prev => ({ ...prev, guard_id: value === "unassigned" ? "" : value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select guard" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {guards.map((guard) => (
                        <SelectItem key={guard.id} value={guard.id}>
                          {guard.first_name} {guard.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {formData.start_time && formData.end_time && (
                <div className="text-sm text-muted-foreground">
                  Duration: {calculateDuration(formData.start_time, formData.end_time)} hours
                </div>
              )}

              <div>
                <Label htmlFor="property_id">Property (Optional)</Label>
                <Select value={formData.property_id} onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value === "no_property" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_property">No specific property</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Recurring Days (Optional)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {WEEKDAYS.map((day) => (
                    <div key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.id}`}
                        checked={formData.recurring_days.includes(day.id)}
                        onCheckedChange={() => toggleRecurringDay(day.id)}
                      />
                      <Label htmlFor={`day-${day.id}`} className="text-sm">
                        {day.short}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this shift..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Schedule'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Scheduled Shifts List */}
      <div className="grid gap-4">
        {scheduledShifts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Scheduled Shifts</p>
              <p className="text-muted-foreground">Create your first scheduled shift to get started</p>
            </CardContent>
          </Card>
        ) : (
          scheduledShifts.map((shift) => (
            <Card key={shift.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{shift.shift_name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(shift.start_date).toLocaleDateString()} - {new Date(shift.end_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {shift.start_time} - {shift.end_time}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={shift.is_active ? 'default' : 'secondary'}>
                      {shift.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteShift(shift.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <strong>Guard:</strong> {shift.guard ? `${shift.guard.first_name} ${shift.guard.last_name}` : 'Unassigned'}
                  </div>
                  <div>
                    <strong>Property:</strong> {shift.property?.name || 'Any'}
                  </div>
                  <div>
                    <strong>Days:</strong> {
                      shift.days_of_week && shift.days_of_week.length > 0
                        ? shift.days_of_week.join(', ')
                        : 'All days'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
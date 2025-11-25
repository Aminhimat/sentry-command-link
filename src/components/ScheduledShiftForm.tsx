import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const scheduledShiftSchema = z.object({
  shift_name: z.string().min(1, 'Shift name is required'),
  guard_id: z.string().optional(),
  property_id: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  days_of_week: z.array(z.string()).optional(),
});

type ScheduledShiftFormData = z.infer<typeof scheduledShiftSchema>;

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
  } | null;
  property?: {
    name: string;
  } | null;
}

interface ScheduledShiftFormProps {
  companyId: string;
  onShiftCreated: () => void;
}

const weekDays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const ScheduledShiftForm = ({ companyId, onShiftCreated }: ScheduledShiftFormProps) => {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ScheduledShiftFormData>({
    resolver: zodResolver(scheduledShiftSchema),
    defaultValues: {
      shift_name: '',
      start_date: '',
      end_date: '',
      start_time: '08:00',
      end_time: '16:00',
      days_of_week: [],
    },
  });

  useEffect(() => {
    fetchGuards();
    fetchProperties();
    fetchScheduledShifts();
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
      // First get scheduled shifts
      const { data: shifts, error: shiftsError } = await supabase
        .from('scheduled_shifts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (shiftsError) throw shiftsError;

      // Then get guard and property details separately
      const enrichedShifts = await Promise.all(
        (shifts || []).map(async (shift) => {
          let guard = null;
          let property = null;

          if (shift.guard_id) {
            const { data: guardData } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', shift.guard_id)
              .single();
            guard = guardData;
          }

          if (shift.property_id) {
            const { data: propertyData } = await supabase
              .from('properties')
              .select('name')
              .eq('id', shift.property_id)
              .single();
            property = propertyData;
          }

          return {
            ...shift,
            guard,
            property,
          };
        })
      );

      setScheduledShifts(enrichedShifts);
    } catch (error) {
      console.error('Error fetching scheduled shifts:', error);
    }
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    const diffMs = end.getTime() - start.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  };

  const onSubmit = async (data: ScheduledShiftFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('scheduled_shifts')
        .insert({
          company_id: companyId,
          shift_name: data.shift_name,
          guard_id: data.guard_id || '',
          property_id: data.property_id || '',
          start_date: data.start_date,
          end_date: data.end_date,
          start_time: data.start_time,
          end_time: data.end_time,
          days_of_week: data.days_of_week || [],
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Scheduled shift created successfully",
      });

      form.reset();
      setIsOpen(false);
      fetchScheduledShifts();
      onShiftCreated();
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

  const deleteScheduledShift = async (shiftId: string) => {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Scheduled Shifts
              </CardTitle>
              <CardDescription>
                Create and manage guard shift schedules with date ranges and time periods
              </CardDescription>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Shift
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule New Shift</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="shift_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shift Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Night Security" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="guard_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assign Guard (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select guard" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Unassigned</SelectItem>
                                {guards.map((guard) => (
                                  <SelectItem key={guard.id} value={guard.id}>
                                    {guard.first_name} {guard.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="property_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select property" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">No specific property</SelectItem>
                              {properties.map((property) => (
                                <SelectItem key={property.id} value={property.id}>
                                  {property.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="start_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time *</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time *</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormItem>
                        <FormLabel>Duration</FormLabel>
                        <div className="flex items-center h-10 px-3 py-2 border border-input bg-background rounded-md text-sm">
                          <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                          {form.watch('start_time') && form.watch('end_time') 
                            ? `${calculateDuration(form.watch('start_time'), form.watch('end_time'))}h`
                            : '0h'
                          }
                        </div>
                      </FormItem>
                    </div>

                    <FormField
                      control={form.control}
                      name="days_of_week"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recurring Days (Optional)</FormLabel>
                          <div className="grid grid-cols-7 gap-2">
                            {weekDays.map((day) => (
                              <div key={day.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`day-${day.value}`}
                                  checked={field.value?.includes(String(day.value)) || false}
                                  onCheckedChange={(checked) => {
                                    const currentDays = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentDays, String(day.value)]);
                                    } else {
                                      field.onChange(currentDays.filter(d => d !== String(day.value)));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`day-${day.value}`}
                                  className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {day.label.slice(0, 3)}
                                </label>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Schedule'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium">Shift Name</th>
                  <th className="text-left p-4 font-medium">Guard</th>
                  <th className="text-left p-4 font-medium">Property</th>
                  <th className="text-left p-4 font-medium">Period</th>
                  <th className="text-left p-4 font-medium">Time</th>
                  <th className="text-left p-4 font-medium">Recurring</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scheduledShifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No Scheduled Shifts</p>
                      <p>Create your first scheduled shift to get started</p>
                    </td>
                  </tr>
                  ) : (
                    scheduledShifts.map((shift) => (
                      <tr key={shift.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="p-4">
                          <span className="font-medium">{shift.shift_name}</span>
                        </td>
                        <td className="p-4">
                          {shift.guard ? (
                            <span className="text-sm">
                              {shift.guard.first_name} {shift.guard.last_name}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="p-4">
                          {shift.property ? (
                            <span className="text-sm">{shift.property.name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Any property</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <div>{new Date(shift.start_date).toLocaleDateString()}</div>
                            <div className="text-muted-foreground">
                              to {new Date(shift.end_date).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {shift.start_time} - {shift.end_time}
                          </div>
                        </td>
                        <td className="p-4">
                          {shift.days_of_week?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {shift.days_of_week.map(day => (
                                <Badge key={day} variant="secondary" className="text-xs">
                                  {weekDays.find(d => String(d.value) === day)?.label.slice(0, 3) || day}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No recurrence</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge variant={shift.is_active ? 'default' : 'secondary'}>
                            {shift.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteScheduledShift(shift.id)}
                          >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
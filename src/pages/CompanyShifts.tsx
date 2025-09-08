import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Activity, ArrowLeft, Calendar, Clock, MapPin, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import LocationMap from "@/components/LocationMap";
// import { ScheduledShiftsForm } from "@/components/ScheduledShiftsForm";

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  first_name: string;
  last_name: string;
}

interface Shift {
  id: string;
  guard_id: string;
  company_id: string;
  check_in_time: string;
  check_out_time: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  guard?: {
    first_name: string;
    last_name: string;
  };
}

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  license_limit?: number;
  created_at: string;
  updated_at: string;
}

const CompanyShifts = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [mapShift, setMapShift] = useState<Shift | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  // Set up real-time subscription for shifts
  useEffect(() => {
    if (!userProfile?.company_id) return;

    const shiftsChannel = supabase
      .channel('shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guard_shifts',
          filter: `company_id=eq.${userProfile.company_id}`
        },
        () => {
          fetchShifts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(shiftsChannel);
    };
  }, [userProfile?.company_id]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/auth';
        return;
      }

      setUser(user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast({
          title: "Error",
          description: "Unable to verify permissions",
          variant: "destructive",
        });
        return;
      }

      if (profile.role !== 'company_admin') {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        window.location.href = '/';
        return;
      }

      setUserProfile(profile);
      await fetchCompany(profile.company_id);
      await fetchShifts(profile.company_id);
    } catch (error) {
      console.error('Error checking user:', error);
      window.location.href = '/auth';
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) {
        console.error('Error fetching company:', error);
        return;
      }

      setCompany(data);
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchShifts = async (companyId?: string) => {
    const targetCompanyId = companyId || userProfile?.company_id;
    if (!targetCompanyId) return;

    console.log('Fetching shifts for company:', targetCompanyId);
    try {
      // First fetch properties to resolve location names
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('company_id', targetCompanyId);

      if (propertiesError) {
        console.error('Error fetching properties:', propertiesError);
      }

      const { data, error } = await supabase
        .from('guard_shifts')
        .select(`
          *,
          guard:profiles!guard_shifts_guard_id_fkey(first_name, last_name)
        `)
        .eq('company_id', targetCompanyId)
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error('Error fetching shifts:', error);
        toast({
          title: "Error",
          description: "Failed to fetch shift data",
          variant: "destructive",
        });
        return;
      }

      // Process shifts to resolve property names from location_address
      const processedShifts = data?.map(shift => {
        if (shift.location_address && properties) {
          // Check if location_address is a property ID (UUID format)
          const propertyMatch = properties.find(prop => prop.id === shift.location_address);
          if (propertyMatch) {
            return {
              ...shift,
              location_address: propertyMatch.name
            };
          }
        }
        return shift;
      }) || [];

      console.log('Fetched shifts data:', processedShifts);
      setShifts(processedShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading shifts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <Link to="/company">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-semibold tracking-wide">GUARD SHIFTS</h1>
              <p className="text-sm text-muted-foreground">
                {company?.name} - Monitor guard check-in and check-out times
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Scheduled Shifts Section - Temporarily disabled */}
        {/* <ScheduledShiftsForm 
          companyId={userProfile?.company_id || ''} 
          onSuccess={fetchShifts}
        /> */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Guard Shifts
            </CardTitle>
            <CardDescription>
              Monitor guard check-in and check-out times with locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium">Guard</th>
                    <th className="text-left p-4 font-medium">Check In</th>
                    <th className="text-left p-4 font-medium">Check Out</th>
                    <th className="text-left p-4 font-medium">Duration</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Location</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No Shifts Recorded</p>
                        <p>Guard shifts will appear here when guards check in and out</p>
                      </td>
                    </tr>
                  ) : (
                     shifts.map((shift) => {
                       const checkInTime = new Date(shift.check_in_time);
                       const checkOutTime = shift.check_out_time ? new Date(shift.check_out_time) : null;
                       const duration = checkOutTime 
                         ? Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60 * 100)) / 100
                         : null;
                       const isActive = !shift.check_out_time;
                       
                       console.log('Shift data:', {
                         guard: `${shift.guard?.first_name} ${shift.guard?.last_name}`,
                         check_out_time: shift.check_out_time,
                         isActive,
                         checkOutTime
                       });
                       
                       return (
                        <tr 
                          key={shift.id} 
                          className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedShift(shift)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {shift.guard?.first_name?.charAt(0) || 'G'}
                                </span>
                              </div>
                              <span className="font-medium">
                                {shift.guard?.first_name} {shift.guard?.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {checkInTime.toLocaleDateString()}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {checkInTime.toLocaleTimeString()}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            {checkOutTime ? (
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {checkOutTime.toLocaleDateString()}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {checkOutTime.toLocaleTimeString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Still active</span>
                            )}
                          </td>
                          <td className="p-4">
                            {duration ? (
                              <span className="text-sm font-medium">{duration}h</span>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Active
                              </Badge>
                            )}
                          </td>
                          <td className="p-4">
                            <Badge 
                              variant={isActive ? "default" : "secondary"}
                              className={isActive ? "bg-green-100 text-green-800" : ""}
                            >
                              {isActive ? 'Active' : 'Completed'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            {shift.location_lat && shift.location_lng ? (
                              <div className="flex flex-col gap-1">
                                <div 
                                  className="flex items-center gap-1 text-sm text-primary cursor-pointer hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('Coordinates clicked:', shift.location_lat, shift.location_lng);
                                    setMapShift(shift);
                                  }}
                                >
                                  <MapPin className="h-3 w-3" />
                                  <span>
                                    {shift.location_lat.toFixed(6)}, {shift.location_lng.toFixed(6)}
                                  </span>
                                </div>
                                {shift.location_address && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={shift.location_address}>
                                    {shift.location_address}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No location</span>
                            )}
                          </td>
                          <td className="p-4">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShift(shift);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Shift Details Modal */}
        <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Shift Details</DialogTitle>
              <DialogDescription>
                Detailed information about this guard shift
              </DialogDescription>
            </DialogHeader>
            {selectedShift && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Guard Information</h4>
                  <p className="font-medium">
                    {selectedShift.guard?.first_name} {selectedShift.guard?.last_name}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Shift Times</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Check In:</strong> {new Date(selectedShift.check_in_time).toLocaleString()}</p>
                    <p><strong>Check Out:</strong> {
                      selectedShift.check_out_time 
                        ? new Date(selectedShift.check_out_time).toLocaleString()
                        : 'Still active'
                    }</p>
                  </div>
                </div>

                {selectedShift.notes && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Notes</h4>
                    <p className="text-sm bg-muted p-2 rounded">{selectedShift.notes}</p>
                  </div>
                )}

                {(selectedShift.location_lat && selectedShift.location_lng) && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Location</h4>
                    <div className="text-sm space-y-1">
                      <div 
                        className="flex items-center gap-2 text-primary cursor-pointer hover:underline"
                        onClick={() => {
                          console.log('Modal coordinates clicked:', selectedShift.location_lat, selectedShift.location_lng);
                          setMapShift(selectedShift);
                        }}
                      >
                        <MapPin className="h-4 w-4" />
                        {selectedShift.location_lat.toFixed(6)}, {selectedShift.location_lng.toFixed(6)}
                      </div>
                      {selectedShift.location_address && (
                        <p className="text-muted-foreground ml-6">{selectedShift.location_address}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Location Map Modal */}
        {mapShift && mapShift.location_lat && mapShift.location_lng && (
          <LocationMap
            isOpen={!!mapShift}
            onClose={() => {
              console.log('Map closing');
              setMapShift(null);
            }}
            latitude={mapShift.location_lat}
            longitude={mapShift.location_lng}
            guardName={mapShift.guard ? `${mapShift.guard.first_name} ${mapShift.guard.last_name}` : undefined}
            timestamp={mapShift.check_in_time}
            locationAddress={mapShift.location_address || undefined}
          />
        )}
        
        {/* Debug info */}
        {mapShift && (
          <div className="fixed top-4 right-4 bg-black text-white p-2 rounded text-xs z-50">
            Map Shift: {mapShift.location_lat}, {mapShift.location_lng}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyShifts;
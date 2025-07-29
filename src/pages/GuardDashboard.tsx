import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Camera, MapPin, ClipboardList, Clock, Play, Square } from "lucide-react";

const GuardDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [taskData, setTaskData] = useState({
    taskType: "",
    site: "",
    description: "",
    severity: "",
    image: null as File | null
  });
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      checkActiveShift();
    }
  }, [user]);

  const checkActiveShift = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data: activeShift } = await supabase
        .from('guard_shifts')
        .select('*')
        .eq('guard_id', profile.id)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .single();

      setCurrentShift(activeShift);
    } catch (error) {
      console.log('No active shift found');
    }
  };

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    setUser(user);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTaskData({ ...taskData, image: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!taskData.taskType || !taskData.site || !taskData.description || !taskData.severity) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let imageUrl = null;

      // Upload image if provided
      if (taskData.image) {
        const fileExt = taskData.image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('guard-reports')
          .upload(fileName, taskData.image);

        if (uploadError) {
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('guard-reports')
          .getPublicUrl(fileName);
        
        imageUrl = urlData.publicUrl;
      }

      // Get user's profile for company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Submit report
      const { error: reportError } = await supabase
        .from('guard_reports')
        .insert({
          guard_id: profile.id,
          company_id: profile.company_id,
          report_text: `Task: ${taskData.taskType}\nSite: ${taskData.site}\nSeverity: ${taskData.severity}\nDescription: ${taskData.description}`,
          image_url: imageUrl,
          location_address: taskData.site
        });

      if (reportError) {
        throw new Error(`Failed to submit report: ${reportError.message}`);
      }

      toast({
        title: "Success",
        description: "Task submitted successfully!",
      });

      // Reset form
      setTaskData({
        taskType: "",
        site: "",
        description: "",
        severity: "",
        image: null
      });

      // Reset file input
      const fileInput = document.getElementById('image-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Error submitting task:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit task",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    });
  };

  const handleStartShift = async () => {
    if (!user) return;
    
    setShiftLoading(true);
    
    try {
      // Get location
      const position = await getLocation();
      const { latitude, longitude } = position.coords;
      
      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Create new shift
      const { data: newShift, error } = await supabase
        .from('guard_shifts')
        .insert({
          guard_id: profile.id,
          company_id: profile.company_id,
          location_lat: latitude,
          location_lng: longitude,
          location_address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentShift(newShift);
      toast({
        title: "Shift Started",
        description: "Your shift has been started successfully with location tracking.",
      });
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start shift",
        variant: "destructive",
      });
    } finally {
      setShiftLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!currentShift || !user) return;
    
    setShiftLoading(true);
    
    try {
      // Get current location
      const position = await getLocation();
      const { latitude, longitude } = position.coords;
      
      // Update shift with end time and location
      const { error } = await supabase
        .from('guard_shifts')
        .update({
          check_out_time: new Date().toISOString(),
          location_lat: latitude,
          location_lng: longitude,
          location_address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        })
        .eq('id', currentShift.id);

      if (error) throw error;

      setCurrentShift(null);
      toast({
        title: "Shift Ended",
        description: "Your shift has been ended successfully.",
      });
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to end shift",
        variant: "destructive",
      });
    } finally {
      setShiftLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Guard Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {user?.email}
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Shift Management */}
      <div className="p-6 pb-0">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <Clock className="h-6 w-6" />
              Shift Management
            </CardTitle>
            <CardDescription>
              {currentShift 
                ? `Shift started at ${new Date(currentShift.check_in_time).toLocaleString()}`
                : "Start your shift to begin tracking your work hours"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 justify-center">
              {!currentShift ? (
                <Button 
                  onClick={handleStartShift}
                  disabled={shiftLoading}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {shiftLoading ? "Starting..." : "Start Shift"}
                </Button>
              ) : (
                <Button 
                  onClick={handleEndShift}
                  disabled={shiftLoading}
                  variant="destructive"
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  {shiftLoading ? "Ending..." : "End Shift"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Submission Form */}
      <div className="flex-1 p-6 pt-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <ClipboardList className="h-6 w-6" />
              Submit Task Report
            </CardTitle>
            <CardDescription>
              Fill out the form below to submit your task report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Task Type */}
              <div className="space-y-2">
                <Label htmlFor="taskType">Choose Task *</Label>
                <Select value={taskData.taskType} onValueChange={(value) => setTaskData({ ...taskData, taskType: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="security-patrol">Security Patrol</SelectItem>
                    <SelectItem value="supervisor-visit">Supervisor Visit</SelectItem>
                    <SelectItem value="perimeter-check">Perimeter Check</SelectItem>
                    <SelectItem value="building-inspection">Building Inspection</SelectItem>
                    <SelectItem value="alarm-response">Alarm Response</SelectItem>
                    <SelectItem value="fire-safety-check">Fire Safety Check</SelectItem>
                    <SelectItem value="maintenance-check">Maintenance Check</SelectItem>
                    <SelectItem value="emergency-response">Emergency Response</SelectItem>
                    <SelectItem value="access-control">Access Control</SelectItem>
                    <SelectItem value="visitor-management">Visitor Management</SelectItem>
                    <SelectItem value="vehicle-inspection">Vehicle Inspection</SelectItem>
                    <SelectItem value="equipment-check">Equipment Check</SelectItem>
                    <SelectItem value="incident-report">Incident Report</SelectItem>
                    <SelectItem value="parking-patrol">Parking Area Patrolling</SelectItem>
                    <SelectItem value="warehouse-patrol">Warehouse Patrol</SelectItem>
                    <SelectItem value="night-watch">Night Watch</SelectItem>
                    <SelectItem value="crowd-control">Crowd Control</SelectItem>
                    <SelectItem value="lock-up-procedure">Lock-up Procedure</SelectItem>
                    <SelectItem value="burglar-theft">Burglar Theft</SelectItem>
                    <SelectItem value="trespassing">Trespassing</SelectItem>
                    <SelectItem value="vulgar-behavior">Vulgar Behavior</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Site */}
              <div className="space-y-2">
                <Label htmlFor="site">Work Site *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="site"
                    placeholder="Enter the site location"
                    className="pl-10"
                    value={taskData.site}
                    onChange={(e) => setTaskData({ ...taskData, site: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Issue Severity */}
              <div className="space-y-2">
                <Label htmlFor="severity">Type of Issue *</Label>
                <Select value={taskData.severity} onValueChange={(value) => setTaskData({ ...taskData, severity: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select issue severity" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the task details, observations, or issues..."
                  className="min-h-[100px]"
                  value={taskData.description}
                  onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                  required
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label htmlFor="image-upload">Take Photo</Label>
                <div className="relative">
                  <Camera className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="pl-10"
                    onChange={handleImageUpload}
                  />
                </div>
                {taskData.image && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {taskData.image.name}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Submitting..." : "Submit Task Report"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuardDashboard;
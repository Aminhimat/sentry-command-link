import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, Camera, MapPin, ClipboardList, Clock, Play, Square, QrCode, Building, ImageIcon } from "lucide-react";
import QrScanner from 'qr-scanner';
import { Geolocation } from '@capacitor/geolocation';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

const GuardDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [taskData, setTaskData] = useState({
    taskType: "",
    customTaskType: "",
    site: "",
    description: "",
    severity: "none",
    image: null as File | null
  });
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      checkActiveShift();
    }
  }, [user]);

  // Fetch properties for work site dropdown - only from user's company
  useEffect(() => {
    if (user) {
      fetchProperties();
    }
  }, [user]);

  const fetchProperties = async () => {
    if (!user) return;
    
    setLoadingProperties(true);
    try {
      // First get user's profile to find their company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        console.log('User has no company assigned');
        setProperties([]);
        return;
      }

      // Fetch properties belonging to user's company
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          name,
          location_address
        `)
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching properties:', error);
        toast({
          title: "Error",
          description: "Failed to load work sites",
          variant: "destructive",
        });
      } else {
        setProperties(data || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast({
        title: "Error",
        description: "Failed to load work sites",
        variant: "destructive",
      });
    } finally {
      setLoadingProperties(false);
    }
  };

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
      navigate('/auth');
      return;
    }

    setUser(user);
  };

  const handleCameraCapture = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use native camera on mobile
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
        });

        // Convert to blob and then to File
        const response = await fetch(image.webPath!);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setTaskData({ ...taskData, image: file });
      } else {
        // Fallback for web - trigger file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (file) {
            setTaskData({ ...taskData, image: file });
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGallerySelect = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use native photo library on mobile
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
        });

        // Convert to blob and then to File
        const response = await fetch(image.webPath!);
        const blob = await response.blob();
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setTaskData({ ...taskData, image: file });
      } else {
        // Fallback for web - trigger file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (file) {
            setTaskData({ ...taskData, image: file });
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('Error accessing photo library:', error);
      toast({
        title: "Photo Library Error",
        description: "Could not access photo library. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check which required fields are missing
    const missingFields = [];
    if (!taskData.taskType) missingFields.push("Task Type");
    if (!taskData.site) missingFields.push("Work Site");  
    if (!taskData.severity) missingFields.push("Type of Issue");
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // If "other" is selected, check for custom task type
    if (taskData.taskType === "other" && !taskData.customTaskType.trim()) {
      toast({
        title: "Error",
        description: "Please specify what kind of task you're performing",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get current location
      let location = null;
      try {
        location = await getLocation();
      } catch (error) {
        console.log('Could not get location:', error);
      }

      if (taskData.image) {
        // Use optimized edge function for faster image upload
        const formData = new FormData();
        formData.append('image', taskData.image);
        formData.append('reportData', JSON.stringify({
          taskType: taskData.taskType === "other" ? taskData.customTaskType : taskData.taskType,
          site: taskData.site,
          severity: taskData.severity,
          description: taskData.description.trim() || "Security Patrol",
          location
        }));

        const { data, error } = await supabase.functions.invoke('upload-guard-image', {
          body: formData
        });

        if (error) {
          throw new Error(error.message || 'Failed to submit report');
        }

        toast({
          title: "Report Submitted",
          description: "Your task report with photo has been sent to admin successfully!",
        });

      } else {
        // Submit report without image (faster path)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, company_id, first_name, last_name')
          .eq('user_id', user?.id)
          .single();

        if (!profile) {
          throw new Error('User profile not found');
        }

        const { error: reportError } = await supabase
          .from('guard_reports')
          .insert({
            guard_id: profile.id,
            company_id: profile.company_id,
            report_text: `Guard: ${profile.first_name} ${profile.last_name}\nTask: ${taskData.taskType === "other" ? taskData.customTaskType : taskData.taskType}\nSite: ${taskData.site}\nSeverity: ${taskData.severity}\nDescription: ${taskData.description.trim() || "Security Patrol"}`,
            location_address: taskData.site,
            location_lat: location?.latitude,
            location_lng: location?.longitude
          });

        if (reportError) {
          throw new Error(`Failed to submit report: ${reportError.message}`);
        }

        toast({
          title: "Report Submitted",
          description: "Your task report has been sent to admin successfully!",
        });
      }

      // Reset form completely
      setTaskData({
        taskType: "",
        customTaskType: "",
        site: "",
        description: "",
        severity: "none",
        image: null
      });

      // Reset file input
      const fileInput = document.getElementById('image-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Error submitting task:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit report to admin",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQrCodeScan = (result: string) => {
    console.log('QR Code scanned:', result);
    
    try {
      // Try to parse as JSON in case it's structured data
      const parsed = JSON.parse(result);
      
      if (parsed.location || parsed.site) {
        setTaskData({ ...taskData, site: parsed.location || parsed.site });
        toast({
          title: "QR Code Scanned",
          description: `Site location set to: ${parsed.location || parsed.site}`,
        });
      } else {
        // Try to parse as simple text for site location
        setTaskData({ ...taskData, site: result });
        toast({
          title: "QR Code Scanned",
          description: `Site location set to: ${result}`,
        });
      }
      
      stopQrScanner();
    } catch (error) {
      // If not JSON, treat as plain text for site location
      setTaskData({ ...taskData, site: result });
      toast({
        title: "QR Code Scanned",
        description: `Site location set to: ${result}`,
      });
      stopQrScanner();
    }
  };

  const startQrScanner = async () => {
    try {
      // Check if device has camera support
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        toast({
          title: "No Camera",
          description: "No camera found on this device",
          variant: "destructive",
        });
        return;
      }

      setShowQrScanner(true);
      
      // Wait for video element to be available
      setTimeout(async () => {
        if (videoElement) {
          const scanner = new QrScanner(
            videoElement, 
            (result) => {
              // Handle both string results and ScanResult objects
              const data = typeof result === 'string' ? result : result.data;
              handleQrCodeScan(data);
            },
            {
              preferredCamera: 'environment',
              highlightScanRegion: true,
              highlightCodeOutline: true,
            }
          );
          
          setQrScanner(scanner);
          await scanner.start();
        }
      }, 100);
      
    } catch (error) {
      console.error('QR Scanner error:', error);
      toast({
        title: "Scanner Error",
        description: "Failed to start QR scanner. Please check camera permissions.",
        variant: "destructive",
      });
      setShowQrScanner(false);
    }
  };

  const stopQrScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }
    setShowQrScanner(false);
  };

  const handleQrError = (err: any) => {
    console.error('QR Scanner error:', err);
    toast({
      title: "Camera Error", 
      description: "Failed to access camera. Please check permissions.",
      variant: "destructive",
    });
  };

  const checkLocationPermissions = async (): Promise<void> => {
    try {
      // Try Capacitor geolocation permissions first (for mobile apps)
      try {
        const permissions = await Geolocation.checkPermissions();
        console.log('Geolocation permissions:', permissions);
        
        if (permissions.location !== 'granted') {
          // Request permissions
          const requestResult = await Geolocation.requestPermissions();
          console.log('Permission request result:', requestResult);
          
          if (requestResult.location !== 'granted') {
            // Show dialog to open settings
            toast({
              title: "Location Permission Required",
              description: "Please enable location access in your device settings to start your shift.",
              variant: "destructive",
            });
            
            // Try to open device settings (for mobile)
            if (window.location.protocol === 'capacitor:') {
              // This will work on mobile with Capacitor
              await Geolocation.requestPermissions();
            }
            
            throw new Error('Location permission denied. Please enable location access in your device settings.');
          }
        }
        return; // Permissions granted
      } catch (capacitorError: any) {
        console.log('Capacitor permission check failed, falling back to browser:', capacitorError);
        
        // Fallback to browser permissions
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state === 'denied') {
            toast({
              title: "Location Permission Required",
              description: "Please enable location access in your browser settings to start your shift.",
              variant: "destructive",
            });
            throw new Error('Location access is denied. Please enable location permissions in your browser settings.');
          }
        }
      }
    } catch (error: any) {
      console.error('Location permission error:', error);
      throw error;
    }
  };

  const getLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    try {
      // Try Capacitor geolocation first (for mobile apps)
      try {
        // Check permissions first
        const permissions = await Geolocation.checkPermissions();
        console.log('Geolocation permissions:', permissions);
        
        if (permissions.location !== 'granted') {
          // Request permissions
          const requestResult = await Geolocation.requestPermissions();
          console.log('Permission request result:', requestResult);
          
          if (requestResult.location !== 'granted') {
            throw new Error('Location permission denied. Please enable location access in your device settings.');
          }
        }

        // Get position using Capacitor
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000
        });

        console.log('Capacitor location success:', position);
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (capacitorError: any) {
        console.log('Capacitor geolocation failed, falling back to browser:', capacitorError);
        
        // Fallback to browser geolocation
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by this device.');
        }

        // Check browser permissions
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state === 'denied') {
            throw new Error('Location access is denied. Please enable location permissions in your browser settings.');
          }
        }

        // Get position using browser API
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            (error) => {
              let errorMessage = 'Failed to get location. ';
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage += 'Location access denied. Please allow location access and try again.';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage += 'Location information unavailable.';
                  break;
                case error.TIMEOUT:
                  errorMessage += 'Location request timed out.';
                  break;
                default:
                  errorMessage += 'Unknown location error.';
                  break;
              }
              reject(new Error(errorMessage));
            }, 
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 60000
            }
          );
        });

        console.log('Browser location success:', position);
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      }
    } catch (error: any) {
      console.error('Location error:', error);
      throw error;
    }
  };

  const handleStartShift = async () => {
    if (!user) return;
    
    setShiftLoading(true);
    
    try {
      // Check location permissions first
      await checkLocationPermissions();
      
      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      let latitude = null;
      let longitude = null;
      let locationAddress = 'Location not available';
      let locationWarning = '';

      // Try to get location with better user feedback
      try {
        toast({
          title: "Getting Location",
          description: "Please allow location access for accurate shift tracking...",
        });
        
        const position = await getLocation();
        latitude = position.latitude;
        longitude = position.longitude;
        
        // Validate that this is not a default San Francisco location
        const isSanFrancisco = (
          Math.abs(latitude - 37.785834) < 0.001 && 
          Math.abs(longitude - (-122.406417)) < 0.001
        );
        
        if (isSanFrancisco) {
          console.warn('Detected San Francisco default location, likely mock/cached data');
          toast({
            title: "Location Warning",
            description: "Using mock location detected. Please ensure location services are enabled and you're not using a simulator.",
            variant: "destructive",
          });
          // Still use the coordinates but warn the user
        }
        
        locationAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        console.log('Location obtained:', { latitude, longitude, isSanFrancisco });
      } catch (locationError: any) {
        console.warn('Location access failed:', locationError);
        locationWarning = locationError.message || 'Location access failed';
        
        // Show specific warning about location
        toast({
          title: "Location Warning",
          description: locationWarning + " Shift will be recorded without precise location.",
          variant: "destructive",
        });
      }

      // Create new shift
      const { data: newShift, error } = await supabase
        .from('guard_shifts')
        .insert({
          guard_id: profile.id,
          company_id: profile.company_id,
          location_lat: latitude,
          location_lng: longitude,
          location_address: locationAddress
        })
        .select()
        .single();

      if (error) {
        console.error('Start shift database error:', error);
        throw error;
      }

      setCurrentShift(newShift);
      
      if (latitude) {
        toast({
          title: "Shift Started",
          description: "Your shift has been started successfully with location tracking.",
        });
      } else {
        toast({
          title: "Shift Started (No Location)",
          description: "Your shift has been started but without location tracking. Enable location access for better tracking.",
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      console.error('Start shift error:', error);
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
      // Get user's profile first to verify guard_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Verify the current shift belongs to this guard
      if (currentShift.guard_id !== profile.id) {
        throw new Error('Shift does not belong to current user');
      }

      let latitude = currentShift.location_lat;
      let longitude = currentShift.location_lng;
      let locationAddress = 'Location not available';

      // Try to get current location, but don't fail if it's not available
      try {
        const position = await getLocation();
        latitude = position.latitude;
        longitude = position.longitude;
        locationAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      } catch (locationError) {
        console.warn('Location access failed for end shift:', locationError);
        // Use original shift location or default
        locationAddress = currentShift.location_address || 'Location not available';
      }
      
      // Update shift with end time and location
      const { error } = await supabase
        .from('guard_shifts')
        .update({
          check_out_time: new Date().toISOString(),
          location_lat: latitude,
          location_lng: longitude,
          location_address: locationAddress
        })
        .eq('id', currentShift.id);

      if (error) {
        console.error('End shift database error:', error);
        throw error;
      }

      setCurrentShift(null);
      toast({
        title: "Shift Ended",
        description: "Your shift has been ended successfully.",
      });
      
    } catch (error: any) {
      console.error('End shift error:', error);
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
    navigate('/');
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
              Submit Security Report
            </CardTitle>
            <CardDescription>
              Submit your security report directly to admin - no local storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Task Type */}
              <div className="space-y-2">
                <Label htmlFor="taskType" className="flex items-center gap-2">
                  Choose Task *
                  {!taskData.taskType && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                  )}
                  {taskData.taskType && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓</span>
                  )}
                </Label>
                <Select value={taskData.taskType} onValueChange={(value) => setTaskData({ ...taskData, taskType: value, customTaskType: "" })}>
                  <SelectTrigger className={!taskData.taskType ? "border-red-300" : "border-green-300"}>
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

                {/* Custom Task Input - Shows when "other" is selected */}
                {taskData.taskType === "other" && (
                  <div className="mt-2">
                    <Input
                      placeholder="Please specify the task type..."
                      value={taskData.customTaskType}
                      onChange={(e) => setTaskData({ ...taskData, customTaskType: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Site */}
              <div className="space-y-2">
                <Label htmlFor="site">Work Site *</Label>
                <Tabs defaultValue="properties" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="properties" className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Properties
                    </TabsTrigger>
                    <TabsTrigger value="qr" className="flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      QR Scan
                    </TabsTrigger>
                  </TabsList>
                  
                   <TabsContent value="properties" className="space-y-2">
                     <div className="relative">
                       <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                       {(() => {
                         // Check if the selected site matches any property name for proper selection display
                         const selectedPropertyValue = properties.find(prop => prop.name === taskData.site)?.id || taskData.site;
                         
                         return (
                           <Select 
                             value={selectedPropertyValue}
                             onValueChange={(value) => {
                               // Find the selected property to get its name
                               const selectedProperty = properties.find(prop => prop.id === value);
                               const siteName = selectedProperty ? selectedProperty.name : value;
                               setTaskData({ 
                                 ...taskData, 
                                 site: siteName 
                               });
                             }}
                           >
                             <SelectTrigger className="pl-10">
                               <SelectValue placeholder={loadingProperties ? "Loading properties..." : "Select a work site"} />
                             </SelectTrigger>
                             <SelectContent className="bg-background border border-border shadow-lg z-50">
                               {loadingProperties ? (
                                 <SelectItem value="loading" disabled>Loading work sites...</SelectItem>
                               ) : properties.length === 0 ? (
                                 <SelectItem value="no-sites" disabled>No work sites available</SelectItem>
                               ) : (
                                 properties.map((property) => (
                                   <SelectItem key={property.id} value={property.id}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{property.name}</span>
                                        {property.location_address && (
                                          <span className="text-xs text-muted-foreground">{property.location_address}</span>
                                        )}
                                      </div>
                                   </SelectItem>
                                 ))
                               )}
                             </SelectContent>
                           </Select>
                         );
                       })()}
                     </div>
                    {!loadingProperties && properties.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No work sites found. Contact your administrator to set up work sites.
                      </p>
                    )}
                  </TabsContent>
                  
                  
                   <TabsContent value="qr" className="space-y-2">
                     <div className="text-center space-y-4">
                       <div className="mx-auto w-64 h-48 bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                         {showQrScanner ? (
                           <>
                             <video
                               ref={(el) => setVideoElement(el)}
                               className="w-full h-full object-cover rounded-lg"
                               autoPlay
                               playsInline
                               muted
                             />
                             <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none">
                               <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
                               <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
                               <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
                               <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary"></div>
                             </div>
                           </>
                         ) : (
                           <>
                             <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                             <p className="text-sm text-muted-foreground mb-4 px-2">
                               Scan QR code for location (iOS compatible)
                             </p>
                             <Button
                               onClick={startQrScanner}
                               variant="outline"
                               className="flex items-center gap-2"
                             >
                               <QrCode className="h-4 w-4" />
                               Start Scanner
                             </Button>
                           </>
                         )}
                       </div>
                       
                       {showQrScanner && (
                         <Button
                           onClick={stopQrScanner}
                           variant="outline"
                           className="w-full"
                         >
                           Stop Scanner
                         </Button>
                       )}
                       
                        {taskData.site && (
                         <div className="p-2 bg-green-50 border border-green-200 rounded">
                           <p className="text-sm text-green-800 font-medium">
                             ✓ Site: {taskData.site}
                           </p>
                         </div>
                       )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Issue Severity */}
              <div className="space-y-2">
                <Label htmlFor="severity" className="flex items-center gap-2">
                  Type of Issue *
                  {!taskData.severity && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                  )}
                  {taskData.severity && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓</span>
                  )}
                </Label>
                <Select value={taskData.severity} onValueChange={(value) => setTaskData({ ...taskData, severity: value })}>
                  <SelectTrigger className={!taskData.severity ? "border-red-300" : "border-green-300"}>
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
                  placeholder="Describe the task details, observations, or issues (optional - defaults to 'Security Patrol')..."
                  className="min-h-[100px]"
                  value={taskData.description}
                  onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Take Photo</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCameraCapture}
                    className="flex-1"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGallerySelect}
                    className="flex-1"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose Photo
                  </Button>
                </div>
                {taskData.image && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <Camera className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-muted-foreground">
                      Photo ready: {taskData.image.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuardDashboard;
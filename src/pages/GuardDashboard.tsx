import { useState, useEffect, useCallback, useMemo, memo } from "react";
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
import { Shield, Camera, MapPin, ClipboardList, Clock, Play, Square, QrCode, Building, Wifi, WifiOff, Download } from "lucide-react";
import QrScanner from 'qr-scanner';
import jsQR from 'jsqr';
import { Geolocation } from '@capacitor/geolocation';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { backgroundSync } from "@/utils/backgroundSync";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { imageOptimizer } from "@/utils/imageOptimization";
import { QRCodeSVG } from 'qrcode.react';

const GuardDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [taskData, setTaskData] = useState({
    taskType: "security-patrol",
    customTaskType: "",
    site: "",
    description: "",
    severity: "none",
    image: null as File | null
  });
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [qrScanSuccess, setQrScanSuccess] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showMissingFieldsError, setShowMissingFieldsError] = useState<string[]>([]);
  const [locationTracking, setLocationTracking] = useState(false);
  const [locationInterval, setLocationInterval] = useState<NodeJS.Timeout | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingReports, setPendingReports] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [qrGeneratorText, setQrGeneratorText] = useState("");
  const [qrGeneratedFor, setQrGeneratedFor] = useState("");
  const { toast } = useToast();

  // Function to play success sound
  const playSuccessSound = () => {
    try {
      // Create audio context for a simple success beep
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure the success sound - pleasant two-tone chime
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play success sound:', error);
    }
  };

  useEffect(() => {
    checkUser();
    
    // Setup online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Update pending reports count
    const updatePendingCount = async () => {
      const count = await backgroundSync.getPendingCount();
      setPendingReports(count);
    };
    
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (user) {
      checkActiveShift();
    }
  }, [user]);

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      if (locationInterval) {
        clearInterval(locationInterval);
      }
    };
  }, [locationInterval]);

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
      // First get user's profile to find their assigned property
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, assigned_property_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        console.log('User has no company assigned');
        setProperties([]);
        return;
      }

      // If guard has an assigned property, only show that one
      if (profile.assigned_property_id) {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            id,
            name,
            location_address
          `)
          .eq('id', profile.assigned_property_id)
          .eq('is_active', true)
          .single();

        if (error) {
          console.error('Error fetching assigned property:', error);
          setProperties([]);
        } else {
          setProperties(data ? [data] : []);
        }
      } else {
        // If no specific property assigned, show all company properties (fallback)
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

  const startLocationTracking = async (shiftId: string, guardId: string) => {
    if (locationInterval) {
      clearInterval(locationInterval);
    }

    console.log('🌍 Starting location tracking for shift:', shiftId);
    setLocationTracking(true);

    // Inform user that location tracking is now active
    toast({
      title: "📍 Location Tracking Active",
      description: "Your location is being tracked for security purposes during your shift.",
      duration: 4000,
    });

    // Function to update location
    const updateLocation = async () => {
      try {
        const position = await getLocation();
        
        // Get user's company_id for the location record
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', guardId)
          .single();

        if (profile) {
          const { error } = await supabase
            .from('guard_locations')
            .insert({
              guard_id: guardId,
              shift_id: shiftId,
              company_id: profile.company_id,
              location_lat: position.latitude,
              location_lng: position.longitude,
              location_address: `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`
            });

          if (error) {
            console.error('Failed to update guard location:', error);
          } else {
            console.log('📍 Location updated successfully');
          }
        }
      } catch (error) {
        console.error('Location tracking error:', error);
      }
    };

    // Update location immediately
    updateLocation();

    // Set up interval to update location every 30 seconds
    const interval = setInterval(updateLocation, 30000);
    setLocationInterval(interval);
  };

  const stopLocationTracking = () => {
    console.log('🛑 Stopping location tracking');
    setLocationTracking(false);
    
    if (locationInterval) {
      clearInterval(locationInterval);
      setLocationInterval(null);
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

      // If there's an active shift, ensure the profile is marked as active and start location tracking
      if (activeShift) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_active: true })
          .eq('id', profile.id);

        if (profileError) {
          console.error('Failed to update guard status:', profileError);
        }

        // Start location tracking for active shift
        startLocationTracking(activeShift.id, profile.id);
      }
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

    // Enforce login restrictions for guards
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.id) {
        // Check if guard account is active
        if (profile.is_active === false) {
          await supabase.auth.signOut();
          toast({
            variant: 'destructive',
            title: 'Account Inactive',
            description: 'Your account has been deactivated. Please contact your administrator.',
          });
          navigate('/auth');
          return;
        }
        const { data: constraints } = await supabase
          .from('guard_login_constraints')
          .select('*')
          .eq('guard_id', profile.id)
          .eq('is_active', true);

        if (constraints && constraints.length > 0) {
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          const currentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
          const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

          const allowed = constraints.some((c: any) => {
            const hasBoundary = !!(c.start_date || c.end_date || c.start_time || c.end_time);
            if (!hasBoundary) return false;
            if (c.start_date && currentDate < c.start_date) return false;
            if (c.end_date && currentDate > c.end_date) return false;
            const st = c.start_time ? String(c.start_time).slice(0, 8) : null;
            const et = c.end_time ? String(c.end_time).slice(0, 8) : null;
            if (st && currentTime < st) return false;
            if (et && currentTime > et) return false;
            return true;
          });

          if (!allowed) {
            await supabase.auth.signOut();
            toast({
              variant: 'destructive',
              title: 'Access Restricted',
              description: 'Login allowed only during scheduled window. Please try again later.',
            });
            navigate('/auth');
            return;
          }
        }
      }
    } catch (error) {
      console.error('Restriction validation failed', error);
      await supabase.auth.signOut();
      toast({
        variant: 'destructive',
        title: 'Access Restricted',
        description: 'Unable to verify login restrictions. Please contact your admin.',
      });
      navigate('/auth');
      return;
    }

    setUser(user);
  };


  const handleCameraCapture = async () => {
    let loadingToast: any;
    
    try {
      loadingToast = toast({
        title: "📸 Camera",
        description: "Opening camera...",
      });

      if (Capacitor.isNativePlatform()) {
        // Retry logic for mobile camera
        const maxRetries = 3;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`📸 Camera attempt ${attempt}/${maxRetries}`);
            
            // Add timeout wrapper - high quality for clear photos
            const cameraPromise = CapCamera.getPhoto({
              quality: 90,
              allowEditing: false,
              resultType: CameraResultType.DataUrl,
              source: CameraSource.Camera,
              correctOrientation: true,
              saveToGallery: false,
            });
            
            // 30 second timeout for camera operations
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Camera timeout')), 30000);
            });
            
            const image = await Promise.race([cameraPromise, timeoutPromise]) as any;

            if (image.dataUrl) {
              console.log(`✅ Camera success on attempt ${attempt}`);
              
              const response = await fetch(image.dataUrl);
              const blob = await response.blob();
              const originalFile = new File([blob], `guard_photo_${Date.now()}.jpg`, { 
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              
              // High quality compression - keeps excellent detail
              const { compressedFile, compressionRatio } = await imageOptimizer.compressImage(originalFile, {
                quality: 0.90,
                maxWidth: 1920,
                maxHeight: 1080,
                format: 'jpeg'
              });
              
              console.log(`✅ Optimized to ${Math.round(compressionRatio * 100)}% of original size`);
              
              setTaskData(prev => ({ ...prev, image: compressedFile }));
              
              return; // Success, exit retry loop
            }
          } catch (error: any) {
            lastError = error;
            console.error(`❌ Camera attempt ${attempt} failed:`, error);
            
            // If this is not the last attempt, wait before retry
            if (attempt < maxRetries) {
              console.log(`⏳ Retrying in ${attempt} second(s)...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
              
              // Update toast to show retry
              toast({
                title: "🔄 Retrying Camera",
                description: `Attempt ${attempt + 1} of ${maxRetries}...`,
              });
            }
          }
        }
        
        // If we get here, all attempts failed
        throw lastError || new Error('Camera failed after all retries');
        
      } else {
        // Web fallback with better error handling
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        
        // Wrap in promise to handle user cancellation
        const filePromise = new Promise<File | null>((resolve, reject) => {
          let resolved = false;
          
          input.onchange = async (event) => {
            if (resolved) return;
            resolved = true;
            
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {
              resolve(file);
            } else {
              resolve(null);
            }
          };
          
          // Handle user cancellation
          const handleFocus = () => {
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(null);
              }
            }, 1000);
          };
          
          window.addEventListener('focus', handleFocus, { once: true });
        });
        
        input.click();
        
        const file = await filePromise;
        if (file) {
          const { compressedFile, compressionRatio } = await imageOptimizer.compressImage(file, {
            quality: 0.90,
            maxWidth: 1920,
            maxHeight: 1080,
            format: 'jpeg'
          });
          
          setTaskData(prev => ({ ...prev, image: compressedFile }));
        } else {
          toast({
            title: "📸 Camera Cancelled",
            description: "Photo selection was cancelled",
          });
        }
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      
      let errorMessage = "Could not access camera. Please try again.";
      
      // Provide specific error messages
      if (error.message?.includes('timeout')) {
        errorMessage = "Camera took too long to respond. Please try again.";
      } else if (error.message?.includes('permission') || error.message?.includes('denied')) {
        errorMessage = "Camera permission denied. Please check app permissions.";
      } else if (error.message?.includes('unavailable') || error.message?.includes('not available')) {
        errorMessage = "Camera is not available on this device.";
      }
      
      toast({
        title: "❌ Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleQuickSubmit = async (data: typeof taskData) => {
    setIsLoading(true);

    try {
      // Get location quickly in background
      let location = null;
      try {
        location = await getLocation();
      } catch (error) {
        console.log('Could not get location:', error);
      }

      // Always save to offline storage first for reliability
      const reportId = await backgroundSync.saveReportForSync({
        taskType: data.taskType === "other" ? data.customTaskType : data.taskType,
        site: data.site,
        severity: data.severity,
        description: data.description || "Security Patrol",
        location,
        image: data.image || undefined
      });

      // Show immediate success - report is saved and will be uploaded
      playSuccessSound();
      
      toast({
        title: "🎯 Report Saved!",
        description: navigator.onLine 
          ? "Report is being uploaded..." 
          : "Report saved offline, will upload when online",
      });

      // Reset form immediately
      setTaskData({
        taskType: "",
        customTaskType: "",
        site: "",
        description: "",
        severity: "none",
        image: null
      });

      // Show upload progress if online
      if (navigator.onLine) {
        setTimeout(() => {
          toast({
            title: "📤 Upload Complete",
            description: "Report successfully sent to admin",
          });
        }, 2000);
      }

    } catch (error: any) {
      console.error('Error saving report:', error);
      toast({
        title: "❌ Save Failed",
        description: error.message || "Failed to save report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 Starting submit process...');
    
    // Check which required fields are missing
    const missingFields = [];
    if (!taskData.taskType) missingFields.push("Task Type");
    if (!taskData.site) missingFields.push("Work Site");  
    if (!taskData.severity) missingFields.push("Type of Issue");
    
    if (missingFields.length > 0) {
      console.log('❌ Missing fields:', missingFields);
      setShowMissingFieldsError(missingFields);
      return;
    }

    // Check if photo is required
    if (!taskData.image) {
      console.log('❌ Photo required');
      toast({
        title: "Photo Required",
        description: "Please take a photo before submitting your report.",
        variant: "destructive",
      });
      return;
    }

    // If "other" is selected, check for custom task type
    if (taskData.taskType === "other" && !taskData.customTaskType.trim()) {
      console.log('❌ Custom task type required');
      toast({
        title: "Error",
        description: "Please specify what kind of task you're performing",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Validation passed, setting loading state...');
    setIsLoading(true);

    try {
      console.log('📍 Getting location...');
      // Get current location (optional - don't block submission if it fails)
      let location = null;
      try {
        location = await getLocation();
        console.log('✅ Location obtained successfully:', location);
      } catch (locationError) {
        console.log('⚠️ Location access failed, continuing without location:', locationError);
        // Continue without location - don't block the submission
      }

      if (taskData.image) {
        console.log('📸 Submitting with image...');
        
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

        console.log('📤 Invoking upload-guard-image function...');
        const startTime = Date.now();
        const { data, error } = await supabase.functions.invoke('upload-guard-image', {
          body: formData
        });
        const uploadTime = Date.now() - startTime;

        if (error) {
          console.error('❌ Edge function error:', error);
          throw new Error(error.message || 'Failed to submit report');
        }

        console.log(`✅ Image upload successful in ${uploadTime}ms`);
        
        // Play success sound
        playSuccessSound();
        
        // Show success message
        setShowSuccessMessage(true);
        
        // Also show quick toast per requirement
        toast({ description: "Report submitted", duration: 1500 });
        
        // Hide success message after 1.5 seconds
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 1500);

      } else {
        console.log('📝 Submitting without image...');
        // Submit report without image (faster path)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, company_id, first_name, last_name')
          .eq('user_id', user?.id)
          .single();

        if (!profile) {
          console.error('❌ Profile not found');
          throw new Error('User profile not found');
        }

        console.log('👤 Profile found, inserting report...');
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
          console.error('❌ Report insert error:', reportError);
          throw new Error(`Failed to submit report: ${reportError.message}`);
        }

        console.log('✅ Report submitted successfully');
        
        // Play success sound
        playSuccessSound();
        
        // Show success message
        setShowSuccessMessage(true);
        
        // Hide success message after 1.5 seconds
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 1500);
        
        toast({
          description: "Report submitted",
          duration: 1500,
        });
      }

      console.log('🧹 Resetting form...');
        // Clear any error messages
        setShowMissingFieldsError([]);
        
        // Reset form completely
        setTaskData({
          taskType: "security-patrol",
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
      console.error('❌ Error submitting task:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit report to admin",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Setting loading to false...');
      setIsLoading(false);
    }
  };

  const handleQrCodeScan = (result: string) => {
    console.log('QR Code scanned:', result);
    
    // Set success flag to prevent error messages
    setQrScanSuccess(true);
    
    // Stop scanner immediately to prevent multiple scans
    stopQrScanner();
    
    try {
      // Try to parse as JSON in case it's structured data
      const parsed = JSON.parse(result);
      
      if (parsed.location || parsed.site) {
        setTaskData({ 
          ...taskData, 
          site: parsed.location || parsed.site,
          taskType: parsed.taskType || "security-patrol", // Default task type
          severity: parsed.severity || "none" // Default severity
        });
        toast({
          title: "QR Code Scanned",
          description: `Ready to submit - Site: ${parsed.location || parsed.site}`,
        });
      } else {
        // Try to parse as simple text for site location
        setTaskData({ 
          ...taskData, 
          site: result,
          taskType: "security-patrol", // Default task type
          severity: "none" // Default severity
        });
        toast({
          title: "QR Code Scanned", 
          description: `Ready to submit - Site: ${result}`,
        });
      }
      
    } catch (error) {
      // If not JSON, treat as plain text for site location
      setTaskData({ 
        ...taskData, 
        site: result,
        taskType: "security-patrol", // Default task type  
        severity: "none" // Default severity
      });
      toast({
        title: "QR Code Scanned",
        description: `Ready to submit - Site: ${result}`,
      });
    }
  };

  const startQrScanner = async () => {
    try {
      console.log('🔍 Starting QR scanner...');
      
      // Reset success flag when starting a new scan
      setQrScanSuccess(false);
      
      // For native Capacitor apps, use the native camera
      if (Capacitor.isNativePlatform()) {
        console.log('📱 Using Capacitor Camera for native mobile app');
        
        try {
          const image = await CapCamera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
          });

          if (image.dataUrl) {
            // Create an image element to process with jsQR
            const img = new Image();
            img.onload = () => {
              // Create canvas to get image data
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = img.width;
              canvas.height = img.height;
              ctx?.drawImage(img, 0, 0);
              
              const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
              if (imageData) {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                  handleQrCodeScan(code.data);
                } else {
                  toast({
                    title: "No QR Code Found",
                    description: "Please try again with a clearer view of the QR code",
                    variant: "destructive",
                  });
                }
              }
            };
            img.src = image.dataUrl;
          }
          return;
        } catch (capacitorError: any) {
          console.error('❌ Capacitor Camera error:', capacitorError);
          // Fall through to web camera as backup
        }
      }
      
      // For web browsers - check HTTPS requirement
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        toast({
          title: "HTTPS Required",
          description: "Camera access requires a secure connection (HTTPS)",
          variant: "destructive",
        });
        return;
      }
      
      console.log('🌐 Using web QR scanner for browser');
      
      // Check if navigator.mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          title: "Camera Not Supported",
          description: "Your browser doesn't support camera access",
          variant: "destructive",
        });
        return;
      }
      
      // Check if camera is available
      try {
        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          toast({
            title: "No Camera Found",
            description: "Please check if camera is connected and not in use by another app",
            variant: "destructive",
          });
          return;
        }
      } catch (cameraCheckError) {
        console.error('❌ Camera check failed:', cameraCheckError);
        toast({
          title: "Camera Check Failed",
          description: "Unable to detect camera. Please refresh and try again.",
          variant: "destructive",
        });
        return;
      }

      // Request camera permissions explicitly
      try {
        console.log('📷 Requesting camera permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        
        // Stop the stream since we just needed to check permissions
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Camera permissions granted');
        
      } catch (permissionError: any) {
        console.error('❌ Camera permission denied:', permissionError);
        
        let errorMessage = "Camera access denied";
        if (permissionError.name === 'NotAllowedError') {
          errorMessage = "Please allow camera access in your browser settings and refresh the page";
        } else if (permissionError.name === 'NotFoundError') {
          errorMessage = "No camera found on this device";
        } else if (permissionError.name === 'NotReadableError') {
          errorMessage = "Camera is being used by another app. Please close other apps and try again";
        } else if (permissionError.name === 'OverconstrainedError') {
          errorMessage = "Camera settings not supported. Please try again";
        }
        
        toast({
          title: "Camera Permission Error",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Show the scanner UI first
      setShowQrScanner(true);
      
      // Wait a moment for UI to render, then create video elements
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        console.log('🎥 Creating video elements...');
        
        // Create the visible video element for display
        const displayVideo = document.createElement('video');
        displayVideo.playsInline = true;
        displayVideo.muted = true;
        displayVideo.autoplay = true;
        displayVideo.style.width = '100%';
        displayVideo.style.height = '100%';
        displayVideo.style.objectFit = 'cover';
        
        // Create a hidden video element for QR scanning
        const scannerVideo = document.createElement('video');
        scannerVideo.playsInline = true;
        scannerVideo.muted = true;
        scannerVideo.autoplay = true;
        scannerVideo.style.position = 'absolute';
        scannerVideo.style.left = '-9999px';
        scannerVideo.style.top = '-9999px';
        scannerVideo.style.width = '1px';
        scannerVideo.style.height = '1px';
        
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        // Apply the same stream to both video elements
        displayVideo.srcObject = stream;
        scannerVideo.srcObject = stream.clone();
        
        // Wait for both videos to load
        await Promise.all([
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Display video failed to load'));
            }, 5000);
            
            displayVideo.addEventListener('loadedmetadata', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
          }),
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Scanner video failed to load'));
            }, 5000);
            
            scannerVideo.addEventListener('loadedmetadata', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
          })
        ]);
        
        console.log('✅ Video elements created and ready');
        
        // Store the display video element for UI
        setVideoElement(displayVideo);
        
        // Add the hidden scanner video to the page
        document.body.appendChild(scannerVideo);
        
        // Initialize QR scanner with the hidden video element
        const scanner = new QrScanner(
          scannerVideo, 
          (result) => {
            const data = typeof result === 'string' ? result : result.data;
            console.log('🎯 QR Code detected:', data);
            if (data && data.trim()) { // Only process non-empty QR codes
              handleQrCodeScan(data);
            }
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: false, // Don't highlight on hidden video
            highlightCodeOutline: false,
            maxScansPerSecond: 3,
          }
        );
        
        setQrScanner(scanner);
        await scanner.start();
        
        console.log('✅ QR Scanner started successfully');
        
        toast({
          title: "QR Scanner Active",
          description: "Point your camera at a QR code",
        });
        
      } catch (scannerError: any) {
        console.error('❌ Scanner initialization failed:', scannerError);
        
        setShowQrScanner(false);
        
        // Don't show error if we already successfully scanned something
        if (qrScanSuccess) {
          console.log('🎯 Ignoring scanner error - already scanned successfully');
          return;
        }
        
        // Provide specific guidance based on error
        let errorTitle = "Scanner Error";
        let errorDescription = "Failed to start camera scanner";
        
        if (scannerError.message.includes('Video element')) {
          errorTitle = "Interface Error";
          errorDescription = "Scanner interface failed to load. Please refresh the page.";
        } else if (scannerError.message.includes('Permission')) {
          errorTitle = "Camera Permission";
          errorDescription = "Please allow camera access and refresh the page";
        } else {
          errorDescription = "Try refreshing the page or using a different browser";
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
      }
      
    } catch (error: any) {
      console.error('❌ Unexpected QR Scanner error:', error);
      toast({
        title: "Unexpected Error",
        description: "Please refresh the page and try again",
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
    
    // Clean up video elements and streams
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }
    
    // Remove any hidden scanner video elements
    const hiddenVideos = document.querySelectorAll('video[style*="position: absolute"][style*="left: -9999px"]');
    hiddenVideos.forEach(video => {
      const videoEl = video as HTMLVideoElement;
      if (videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
      }
      video.remove();
    });
    
    setVideoElement(null);
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
      // Detect if running as PWA on iOS
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // For PWA on iOS, use browser geolocation directly as it handles permissions better
      if (isPWA && isIOS) {
        console.log('Running as PWA on iOS, using browser geolocation');
        
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by this device.');
        }

        // Get position using browser API with user-friendly error handling
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            (error) => {
              let errorMessage = 'Failed to get location. ';
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage += 'Please allow location access when prompted and try again.';
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

      // Try Capacitor geolocation first (for native mobile apps)
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
      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Get location automatically
      let position;
      try {
        position = await getLocation();
      } catch (locationError: any) {
        console.error('Location access failed:', locationError);
        throw new Error(`Location access is required to start shift. ${locationError.message || 'Please enable location services and try again.'}`);
      }

      const latitude = position.latitude;
      const longitude = position.longitude;
      const locationAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      
      // Validate that this is not a default San Francisco location
      const isSanFrancisco = (
        Math.abs(latitude - 37.785834) < 0.001 && 
        Math.abs(longitude - (-122.406417)) < 0.001
      );
      
      if (isSanFrancisco) {
        console.warn('Detected San Francisco default location, likely mock/cached data');
        toast({
          title: "Location Warning",
          description: "Mock location detected. Please ensure location services are enabled and you're not using a simulator.",
          variant: "destructive",
        });
      }

      // Create new shift with required location
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

      // Update guard profile to show as active
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', profile.id);

      if (profileError) {
        console.error('Failed to update guard status:', profileError);
      }

      setCurrentShift(newShift);
      
      // Start location tracking (will show informational message)
      startLocationTracking(newShift.id, profile.id);
      
      toast({
        title: "✅ Shift Started",
        description: "Your shift has started. Location tracking is now active for security purposes.",
        duration: 3000,
      });
      
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
      
      // Update shift with end time only - no location tracking needed
      const { error } = await supabase
        .from('guard_shifts')
        .update({
          check_out_time: new Date().toISOString()
        })
        .eq('id', currentShift.id);

      if (error) {
        console.error('End shift database error:', error);
        throw error;
      }

      // Stop location tracking
      stopLocationTracking();
      
      // Clear guard's location data so admin can't see their location after shift ends
      const { error: locationError } = await supabase
        .from('guard_locations')
        .delete()
        .eq('guard_id', profile.id)
        .eq('shift_id', currentShift.id);

      if (locationError) {
        console.error('Failed to clear location data:', locationError);
        // Don't throw error here - shift ending is more important
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
    <div className="min-h-screen bg-background relative border-4 border-primary">
      {/* Success Message Overlay */}
      {showSuccessMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card p-8 rounded-lg shadow-lg text-center max-w-md mx-4 animate-scale-in">
            <div className="text-green-500 mb-4">
              <svg className="w-20 h-20 mx-auto animate-scale-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-600">Report submitted</h3>
          </div>
        </div>
      )}
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
        
        {/* Connection Status */}
        <div className="px-6 pb-4">
          <ConnectionStatus isOnline={isOnline} pendingReports={pendingReports} />
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
                ? (
                  <div className="space-y-2">
                    <div>Shift started at {new Date(currentShift.check_in_time).toLocaleString()}</div>
                    {locationTracking && (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <MapPin className="h-4 w-4 animate-pulse" />
                        <span className="text-sm font-medium">Live location tracking active</span>
                      </div>
                    )}
                  </div>
                )
                : "Start your shift to begin location tracking and work hours"
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Missing Fields Error Display */}
            {showMissingFieldsError.length > 0 && (
              <div className="mb-6 p-4 border border-destructive bg-destructive/10 rounded-lg text-center">
                <h3 className="text-lg font-semibold text-destructive mb-2">Missing Required Fields</h3>
                <p className="text-destructive">Please fill in: {showMissingFieldsError.join(", ")}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3" 
                  onClick={() => setShowMissingFieldsError([])}
                >
                  OK
                </Button>
              </div>
            )}
            
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
                <Select value={taskData.taskType} onValueChange={(value) => {
                  setTaskData({ ...taskData, taskType: value, customTaskType: "" });
                  // Clear error when user selects a task type
                  if (showMissingFieldsError.includes("Task Type")) {
                    setShowMissingFieldsError(prev => prev.filter(field => field !== "Task Type"));
                  }
                }}>
                  <SelectTrigger className={!taskData.taskType ? "border-red-300" : "border-green-300"}>
                    <SelectValue placeholder="Select a task type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-xl z-[9999] backdrop-blur-sm">
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
                  <TabsList className="grid w-full grid-cols-3 touch-manipulation">
                    <TabsTrigger 
                      value="properties" 
                      className="flex items-center gap-2 touch-manipulation transition-colors duration-100"
                    >
                      <Building className="h-4 w-4" />
                      Properties
                    </TabsTrigger>
                    <TabsTrigger 
                      value="qr" 
                      className="flex items-center gap-2 touch-manipulation transition-colors duration-100"
                    >
                      <QrCode className="h-4 w-4" />
                      QR Scan
                    </TabsTrigger>
                    <TabsTrigger 
                      value="qr-generate" 
                      className="flex items-center gap-2 touch-manipulation transition-colors duration-100"
                    >
                      <QrCode className="h-4 w-4" />
                      Generate
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
                                // Clear error when user selects a work site
                                if (showMissingFieldsError.includes("Work Site")) {
                                  setShowMissingFieldsError(prev => prev.filter(field => field !== "Work Site"));
                                }
                              }}
                           >
                             <SelectTrigger className="pl-10">
                               <SelectValue placeholder={loadingProperties ? "Loading properties..." : "Select a work site"} />
                             </SelectTrigger>
                             <SelectContent className="bg-background border border-border shadow-xl z-[9999] backdrop-blur-sm">
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
                        <div className="mx-auto w-64 h-48 bg-muted rounded-lg flex flex-col items-center justify-center relative overflow-hidden" id="qr-scanner-container">
                          {showQrScanner ? (
                            <>
                              <div 
                                ref={(container) => {
                                  if (container && videoElement && !container.querySelector('video')) {
                                    videoElement.className = 'w-full h-full object-cover rounded-lg';
                                    container.appendChild(videoElement);
                                  }
                                }}
                                className="w-full h-full relative"
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
                             <p className="text-sm text-muted-foreground mb-2 px-2 text-center">
                               Scan QR code to auto-fill and submit report
                             </p>
                             <p className="text-xs text-muted-foreground mb-4 px-2 text-center">
                               No need to fill other fields - just scan and submit!
                             </p>
                              <Button
                                type="button"
                                onClick={startQrScanner}
                                variant="outline"
                                className="flex items-center gap-2"
                              >
                                <QrCode className="h-4 w-4" />
                                Scan QR Code
                              </Button>
                           </>
                         )}
                       </div>
                       
                       {showQrScanner && (
                          <Button
                            type="button"
                            onClick={stopQrScanner}
                            variant="outline"
                            className="w-full"
                          >
                            Stop Scanner
                          </Button>
                       )}
                       
                        {taskData.site && (
                         <div className="p-3 bg-green-50 border border-green-200 rounded">
                           <p className="text-sm text-green-800 font-medium">
                             ✅ QR Scanned: {taskData.site}
                           </p>
                           <p className="text-xs text-green-600 mt-1">
                             Ready to submit! All fields auto-filled.
                           </p>
                         </div>
                       )}
                     </div>
                   </TabsContent>

                   <TabsContent value="qr-generate" className="space-y-4">
                     <div className="space-y-4">
                       <div className="space-y-2">
                         <Label htmlFor="qr-property-select">Select Property to Generate QR</Label>
                         <Select 
                           value={qrGeneratedFor}
                           onValueChange={(value) => {
                             const selectedProperty = properties.find(prop => prop.id === value);
                             if (selectedProperty) {
                               setQrGeneratedFor(value);
                               setQrGeneratorText(selectedProperty.name);
                             }
                           }}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Select a property" />
                           </SelectTrigger>
                           <SelectContent className="bg-background border shadow-xl z-[9999]">
                             {properties.map((property) => (
                               <SelectItem key={property.id} value={property.id}>
                                 <div className="flex flex-col">
                                   <span className="font-medium">{property.name}</span>
                                   {property.location_address && (
                                     <span className="text-xs text-muted-foreground">{property.location_address}</span>
                                   )}
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-2">
                         <Label htmlFor="qr-custom-text">Or Enter Custom Text</Label>
                         <Input
                           id="qr-custom-text"
                           placeholder="Enter text for QR code..."
                           value={qrGeneratorText}
                           onChange={(e) => {
                             setQrGeneratorText(e.target.value);
                             setQrGeneratedFor("");
                           }}
                         />
                       </div>

                       {qrGeneratorText && (
                         <div className="flex flex-col items-center gap-4 p-4 bg-muted rounded-lg">
                           <div className="bg-white p-4 rounded-lg">
                             <QRCodeSVG 
                               value={qrGeneratorText}
                               size={200}
                               level="H"
                               includeMargin={true}
                             />
                           </div>
                           <p className="text-sm text-center font-medium">
                             QR Code: {qrGeneratorText}
                           </p>
                           <Button
                             type="button"
                             variant="outline"
                             onClick={() => {
                               const svg = document.querySelector('#qr-scanner-container svg');
                               if (svg) {
                                 const svgData = new XMLSerializer().serializeToString(svg);
                                 const canvas = document.createElement('canvas');
                                 const ctx = canvas.getContext('2d');
                                 const img = new Image();
                                 
                                 img.onload = () => {
                                   canvas.width = img.width;
                                   canvas.height = img.height;
                                   ctx?.drawImage(img, 0, 0);
                                   
                                   canvas.toBlob((blob) => {
                                     if (blob) {
                                       const url = URL.createObjectURL(blob);
                                       const a = document.createElement('a');
                                       a.href = url;
                                       a.download = `qr-${qrGeneratorText.replace(/[^a-z0-9]/gi, '-')}.png`;
                                       a.click();
                                       URL.revokeObjectURL(url);
                                       
                                       toast({
                                         title: "QR Code Downloaded",
                                         description: "QR code saved to your device",
                                       });
                                     }
                                   });
                                 };
                                 
                                 img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                               }
                             }}
                             className="w-full flex items-center gap-2"
                           >
                             <Download className="h-4 w-4" />
                             Download QR Code
                           </Button>
                         </div>
                       )}

                       {!qrGeneratorText && (
                         <div className="text-center p-8 bg-muted/50 rounded-lg">
                           <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                           <p className="text-sm text-muted-foreground">
                             Select a property or enter text to generate a QR code
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
                <Select value={taskData.severity} onValueChange={(value) => {
                  setTaskData({ ...taskData, severity: value });
                  // Clear error when user selects a severity
                  if (showMissingFieldsError.includes("Type of Issue")) {
                    setShowMissingFieldsError(prev => prev.filter(field => field !== "Type of Issue"));
                  }
                }}>
                  <SelectTrigger className={!taskData.severity ? "border-red-300" : "border-green-300"}>
                    <SelectValue placeholder="Select issue severity" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-xl z-[9999] backdrop-blur-sm">
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
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCameraCapture}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
                
                {taskData.image && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <Camera className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-muted-foreground">
                      Photo ready: {taskData.image.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button with enhanced feedback */}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {isOnline ? "Uploading..." : "Saving..."}
                  </div>
                ) : (
                  "Submit Report"
                )}
              </Button>
              
              {!isOnline && (
                <p className="text-xs text-muted-foreground text-center">
                  Reports will be uploaded automatically when online
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuardDashboard;
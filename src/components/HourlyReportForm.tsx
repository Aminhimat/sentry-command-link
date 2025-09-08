import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, MapPin } from "lucide-react";
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface HourlyReportFormProps {
  userProfile: any;
  activeShift: any;
  onReportSubmitted: () => void;
}

const HourlyReportForm = ({ userProfile, activeShift, onReportSubmitted }: HourlyReportFormProps) => {
  const [reportText, setReportText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const { toast } = useToast();

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          });
          toast({
            title: "Location captured",
            description: "Current location has been recorded for your report.",
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: "Location error",
            description: "Could not get your current location. Please try again.",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Location not supported",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive",
      });
    }
  };

  const handleCameraCapture = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Check and request camera permissions first
        const permissions = await CapCamera.checkPermissions();
        if (permissions.camera !== 'granted') {
          const permissionResult = await CapCamera.requestPermissions();
          if (permissionResult.camera !== 'granted') {
            toast({
              title: "Camera Permission Required",
              description: "Please grant camera permission to take photos.",
              variant: "destructive",
            });
            return;
          }
        }

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
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          toast({
            title: "File too large",
            description: "Please select an image smaller than 5MB.",
            variant: "destructive",
          });
          return;
        }
        setSelectedImage(file);
      } else {
        // Fallback for web - trigger file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
              toast({
                title: "File too large",
                description: "Please select an image smaller than 5MB.",
                variant: "destructive",
              });
              return;
            }
            setSelectedImage(file);
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


  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userProfile.user_id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('guard-reports')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('guard-reports')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require photo before submission
    if (!selectedImage) {
      toast({
        title: "Photo Required",
        description: "Please take a photo before submitting your report.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Prepare report data first
      const reportData = {
        guard_id: userProfile.id,
        company_id: userProfile.company_id,
        shift_id: activeShift?.id || null,
        report_text: reportText || null,
        location_lat: location?.lat || null,
        location_lng: location?.lng || null,
        location_address: location?.address || null,
        image_url: null
      };

      // Upload image if selected (in background if possible)
      if (selectedImage) {
        const imageUrl = await uploadImage(selectedImage);
        if (imageUrl) {
          reportData.image_url = imageUrl;
        }
      }

      const { error } = await supabase
        .from('guard_reports')
        .insert(reportData);

      if (error) {
        console.error('Error submitting report:', error);
        toast({
          title: "Submission failed",
          description: "Failed to submit report. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Report submitted",
        description: "Your hourly report has been submitted successfully.",
      });

      // Reset form
      setReportText("");
      setSelectedImage(null);
      setLocation(null);
      onReportSubmitted();

    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Camera className="h-5 w-5 mr-2" />
          Hourly Report
        </CardTitle>
        <CardDescription>
          Submit your hourly report with a photo and location
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="report">Report Description</Label>
            <Textarea
              id="report"
              placeholder="Describe what you observed during this hour..."
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="space-y-2">
            <Label>Photo (Required)</Label>
            <Button
              type="button"
              variant="outline"
              onClick={handleCameraCapture}
              className="w-full"
            >
              <Camera className="w-4 h-4 mr-2" />
              Take Photo
            </Button>
            {selectedImage && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Upload className="w-4 h-4 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  Photo ready: {selectedImage.name}
                </p>
              </div>
            )}
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              className="w-full"
            >
              <MapPin className="h-4 w-4 mr-2" />
              {location ? "Location Captured" : "Capture Current Location"}
            </Button>
            {location && (
              <p className="text-sm text-muted-foreground mt-1">
                Location: {location.address}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !selectedImage}
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default HourlyReportForm;
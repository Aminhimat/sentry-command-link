import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, MapPin } from "lucide-react";

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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
    
    if (!reportText.trim()) {
      toast({
        title: "Report required",
        description: "Please enter a report description.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl: string | null = null;
      
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
        if (!imageUrl) {
          toast({
            title: "Upload failed",
            description: "Failed to upload image. Please try again.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const { error } = await supabase
        .from('guard_reports')
        .insert({
          guard_id: userProfile.id,
          company_id: userProfile.company_id,
          shift_id: activeShift?.id || null,
          report_text: reportText,
          image_url: imageUrl,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          location_address: location?.address || null,
        });

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

          <div>
            <Label htmlFor="image">Photo (Optional)</Label>
            <div className="mt-2">
              <input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('image')?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {selectedImage ? selectedImage.name : "Select Photo"}
              </Button>
            </div>
            {selectedImage && (
              <div className="mt-2">
                <img
                  src={URL.createObjectURL(selectedImage)}
                  alt="Preview"
                  className="max-w-xs max-h-32 object-cover rounded"
                />
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
            disabled={isSubmitting}
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
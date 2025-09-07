import { Shield, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import securityHero from "@/assets/security-hero.jpg";

const SecurityPlatformLanding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    message: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleDemoRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phoneNumber || !formData.message) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.functions.invoke('request-demo', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your demo request has been sent successfully! We'll contact you soon.",
      });

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        message: ""
      });
    } catch (error: any) {
      console.error('Demo request error:', error);
      toast({
        title: "Error",
        description: "Failed to send demo request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${securityHero})` }}
        />
        <div className="absolute inset-0 bg-primary/80" />
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-center mb-6">
            <Shield className="h-16 w-16 mr-4 text-accent" />
            <h1 className="text-6xl font-bold">GuardHQ</h1>
          </div>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">
            Complete security management platform for modern security companies. 
            Manage teams, track patrols, and ensure compliance with real-time monitoring.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="hero" 
              size="xl" 
              className="animate-slide-in"
              onClick={() => navigate('/auth?mode=guard')}
            >
              Guard Login
            </Button>
            <Button 
              variant="ghost-white" 
              size="xl" 
              className="animate-slide-in"
              onClick={() => navigate('/auth')}
            >
              Admin Login
            </Button>
          </div>
        </div>
      </section>

      {/* Demo on Demand Section */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Demo on Demand</h2>
            <p className="text-muted-foreground text-lg">
              See GuardHQ in action with a personalized demo tailored to your security needs
            </p>
          </div>
          
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Request Your Demo
              </CardTitle>
              <CardDescription>
                Fill out the form below and we'll schedule a personalized demonstration of our platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDemoRequest} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium mb-2">
                      First Name *
                    </label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="Enter your first name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium mb-2">
                      Last Name *
                    </label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Enter your last name"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email Address *
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email address"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium mb-2">
                    Phone Number *
                  </label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="Enter your phone number"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message *
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Tell us about your security needs and what you'd like to see in the demo"
                    rows={4}
                    required
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Request Demo"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

    </div>
  );
};

export default SecurityPlatformLanding;
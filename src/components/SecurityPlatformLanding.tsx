import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import securityHero from "@/assets/security-hero.jpg";

const SecurityPlatformLanding = () => {
  const navigate = useNavigate();

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

    </div>
  );
};

export default SecurityPlatformLanding;
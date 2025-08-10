import { Shield, Users, MapPin, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
            <h1 className="text-6xl font-bold">SecureOps</h1>
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
              onClick={() => navigate('/auth')}
            >
              Admin Login
            </Button>
            <Button variant="outline" size="xl" className="bg-white/10 border-white/20 text-white hover:bg-white/20 animate-slide-in" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section id="demo" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Three Powerful Platforms in One
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Streamline operations across platform management, company administration, and field operations
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Web Admin Panel */}
            <Card className="shadow-elevated hover:shadow-elevated hover:scale-105 transition-smooth">
              <CardHeader>
                <div className="flex items-center mb-4">
                  <Shield className="h-8 w-8 text-primary mr-3" />
                  <CardTitle className="text-xl">Admin Panel</CardTitle>
                </div>
                <CardDescription>
                  Platform owner control center for managing security companies and monitoring operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Manage Security Companies
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    License Management
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Real-time Monitoring
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Compliance Reports
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Web Portal */}
            <Card className="shadow-elevated hover:shadow-elevated hover:scale-105 transition-smooth">
              <CardHeader>
                <div className="flex items-center mb-4">
                  <Users className="h-8 w-8 text-primary mr-3" />
                  <CardTitle className="text-xl">Company Portal</CardTitle>
                </div>
                <CardDescription>
                  Security company admin interface for team management and operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Guard Management
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Live GPS Tracking
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Incident Reports
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    PDF Reports
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Mobile App */}
            <Card className="shadow-elevated hover:shadow-elevated hover:scale-105 transition-smooth">
              <CardHeader>
                <div className="flex items-center mb-4">
                  <MapPin className="h-8 w-8 text-primary mr-3" />
                  <CardTitle className="text-xl">Mobile App</CardTitle>
                </div>
                <CardDescription>
                  Field operations app for security guards with real-time features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Check In/Out
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    GPS Patrol Tracking
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Incident Reporting
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Emergency Alerts
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Built for Modern Security Operations
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to run efficient, compliant security operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-gradient-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-sm text-muted-foreground">Live GPS monitoring and location tracking</p>
            </div>

            <div className="text-center">
              <div className="bg-gradient-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Digital Reports</h3>
              <p className="text-sm text-muted-foreground">Automated PDF generation and compliance</p>
            </div>

            <div className="text-center">
              <div className="bg-gradient-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Incident Management</h3>
              <p className="text-sm text-muted-foreground">Comprehensive incident reporting system</p>
            </div>

            <div className="text-center">
              <div className="bg-gradient-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-semibold mb-2">Multi-tenant</h3>
              <p className="text-sm text-muted-foreground">Manage multiple security companies</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Ready to Transform Your Security Operations?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join leading security companies using SecureOps to streamline operations and ensure compliance
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="hero" 
              size="xl"
              onClick={() => navigate('/auth')}
            >
              Start Free Trial
            </Button>
            <Button variant="outline" size="xl">
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SecurityPlatformLanding;
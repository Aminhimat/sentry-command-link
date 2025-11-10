import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, XCircle, Smartphone, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeviceLogin {
  id: string;
  guard_id: string;
  guard_name: string;
  device_id: string;
  device_model: string;
  device_os: string;
  approved: boolean;
  allow_concurrent_login: boolean;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  first_name: string;
  last_name: string;
}

const CompanyDeviceApprovals = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [devices, setDevices] = useState<DeviceLogin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceLogin | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConcurrentDialog, setShowConcurrentDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

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
      await fetchDevices(profile.company_id);
    } catch (error) {
      console.error('Error checking user:', error);
      window.location.href = '/auth';
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDevices = async (companyId: string) => {
    try {
      // Get all guards from this company
      const { data: guards, error: guardsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'guard');

      if (guardsError) {
        console.error('Error fetching guards:', guardsError);
        return;
      }

      const guardIds = guards.map(g => g.id);

      // Fetch device logins for these guards
      const { data: deviceLogins, error: devicesError } = await supabase
        .from('device_logins' as any)
        .select('*')
        .in('guard_id', guardIds)
        .order('created_at', { ascending: false });

      if (devicesError) {
        console.error('Error fetching devices:', devicesError);
        toast({
          title: "Error",
          description: "Failed to fetch device logins",
          variant: "destructive",
        });
        return;
      }

      setDevices((deviceLogins as any) || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const handleApproveDevice = async () => {
    if (!selectedDevice || !userProfile) return;

    try {
      const { error } = await supabase
        .from('device_logins' as any)
        .update({ approved: true })
        .eq('id', selectedDevice.id);

      if (error) throw error;

      toast({
        title: "Device Approved",
        description: `${selectedDevice.guard_name}'s device has been approved`,
      });

      await fetchDevices(userProfile.company_id);
      setShowApproveDialog(false);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Error approving device:', error);
      toast({
        title: "Error",
        description: "Failed to approve device",
        variant: "destructive",
      });
    }
  };

  const handleRejectDevice = async () => {
    if (!selectedDevice || !userProfile) return;

    try {
      const { error } = await supabase
        .from('device_logins' as any)
        .delete()
        .eq('id', selectedDevice.id);

      if (error) throw error;

      toast({
        title: "Device Rejected",
        description: `${selectedDevice.guard_name}'s device has been rejected`,
      });

      await fetchDevices(userProfile.company_id);
      setShowRejectDialog(false);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Error rejecting device:', error);
      toast({
        title: "Error",
        description: "Failed to reject device",
        variant: "destructive",
      });
    }
  };

  const handleToggleConcurrentLogin = async () => {
    if (!selectedDevice || !userProfile) return;

    try {
      const { error } = await supabase
        .from('device_logins' as any)
        .update({ allow_concurrent_login: !selectedDevice.allow_concurrent_login })
        .eq('id', selectedDevice.id);

      if (error) throw error;

      toast({
        title: "Permission Updated",
        description: `Concurrent login ${!selectedDevice.allow_concurrent_login ? 'enabled' : 'disabled'} for ${selectedDevice.guard_name}`,
      });

      await fetchDevices(userProfile.company_id);
      setShowConcurrentDialog(false);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Error updating concurrent login:', error);
      toast({
        title: "Error",
        description: "Failed to update concurrent login permission",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const pendingDevices = devices.filter(d => !d.approved);
  const approvedDevices = devices.filter(d => d.approved);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/company">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Smartphone className="h-8 w-8" />
              Device Approvals
            </h1>
            <p className="text-muted-foreground">Manage guard device access</p>
          </div>
        </div>

        {/* Pending Approvals */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="destructive" className="h-6">
                {pendingDevices.length}
              </Badge>
              Pending Device Approvals
            </CardTitle>
            <CardDescription>
              New devices waiting for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingDevices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No pending device approvals
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guard Name</TableHead>
                    <TableHead>Device Model</TableHead>
                    <TableHead>Operating System</TableHead>
                    <TableHead>Concurrent Login</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.guard_name}</TableCell>
                      <TableCell>{device.device_model}</TableCell>
                      <TableCell>{device.device_os}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {device.allow_concurrent_login ? "Allowed" : "Not Allowed"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(device.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowApproveDialog(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowRejectDialog(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Approved Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default" className="h-6">
                {approvedDevices.length}
              </Badge>
              Approved Devices
            </CardTitle>
            <CardDescription>
              Devices with active access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {approvedDevices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No approved devices yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guard Name</TableHead>
                    <TableHead>Device Model</TableHead>
                    <TableHead>Operating System</TableHead>
                    <TableHead>Concurrent Login</TableHead>
                    <TableHead>Approved Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.guard_name}</TableCell>
                      <TableCell>{device.device_model}</TableCell>
                      <TableCell>{device.device_os}</TableCell>
                      <TableCell>
                        <Badge variant={device.allow_concurrent_login ? "default" : "outline"}>
                          {device.allow_concurrent_login ? "Allowed" : "Not Allowed"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(device.updated_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={device.allow_concurrent_login ? "destructive" : "default"}
                          onClick={() => {
                            setSelectedDevice(device);
                            setShowConcurrentDialog(true);
                          }}
                        >
                          {device.allow_concurrent_login ? "Disable" : "Enable"} Concurrent
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Device?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this device for {selectedDevice?.guard_name}?
              They will be able to access the system from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveDevice}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Device?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this device for {selectedDevice?.guard_name}?
              This will remove the device request and they will need to request approval again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejectDevice} className="bg-destructive text-destructive-foreground">
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Concurrent Login Dialog */}
      <AlertDialog open={showConcurrentDialog} onOpenChange={setShowConcurrentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedDevice?.allow_concurrent_login ? "Disable" : "Enable"} Concurrent Login
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDevice?.allow_concurrent_login
                ? `Disabling concurrent login will prevent ${selectedDevice.guard_name} from logging in on multiple devices simultaneously.`
                : `Enabling concurrent login will allow ${selectedDevice?.guard_name} to be logged in on multiple devices at the same time.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleConcurrentLogin}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanyDeviceApprovals;

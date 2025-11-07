import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, CheckCircle, Clock, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DeviceLogin {
  id: string;
  guard_id: string;
  guard_name: string;
  device_id: string;
  device_model: string;
  device_os: string;
  approved: boolean;
  created_at: string;
}

interface DeviceApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

const DeviceApprovalDialog: React.FC<DeviceApprovalDialogProps> = ({ open, onOpenChange, companyId }) => {
  const [devices, setDevices] = useState<DeviceLogin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const { data: guards } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'guard');

      if (guards && guards.length > 0) {
        const guardIds = guards.map(g => g.id);
        const { data, error } = await supabase
          .from('device_logins')
          .select('*')
          .in('guard_id', guardIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDevices(data || []);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load devices',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDevices();
    }
  }, [open, companyId]);

  const handleApprove = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('device_logins')
        .update({ approved: true })
        .eq('id', deviceId);

      if (error) throw error;

      toast({
        title: 'Device Approved',
        description: 'The device has been approved successfully.',
      });

      fetchDevices();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to approve device',
      });
    }
  };

  const handleReject = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('device_logins')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast({
        title: 'Device Rejected',
        description: 'The device has been rejected and removed.',
      });

      fetchDevices();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to reject device',
      });
    }
  };

  const pendingDevices = devices.filter(d => !d.approved);
  const approvedDevices = devices.filter(d => d.approved);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Device Management</DialogTitle>
          <DialogDescription>
            Approve or reject devices for guard access
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading devices...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingDevices.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    Pending Approval ({pendingDevices.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingDevices.map((device) => (
                      <Card key={device.id} className="border-yellow-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{device.guard_name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {new Date(device.created_at).toLocaleString()}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                              Pending
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Device:</span>
                              <p className="font-medium">{device.device_model}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">OS:</span>
                              <p className="font-medium">{device.device_os}</p>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Device ID:</span>
                              <p className="font-mono text-xs break-all">{device.device_id}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(device.id)}
                              className="flex-1"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(device.id)}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {approvedDevices.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Approved Devices ({approvedDevices.length})
                  </h3>
                  <div className="space-y-2">
                    {approvedDevices.map((device) => (
                      <Card key={device.id} className="border-green-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{device.guard_name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Approved: {new Date(device.created_at).toLocaleString()}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Device:</span>
                              <p className="font-medium">{device.device_model}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">OS:</span>
                              <p className="font-medium">{device.device_os}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {devices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Smartphone className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No devices registered yet</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceApprovalDialog;

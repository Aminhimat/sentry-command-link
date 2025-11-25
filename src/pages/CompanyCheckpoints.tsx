import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, QrCode, Download, MapPin, ToggleLeft, ToggleRight, ArrowLeft } from 'lucide-react';
import { CheckpointDialog } from '@/components/CheckpointDialog';
import { Badge } from '@/components/ui/badge';
import QRCodeLib from 'qrcode';

interface Checkpoint {
  id: string;
  name: string;
  description: string | null;
  location_address: string | null;
  qr_code_data: string;
  is_active: boolean;
  property_id: string | null;
  properties: { name: string } | null;
}

export default function CompanyCheckpoints() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState<Checkpoint | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile || profile.role !== 'company_admin') {
        navigate('/');
        return;
      }

      setCompanyId(profile.company_id);
      fetchCheckpoints(profile.company_id);
    } catch (error) {
      console.error('Auth error:', error);
      navigate('/auth');
    }
  };

  const fetchCheckpoints = async (companyId: string) => {
    try {
      // First get properties for this company
      const { data: properties } = await supabase
        .from('properties')
        .select('id, name')
        .eq('company_id', companyId);

      const propertyIds = properties?.map(p => p.id) || [];

      // Then get checkpoints for those properties
      const { data: checkpointsData, error } = await supabase
        .from('checkpoints')
        .select('*')
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Manually attach property names
      const checkpointsWithProps = (checkpointsData || []).map(checkpoint => {
        const property = properties?.find(p => p.id === checkpoint.property_id);
        return {
          ...checkpoint,
          properties: property ? { name: property.name } : null
        };
      });

      setCheckpoints(checkpointsWithProps);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading checkpoints',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = async (checkpoint: Checkpoint) => {
    try {
      const qrDataUrl = await QRCodeLib.toDataURL(checkpoint.qr_code_data, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `checkpoint-${checkpoint.name.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'QR Code Downloaded',
        description: `QR code for ${checkpoint.name} has been downloaded.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: error.message,
      });
    }
  };

  const handleToggleActive = async (checkpoint: Checkpoint) => {
    try {
      const { error } = await supabase
        .from('checkpoints')
        .update({ is_active: !checkpoint.is_active })
        .eq('id', checkpoint.id);

      if (error) throw error;

      setCheckpoints(prev =>
        prev.map(cp => cp.id === checkpoint.id ? { ...cp, is_active: !cp.is_active } : cp)
      );

      toast({
        title: checkpoint.is_active ? 'Checkpoint Deactivated' : 'Checkpoint Activated',
        description: `${checkpoint.name} is now ${!checkpoint.is_active ? 'active' : 'inactive'}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating checkpoint',
        description: error.message,
      });
    }
  };

  const handleDialogClose = (refresh: boolean) => {
    setDialogOpen(false);
    setEditingCheckpoint(null);
    if (refresh && companyId) {
      fetchCheckpoints(companyId);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading checkpoints...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/company')}
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Patrol Checkpoints</h1>
          </div>
          <p className="text-muted-foreground ml-14">
            Create and manage QR code checkpoints for guard patrols
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Checkpoint
        </Button>
      </div>

      {checkpoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No checkpoints yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first checkpoint to start tracking guard patrols
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Checkpoint
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {checkpoints.map((checkpoint) => (
            <Card key={checkpoint.id} className={!checkpoint.is_active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {checkpoint.name}
                      {!checkpoint.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    {checkpoint.properties && (
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {checkpoint.properties.name}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(checkpoint)}
                    title={checkpoint.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {checkpoint.is_active ? (
                      <ToggleRight className="h-5 w-5 text-success" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {checkpoint.description && (
                  <p className="text-sm text-muted-foreground">{checkpoint.description}</p>
                )}
                
                {checkpoint.location_address && (
                  <p className="text-sm text-muted-foreground flex items-start gap-1">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {checkpoint.location_address}
                  </p>
                )}

                <div className="flex items-center justify-center p-4 bg-background border rounded-lg">
                  <QRCodeCanvas value={checkpoint.qr_code_data} size={150} />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownloadQR(checkpoint)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditingCheckpoint(checkpoint);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CheckpointDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        checkpoint={editingCheckpoint}
        companyId={companyId}
      />
    </div>
  );
}

// QR Code Canvas Component
function QRCodeCanvas({ value, size }: { value: string; size: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then(setQrDataUrl);
  }, [value, size]);

  return qrDataUrl ? (
    <img src={qrDataUrl} alt="QR Code" className="w-full h-auto" />
  ) : (
    <div style={{ width: size, height: size }} className="bg-muted animate-pulse rounded" />
  );
}

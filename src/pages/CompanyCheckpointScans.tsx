import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Clock, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

interface CheckpointScan {
  id: string;
  scan_time: string;
  location_address: string | null;
  notes: string | null;
  checkpoints: {
    name: string;
  };
  profiles: {
    first_name: string | null;
    last_name: string | null;
  };
  properties: {
    name: string;
  } | null;
}

export default function CompanyCheckpointScans() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scans, setScans] = useState<CheckpointScan[]>([]);
  const [loading, setLoading] = useState(true);
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
      fetchScans(profile.company_id);
    } catch (error) {
      console.error('Auth error:', error);
      navigate('/auth');
    }
  };

  const fetchScans = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('checkpoint_scans')
        .select(`
          id,
          scan_time,
          location_address,
          notes,
          guard_id,
          checkpoints!checkpoint_scans_checkpoint_id_fkey(name),
          properties!checkpoint_scans_property_id_fkey(name)
        `)
        .eq('company_id', companyId)
        .order('scan_time', { ascending: false });

      if (error) throw error;

      // Fetch guard names separately
      const guardIds = [...new Set(data?.map(scan => scan.guard_id))];
      const { data: guards } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', guardIds);

      // Map guard names to scans
      const scansWithGuards = data?.map(scan => ({
        ...scan,
        profiles: guards?.find(g => g.id === scan.guard_id) || { first_name: null, last_name: null }
      }));

      setScans(scansWithGuards || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading scans',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading checkpoint scans...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/company/checkpoints')}
          title="Back to Checkpoints"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Checkpoint Scan History</h1>
          <p className="text-muted-foreground">
            View all checkpoint scans from your guards
          </p>
        </div>
      </div>

      {scans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No scans yet</h3>
            <p className="text-muted-foreground">
              Guards haven't scanned any checkpoints yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Scans ({scans.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Checkpoint</TableHead>
                    <TableHead>Guard</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(scan.scan_time), 'MMM d, yyyy')}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(scan.scan_time), 'h:mm a')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {scan.checkpoints.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {scan.profiles.first_name || ''} {scan.profiles.last_name || 'Unknown Guard'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {scan.properties ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{scan.properties.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {scan.location_address ? (
                          <span className="text-sm text-muted-foreground">
                            {scan.location_address.length > 30
                              ? scan.location_address.substring(0, 30) + '...'
                              : scan.location_address}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {scan.notes ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {scan.notes.length > 40
                                ? scan.notes.substring(0, 40) + '...'
                                : scan.notes}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

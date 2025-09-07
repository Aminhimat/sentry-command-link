import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, HardDrive, TrendingUp, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyAnalytics {
  id: string;
  name: string;
  status: string;
  reports_count: number;
  total_storage_mb: number;
  guards_count: number;
  properties_count: number;
}

const CompanyAnalytics = () => {
  const [analytics, setAnalytics] = useState<CompanyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalReports, setTotalReports] = useState(0);
  const [totalStorage, setTotalStorage] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanyAnalytics();
  }, []);

  const fetchCompanyAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch companies with their analytics data
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, status');

      if (companiesError) throw companiesError;

      const analyticsData: CompanyAnalytics[] = [];

      for (const company of companies || []) {
        // Count reports for this company
        const { count: reportsCount, error: reportsError } = await supabase
          .from('guard_reports')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        if (reportsError) {
          console.error(`Error fetching reports for company ${company.id}:`, reportsError);
        }

        // Count guards for this company
        const { count: guardsCount, error: guardsError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('role', 'guard');

        if (guardsError) {
          console.error(`Error fetching guards for company ${company.id}:`, guardsError);
        }

        // Count properties for this company
        const { count: propertiesCount, error: propertiesError } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        if (propertiesError) {
          console.error(`Error fetching properties for company ${company.id}:`, propertiesError);
        }

        // Calculate storage usage (estimate based on reports with images)
        const { data: reportsWithImages, error: storageError } = await supabase
          .from('guard_reports')
          .select('image_url')
          .eq('company_id', company.id)
          .not('image_url', 'is', null);

        let estimatedStorageMB = 0;
        if (!storageError && reportsWithImages) {
          // Estimate 2MB per image (average)
          estimatedStorageMB = reportsWithImages.length * 2;
        }

        analyticsData.push({
          id: company.id,
          name: company.name,
          status: company.status,
          reports_count: reportsCount || 0,
          total_storage_mb: estimatedStorageMB,
          guards_count: guardsCount || 0,
          properties_count: propertiesCount || 0,
        });
      }

      // Calculate totals
      const totalReportsCount = analyticsData.reduce((sum, company) => sum + company.reports_count, 0);
      const totalStorageCount = analyticsData.reduce((sum, company) => sum + company.total_storage_mb, 0);

      setAnalytics(analyticsData);
      setTotalReports(totalReportsCount);
      setTotalStorage(totalStorageCount);

    } catch (error) {
      console.error('Error fetching company analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load company analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatStorage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-success text-success-foreground">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold">{totalReports.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-warning" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Storage</p>
                <p className="text-2xl font-bold">{formatStorage(totalStorage)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-success" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Companies</p>
                <p className="text-2xl font-bold">
                  {analytics.filter(c => c.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Analytics Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Company Usage Analytics
          </CardTitle>
          <CardDescription>
            Reports submitted and storage usage by company
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Guards</TableHead>
                  <TableHead className="text-right">Properties</TableHead>
                  <TableHead className="text-right">Reports</TableHead>
                  <TableHead className="text-right">Storage Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics
                  .sort((a, b) => b.reports_count - a.reports_count)
                  .map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{getStatusBadge(company.status)}</TableCell>
                      <TableCell className="text-right">{company.guards_count}</TableCell>
                      <TableCell className="text-right">{company.properties_count}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {company.reports_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm">
                          {formatStorage(company.total_storage_mb)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                {analytics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No companies found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyAnalytics;
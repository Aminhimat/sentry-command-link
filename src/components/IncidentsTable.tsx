import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import IncidentDetailsModal from "./IncidentDetailsModal";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";

interface IncidentsTableProps {
  incidents: any[];
}

const IncidentsTable = ({ incidents }: IncidentsTableProps) => {
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const sortedIncidents = useMemo(() => {
    return [...incidents].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [incidents]);

  const totalPages = Math.max(1, Math.ceil(sortedIncidents.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const visibleIncidents = sortedIncidents.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      'low': { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Low' },
      'medium': { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Medium' },
      'high': { className: 'bg-red-100 text-red-800 border-red-200', label: 'High' },
      'none': { className: 'bg-gray-100 text-gray-800 border-gray-200', label: 'None' }
    };
    
    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.none;
    return <Badge className={config.className}>{config.label}</Badge>;
  };
  const handleIncidentClick = (incident: any) => {
    setSelectedIncident(incident);
    setIsModalOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold tracking-wide">INCIDENTS MONITOR</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total: {incidents.length}</span>
              <span>•</span>
              <span>Reports: {incidents.length}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-sm">Issue ID</th>
                  <th className="text-left p-4 font-medium text-sm">Property/Site</th>
                  <th className="text-left p-4 font-medium text-sm">Reported Issue</th>
                  <th className="text-left p-4 font-medium text-sm">Created Date</th>
                  <th className="text-left p-4 font-medium text-sm">Created By</th>
                  <th className="text-left p-4 font-medium text-sm">Severity</th>
                  <th className="text-left p-4 font-medium text-sm">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No incidents reported yet
                    </td>
                  </tr>
                ) : (
visibleIncidents.map((incident) => (
                    <tr 
                      key={incident.id} 
                      className="border-b hover:bg-muted/25 transition-colors cursor-pointer"
                      onClick={() => handleIncidentClick(incident)}
                    >
                      <td className="p-4 font-mono text-sm text-red-600">
                        {incident.id.split('-')[0].toUpperCase()}
                      </td>
                      <td className="p-4 text-sm font-medium">
                        {incident.location_address || 'Unknown Site'}
                      </td>
                      <td className="p-4 text-sm">
                        {incident.report_text ? incident.report_text.split('\n')[0].replace('Task: ', '') : 'Security Report'}
                      </td>
                      <td className="p-4 text-sm">
                        {new Date(incident.created_at).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'numeric',
                          day: 'numeric',
                          year: '2-digit',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="p-4 text-sm">
                        {incident.guard?.first_name ? `${incident.guard.first_name} ${incident.guard.last_name}` : 'Unknown Guard'}
                      </td>
                      <td className="p-4">
                        {getSeverityBadge(incident.report_text?.includes('Severity: ') ? 
                          incident.report_text.split('Severity: ')[1]?.split('\n')[0] || 'none' : 'none')}
                      </td>
                      <td className="p-4 text-sm">
                        {incident.guard?.first_name ? `${incident.guard.first_name} ${incident.guard.last_name}` : 'Unknown Guard'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4">
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)); }}
                    aria-disabled={currentPage === 1}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
                    aria-disabled={currentPage === totalPages}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

<IncidentDetailsModal
        incident={selectedIncident}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default IncidentsTable;
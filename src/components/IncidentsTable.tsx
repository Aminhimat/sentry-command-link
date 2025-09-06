
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import IncidentDetailsModal from "./IncidentDetailsModal";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";

interface IncidentsTableProps {
  incidents: any[];
}

const IncidentsTable = ({ incidents }: IncidentsTableProps) => {
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedGuard, setSelectedGuard] = useState<string>("all");
  const pageSize = 20;

  // Get unique sites from incidents
  const uniqueSites = useMemo(() => {
    const sites = [...new Set(incidents.map(incident => incident.location_address || 'Unknown Site'))];
    return sites.sort();
  }, [incidents]);

  // Get unique guards from incidents
  const uniqueGuards = useMemo(() => {
    const guards = [...new Set(incidents.map(incident => {
      if (incident.guard?.first_name) {
        return `${incident.guard.first_name} ${incident.guard.last_name}`;
      }
      return 'Unknown Guard';
    }))];
    return guards.sort();
  }, [incidents]);

  // Filter incidents by selected site and guard
  const filteredIncidents = useMemo(() => {
    let filtered = incidents;
    
    if (selectedSite !== "all") {
      filtered = filtered.filter(incident => 
        (incident.location_address || 'Unknown Site') === selectedSite
      );
    }
    
    if (selectedGuard !== "all") {
      filtered = filtered.filter(incident => {
        const guardName = incident.guard?.first_name ? 
          `${incident.guard.first_name} ${incident.guard.last_name}` : 
          'Unknown Guard';
        return guardName === selectedGuard;
      });
    }
    
    return filtered;
  }, [incidents, selectedSite, selectedGuard]);

  const sortedIncidents = useMemo(() => {
    return [...filteredIncidents].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredIncidents]);

  const totalPages = Math.max(1, Math.ceil(sortedIncidents.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const visibleIncidents = sortedIncidents.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, selectedSite, selectedGuard]);

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
      <Card className="shadow-lg border-2 border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-wide text-white">INCIDENTS MONITOR</CardTitle>
              <div className="flex items-center gap-4">
                <Select value={selectedSite} onValueChange={setSelectedSite}>
                  <SelectTrigger className="w-[200px] bg-white border-white/30 text-gray-900 placeholder:text-gray-600">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                    <SelectItem value="all">All Sites</SelectItem>
                    {uniqueSites.map((site) => (
                      <SelectItem key={site} value={site}>
                        {site}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedGuard} onValueChange={setSelectedGuard}>
                  <SelectTrigger className="w-[200px] bg-white border-white/30 text-gray-900 placeholder:text-gray-600">
                    <SelectValue placeholder="Select guard" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                    <SelectItem value="all">All Guards</SelectItem>
                    {uniqueGuards.map((guard) => (
                      <SelectItem key={guard} value={guard}>
                        {guard}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 text-sm text-white/90 bg-white/10 px-3 py-2 rounded-lg">
                  <span>Total: {sortedIncidents.length}</span>
                  <span>•</span>
                  <span>Reports: {sortedIncidents.length}</span>
                </div>
              </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-50 to-green-100 border-b-2 border-green-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-sm text-green-800">Issue ID</th>
                  <th className="text-left p-4 font-semibold text-sm text-green-800">Property/Site</th>
                  <th className="text-left p-4 font-semibold text-sm text-green-800">Reported Issue</th>
                  <th className="text-left p-4 font-semibold text-sm text-green-800">Created Date</th>
                  <th className="text-left p-4 font-semibold text-sm text-green-800">Created By</th>
                  <th className="text-left p-4 font-semibold text-sm text-green-800">Severity</th>
                  <th className="text-left p-4 font-semibold text-sm text-green-800">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {sortedIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-green-600 bg-green-50/50">
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-lg font-medium">
                          {selectedSite === "all" && selectedGuard === "all" 
                            ? "No incidents reported yet" 
                            : `No incidents found for the selected filters`}
                        </div>
                        <div className="text-sm text-green-500">
                          All systems secure
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleIncidents.map((incident, index) => (
                    <tr 
                      key={incident.id} 
                      className={`border-b border-green-100 transition-all duration-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-green-25'
                      }`}
                    >
                      <td 
                        className="p-4 font-mono text-sm text-green-700 font-semibold bg-green-50 border-r border-green-100 cursor-pointer hover:bg-green-100"
                        onClick={() => handleIncidentClick(incident)}
                      >
                        {incident.id.split('-')[0].toUpperCase()}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-800">
                        {incident.location_address || 'Unknown Site'}
                      </td>
                      <td className="p-4 text-sm text-gray-700">
                        {incident.report_text ? incident.report_text.split('\n')[0].replace('Task: ', '') : 'Security Report'}
                      </td>
                      <td className="p-4 text-sm text-gray-700">
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
                      <td className="p-4 text-sm text-gray-700 font-medium">
                        {incident.guard?.first_name ? `${incident.guard.first_name} ${incident.guard.last_name}` : 'Unknown Guard'}
                      </td>
                      <td className="p-4">
                        {getSeverityBadge(incident.report_text?.includes('Severity: ') ? 
                          incident.report_text.split('Severity: ')[1]?.split('\n')[0] || 'none' : 'none')}
                      </td>
                      <td className="p-4 text-sm text-gray-700 font-medium">
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

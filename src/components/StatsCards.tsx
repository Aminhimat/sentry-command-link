import { Users, Activity, AlertTriangle, FileText } from "lucide-react";

interface StatsCardsProps {
  guards: any[];
  incidents: any[];
}

const StatsCards = ({ guards, incidents }: StatsCardsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-4 mb-6">
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Guards</p>
            <p className="text-2xl font-bold">{guards.length}</p>
          </div>
          <Users className="h-8 w-8 text-primary" />
        </div>
      </div>
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Active Guards</p>
            <p className="text-2xl font-bold">{guards.filter(g => g.is_active).length}</p>
          </div>
          <Activity className="h-8 w-8 text-green-600" />
        </div>
      </div>
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Incidents</p>
            <p className="text-2xl font-bold">{incidents.length}</p>
          </div>
          <AlertTriangle className="h-8 w-8 text-orange-600" />
        </div>
      </div>
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Open Issues</p>
            <p className="text-2xl font-bold">{incidents.filter(i => i.status === 'open').length}</p>
          </div>
          <FileText className="h-8 w-8 text-red-600" />
        </div>
      </div>
    </div>
  );
};

export default StatsCards;
import { Users, Activity, AlertTriangle, FileText } from "lucide-react";

interface StatsCardsProps {
  guards: any[];
  incidents: any[];
}

const StatsCards = ({ guards, incidents }: StatsCardsProps) => {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6">
      <div className="bg-card p-3 sm:p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Guards</p>
            <p className="text-xl sm:text-2xl font-bold">{guards.length}</p>
          </div>
          <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
        </div>
      </div>
      <div className="bg-card p-3 sm:p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Active Guards</p>
            <p className="text-xl sm:text-2xl font-bold">{guards.filter(g => g.is_active).length}</p>
          </div>
          <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
        </div>
      </div>
      <div className="bg-card p-3 sm:p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Reports</p>
            <p className="text-xl sm:text-2xl font-bold">{incidents.length}</p>
          </div>
          <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
        </div>
      </div>
      <div className="bg-card p-3 sm:p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Today's Reports</p>
            <p className="text-xl sm:text-2xl font-bold">{incidents.filter(i => {
              const today = new Date().toDateString();
              return new Date(i.created_at).toDateString() === today;
            }).length}</p>
          </div>
          <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default StatsCards;
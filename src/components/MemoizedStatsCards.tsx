import React, { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, FileText, Users, Shield } from "lucide-react";

interface Stats {
  activeGuards: number;
  totalReports: number;
  totalShifts: number;
  properties: number;
}

interface MemoizedStatsCardsProps {
  stats: Stats;
}

const MemoizedStatsCardsComponent: React.FC<MemoizedStatsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: "Active Guards",
      value: stats.activeGuards,
      description: "Currently on duty",
      icon: Users,
      color: "text-primary"
    },
    {
      title: "Total Reports", 
      value: stats.totalReports,
      description: "Reports submitted today",
      icon: FileText,
      color: "text-success"
    },
    {
      title: "Total Shifts",
      value: stats.totalShifts, 
      description: "Active shifts today",
      icon: Activity,
      color: "text-accent"
    },
    {
      title: "Properties",
      value: stats.properties,
      description: "Properties managed",
      icon: Shield,
      color: "text-warning"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        return (
          <Card key={index} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <IconComponent className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export const MemoizedStatsCards = memo(MemoizedStatsCardsComponent);
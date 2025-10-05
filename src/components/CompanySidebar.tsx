import { Download, Plus, LogOut, LayoutDashboard, Calendar, Users, MapPin } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface CompanySidebarProps {
  onGenerateReport: () => void;
  onNewGuard: () => void;
  onSignOut: () => void;
}

const navigationItems = [
  { title: "Overview", url: "/company", icon: LayoutDashboard },
  { title: "Shifts", url: "/company/shifts", icon: Calendar },
  { title: "Guards", url: "/company/guards", icon: Users },
  { title: "Properties/Sites", url: "/company/properties", icon: MapPin },
];

const actionItems = [
  { title: "Generate Report", icon: Download, action: "generateReport" as const },
  { title: "New Guard", icon: Plus, action: "newGuard" as const },
  { title: "Sign Out", icon: LogOut, action: "signOut" as const },
];

export function CompanySidebar({ onGenerateReport, onNewGuard, onSignOut }: CompanySidebarProps) {
  const handleAction = (action: "generateReport" | "newGuard" | "signOut") => {
    switch (action) {
      case "generateReport":
        onGenerateReport();
        break;
      case "newGuard":
        onNewGuard();
        break;
      case "signOut":
        onSignOut();
        break;
    }
  };

  return (
    <Sidebar>
      <SidebarContent>
        {/* Navigation Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        isActive
                          ? "bg-muted text-primary font-medium"
                          : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Actions Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {actionItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => handleAction(item.action)}
                    className="hover:bg-muted/50 cursor-pointer"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

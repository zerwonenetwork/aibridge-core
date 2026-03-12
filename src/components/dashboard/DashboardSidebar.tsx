import { Activity, CheckSquare, LayoutDashboard, Bot, BookOpen, Scale, ChevronLeft, MessageSquare, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardView } from "@/pages/Dashboard";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import aibridgeLogo from "@/assets/logo.svg";

type SidebarNavItem = { id: DashboardView; label: string; icon: React.ElementType };

const coreNavItems: SidebarNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "conventions", label: "Conventions", icon: BookOpen },
  { id: "decisions", label: "Decisions", icon: Scale },
];

interface DashboardSidebarProps {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  unreadCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DashboardSidebar({
  activeView,
  onViewChange,
  unreadCount = 0,
  collapsed = false,
  onToggleCollapse,
}: DashboardSidebarProps) {
  return (
    <aside
      className={cn(
        "border-r border-border bg-sidebar-background flex flex-col h-screen sticky top-0 transition-all duration-200 ease-in-out shrink-0 overflow-hidden",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Header */}
      <div className={cn(
        "border-b border-border flex items-center shrink-0",
        collapsed ? "justify-center p-3 h-14" : "p-4 gap-2.5 h-14"
      )}>
        <img src={aibridgeLogo} alt="AiBridge" className="w-7 h-7 shrink-0" />
        {!collapsed && (
          <span className="font-display text-sm font-bold tracking-wide text-foreground whitespace-nowrap">
            AiBridge Local
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", collapsed ? "p-1.5" : "p-3")}>
        {coreNavItems.map(item => {
          const isActive = activeView === item.id;
          const button = (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center rounded-md transition-colors",
                collapsed ? "justify-center p-2" : "gap-2.5 px-3 py-2 text-sm",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <>
                  {item.label}
                  {item.id === "messages" && unreadCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground px-1.5">
                      {unreadCount}
                    </Badge>
                  )}
                </>
              )}
              {collapsed && item.id === "messages" && unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                  {item.id === "messages" && unreadCount > 0 && ` (${unreadCount})`}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-border space-y-0.5", collapsed ? "p-1.5" : "p-3")}>
        {onToggleCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className={cn(
                  "w-full flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50",
                  collapsed ? "justify-center px-0" : "px-3"
                )}
              >
                {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5 shrink-0" /> : <PanelLeftClose className="w-3.5 h-3.5 shrink-0" />}
                {!collapsed && "Collapse"}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Expand sidebar</TooltipContent>}
          </Tooltip>
        )}

        {(() => {
          const settingsBtn = (
            <button
              onClick={() => onViewChange("settings")}
              className={cn(
                "w-full flex items-center gap-2 py-2 text-xs rounded-md transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                activeView === "settings"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && "Settings"}
            </button>
          );
          if (collapsed) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>{settingsBtn}</TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            );
          }
          return settingsBtn;
        })()}

        {(() => {
          const backBtn = (
            <Link
              to="/"
              className={cn(
                "flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50",
                collapsed ? "justify-center px-0" : "px-3"
              )}
            >
              <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && "Back to site"}
            </Link>
          );
          if (collapsed) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>{backBtn}</TooltipTrigger>
                <TooltipContent side="right">Back to site</TooltipContent>
              </Tooltip>
            );
          }
          return backBtn;
        })()}
      </div>
    </aside>
  );
}

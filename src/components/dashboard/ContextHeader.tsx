import { RefreshCw, Users, CheckSquare, Clock, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import type { AibridgeContextSummary, AibridgeRuntimeState, AibridgeStatus, AibridgeTask } from "@/lib/aibridge/types";
import type { DashboardView } from "@/pages/Dashboard";
import { formatDistanceToNow } from "date-fns";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { ServiceStatusIndicator } from "@/components/dashboard/ServiceStatusIndicator";
import { ExportButton } from "@/components/dashboard/ExportButton";
import type { LocalBridgeClientError } from "@/lib/aibridge/local/client";

interface ContextHeaderProps {
  context: AibridgeContextSummary;
  runtime: AibridgeRuntimeState;
  onSync: () => void;
  onMenuToggle?: () => void;
  tasks?: AibridgeTask[];
  onNavigate?: (view: DashboardView) => void;
  loading?: boolean;
  error?: LocalBridgeClientError | null;
  status?: AibridgeStatus;
}

export function ContextHeader({
  context,
  runtime,
  onSync,
  onMenuToggle,
  tasks,
  onNavigate,
  loading = false,
  error = null,
  status,
}: ContextHeaderProps) {
  const { toast } = useToast();

  const handleRefresh = () => {
    onSync();
    toast({
      title: "Context refreshed",
      description: `Reloaded ${runtime.sourceLabel.toLowerCase()} and regenerated context.`,
    });
  };

  const refreshedAgo = formatDistanceToNow(new Date(context.lastSyncAt), { addSuffix: true });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        {onMenuToggle && (
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onMenuToggle}>
            <Menu className="w-4 h-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-sm font-bold text-foreground truncate">{context.projectName}</h1>
          <p className="text-xs text-muted-foreground font-mono truncate">{context.repoPath}</p>
        </div>
        <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated {refreshedAgo}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {context.activeAgents.length} agents</span>
          <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> {context.taskCounts.in_progress} active</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <CommandPalette onNavigate={(v) => onNavigate?.(v)} tasks={tasks ?? []} />
        <div className="hidden sm:flex items-center gap-1.5">
          <ServiceStatusIndicator loading={loading} error={error} isSample={runtime.isSample} />
          {context.activeAgents.slice(0, 3).map(agent => (
            <Badge key={agent.id} variant="secondary" className="text-[10px] font-display px-2 py-0.5">
              {agent.name}
            </Badge>
          ))}
          {context.activeAgents.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5">+{context.activeAgents.length - 3}</Badge>
          )}
        </div>
        {status && <ExportButton status={status} />}
        <ThemeToggle />
        <Button size="sm" onClick={handleRefresh} className="gap-1.5 font-display text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </header>
  );
}

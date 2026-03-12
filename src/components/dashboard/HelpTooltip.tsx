import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export function HelpTooltip({ content, className = "" }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${className}`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const helpText = {
  localSource: "AiBridge reads from a local .aibridge directory. No cloud connection required.",
  sampleBridge: "A bundled read-only example bridge for exploring the dashboard without a real project.",
  workspaceBridge: "Reads the .aibridge directory in your current workspace root.",
  customPath: "Point to any directory containing a .aibridge folder.",
  autoCapture: "Git hooks and file watchers automatically log development activity to your local bridge.",
  watcher: "The file watcher monitors your project for changes and records them as activity entries.",
  hooks: "Git hooks (e.g. post-commit) capture version control events into the bridge log.",
  refresh: "Reloads data from the local .aibridge directory and regenerates the context summary.",
  agents: "AI agents are tools configured in your bridge. Their activity is tracked locally.",
  tasks: "Tasks are tracked locally in your .aibridge directory and can be updated from the dashboard.",
  conventions: "Development standards defined in your bridge, shared across all configured agents.",
  decisions: "Architecture Decision Records (ADRs) stored in your local bridge.",
  handoffs: "Records of work being passed between agents, tracked in the local bridge.",
  messages: "Inter-agent messages stored locally. You can acknowledge them from the dashboard.",
  serviceStatus: "Shows whether the local AiBridge service process is reachable.",
  exportData: "Download your entire bridge state as a JSON file for backup or sharing.",
} as const;

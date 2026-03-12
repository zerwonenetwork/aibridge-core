import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { LocalBridgeClientError } from "@/lib/aibridge/local/client";

interface ServiceStatusIndicatorProps {
  loading: boolean;
  error: LocalBridgeClientError | null;
  isSample?: boolean;
}

export function ServiceStatusIndicator({ loading, error, isSample }: ServiceStatusIndicatorProps) {
  if (isSample) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              Sample
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
            Using bundled sample data. No local service needed.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (loading) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting
      </Badge>
    );
  }

  if (error) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="text-[10px] gap-1 px-2 py-0.5 cursor-default">
              <WifiOff className="w-3 h-3" />
              Offline
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[220px]">
            {error.code === "SERVICE_UNAVAILABLE"
              ? "Local service not running. Start it with: npx aibridge serve"
              : error.code === "NO_BRIDGE_FOUND"
              ? "No .aibridge directory found. Run: npx aibridge init"
              : error.message}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 border-emerald-500/30 cursor-default">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">Connected</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Local AiBridge service is running and connected.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AibridgeAgent, AibridgeLogEntry, AibridgeTask, AibridgeHandoff } from "@/lib/aibridge/types";
import { getAgentColor } from "@/lib/aibridge/agent-colors";
import { formatDistanceToNow } from "date-fns";
import { Bot, ArrowRight, CheckSquare, Activity } from "lucide-react";
import { motion } from "framer-motion";

interface AgentDetailPanelProps {
  agent: AibridgeAgent | null;
  open: boolean;
  onClose: () => void;
  logs: AibridgeLogEntry[];
  tasks: AibridgeTask[];
  handoffs: AibridgeHandoff[];
}

export function AgentDetailPanel({ agent, open, onClose, logs, tasks, handoffs }: AgentDetailPanelProps) {
  if (!agent) return null;

  const color = getAgentColor(agent.kind);
  const agentLogs = logs.filter(l => l.agentId === agent.id).slice(0, 5);
  const agentTasks = tasks.filter(t => t.agentId === agent.id);
  const agentHandoffs = handoffs.filter(h => h.fromAgentId === agent.id || h.toAgentId === agent.id);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-80 sm:w-96 bg-card border-border overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Bot className={`w-5 h-5 ${color.text}`} />
            {agent.name}
            <Badge className={`text-[10px] border ${color.bg} ${color.text} ${color.border}`}>{agent.kind}</Badge>
          </SheetTitle>
          <p className="text-xs text-muted-foreground font-mono truncate">{agent.configPath}</p>
        </SheetHeader>

        <div className="space-y-6 mt-2">
          {/* Tasks */}
          <section>
            <h4 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" /> Tasks ({agentTasks.length})
            </h4>
            <div className="space-y-1.5">
              {agentTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === "done" ? "bg-emerald-400" : t.status === "in_progress" ? "bg-primary" : "bg-yellow-400"}`} />
                  <span className="truncate text-foreground">{t.title}</span>
                  <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{t.status.replace("_", " ")}</Badge>
                </div>
              ))}
              {agentTasks.length === 0 && <p className="text-xs text-muted-foreground">No tasks assigned.</p>}
            </div>
          </section>

          {/* Activity */}
          <section>
            <h4 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Recent Activity
            </h4>
            <div className="space-y-2">
              {agentLogs.map(l => (
                <div key={l.id} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[9px] px-1.5">{l.action}</Badge>
                    <span className="text-muted-foreground ml-auto">{formatDistanceToNow(new Date(l.timestamp), { addSuffix: true })}</span>
                  </div>
                  <p className="text-foreground/80">{l.description}</p>
                </div>
              ))}
              {agentLogs.length === 0 && <p className="text-xs text-muted-foreground">No recent activity.</p>}
            </div>
          </section>

          {/* Handoffs */}
          <section>
            <h4 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> Handoffs ({agentHandoffs.length})
            </h4>
            <div className="space-y-2">
              {agentHandoffs.map(h => (
                <div key={h.id} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span className="font-display text-foreground">{h.fromAgentId === agent.id ? agent.name : "→"}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-display text-foreground">{h.toAgentId === agent.id ? agent.name : "→"}</span>
                    <span className="ml-auto">{formatDistanceToNow(new Date(h.timestamp), { addSuffix: true })}</span>
                  </div>
                  <p className="text-foreground/80">{h.description}</p>
                </div>
              ))}
              {agentHandoffs.length === 0 && <p className="text-xs text-muted-foreground">No handoffs.</p>}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

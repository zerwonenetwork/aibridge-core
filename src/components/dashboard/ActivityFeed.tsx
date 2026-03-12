import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AibridgeLogEntry, AibridgeAgent } from "@/lib/aibridge/types";
import { getAgentColor } from "@/lib/aibridge/agent-colors";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface ActivityFeedProps {
  logs: AibridgeLogEntry[];
  agents: AibridgeAgent[];
}

const actionColors: Record<string, string> = {
  edit: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  create: "bg-green-500/10 text-green-400 border-green-500/20",
  test: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  refactor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  suggest: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  review: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export function ActivityFeed({ logs, agents }: ActivityFeedProps) {
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const actions = useMemo(() => [...new Set(logs.map(l => l.action))], [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (agentFilter !== "all" && l.agentId !== agentFilter) return false;
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      return true;
    });
  }, [logs, agentFilter, actionFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="space-y-1 flex-1">
          <h2 className="text-xl font-display font-semibold">Activity Feed</h2>
          <p className="text-sm text-muted-foreground">
            Recent actions from agents in your local bridge
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-28 sm:w-36 h-8 text-xs"><SelectValue placeholder="All agents" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-24 sm:w-32 h-8 text-xs"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <motion.div
        className="space-y-2"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      >
        {filtered.map(log => {
          const agent = agents.find(a => a.id === log.agentId);
          const colorClass = actionColors[log.action] ?? "bg-muted text-muted-foreground";
          const agentColor = agent ? getAgentColor(agent.kind) : null;
          const capture = typeof log.metadata?.capture === "object" && log.metadata?.capture !== null
            ? (log.metadata.capture as { source?: string; confidence?: string })
            : null;
          return (
            <motion.div key={log.id} variants={item}>
              <Card className="bg-card border-border card-hover">
                <CardContent className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                  <Badge className={`text-[10px] font-display shrink-0 mt-0.5 border ${agentColor?.bg} ${agentColor?.text} ${agentColor?.border}`}>{agent?.name ?? "Unknown"}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <Badge className={`text-[10px] px-1.5 py-0 border ${colorClass}`}>{log.action}</Badge>
                      {capture?.source && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          auto:{capture.source}
                        </Badge>
                      )}
                      {capture?.confidence && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {capture.confidence}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-foreground/90 break-words">{log.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No activity matching filters.</p>}
      </motion.div>
    </div>
  );
}

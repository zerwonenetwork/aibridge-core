import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckSquare, Bot, ArrowRight, BookOpen, MessageSquare, Inbox } from "lucide-react";
import type { AibridgeStatus } from "@/lib/aibridge/types";
import type { DashboardView } from "@/pages/Dashboard";
import { getAgentColor } from "@/lib/aibridge/agent-colors";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface OverviewViewProps {
  status: AibridgeStatus;
  onNavigate: (view: DashboardView) => void;
}

const stagger = { show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export const OverviewView = React.forwardRef<HTMLDivElement, OverviewViewProps>(function OverviewView({ status, onNavigate }, ref) {
  const { context, logs, tasks, handoffs, conventions, decisions, messages } = status;

  const unreadMessages = messages.filter(m => !m.acknowledged).length;
  const openHandoffs = handoffs.filter((handoff) => handoff.status !== "completed");
  const inboxCount = unreadMessages + openHandoffs.length + (status.issues?.length ?? 0) + status.sessions.filter(s => s.status === "stale" || s.status === "failed").length;

  const statCards = [
    { label: "Pending", value: context.taskCounts.pending, color: "text-yellow-400", large: false },
    { label: "In Progress", value: context.taskCounts.in_progress, color: "text-primary", large: true },
    { label: "Done", value: context.taskCounts.done, color: "text-emerald-400", large: false },
    { label: "Agents", value: context.activeAgents.length, color: "text-blue-400", large: false },
  ];

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" variants={stagger}>
      {/* Stat cards */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={stagger}>
        {statCards.map(s => (
          <motion.div key={s.label} variants={item} whileHover={{ y: -2, transition: { duration: 0.2 } }}>
            <Card className={`bg-card border-border ${s.large ? "md:ring-1 md:ring-primary/10" : ""}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-display">{s.label}</p>
                <p className={`text-3xl font-bold font-display mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Inbox banner */}
      {inboxCount > 0 && (
        <motion.div variants={item}>
          <button
            onClick={() => onNavigate("inbox")}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
          >
            <Inbox className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-foreground font-medium">{inboxCount} items need review</span>
            <ArrowRight className="w-4 h-4 text-primary ml-auto" />
          </button>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent activity */}
        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-display flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Recent Activity</CardTitle>
              <button onClick={() => onNavigate("activity")} className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></button>
            </CardHeader>
            <CardContent className="space-y-3">
              {logs.slice(0, 4).map(log => {
                const agent = context.activeAgents.find(a => a.id === log.agentId);
                const color = agent ? getAgentColor(agent.kind) : null;
                return (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <Badge className={`text-[10px] font-display shrink-0 mt-0.5 border ${color?.bg} ${color?.text} ${color?.border}`}>{agent?.name ?? "Unknown"}</Badge>
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{log.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Task summary */}
        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-display flex items-center gap-2"><CheckSquare className="w-4 h-4 text-primary" /> Tasks</CardTitle>
              <button onClick={() => onNavigate("tasks")} className="text-xs text-primary hover:underline flex items-center gap-1">View board <ArrowRight className="w-3 h-3" /></button>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.filter(t => t.status !== "done").slice(0, 5).map(task => {
                const agent = context.activeAgents.find(a => a.id === task.agentId);
                return (
                  <div key={task.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${task.status === "in_progress" ? "bg-primary" : "bg-yellow-400"}`} />
                      <span className="truncate text-foreground">{task.title}</span>
                    </div>
                    {agent && <Badge variant="outline" className="text-[10px] font-display shrink-0 ml-2">{agent.name}</Badge>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Handoffs */}
        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-display flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Recent Handoffs</CardTitle>
              <button onClick={() => onNavigate("agents")} className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></button>
            </CardHeader>
            <CardContent className="space-y-3">
              {openHandoffs.slice(0, 3).map(h => {
                const from = context.activeAgents.find(a => a.id === h.fromAgentId);
                const to = context.activeAgents.find(a => a.id === h.toAgentId);
                return (
                  <div key={h.id} className="text-sm">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                      <span className="font-display text-foreground">{from?.name}</span> → <span className="font-display text-foreground">{to?.name}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">{h.status}</Badge>
                      <span className="ml-auto">{formatDistanceToNow(new Date(h.timestamp), { addSuffix: true })}</span>
                    </div>
                    <p className="text-foreground/80 text-xs">{h.description}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Conventions + Decisions */}
        <motion.div variants={item}>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Conventions & Decisions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display mb-1.5">Conventions ({conventions.length})</p>
                {conventions.slice(0, 2).map(c => (
                  <p key={c.id} className="text-xs text-foreground/80 py-1 border-b border-border/50 last:border-0">{c.rule}</p>
                ))}
                <button onClick={() => onNavigate("conventions")} className="text-xs text-primary hover:underline mt-1">View all</button>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display mb-1.5">Decisions ({decisions.length})</p>
                {decisions.slice(0, 2).map(d => (
                  <p key={d.id} className="text-xs text-foreground/80 py-1 border-b border-border/50 last:border-0"><strong>{d.title}</strong> — {d.summary.slice(0, 80)}…</p>
                ))}
                <button onClick={() => onNavigate("decisions")} className="text-xs text-primary hover:underline mt-1">View all</button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
});

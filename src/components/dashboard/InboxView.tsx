import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Bot, CheckSquare, MessageSquare, ShieldAlert } from "lucide-react";
import type { AibridgeStatus } from "@/lib/aibridge/types";
import type { DashboardView } from "@/pages/Dashboard";

interface InboxViewProps {
  status: AibridgeStatus;
  onNavigate: (view: DashboardView) => void;
}

function issueTone(issue: string) {
  return /invalid|unable to read|unable to parse/i.test(issue)
    ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
    : "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

export function InboxView({ status, onNavigate }: InboxViewProps) {
  const unreadMessages = status.messages.filter((message) => !message.acknowledged);
  const openHandoffs = status.handoffs.slice(0, 5);
  const staleSessions = status.sessions.filter((session) => session.status === "stale" || session.status === "failed");
  const activeIssues = status.issues ?? [];
  const nextTasks = status.tasks.filter((task) => task.status !== "done").slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-display font-semibold">Coordinator Inbox</h2>
        <p className="text-sm text-muted-foreground">
          Review what needs human attention across messages, handoffs, stale agents, and protocol issues.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Unread messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unreadMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unread messages.</p>
            ) : (
              unreadMessages.slice(0, 3).map((message) => (
                <div key={message.id} className="rounded-md border border-border bg-background/60 p-3">
                  <p className="text-sm text-foreground">{message.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {message.fromAgentId} → {message.toAgentId ?? "all"} · {message.severity}
                  </p>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate("messages")}>
              Open messages <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> Stale or failed agents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staleSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">All tracked agent sessions are healthy.</p>
            ) : (
              staleSessions.slice(0, 3).map((session) => (
                <div key={session.id} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm text-foreground">{session.agentId}</p>
                  <p className="text-xs text-amber-100 mt-1">{session.recovery?.reason ?? "Needs recovery"}</p>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate("agents")}>
              Open agents <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" /> Open handoffs and next tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openHandoffs.length > 0 ? (
              openHandoffs.slice(0, 2).map((handoff) => (
                <div key={handoff.id} className="rounded-md border border-border bg-background/60 p-3">
                  <p className="text-sm text-foreground">{handoff.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {handoff.fromAgentId} → {handoff.toAgentId}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No open handoffs.</p>
            )}
            {nextTasks.length > 0 && (
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Next tasks</p>
                <ul className="space-y-1 text-sm text-foreground">
                  {nextTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>- {task.title}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate("tasks")}>
              Open task board <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" /> Protocol issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No protocol or runtime issues detected.</p>
            ) : (
              activeIssues.slice(0, 3).map((issue) => (
                <div key={issue} className={`rounded-md border p-3 ${issueTone(issue)}`}>
                  <p className="text-sm">{issue}</p>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate("settings")}>
              Review local settings <AlertTriangle className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

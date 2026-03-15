import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowRight, Bot, CheckSquare, Copy, MessageSquare, RefreshCw, ShieldAlert } from "lucide-react";
import type { AibridgeAgentSession, AibridgeProtocolIssue, AibridgeStatus, AibridgeVerificationIssue } from "@/lib/aibridge/types";
import type { DashboardView } from "@/pages/Dashboard";
import { useToast } from "@/hooks/use-toast";

interface InboxViewProps {
  status: AibridgeStatus;
  verificationIssues: AibridgeVerificationIssue[];
  onNavigate: (view: DashboardView) => void;
  onAcknowledgeMessage: (messageId: string) => Promise<unknown>;
  onRecoverSession: (sessionId: string) => Promise<AibridgeAgentSession>;
  onDispatchRecovery: (sessionId: string) => Promise<AibridgeAgentSession>;
  onHeartbeatSession: (sessionId: string) => Promise<AibridgeAgentSession>;
  onCreateDecision: (payload: { title: string; summary: string; status?: "proposed" | "accepted" | "superseded"; agentId?: string }) => Promise<unknown>;
  onCreateLog: (payload: { agentId: string; action: string; description: string; metadata?: Record<string, unknown> }) => Promise<unknown>;
  onUpdateHandoff: (handoffId: string, payload: { status: "open" | "accepted" | "completed"; agentId?: string }) => Promise<unknown>;
  onCopyRepairPrompt: (issueId: string) => Promise<string>;
  onCleanupProtocolIssue: (issueId: string) => Promise<unknown>;
  onRegenerateContext: () => Promise<void>;
  onDismissVerificationIssue: (issueId: string) => void;
}

function issueTone(issue: AibridgeProtocolIssue) {
  if (issue.severity === "critical") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

export function InboxView({
  status,
  verificationIssues,
  onNavigate,
  onAcknowledgeMessage,
  onRecoverSession,
  onDispatchRecovery,
  onHeartbeatSession,
  onCreateDecision,
  onCreateLog,
  onUpdateHandoff,
  onCopyRepairPrompt,
  onCleanupProtocolIssue,
  onRegenerateContext,
  onDismissVerificationIssue,
}: InboxViewProps) {
  const { toast } = useToast();
  const unreadMessages = status.messages.filter((message) => !message.acknowledged);
  const openHandoffs = status.handoffs.filter((handoff) => handoff.status !== "completed").slice(0, 5);
  const staleSessions = status.sessions.filter((session) => session.status === "stale" || session.status === "failed");
  const activeIssues = status.protocolIssues ?? [];
  const nextTasks = status.tasks.filter((task) => task.status !== "done").slice(0, 5);
  const defaultAgentId = status.context.activeAgents[0]?.id ?? "";
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionSummary, setDecisionSummary] = useState("");
  const [decisionAgentId, setDecisionAgentId] = useState(defaultAgentId || "none");
  const [logAgentId, setLogAgentId] = useState(defaultAgentId || "none");
  const [logDescription, setLogDescription] = useState("");
  const capabilities = useMemo(
    () => new Map((status.toolCapabilities ?? []).map((capability) => [capability.tool, capability])),
    [status.toolCapabilities],
  );

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: `${label} copied`,
        description: "Paste it into the agent tool.",
      });
    } catch {
      toast({
        title: `Unable to copy ${label.toLowerCase()}`,
        description: "Clipboard access is unavailable in this browser.",
        variant: "destructive",
      });
    }
  }

  async function copyRecoveryPrompt(sessionId: string) {
    const recovered = await onRecoverSession(sessionId);
    if (recovered.recovery?.prompt) {
      await copyText("Recovery prompt", recovered.recovery.prompt);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-display font-semibold">Coordinator Inbox</h2>
        <p className="text-sm text-muted-foreground">
          Run the local bridge from here: recover agents, clear review queues, and record the human-side coordination that should not require terminal access.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display">Operator Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void onRegenerateContext()}>
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate context
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate("agents")}>
              Open agents <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate("messages")}>
              Open messages <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Record Decision</p>
              <Input value={decisionTitle} onChange={(event) => setDecisionTitle(event.target.value)} placeholder="Decision title" className="h-9 text-sm" />
              <Input value={decisionSummary} onChange={(event) => setDecisionSummary(event.target.value)} placeholder="What changed and why?" className="h-9 text-sm" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={decisionAgentId}
                  onChange={(event) => setDecisionAgentId(event.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="none">No agent</option>
                  {status.context.activeAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                <Button
                  disabled={!decisionTitle.trim() || !decisionSummary.trim()}
                  onClick={() => {
                    const title = decisionTitle.trim();
                    const summary = decisionSummary.trim();
                    if (!title || !summary) return;
                    void onCreateDecision({
                      title,
                      summary,
                      status: "accepted",
                      agentId: decisionAgentId === "none" ? undefined : decisionAgentId,
                    });
                    setDecisionTitle("");
                    setDecisionSummary("");
                  }}
                >
                  Record
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Add Review Log</p>
              <Input value={logDescription} onChange={(event) => setLogDescription(event.target.value)} placeholder="Describe the human/operator action taken." className="h-9 text-sm" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={logAgentId}
                  onChange={(event) => setLogAgentId(event.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="none">No agent</option>
                  {status.context.activeAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                <Button
                  disabled={!logDescription.trim() || logAgentId === "none"}
                  onClick={() => {
                    const description = logDescription.trim();
                    if (!description || logAgentId === "none") return;
                    void onCreateLog({
                      agentId: logAgentId,
                      action: "operator",
                      description,
                    });
                    setLogDescription("");
                  }}
                >
                  Add log
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" /> Action verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verificationIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unconfirmed dashboard actions right now.</p>
            ) : (
              verificationIssues.slice(0, 4).map((issue) => (
                <div key={issue.id} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-sm text-foreground">{issue.title}</p>
                  <p className="text-xs text-amber-100">{issue.detail}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onNavigate(issue.recommendedView)}>
                      Review in {issue.recommendedView}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onDismissVerificationIssue(issue.id)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

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
              unreadMessages.slice(0, 4).map((message) => (
                <div key={message.id} className="rounded-md border border-border bg-background/60 p-3 space-y-2">
                  <p className="text-sm text-foreground">{message.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {message.fromAgentId} → {message.toAgentId ?? "all"} · {message.severity}
                  </p>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void onAcknowledgeMessage(message.id)}>
                    Acknowledge
                  </Button>
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
              staleSessions.slice(0, 4).map((session) => {
                const capability = capabilities.get(session.toolKind);
                return (
                  <div key={session.id} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                    <p className="text-sm text-foreground">{session.agentId}</p>
                    <p className="text-xs text-amber-100">{session.recovery?.reason ?? "Needs recovery"}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => void copyRecoveryPrompt(session.id)}>
                        <Copy className="w-3.5 h-3.5" /> Copy recovery prompt
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void onHeartbeatSession(session.id)}>
                        <RefreshCw className="w-3.5 h-3.5" /> Heartbeat
                      </Button>
                      {capability?.recoveryDispatch || capability?.nonChatExec ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void onDispatchRecovery(session.id)}>
                          Dispatch recovery
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
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
              openHandoffs.slice(0, 3).map((handoff) => (
                <div key={handoff.id} className="rounded-md border border-border bg-background/60 p-3 space-y-2">
                  <p className="text-sm text-foreground">{handoff.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {handoff.fromAgentId} → {handoff.toAgentId} · {handoff.status}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {handoff.status === "open" ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void onUpdateHandoff(handoff.id, { status: "accepted", agentId: handoff.toAgentId })}>
                        Accept
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void onUpdateHandoff(handoff.id, { status: "completed", agentId: handoff.toAgentId })}>
                      Resolve
                    </Button>
                  </div>
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
              activeIssues.slice(0, 4).map((issue) => (
                <div key={issue.id} className={`rounded-md border p-3 space-y-2 ${issueTone(issue)}`}>
                  <p className="text-sm">{issue.title}</p>
                  <p className="text-xs opacity-80">{issue.detail}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => copyText("Repair prompt", await onCopyRepairPrompt(issue.id))}>
                      <Copy className="w-3.5 h-3.5" /> Copy repair prompt
                    </Button>
                    {issue.recommendedAction === "cleanup_and_reprompt" ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void onCleanupProtocolIssue(issue.id)}>
                        <AlertTriangle className="w-3.5 h-3.5" /> Cleanup invalid file
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onNavigate("settings")}>
              Review local settings <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

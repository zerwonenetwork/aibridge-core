import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AibridgeAgent,
  AibridgeAgentSession,
  AibridgeAgentToolKind,
  AibridgeHandoff,
  AibridgeLogEntry,
  AibridgeMessage,
  AibridgeTask,
} from "@/lib/aibridge/types";
import { getAgentColor } from "@/lib/aibridge/agent-colors";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Bot, Copy, Play, RefreshCw, Square } from "lucide-react";
import { motion } from "framer-motion";
import { AgentDetailPanel } from "./AgentDetailPanel";

interface AgentsViewProps {
  agents: AibridgeAgent[];
  handoffs: AibridgeHandoff[];
  logs?: AibridgeLogEntry[];
  tasks?: AibridgeTask[];
  messages?: AibridgeMessage[];
  sessions: AibridgeAgentSession[];
  onLaunchSession: (agentId: string, toolKind: AibridgeAgentToolKind) => Promise<AibridgeAgentSession>;
  onStartSession: (sessionId: string) => Promise<AibridgeAgentSession>;
  onHeartbeatSession: (sessionId: string) => Promise<AibridgeAgentSession>;
  onStopSession: (sessionId: string, reason?: string) => Promise<AibridgeAgentSession>;
  onRecoverSession: (sessionId: string) => Promise<AibridgeAgentSession>;
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const STATUS_TONES: Record<AibridgeAgentSession["status"], string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  stale: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  stopped: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

const TOOL_LABELS: Record<AibridgeAgentToolKind, string> = {
  cursor: "Cursor",
  codex: "Codex",
  antigravity: "Antigravity",
};

export function AgentsView({
  agents,
  handoffs,
  logs = [],
  tasks = [],
  messages = [],
  sessions,
  onLaunchSession,
  onStartSession,
  onHeartbeatSession,
  onStopSession,
  onRecoverSession,
}: AgentsViewProps) {
  const [selectedAgent, setSelectedAgent] = useState<AibridgeAgent | null>(null);
  const [launchAgentId, setLaunchAgentId] = useState(agents[0]?.id ?? "");
  const [launchTool, setLaunchTool] = useState<AibridgeAgentToolKind>("cursor");
  const [activePromptSession, setActivePromptSession] = useState<AibridgeAgentSession | null>(null);
  const [launching, setLaunching] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const sessionGroups = useMemo(
    () =>
      agents.map((agent) => ({
        agent,
        sessions: sessions.filter((session) => session.agentId === agent.id),
      })),
    [agents, sessions],
  );

  const latestLaunches = useMemo(
    () =>
      sessions
        .slice()
        .sort((left, right) => right.launchedAt.localeCompare(left.launchedAt))
        .slice(0, 4),
    [sessions],
  );

  async function copyText(label: string, value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedText(label);
    window.setTimeout(() => setCopiedText((current) => (current === label ? null : current)), 1500);
  }

  async function handleLaunch() {
    if (!launchAgentId) {
      return;
    }

    setLaunching(true);
    try {
      const session = await onLaunchSession(launchAgentId, launchTool);
      setActivePromptSession(session);
    } finally {
      setLaunching(false);
    }
  }

  function unreadMessageCount(agentId: string) {
    return messages.filter((message) => !message.acknowledged && (!message.toAgentId || message.toAgentId === agentId)).length;
  }

  function openHandoffCount(agentId: string) {
    return handoffs.filter((handoff) => handoff.toAgentId === agentId).length;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-semibold">Agents</h2>
          <p className="text-sm text-muted-foreground">
            Launch, recover, and review agents here. Humans stay in the UI; agents still use the canonical AiBridge CLI/runtime.
          </p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-foreground">Agent Launch Center</h3>
            <p className="text-sm text-muted-foreground">
              Choose an agent and tool, then copy exactly what to paste into the agent tool. Mark the session as started after you send it.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_170px]">
            <label className="space-y-2 text-sm text-muted-foreground">
              <span className="block">Agent</span>
              <select
                value={launchAgentId}
                onChange={(event) => setLaunchAgentId(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-muted-foreground">
              <span className="block">Tool</span>
              <select
                value={launchTool}
                onChange={(event) => setLaunchTool(event.target.value as AibridgeAgentToolKind)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="cursor">Cursor</option>
                <option value="codex">Codex</option>
                <option value="antigravity">Antigravity</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button className="w-full gap-2" onClick={() => void handleLaunch()} disabled={launching || !launchAgentId}>
                <Play className="w-4 h-4" />
                {launching ? "Generating..." : "Generate launch prompt"}
              </Button>
            </div>
          </div>
          {activePromptSession ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    What to paste into {TOOL_LABELS[activePromptSession.toolKind]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Session {activePromptSession.id} · {activePromptSession.agentId}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => void copyText("launch", activePromptSession.instructions.prompt)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedText === "launch" ? "Copied" : "Copy prompt"}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={async () => {
                      const started = await onStartSession(activePromptSession.id);
                      setActivePromptSession(started);
                    }}
                  >
                    <Play className="w-3.5 h-3.5" />
                    Mark as started
                  </Button>
                </div>
              </div>
              <textarea
                readOnly
                value={activePromptSession.instructions.prompt}
                className="min-h-52 w-full rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-foreground">Launch History</h3>
            <p className="text-sm text-muted-foreground">Recent prompt generations and acknowledgements across all agents.</p>
          </div>
          {latestLaunches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No launch sessions yet.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {latestLaunches.map((session) => (
                <div key={session.id} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[10px] border ${STATUS_TONES[session.status]}`}>{session.status}</Badge>
                    <Badge variant="outline" className="text-[10px] uppercase">{TOOL_LABELS[session.toolKind]}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(session.launchedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-2">{session.agentId}</p>
                  <p className="text-xs text-muted-foreground">{session.id}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <motion.div
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {agents.map((agent) => {
          const color = getAgentColor(agent.kind);
          return (
            <motion.div key={agent.id} variants={item}>
              <Card className="bg-card border-border card-hover cursor-pointer" onClick={() => setSelectedAgent(agent)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                    <Bot className={`w-4 h-4 ${color.text}`} />
                    <span className="font-display text-sm font-semibold text-foreground">{agent.name}</span>
                    <Badge className={`text-[10px] ml-auto border ${color.bg} ${color.text} ${color.border}`}>{agent.kind}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{agent.configPath}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {unreadMessageCount(agent.id)} unread
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {openHandoffCount(agent.id)} handoffs
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-display text-sm font-bold text-foreground">Session Reliability</h3>
          <p className="text-sm text-muted-foreground">
            Sessions become stale when the agent never acknowledges the latest context or stops making progress.
          </p>
        </div>
        {sessions.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-sm text-muted-foreground">
              No launch sessions yet. Generate a launch prompt above to start tracking an agent session.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessionGroups.map(({ agent, sessions: agentSessions }) => {
              if (agentSessions.length === 0) {
                return null;
              }

              const color = getAgentColor(agent.kind);
              return (
                <Card key={agent.id} className="bg-card border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] border ${color.bg} ${color.text} ${color.border}`}>{agent.name}</Badge>
                      <p className="text-sm text-muted-foreground">
                        {agentSessions.length} tracked {agentSessions.length === 1 ? "session" : "sessions"}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {agentSessions.map((session) => {
                        const taskIds = session.currentTaskIds ?? [];
                        const unreadCount = unreadMessageCount(agent.id);
                        const handoffCount = openHandoffCount(agent.id);

                        return (
                          <div key={session.id} className="rounded-lg border border-border bg-background/60 p-3 space-y-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={`text-[10px] border ${STATUS_TONES[session.status]}`}>{session.status}</Badge>
                                  <Badge variant="outline" className="text-[10px] uppercase">{TOOL_LABELS[session.toolKind]}</Badge>
                                  <Badge variant="outline" className="text-[10px] uppercase">{session.launchSource}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    launched {formatDistanceToNow(new Date(session.launchedAt), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground font-mono">{session.id}</p>
                                {session.recovery?.reason ? (
                                  <p className="text-sm text-amber-200">{session.recovery.reason}</p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={async () => {
                                    const started = await onStartSession(session.id);
                                    setActivePromptSession(started);
                                  }}
                                >
                                  <Play className="w-3.5 h-3.5" /> Mark started
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => void onHeartbeatSession(session.id)}>
                                  <RefreshCw className="w-3.5 h-3.5" /> Heartbeat
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => void onStopSession(session.id)}>
                                  <Square className="w-3.5 h-3.5" /> Stop
                                </Button>
                                {session.recovery?.prompt ? (
                                  <>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="gap-1.5 text-xs"
                                      onClick={async () => {
                                        const refreshed = await onRecoverSession(session.id);
                                        setActivePromptSession(refreshed);
                                        if (refreshed.recovery?.prompt) {
                                          await copyText(`recovery-${session.id}`, refreshed.recovery.prompt);
                                        }
                                      }}
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      {copiedText === `recovery-${session.id}` ? "Copied" : "Copy recovery prompt"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1.5 text-xs"
                                      onClick={async () => {
                                        const refreshed = await onRecoverSession(session.id);
                                        setActivePromptSession(refreshed);
                                        const restarted = await onStartSession(session.id);
                                        setActivePromptSession(restarted);
                                      }}
                                    >
                                      <Play className="w-3.5 h-3.5" /> Mark restarted
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-3 text-sm text-muted-foreground">
                              <div>
                                <p className="font-medium text-foreground">First steps</p>
                                <ul className="mt-1 space-y-1">
                                  {session.instructions.firstSteps.map((step) => (
                                    <li key={step}>- {step}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">Current workload</p>
                                <ul className="mt-1 space-y-1">
                                  <li>{taskIds.length} current task IDs</li>
                                  <li>{unreadCount} unread messages</li>
                                  <li>{handoffCount} open handoffs</li>
                                </ul>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">Task IDs</p>
                                {taskIds.length > 0 ? (
                                  <ul className="mt-1 space-y-1">
                                    {taskIds.map((taskId) => (
                                      <li key={taskId}>{taskId}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1">No assigned in-flight tasks.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-sm font-bold text-foreground mb-3">Handoff Timeline</h3>
        <div className="relative space-y-0">
          <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
          {handoffs.map((handoff) => {
            const from = agents.find((agent) => agent.id === handoff.fromAgentId);
            const to = agents.find((agent) => agent.id === handoff.toAgentId);
            const fromColor = from ? getAgentColor(from.kind) : null;
            const toColor = to ? getAgentColor(to.kind) : null;
            return (
              <div key={handoff.id} className="relative flex items-start gap-4 py-3">
                <div className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shrink-0 z-10">
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0 pt-1">
                  <div className="flex items-center gap-1.5 text-xs mb-0.5 flex-wrap">
                    <Badge className={`text-[10px] font-display border ${fromColor?.bg} ${fromColor?.text} ${fromColor?.border}`}>{from?.name}</Badge>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <Badge className={`text-[10px] font-display border ${toColor?.bg} ${toColor?.text} ${toColor?.border}`}>{to?.name}</Badge>
                    <span className="text-muted-foreground ml-2">{formatDistanceToNow(new Date(handoff.timestamp), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-foreground/80">{handoff.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AgentDetailPanel
        agent={selectedAgent}
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        logs={logs}
        tasks={tasks}
      />
    </div>
  );
}

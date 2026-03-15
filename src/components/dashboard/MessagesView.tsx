import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AibridgeMessage, AibridgeAgent } from "@/lib/aibridge/types";
import { getAgentColor } from "@/lib/aibridge/agent-colors";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Info, ArrowRight, MessageSquare, Check } from "lucide-react";

interface MessagesViewProps {
  messages: AibridgeMessage[];
  agents: AibridgeAgent[];
  onAcknowledge?: (messageId: string) => void;
  onCreateMessage?: (payload: {
    fromAgentId: string;
    toAgentId?: string;
    severity?: AibridgeMessage["severity"];
    content: string;
  }) => Promise<unknown>;
}

const severityConfig = {
  info: { icon: Info, class: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  warning: { icon: AlertTriangle, class: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  critical: { icon: AlertCircle, class: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function MessagesView({ messages, agents, onAcknowledge, onCreateMessage }: MessagesViewProps) {
  const [agentFilter, setAgentFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [fromAgentId, setFromAgentId] = useState(agents[0]?.id ?? "");
  const [toAgentId, setToAgentId] = useState("broadcast");
  const [composeSeverity, setComposeSeverity] = useState<AibridgeMessage["severity"]>("info");
  const [draft, setDraft] = useState("");

  const filtered = useMemo(() => {
    return messages.filter(m => {
      if (agentFilter !== "all" && m.fromAgentId !== agentFilter) return false;
      if (severityFilter !== "all" && m.severity !== severityFilter) return false;
      return true;
    });
  }, [messages, agentFilter, severityFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" /> Messages
        </h2>
        <div className="flex gap-2">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-28 sm:w-36 h-8 text-xs"><SelectValue placeholder="All agents" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-28 sm:w-32 h-8 text-xs"><SelectValue placeholder="All levels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {onCreateMessage ? (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[140px_140px_120px_minmax(0,1fr)_auto]">
              <Select value={fromAgentId} onValueChange={setFromAgentId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="From" /></SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={toAgentId} onValueChange={setToAgentId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="To" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="broadcast">Broadcast</SelectItem>
                  {agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={composeSeverity} onValueChange={(value) => setComposeSeverity(value as AibridgeMessage["severity"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Send a coordination note without using the terminal." className="h-9 text-sm" />
              <Button
                className="h-9"
                disabled={!fromAgentId || !draft.trim()}
                onClick={() => {
                  const content = draft.trim();
                  if (!content) return;
                  void onCreateMessage({
                    fromAgentId,
                    toAgentId: toAgentId === "broadcast" ? undefined : toAgentId,
                    severity: composeSeverity,
                    content,
                  });
                  setDraft("");
                }}
              >
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <motion.div
        className="space-y-2"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      >
        {filtered.map(msg => {
          const from = agents.find(a => a.id === msg.fromAgentId);
          const to = msg.toAgentId ? agents.find(a => a.id === msg.toAgentId) : null;
          const sev = severityConfig[msg.severity];
          const SevIcon = sev.icon;
          const fromColor = from ? getAgentColor(from.kind) : null;

          return (
            <motion.div key={msg.id} variants={item}>
              <Card className={`bg-card border-border card-hover ${!msg.acknowledged ? "border-l-2 border-l-primary" : ""}`}>
                <CardContent className="p-3 sm:p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {from && (
                      <Badge className={`text-[10px] font-display border ${fromColor?.bg} ${fromColor?.text} ${fromColor?.border}`}>
                        {from.name}
                      </Badge>
                    )}
                    {to && (
                      <>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <Badge variant="secondary" className="text-[10px] font-display">{to.name}</Badge>
                      </>
                    )}
                    {!to && <span className="text-[10px] text-muted-foreground italic">broadcast</span>}
                    <Badge className={`text-[10px] px-1.5 py-0 border ${sev.bg} ml-auto`}>
                      <SevIcon className={`w-3 h-3 mr-1 ${sev.class}`} />
                      {msg.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/90 break-words">{msg.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                    </span>
                    {!msg.acknowledged ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-primary font-display gap-1 px-2"
                        onClick={() => onAcknowledge?.(msg.id)}
                      >
                        <Check className="w-3 h-3" /> Acknowledge
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">✓ read</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No messages matching filters.</p>
        )}
      </motion.div>
    </div>
  );
}

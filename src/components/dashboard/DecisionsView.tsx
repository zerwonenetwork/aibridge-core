import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AibridgeAgent, AibridgeDecision } from "@/lib/aibridge/types";
import { formatDistanceToNow } from "date-fns";
import { Scale, Copy, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { decisionsToMarkdown, toJSON, copyToClipboard } from "@/lib/aibridge/export";

interface DecisionsViewProps {
  decisions: AibridgeDecision[];
  agents: AibridgeAgent[];
  onCreateDecision?: (payload: {
    title: string;
    summary: string;
    status?: AibridgeDecision["status"];
    agentId?: string;
  }) => Promise<unknown>;
  onUpdateDecision?: (decisionId: string, payload: { status: NonNullable<AibridgeDecision["status"]>; agentId?: string }) => Promise<unknown>;
}

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export function DecisionsView({ decisions, agents, onCreateDecision, onUpdateDecision }: DecisionsViewProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<NonNullable<AibridgeDecision["status"]>>("accepted");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "none");

  const handleCopy = async (format: "json" | "md") => {
    const text = format === "json" ? toJSON(decisions) : decisionsToMarkdown(decisions);
    const ok = await copyToClipboard(text);
    toast({ title: ok ? "Copied!" : "Failed to copy", description: ok ? `Decisions copied as ${format === "json" ? "JSON" : "Markdown"}` : "Clipboard not available" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="space-y-1 flex-1">
          <h2 className="text-xl font-display font-semibold">Decisions</h2>
          <p className="text-sm text-muted-foreground">
            Record or update decisions from the dashboard when agents or humans settle a review or architecture choice.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleCopy("json")}>
            <Copy className="w-3.5 h-3.5" /> JSON
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleCopy("md")}>
            <FileText className="w-3.5 h-3.5" /> Markdown
          </Button>
        </div>
      </div>
      {onCreateDecision ? (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_140px_160px_auto]">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Decision title" className="h-9 text-sm" />
              <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Short summary of what changed and why." className="h-9 text-sm" />
              <Select value={status} onValueChange={(value) => setStatus(value as NonNullable<AibridgeDecision["status"]>)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="superseded">Superseded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Recorded by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No agent</SelectItem>
                  {agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                className="h-9"
                disabled={!title.trim() || !summary.trim()}
                onClick={() => {
                  const nextTitle = title.trim();
                  const nextSummary = summary.trim();
                  if (!nextTitle || !nextSummary) return;
                  void onCreateDecision({
                    title: nextTitle,
                    summary: nextSummary,
                    status,
                    agentId: agentId === "none" ? undefined : agentId,
                  });
                  setTitle("");
                  setSummary("");
                }}
              >
                Record
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <motion.div
        className="space-y-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {decisions.map(d => (
          <motion.div key={d.id} variants={item}>
            <Card className="bg-card border-border card-hover">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Scale className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{d.title}</h3>
                      {d.status ? <span className="text-[10px] uppercase rounded border border-border px-1.5 py-0.5 text-muted-foreground">{d.status}</span> : null}
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatDistanceToNow(new Date(d.timestamp), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-foreground/70">{d.summary}</p>
                    {onUpdateDecision ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(["proposed", "accepted", "superseded"] as const).map((nextStatus) => (
                          <Button
                            key={nextStatus}
                            variant={d.status === nextStatus ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => void onUpdateDecision(d.id, { status: nextStatus, agentId: agentId === "none" ? undefined : agentId })}
                          >
                            Mark {nextStatus}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AibridgeDecision } from "@/lib/aibridge/types";
import { formatDistanceToNow } from "date-fns";
import { Scale, Copy, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { decisionsToMarkdown, toJSON, copyToClipboard } from "@/lib/aibridge/export";

interface DecisionsViewProps {
  decisions: AibridgeDecision[];
}

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export function DecisionsView({ decisions }: DecisionsViewProps) {
  const { toast } = useToast();

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
            Architecture decisions from your local bridge • View only
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
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatDistanceToNow(new Date(d.timestamp), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-foreground/70">{d.summary}</p>
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

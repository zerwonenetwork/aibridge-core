import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AibridgeConvention } from "@/lib/aibridge/types";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { conventionsToMarkdown, toJSON, copyToClipboard } from "@/lib/aibridge/export";

interface ConventionsViewProps {
  conventions: AibridgeConvention[];
}

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export function ConventionsView({ conventions }: ConventionsViewProps) {
  const { toast } = useToast();

  const handleCopy = async (format: "json" | "md") => {
    const text = format === "json" ? toJSON(conventions) : conventionsToMarkdown(conventions);
    const ok = await copyToClipboard(text);
    toast({ title: ok ? "Copied!" : "Failed to copy", description: ok ? `Conventions copied as ${format === "json" ? "JSON" : "Markdown"}` : "Clipboard not available" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="space-y-1 flex-1">
          <h2 className="text-xl font-display font-semibold">Conventions</h2>
          <p className="text-sm text-muted-foreground">
            Development standards from your local bridge • View only
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
        className="space-y-2"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      >
        {conventions.map((c, i) => (
          <motion.div key={c.id} variants={item}>
            <Card className="bg-card border-border card-hover">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-display font-bold text-primary">{i + 1}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{c.rule}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Added {formatDistanceToNow(new Date(c.addedAt), { addSuffix: true })}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

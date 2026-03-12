import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

interface FileTreeLine {
  indent: number;
  text: string;
  color: string;
  note?: string;
  highlight?: boolean;
}

const lines = [
  { indent: 0, text: "Your Project/", color: "text-foreground font-bold" },
  { indent: 1, text: "├── src/", color: "text-muted-foreground" },
  { indent: 1, text: "├── .cursorrules", color: "text-muted-foreground", note: "← AiBridge protocol injected" },
  { indent: 1, text: "├── CLAUDE.md", color: "text-muted-foreground", note: "← AiBridge protocol injected" },
  { indent: 1, text: "├── AGENTS.md", color: "text-muted-foreground", note: "← AiBridge protocol injected" },
  { indent: 1, text: "├── .aibridge/", color: "text-primary font-bold", note: "← THE BRIDGE", highlight: true },
  { indent: 2, text: "├── CONTEXT.md", color: "text-primary/80", note: "Auto-generated state (agents read FIRST)" },
  { indent: 2, text: "├── CONVENTIONS.md", color: "text-primary/80", note: "Shared rules all agents follow" },
  { indent: 2, text: "├── HANDOFFS.md", color: "text-primary/80", note: "Agent-to-agent work transfers" },
  { indent: 2, text: "├── bridge.json", color: "text-primary/80", note: "Config" },
  { indent: 2, text: "├── agents/", color: "text-primary/60", note: "Per-agent instruction files" },
  { indent: 2, text: "├── tasks/", color: "text-primary/60", note: "Shared task board" },
  { indent: 2, text: "├── handoffs/", color: "text-primary/60", note: "Structured handoff data" },
  { indent: 2, text: "├── decisions/", color: "text-primary/60", note: "Architecture Decision Records" },
  { indent: 2, text: "├── messages/", color: "text-primary/60", note: "Agent-to-agent messages" },
  { indent: 2, text: "└── logs/", color: "text-primary/60", note: "Per-agent activity logs (JSONL)" },
] satisfies FileTreeLine[];

const FileStructure = () => {
  const { ref, isInView } = useScrollReveal();

  return (
    <section ref={ref} className="relative py-28 px-6">
      <div className="absolute inset-0 bg-grid-dense opacity-20" />

      <div className="relative container max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Project <span className="text-gradient">Structure</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg">
            Files are the universal interface. Every AI tool can read and write them.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="rounded-xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden shadow-2xl shadow-primary/5"
        >
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60 bg-card/80">
            <div className="h-3 w-3 rounded-full bg-destructive/50" />
            <div className="h-3 w-3 rounded-full bg-primary/30" />
            <div className="h-3 w-3 rounded-full bg-primary/50" />
            <span className="ml-3 text-xs text-muted-foreground/60 font-display">project structure</span>
          </div>
          <div className="p-6 font-display text-sm leading-loose">
            {lines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.04 }}
                style={{ paddingLeft: `${line.indent * 24}px` }}
                className={`flex items-center gap-3 rounded-md py-0.5 px-2 -mx-2 ${line.highlight ? "bg-primary/5" : ""}`}
              >
                <span className={line.color}>{line.text}</span>
                {line.note && (
                  <span className="text-muted-foreground/40 text-xs hidden sm:inline">{line.note}</span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FileStructure;

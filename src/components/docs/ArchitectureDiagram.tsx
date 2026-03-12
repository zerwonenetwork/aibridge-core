import { motion } from "framer-motion";
import { FileJson, Terminal, Server, LayoutDashboard, ArrowDown, ArrowRight } from "lucide-react";

interface ArchitectureDiagramProps {
  onNavigate?: (sectionId: string) => void;
}

const layers = [
  {
    id: "protocol",
    label: "Protocol",
    desc: "JSON & Markdown file formats",
    location: ".aibridge/ in your repo",
    icon: FileJson,
    accent: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
    docSection: "bridge-json",
  },
  {
    id: "cli",
    label: "CLI",
    desc: "Read/write tasks, logs, handoffs",
    location: "npx aibridge",
    icon: Terminal,
    accent: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/30",
    iconColor: "text-blue-400",
    dotColor: "bg-blue-400",
    docSection: "cli-init",
  },
  {
    id: "runtime",
    label: "Runtime",
    desc: "Local HTTP API for bridge data",
    location: "aibridge-local-service",
    icon: Server,
    accent: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/30",
    iconColor: "text-violet-400",
    dotColor: "bg-violet-400",
    docSection: "dashboard-overview",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    desc: "Visual overview of agent activity",
    location: "Browser UI",
    icon: LayoutDashboard,
    accent: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/30",
    iconColor: "text-amber-400",
    dotColor: "bg-amber-400",
    docSection: "dashboard-overview",
  },
];

const stagger = { show: { transition: { staggerChildren: 0.1 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function ArchitectureDiagram({ onNavigate }: ArchitectureDiagramProps) {
  const handleClick = (sectionId: string) => {
    onNavigate?.(sectionId);
  };

  return (
    <div className="my-8">
      {/* Desktop: horizontal flow */}
      <motion.div
        className="hidden md:flex items-stretch gap-3"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={stagger}
      >
        {layers.map((layer, i) => {
          const Icon = layer.icon;
          return (
            <div key={layer.id} className="flex items-stretch flex-1 min-w-0">
              <motion.button
                variants={fadeUp}
                onClick={() => handleClick(layer.docSection)}
                className={`flex-1 rounded-xl border ${layer.border} bg-gradient-to-b ${layer.accent} p-4 relative group hover:scale-[1.02] transition-transform cursor-pointer text-left`}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-lg bg-background/60 border border-border/50">
                    <Icon className={`w-4.5 h-4.5 ${layer.iconColor}`} />
                  </div>
                  <span className="font-display font-bold text-sm text-foreground">{layer.label}</span>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed mb-2">{layer.desc}</p>
                <div className="flex items-center gap-1.5 mt-auto">
                  <span className={`w-1.5 h-1.5 rounded-full ${layer.dotColor}`} />
                  <code className="text-[10px] text-muted-foreground font-mono">{layer.location}</code>
                </div>
                <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors font-display">
                  View docs →
                </span>
              </motion.button>
              {i < layers.length - 1 && (
                <div className="flex items-center px-1 text-muted-foreground/40">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Mobile: vertical flow */}
      <motion.div
        className="md:hidden space-y-2"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={stagger}
      >
        {layers.map((layer, i) => {
          const Icon = layer.icon;
          return (
            <div key={layer.id}>
              <motion.button
                variants={fadeUp}
                onClick={() => handleClick(layer.docSection)}
                className={`w-full rounded-xl border ${layer.border} bg-gradient-to-r ${layer.accent} p-4 flex items-center gap-3 cursor-pointer text-left`}
              >
                <div className="p-2 rounded-lg bg-background/60 border border-border/50 shrink-0">
                  <Icon className={`w-4.5 h-4.5 ${layer.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-display font-bold text-sm text-foreground">{layer.label}</span>
                  <p className="text-xs text-foreground/70 mt-0.5">{layer.desc}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${layer.dotColor}`} />
                    <code className="text-[10px] text-muted-foreground font-mono">{layer.location}</code>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </motion.button>
              {i < layers.length - 1 && (
                <div className="flex justify-center py-1 text-muted-foreground/30">
                  <ArrowDown className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Data flow summary */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-6 rounded-lg border border-border bg-muted/20 p-4"
      >
        <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data Flow</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/70">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Agent reads CONTEXT.md</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground/40 hidden sm:block" />
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> CLI captures changes</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground/40 hidden sm:block" />
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Context regenerated</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground/40 hidden sm:block" />
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Next agent picks up</span>
        </div>
      </motion.div>
    </div>
  );
}

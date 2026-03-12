import { Check, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const phases = [
  { label: "Phase 0", title: "Protocol Definition — file format specs, schemas, agent protocol docs", done: true },
  { label: "Phase 1", title: "CLI Tool — initialize, manage tasks, log activity, generate context", done: true },
  { label: "Phase 2", title: "Auto-Capture — git hooks, file watcher, agent self-logging", done: true },
  { label: "Phase 3", title: "Local Service — HTTP service for dashboard communication", done: true },
  { label: "Phase 4", title: "Web Dashboard — activity feed, task board, agents, conventions, decisions", done: true },
  { label: "Phase 5", title: "Cloud Sync — multi-device sync, conflict resolution, encryption", done: false },
  { label: "Phase 6", title: "Team Features — multi-developer, shared projects, role-based access", done: false },
  { label: "Phase 7", title: "Mobile + Desktop + VS Code — same data, every surface", done: false },
  { label: "Phase 8", title: "Advanced — skills marketplace, analytics, MCP server, auto-resolution", done: false },
];

const principles = [
  {
    title: "Files are the universal interface.",
    desc: "Every AI coding tool can read and write files. The filesystem is the only integration point that works across all agents. No plugins needed, no special integration.",
  },
  {
    title: "Humans orchestrate, agents execute.",
    desc: "The developer decides which agent does what. AiBridge provides the structure; you provide the strategy.",
  },
  {
    title: "Local-first, always.",
    desc: "Your data lives in your project directory. No accounts required for Local V1. Everything works offline, on your machine.",
  },
  {
    title: "Convention over configuration.",
    desc: "Simple markdown files beat complex databases. Any agent can understand a .md file without special tooling.",
  },
];

const RoadmapAndPhilosophy = () => {
  const { ref: roadmapRef, isInView: roadmapInView } = useScrollReveal();
  const { ref: philRef, isInView: philInView } = useScrollReveal();

  return (
    <section className="relative py-28 px-6">
      <div className="absolute inset-0 bg-grid opacity-15" />

      <div className="relative container max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16">
          {/* Roadmap */}
          <div ref={roadmapRef}>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={roadmapInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="font-display text-3xl md:text-4xl font-extrabold mb-10 tracking-tight"
            >
              Build <span className="text-gradient">Phases</span>
            </motion.h2>

            <div className="space-y-1">
              {phases.map((phase, i) => (
                <motion.div
                  key={phase.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={roadmapInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className={`flex items-start gap-4 py-3 px-4 rounded-lg -mx-4 transition-colors ${
                    phase.done ? 'bg-primary/[0.03]' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {phase.done ? (
                      <div className="p-0.5 rounded bg-primary/15">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/25" />
                    )}
                  </div>
                  <div>
                    <span className="font-display text-[10px] text-primary/60 tracking-[0.15em] uppercase mr-2">{phase.label}</span>
                    <span className={`text-sm leading-relaxed ${phase.done ? "text-foreground" : "text-muted-foreground/70"}`}>
                      {phase.title}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Philosophy */}
          <div ref={philRef}>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={philInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="font-display text-3xl md:text-4xl font-extrabold mb-10 tracking-tight"
            >
              <span className="text-gradient">Philosophy</span>
            </motion.h2>

            <div className="space-y-6">
              {principles.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={philInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                  className="relative pl-6 border-l-2 border-primary/20 hover:border-primary/50 transition-colors"
                >
                  <h3 className="text-foreground font-semibold text-sm mb-2 tracking-tight">{p.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Positioning */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={philInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 rounded-xl border border-primary/15 bg-primary/[0.04] backdrop-blur-sm p-7"
            >
              <p className="font-display text-xs text-primary/70 font-bold mb-2 uppercase tracking-[0.15em]">Positioning</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The Git of AI agent coordination — the way Git became the standard for version control, AiBridge aims to become the standard coordination layer for multi-agent development.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoadmapAndPhilosophy;

import { AlertTriangle, Zap, Eye, FileWarning, ArrowLeftRight, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const painPoints = [
  {
    icon: Eye,
    title: "Agents are blind to each other",
    desc: "Cursor doesn't know Claude Code just refactored the auth module. Codex rewrites code that Antigravity already fixed.",
  },
  {
    icon: FileWarning,
    title: "Rules drift across tools",
    desc: "Each tool reads a different config file. Developers maintain the same rules in multiple places. They drift apart within days.",
  },
  {
    icon: ArrowLeftRight,
    title: "No structured handoffs",
    desc: "When one agent finishes a feature and another should write the tests, there's no structured way to pass context.",
  },
  {
    icon: MessageSquare,
    title: "Agents cannot communicate",
    desc: "If Codex is refactoring the database layer, there's no way to tell Cursor \"don't touch those files.\"",
  },
];

const features = [
  "Shared Context — every agent reads the same auto-generated project state",
  "Unified Conventions — write a rule once, applied to all agent configs",
  "Activity Logging — every agent's actions captured automatically via git hooks and file watcher",
  "Agent Messaging — agents leave structured messages for each other",
  "Task Board — shared tasks assigned to specific agents, tracked locally",
  "Local Dashboard — a web interface to visualize coordination state",
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const ProblemSolution = () => {
  const { ref: problemRef, isInView: problemInView } = useScrollReveal();
  const { ref: solutionRef, isInView: solutionInView } = useScrollReveal();

  return (
    <section className="relative py-28 px-6">
      <div className="absolute inset-0 gradient-radial-bottom opacity-50" />

      <div className="relative container max-w-5xl mx-auto">
        {/* Problem */}
        <div ref={problemRef} className="mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={problemInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-destructive/90">The Problem</h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={problemInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground max-w-3xl mb-12 leading-relaxed text-lg"
          >
            Developers increasingly use 2–4 AI coding agents simultaneously on the same project. Each tool has strengths — but these tools have{" "}
            <span className="text-foreground font-semibold">zero awareness of each other</span>.
          </motion.p>

          <motion.div
            variants={container}
            initial="hidden"
            animate={problemInView ? "show" : "hidden"}
            className="grid sm:grid-cols-2 gap-4"
          >
            {painPoints.map((p) => (
              <motion.div
                key={p.title}
                variants={item}
                className="rounded-xl border border-destructive/10 bg-card/40 backdrop-blur-sm p-6 card-hover group"
              >
                <div className="mb-4 p-2 rounded-lg bg-destructive/5 w-fit border border-destructive/10 group-hover:bg-destructive/10 transition-colors">
                  <p.icon className="h-4 w-4 text-destructive/70" />
                </div>
                <h3 className="font-display text-sm font-bold text-foreground mb-2 tracking-tight">{p.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center mb-24">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="mx-4 h-2 w-2 rounded-full bg-primary/30" />
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>

        {/* Solution */}
        <div ref={solutionRef}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={solutionInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-gradient">The Solution</h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={solutionInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground max-w-3xl mb-12 leading-relaxed text-lg"
          >
            AiBridge is the local-first coordination layer for multi-agent AI development — a{" "}
            <span className="text-foreground font-semibold">shared context directory</span> that connects all your AI coding agents through a single <code className="text-primary/70 bg-primary/5 px-1 rounded">.aibridge</code> folder in your project.
          </motion.p>

          <motion.div
            variants={container}
            initial="hidden"
            animate={solutionInView ? "show" : "hidden"}
            className="grid sm:grid-cols-2 gap-3"
          >
            {features.map((f) => (
              <motion.div
                key={f}
                variants={item}
                className="flex items-start gap-3 rounded-xl border border-primary/10 bg-card/40 backdrop-blur-sm px-5 py-4 card-hover"
              >
                <span className="text-primary mt-0.5 font-bold">✓</span>
                <span className="text-sm text-muted-foreground leading-relaxed">{f}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSolution;

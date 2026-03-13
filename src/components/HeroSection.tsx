import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import aibridgeLogo from "@/assets/logo.png";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 gradient-radial" />
      <div className="absolute inset-0 gradient-diagonal" />
      <div className="absolute inset-0 noise-overlay" />

      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl animate-float" />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-primary/3 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 container max-w-5xl text-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 border border-primary/20 rounded-full px-5 py-2 mb-10 bg-secondary/40 backdrop-blur-md"
        >
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="font-display text-xs text-muted-foreground tracking-wider uppercase">Open-Core — Local-First</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <img src={aibridgeLogo} alt="AiBridge — local-first AI agent coordination tool" className="h-20 w-20 animate-float" />
            <div className="absolute -inset-6 rounded-full bg-primary/8 blur-2xl" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="font-display text-6xl md:text-8xl font-extrabold tracking-tighter mb-6"
        >
          <span className="text-foreground">Ai</span>
          <span className="text-gradient">Bridge</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-5 font-light tracking-tight"
        >
          The local-first coordination layer for multi-agent AI development.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-base text-muted-foreground/60 max-w-xl mx-auto mb-4"
        >
          A shared context directory that connects all your AI coding agents — shared state, task tracking, conventions, and handoffs from a single <code className="text-primary/70 bg-primary/5 px-1 rounded">.aibridge</code> folder.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-sm text-muted-foreground/40 max-w-lg mx-auto mb-12 font-display tracking-wide"
        >
          Cursor · Claude Code · Codex · Antigravity · Copilot · Windsurf
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
        >
          <Button variant="hero" size="lg" className="gap-2 text-base px-8 py-6" asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="h-5 w-5" />
              Open Local Dashboard
            </Link>
          </Button>
          <Button variant="hero-outline" size="lg" className="gap-2 text-base px-8 py-6" asChild>
            <Link to="/docs">
              Read the Docs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="max-w-2xl mx-auto"
        >
          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden text-left shadow-2xl shadow-primary/5">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60 bg-card/80">
              <div className="h-3 w-3 rounded-full bg-destructive/50" />
              <div className="h-3 w-3 rounded-full bg-primary/30" />
              <div className="h-3 w-3 rounded-full bg-primary/50" />
              <span className="ml-3 text-xs text-muted-foreground/60 font-display">~/project</span>
            </div>
            <div className="p-6 font-display text-sm leading-relaxed space-y-1.5">
              <p><span className="text-primary">$</span> <span className="text-foreground">npx aibridge init</span></p>
              <p className="text-muted-foreground/70">✓ Created .aibridge/ directory</p>
              <p className="text-muted-foreground/70">✓ Generated CONTEXT.md, CONVENTIONS.md</p>
              <p className="text-muted-foreground/70">✓ Created agent instructions for 6 agents</p>
              <p className="text-primary/70 mt-3 pt-2 border-t border-border/40">→ Bridge ready. Your agents can now coordinate.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;

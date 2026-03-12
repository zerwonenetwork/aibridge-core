import { FolderTree, Radio, Server, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const layers = [
  {
    icon: FolderTree,
    label: "Layer 1",
    title: "The Bridge Directory",
    description: "A .aibridge/ directory inside your project containing shared context, activity logs, task board, conventions, agent messages, and handoff records. All stored as simple files.",
    detail: ".aibridge/",
    number: "01",
  },
  {
    icon: Radio,
    label: "Layer 2",
    title: "The Capture Layer",
    description: "Three mechanisms feed the shared context automatically: Git hooks for commit attribution, agent self-logging via config instructions, and a local file watcher for real-time capture.",
    detail: "Git hooks · Self-logging · File watcher",
    number: "02",
  },
  {
    icon: Server,
    label: "Layer 3",
    title: "The Local Service",
    description: "A lightweight local service watches your .aibridge directory for changes and serves the dashboard. It regenerates context summaries and keeps the dashboard in sync with your project.",
    detail: "Local HTTP service · File watching · Context generation",
    number: "03",
  },
  {
    icon: LayoutDashboard,
    label: "Layer 4",
    title: "The Dashboard",
    description: "The human interface. A web app visualizing the entire coordination state: activity feed, task board, agent messages, conventions, decisions, and handoff timeline.",
    detail: "Web dashboard · Local-first · Real-time updates",
    number: "04",
  },
];

const HowItWorks = () => {
  const { ref, isInView } = useScrollReveal();

  return (
    <section ref={ref} className="relative py-28 px-6" id="how-it-works">
      <div className="absolute inset-0 gradient-diagonal opacity-60" />

      <div className="relative container max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg">
            Four layers, each building on the one below it. Everything runs locally.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {layers.map((layer, i) => (
            <motion.div
              key={layer.title}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              className="group relative rounded-xl border border-border bg-card/40 backdrop-blur-sm p-8 card-hover overflow-hidden"
            >
              <span className="absolute -top-4 -right-2 font-display text-8xl font-extrabold text-primary/[0.04] select-none group-hover:text-primary/[0.08] transition-colors">
                {layer.number}
              </span>

              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/15 group-hover:bg-primary/15 transition-colors">
                    <layer.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-display text-[10px] text-primary/50 uppercase tracking-[0.2em]">{layer.label}</span>
                </div>
                <h3 className="font-display text-lg font-bold mb-3 text-foreground tracking-tight">{layer.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">{layer.description}</p>
                <code className="text-xs font-display text-primary/70 bg-primary/5 px-3 py-2 rounded-lg border border-primary/10 block">
                  {layer.detail}
                </code>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

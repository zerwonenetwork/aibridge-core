import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const agents = [
  { name: "Cursor", config: ".cursorrules / .cursor/rules/", injection: "Appends protocol to existing rules" },
  { name: "Claude Code", config: "CLAUDE.md / .claude/rules/", injection: "Appends protocol to CLAUDE.md" },
  { name: "OpenAI Codex", config: "AGENTS.md", injection: "Generates AGENTS.md with protocol" },
  { name: "Antigravity", config: "Agent config", injection: "Injects through config system" },
  { name: "GitHub Copilot", config: ".github/copilot-instructions.md", injection: "Appends protocol to instructions" },
  { name: "Windsurf", config: ".windsurfrules", injection: "Appends protocol to rules" },
  { name: "Custom", config: "Any", injection: "Use custom agent name" },
];

const commands = [
  { cmd: "aibridge init", desc: "Initialize .aibridge/ in current project" },
  { cmd: "aibridge init --interactive", desc: "Run the guided setup flow in the CLI" },
  { cmd: "aibridge setup plan --template web-app --name Acme", desc: "Preview starter tasks, roles, and conventions" },
  { cmd: "aibridge serve", desc: "Expose the local bridge service used by /dashboard" },
  { cmd: "aibridge status", desc: "Show bridge state summary" },
  { cmd: 'aibridge task add "desc"', desc: "Create a task" },
  { cmd: 'aibridge task add "desc" --assign cursor', desc: "Create & assign to agent" },
  { cmd: "aibridge task done <id>", desc: "Mark a task complete" },
  { cmd: "aibridge task in-progress <id>", desc: "Mark a task in progress" },
  { cmd: "aibridge task assign <id> <agent>", desc: "Reassign an existing task" },
  { cmd: 'aibridge message add "desc" --from cursor --to codex', desc: "Send a structured agent message" },
  { cmd: 'aibridge handoff create codex "desc" --from cursor', desc: "Create an explicit handoff" },
  { cmd: 'aibridge decision add "title" "summary" --from cursor', desc: "Record a decision" },
  { cmd: 'aibridge convention set "rule" --category workflow', desc: "Set a shared convention" },
  { cmd: "aibridge agent launch --agent cursor --tool cursor", desc: "Generate the startup handshake prompt" },
  { cmd: "aibridge agent status", desc: "Show pending, active, stale, and stopped sessions" },
  { cmd: "aibridge agent recover --session <id>", desc: "Print the recovery prompt for a stale agent" },
  { cmd: 'aibridge log add <action> "desc" --from <agent>', desc: "Log activity" },
  { cmd: "aibridge context generate", desc: "Regenerate CONTEXT.md" },
  { cmd: "aibridge capture install-hooks", desc: "Install git hooks for auto-capture" },
  { cmd: "aibridge capture watch --agent cursor", desc: "Watch the workspace for local activity" },
];

const AgentsAndCommands = () => {
  const { ref: agentRef, isInView: agentInView } = useScrollReveal();
  const { ref: cmdRef, isInView: cmdInView } = useScrollReveal();

  return (
    <section className="relative py-28 px-6">
      <div className="absolute inset-0 gradient-radial-bottom opacity-40" />

      <div className="relative container max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16">
          {/* Agents */}
          <div ref={agentRef}>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={agentInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="font-display text-2xl md:text-3xl font-extrabold mb-8 tracking-tight"
            >
              Supported <span className="text-gradient">Agents</span>
            </motion.h2>
            <div className="space-y-3">
              {agents.map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, x: -16 }}
                  animate={agentInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="rounded-xl border border-border bg-card/40 backdrop-blur-sm px-5 py-4 card-hover group"
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="p-1 rounded bg-primary/10">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    </div>
                    <span className="font-semibold text-foreground text-sm">{agent.name}</span>
                  </div>
                  <div className="ml-8">
                    <code className="text-xs font-display text-muted-foreground/70">{agent.config}</code>
                    <p className="text-xs text-muted-foreground/40 mt-0.5">{agent.injection}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Commands */}
          <div ref={cmdRef}>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={cmdInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="font-display text-2xl md:text-3xl font-extrabold mb-8 tracking-tight"
            >
              <span className="text-gradient">Commands</span>
            </motion.h2>
            <div className="space-y-2">
              {commands.map((c, i) => (
                <motion.div
                  key={c.cmd}
                  initial={{ opacity: 0, x: 16 }}
                  animate={cmdInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                  className="rounded-xl border border-border bg-card/40 backdrop-blur-sm px-5 py-3 card-hover group"
                >
                  <code className="text-sm font-display text-primary/90 block mb-1 group-hover:text-primary transition-colors">{c.cmd}</code>
                  <span className="text-xs text-muted-foreground/60">{c.desc}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AgentsAndCommands;

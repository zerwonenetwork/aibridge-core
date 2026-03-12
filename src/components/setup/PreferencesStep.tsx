import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { SetupAgentMode, SetupPriority, SetupQuestionnaire, SetupTemplate } from "@/lib/aibridge/setup/types";
import { Zap, Shield, DollarSign, Star, Users, User } from "lucide-react";

const priorityMeta: Record<SetupPriority, { label: string; icon: React.ElementType; description: string }> = {
  speed: { label: "Speed", icon: Zap, description: "Ship the first slice fast" },
  quality: { label: "Quality", icon: Star, description: "High-quality, well-tested" },
  security: { label: "Security", icon: Shield, description: "Security-first approach" },
  cost: { label: "Cost", icon: DollarSign, description: "Minimize runtime cost" },
};

const agentModeMeta: Record<SetupAgentMode, { label: string; icon: React.ElementType; description: string }> = {
  "single-agent": { label: "Single agent", icon: User, description: "One agent handles the project end to end" },
  "multi-agent": { label: "Multi-agent", icon: Users, description: "Specialized agents collaborate via handoffs" },
};

interface PreferencesStepProps {
  questionnaire: SetupQuestionnaire;
  template: SetupTemplate | undefined;
  onChange: (patch: Partial<SetupQuestionnaire>) => void;
}

export function PreferencesStep({ questionnaire, template, onChange }: PreferencesStepProps) {
  const togglePriority = (p: SetupPriority) => {
    const current = questionnaire.priorities;
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    onChange({ priorities: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground font-display">Stack & preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Customize priorities, agent mode, and technical preferences.
        </p>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Priorities */}
        <div className="space-y-3">
          <Label>Priorities</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(priorityMeta) as SetupPriority[]).map((p) => {
              const meta = priorityMeta[p];
              const Icon = meta.icon;
              const isActive = questionnaire.priorities.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border-2 p-3 text-left transition-all duration-200",
                    isActive
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Agent mode */}
        <div className="space-y-3">
          <Label>Agent mode</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(agentModeMeta) as SetupAgentMode[]).map((mode) => {
              const meta = agentModeMeta[mode];
              const Icon = meta.icon;
              const isActive = questionnaire.agentMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ agentMode: mode })}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border-2 p-3 text-left transition-all duration-200",
                    isActive
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred stack */}
        <div className="space-y-2">
          <Label htmlFor="preferredStack">Preferred stack</Label>
          <Input
            id="preferredStack"
            placeholder="e.g. react, typescript, supabase"
            value={questionnaire.preferredStack.join(", ")}
            onChange={(e) =>
              onChange({
                preferredStack: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          {template && template.suggestedStacks.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Suggested:</span>
              {template.suggestedStacks.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted"
                  onClick={() => {
                    if (!questionnaire.preferredStack.includes(s)) {
                      onChange({ preferredStack: [...questionnaire.preferredStack, s] });
                    }
                  }}
                >
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Hard constraints */}
        <div className="space-y-2">
          <Label htmlFor="hardConstraints">Hard constraints</Label>
          <Input
            id="hardConstraints"
            placeholder="e.g. must use PostgreSQL, no vendor lock-in"
            value={questionnaire.hardConstraints.join(", ")}
            onChange={(e) =>
              onChange({
                hardConstraints: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <p className="text-xs text-muted-foreground">Comma-separated requirements that must be respected.</p>
        </div>

        {/* Custom instructions */}
        <div className="space-y-2">
          <Label htmlFor="customInstructions">Custom instructions (optional)</Label>
          <Textarea
            id="customInstructions"
            placeholder="Any additional guidance for AI agents working on this project..."
            value={questionnaire.customInstructions ?? ""}
            onChange={(e) => onChange({ customInstructions: e.target.value })}
            className="min-h-[60px] resize-none"
          />
        </div>
      </div>
    </div>
  );
}

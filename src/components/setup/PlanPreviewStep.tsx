import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { GeneratedProjectPlan } from "@/lib/aibridge/setup/types";
import { Bot, CheckSquare, BookOpen, ListChecks, GitBranch, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PlanPreviewStepProps {
  plan: GeneratedProjectPlan | null;
  loading: boolean;
  error: string | null;
}

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-border">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PlanPreviewStep({ plan, loading, error }: PlanPreviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground font-display">Generated plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          AiBridge generated your project's starter structure. Review before creating.
        </p>
      </div>

      {loading && <LoadingSkeleton />}

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {plan && !loading && (
        <div className="space-y-4">
          {/* Brief */}
          <SectionCard icon={ListChecks} title="Project brief">
            <div className="space-y-2 text-sm">
              <p className="text-foreground font-medium">{plan.brief.projectName}</p>
              <p className="text-muted-foreground">{plan.brief.summary}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {plan.brief.preferredStack.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Agent roles */}
          <SectionCard icon={Users} title={`Starter roles (${plan.starterAgentRoles.length})`}>
            <div className="space-y-3">
              {plan.starterAgentRoles.map((role) => (
                <div key={role.key} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.agentKind} · {role.responsibilities.join(", ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Tasks */}
          <SectionCard icon={CheckSquare} title={`Starter tasks (${plan.starterTasks.length})`}>
            <div className="space-y-2">
              {plan.starterTasks.map((task) => (
                <div key={task.key} className="flex items-start gap-2.5 py-1">
                  <Badge
                    variant={task.priority === "high" ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5"
                  >
                    {task.priority}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{task.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Conventions */}
          <SectionCard icon={BookOpen} title={`Conventions (${plan.conventions.length})`}>
            <ul className="space-y-1.5">
              {plan.conventions.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1 shrink-0">·</span>
                  <span className="text-muted-foreground">{c.rule}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Definition of done */}
          <SectionCard icon={ListChecks} title="Definition of done">
            <ul className="space-y-1.5">
              {plan.definitionOfDone.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1 shrink-0">✓</span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Workflow */}
          <SectionCard icon={GitBranch} title="Workflow">
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{plan.workflow.summary}</p>
              <Separator />
              <div className="flex flex-wrap gap-1.5">
                {plan.workflow.milestones.map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

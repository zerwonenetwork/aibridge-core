import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, ArrowRight, Server, FolderCog } from "lucide-react";
import type { SetupResult } from "@/lib/aibridge/setup/types";
import { useNavigate } from "react-router-dom";

export type SetupWizardMode = "local";

interface CreateProjectStepProps {
  mode: SetupWizardMode;
  creating: boolean;
  initializedRootPath: string | null;
  setupResult: SetupResult | null;
  error: string | null;
  onCompleteSetup: () => void;
  projectName: string;
  localWorkspacePath: string;
  onLocalWorkspacePathChange: (value: string) => void;
  localAdminToken: string;
  onLocalAdminTokenChange: (value: string) => void;
  clearExistingData: boolean;
  onClearExistingDataChange: (value: boolean) => void;
  requireWorkspacePath: boolean;
}

function normalizeWorkspacePath(rootPath: string) {
  return rootPath.replace(/[\\/]\.aibridge$/i, "");
}

export function CreateProjectStep({
  creating,
  initializedRootPath,
  setupResult,
  error,
  onCompleteSetup,
  projectName,
  localWorkspacePath,
  onLocalWorkspacePathChange,
  localAdminToken,
  onLocalAdminTokenChange,
  clearExistingData,
  onClearExistingDataChange,
  requireWorkspacePath,
}: CreateProjectStepProps) {
  const navigate = useNavigate();
  const workspaceReady = Boolean(initializedRootPath);

  if (workspaceReady && setupResult) {
    const workspaceRoot = normalizeWorkspacePath(initializedRootPath!);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground font-display">
            Local workspace ready
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your local bridge now contains the generated starter plan, roles, and conventions.
          </p>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 min-w-0">
              <p className="text-sm font-semibold text-foreground">{projectName}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  local bridge initialized
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Local workspace: <span className="font-mono">{workspaceRoot}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Agent roles", value: setupResult.plan.starterAgentRoles.length },
            { label: "Starter tasks", value: setupResult.plan.starterTasks.length },
            { label: "Conventions", value: setupResult.plan.conventions.length },
            { label: "Milestones", value: setupResult.plan.workflow.milestones.length },
          ].map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-foreground font-display">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Next steps</h3>
            <div className="space-y-3">
              <NextStep
                number={1}
                title="Open the local workspace"
                description="Use the dashboard against this bridge root to work through the generated starter tasks."
                action={
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/dashboard")}>
                    <FolderCog className="w-3.5 h-3.5" /> Open /dashboard
                  </Button>
                }
              />
              <NextStep
                number={2}
                title="Start execution"
                description="The initial context, tasks, conventions, and kickoff coordination are already seeded."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground font-display">
          Initialize local bridge
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create a local bridge for {projectName} from the generated setup result.
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>This will:</p>
            <ul className="space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                Scaffold <code className="px-1 rounded bg-muted/60">.aibridge</code> in your local workspace
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                Seed starter tasks, conventions, kickoff messaging, and the initial context file
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="localWorkspacePath" className="text-sm font-medium text-foreground">
                Local workspace path {requireWorkspacePath ? "*" : "(optional)"}
              </Label>
              <Input
                id="localWorkspacePath"
                value={localWorkspacePath}
                onChange={(event) => onLocalWorkspacePathChange(event.target.value)}
                placeholder={
                  requireWorkspacePath
                    ? "D:\\Projects\\my-app"
                    : "Leave blank to use the current local service workspace"
                }
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {requireWorkspacePath
                  ? "Point this at the repo or folder where AiBridge should create the local bridge."
                  : "Use a custom path or leave it blank to initialize the current workspace served by the local service."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="localAdminToken" className="text-sm font-medium text-foreground">
                Local admin token
              </Label>
              <Input
                id="localAdminToken"
                type="password"
                value={localAdminToken}
                onChange={(event) => onLocalAdminTokenChange(event.target.value)}
                placeholder="Optional local admin token"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Needed only if your local service requires an admin token for mutations.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="clearExisting" className="cursor-pointer">
                  Replace existing local bridge state
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remove any existing <code className="px-1 rounded bg-muted/60">.aibridge</code> before setup initialization.
                </p>
              </div>
              <Switch
                id="clearExisting"
                checked={clearExistingData}
                onCheckedChange={onClearExistingDataChange}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>
          )}

          <Button onClick={onCompleteSetup} disabled={creating} className="w-full gap-2" size="lg">
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing bridge...
              </>
            ) : (
              <>
                <Server className="w-4 h-4" />
                Initialize local bridge
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NextStep({
  number,
  title,
  description,
  action,
}: {
  number: number;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

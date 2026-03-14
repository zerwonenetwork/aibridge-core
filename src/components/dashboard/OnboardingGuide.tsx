import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Terminal, FolderOpen, Play, ArrowRight, Copy, Sparkles, HardDrive, PlugZap } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { AibridgeAccessRole, AibridgeLocalSource } from "@/lib/aibridge/types";
import type { LocalBridgeClientError } from "@/lib/aibridge/local/client";
import { SetupWizard } from "@/components/setup/SetupWizard";

interface OnboardingGuideProps {
  error: LocalBridgeClientError | null;
  localSource: AibridgeLocalSource;
  customRoot: string;
  accessRole: AibridgeAccessRole;
  adminToken: string;
  isSample?: boolean;
  onSwitchToSample: () => void;
  onOpenSettings: () => void;
  onUseWorkspace: () => void;
  onUseCustomWorkspace: (workspacePath: string) => void;
  onRetry: () => void;
  onLocalInitialized: (payload: { rootPath: string; workspacePath: string }) => void;
}

const stagger = { show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function CopyCommand({ command }: { command: string }) {
  const { toast } = useToast();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      toast({ title: "Copied!", description: "Command copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-left hover:bg-muted transition-colors group"
    >
      <Terminal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <code className="text-xs font-mono text-foreground flex-1">{command}</code>
      <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

export function OnboardingGuide({
  error,
  localSource,
  customRoot,
  accessRole,
  adminToken,
  isSample,
  onSwitchToSample,
  onOpenSettings,
  onUseWorkspace,
  onUseCustomWorkspace,
  onRetry,
  onLocalInitialized,
}: OnboardingGuideProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [workspacePath, setWorkspacePath] = useState(customRoot);

  if (!error || isSample) return null;

  const isNoBridge = error.code === "NO_BRIDGE_FOUND";
  const isServiceDown = error.code === "SERVICE_UNAVAILABLE";

  if (!isNoBridge && !isServiceDown) return null;

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-xl mx-auto py-8">
      <motion.div variants={item} className="text-center mb-8">
        <h2 className="text-xl font-display font-bold text-foreground mb-2">
          {isNoBridge ? "No bridge found" : "Service not reachable"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {isNoBridge
            ? "AiBridge needs a .aibridge directory in your project to get started. Follow these steps to initialize one."
            : "The local AiBridge service isn't running. Start it to connect the dashboard to your project."}
        </p>
      </motion.div>

      <motion.div variants={stagger} className="space-y-3">
        {isNoBridge && (
          <>
            <motion.div variants={item}>
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">Step 1</Badge>
                    <span className="text-sm font-medium text-foreground">Open or create a workspace</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      onClick={onUseWorkspace}
                      className="rounded-lg border border-border bg-muted/20 p-4 text-left hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Use current workspace</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Point the dashboard at the repo already served by the local service.
                      </p>
                    </button>
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Use custom path</p>
                      </div>
                      <Input
                        value={workspacePath}
                        onChange={(event) => setWorkspacePath(event.target.value)}
                        placeholder="D:\\Projects\\my-app"
                        className="font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1.5"
                        onClick={() => onUseCustomWorkspace(workspacePath.trim())}
                        disabled={!workspacePath.trim()}
                      >
                        Open custom workspace
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => setShowWizard((current) => !current)}>
                      <Sparkles className="w-3.5 h-3.5" />
                      {showWizard ? "Hide guided setup" : "Start guided setup"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenSettings}>
                      <ArrowRight className="w-3.5 h-3.5" />
                      Local settings
                    </Button>
                  </div>
                  <details className="rounded-md border border-border bg-background/60 p-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Advanced CLI fallback</summary>
                    <div className="mt-3 space-y-2">
                      <CopyCommand command='npm exec --package=@zerwonenetwork/aibridge-core -c "aibridge init --interactive"' />
                      <p className="text-xs text-muted-foreground">
                        The guided flow is the primary path. Keep the CLI for advanced users and agent recovery.
                      </p>
                    </div>
                  </details>
                </CardContent>
              </Card>
            </motion.div>

            {showWizard && (
              <motion.div variants={item}>
                <Card className="bg-card border-border">
                  <CardContent className="p-4 sm:p-6">
                    <SetupWizard
                      mode="local"
                      localRequestOptions={{
                        source: localSource,
                        rootPath: localSource === "custom" ? customRoot.trim() || undefined : undefined,
                        accessRole,
                        adminToken: adminToken.trim() || undefined,
                      }}
                      initialWorkspacePath={localSource === "custom" ? customRoot : ""}
                      requireWorkspacePath={localSource === "custom"}
                      onLocalInitialized={(payload) => {
                        onLocalInitialized(payload);
                        setShowWizard(false);
                      }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <motion.div variants={item}>
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">Step 2</Badge>
                    <span className="text-sm font-medium text-foreground">Connect the local service</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200 text-[10px]">
                      <PlugZap className="w-3 h-3 mr-1" /> disconnected
                    </Badge>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
                      <Play className="w-3.5 h-3.5" />
                      Retry connection
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The dashboard reads live bridge data through the local service. Start it if the workspace is not reachable yet.
                  </p>
                  <details className="rounded-md border border-border bg-background/60 p-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Advanced service command</summary>
                    <div className="mt-3">
                      <CopyCommand command='npm exec --package=@zerwonenetwork/aibridge-core -c "aibridge serve"' />
                    </div>
                  </details>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={item}>
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">Step 3</Badge>
                    <span className="text-sm font-medium text-foreground">Refresh the dashboard</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Once the service is running, the dashboard will automatically connect and display your bridge data.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {isServiceDown && (
          <motion.div variants={item}>
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <PlugZap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Connect the local service</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200 text-[10px]">Disconnected</Badge>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
                    <ArrowRight className="w-3.5 h-3.5" />
                    Retry connection
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The dashboard connects to a local HTTP service. Start it from your project root.
                </p>
                <details className="rounded-md border border-border bg-background/60 p-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Advanced service command</summary>
                  <div className="mt-3">
                    <CopyCommand command='npm exec --package=@zerwonenetwork/aibridge-core -c "aibridge serve"' />
                  </div>
                </details>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>

      <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onSwitchToSample}>
          <FolderOpen className="w-3.5 h-3.5" />
          Explore with sample data
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onOpenSettings}>
          <ArrowRight className="w-3.5 h-3.5" />
          Open settings
        </Button>
      </motion.div>
    </motion.div>
  );
}

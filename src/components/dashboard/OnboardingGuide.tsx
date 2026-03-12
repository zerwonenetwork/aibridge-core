import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, FolderOpen, Play, ArrowRight, Copy, Sparkles } from "lucide-react";
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
  onLocalInitialized,
}: OnboardingGuideProps) {
  const [showWizard, setShowWizard] = useState(false);

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
                    <span className="text-sm font-medium text-foreground">Start guided setup or use the CLI</span>
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
                  <CopyCommand command="npx aibridge init --interactive" />
                  <p className="text-xs text-muted-foreground">
                    The guided flow initializes the bridge from the shared setup engine. The CLI remains the fallback.
                  </p>
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
                    <span className="text-sm font-medium text-foreground">Start the local service</span>
                  </div>
                  <CopyCommand command="npx aibridge serve" />
                  <p className="text-xs text-muted-foreground">
                    Starts the local AiBridge service that connects the dashboard to your project data.
                  </p>
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
                  <Play className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Start the local service</span>
                </div>
                <CopyCommand command="npx aibridge serve" />
                <p className="text-xs text-muted-foreground">
                  The dashboard connects to a local HTTP service. Start it from your project root.
                </p>
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

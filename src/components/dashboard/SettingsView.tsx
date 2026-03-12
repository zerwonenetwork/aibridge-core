import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type {
  AibridgeAccessRole,
  AibridgeAccessState,
  AibridgeCaptureStatus,
  AibridgeLocalSource,
  AibridgeRuntimeState,
} from "@/lib/aibridge/types";
import { Settings, Database, RefreshCw, TriangleAlert, Activity } from "lucide-react";
import { HelpTooltip, helpText } from "@/components/dashboard/HelpTooltip";

interface DashboardSettings {
  compactDensity: boolean;
  showNotifications: boolean;
}

const STORAGE_KEY = "aibridge-settings";

function loadSettings(): DashboardSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    return { compactDensity: false, showNotifications: true };
  }
  return { compactDensity: false, showNotifications: true };
}

interface SettingsViewProps {
  localSource: AibridgeLocalSource;
  customRoot: string;
  runtime: AibridgeRuntimeState;
  capture: AibridgeCaptureStatus;
  access: AibridgeAccessState;
  adminToken: string;
  loading: boolean;
  errorMessage?: string;
  issues?: string[];
  onLocalSourceChange: (source: AibridgeLocalSource) => void;
  onCustomRootChange: (value: string) => void;
  onAccessRoleChange: (role: AibridgeAccessRole) => void;
  onAdminTokenChange: (value: string) => void;
  onRefresh: () => void;
}

export function SettingsView({
  localSource,
  customRoot,
  runtime,
  capture,
  access,
  adminToken,
  loading,
  errorMessage,
  issues = [],
  onLocalSourceChange,
  onCustomRootChange,
  onAccessRoleChange,
  onAdminTokenChange,
  onRefresh,
}: SettingsViewProps) {
  const [settings, setSettings] = useState<DashboardSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const toggle = (key: keyof DashboardSettings) =>
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" /> Settings
      </h2>
      {/* Local Source */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <div>
                <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  Local Source
                  <HelpTooltip content={helpText.localSource} />
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">All data stays on your machine.</p>
              </div>
            </div>
            <Select value={localSource} onValueChange={(value) => onLocalSourceChange(value as AibridgeLocalSource)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sample">Sample Bridge (read-only)</SelectItem>
                <SelectItem value="workspace">Workspace .aibridge</SelectItem>
                <SelectItem value="custom">Custom path</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {localSource === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                Custom Bridge Path
                <HelpTooltip content={helpText.customPath} />
              </Label>
              <Input
                value={customRoot}
                onChange={(event) => onCustomRootChange(event.target.value)}
                placeholder="./path/to/project or ../another-project"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Path to directory containing .aibridge folder</p>
            </div>
          )}

          {/* Runtime status */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Database className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    {runtime.sourceLabel}
                    <HelpTooltip content={helpText.serviceStatus} />
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{runtime.rootPath || "(resolved at runtime)"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {loading ? "loading" : errorMessage ? "error" : "ready"}
                </Badge>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={onRefresh}>
                  <RefreshCw className="w-3.5 h-3.5" /> Reload
                </Button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span>{errorMessage}</span>
                  <p className="text-xs mt-1 text-destructive/80">
                    Try running <code className="bg-destructive/10 px-1 rounded font-mono">npx aibridge serve</code> in your project root.
                  </p>
                </div>
              </div>
            )}

            {!errorMessage && issues.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground/80 space-y-1">
                {issues.slice(0, 3).map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Release Center Access</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Admin mode can create and publish releases and announcements. Viewer mode sees published items only.
              </p>
            </div>
            <Select value={access.role} onValueChange={(value) => onAccessRoleChange(value as AibridgeAccessRole)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Admin Token</Label>
            <Input
              type="password"
              value={adminToken}
              onChange={(event) => onAdminTokenChange(event.target.value)}
              placeholder="Optional local admin token"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Current mode: <span className="font-mono">{access.role}</span> · mutations {access.canMutate ? "enabled" : "blocked"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Capture */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                Auto-Capture Status
                <HelpTooltip content={helpText.autoCapture} />
              </p>
              <p className="text-xs text-muted-foreground">Git hooks and file watcher capture local development activity</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={capture.watcher.running ? "secondary" : "outline"} className="text-[10px] gap-1">
              {capture.watcher.running ? "✓ watcher running" : "○ watcher stopped"}
            </Badge>
            {capture.hooksInstalled.length > 0 ? (
              capture.hooksInstalled.map((hook) => (
                <Badge key={hook} variant="outline" className="text-[10px] gap-1">
                  ✓ {hook}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                No hooks installed
              </Badge>
            )}
            {capture.validationWarnings > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-foreground/70">
                {capture.validationWarnings} warnings
              </Badge>
            )}
          </div>

          {!capture.watcher.running && capture.hooksInstalled.length === 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Auto-capture is not active</p>
              <p>Install git hooks and start the watcher to automatically log development activity:</p>
              <code className="block bg-muted/50 px-2 py-1 rounded font-mono text-[11px] mt-1">aibridge capture install-hooks</code>
            </div>
          )}

          {(capture.watcher.running || capture.hooksInstalled.length > 0) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Watched root: <span className="font-mono">{capture.watcher.watchedRoot ?? "not active"}</span></p>
              <p>Last captured: <span className="font-mono">{capture.lastCapturedAt ?? "n/a"}</span></p>
              {capture.watcher.attribution && (
                <p>
                  Attribution:{" "}
                  <span className="font-mono">
                    {capture.watcher.attribution.agentId} via {capture.watcher.attribution.source} ({capture.watcher.attribution.confidence})
                  </span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dashboard Preferences */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-6">
          <p className="text-sm font-medium text-foreground">Dashboard Preferences</p>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground">Compact density</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Reduce card spacing throughout the dashboard</p>
            </div>
            <Switch checked={settings.compactDensity} onCheckedChange={() => toggle("compactDensity")} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground">Notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Show toast alerts for new messages</p>
            </div>
            <Switch checked={settings.showNotifications} onCheckedChange={() => toggle("showNotifications")} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useAibridge } from "@/hooks/useAibridge";
import { useSEOHead } from "@/hooks/useSEOHead";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ContextHeader } from "@/components/dashboard/ContextHeader";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { TaskBoard } from "@/components/dashboard/TaskBoard";
import { AgentsView } from "@/components/dashboard/AgentsView";
import { ConventionsView } from "@/components/dashboard/ConventionsView";
import { DecisionsView } from "@/components/dashboard/DecisionsView";
import { OverviewView } from "@/components/dashboard/OverviewView";
import { MessagesView } from "@/components/dashboard/MessagesView";
import { SettingsView } from "@/components/dashboard/SettingsView";
import { OnboardingGuide } from "@/components/dashboard/OnboardingGuide";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { DatabaseZap, RefreshCw, TriangleAlert } from "lucide-react";

export type DashboardView = "overview" | "tasks" | "activity" | "messages" | "agents" | "conventions" | "decisions" | "settings";

export const LOCAL_DASHBOARD_VIEWS = [
  "overview",
  "tasks",
  "activity",
  "messages",
  "agents",
  "conventions",
  "decisions",
  "settings",
] as const satisfies readonly DashboardView[];

const Dashboard = () => {
  useSEOHead({
    title: "Local Workspace — AiBridge",
    description: "AiBridge local workspace for AI agent coordination.",
    noindex: true,
  });

  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("aibridge-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const {
    status,
    runtime,
    preferences,
    loading,
    error,
    refresh,
    updateTaskStatus,
    acknowledgeMessage,
    addTask,
    sync,
    setLocalSource,
    setCustomRoot,
    setAccessRole,
    setAdminToken,
    launchAgentSession,
    startAgentSession,
    heartbeatAgentSession,
    stopAgentSession,
    recoverAgentSession,
  } = useAibridge();

  const isMobile = useIsMobile();

  useEffect(() => {
    if (!(LOCAL_DASHBOARD_VIEWS as readonly string[]).includes(activeView)) {
      setActiveView("overview");
    }
  }, [activeView]);

  const isAdmin = status.access.canMutate;
  const unreadCount = status.messages.filter(m => !m.acknowledged).length;

  const handleViewChange = (view: DashboardView) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  const handleLocalSetupInitialized = ({
    rootPath,
    workspacePath,
  }: {
    rootPath: string;
    workspacePath: string;
  }) => {
    const normalizedWorkspacePath =
      workspacePath.trim() || rootPath.replace(/[\\/]\.aibridge$/i, "");

    if (preferences.localSource === "workspace" && !workspacePath.trim()) {
      setLocalSource("workspace");
    } else {
      setCustomRoot(normalizedWorkspacePath);
      setLocalSource("custom");
    }

    setActiveView("overview");
  };

  const showOnboarding = !loading && error && (error.code === "NO_BRIDGE_FOUND" || error.code === "SERVICE_UNAVAILABLE") && !runtime.isSample;

  const renderView = () => {
    if (showOnboarding) {
      return (
        <OnboardingGuide
          error={error}
          localSource={preferences.localSource}
          customRoot={preferences.customRoot}
          accessRole={preferences.accessRole}
          adminToken={preferences.adminToken}
          isSample={runtime.isSample}
          onSwitchToSample={() => setLocalSource("sample")}
          onOpenSettings={() => handleViewChange("settings")}
          onLocalInitialized={handleLocalSetupInitialized}
        />
      );
    }

    switch (activeView) {
      case "overview":
        return <OverviewView status={status} onNavigate={handleViewChange} />;
      case "tasks":
        return <TaskBoard tasks={status.tasks} agents={status.context.activeAgents} onStatusChange={updateTaskStatus} onAddTask={addTask} />;
      case "activity":
        return <ActivityFeed logs={status.logs} agents={status.context.activeAgents} />;
      case "messages":
        return <MessagesView messages={status.messages} agents={status.context.activeAgents} onAcknowledge={acknowledgeMessage} />;
      case "agents":
        return (
          <AgentsView
            agents={status.context.activeAgents}
            handoffs={status.handoffs}
            logs={status.logs}
            tasks={status.tasks}
            sessions={status.sessions}
            onLaunchSession={launchAgentSession}
            onStartSession={startAgentSession}
            onHeartbeatSession={heartbeatAgentSession}
            onStopSession={stopAgentSession}
            onRecoverSession={recoverAgentSession}
          />
        );
      case "conventions":
        return <ConventionsView conventions={status.conventions} />;
      case "decisions":
        return <DecisionsView decisions={status.decisions} />;
      case "settings":
        return (
          <SettingsView
            localSource={preferences.localSource}
            customRoot={preferences.customRoot}
            runtime={runtime}
            capture={status.capture}
            access={status.access}
            adminToken={preferences.adminToken}
            loading={loading}
            errorMessage={error?.message}
            issues={status.issues}
            onLocalSourceChange={setLocalSource}
            onCustomRootChange={setCustomRoot}
            onAccessRoleChange={setAccessRole}
            onAdminTokenChange={setAdminToken}
            onRefresh={refresh}
          />
        );
    }
  };

  return (
    <div className="h-screen bg-background flex noise-overlay overflow-hidden">
      {!isMobile && (
        <DashboardSidebar
          activeView={activeView}
          onViewChange={setActiveView}
          unreadCount={unreadCount}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            setSidebarCollapsed(prev => {
              const next = !prev;
              try {
                localStorage.setItem("aibridge-sidebar-collapsed", String(next));
              } catch {
                // Ignore storage write failures
              }
              return next;
            });
          }}
        />
      )}

      {isMobile && (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-60">
            <DashboardSidebar
              activeView={activeView}
              onViewChange={handleViewChange}
              unreadCount={unreadCount}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col h-screen min-w-0">
        <ContextHeader
          context={status.context}
          runtime={runtime}
          onSync={sync}
          onMenuToggle={isMobile ? () => setMobileNavOpen(true) : undefined}
          tasks={status.tasks}
          onNavigate={handleViewChange}
          loading={loading}
          error={error}
          status={status}
        />
        <main className="flex-1 p-3 sm:p-6 overflow-auto bg-grid-dense">
          <AnimatePresence mode="wait">
            <motion.div
              key={showOnboarding ? "onboarding" : activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {loading && (
                <Card className="bg-card border-border mb-4">
                  <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
                    <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                    Loading {runtime.sourceLabel.toLowerCase()}...
                  </CardContent>
                </Card>
              )}

              {error && !showOnboarding && (
                <Card className="bg-card border-destructive/30 mb-4">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <TriangleAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Local service unavailable</p>
                        <p className="text-sm text-muted-foreground break-words">{error.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={refresh}>
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                      </Button>
                      <Button variant="secondary" size="sm" className="gap-1.5 text-xs" onClick={() => setActiveView("settings")}>
                        <DatabaseZap className="w-3.5 h-3.5" /> Local settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!error && status.issues && status.issues.length > 0 && (
                <Card className="bg-card border-amber-500/30 mb-4">
                  <CardContent className="p-4 space-y-1 text-sm">
                    <p className="font-medium text-foreground">Local bridge notices</p>
                    {status.issues.slice(0, 3).map(issue => (
                      <p key={issue} className="text-muted-foreground">{issue}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

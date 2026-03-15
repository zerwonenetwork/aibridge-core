import { useCallback, useEffect, useRef, useState } from "react";
import {
  acknowledgeLocalMessage,
  cleanupLocalProtocolIssue,
  createLocalAnnouncement,
  createLocalDecision,
  createLocalHandoff,
  createLocalLog,
  createLocalMessage,
  createLocalRelease,
  createLocalTask,
  dispatchLocalAgentRecovery,
  dispatchLocalAgentSession,
  heartbeatLocalAgentSession,
  fetchLocalBridgeStatus,
  fetchLocalProtocolRepairPrompt,
  launchLocalAgentSession,
  LocalBridgeClientError,
  regenerateLocalContext,
  recoverLocalAgentSession,
  runLocalAgentNonChat,
  startLocalAgentSession,
  stopLocalAgentSession,
  subscribeToLocalBridgeEvents,
  updateLocalDecision,
  updateLocalHandoff,
  updateLocalAnnouncement,
  updateLocalRelease,
  updateLocalTask,
} from "../lib/aibridge/local/client";
import type {
  AibridgeAccessRole,
  AibridgeAgentLaunchSource,
  AibridgeAgentToolKind,
  AibridgeAnnouncement,
  AibridgeDecision,
  AibridgeHandoff,
  AibridgeMessage,
  AibridgeLocalSource,
  AibridgeMode,
  AibridgeRelease,
  AibridgeRuntimeState,
  AibridgeStatus,
  AibridgeVerificationIssue,
  TaskStatus,
} from "../lib/aibridge/types";

const STORAGE_KEY = "aibridge-data-source";

export interface AibridgePreferences {
  mode: AibridgeMode;
  localSource: AibridgeLocalSource;
  customRoot: string;
  accessRole: AibridgeAccessRole;
  adminToken: string;
}

const defaultPreferences: AibridgePreferences = {
  mode: "local",
  localSource: "sample",
  customRoot: "",
  accessRole: "admin",
  adminToken: "",
};

function loadPreferences(): AibridgePreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultPreferences;
    }

    return {
      ...defaultPreferences,
      ...JSON.parse(stored),
      mode: "local", // always force local mode
    };
  } catch {
    return defaultPreferences;
  }
}

function createRuntimeState(preferences: AibridgePreferences): AibridgeRuntimeState {
  return {
    mode: "local",
    localSource: preferences.localSource,
    sourceLabel:
      preferences.localSource === "sample"
        ? "Sample Bridge"
        : preferences.localSource === "workspace"
          ? "Workspace Bridge"
          : "Custom Bridge",
    rootPath: preferences.localSource === "custom" ? preferences.customRoot || undefined : undefined,
    isSample: preferences.localSource === "sample",
  };
}

function createPlaceholderStatus(runtime: AibridgeRuntimeState): AibridgeStatus {
  return {
    context: {
      projectName: runtime.sourceLabel,
      repoPath: runtime.rootPath || "(not loaded)",
      lastSyncAt: new Date(0).toISOString(),
      schemaVersion: "1.0",
      activeAgents: [],
      taskCounts: {
        pending: 0,
        in_progress: 0,
        done: 0,
      },
      sourceLabel: runtime.sourceLabel,
      sourceRoot: runtime.rootPath,
    },
    tasks: [],
    logs: [],
    handoffs: [],
    decisions: [],
    conventions: [],
    messages: [],
    releases: [],
    announcements: [],
    sessions: [],
    capture: { hooksInstalled: [], watcher: { running: false, debounceMs: 300 }, validationWarnings: 0 },
    access: {
      role: runtime.isSample ? "viewer" : "admin",
      canMutate: !runtime.isSample,
      adminConfigured: false,
      authMode: "local-header",
    },
    contextMarkdown: "",
    issues: [],
    protocolIssues: [],
    toolCapabilities: [],
  };
}

function buildRequestOptions(preferences: AibridgePreferences) {
  return {
    source: preferences.localSource,
    rootPath: preferences.localSource === "custom" ? preferences.customRoot.trim() : undefined,
    accessRole: preferences.accessRole,
    adminToken: preferences.adminToken.trim() || undefined,
  } as const;
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function useAibridge() {
  const [preferences, setPreferences] = useState<AibridgePreferences>(loadPreferences);
  const [runtime, setRuntime] = useState<AibridgeRuntimeState>(() => createRuntimeState(preferences));
  const [status, setStatus] = useState<AibridgeStatus>(() => createPlaceholderStatus(createRuntimeState(preferences)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LocalBridgeClientError | null>(null);
  const [verificationIssues, setVerificationIssues] = useState<AibridgeVerificationIssue[]>([]);
  const watchRef = useRef<(() => void) | null>(null);

  const dismissVerificationIssue = useCallback((issueId: string) => {
    setVerificationIssues((current) => current.filter((issue) => issue.id !== issueId));
  }, []);

  const upsertVerificationIssue = useCallback((issue: AibridgeVerificationIssue) => {
    setVerificationIssues((current) => {
      const filtered = current.filter((item) => item.id !== issue.id);
      return [issue, ...filtered].slice(0, 8);
    });
  }, []);

  const clearVerificationIssue = useCallback((issueId: string) => {
    setVerificationIssues((current) => current.filter((issue) => issue.id !== issueId));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const refresh = useCallback(async () => {
    const nextRuntime = createRuntimeState(preferences);
    setRuntime(nextRuntime);
    setLoading(true);

    try {
      const response = await fetchLocalBridgeStatus(buildRequestOptions(preferences));
      setStatus(response.data);
      setRuntime(response.runtime);
      setError(null);
    } catch (caughtError) {
      const localError =
        caughtError instanceof LocalBridgeClientError
          ? caughtError
          : new LocalBridgeClientError("UNKNOWN_ERROR", (caughtError as Error).message);
      setError(localError);
      setStatus(createPlaceholderStatus(nextRuntime));
    } finally {
      setLoading(false);
    }
  }, [preferences]);

  useEffect(() => {
    void refresh();

    watchRef.current?.();
    watchRef.current = null;

    const debouncedRefresh = debounce(() => {
      void refresh();
    }, 1000);

    watchRef.current = subscribeToLocalBridgeEvents(
      buildRequestOptions(preferences),
      (event) => {
        if (event.event === "bridge.changed") {
          debouncedRefresh();
        }
      },
    );

    return () => {
      watchRef.current?.();
      watchRef.current = null;
    };
  }, [preferences, refresh]);

  useEffect(() => {
    setVerificationIssues((current) =>
      current.filter((issue) => {
        switch (issue.kind) {
          case "message_ack":
            return !status.messages.find((message) => message.id === issue.targetId)?.acknowledged;
          case "handoff_status":
            return status.handoffs.find((handoff) => handoff.id === issue.targetId)?.status !== issue.expectedStatus;
          case "decision_create":
            return !status.decisions.some((decision) => decision.id === issue.targetId);
          case "decision_status":
            return status.decisions.find((decision) => decision.id === issue.targetId)?.status !== issue.expectedStatus;
          case "log_create":
            return !status.logs.some((log) => log.id === issue.targetId);
          case "session_start": {
            const session = status.sessions.find((candidate) => candidate.id === issue.targetId);
            return !(session?.acknowledgedAt && session.acknowledgedAt >= issue.createdAt);
          }
          case "session_heartbeat": {
            const session = status.sessions.find((candidate) => candidate.id === issue.targetId);
            return !(session?.lastHeartbeatAt && session.lastHeartbeatAt >= issue.createdAt);
          }
          case "session_stop": {
            const session = status.sessions.find((candidate) => candidate.id === issue.targetId);
            return !(session?.stoppedAt && session.stoppedAt >= issue.createdAt);
          }
          case "session_dispatch": {
            const session = status.sessions.find((candidate) => candidate.id === issue.targetId);
            return !(
              session &&
              (session.instructions.dispatchStatus !== "not_attempted" ||
                Boolean(session.instructions.dispatchNote) ||
                (session.lastActivityAt && session.lastActivityAt >= issue.createdAt))
            );
          }
          case "session_recovery_dispatch": {
            const session = status.sessions.find((candidate) => candidate.id === issue.targetId);
            return !(
              session &&
              ((session.recovery?.dispatchStatus && session.recovery.dispatchStatus !== "not_attempted") ||
                Boolean(session.recovery?.dispatchNote) ||
                (session.lastHeartbeatAt && session.lastHeartbeatAt >= issue.createdAt))
            );
          }
          case "session_recover": {
            const session = status.sessions.find((candidate) => candidate.id === issue.targetId);
            return !(session?.recovery?.generatedAt && session.recovery.generatedAt >= issue.createdAt);
          }
          default:
            return true;
        }
      }),
    );
  }, [status]);

  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      const response = await updateLocalTask(
        buildRequestOptions(preferences),
        taskId,
        { status: newStatus },
      );
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
    },
    [preferences, status],
  );

  const acknowledgeMessage = useCallback(
    async (messageId: string) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `message-ack:${messageId}`;
      const response = await acknowledgeLocalMessage(
        buildRequestOptions(preferences),
        messageId,
      );
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      if (nextStatus.messages.find((message) => message.id === messageId)?.acknowledged) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "message_ack",
          createdAt: attemptedAt,
          title: "Message acknowledgement not confirmed",
          detail: "AiBridge sent the acknowledgement request, but the message still appears unread. Verify the mutation actually completed or retry it from Inbox.",
          severity: "warning",
          targetId: messageId,
          recommendedView: "messages",
        });
      }
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const addTask = useCallback(
    async (title: string, taskStatus: TaskStatus) => {
      const response = await createLocalTask(
        buildRequestOptions(preferences),
        { title, status: taskStatus },
      );
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
    },
    [preferences, status],
  );

  const sync = useCallback(async () => {
    const response = await regenerateLocalContext(buildRequestOptions(preferences));
    setStatus(response.status ?? status);
    setRuntime(response.runtime);
    setError(null);
  }, [preferences, status]);

  const createRelease = useCallback(
    async (payload: Omit<AibridgeRelease, "id" | "createdAt" | "updatedAt">) => {
      const response = await createLocalRelease(buildRequestOptions(preferences), payload);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const createMessage = useCallback(
    async (payload: { fromAgentId: string; toAgentId?: string; severity?: AibridgeMessage["severity"]; content: string }) => {
      const response = await createLocalMessage(buildRequestOptions(preferences), payload);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const createHandoff = useCallback(
    async (payload: { fromAgentId: string; toAgentId: string; description: string; relatedTaskIds?: string[] }) => {
      const response = await createLocalHandoff(buildRequestOptions(preferences), payload);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      clearVerificationIssue(`handoff-status:${response.data.id}`);
      return response.data;
    },
    [clearVerificationIssue, preferences, status],
  );

  const updateHandoff = useCallback(
    async (handoffId: string, payload: { status: AibridgeHandoff["status"]; agentId?: string }) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `handoff-status:${handoffId}`;
      const response = await updateLocalHandoff(buildRequestOptions(preferences), handoffId, payload);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      if (nextStatus.handoffs.find((handoff) => handoff.id === handoffId)?.status === payload.status) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "handoff_status",
          createdAt: attemptedAt,
          title: "Handoff status did not change",
          detail: `AiBridge expected the handoff to move to "${payload.status}", but the runtime still reports the previous state.`,
          severity: "warning",
          targetId: handoffId,
          expectedStatus: payload.status,
          recommendedView: "inbox",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const createDecision = useCallback(
    async (payload: { title: string; summary: string; status?: AibridgeDecision["status"]; agentId?: string }) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `decision-create:${payload.title}:${attemptedAt}`;
      const response = await createLocalDecision(buildRequestOptions(preferences), payload);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      if (nextStatus.decisions.some((decision) => decision.id === response.data.id)) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "decision_create",
          createdAt: attemptedAt,
          title: "Decision was not confirmed",
          detail: "AiBridge returned from decision recording, but the new decision is not visible in runtime state yet.",
          severity: "warning",
          targetId: response.data.id,
          recommendedView: "decisions",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const updateDecision = useCallback(
    async (decisionId: string, payload: { status: NonNullable<AibridgeDecision["status"]>; agentId?: string }) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `decision-status:${decisionId}`;
      const response = await updateLocalDecision(buildRequestOptions(preferences), decisionId, payload);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      if (nextStatus.decisions.find((decision) => decision.id === decisionId)?.status === payload.status) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "decision_status",
          createdAt: attemptedAt,
          title: "Decision status did not update",
          detail: `AiBridge expected the decision to become "${payload.status}", but the runtime still shows the older value.`,
          severity: "warning",
          targetId: decisionId,
          expectedStatus: payload.status,
          recommendedView: "decisions",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const createLog = useCallback(
    async (payload: { agentId: string; action: string; description: string; metadata?: Record<string, unknown> }) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `log-create:${attemptedAt}:${payload.agentId}:${payload.action}`;
      const response = await createLocalLog(buildRequestOptions(preferences), payload);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      if (nextStatus.logs.some((log) => log.id === response.data.id)) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "log_create",
          createdAt: attemptedAt,
          title: "Log entry not confirmed",
          detail: "AiBridge attempted to write the operator log, but the new log entry is not visible yet.",
          severity: "warning",
          targetId: response.data.id,
          recommendedView: "inbox",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const editRelease = useCallback(
    async (releaseId: string, payload: Partial<Omit<AibridgeRelease, "id" | "createdAt" | "updatedAt">>) => {
      const response = await updateLocalRelease(buildRequestOptions(preferences), releaseId, payload);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const createAnnouncement = useCallback(
    async (payload: Omit<AibridgeAnnouncement, "id" | "createdAt" | "updatedAt">) => {
      const response = await createLocalAnnouncement(buildRequestOptions(preferences), payload);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const editAnnouncement = useCallback(
    async (
      announcementId: string,
      payload: Partial<Omit<AibridgeAnnouncement, "id" | "createdAt" | "updatedAt">> & { expiresAt?: string | null },
    ) => {
      const response = await updateLocalAnnouncement(buildRequestOptions(preferences), announcementId, payload);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const launchAgentSession = useCallback(
    async (agentId: string, toolKind: AibridgeAgentToolKind, launchSource: AibridgeAgentLaunchSource = "dashboard") => {
      const response = await launchLocalAgentSession(buildRequestOptions(preferences), { agentId, toolKind, launchSource });
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      clearVerificationIssue(`session-dispatch:${response.data.id}`);
      clearVerificationIssue(`session-recovery:${response.data.id}`);
      return response.data;
    },
    [clearVerificationIssue, preferences, status],
  );

  const startAgentSession = useCallback(
    async (sessionId: string) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `session-start:${sessionId}`;
      const response = await startLocalAgentSession(buildRequestOptions(preferences), sessionId);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      const session = nextStatus.sessions.find((candidate) => candidate.id === sessionId);
      if (session?.acknowledgedAt && session.acknowledgedAt >= attemptedAt) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "session_start",
          createdAt: attemptedAt,
          title: "Session start not confirmed",
          detail: "AiBridge tried to mark the session as started, but the acknowledgement timestamp did not advance. Verify the agent actually acknowledged the session.",
          severity: "warning",
          targetId: sessionId,
          recommendedView: "agents",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const heartbeatAgentSession = useCallback(
    async (sessionId: string) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `session-heartbeat:${sessionId}`;
      const response = await heartbeatLocalAgentSession(buildRequestOptions(preferences), sessionId);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      const session = nextStatus.sessions.find((candidate) => candidate.id === sessionId);
      if (session?.lastHeartbeatAt && session.lastHeartbeatAt >= attemptedAt) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "session_heartbeat",
          createdAt: attemptedAt,
          title: "Heartbeat not confirmed",
          detail: "AiBridge sent the heartbeat request, but the session heartbeat timestamp did not change. The agent may still be stale.",
          severity: "warning",
          targetId: sessionId,
          recommendedView: "agents",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const stopAgentSession = useCallback(
    async (sessionId: string, reason?: string) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `session-stop:${sessionId}`;
      const response = await stopLocalAgentSession(buildRequestOptions(preferences), sessionId, { reason });
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      const session = nextStatus.sessions.find((candidate) => candidate.id === sessionId);
      if (session?.status === "stopped" && session.stoppedAt && session.stoppedAt >= attemptedAt) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "session_stop",
          createdAt: attemptedAt,
          title: "Session stop not confirmed",
          detail: "AiBridge tried to stop the session, but the runtime did not confirm a stopped state.",
          severity: "warning",
          targetId: sessionId,
          recommendedView: "agents",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const recoverAgentSession = useCallback(
    async (sessionId: string) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `session-recovery:${sessionId}`;
      const response = await recoverLocalAgentSession(buildRequestOptions(preferences), sessionId);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      const session = nextStatus.sessions.find((candidate) => candidate.id === sessionId);
      if (session?.recovery?.generatedAt && session.recovery.generatedAt >= attemptedAt) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "session_recover",
          createdAt: attemptedAt,
          title: "Recovery prompt not confirmed",
          detail: "AiBridge expected a fresh recovery prompt for this session, but the runtime did not expose one.",
          severity: "warning",
          targetId: sessionId,
          recommendedView: "agents",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const dispatchAgentSession = useCallback(
    async (sessionId: string) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `session-dispatch:${sessionId}`;
      const response = await dispatchLocalAgentSession(buildRequestOptions(preferences), sessionId);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      const session = nextStatus.sessions.find((candidate) => candidate.id === sessionId);
      const confirmed =
        Boolean(session) &&
        (session!.instructions.dispatchStatus !== "not_attempted" ||
          Boolean(session!.instructions.dispatchNote) ||
          Boolean(session!.lastActivityAt && session!.lastActivityAt >= attemptedAt));
      if (confirmed) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "session_dispatch",
          createdAt: attemptedAt,
          title: "Launch dispatch not confirmed",
          detail: "AiBridge tried to dispatch the launch action, but the runtime did not confirm any dispatch state change. The agent tool may not have received the prompt.",
          severity: "warning",
          targetId: sessionId,
          recommendedView: "agents",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const dispatchAgentRecovery = useCallback(
    async (sessionId: string) => {
      const attemptedAt = new Date().toISOString();
      const verificationId = `session-recovery-dispatch:${sessionId}`;
      const response = await dispatchLocalAgentRecovery(buildRequestOptions(preferences), sessionId);
      const nextStatus = response.status ?? status;
      setStatus(nextStatus);
      setRuntime(response.runtime);
      setError(null);
      const session = nextStatus.sessions.find((candidate) => candidate.id === sessionId);
      const confirmed =
        Boolean(session) &&
        (((session?.recovery?.dispatchStatus ?? "not_attempted") !== "not_attempted") ||
          Boolean(session?.recovery?.dispatchNote) ||
          Boolean(session?.lastHeartbeatAt && session.lastHeartbeatAt >= attemptedAt));
      if (confirmed) {
        clearVerificationIssue(verificationId);
      } else {
        upsertVerificationIssue({
          id: verificationId,
          kind: "session_recovery_dispatch",
          createdAt: attemptedAt,
          title: "Recovery dispatch not confirmed",
          detail: "AiBridge tried to dispatch recovery, but the runtime still shows no recovery-side state change.",
          severity: "warning",
          targetId: sessionId,
          recommendedView: "agents",
        });
      }
      return response.data;
    },
    [clearVerificationIssue, preferences, status, upsertVerificationIssue],
  );

  const runAgentNonChat = useCallback(
    async (sessionId: string) => {
      const response = await runLocalAgentNonChat(buildRequestOptions(preferences), sessionId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const fetchRepairPrompt = useCallback(
    async (issueId: string) => {
      const response = await fetchLocalProtocolRepairPrompt(buildRequestOptions(preferences), issueId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data.prompt;
    },
    [preferences, status],
  );

  const cleanupProtocolIssue = useCallback(
    async (issueId: string) => {
      const response = await cleanupLocalProtocolIssue(buildRequestOptions(preferences), issueId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  return {
    status,
    runtime,
    preferences,
    loading,
    error,
    verificationIssues,
    dismissVerificationIssue,
    refresh,
    setLocalSource: (localSource: AibridgeLocalSource) =>
      setPreferences((previous) => ({ ...previous, localSource })),
    setCustomRoot: (customRoot: string) => setPreferences((previous) => ({ ...previous, customRoot })),
    setAccessRole: (accessRole: AibridgeAccessRole) => setPreferences((previous) => ({ ...previous, accessRole })),
    setAdminToken: (adminToken: string) => setPreferences((previous) => ({ ...previous, adminToken })),
    updateTaskStatus,
    acknowledgeMessage,
    createMessage,
    createHandoff,
    updateHandoff,
    createDecision,
    updateDecision,
    createLog,
    addTask,
    createRelease,
    editRelease,
    createAnnouncement,
    editAnnouncement,
    launchAgentSession,
    startAgentSession,
    heartbeatAgentSession,
    stopAgentSession,
    recoverAgentSession,
    dispatchAgentSession,
    dispatchAgentRecovery,
    runAgentNonChat,
    fetchRepairPrompt,
    cleanupProtocolIssue,
    sync,
  };
}

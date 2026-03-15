import { useCallback, useEffect, useRef, useState } from "react";
import {
  acknowledgeLocalMessage,
  cleanupLocalProtocolIssue,
  createLocalAnnouncement,
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
  updateLocalAnnouncement,
  updateLocalRelease,
  updateLocalTask,
} from "../lib/aibridge/local/client";
import type {
  AibridgeAccessRole,
  AibridgeAgentLaunchSource,
  AibridgeAgentToolKind,
  AibridgeAnnouncement,
  AibridgeLocalSource,
  AibridgeMode,
  AibridgeRelease,
  AibridgeRuntimeState,
  AibridgeStatus,
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
  const watchRef = useRef<(() => void) | null>(null);

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
      const response = await acknowledgeLocalMessage(
        buildRequestOptions(preferences),
        messageId,
      );
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
    },
    [preferences, status],
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
      return response.data;
    },
    [preferences, status],
  );

  const startAgentSession = useCallback(
    async (sessionId: string) => {
      const response = await startLocalAgentSession(buildRequestOptions(preferences), sessionId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const heartbeatAgentSession = useCallback(
    async (sessionId: string) => {
      const response = await heartbeatLocalAgentSession(buildRequestOptions(preferences), sessionId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const stopAgentSession = useCallback(
    async (sessionId: string, reason?: string) => {
      const response = await stopLocalAgentSession(buildRequestOptions(preferences), sessionId, { reason });
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const recoverAgentSession = useCallback(
    async (sessionId: string) => {
      const response = await recoverLocalAgentSession(buildRequestOptions(preferences), sessionId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const dispatchAgentSession = useCallback(
    async (sessionId: string) => {
      const response = await dispatchLocalAgentSession(buildRequestOptions(preferences), sessionId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
  );

  const dispatchAgentRecovery = useCallback(
    async (sessionId: string) => {
      const response = await dispatchLocalAgentRecovery(buildRequestOptions(preferences), sessionId);
      setStatus(response.status ?? status);
      setRuntime(response.runtime);
      setError(null);
      return response.data;
    },
    [preferences, status],
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
    refresh,
    setLocalSource: (localSource: AibridgeLocalSource) =>
      setPreferences((previous) => ({ ...previous, localSource })),
    setCustomRoot: (customRoot: string) => setPreferences((previous) => ({ ...previous, customRoot })),
    setAccessRole: (accessRole: AibridgeAccessRole) => setPreferences((previous) => ({ ...previous, accessRole })),
    setAdminToken: (adminToken: string) => setPreferences((previous) => ({ ...previous, adminToken })),
    updateTaskStatus,
    acknowledgeMessage,
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

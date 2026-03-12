import type {
  AibridgeAccessRole,
  AibridgeAgentLaunchSource,
  AibridgeAgentSession,
  AibridgeAgentToolKind,
  AibridgeAnnouncement,
  AibridgeLocalEvent,
  AibridgeLocalSource,
  AibridgeRelease,
  AibridgeRuntimeState,
  AibridgeStatus,
  AibridgeTask,
  TaskStatus,
} from "../types";

export interface LocalBridgeRequestOptions {
  source: AibridgeLocalSource;
  rootPath?: string;
  accessRole?: AibridgeAccessRole;
  adminToken?: string;
}

const DEFAULT_LOCAL_BRIDGE_SERVICE_URL = "http://127.0.0.1:4545";
const SERVICE_URL_STORAGE_KEY = "aibridge-local-service-url";

export class LocalBridgeClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LocalBridgeClientError";
  }
}

interface LocalBridgeEnvelope<T> {
  data: T;
  status?: AibridgeStatus;
  runtime: AibridgeRuntimeState;
  revision?: string;
}

function getLocalBridgeServiceBaseUrl() {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(SERVICE_URL_STORAGE_KEY)?.trim();
    if (stored) {
      return stored;
    }
  }

  return import.meta.env.VITE_AIBRIDGE_LOCAL_SERVICE_URL || DEFAULT_LOCAL_BRIDGE_SERVICE_URL;
}

function buildServiceUrl(
  routePath: string,
  options?: LocalBridgeRequestOptions,
  extraQuery?: Record<string, string | number | boolean | undefined>,
) {
  const url = new URL(routePath, getLocalBridgeServiceBaseUrl());

  if (options) {
    url.searchParams.set("source", options.source);
    if (options.rootPath?.trim()) {
      url.searchParams.set("root", options.rootPath.trim());
    }
  }

  Object.entries(extraQuery ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function requestLocalBridge<T>(input: RequestInfo, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new LocalBridgeClientError(
      "SERVICE_UNAVAILABLE",
      "Local bridge service is not running. Start it with `npm run aibridge:service` or `npm run dev`.",
    );
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new LocalBridgeClientError(
      payload?.error?.code ?? "UNKNOWN_ERROR",
      payload?.error?.message ?? "Local bridge request failed.",
      payload?.error?.details,
    );
  }

  return payload as LocalBridgeEnvelope<T>;
}

function buildRequestHeaders(options?: LocalBridgeRequestOptions, initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders);
  headers.set("x-aibridge-role", options?.accessRole ?? "admin");
  if (options?.adminToken?.trim()) {
    headers.set("x-aibridge-admin-token", options.adminToken.trim());
  }
  return headers;
}

export async function fetchLocalBridgeStatus(options: LocalBridgeRequestOptions) {
  return requestLocalBridge<AibridgeStatus>(buildServiceUrl("/bridge/status", options), {
    headers: buildRequestHeaders(options),
  });
}

export async function createLocalTask(
  options: LocalBridgeRequestOptions,
  payload: { title: string; status?: TaskStatus; priority?: AibridgeTask["priority"]; agentId?: string },
) {
  return requestLocalBridge<AibridgeTask>(buildServiceUrl("/bridge/tasks"), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function updateLocalTask(
  options: LocalBridgeRequestOptions,
  taskId: string,
  payload: { status?: TaskStatus; priority?: AibridgeTask["priority"]; title?: string; agentId?: string },
) {
  return requestLocalBridge<AibridgeTask>(buildServiceUrl(`/bridge/tasks/${taskId}`), {
    method: "PATCH",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function acknowledgeLocalMessage(options: LocalBridgeRequestOptions, messageId: string) {
  return requestLocalBridge<{ id: string }>(buildServiceUrl(`/bridge/messages/${messageId}/ack`), {
    method: "PATCH",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
    }),
  });
}

export async function regenerateLocalContext(options: LocalBridgeRequestOptions) {
  return requestLocalBridge<{ markdown: string }>(buildServiceUrl("/bridge/context/generate"), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
    }),
  });
}

export async function fetchLocalReleases(options: LocalBridgeRequestOptions) {
  return requestLocalBridge<AibridgeRelease[]>(buildServiceUrl("/bridge/releases", options), {
    headers: buildRequestHeaders(options),
  });
}

export async function createLocalRelease(
  options: LocalBridgeRequestOptions,
  payload: Omit<AibridgeRelease, "id" | "createdAt" | "updatedAt" | "publishedAt"> & { publishedAt?: string },
) {
  return requestLocalBridge<AibridgeRelease>(buildServiceUrl("/bridge/releases"), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function updateLocalRelease(
  options: LocalBridgeRequestOptions,
  releaseId: string,
  payload: Partial<Omit<AibridgeRelease, "id" | "createdAt" | "updatedAt">>,
) {
  return requestLocalBridge<AibridgeRelease>(buildServiceUrl(`/bridge/releases/${releaseId}`), {
    method: "PATCH",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function fetchLocalAnnouncements(options: LocalBridgeRequestOptions) {
  return requestLocalBridge<AibridgeAnnouncement[]>(buildServiceUrl("/bridge/announcements", options), {
    headers: buildRequestHeaders(options),
  });
}

export async function createLocalAnnouncement(
  options: LocalBridgeRequestOptions,
  payload: Omit<AibridgeAnnouncement, "id" | "createdAt" | "updatedAt" | "publishedAt"> & { publishedAt?: string },
) {
  return requestLocalBridge<AibridgeAnnouncement>(buildServiceUrl("/bridge/announcements"), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function updateLocalAnnouncement(
  options: LocalBridgeRequestOptions,
  announcementId: string,
  payload: Partial<Omit<AibridgeAnnouncement, "id" | "createdAt" | "updatedAt">> & { expiresAt?: string | null },
) {
  return requestLocalBridge<AibridgeAnnouncement>(buildServiceUrl(`/bridge/announcements/${announcementId}`), {
    method: "PATCH",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function fetchLocalAgentSessions(
  options: LocalBridgeRequestOptions,
  filters?: { agentId?: string; toolKind?: AibridgeAgentToolKind; status?: string },
) {
  return requestLocalBridge<AibridgeAgentSession[]>(
    buildServiceUrl("/bridge/agents/sessions", options, {
      agent: filters?.agentId,
      tool: filters?.toolKind,
      status: filters?.status,
    }),
    {
      headers: buildRequestHeaders(options),
    },
  );
}

export async function launchLocalAgentSession(
  options: LocalBridgeRequestOptions,
  payload: { agentId: string; toolKind: AibridgeAgentToolKind; launchSource?: AibridgeAgentLaunchSource },
) {
  return requestLocalBridge<AibridgeAgentSession>(buildServiceUrl("/bridge/agents/launch"), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function startLocalAgentSession(options: LocalBridgeRequestOptions, sessionId: string) {
  return requestLocalBridge<AibridgeAgentSession>(buildServiceUrl(`/bridge/agents/sessions/${sessionId}/start`), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
    }),
  });
}

export async function heartbeatLocalAgentSession(options: LocalBridgeRequestOptions, sessionId: string) {
  return requestLocalBridge<AibridgeAgentSession>(buildServiceUrl(`/bridge/agents/sessions/${sessionId}/heartbeat`), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
    }),
  });
}

export async function stopLocalAgentSession(
  options: LocalBridgeRequestOptions,
  sessionId: string,
  payload: { reason?: string } = {},
) {
  return requestLocalBridge<AibridgeAgentSession>(buildServiceUrl(`/bridge/agents/sessions/${sessionId}/stop`), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      source: options.source,
      rootPath: options.rootPath,
      ...payload,
    }),
  });
}

export async function recoverLocalAgentSession(options: LocalBridgeRequestOptions, sessionId: string) {
  return requestLocalBridge<AibridgeAgentSession>(buildServiceUrl(`/bridge/agents/sessions/${sessionId}/recovery`), {
    method: "GET",
    headers: buildRequestHeaders(options),
  });
}

export function subscribeToLocalBridgeEvents(
  options: LocalBridgeRequestOptions,
  onEvent: (event: AibridgeLocalEvent) => void,
) {
  if (typeof EventSource === "undefined") {
    return () => {};
  }

  const eventSource = new EventSource(buildServiceUrl("/bridge/events", options));
  const handleMessage = (messageEvent: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(messageEvent.data) as AibridgeLocalEvent);
    } catch {
      // Keep the watch stream alive even if one event is malformed.
    }
  };

  eventSource.addEventListener("ready", handleMessage as EventListener);
  eventSource.addEventListener("bridge.changed", handleMessage as EventListener);

  return () => {
    eventSource.removeEventListener("ready", handleMessage as EventListener);
    eventSource.removeEventListener("bridge.changed", handleMessage as EventListener);
    eventSource.close();
  };
}

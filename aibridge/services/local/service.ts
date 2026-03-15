import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AibridgeAccessRole,
  AibridgeAgentLaunchSource,
  AibridgeAgentToolKind,
  AibridgeAnnouncement,
  AibridgeConvention,
  AibridgeDecision,
  AibridgeLocalEvent,
  AibridgeLocalSource,
  AibridgeMessage,
  AibridgeRelease,
  AibridgeRuntimeState,
} from "../../../src/lib/aibridge/types";
import {
  BridgeRuntimeError,
  acknowledgeMessage,
  addAnnouncement,
  addConvention,
  addDecision,
  addLog,
  addMessage,
  addRelease,
  addTask,
  buildProtocolIssueRepairPrompt,
  cleanupProtocolIssue,
  dispatchAgentSessionLaunch,
  dispatchAgentSessionRecovery,
  getAgentSessionRecovery,
  getAgentToolCapabilities,
  createHandoff,
  getStatusSummary,
  heartbeatAgentSession,
  launchAgentSession,
  listAgentSessions,
  listAnnouncements,
  listProtocolIssues,
  listConventions,
  listDecisions,
  listHandoffs,
  listLogs,
  listMessages,
  listReleases,
  listTasks,
  parseAnnouncementAudience,
  parseAnnouncementSeverity,
  parseAnnouncementStatus,
  parseAgentLaunchSource,
  parseAgentSessionStatus,
  parseAgentToolKind,
  parseConventionCategory,
  parseDecisionStatus,
  parseMessageSeverity,
  parsePriority,
  parseReleaseStatus,
  parseTaskStatus,
  regenerateContext,
  resolveBridgeRoot,
  runAgentSessionNonChat,
  showConventionsMarkdown,
  startAgentSession,
  stopAgentSession,
  updateAnnouncement,
  updateDecisionStatus,
  updateRelease,
  updateTask,
} from "../../runtime/store";
import { getCaptureStatus } from "../capture/capture";
import {
  buildSetupResult,
  createSetupQuestionnaireDefaults,
  listSetupTemplates,
} from "../../../src/lib/aibridge/setup/service";
import { initializeLocalBridgeFromSetup } from "../../setup/local";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4545;
const POLL_INTERVAL_MS = 1500;
const ATTACH_TIMEOUT_MS = 1500;
const LOCAL_SOURCES = ["sample", "workspace", "custom"] as const;
const LOCAL_SERVICE_NAME = "aibridge-local-service";
const LOCAL_SERVICE_API_VERSION = 1;

export interface LocalServiceOptions {
  cwd?: string;
  host?: string;
  port?: number;
  source?: AibridgeLocalSource;
  customRoot?: string;
  adminToken?: string;
  pollIntervalMs?: number;
  startedAt?: string;
}

export interface RunningLocalService {
  url: string;
  host: string;
  port: number;
  close: () => Promise<void>;
  ownsServer: boolean;
  identity: LocalServiceHealth;
  server?: Server;
}

export interface LocalServiceHealth {
  ok: true;
  service: typeof LOCAL_SERVICE_NAME;
  apiVersion: typeof LOCAL_SERVICE_API_VERSION;
  pid: number;
  cwd: string;
  startedAt: string;
  timestamp: string;
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-AiBridge-Role, X-AiBridge-Admin-Token");
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  setCorsHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendError(response: ServerResponse, error: unknown) {
  if (error instanceof BridgeRuntimeError) {
    sendJson(response, error.code === "BAD_REQUEST" ? 400 : error.code === "NOT_INITIALIZED" || error.code === "NOT_FOUND" ? 404 : 422, {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  sendJson(response, 500, {
    error: {
      code: "INTERNAL_ERROR",
      message: (error as Error).message,
    },
  });
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new BridgeRuntimeError("BAD_REQUEST", "Request body must be valid JSON.", {
      reason: (error as Error).message,
    });
  }
}

function parseUrl(request: IncomingMessage) {
  return new URL(request.url ?? "/", "http://127.0.0.1");
}

function normalizeServiceCwd(cwd: string | undefined) {
  return path.resolve(cwd ?? process.cwd());
}

function normalizeComparisonPath(targetPath: string) {
  return path.normalize(targetPath).toLowerCase();
}

function serviceUrl(host: string, port: number) {
  return `http://${host}:${port}`;
}

function createServiceHealth(cwd: string, startedAt: string): LocalServiceHealth {
  return {
    ok: true,
    service: LOCAL_SERVICE_NAME,
    apiVersion: LOCAL_SERVICE_API_VERSION,
    pid: process.pid,
    cwd,
    startedAt,
    timestamp: new Date().toISOString(),
  };
}

function buildRuntimeState(source: AibridgeLocalSource, rootPath: string): AibridgeRuntimeState {
  return {
    mode: "local",
    localSource: source,
    sourceLabel: source === "sample" ? "Sample Bridge" : source === "workspace" ? "Workspace Bridge" : "Custom Bridge",
    rootPath,
    isSample: source === "sample",
  };
}

function parseLocalSource(source: string | null | undefined, fallback: AibridgeLocalSource = "workspace") {
  if (!source) {
    return fallback;
  }

  if (!LOCAL_SOURCES.includes(source as AibridgeLocalSource)) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Invalid local source: ${source}`);
  }

  return source as AibridgeLocalSource;
}

function configuredAdminToken(options: LocalServiceOptions) {
  return options.adminToken?.trim() || process.env.AIBRIDGE_ADMIN_TOKEN?.trim() || undefined;
}

function resolveAccess(request: IncomingMessage, options: LocalServiceOptions) {
  const requestedRoleHeader = request.headers["x-aibridge-role"];
  const requestedRole =
    typeof requestedRoleHeader === "string" && requestedRoleHeader.trim() === "viewer" ? "viewer" : "admin";
  const providedTokenHeader = request.headers["x-aibridge-admin-token"];
  const adminToken = typeof providedTokenHeader === "string" ? providedTokenHeader.trim() : undefined;
  const expectedAdminToken = configuredAdminToken(options);

  return {
    role: requestedRole as AibridgeAccessRole,
    adminToken,
    expectedAdminToken,
  };
}

function requireAdmin(request: IncomingMessage, options: LocalServiceOptions) {
  const access = resolveAccess(request, options);
  const tokenConfigured = Boolean(access.expectedAdminToken);
  const verified = access.role === "admin" && (!tokenConfigured || access.adminToken === access.expectedAdminToken);

  if (!verified) {
    throw new BridgeRuntimeError("BAD_REQUEST", "Admin access is required for this mutation.", {
      role: access.role,
      adminConfigured: tokenConfigured,
    });
  }

  return access;
}

async function resolveRuntime(
  options: LocalServiceOptions,
  source: string | null | undefined,
  customRoot: string | null | undefined,
) {
  const cwd = options.cwd ?? process.cwd();
  const localSource = parseLocalSource(source, options.source ?? "workspace");
  const rootPath = await resolveBridgeRoot({
    cwd,
    source: localSource,
    customRoot: customRoot ?? options.customRoot ?? undefined,
  });

  return {
    rootPath,
    runtime: buildRuntimeState(localSource, rootPath),
  };
}

async function computeRevision(rootPath: string) {
  async function walk(directoryPath: string): Promise<Array<{ path: string; mtimeMs: number; size: number }>> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const files: Array<{ path: string; mtimeMs: number; size: number }> = [];
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walk(fullPath)));
        continue;
      }

      if (!entry.isFile() || entry.name.endsWith(".tmp")) {
        continue;
      }

      const metadata = await fs.stat(fullPath);
      files.push({
        path: fullPath,
        mtimeMs: metadata.mtimeMs,
        size: metadata.size,
      });
    }

    return files;
  }

  try {
    const files = await walk(rootPath);
    const signature = files
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((file) => `${file.path}:${Math.round(file.mtimeMs)}:${file.size}`)
      .join("|");
    return `${files.length}:${signature}`;
  } catch {
    return "missing";
  }
}

function sendSseEvent(response: ServerResponse, event: AibridgeLocalEvent) {
  response.write(`event: ${event.event}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function handleEvents(request: IncomingMessage, response: ServerResponse, options: LocalServiceOptions) {
  const url = parseUrl(request);
  const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));

  setCorsHeaders(response);
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let revision = await computeRevision(rootPath);
  sendSseEvent(response, {
    event: "ready",
    revision,
    timestamp: new Date().toISOString(),
    runtime,
  });

  const interval = setInterval(async () => {
    try {
      const nextRevision = await computeRevision(rootPath);
      if (nextRevision === revision) {
        return;
      }

      revision = nextRevision;
      sendSseEvent(response, {
        event: "bridge.changed",
        revision,
        timestamp: new Date().toISOString(),
        runtime,
      });
    } catch {
      // Keep the stream alive and let the next poll attempt recover.
    }
  }, options.pollIntervalMs ?? POLL_INTERVAL_MS);

  const close = () => {
    clearInterval(interval);
    if (!response.writableEnded) {
      response.end();
    }
  };

  request.on("close", close);
  response.on("close", close);
}

function numberParam(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Invalid numeric query parameter: ${value}`);
  }

  return parsed;
}

function withStatusEnvelope<T>(data: T, status: Awaited<ReturnType<typeof getStatusSummary>>, runtime: AibridgeRuntimeState, revision: string) {
  return {
    data,
    status,
    runtime,
    revision,
  };
}

function parseDecisionStatusParam(value: string | null) {
  return value ? parseDecisionStatus(value) : undefined;
}

function parseConventionCategoryParam(value: unknown) {
  return typeof value === "string" ? parseConventionCategory(value) : undefined;
}

function parseSeverityParam(value: string | null) {
  return value ? parseMessageSeverity(value) : undefined;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, options: LocalServiceOptions) {
  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.statusCode = 204;
    response.end();
    return;
  }

  const url = parseUrl(request);
  const serviceCwd = normalizeServiceCwd(options.cwd);
  const serviceStartedAt = options.startedAt ?? new Date().toISOString();

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, createServiceHealth(serviceCwd, serviceStartedAt));
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/events") {
    await handleEvents(request, response, options);
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/status") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, {
      data: status,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/capture/status") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const capture = await getCaptureStatus({ cwd: path.dirname(rootPath) });
    sendJson(response, 200, {
      data: capture,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/agents/capabilities") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const capabilities = await getAgentToolCapabilities(rootPath);
    sendJson(response, 200, {
      data: capabilities,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/agents/sessions") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const sessions = await listAgentSessions(rootPath, {
      agentId: url.searchParams.get("agent") ?? undefined,
      toolKind: parseAgentToolKind(url.searchParams.get("tool")) as AibridgeAgentToolKind | undefined,
      status: parseAgentSessionStatus(url.searchParams.get("status")),
    });
    sendJson(response, 200, {
      data: sessions,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/protocol/issues") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const issues = await listProtocolIssues(rootPath);
    sendJson(response, 200, {
      data: issues,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/agents/launch") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const session = await launchAgentSession(rootPath, {
      agentId: String(body.agentId ?? "").trim(),
      toolKind: parseAgentToolKind(typeof body.toolKind === "string" ? body.toolKind : undefined) ?? "cursor",
      launchSource: parseAgentLaunchSource(typeof body.launchSource === "string" ? body.launchSource : undefined) as AibridgeAgentLaunchSource | undefined,
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, withStatusEnvelope(session, status, runtime, await computeRevision(rootPath)));
    return;
  }

  const sessionMutationMatch = url.pathname.match(/^\/bridge\/agents\/sessions\/([^/]+)\/(start|heartbeat|stop|recovery|dispatch|non-chat)$/);
  if (sessionMutationMatch) {
    const [, sessionId, action] = sessionMutationMatch;
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const { rootPath, runtime } = await resolveRuntime(
      options,
      request.method === "GET" ? url.searchParams.get("source") : body.source,
      request.method === "GET" ? url.searchParams.get("root") : body.rootPath,
    );

    let data;
    if (request.method === "POST" && action === "start") {
      data = await startAgentSession(rootPath, sessionId);
    } else if (request.method === "POST" && action === "heartbeat") {
      data = await heartbeatAgentSession(rootPath, sessionId);
    } else if (request.method === "POST" && action === "stop") {
      data = await stopAgentSession(rootPath, sessionId, {
        reason: typeof body.reason === "string" ? body.reason : undefined,
      });
    } else if (request.method === "POST" && action === "dispatch") {
      data = await dispatchAgentSessionLaunch(rootPath, sessionId);
    } else if (request.method === "POST" && action === "non-chat") {
      data = await runAgentSessionNonChat(rootPath, sessionId);
    } else if (request.method === "GET" && action === "recovery") {
      data = await getAgentSessionRecovery(rootPath, sessionId);
    } else {
      throw new BridgeRuntimeError("BAD_REQUEST", `Unsupported session action: ${action}`);
    }

    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope(data, status, runtime, await computeRevision(rootPath)));
    return;
  }

  const recoveryDispatchMatch = url.pathname.match(/^\/bridge\/agents\/sessions\/([^/]+)\/recovery\/dispatch$/);
  if (recoveryDispatchMatch) {
    const [, sessionId] = recoveryDispatchMatch;
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const data = await dispatchAgentSessionRecovery(rootPath, sessionId);
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope(data, status, runtime, await computeRevision(rootPath)));
    return;
  }

  const protocolIssueActionMatch = url.pathname.match(/^\/bridge\/protocol\/issues\/([^/]+)\/(repair-prompt|cleanup)$/);
  if (protocolIssueActionMatch) {
    const [, issueId, action] = protocolIssueActionMatch;
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const { rootPath, runtime } = await resolveRuntime(
      options,
      request.method === "GET" ? url.searchParams.get("source") : body.source,
      request.method === "GET" ? url.searchParams.get("root") : body.rootPath,
    );

    let data;
    if (request.method === "GET" && action === "repair-prompt") {
      data = { prompt: await buildProtocolIssueRepairPrompt(rootPath, issueId) };
    } else if (request.method === "POST" && action === "cleanup") {
      data = await cleanupProtocolIssue(rootPath, issueId);
    } else {
      throw new BridgeRuntimeError("BAD_REQUEST", `Unsupported protocol issue action: ${action}`);
    }

    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope(data, status, runtime, await computeRevision(rootPath)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/setup/templates") {
    sendJson(response, 200, {
      data: {
        templates: listSetupTemplates(),
        defaults: createSetupQuestionnaireDefaults(),
      },
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/setup/plan") {
    const body = await readJsonBody(request);
    const result = buildSetupResult({
      projectName: String(body.projectName ?? "").trim(),
      shortDescription: String(body.shortDescription ?? "").trim(),
      templateId: body.templateId,
      primaryDeliverable: typeof body.primaryDeliverable === "string" ? body.primaryDeliverable : undefined,
      preferredStack: Array.isArray(body.preferredStack) ? body.preferredStack.map((value: unknown) => String(value)) : undefined,
      priorities: Array.isArray(body.priorities) ? body.priorities : undefined,
      agentMode: body.agentMode,
      hardConstraints: Array.isArray(body.hardConstraints) ? body.hardConstraints.map((value: unknown) => String(value)) : undefined,
      existingRepo: Boolean(body.existingRepo),
      existingFilesSummary: typeof body.existingFilesSummary === "string" ? body.existingFilesSummary : undefined,
      customInstructions: typeof body.customInstructions === "string" ? body.customInstructions : undefined,
    });

    sendJson(response, 200, {
      data: {
        template: result.template,
        questionnaire: result.questionnaire,
        plan: result.plan,
        result,
      },
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/setup/init") {
    const body = await readJsonBody(request);
    const initialized = await initializeLocalBridgeFromSetup(
      {
        projectName: String(body.projectName ?? "").trim(),
        shortDescription: String(body.shortDescription ?? "").trim(),
        templateId: body.templateId,
        primaryDeliverable: typeof body.primaryDeliverable === "string" ? body.primaryDeliverable : undefined,
        preferredStack: Array.isArray(body.preferredStack) ? body.preferredStack.map((value: unknown) => String(value)) : undefined,
        priorities: Array.isArray(body.priorities) ? body.priorities : undefined,
        agentMode: body.agentMode,
        hardConstraints: Array.isArray(body.hardConstraints) ? body.hardConstraints.map((value: unknown) => String(value)) : undefined,
        existingRepo: Boolean(body.existingRepo),
        existingFilesSummary: typeof body.existingFilesSummary === "string" ? body.existingFilesSummary : undefined,
        customInstructions: typeof body.customInstructions === "string" ? body.customInstructions : undefined,
      },
      {
        cwd: typeof body.cwd === "string" ? body.cwd : options.cwd,
        clearExistingData: Boolean(body.clearExistingData),
      },
    );

    const runtime = buildRuntimeState("workspace", initialized.rootPath);
    sendJson(response, 201, {
      data: {
        rootPath: initialized.rootPath,
        result: initialized.result,
        markdown: initialized.markdown,
      },
      status: initialized.status,
      runtime,
      revision: await computeRevision(initialized.rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/context/generate") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const markdown = await regenerateContext(rootPath, typeof body.budget === "number" ? body.budget : undefined);
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope({ markdown }, status, runtime, await computeRevision(rootPath)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/tasks") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const tasks = await listTasks(rootPath, {
      status: url.searchParams.get("status") ? parseTaskStatus(url.searchParams.get("status") as string) : undefined,
      agentId: url.searchParams.get("agent") ?? undefined,
    });
    sendJson(response, 200, {
      data: tasks,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/tasks") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const task = await addTask(rootPath, {
      title: String(body.title ?? "").trim(),
      status: typeof body.status === "string" ? parseTaskStatus(body.status) : undefined,
      priority: parsePriority(typeof body.priority === "string" ? body.priority : undefined),
      agentId: typeof body.agentId === "string" ? body.agentId : undefined,
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, {
      data: task,
      status,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  const taskMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/tasks\/([^/]+)$/) : null;
  if (taskMatch) {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const task = await updateTask(rootPath, taskMatch[1], {
      title: typeof body.title === "string" ? body.title : undefined,
      status: typeof body.status === "string" ? parseTaskStatus(body.status) : undefined,
      priority: typeof body.priority === "string" ? parsePriority(body.priority) : undefined,
      agentId: typeof body.agentId === "string" ? body.agentId : undefined,
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, {
      data: task,
      status,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/messages") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const messages = await listMessages(rootPath, {
      toAgentId: url.searchParams.get("to") ?? undefined,
      severity: parseSeverityParam(url.searchParams.get("severity")),
      unreadOnly: url.searchParams.get("unread") === "true",
      limit: numberParam(url.searchParams.get("limit")),
    });
    sendJson(response, 200, {
      data: messages,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/messages") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const message = await addMessage(rootPath, {
      fromAgentId: String(body.fromAgentId ?? "").trim(),
      toAgentId: typeof body.toAgentId === "string" ? body.toAgentId : undefined,
      severity: typeof body.severity === "string" ? parseMessageSeverity(body.severity) : undefined,
      content: String(body.content ?? "").trim(),
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, {
      data: message,
      status,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  const messageMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/messages\/([^/]+)\/ack$/) : null;
  if (messageMatch) {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const message = await acknowledgeMessage(rootPath, messageMatch[1]);
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, {
      data: message,
      status,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/handoffs") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const handoffs = await listHandoffs(rootPath, {
      agentId: url.searchParams.get("agent") ?? undefined,
    });
    sendJson(response, 200, {
      data: handoffs,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/handoffs") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const handoff = await createHandoff(rootPath, {
      fromAgentId: String(body.fromAgentId ?? "").trim(),
      toAgentId: String(body.toAgentId ?? "").trim(),
      description: String(body.description ?? "").trim(),
      relatedTaskIds: Array.isArray(body.relatedTaskIds)
        ? body.relatedTaskIds.map((value: unknown) => String(value))
        : undefined,
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, {
      data: handoff,
      status,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/releases") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const releases = await listReleases(rootPath, {
      status: url.searchParams.get("status") ? parseReleaseStatus(url.searchParams.get("status") as string) : undefined,
      includeArchived: url.searchParams.get("includeArchived") === "true",
      access: resolveAccess(request, options),
    });
    sendJson(response, 200, {
      data: releases,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/releases") {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const release = await addRelease(rootPath, {
      version: String(body.version ?? "").trim(),
      title: String(body.title ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      status: typeof body.status === "string" ? parseReleaseStatus(body.status) : undefined,
      highlights: Array.isArray(body.highlights) ? body.highlights.map((value: unknown) => String(value)) : undefined,
      breakingChanges: Array.isArray(body.breakingChanges)
        ? body.breakingChanges.map((value: unknown) => String(value))
        : undefined,
      upgradeNotes: Array.isArray(body.upgradeNotes) ? body.upgradeNotes.map((value: unknown) => String(value)) : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((value: unknown) => String(value)) : undefined,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : undefined,
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(response, 201, withStatusEnvelope<AibridgeRelease>(release, status, runtime, await computeRevision(rootPath)));
    return;
  }

  const releaseMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/releases\/([^/]+)$/) : null;
  if (releaseMatch) {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const release = await updateRelease(rootPath, releaseMatch[1], {
      version: typeof body.version === "string" ? body.version : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      status: typeof body.status === "string" ? parseReleaseStatus(body.status) : undefined,
      highlights: Array.isArray(body.highlights) ? body.highlights.map((value: unknown) => String(value)) : undefined,
      breakingChanges: Array.isArray(body.breakingChanges)
        ? body.breakingChanges.map((value: unknown) => String(value))
        : undefined,
      upgradeNotes: Array.isArray(body.upgradeNotes) ? body.upgradeNotes.map((value: unknown) => String(value)) : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((value: unknown) => String(value)) : undefined,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : undefined,
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(response, 200, withStatusEnvelope<AibridgeRelease>(release, status, runtime, await computeRevision(rootPath)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/announcements") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const announcements = await listAnnouncements(rootPath, {
      status: url.searchParams.get("status")
        ? parseAnnouncementStatus(url.searchParams.get("status") as string)
        : undefined,
      includeArchived: url.searchParams.get("includeArchived") === "true",
      access: resolveAccess(request, options),
    });
    sendJson(response, 200, {
      data: announcements,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/announcements") {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const announcement = await addAnnouncement(rootPath, {
      title: String(body.title ?? "").trim(),
      body: String(body.body ?? "").trim(),
      status: typeof body.status === "string" ? parseAnnouncementStatus(body.status) : undefined,
      audience: typeof body.audience === "string" ? parseAnnouncementAudience(body.audience) : undefined,
      severity: typeof body.severity === "string" ? parseAnnouncementSeverity(body.severity) : undefined,
      publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : undefined,
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : undefined,
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(
      response,
      201,
      withStatusEnvelope<AibridgeAnnouncement>(announcement, status, runtime, await computeRevision(rootPath)),
    );
    return;
  }

  const announcementMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/announcements\/([^/]+)$/) : null;
  if (announcementMatch) {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const announcement = await updateAnnouncement(rootPath, announcementMatch[1], {
      title: typeof body.title === "string" ? body.title : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
      status: typeof body.status === "string" ? parseAnnouncementStatus(body.status) : undefined,
      audience: typeof body.audience === "string" ? parseAnnouncementAudience(body.audience) : undefined,
      severity: typeof body.severity === "string" ? parseAnnouncementSeverity(body.severity) : undefined,
      publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : undefined,
      expiresAt: body.expiresAt === null ? null : typeof body.expiresAt === "string" ? body.expiresAt : undefined,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : undefined,
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(
      response,
      200,
      withStatusEnvelope<AibridgeAnnouncement>(announcement, status, runtime, await computeRevision(rootPath)),
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/decisions") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const decisions = await listDecisions(rootPath, {
      status: parseDecisionStatusParam(url.searchParams.get("status")),
    });
    sendJson(response, 200, {
      data: decisions,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/decisions") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const decision = await addDecision(rootPath, {
      title: String(body.title ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      status: typeof body.status === "string" ? parseDecisionStatus(body.status) : undefined,
      agentId: typeof body.agentId === "string" ? body.agentId : undefined,
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, withStatusEnvelope<AibridgeDecision>(decision, status, runtime, await computeRevision(rootPath)));
    return;
  }

  const decisionMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/decisions\/([^/]+)$/) : null;
  if (decisionMatch) {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const decision = await updateDecisionStatus(
      rootPath,
      decisionMatch[1],
      parseDecisionStatus(String(body.status ?? "")),
      typeof body.agentId === "string" ? body.agentId : undefined,
    );
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope<AibridgeDecision>(decision, status, runtime, await computeRevision(rootPath)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/conventions") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    if (url.searchParams.get("format") === "markdown") {
      const markdown = await showConventionsMarkdown(rootPath);
      const status = await getStatusSummary(rootPath, resolveAccess(request, options));
      sendJson(response, 200, withStatusEnvelope({ markdown }, status, runtime, await computeRevision(rootPath)));
      return;
    }

    const conventions = await listConventions(rootPath);
    sendJson(response, 200, {
      data: conventions,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/conventions") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const convention = await addConvention(rootPath, {
      rule: String(body.rule ?? "").trim(),
      addedBy: typeof body.addedBy === "string" ? body.addedBy : undefined,
      category: parseConventionCategoryParam(body.category),
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(
      response,
      201,
      withStatusEnvelope<AibridgeConvention>(convention, status, runtime, await computeRevision(rootPath)),
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/bridge/logs") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const logs = await listLogs(rootPath, {
      agentId: url.searchParams.get("agent") ?? undefined,
      limit: numberParam(url.searchParams.get("limit")),
    });
    sendJson(response, 200, {
      data: logs,
      runtime,
      revision: await computeRevision(rootPath),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/bridge/logs") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const log = await addLog(rootPath, {
      agentId: String(body.agentId ?? "").trim(),
      action: String(body.action ?? "").trim(),
      description: String(body.description ?? "").trim(),
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : undefined,
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, withStatusEnvelope(log, status, runtime, await computeRevision(rootPath)));
    return;
  }

  sendJson(response, 404, {
    error: {
      code: "NOT_FOUND",
      message: "Unknown local bridge route.",
    },
  });
}

export function createLocalBridgeHttpServer(options: LocalServiceOptions = {}) {
  const serviceOptions: LocalServiceOptions = {
    ...options,
    cwd: normalizeServiceCwd(options.cwd),
    startedAt: options.startedAt ?? new Date().toISOString(),
  };

  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, serviceOptions);
    } catch (error) {
      sendError(response, error);
    }
  });
}

let runningServicePromise: Promise<RunningLocalService> | null = null;
let runningServiceKey: string | null = null;

function buildRunningServiceKey(options: LocalServiceOptions) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const cwd = normalizeServiceCwd(options.cwd);
  return `${host}:${port}:${cwd}`;
}

async function readAttachedServiceHealth(host: string, port: number): Promise<LocalServiceHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATTACH_TIMEOUT_MS);

  try {
    const response = await fetch(`${serviceUrl(host, port)}/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `Port ${port} is already in use, but the process did not return a healthy AiBridge response.`,
        {
          host,
          port,
          status: response.status,
        },
      );
    }

    const payload = (await response.json()) as Partial<LocalServiceHealth>;
    if (payload.ok !== true || payload.service !== LOCAL_SERVICE_NAME) {
      throw new BridgeRuntimeError("BAD_REQUEST", `Port ${port} is already in use by a non-AiBridge process.`, {
        host,
        port,
        payload,
      });
    }

    if (payload.apiVersion !== LOCAL_SERVICE_API_VERSION) {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `Port ${port} is already in use by an incompatible AiBridge local service.`,
        {
          host,
          port,
          expectedApiVersion: LOCAL_SERVICE_API_VERSION,
          actualApiVersion: payload.apiVersion,
        },
      );
    }

    if (!payload.cwd) {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `Port ${port} is already in use by an AiBridge service without workspace identity.`,
        {
          host,
          port,
          payload,
        },
      );
    }

    return payload as LocalServiceHealth;
  } catch (error) {
    if (error instanceof BridgeRuntimeError) {
      throw error;
    }

    throw new BridgeRuntimeError(
      "BAD_REQUEST",
      `Port ${port} is already in use, but the existing process could not be verified as AiBridge.`,
      {
        host,
        port,
        reason: (error as Error).message,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyExistingService(options: LocalServiceOptions, host: string, port: number) {
  const expectedCwd = normalizeServiceCwd(options.cwd);
  const health = await readAttachedServiceHealth(host, port);

  if (normalizeComparisonPath(health.cwd) !== normalizeComparisonPath(expectedCwd)) {
    throw new BridgeRuntimeError(
      "BAD_REQUEST",
      `Port ${port} is already in use by an AiBridge service for a different workspace.`,
      {
        host,
        port,
        expectedCwd,
        actualCwd: health.cwd,
      },
    );
  }

  return health;
}

function withManagedClose(service: RunningLocalService, serviceKey: string): RunningLocalService {
  const originalClose = service.close;
  return {
    ...service,
    close: async () => {
      try {
        await originalClose();
      } finally {
        if (runningServiceKey === serviceKey) {
          runningServicePromise = null;
          runningServiceKey = null;
        }
      }
    },
  };
}

export async function startLocalBridgeService(options: LocalServiceOptions = {}) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const cwd = normalizeServiceCwd(options.cwd);
  const startedAt = new Date().toISOString();
  const server = createLocalBridgeHttpServer({
    ...options,
    cwd,
    startedAt,
  });
  const serviceKey = buildRunningServiceKey({
    ...options,
    cwd,
    host,
    port,
  });

  const started = await new Promise<RunningLocalService>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      void (async () => {
        if (error.code === "EADDRINUSE") {
          try {
            const identity = await verifyExistingService({ ...options, cwd }, host, port);
            server.close();
            resolve({
              url: serviceUrl(host, port),
              host,
              port,
              ownsServer: false,
              identity,
              server,
              close: async () => {},
            });
          } catch (verificationError) {
            reject(verificationError);
          }
          return;
        }

        reject(error);
      })();
    });

    server.listen(port, host, () => {
      resolve({
        url: serviceUrl(host, port),
        host,
        port,
        ownsServer: true,
        identity: createServiceHealth(cwd, startedAt),
        server,
        close: async () =>
          await new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          }),
      });
    });
  });

  return withManagedClose(started, serviceKey);
}

export async function ensureLocalBridgeService(options: LocalServiceOptions = {}) {
  const serviceKey = buildRunningServiceKey(options);
  if (!runningServicePromise || runningServiceKey !== serviceKey) {
    runningServiceKey = serviceKey;
    runningServicePromise = startLocalBridgeService(options).catch((error) => {
      runningServicePromise = null;
      runningServiceKey = null;
      throw error;
    });
  }

  const service = await runningServicePromise;
  return service;
}

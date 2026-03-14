import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AibridgeAccessRole,
  AibridgeAnnouncement,
  AibridgeAnnouncementAudience,
  AibridgeAnnouncementSeverity,
  AibridgeAgent,
  AibridgeAgentLaunchSource,
  AibridgeAgentSession,
  AibridgeAgentSessionStatus,
  AibridgeAgentKind,
  AibridgeAgentToolKind,
  AibridgeBridgeConfig,
  AibridgeBridgeSnapshot,
  AibridgeConvention,
  AibridgeDecision,
  AibridgeHandoff,
  AibridgeLaunchInstructionSet,
  AibridgeLocalSource,
  AibridgeLogEntry,
  AibridgeMessage,
  AibridgeRelease,
  AibridgeStatus,
  AibridgeTask,
  TaskStatus,
} from "../../src/lib/aibridge/types";
import { compileContextMarkdown, parseContextTimestamp } from "./context";
import {
  buildLaunchInstructionSet,
  deriveAgentSession,
  sessionNotice,
} from "./agent-sessions";
import {
  agentKinds,
  agentLaunchSources,
  agentSessionSchema,
  agentSessionStatuses,
  agentToolKinds,
  announcementAudiences,
  announcementSchema,
  announcementSeverities,
  announcementStatuses,
  bridgeSchema,
  bridgeSetupSchema,
  conventionCategories,
  conventionSchema,
  decisionStatuses,
  decisionSchema,
  handoffSchema,
  logEntrySchema,
  messageSeverities,
  messageSchema,
  priorities,
  releaseSchema,
  releaseStatuses,
  taskSchema,
} from "./schema";
import { readCaptureStatus } from "../services/capture/state";
import type { BridgeSetupMetadata } from "../../src/lib/aibridge/setup/types";
import type { AgentSessionDocument } from "./schema";

const DEFAULT_BRIDGE_DIRNAME = ".aibridge";
const BRIDGE_WRITE_LOCK = ".aibridge.write.lock";
const LOCK_POLL_INTERVAL_MS = 50;
const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 10_000;
const RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url));

function resolveFirstExistingPath(candidates: string[]) {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const PROTOCOL_TEMPLATES_ROOT = resolveFirstExistingPath([
  path.resolve(RUNTIME_DIR, "../protocol/templates"),
  path.resolve(RUNTIME_DIR, "aibridge/protocol/templates"),
]);
export const SAMPLE_BRIDGE_ROOT = resolveFirstExistingPath([
  path.resolve(RUNTIME_DIR, "../../public/examples/aibridge/local-bridge"),
  path.resolve(RUNTIME_DIR, "public/examples/aibridge/local-bridge"),
]);

const AGENT_LABELS: Record<AibridgeAgentKind, string> = {
  cursor: "Cursor",
  claude: "Claude Code",
  codex: "Codex",
  antigravity: "Antigravity",
  copilot: "Copilot",
  windsurf: "Windsurf",
  custom: "Custom Agent",
};

export class BridgeRuntimeError extends Error {
  constructor(
    public readonly code:
      | "NOT_INITIALIZED"
      | "INVALID_STATE"
      | "NOT_FOUND"
      | "VALIDATION_ERROR"
      | "BAD_REQUEST",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BridgeRuntimeError";
  }
}

export interface BridgeRootOptions {
  cwd?: string;
  source?: AibridgeLocalSource;
  customRoot?: string;
}

export interface InitBridgeOptions {
  cwd?: string;
  name?: string;
  agents?: string[];
  setup?: BridgeSetupMetadata;
}

export interface InitBridgeResult {
  rootPath: string;
  createdFiles: string[];
  alreadyInitialized: boolean;
}

export interface TaskMutationPayload {
  title?: string;
  priority?: AibridgeTask["priority"];
  agentId?: string;
  status?: TaskStatus;
}

export interface MessageCreatePayload {
  fromAgentId: string;
  toAgentId?: string;
  severity?: AibridgeMessage["severity"];
  content: string;
}

export interface HandoffCreatePayload {
  fromAgentId: string;
  toAgentId: string;
  description: string;
  relatedTaskIds?: string[];
}

export interface AgentSessionLaunchPayload {
  agentId: string;
  toolKind: AibridgeAgentToolKind;
  launchSource?: AibridgeAgentLaunchSource;
}

export interface AgentSessionMutationPayload {
  reason?: string;
}

export interface AgentSessionFilters {
  agentId?: string;
  toolKind?: AibridgeAgentToolKind;
  status?: AibridgeAgentSessionStatus;
}

export interface ReleaseCreatePayload {
  version: string;
  title: string;
  summary: string;
  status?: AibridgeRelease["status"];
  highlights?: string[];
  breakingChanges?: string[];
  upgradeNotes?: string[];
  tags?: string[];
  createdBy?: string;
}

export interface ReleaseUpdatePayload {
  version?: string;
  title?: string;
  summary?: string;
  status?: AibridgeRelease["status"];
  highlights?: string[];
  breakingChanges?: string[];
  upgradeNotes?: string[];
  tags?: string[];
  createdBy?: string;
  publishedAt?: string;
}

export interface AnnouncementCreatePayload {
  title: string;
  body: string;
  status?: AibridgeAnnouncement["status"];
  audience?: AibridgeAnnouncement["audience"];
  severity?: AibridgeAnnouncement["severity"];
  publishedAt?: string;
  expiresAt?: string;
  createdBy?: string;
}

export interface AnnouncementUpdatePayload {
  title?: string;
  body?: string;
  status?: AibridgeAnnouncement["status"];
  audience?: AibridgeAnnouncement["audience"];
  severity?: AibridgeAnnouncement["severity"];
  publishedAt?: string;
  expiresAt?: string | null;
  createdBy?: string;
}

export interface BridgeAccessOptions {
  role?: AibridgeAccessRole;
  adminToken?: string;
  expectedAdminToken?: string;
}

export interface ReleaseFilters {
  status?: AibridgeRelease["status"];
  includeArchived?: boolean;
  access?: BridgeAccessOptions;
}

export interface AnnouncementFilters {
  status?: AibridgeAnnouncement["status"];
  includeArchived?: boolean;
  access?: BridgeAccessOptions;
}

interface BridgePaths {
  root: string;
  bridgeFile: string;
  contextFile: string;
  conventionsFile: string;
  captureDir: string;
  agentsDir: string;
  tasksDir: string;
  logsDir: string;
  handoffsDir: string;
  decisionsDir: string;
  conventionsDir: string;
  messagesDir: string;
  releasesDir: string;
  announcementsDir: string;
  sessionsDir: string;
}

function getBridgePaths(root: string): BridgePaths {
  return {
    root,
    bridgeFile: path.join(root, "bridge.json"),
    contextFile: path.join(root, "CONTEXT.md"),
    conventionsFile: path.join(root, "CONVENTIONS.md"),
    captureDir: path.join(root, "capture"),
    agentsDir: path.join(root, "agents"),
    tasksDir: path.join(root, "tasks"),
    logsDir: path.join(root, "logs"),
    handoffsDir: path.join(root, "handoffs"),
    decisionsDir: path.join(root, "decisions"),
    conventionsDir: path.join(root, "conventions"),
    messagesDir: path.join(root, "messages"),
    releasesDir: path.join(root, "releases"),
    announcementsDir: path.join(root, "announcements"),
    sessionsDir: path.join(root, "sessions"),
  };
}

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath: string) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAgent(kind: AibridgeAgentKind): AibridgeAgent {
  return {
    id: kind,
    name: AGENT_LABELS[kind],
    kind,
    configPath: `${DEFAULT_BRIDGE_DIRNAME}/agents/${kind}.md`,
  };
}

async function normalizeBridgeRoot(targetPath: string) {
  const explicitBridge = path.resolve(targetPath);
  if (await fileExists(path.join(explicitBridge, "bridge.json"))) {
    return explicitBridge;
  }

  const nestedBridge = path.join(explicitBridge, DEFAULT_BRIDGE_DIRNAME);
  if (await fileExists(path.join(nestedBridge, "bridge.json"))) {
    return nestedBridge;
  }

  return explicitBridge;
}

async function acquireBridgeWriteLock(rootPath: string) {
  await ensureDir(rootPath);
  const lockPath = path.join(rootPath, BRIDGE_WRITE_LOCK);
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(
        `${JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
        })}\n`,
        "utf8",
      );

      return async () => {
        await handle.close().catch(() => undefined);
        await fs.rm(lockPath, { force: true }).catch(() => undefined);
      };
    } catch (error) {
      const lockError = error as NodeJS.ErrnoException;
      if (lockError.code !== "EEXIST") {
        throw lockError;
      }

      try {
        const metadata = await fs.stat(lockPath);
        if (Date.now() - metadata.mtimeMs > LOCK_STALE_MS) {
          await fs.rm(lockPath, { force: true }).catch(() => undefined);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

        throw statError;
      }

      if (Date.now() - startedAt > LOCK_TIMEOUT_MS) {
        throw new BridgeRuntimeError("BAD_REQUEST", `Timed out waiting for bridge write lock at ${rootPath}.`, {
          rootPath,
          lockPath,
        });
      }

      await sleep(LOCK_POLL_INTERVAL_MS);
    }
  }
}

async function withBridgeWriteLock<T>(rootPath: string, operation: (rootPath: string) => Promise<T>) {
  const root = await normalizeBridgeRoot(rootPath);
  const release = await acquireBridgeWriteLock(root);
  try {
    return await operation(root);
  } finally {
    await release();
  }
}

export async function resolveBridgeRoot(options: BridgeRootOptions = {}) {
  const cwd = options.cwd ?? process.cwd();

  if (options.source === "sample") {
    return SAMPLE_BRIDGE_ROOT;
  }

  if (options.source === "custom") {
    if (!options.customRoot?.trim()) {
      throw new BridgeRuntimeError("BAD_REQUEST", "A custom bridge path is required for custom local mode.");
    }

    return normalizeBridgeRoot(path.resolve(cwd, options.customRoot));
  }

  return normalizeBridgeRoot(path.resolve(cwd, DEFAULT_BRIDGE_DIRNAME));
}

async function readTextIfExists(targetPath: string) {
  if (!(await fileExists(targetPath))) {
    return "";
  }

  return fs.readFile(targetPath, "utf8");
}

async function readJsonFile<T>(
  targetPath: string,
  parse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } },
  issues: string[],
) {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    const parsed = JSON.parse(raw);
    const result = parse(parsed);
    if (!result.success) {
      issues.push(
        `Invalid ${path.basename(targetPath)}: ${result.error.issues.map((issue) => issue.message).join(", ")}`,
      );
      return null;
    }

    return result.data;
  } catch (error) {
    issues.push(`Unable to read ${path.basename(targetPath)}: ${(error as Error).message}`);
    return null;
  }
}

async function readJsonCollection<T>(
  dirPath: string,
  parse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } },
  issues: string[],
) {
  if (!(await fileExists(dirPath))) {
    return [] as T[];
  }

  const entries = (await fs.readdir(dirPath))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const data: T[] = [];
  for (const entry of entries) {
    const item = await readJsonFile(path.join(dirPath, entry), parse, issues);
    if (item) {
      data.push(item);
    }
  }

  return data;
}

function parseConventionMetadata(rawMetadata: string | undefined) {
  const metadata: Record<string, string> = {};
  if (!rawMetadata) {
    return metadata;
  }

  for (const match of rawMetadata.matchAll(/([a-zA-Z]+)=([^\s]+)/g)) {
    metadata[match[1]] = match[2];
  }

  return metadata;
}

function parseConventionLine(rawLine: string, index: number, defaultAddedAt: string) {
  const match = rawLine.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
  if (!match) {
    return null;
  }

  const content = match[1];
  const metadataMatch = content.match(/^(.*?)(?:\s*<!--\s*aibridge:(.*?)\s*-->)?\s*$/);
  const rule = metadataMatch?.[1]?.trim() ?? "";
  if (!rule) {
    return null;
  }

  const metadata = parseConventionMetadata(metadataMatch?.[2]);
  const convention = {
    id: metadata.id ?? `conv-${index + 1}`,
    rule,
    addedAt: metadata.addedAt ?? defaultAddedAt,
    addedBy: metadata.addedBy,
    category: metadata.category as AibridgeConvention["category"] | undefined,
  };

  const result = conventionSchema.safeParse(convention);
  return result.success ? result.data : null;
}

async function parseConventions(conventionsFile: string, defaultAddedAt: string, issues: string[]) {
  if (!(await fileExists(conventionsFile))) {
    return [] as AibridgeConvention[];
  }

  const markdown = await fs.readFile(conventionsFile, "utf8");
  const conventions = markdown
    .split(/\r?\n/)
    .map((line, index) => parseConventionLine(line, index, defaultAddedAt))
    .filter(Boolean) as AibridgeConvention[];

  return conventions;
}

function conventionsToMarkdownDocument(conventions: AibridgeConvention[]) {
  const body = conventions
    .slice()
    .sort((left, right) => {
      const addedDelta = left.addedAt.localeCompare(right.addedAt);
      return addedDelta !== 0 ? addedDelta : left.id.localeCompare(right.id);
    })
    .map((convention, index) => {
      const metadata = [
        `id=${convention.id}`,
        `addedAt=${convention.addedAt}`,
        convention.addedBy ? `addedBy=${convention.addedBy}` : "",
        convention.category ? `category=${convention.category}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `${index + 1}. ${convention.rule}${metadata ? ` <!-- aibridge:${metadata} -->` : ""}`;
    })
    .join("\n");

  return `# Project Conventions\n\n> Shared rules all agents must follow. Managed via \`aibridge convention add\`.\n\n${
    body || "_(none)_"
  }\n`;
}

async function parseLogFiles(logsDir: string, issues: string[]) {
  if (!(await fileExists(logsDir))) {
    return [] as AibridgeLogEntry[];
  }

  const entries = (await fs.readdir(logsDir))
    .filter((name) => name.endsWith(".jsonl"))
    .sort((left, right) => left.localeCompare(right));

  const logs: AibridgeLogEntry[] = [];
  for (const entry of entries) {
    const fullPath = path.join(logsDir, entry);
    const raw = await fs.readFile(fullPath, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const [lineIndex, line] of lines.entries()) {
      try {
        const parsed = JSON.parse(line);
        const result = logEntrySchema.safeParse(parsed);
        if (result.success) {
          logs.push(result.data);
        } else {
          issues.push(
            `Invalid ${entry}:${lineIndex + 1}: ${result.error.issues.map((issue) => issue.message).join(", ")}`,
          );
        }
      } catch (error) {
        issues.push(`Unable to parse ${entry}:${lineIndex + 1}: ${(error as Error).message}`);
      }
    }
  }

  return logs;
}

async function readBridgeConfig(paths: BridgePaths, issues: string[]) {
  const config = await readJsonFile(paths.bridgeFile, bridgeSchema.safeParse.bind(bridgeSchema), issues);
  if (!config) {
    throw new BridgeRuntimeError(
      "NOT_INITIALIZED",
      `No valid bridge configuration found at ${paths.bridgeFile}.`,
      { rootPath: paths.root },
    );
  }

  return config;
}

function getRepoPath(root: string) {
  return path.basename(root) === DEFAULT_BRIDGE_DIRNAME ? path.dirname(root) : root;
}

function normalizeList(values: string[] | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function normalizeBridgeSetup(setup: BridgeSetupMetadata | undefined) {
  if (!setup) {
    return undefined;
  }

  return bridgeSetupSchema.parse({
    ...setup,
    summary: setup.summary.trim(),
    primaryDeliverable: setup.primaryDeliverable.trim(),
    preferredStack: normalizeList(setup.preferredStack),
    hardConstraints: normalizeList(setup.hardConstraints),
    definitionOfDone: normalizeList(setup.definitionOfDone),
    workflowSummary: setup.workflowSummary.trim(),
    roles: setup.roles.map((role) => ({
      ...role,
      key: role.key.trim(),
      name: role.name.trim(),
      responsibilities: normalizeList(role.responsibilities),
    })),
    customInstructions: setup.customInstructions?.trim() || undefined,
  });
}

function resolveBridgeAccess(access: BridgeAccessOptions = {}) {
  const expectedToken = access.expectedAdminToken?.trim();
  const requestedRole = access.role ?? "admin";
  const canMutate = requestedRole === "admin" && (!expectedToken || access.adminToken?.trim() === expectedToken);

  return {
    role: (canMutate ? "admin" : "viewer") as AibridgeAccessRole,
    canMutate,
    adminConfigured: Boolean(expectedToken),
    authMode: "local-header" as const,
  };
}

function filterVisibleReleases(releases: AibridgeRelease[], access: ReturnType<typeof resolveBridgeAccess>) {
  const visible = access.canMutate ? releases : releases.filter((release) => release.status === "published");
  return visible
    .slice()
    .sort((left, right) => {
      const publishedDelta = (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt);
      return publishedDelta !== 0 ? publishedDelta : left.id.localeCompare(right.id);
    });
}

function filterVisibleAnnouncements(announcements: AibridgeAnnouncement[], access: ReturnType<typeof resolveBridgeAccess>) {
  const now = new Date().toISOString();
  const visible = announcements.filter((announcement) => {
    if (announcement.expiresAt && announcement.expiresAt < now) {
      return false;
    }

    if (access.canMutate) {
      return true;
    }

    return announcement.status === "published" || announcement.status === "pinned";
  });

  return visible
    .slice()
    .sort((left, right) => {
      if (left.status === "pinned" && right.status !== "pinned") {
        return -1;
      }
      if (left.status !== "pinned" && right.status === "pinned") {
        return 1;
      }

      const publishedDelta = (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt);
      return publishedDelta !== 0 ? publishedDelta : left.id.localeCompare(right.id);
    });
}

function normalizeStatus(snapshot: AibridgeBridgeSnapshot, accessOptions: BridgeAccessOptions = {}): AibridgeStatus {
  const access = resolveBridgeAccess(accessOptions);
  const sessions = snapshot.sessions
    .map((session) => deriveAgentSession(snapshot, session))
    .sort((left, right) => right.launchedAt.localeCompare(left.launchedAt));
  const activeAgents = snapshot.bridge.agents.map((agent) => {
    const lastActive = snapshot.logs
      .filter((entry) => entry.agentId === agent.id)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
    const activeSession = sessions
      .filter((session) => session.agentId === agent.id)
      .sort((left, right) => right.lastActivityAt?.localeCompare(left.lastActivityAt ?? "") || right.launchedAt.localeCompare(left.launchedAt))[0];

    return {
      ...agent,
      lastActiveAt: agent.lastActiveAt ?? activeSession?.lastActivityAt ?? lastActive?.timestamp,
    };
  });
  const issues = [...snapshot.issues];
  for (const session of sessions) {
    const notice = sessionNotice(session);
    if (notice) {
      issues.push(notice);
    }
  }

  return {
    context: {
      projectName: snapshot.bridge.projectName,
      repoPath: snapshot.repoPath,
      lastSyncAt: snapshot.lastSyncAt,
      schemaVersion: snapshot.bridge.schemaVersion,
      activeAgents,
      taskCounts: {
        pending: snapshot.tasks.filter((task) => task.status === "pending").length,
        in_progress: snapshot.tasks.filter((task) => task.status === "in_progress").length,
        done: snapshot.tasks.filter((task) => task.status === "done").length,
      },
      sourceRoot: snapshot.repoPath,
      sourceLabel: path.basename(snapshot.repoPath) || snapshot.repoPath,
      setup: snapshot.bridge.setup,
    },
    tasks: snapshot.tasks.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    logs: snapshot.logs.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    handoffs: snapshot.handoffs.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    decisions: snapshot.decisions.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    conventions: snapshot.conventions.slice().sort((left, right) => left.addedAt.localeCompare(right.addedAt)),
    messages: snapshot.messages.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    releases: filterVisibleReleases(snapshot.releases, access),
    announcements: filterVisibleAnnouncements(snapshot.announcements, access),
    sessions,
    capture: {
      hooksInstalled: [],
      watcher: {
        running: false,
        debounceMs: 1500,
      },
      validationWarnings: 0,
    },
    access,
    contextMarkdown: snapshot.contextMarkdown,
    issues,
  };
}

export async function loadBridgeSnapshot(rootPath: string) {
  const root = await normalizeBridgeRoot(rootPath);
  const paths = getBridgePaths(root);
  const issues: string[] = [];

  const bridge = await readBridgeConfig(paths, issues);
  const [tasks, logs, handoffs, decisions, conventionFiles, messages, releases, announcements, sessions, conventionsMarkdown, contextMarkdown] = await Promise.all([
    readJsonCollection(paths.tasksDir, taskSchema.safeParse.bind(taskSchema), issues),
    parseLogFiles(paths.logsDir, issues),
    readJsonCollection(paths.handoffsDir, handoffSchema.safeParse.bind(handoffSchema), issues),
    readJsonCollection(paths.decisionsDir, decisionSchema.safeParse.bind(decisionSchema), issues),
    readJsonCollection(paths.conventionsDir, conventionSchema.safeParse.bind(conventionSchema), issues),
    readJsonCollection(paths.messagesDir, messageSchema.safeParse.bind(messageSchema), issues),
    readJsonCollection(paths.releasesDir, releaseSchema.safeParse.bind(releaseSchema), issues),
    readJsonCollection(paths.announcementsDir, announcementSchema.safeParse.bind(announcementSchema), issues),
    readJsonCollection(paths.sessionsDir, agentSessionSchema.safeParse.bind(agentSessionSchema), issues),
    readTextIfExists(paths.conventionsFile),
    readTextIfExists(paths.contextFile),
  ]);

  const conventions =
    conventionFiles.length > 0 ? conventionFiles : await parseConventions(paths.conventionsFile, bridge.createdAt, issues);
  const lastSyncAt = parseContextTimestamp(contextMarkdown) ?? bridge.createdAt;

  return {
    bridge,
    contextMarkdown,
    conventionsMarkdown,
    tasks,
    logs,
    handoffs,
    decisions,
    conventions,
    messages,
    releases,
    announcements,
    sessions,
    repoPath: getRepoPath(root),
    lastSyncAt,
    issues,
  } satisfies AibridgeBridgeSnapshot;
}

export async function loadBridgeStatus(rootPath: string, accessOptions: BridgeAccessOptions = {}) {
  const root = await normalizeBridgeRoot(rootPath);
  const status = normalizeStatus(await loadBridgeSnapshot(root), accessOptions);
  status.capture = await readCaptureStatus(root);
  return status;
}

function assertAgentExists(bridge: AibridgeBridgeConfig, agentId: string | undefined) {
  if (!agentId) {
    return;
  }

  if (!bridge.agents.some((agent) => agent.id === agentId)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unknown agent: ${agentId}`);
  }
}

export async function updateBridgeSetup(rootPath: string, setup: BridgeSetupMetadata | undefined) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const bridge = await readBridgeConfig(paths, []);
    const updated = bridgeSchema.parse({
      ...bridge,
      setup: normalizeBridgeSetup(setup),
    });

    await writeJsonAtomic(paths.bridgeFile, updated);
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}

async function writeJsonAtomic(targetPath: string, value: unknown) {
  await ensureDir(path.dirname(targetPath));
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function writeTextAtomic(targetPath: string, value: string) {
  await ensureDir(path.dirname(targetPath));
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, value, "utf8");
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function appendLog(rootPath: string, log: AibridgeLogEntry) {
  const paths = getBridgePaths(rootPath);
  await ensureDir(paths.logsDir);
  const filename = `${log.timestamp.slice(0, 10)}.jsonl`;
  await fs.appendFile(path.join(paths.logsDir, filename), `${JSON.stringify(log)}\n`, "utf8");
}

async function createMutationLog(
  rootPath: string,
  agentId: string,
  action: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  const log = logEntrySchema.parse({
    id: `log-${randomUUID()}`,
    agentId,
    action,
    description,
    timestamp: new Date().toISOString(),
    metadata,
  });

  await appendLog(rootPath, log);
}

async function addStructuredLog(
  rootPath: string,
  payload: { agentId: string; action: string; description: string; metadata?: Record<string, unknown> },
  options: { allowUnknownAgent?: boolean } = {},
) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    const resolvedAgentId =
      payload.agentId === "unknown" || payload.agentId === "human"
        ? payload.agentId
        : snapshot.bridge.agents.some((agent) => agent.id === payload.agentId)
          ? payload.agentId
          : options.allowUnknownAgent
            ? "unknown"
            : undefined;
    if (!resolvedAgentId) {
      assertAgentExists(snapshot.bridge, payload.agentId);
    }

    const log = logEntrySchema.parse({
      id: `log-${randomUUID()}`,
      agentId: resolvedAgentId ?? payload.agentId,
      action: payload.action.trim(),
      description: payload.description.trim(),
      timestamp: new Date().toISOString(),
      metadata: payload.metadata,
    });

    await appendLog(lockedRoot, log);
    await regenerateContextUnlocked(lockedRoot);
    return log;
  });
}

async function regenerateContextUnlocked(rootPath: string, budget?: number) {
  const paths = getBridgePaths(rootPath);
  const snapshot = await loadBridgeSnapshot(rootPath);
  const markdown = compileContextMarkdown(snapshot, { budget, generatedAt: new Date().toISOString() });
  await writeTextAtomic(paths.contextFile, markdown);
  return markdown;
}

export async function regenerateContext(rootPath: string, budget?: number) {
  return withBridgeWriteLock(rootPath, async (root) => regenerateContextUnlocked(root, budget));
}

async function ensureBridge(rootPath: string) {
  const root = await normalizeBridgeRoot(rootPath);
  const bridgeFile = path.join(root, "bridge.json");
  if (!(await fileExists(bridgeFile))) {
    throw new BridgeRuntimeError("NOT_INITIALIZED", `No .aibridge directory found at ${root}.`, { rootPath: root });
  }

  return root;
}

async function resolveJsonFileById(dirPath: string, idOrPrefix: string) {
  const entries = (await fs.readdir(dirPath))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const exact = entries.find((entry) => entry === `${idOrPrefix}.json`);
  if (exact) {
    return path.join(dirPath, exact);
  }

  const matches = entries.filter((entry) => entry.startsWith(idOrPrefix));
  if (matches.length === 1) {
    return path.join(dirPath, matches[0]);
  }

  if (matches.length > 1) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `ID prefix "${idOrPrefix}" is ambiguous.`);
  }

  throw new BridgeRuntimeError("NOT_FOUND", `No file found for "${idOrPrefix}".`);
}

async function readTask(rootPath: string, idOrPrefix: string, issues: string[] = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).tasksDir, idOrPrefix);
  const task = await readJsonFile(filePath, taskSchema.safeParse.bind(taskSchema), issues);
  if (!task) {
    throw new BridgeRuntimeError("INVALID_STATE", `Task ${idOrPrefix} is invalid.`);
  }

  return { filePath, task, root };
}

async function readMessage(rootPath: string, idOrPrefix: string, issues: string[] = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).messagesDir, idOrPrefix);
  const message = await readJsonFile(filePath, messageSchema.safeParse.bind(messageSchema), issues);
  if (!message) {
    throw new BridgeRuntimeError("INVALID_STATE", `Message ${idOrPrefix} is invalid.`);
  }

  return { filePath, message, root };
}

async function readDecision(rootPath: string, idOrPrefix: string, issues: string[] = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).decisionsDir, idOrPrefix);
  const decision = await readJsonFile(filePath, decisionSchema.safeParse.bind(decisionSchema), issues);
  if (!decision) {
    throw new BridgeRuntimeError("INVALID_STATE", `Decision ${idOrPrefix} is invalid.`);
  }

  return { filePath, decision, root };
}

async function readRelease(rootPath: string, idOrPrefix: string, issues: string[] = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).releasesDir, idOrPrefix);
  const release = await readJsonFile(filePath, releaseSchema.safeParse.bind(releaseSchema), issues);
  if (!release) {
    throw new BridgeRuntimeError("INVALID_STATE", `Release ${idOrPrefix} is invalid.`);
  }

  return { filePath, release, root };
}

async function readAnnouncement(rootPath: string, idOrPrefix: string, issues: string[] = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).announcementsDir, idOrPrefix);
  const announcement = await readJsonFile(filePath, announcementSchema.safeParse.bind(announcementSchema), issues);
  if (!announcement) {
    throw new BridgeRuntimeError("INVALID_STATE", `Announcement ${idOrPrefix} is invalid.`);
  }

  return { filePath, announcement, root };
}

export async function listTasks(rootPath: string, filters: { status?: TaskStatus; agentId?: string } = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.tasks.filter((task) => {
    if (filters.status && task.status !== filters.status) {
      return false;
    }

    if (filters.agentId && task.agentId !== filters.agentId) {
      return false;
    }

    return true;
  });
}

export async function addTask(
  rootPath: string,
  payload: { title: string; priority?: AibridgeTask["priority"]; agentId?: string; status?: TaskStatus },
) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.agentId);

    const task = taskSchema.parse({
      id: `task-${randomUUID()}`,
      title: payload.title?.trim(),
      status: payload.status ?? "pending",
      priority: payload.priority ?? "medium",
      agentId: payload.agentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await writeJsonAtomic(path.join(paths.tasksDir, `${task.id}.json`), task);
    if (task.agentId) {
      await createMutationLog(lockedRoot, task.agentId, "create", `Created task: ${task.title}`, { taskId: task.id });
    }
    await regenerateContextUnlocked(lockedRoot);
    return task;
  });
}

export async function updateTask(rootPath: string, idOrPrefix: string, payload: TaskMutationPayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues: string[] = [];
    const { filePath, task } = await readTask(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);

    if (payload.agentId !== undefined) {
      assertAgentExists(snapshot.bridge, payload.agentId);
    }

    const updated = taskSchema.parse({
      ...task,
      title: payload.title?.trim() || task.title,
      priority: payload.priority ?? task.priority,
      agentId: payload.agentId ?? task.agentId,
      status: payload.status ?? task.status,
      updatedAt: new Date().toISOString(),
    });

    await writeJsonAtomic(filePath, updated);
    if (updated.agentId) {
      const action = payload.status === "done" ? "done" : payload.status === "in_progress" ? "start" : "update";
      await createMutationLog(lockedRoot, updated.agentId, action, `Updated task: ${updated.title}`, {
        taskId: updated.id,
        status: updated.status,
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}

export async function listMessages(
  rootPath: string,
  filters: { toAgentId?: string; severity?: AibridgeMessage["severity"]; unreadOnly?: boolean; limit?: number } = {},
) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const filtered = snapshot.messages.filter((message) => {
    if (filters.toAgentId && message.toAgentId !== filters.toAgentId) {
      return false;
    }

    if (filters.severity && message.severity !== filters.severity) {
      return false;
    }

    if (filters.unreadOnly && message.acknowledged) {
      return false;
    }

    return true;
  });

  return typeof filters.limit === "number" ? filtered.slice(0, filters.limit) : filtered;
}

export async function addMessage(rootPath: string, payload: MessageCreatePayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);

    assertAgentExists(snapshot.bridge, payload.fromAgentId);
    assertAgentExists(snapshot.bridge, payload.toAgentId);

    const message = messageSchema.parse({
      id: `message-${randomUUID()}`,
      fromAgentId: payload.fromAgentId,
      toAgentId: payload.toAgentId,
      severity: payload.severity ?? "info",
      content: payload.content.trim(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });

    await writeJsonAtomic(path.join(paths.messagesDir, `${message.id}.json`), message);
    await createMutationLog(lockedRoot, message.fromAgentId, "message", `Sent message: ${message.content}`, {
      messageId: message.id,
      toAgentId: message.toAgentId ?? "all",
    });
    await regenerateContextUnlocked(lockedRoot);
    return message;
  });
}

export async function acknowledgeMessage(rootPath: string, idOrPrefix: string) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues: string[] = [];
    const { filePath, message } = await readMessage(lockedRoot, idOrPrefix, issues);
    const updated = messageSchema.parse({
      ...message,
      acknowledged: true,
    });

    await writeJsonAtomic(filePath, updated);
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}

export async function listHandoffs(rootPath: string, filters: { agentId?: string } = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.handoffs.filter((handoff) => {
    if (!filters.agentId) {
      return true;
    }

    return handoff.fromAgentId === filters.agentId || handoff.toAgentId === filters.agentId;
  });
}

export async function createHandoff(rootPath: string, payload: HandoffCreatePayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);

    assertAgentExists(snapshot.bridge, payload.fromAgentId);
    assertAgentExists(snapshot.bridge, payload.toAgentId);

    if (payload.relatedTaskIds?.length) {
      for (const taskId of payload.relatedTaskIds) {
        const exists = snapshot.tasks.some((task) => task.id === taskId || task.id.startsWith(taskId));
        if (!exists) {
          throw new BridgeRuntimeError("VALIDATION_ERROR", `Unknown related task: ${taskId}`);
        }
      }
    }

    const handoff = handoffSchema.parse({
      id: `handoff-${randomUUID()}`,
      fromAgentId: payload.fromAgentId,
      toAgentId: payload.toAgentId,
      description: payload.description.trim(),
      timestamp: new Date().toISOString(),
      relatedTaskIds: payload.relatedTaskIds?.length ? payload.relatedTaskIds : undefined,
    });

    await writeJsonAtomic(path.join(paths.handoffsDir, `${handoff.id}.json`), handoff);
    await createMutationLog(lockedRoot, handoff.fromAgentId, "handoff", `Created handoff to ${handoff.toAgentId}`, {
      handoffId: handoff.id,
    });
    await regenerateContextUnlocked(lockedRoot);
    return handoff;
  });
}

export async function getStatusSummary(rootPath: string, accessOptions: BridgeAccessOptions = {}) {
  const root = await ensureBridge(rootPath);
  return loadBridgeStatus(root, accessOptions);
}

export function parseAgentSessionStatus(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (!agentSessionStatuses.includes(value as AibridgeAgentSessionStatus)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent session status: ${value}`);
  }

  return value as AibridgeAgentSessionStatus;
}

export function parseAgentToolKind(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (!agentToolKinds.includes(value as AibridgeAgentToolKind)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent tool: ${value}`);
  }

  return value as AibridgeAgentToolKind;
}

export function parseAgentLaunchSource(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (!agentLaunchSources.includes(value as AibridgeAgentLaunchSource)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent launch source: ${value}`);
  }

  return value as AibridgeAgentLaunchSource;
}

async function readAgentSession(rootPath: string, idOrPrefix: string) {
  const root = await ensureBridge(rootPath);
  const paths = getBridgePaths(root);
  const target = await resolveJsonFileById(paths.sessionsDir, idOrPrefix);
  return readJsonFile(target, agentSessionSchema.safeParse.bind(agentSessionSchema), []);
}

async function writeAgentSession(rootPath: string, session: AgentSessionDocument) {
  const paths = getBridgePaths(rootPath);
  await writeJsonAtomic(path.join(paths.sessionsDir, `${session.id}.json`), session);
}

export async function listAgentSessions(rootPath: string, filters: AgentSessionFilters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.sessions
    .map((session) => deriveAgentSession(snapshot, session))
    .filter((session) => {
      if (filters.agentId && session.agentId !== filters.agentId) {
        return false;
      }

      if (filters.toolKind && session.toolKind !== filters.toolKind) {
        return false;
      }

      if (filters.status && session.status !== filters.status) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.launchedAt.localeCompare(left.launchedAt));
}

export async function launchAgentSession(rootPath: string, payload: AgentSessionLaunchPayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.agentId);
    const agent = snapshot.bridge.agents.find((item) => item.id === payload.agentId);
    if (!agent) {
      throw new BridgeRuntimeError("NOT_FOUND", `Agent ${payload.agentId} is not configured for this bridge.`);
    }

    const launchedAt = new Date().toISOString();
    const sessionId = `session-${randomUUID()}`;
    const instructions = buildLaunchInstructionSet(
      snapshot,
      agent,
      parseAgentToolKind(payload.toolKind) ?? payload.toolKind,
      sessionId,
      parseAgentLaunchSource(payload.launchSource) ?? payload.launchSource ?? "cli",
      launchedAt,
    );

    const session = agentSessionSchema.parse({
      id: sessionId,
      agentId: agent.id,
      toolKind: instructions.toolKind,
      repoPath: snapshot.repoPath,
      bridgeRoot: lockedRoot,
      launchedAt,
      acknowledgedContextTimestamp: undefined,
      lastHeartbeatAt: undefined,
      lastActivityAt: undefined,
      launchSource: instructions.launchSource,
      status: "pending",
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === agent.id && task.status !== "done").map((task) => task.id),
      instructions,
      recovery: {
        recommended: false,
      },
    });

    await writeAgentSession(lockedRoot, session);
    await createMutationLog(lockedRoot, agent.id, "launch", `Created ${session.toolKind} launch prompt`, {
      sessionId: session.id,
      toolKind: session.toolKind,
      launchSource: session.launchSource,
    });
    await regenerateContextUnlocked(lockedRoot);

    const updated = await readAgentSession(lockedRoot, session.id);
    if (!updated) {
      throw new BridgeRuntimeError("INVALID_STATE", `Agent session ${session.id} could not be read after creation.`);
    }

    return deriveAgentSession(await loadBridgeSnapshot(lockedRoot), updated);
  });
}

async function updateAgentSessionState(
  rootPath: string,
  idOrPrefix: string,
  mutate: (session: AgentSessionDocument, snapshot: AibridgeBridgeSnapshot) => Promise<AgentSessionDocument>,
) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    const session = await readAgentSession(lockedRoot, idOrPrefix);
    if (!session) {
      throw new BridgeRuntimeError("NOT_FOUND", `Unknown agent session: ${idOrPrefix}`);
    }

    const updated = agentSessionSchema.parse(await mutate(session, snapshot));
    await writeAgentSession(lockedRoot, updated);
    await regenerateContextUnlocked(lockedRoot);
    const refreshed = await loadBridgeSnapshot(lockedRoot);
    const finalized =
      updated.status === "active" && refreshed.lastSyncAt > (updated.acknowledgedContextTimestamp ?? "")
        ? agentSessionSchema.parse({
            ...updated,
            acknowledgedContextTimestamp: refreshed.lastSyncAt,
          })
        : updated;
    if (finalized !== updated) {
      await writeAgentSession(lockedRoot, finalized);
    }
    return deriveAgentSession(refreshed, finalized);
  });
}

export async function startAgentSession(rootPath: string, idOrPrefix: string) {
  return updateAgentSessionState(rootPath, idOrPrefix, async (session, snapshot) => {
    const timestamp = new Date().toISOString();
    await createMutationLog(
      await ensureBridge(rootPath),
      session.agentId,
      "start",
      `Acknowledged session ${session.id}`,
      { sessionId: session.id, toolKind: session.toolKind },
    );
    return {
      ...session,
      status: "active",
      acknowledgedAt: timestamp,
      lastHeartbeatAt: timestamp,
      lastActivityAt: timestamp,
      acknowledgedContextTimestamp: snapshot.lastSyncAt,
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === session.agentId && task.status !== "done").map((task) => task.id),
      recovery: { recommended: false, generatedAt: timestamp },
    };
  });
}

export async function heartbeatAgentSession(rootPath: string, idOrPrefix: string) {
  return updateAgentSessionState(rootPath, idOrPrefix, async (session, snapshot) => {
    const timestamp = new Date().toISOString();
    await createMutationLog(
      await ensureBridge(rootPath),
      session.agentId,
      "heartbeat",
      `Heartbeat received for session ${session.id}`,
      { sessionId: session.id, toolKind: session.toolKind },
    );
    return {
      ...session,
      status: session.status === "failed" ? "failed" : "active",
      lastHeartbeatAt: timestamp,
      lastActivityAt: timestamp,
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === session.agentId && task.status !== "done").map((task) => task.id),
      recovery: { recommended: false, generatedAt: timestamp },
    };
  });
}

export async function stopAgentSession(rootPath: string, idOrPrefix: string, payload: AgentSessionMutationPayload = {}) {
  return updateAgentSessionState(rootPath, idOrPrefix, async (session, snapshot) => {
    const timestamp = new Date().toISOString();
    await createMutationLog(
      await ensureBridge(rootPath),
      session.agentId,
      "stop",
      payload.reason?.trim() ? `Stopped session: ${payload.reason.trim()}` : `Stopped session ${session.id}`,
      { sessionId: session.id, toolKind: session.toolKind, reason: payload.reason?.trim() || undefined },
    );
    return {
      ...session,
      status: "stopped",
      stoppedAt: timestamp,
      stoppedReason: payload.reason?.trim() || "Agent session was stopped manually.",
      lastHeartbeatAt: session.lastHeartbeatAt ?? timestamp,
      lastActivityAt: timestamp,
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === session.agentId && task.status !== "done").map((task) => task.id),
      recovery: {
        recommended: snapshot.tasks.some((task) => task.agentId === session.agentId && task.status !== "done"),
        reason: payload.reason?.trim() || "Agent session was stopped manually.",
        generatedAt: timestamp,
      },
    };
  });
}

export async function getAgentSessionRecovery(rootPath: string, idOrPrefix: string) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const session = await readAgentSession(root, idOrPrefix);
  if (!session) {
    throw new BridgeRuntimeError("NOT_FOUND", `Unknown agent session: ${idOrPrefix}`);
  }

  return deriveAgentSession(snapshot, session);
}

export async function listDecisions(
  rootPath: string,
  filters: { status?: AibridgeDecision["status"] } = {},
) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.decisions.filter((decision) => {
    if (!filters.status) {
      return true;
    }

    return decision.status === filters.status;
  });
}

export async function addDecision(
  rootPath: string,
  payload: { title: string; summary: string; status?: AibridgeDecision["status"]; agentId?: string },
) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.agentId);
    const decision = decisionSchema.parse({
      id: `decision-${randomUUID()}`,
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      timestamp: new Date().toISOString(),
      status: payload.status ?? "proposed",
    });

    await writeJsonAtomic(path.join(paths.decisionsDir, `${decision.id}.json`), decision);
    if (payload.agentId) {
      await createMutationLog(lockedRoot, payload.agentId, "decision", `Recorded decision: ${decision.title}`, {
        decisionId: decision.id,
        status: decision.status ?? "proposed",
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return decision;
  });
}

export async function updateDecisionStatus(
  rootPath: string,
  idOrPrefix: string,
  status: NonNullable<AibridgeDecision["status"]>,
  agentId?: string,
) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues: string[] = [];
    const { filePath, decision } = await readDecision(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, agentId);

    const updated = decisionSchema.parse({
      ...decision,
      status,
    });

    await writeJsonAtomic(filePath, updated);
    if (agentId) {
      await createMutationLog(lockedRoot, agentId, "decision", `Updated decision: ${updated.title}`, {
        decisionId: updated.id,
        status,
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}

export async function listReleases(rootPath: string, filters: ReleaseFilters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const access = resolveBridgeAccess(filters.access);
  const visible = filterVisibleReleases(snapshot.releases, access);

  return visible.filter((release) => {
    if (filters.status && release.status !== filters.status) {
      return false;
    }

    if (!filters.includeArchived && release.status === "archived") {
      return false;
    }

    return true;
  });
}

export async function addRelease(rootPath: string, payload: ReleaseCreatePayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);

    const createdAt = new Date().toISOString();
    const status = payload.status ?? "draft";
    const release = releaseSchema.parse({
      id: `release-${randomUUID()}`,
      version: payload.version.trim(),
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      status,
      publishedAt: status === "published" ? createdAt : undefined,
      highlights: normalizeList(payload.highlights),
      breakingChanges: normalizeList(payload.breakingChanges),
      upgradeNotes: normalizeList(payload.upgradeNotes),
      tags: normalizeList(payload.tags),
      createdBy: payload.createdBy,
      createdAt,
      updatedAt: createdAt,
    });

    await writeJsonAtomic(path.join(paths.releasesDir, `${release.id}.json`), release);
    if (release.createdBy) {
      await createMutationLog(
        lockedRoot,
        release.createdBy,
        "release",
        `${release.status === "published" ? "Published" : "Drafted"} release: ${release.version}`,
        { releaseId: release.id, status: release.status },
      );
    }
    await regenerateContextUnlocked(lockedRoot);
    return release;
  });
}

export async function updateRelease(rootPath: string, idOrPrefix: string, payload: ReleaseUpdatePayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues: string[] = [];
    const { filePath, release } = await readRelease(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);

    const nextStatus = payload.status ?? release.status;
    const updated = releaseSchema.parse({
      ...release,
      version: payload.version?.trim() || release.version,
      title: payload.title?.trim() || release.title,
      summary: payload.summary?.trim() || release.summary,
      status: nextStatus,
      publishedAt:
        nextStatus === "published"
          ? payload.publishedAt?.trim() || release.publishedAt || new Date().toISOString()
          : payload.publishedAt !== undefined
            ? payload.publishedAt
            : release.publishedAt,
      highlights: payload.highlights ? normalizeList(payload.highlights) : release.highlights,
      breakingChanges: payload.breakingChanges ? normalizeList(payload.breakingChanges) : release.breakingChanges,
      upgradeNotes: payload.upgradeNotes ? normalizeList(payload.upgradeNotes) : release.upgradeNotes,
      tags: payload.tags ? normalizeList(payload.tags) : release.tags,
      createdBy: payload.createdBy ?? release.createdBy,
      updatedAt: new Date().toISOString(),
    });

    await writeJsonAtomic(filePath, updated);
    if (updated.createdBy) {
      await createMutationLog(lockedRoot, updated.createdBy, "release", `Updated release: ${updated.version}`, {
        releaseId: updated.id,
        status: updated.status,
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}

export async function listAnnouncements(rootPath: string, filters: AnnouncementFilters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const access = resolveBridgeAccess(filters.access);
  const visible = filterVisibleAnnouncements(snapshot.announcements, access);

  return visible.filter((announcement) => {
    if (filters.status && announcement.status !== filters.status) {
      return false;
    }

    if (!filters.includeArchived && announcement.status === "archived") {
      return false;
    }

    return true;
  });
}

export async function addAnnouncement(rootPath: string, payload: AnnouncementCreatePayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);

    const createdAt = new Date().toISOString();
    const status = payload.status ?? "draft";
    const announcement = announcementSchema.parse({
      id: `announcement-${randomUUID()}`,
      title: payload.title.trim(),
      body: payload.body.trim(),
      status,
      audience: payload.audience ?? "all",
      severity: payload.severity ?? "info",
      publishedAt: status === "published" || status === "pinned" ? payload.publishedAt ?? createdAt : payload.publishedAt,
      expiresAt: payload.expiresAt,
      createdBy: payload.createdBy,
      createdAt,
      updatedAt: createdAt,
    });

    await writeJsonAtomic(path.join(paths.announcementsDir, `${announcement.id}.json`), announcement);
    if (announcement.createdBy) {
      await createMutationLog(
        lockedRoot,
        announcement.createdBy,
        "announcement",
        `${announcement.status === "draft" ? "Drafted" : "Published"} announcement: ${announcement.title}`,
        { announcementId: announcement.id, status: announcement.status, audience: announcement.audience },
      );
    }
    await regenerateContextUnlocked(lockedRoot);
    return announcement;
  });
}

export async function updateAnnouncement(rootPath: string, idOrPrefix: string, payload: AnnouncementUpdatePayload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues: string[] = [];
    const { filePath, announcement } = await readAnnouncement(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);

    const nextStatus = payload.status ?? announcement.status;
    const updated = announcementSchema.parse({
      ...announcement,
      title: payload.title?.trim() || announcement.title,
      body: payload.body?.trim() || announcement.body,
      status: nextStatus,
      audience: payload.audience ?? announcement.audience,
      severity: payload.severity ?? announcement.severity,
      publishedAt:
        nextStatus === "published" || nextStatus === "pinned"
          ? payload.publishedAt?.trim() || announcement.publishedAt || new Date().toISOString()
          : payload.publishedAt !== undefined
            ? payload.publishedAt
            : announcement.publishedAt,
      expiresAt: payload.expiresAt === null ? undefined : payload.expiresAt ?? announcement.expiresAt,
      createdBy: payload.createdBy ?? announcement.createdBy,
      updatedAt: new Date().toISOString(),
    });

    await writeJsonAtomic(filePath, updated);
    if (updated.createdBy) {
      await createMutationLog(
        lockedRoot,
        updated.createdBy,
        "announcement",
        `Updated announcement: ${updated.title}`,
        { announcementId: updated.id, status: updated.status, audience: updated.audience },
      );
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}

export async function listConventions(rootPath: string) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.conventions;
}

export async function addConvention(
  rootPath: string,
  payload: { rule: string; addedBy?: string; category?: AibridgeConvention["category"] },
) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.addedBy);

    const convention = conventionSchema.parse({
      id: `convention-${randomUUID()}`,
      rule: payload.rule.trim(),
      addedAt: new Date().toISOString(),
      addedBy: payload.addedBy,
      category: payload.category,
    });

    await ensureDir(paths.conventionsDir);
    await writeJsonAtomic(path.join(paths.conventionsDir, `${convention.id}.json`), convention);
    const updatedConventions = [...snapshot.conventions, convention];
    await writeTextAtomic(paths.conventionsFile, conventionsToMarkdownDocument(updatedConventions));
    if (payload.addedBy) {
      await createMutationLog(lockedRoot, payload.addedBy, "convention", "Added convention", {
        conventionId: convention.id,
        category: convention.category ?? "other",
      });
    }

    await regenerateContextUnlocked(lockedRoot);
    return convention;
  });
}

export async function setConventions(
  rootPath: string,
  payload: Array<{ rule: string; addedBy?: string; category?: AibridgeConvention["category"]; id?: string; addedAt?: string }>,
) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);

    for (const item of payload) {
      assertAgentExists(snapshot.bridge, item.addedBy);
    }

    await ensureDir(paths.conventionsDir);
    const existing = await fs.readdir(paths.conventionsDir).catch(() => []);
    await Promise.all(
      existing
        .filter((name) => name.endsWith(".json"))
        .map((name) => fs.rm(path.join(paths.conventionsDir, name), { force: true })),
    );

    const conventions = payload.map((item, index) =>
      conventionSchema.parse({
        id: item.id ?? `convention-${randomUUID()}`,
        rule: item.rule.trim(),
        addedAt: item.addedAt ?? new Date(Date.now() + index).toISOString(),
        addedBy: item.addedBy,
        category: item.category,
      }),
    );

    await Promise.all(
      conventions.map((convention) =>
        writeJsonAtomic(path.join(paths.conventionsDir, `${convention.id}.json`), convention),
      ),
    );
    await writeTextAtomic(paths.conventionsFile, conventionsToMarkdownDocument(conventions));
    await regenerateContextUnlocked(lockedRoot);
    return conventions;
  });
}

export async function showConventionsMarkdown(rootPath: string) {
  const root = await ensureBridge(rootPath);
  return readTextIfExists(getBridgePaths(root).conventionsFile);
}

export async function listLogs(rootPath: string, filters: { agentId?: string; limit?: number } = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const filtered = snapshot.logs.filter((log) => {
    if (filters.agentId && log.agentId !== filters.agentId) return false;
    return true;
  });
  return typeof filters.limit === "number" ? filtered.slice(0, filters.limit) : filtered;
}

export async function addLog(
  rootPath: string,
  payload: { agentId: string; action: string; description: string; metadata?: Record<string, unknown> },
) {
  return addStructuredLog(rootPath, payload);
}

export async function addCapturedLog(
  rootPath: string,
  payload: { agentId: string; action: string; description: string; metadata?: Record<string, unknown> },
) {
  return addStructuredLog(rootPath, payload, { allowUnknownAgent: true });
}

async function createMissingStructure(paths: BridgePaths) {
  await Promise.all([
    ensureDir(paths.root),
    ensureDir(paths.captureDir),
    ensureDir(paths.agentsDir),
    ensureDir(paths.tasksDir),
    ensureDir(paths.logsDir),
    ensureDir(paths.handoffsDir),
    ensureDir(paths.decisionsDir),
    ensureDir(paths.conventionsDir),
    ensureDir(paths.messagesDir),
    ensureDir(paths.releasesDir),
    ensureDir(paths.announcementsDir),
    ensureDir(paths.sessionsDir),
  ]);
}

async function createAgentTemplate(kind: AibridgeAgentKind, destinationPath: string) {
  const templatePath = path.resolve(PROTOCOL_TEMPLATES_ROOT, `${kind}.md`);
  if (await fileExists(destinationPath)) {
    return false;
  }

  const template = await readTextIfExists(templatePath);
  await fs.writeFile(destinationPath, template || `# ${AGENT_LABELS[kind]}\n`, "utf8");
  return true;
}

function uniqueAgentKinds(agentIds: string[]) {
  const seen = new Set<string>();
  const normalized: AibridgeAgentKind[] = [];

  for (const raw of agentIds.map((value) => value.trim()).filter(Boolean)) {
    if (!agentKinds.includes(raw as AibridgeAgentKind)) {
      throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent kind: ${raw}`);
    }

    if (!seen.has(raw)) {
      normalized.push(raw as AibridgeAgentKind);
      seen.add(raw);
    }
  }

  return normalized.length > 0 ? normalized : (["cursor"] satisfies AibridgeAgentKind[]);
}

export type AddAgentResult = { added: true; agentId: string } | { added: false; reason: string };

export async function addAgent(rootPath: string, agentKind: string): Promise<AddAgentResult> {
  const kind = agentKind.trim().toLowerCase();
  if (!agentKinds.includes(kind as AibridgeAgentKind)) {
    throw new BridgeRuntimeError(
      "VALIDATION_ERROR",
      `Unsupported agent kind: ${agentKind}. Use one of: ${agentKinds.join(", ")}`,
    );
  }

  return withBridgeWriteLock(rootPath, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    if (!(await fileExists(paths.bridgeFile))) {
      return { added: false, reason: "No bridge found. Run `aibridge init` first." };
    }

    const bridge = await readBridgeConfig(paths, []);
    if (bridge.agents.some((a) => a.kind === kind)) {
      return { added: false, reason: `Agent ${kind} is already in the bridge.` };
    }

    const newAgent = buildAgent(kind as AibridgeAgentKind);
    const updatedBridge = bridgeSchema.parse({
      ...bridge,
      agents: [...bridge.agents, newAgent],
    });
    await writeJsonAtomic(paths.bridgeFile, updatedBridge);

    const agentPath = path.join(paths.agentsDir, `${kind}.md`);
    await ensureDir(paths.agentsDir);
    await createAgentTemplate(kind as AibridgeAgentKind, agentPath);

    return { added: true, agentId: kind };
  });
}

export async function initBridge(options: InitBridgeOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const root = path.resolve(cwd, DEFAULT_BRIDGE_DIRNAME);
  await ensureDir(root);

  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);

    await createMissingStructure(paths);

    const createdFiles: string[] = [];
    const alreadyInitialized = await fileExists(paths.bridgeFile);
    const normalizedSetup = normalizeBridgeSetup(options.setup);

    if (!alreadyInitialized) {
      const bridge = bridgeSchema.parse({
        schemaVersion: "1.0",
        projectName: options.name?.trim() || path.basename(cwd),
        createdAt: new Date().toISOString(),
        agents: uniqueAgentKinds(options.agents ?? ["cursor"]).map(buildAgent),
        setup: normalizedSetup,
      });

      await writeJsonAtomic(paths.bridgeFile, bridge);
      createdFiles.push(paths.bridgeFile);
    }

    if (!(await fileExists(paths.conventionsFile))) {
      await fs.writeFile(
        paths.conventionsFile,
        "# Project Conventions\n\n> Shared rules all agents must follow. Managed via `aibridge convention add`.\n",
        "utf8",
      );
      createdFiles.push(paths.conventionsFile);
    }

    let bridge = await readBridgeConfig(paths, []);
    if (normalizedSetup) {
      const updatedBridge = bridgeSchema.parse({
        ...bridge,
        projectName: options.name?.trim() || bridge.projectName,
        agents:
          options.agents && options.agents.length > 0
            ? uniqueAgentKinds(options.agents).map(buildAgent)
            : bridge.agents,
        setup: normalizedSetup,
      });

      await writeJsonAtomic(paths.bridgeFile, updatedBridge);
      bridge = updatedBridge;
    }

    for (const agent of bridge.agents) {
      const destinationPath = path.join(paths.agentsDir, `${agent.kind}.md`);
      if (await createAgentTemplate(agent.kind, destinationPath)) {
        createdFiles.push(destinationPath);
      }
    }

    const contextExisted = await fileExists(paths.contextFile);
    const markdown = await regenerateContextUnlocked(lockedRoot);
    if (!alreadyInitialized || !contextExisted || markdown.length > 0) {
      createdFiles.push(paths.contextFile);
    }

    return {
      rootPath: lockedRoot,
      createdFiles,
      alreadyInitialized,
    } satisfies InitBridgeResult;
  });
}

function formatTimestampForStatus(timestamp: string) {
  return timestamp.replace("T", " ").replace("Z", "Z");
}

export function formatStatusText(status: AibridgeStatus) {
  const criticalUnread = status.messages.filter((message) => !message.acknowledged && message.severity === "critical").length;
  const unread = status.messages.filter((message) => !message.acknowledged).length;
  const recentActivity = status.logs.slice(0, 5);

  const lines = [
    `Project: ${status.context.projectName}`,
    `Repo:    ${status.context.repoPath}`,
    `Synced:  ${formatTimestampForStatus(status.context.lastSyncAt)}`,
    "",
    `Tasks:   ${status.context.taskCounts.pending} pending · ${status.context.taskCounts.in_progress} in progress · ${status.context.taskCounts.done} done`,
    `Messages: ${unread} unread${criticalUnread > 0 ? ` (${criticalUnread} critical)` : ""}`,
    `Handoffs: ${status.handoffs.length} open`,
    "",
    "Recent Activity:",
  ];

  if (recentActivity.length === 0) {
    lines.push("  (none)");
  } else {
    recentActivity.forEach((entry) => {
      lines.push(`  [${entry.timestamp.slice(11, 16)}] ${entry.agentId} - ${entry.action}: ${entry.description}`);
    });
  }

  return `${lines.join("\n")}\n`;
}

export function parsePriority(value: string | undefined) {
  if (!value) {
    return "medium" as const;
  }

  if (!priorities.includes(value as (typeof priorities)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid priority: ${value}`);
  }

  return value as AibridgeTask["priority"];
}

export function parseTaskStatus(value: string) {
  if (!["pending", "in_progress", "done"].includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid task status: ${value}`);
  }

  return value as TaskStatus;
}

export function parseMessageSeverity(value: string) {
  if (!messageSeverities.includes(value as (typeof messageSeverities)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid message severity: ${value}`);
  }

  return value as AibridgeMessage["severity"];
}

export function parseDecisionStatus(value: string) {
  if (!decisionStatuses.includes(value as (typeof decisionStatuses)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid decision status: ${value}`);
  }

  return value as NonNullable<AibridgeDecision["status"]>;
}

export function parseReleaseStatus(value: string) {
  if (!releaseStatuses.includes(value as (typeof releaseStatuses)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid release status: ${value}`);
  }

  return value as AibridgeRelease["status"];
}

export function parseAnnouncementStatus(value: string) {
  if (!announcementStatuses.includes(value as (typeof announcementStatuses)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid announcement status: ${value}`);
  }

  return value as AibridgeAnnouncement["status"];
}

export function parseAnnouncementAudience(value: string) {
  if (!announcementAudiences.includes(value as (typeof announcementAudiences)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid announcement audience: ${value}`);
  }

  return value as AibridgeAnnouncementAudience;
}

export function parseAnnouncementSeverity(value: string) {
  if (!announcementSeverities.includes(value as (typeof announcementSeverities)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid announcement severity: ${value}`);
  }

  return value as AibridgeAnnouncementSeverity;
}

export function parseConventionCategory(value: string) {
  if (!conventionCategories.includes(value as (typeof conventionCategories)[number])) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid convention category: ${value}`);
  }

  return value as AibridgeConvention["category"];
}

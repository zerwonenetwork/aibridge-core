import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type {
  AibridgeAgent,
  AibridgeCaptureAttribution,
  AibridgeCaptureConfidence,
  AibridgeCaptureStatus,
} from "../../../src/lib/aibridge/types";
import { BridgeRuntimeError, addCapturedLog, loadBridgeSnapshot, resolveBridgeRoot } from "../../runtime/store";
import {
  appendCaptureValidationWarning,
  getCapturePaths,
  isWatcherProcessAlive,
  markWatcherStopped,
  readCaptureStatus,
  updateCaptureStatus,
} from "./state";

const execFileAsync = promisify(execFile);
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
// When bundled (dist-cli/aibridge.js), package root is one level up. When from source (aibridge/services/capture/), repo root is three levels up.
const TOOL_ROOT =
  path.basename(CURRENT_DIR) === "dist-cli"
    ? path.resolve(CURRENT_DIR, "..")
    : path.resolve(CURRENT_DIR, "../../..");
const CLI_ENTRY = path.join(TOOL_ROOT, "aibridge", "cli", "bin", "aibridge.ts");
const TSX_CLI = path.join(TOOL_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const IS_PUBLISHED_BUNDLE = path.basename(CURRENT_DIR) === "dist-cli";
const HOOK_MARKER = "# aibridge capture hook";
const DEFAULT_HOOKS = ["post-commit", "post-merge", "post-checkout"] as const;
const DEFAULT_WATCH_DEBOUNCE_MS = 1500;
const DEFAULT_WATCH_SCAN_INTERVAL_MS = 750;
const HEARTBEAT_INTERVAL_MS = 2000;
const WATCHER_STOP_TIMEOUT_MS = 5000;
const IGNORED_PREFIXES = [
  ".aibridge/",
  ".git/",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
];

type HookName = (typeof DEFAULT_HOOKS)[number];

interface DetectedAttribution extends AibridgeCaptureAttribution {
  rawAgentId: string;
}

export interface InstallHooksResult {
  repoRoot: string;
  hooksDir: string;
  installed: string[];
  updated: string[];
}

export interface CaptureDoctorResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; details: string }>;
}

export interface HandleHookOptions {
  cwd?: string;
  hookName: HookName;
  args?: string[];
  explicitAgentId?: string;
}

export interface StartCaptureWatcherOptions {
  cwd?: string;
  agentId?: string;
  debounceMs?: number;
  scanIntervalMs?: number;
  onBatch?: (paths: string[]) => void;
}

export interface RunningCaptureWatcher {
  close: () => Promise<void>;
  getStatus: () => Promise<AibridgeCaptureStatus>;
}

export interface StopCaptureWatcherResult {
  stopped: boolean;
  details: string;
  status: AibridgeCaptureStatus;
}

interface CaptureEventInput {
  agentId?: string;
  action?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  source: "git-hook" | "watcher";
  attributionSource?: string;
  confidence?: AibridgeCaptureConfidence;
}

function repoRootFromBridgeRoot(bridgeRoot: string) {
  return path.basename(bridgeRoot) === ".aibridge" ? path.dirname(bridgeRoot) : bridgeRoot;
}

function normalizePathForPattern(value: string) {
  return value.replace(/\\/g, "/").toLowerCase();
}

function agentPatternMatch(value: string) {
  const normalized = normalizePathForPattern(value);
  if (!normalized) {
    return null;
  }

  const patterns: Array<{ token: string; agentId: string }> = [
    { token: ".cursor", agentId: "cursor" },
    { token: "cursor", agentId: "cursor" },
    { token: ".claude", agentId: "claude" },
    { token: "claude", agentId: "claude" },
    { token: ".codex", agentId: "codex" },
    { token: "codex", agentId: "codex" },
    { token: "windsurf", agentId: "windsurf" },
    { token: "copilot", agentId: "copilot" },
    { token: "antigravity", agentId: "antigravity" },
  ];

  return patterns.find((pattern) => normalized.includes(pattern.token))?.agentId ?? null;
}

function isIgnoredPath(relativePath: string) {
  const normalized = normalizePathForPattern(relativePath);
  if (!normalized || normalized === ".") {
    return false;
  }

  if (IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  return normalized.endsWith(".log");
}

async function resolveGitDir(repoRoot: string) {
  const gitPath = path.join(repoRoot, ".git");
  const stats = await fs.stat(gitPath).catch(() => null);
  if (!stats) {
    throw new BridgeRuntimeError("NOT_FOUND", `No .git directory found at ${repoRoot}.`);
  }

  if (stats.isDirectory()) {
    return gitPath;
  }

  const raw = await fs.readFile(gitPath, "utf8");
  const match = raw.match(/^gitdir:\s*(.+)$/im);
  if (!match?.[1]) {
    throw new BridgeRuntimeError("INVALID_STATE", `Unsupported .git file format at ${gitPath}.`);
  }

  return path.resolve(repoRoot, match[1].trim());
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildHookScript(repoRoot: string, hookName: HookName) {
  const targetRoot = repoRoot.replace(/\\/g, "/");
  if (IS_PUBLISHED_BUNDLE) {
    return `#!/bin/sh
${HOOK_MARKER}
set -e
HOOK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKUP="$HOOK_DIR/${hookName}.aibridge.backup"
if [ -x "$BACKUP" ]; then
  "$BACKUP" "$@"
fi
cd "${targetRoot}" || exit 1
aibridge capture hook ${hookName} "$@" || true
`;
  }
  const toolRoot = TOOL_ROOT.replace(/\\/g, "/");
  return `#!/bin/sh
${HOOK_MARKER}
set -e
HOOK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKUP="$HOOK_DIR/${hookName}.aibridge.backup"
if [ -x "$BACKUP" ]; then
  "$BACKUP" "$@"
fi
cd "${targetRoot}" || exit 1
if [ -f "${toolRoot}/node_modules/tsx/dist/cli.mjs" ]; then
  node "${toolRoot}/node_modules/tsx/dist/cli.mjs" "${toolRoot}/aibridge/cli/bin/aibridge.ts" capture hook ${hookName} "$@" || true
fi
`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function installManagedHook(hooksDir: string, repoRoot: string, hookName: HookName) {
  const hookPath = path.join(hooksDir, hookName);
  const backupPath = `${hookPath}.aibridge.backup`;
  const nextScript = buildHookScript(repoRoot, hookName);
  let state: "installed" | "updated" = "installed";

  if (await pathExists(hookPath)) {
    const current = await fs.readFile(hookPath, "utf8");
    if (current === nextScript) {
      return null;
    }

    if (!current.includes(HOOK_MARKER) && current.trim().length > 0 && !(await pathExists(backupPath))) {
      await fs.rename(hookPath, backupPath);
    }

    state = "updated";
  }

  await fs.writeFile(hookPath, nextScript, { mode: 0o755, encoding: "utf8" });
  await fs.chmod(hookPath, 0o755).catch(() => undefined);
  return state;
}

function renderCaptureStatus(status: AibridgeCaptureStatus) {
  const lines = [
    `Watcher: ${status.watcher.running ? "running" : "stopped"}`,
    `Hooks:   ${status.hooksInstalled.length > 0 ? status.hooksInstalled.join(", ") : "(none)"}`,
    `Warnings:${status.validationWarnings}`,
  ];

  if (status.watcher.pid) {
    lines.push(`PID:     ${status.watcher.pid}`);
  }
  if (status.watcher.watchedRoot) {
    lines.push(`Root:    ${status.watcher.watchedRoot}`);
  }
  if (status.watcher.startedAt) {
    lines.push(`Started: ${status.watcher.startedAt}`);
  }
  if (status.watcher.lastHeartbeatAt) {
    lines.push(`Heartbeat: ${status.watcher.lastHeartbeatAt}`);
  }
  if (status.watcher.lastEventAt) {
    lines.push(`Last event: ${status.watcher.lastEventAt}`);
  }
  if (status.lastCapturedAt) {
    lines.push(`Last captured: ${status.lastCapturedAt}`);
  }
  if (status.watcher.attribution) {
    lines.push(
      `Attribution: ${status.watcher.attribution.agentId} via ${status.watcher.attribution.source} (${status.watcher.attribution.confidence})`,
    );
  }
  if (status.watcher.lastError) {
    lines.push(`Last error: ${status.watcher.lastError}`);
  }

  return `${lines.join("\n")}\n`;
}

async function execGit(repoRoot: string, args: string[]) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: repoRoot });
    return stdout.trim();
  } catch (error) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Git command failed: git ${args.join(" ")}`, {
      reason: (error as Error).message,
    });
  }
}

function resolveAgentFromBridge(agents: AibridgeAgent[], candidate: string) {
  if (candidate === "unknown" || candidate === "human") {
    return candidate;
  }

  const exact = agents.find((agent) => agent.id === candidate);
  if (exact) {
    return exact.id;
  }

  const byKind = agents.find((agent) => agent.kind === candidate);
  return byKind?.id ?? "unknown";
}

function detectAttribution(options: {
  bridgeAgents: AibridgeAgent[];
  explicitAgentId?: string;
  changedPaths?: string[];
  authorName?: string;
  env?: NodeJS.ProcessEnv;
}): DetectedAttribution {
  const env = options.env ?? process.env;
  const explicit = options.explicitAgentId?.trim();
  if (explicit) {
    const agentId = resolveAgentFromBridge(options.bridgeAgents, explicit);
    return {
      agentId,
      rawAgentId: explicit,
      source: "explicit",
      confidence: "high",
    };
  }

  const envCandidates = [
    ["AIBRIDGE_AGENT", env.AIBRIDGE_AGENT],
    ["AGENT", env.AGENT],
    ["CODEX_AGENT", env.CODEX_AGENT],
  ] as const;
  for (const [key, value] of envCandidates) {
    if (!value?.trim()) {
      continue;
    }

    const agentId = resolveAgentFromBridge(options.bridgeAgents, value.trim());
    return {
      agentId,
      rawAgentId: value.trim(),
      source: `env:${key}`,
      confidence: "high",
    };
  }

  const authorMatch = options.authorName ? agentPatternMatch(options.authorName) : null;
  if (authorMatch) {
    return {
      agentId: resolveAgentFromBridge(options.bridgeAgents, authorMatch),
      rawAgentId: authorMatch,
      source: "git-author",
      confidence: "medium",
    };
  }

  const pathMatch = options.changedPaths?.map(agentPatternMatch).find(Boolean) ?? null;
  if (pathMatch) {
    return {
      agentId: resolveAgentFromBridge(options.bridgeAgents, pathMatch),
      rawAgentId: pathMatch,
      source: "path-marker",
      confidence: "low",
    };
  }

  return {
    agentId: "unknown",
    rawAgentId: "unknown",
    source: "fallback",
    confidence: "low",
  };
}

async function recordCaptureWarning(
  bridgeRoot: string,
  kind: "malformed-event" | "invalid-agent" | "invalid-metadata",
  message: string,
  payload?: Record<string, unknown>,
) {
  const timestamp = new Date().toISOString();
  await appendCaptureValidationWarning(bridgeRoot, {
    id: `capture-warning-${randomUUID()}`,
    timestamp,
    kind,
    message,
    payload,
  });
  await updateCaptureStatus(bridgeRoot, (current) => ({
    ...current,
    validationWarnings: current.validationWarnings + 1,
    lastWarningAt: timestamp,
  }));
}

async function ingestCaptureEvent(bridgeRoot: string, input: CaptureEventInput, agents: AibridgeAgent[]) {
  const action = input.action?.trim();
  const description = input.description?.trim();

  if (!action || !description) {
    await recordCaptureWarning(bridgeRoot, "malformed-event", "Capture event was missing action or description.", {
      action: input.action,
      description: input.description,
      source: input.source,
    });
    return null;
  }

  if (input.metadata !== undefined && (typeof input.metadata !== "object" || input.metadata === null)) {
    await recordCaptureWarning(bridgeRoot, "invalid-metadata", "Capture event metadata must be an object.", {
      source: input.source,
    });
    return null;
  }

  const requestedAgentId = input.agentId?.trim() || "unknown";
  const resolvedAgentId = resolveAgentFromBridge(agents, requestedAgentId);
  if (requestedAgentId !== resolvedAgentId && requestedAgentId !== "unknown") {
    await recordCaptureWarning(bridgeRoot, "invalid-agent", `Unknown capture agent "${requestedAgentId}". Falling back to unknown.`, {
      requestedAgentId,
      source: input.source,
    });
  }

  const metadata = {
    ...(input.metadata ?? {}),
    capture: {
      source: input.source,
      attributionSource: input.attributionSource ?? "unknown",
      confidence: input.confidence ?? "low",
    },
  } satisfies Record<string, unknown>;

  return addCapturedLog(bridgeRoot, {
    agentId: resolvedAgentId,
    action,
    description,
    metadata,
  });
}

export async function recordCaptureEvent(options: { cwd?: string } & CaptureEventInput) {
  const bridgeRoot = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  const snapshot = await loadBridgeSnapshot(bridgeRoot);
  return ingestCaptureEvent(bridgeRoot, options, snapshot.bridge.agents);
}

async function collectWorkspaceSnapshot(repoRoot: string) {
  const files = new Map<string, { mtimeMs: number; size: number }>();

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(repoRoot, fullPath);
      if (isIgnoredPath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(fullPath);
      files.set(relativePath, {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
      });
    }
  }

  await walk(repoRoot);
  return files;
}

function diffSnapshots(
  previous: Map<string, { mtimeMs: number; size: number }>,
  next: Map<string, { mtimeMs: number; size: number }>,
) {
  const changed = new Set<string>();
  for (const [relativePath, details] of next.entries()) {
    const prior = previous.get(relativePath);
    if (!prior || prior.mtimeMs !== details.mtimeMs || prior.size !== details.size) {
      changed.add(relativePath);
    }
  }

  for (const relativePath of previous.keys()) {
    if (!next.has(relativePath)) {
      changed.add(relativePath);
    }
  }

  return [...changed].sort((left, right) => left.localeCompare(right));
}

function summarizeChangedPaths(paths: string[]) {
  if (paths.length === 0) {
    return "Modified files";
  }

  const preview = paths.slice(0, 5).join(", ");
  return paths.length > 5 ? `Modified ${paths.length} files: ${preview}, ...` : `Modified ${paths.length} files: ${preview}`;
}

export async function installCaptureHooks(options: { cwd?: string } = {}) {
  const bridgeRoot = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  await loadBridgeSnapshot(bridgeRoot);
  const repoRoot = repoRootFromBridgeRoot(bridgeRoot);
  const gitDir = await resolveGitDir(repoRoot);
  const hooksDir = path.join(gitDir, "hooks");
  await fs.mkdir(hooksDir, { recursive: true });

  const installed: string[] = [];
  const updated: string[] = [];

  for (const hookName of DEFAULT_HOOKS) {
    const result = await installManagedHook(hooksDir, repoRoot, hookName);
    if (result === "installed") {
      installed.push(hookName);
    }
    if (result === "updated") {
      updated.push(hookName);
    }
  }

  await updateCaptureStatus(bridgeRoot, (current) => ({
    ...current,
    hooksInstalled: [...DEFAULT_HOOKS],
  }));

  return {
    repoRoot,
    hooksDir,
    installed,
    updated,
  } satisfies InstallHooksResult;
}

export async function getCaptureStatus(options: { cwd?: string } = {}) {
  const bridgeRoot = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  return readCaptureStatus(bridgeRoot);
}

export async function stopCaptureWatcher(options: { cwd?: string } = {}) {
  const bridgeRoot = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  const status = await readCaptureStatus(bridgeRoot);
  const pid = status.watcher.pid;

  if (!status.watcher.running) {
    const normalized = pid && !isWatcherProcessAlive(pid)
      ? await markWatcherStopped(bridgeRoot, status.watcher.lastError ?? "Watcher process is not running.")
      : status;
    return {
      stopped: false,
      details: "Watcher is already stopped.",
      status: normalized,
    } satisfies StopCaptureWatcherResult;
  }

  if (!pid || !isWatcherProcessAlive(pid)) {
    const normalized = await markWatcherStopped(bridgeRoot, status.watcher.lastError ?? "Watcher process is not running.");
    return {
      stopped: true,
      details: "Marked stale watcher as stopped.",
      status: normalized,
    } satisfies StopCaptureWatcherResult;
  }

  if (pid === process.pid) {
    return {
      stopped: false,
      details: "Watcher is running in the current process. Stop it from that process with Ctrl+C or watcher.close().",
      status,
    } satisfies StopCaptureWatcherResult;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    const normalized = await markWatcherStopped(bridgeRoot, `Unable to signal watcher process ${pid}: ${(error as Error).message}`);
    return {
      stopped: true,
      details: `Watcher process ${pid} was not reachable; marked as stopped.`,
      status: normalized,
    } satisfies StopCaptureWatcherResult;
  }

  const deadline = Date.now() + WATCHER_STOP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(100);
    const nextStatus = await readCaptureStatus(bridgeRoot);
    if (!nextStatus.watcher.running || !isWatcherProcessAlive(pid)) {
      const normalized = nextStatus.watcher.running
        ? await markWatcherStopped(bridgeRoot, null)
        : await markWatcherStopped(bridgeRoot, null);
      return {
        stopped: true,
        details: `Stopped watcher process ${pid}.`,
        status: normalized,
      } satisfies StopCaptureWatcherResult;
    }
  }

  throw new BridgeRuntimeError("BAD_REQUEST", `Timed out waiting for capture watcher ${pid} to stop.`, {
    pid,
    bridgeRoot,
  });
}

export async function runCaptureDoctor(options: { cwd?: string } = {}) {
  const cwd = options.cwd ?? process.cwd();
  const checks: CaptureDoctorResult["checks"] = [];

  let bridgeRoot = "";
  try {
    bridgeRoot = await resolveBridgeRoot({ cwd });
    await fs.access(path.join(bridgeRoot, "bridge.json"));
    checks.push({ name: "bridge", ok: true, details: `Bridge found at ${bridgeRoot}` });
  } catch (error) {
    checks.push({ name: "bridge", ok: false, details: (error as Error).message });
  }

  if (bridgeRoot) {
    try {
      const repoRoot = repoRootFromBridgeRoot(bridgeRoot);
      const gitDir = await resolveGitDir(repoRoot);
      const hooksDir = path.join(gitDir, "hooks");
      checks.push({ name: "git", ok: true, details: `Git hooks directory: ${hooksDir}` });
      for (const hookName of DEFAULT_HOOKS) {
        const hookPath = path.join(hooksDir, hookName);
        const installed = (await pathExists(hookPath))
          ? (await fs.readFile(hookPath, "utf8")).includes(HOOK_MARKER)
          : false;
        checks.push({
          name: `hook:${hookName}`,
          ok: installed,
          details: installed ? `Installed at ${hookPath}` : `Missing or unmanaged hook at ${hookPath}`,
        });
      }
    } catch (error) {
      checks.push({ name: "git", ok: false, details: (error as Error).message });
    }

    if (IS_PUBLISHED_BUNDLE) {
      checks.push({
        name: "tsx",
        ok: true,
        details: "Using global aibridge for hooks (tsx not required)",
      });
    } else {
      checks.push({
        name: "tsx",
        ok: await pathExists(TSX_CLI),
        details: (await pathExists(TSX_CLI)) ? `Found ${TSX_CLI}` : `Not found: ${TSX_CLI}`,
      });
    }

    const captureStatus = await readCaptureStatus(bridgeRoot);
    checks.push({
      name: "capture-status",
      ok: true,
      details:
        captureStatus.hooksInstalled.length > 0
          ? `Persisted hooks: ${captureStatus.hooksInstalled.join(", ")}`
          : "No hooks recorded in capture status.",
    });
    checks.push({
      name: "watcher",
      ok: !captureStatus.watcher.running || (captureStatus.watcher.pid ? isWatcherProcessAlive(captureStatus.watcher.pid) : false),
      details: captureStatus.watcher.running
        ? `Watcher running with PID ${captureStatus.watcher.pid ?? "unknown"} at ${captureStatus.watcher.watchedRoot ?? bridgeRoot}`
        : captureStatus.watcher.lastError
          ? `Watcher stopped: ${captureStatus.watcher.lastError}`
          : "Watcher stopped.",
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  } satisfies CaptureDoctorResult;
}

export async function handleCaptureHook(options: HandleHookOptions) {
  const bridgeRoot = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  const repoRoot = repoRootFromBridgeRoot(bridgeRoot);
  const snapshot = await loadBridgeSnapshot(bridgeRoot);

  if (options.hookName === "post-commit") {
    const metadataBlock = await execGit(repoRoot, ["log", "-1", "--pretty=%H%n%s%n%an"]);
    const [commitHash = "", subject = "Commit", authorName = ""] = metadataBlock.split(/\r?\n/);
    const changedPaths = (await execGit(repoRoot, ["show", "--pretty=", "--name-only", "--no-renames", "HEAD"]))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const attribution = detectAttribution({
      bridgeAgents: snapshot.bridge.agents,
      explicitAgentId: options.explicitAgentId,
      authorName,
      changedPaths,
    });
    const log = await ingestCaptureEvent(bridgeRoot, {
      agentId: attribution.agentId,
      action: "commit",
      description: `Committed: ${subject}`,
      metadata: {
        commitHash,
        changedPaths,
        filesChanged: changedPaths.length,
        hook: "post-commit",
      },
      source: "git-hook",
      attributionSource: attribution.source,
      confidence: attribution.confidence,
    }, snapshot.bridge.agents);
    await updateCaptureStatus(bridgeRoot, (current) => ({
      ...current,
      lastCapturedAt: new Date().toISOString(),
      watcher: {
        ...current.watcher,
        lastEventAt: new Date().toISOString(),
        recentPaths: changedPaths.slice(0, 5),
        attribution,
      },
    }));
    return log;
  }

  if (options.hookName === "post-merge" || options.hookName === "post-checkout") {
    const branch = (await execGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"])) || "HEAD";
    const changedPaths = (await execGit(repoRoot, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const attribution = detectAttribution({
      bridgeAgents: snapshot.bridge.agents,
      explicitAgentId: options.explicitAgentId,
      changedPaths,
    });
    return ingestCaptureEvent(bridgeRoot, {
      agentId: attribution.agentId,
      action: options.hookName === "post-merge" ? "merge" : "checkout",
      description:
        options.hookName === "post-merge"
          ? `Merged updates into ${branch}`
          : `Checked out ${branch}`,
      metadata: {
        branch,
        changedPaths,
        hook: options.hookName,
        hookArgs: options.args ?? [],
      },
      source: "git-hook",
      attributionSource: attribution.source,
      confidence: attribution.confidence,
    }, snapshot.bridge.agents);
  }

  throw new BridgeRuntimeError("BAD_REQUEST", `Unsupported capture hook: ${options.hookName}`);
}

export async function startCaptureWatcher(options: StartCaptureWatcherOptions = {}) {
  const bridgeRoot = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  const repoRoot = repoRootFromBridgeRoot(bridgeRoot);
  const snapshot = await loadBridgeSnapshot(bridgeRoot);
  const debounceMs = options.debounceMs ?? DEFAULT_WATCH_DEBOUNCE_MS;
  const scanIntervalMs = options.scanIntervalMs ?? DEFAULT_WATCH_SCAN_INTERVAL_MS;
  const currentStatus = await readCaptureStatus(bridgeRoot);
  if (
    currentStatus.watcher.running &&
    currentStatus.watcher.pid &&
    isWatcherProcessAlive(currentStatus.watcher.pid)
  ) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Capture watcher is already running for ${currentStatus.watcher.watchedRoot ?? repoRoot}.`, {
      pid: currentStatus.watcher.pid,
      watchedRoot: currentStatus.watcher.watchedRoot ?? repoRoot,
    });
  }
  if (currentStatus.watcher.running && (!currentStatus.watcher.pid || !isWatcherProcessAlive(currentStatus.watcher.pid))) {
    await markWatcherStopped(bridgeRoot, currentStatus.watcher.lastError ?? "Recovered stale watcher state before restart.");
  }

  let currentSnapshot = await collectWorkspaceSnapshot(repoRoot);
  const pendingPaths = new Set<string>();
  let flushTimer: NodeJS.Timeout | null = null;
  let heartbeatAt = 0;
  let scanInFlight = false;
  let stopped = false;

  const writeWatcherState = async (
    partial: Partial<AibridgeCaptureStatus["watcher"]>,
    extras?: Partial<Pick<AibridgeCaptureStatus, "lastCapturedAt">>,
  ) => {
    await updateCaptureStatus(bridgeRoot, (current) => ({
      ...current,
      ...(extras ?? {}),
      watcher: {
        ...current.watcher,
        ...partial,
      },
    }));
  };

  const flushPending = async () => {
    if (pendingPaths.size === 0) {
      return;
    }

    const changedPaths = [...pendingPaths].sort((left, right) => left.localeCompare(right));
    pendingPaths.clear();
    options.onBatch?.(changedPaths);
    const attribution = detectAttribution({
      bridgeAgents: snapshot.bridge.agents,
      explicitAgentId: options.agentId,
      changedPaths,
    });
    await ingestCaptureEvent(
      bridgeRoot,
      {
        agentId: attribution.agentId,
        action: "edit",
        description: summarizeChangedPaths(changedPaths),
        metadata: {
          changedPaths,
          filesChanged: changedPaths.length,
        },
        source: "watcher",
        attributionSource: attribution.source,
        confidence: attribution.confidence,
      },
      snapshot.bridge.agents,
    );
    const now = new Date().toISOString();
    await writeWatcherState(
      {
        lastEventAt: now,
        recentPaths: changedPaths.slice(0, 5),
        attribution,
        lastError: undefined,
      },
      { lastCapturedAt: now },
    );
  };

  await updateCaptureStatus(bridgeRoot, (current) => ({
    ...current,
    watcher: {
      ...current.watcher,
      running: true,
      pid: process.pid,
      watchedRoot: repoRoot,
      debounceMs,
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      lastError: undefined,
    },
  }));

  const interval = setInterval(async () => {
    if (stopped || scanInFlight) {
      return;
    }

    scanInFlight = true;
    try {
      const nextSnapshot = await collectWorkspaceSnapshot(repoRoot);
      const changed = diffSnapshots(currentSnapshot, nextSnapshot);
      currentSnapshot = nextSnapshot;
      changed.forEach((relativePath) => pendingPaths.add(relativePath));
      if (changed.length > 0) {
        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        flushTimer = setTimeout(() => {
          void flushPending();
        }, debounceMs);
      }

      if (Date.now() - heartbeatAt >= HEARTBEAT_INTERVAL_MS) {
        heartbeatAt = Date.now();
        await writeWatcherState({
          lastHeartbeatAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      await writeWatcherState({
        lastError: (error as Error).message,
        lastHeartbeatAt: new Date().toISOString(),
      });
    } finally {
      scanInFlight = false;
    }
  }, scanIntervalMs);

  return {
    close: async () => {
      stopped = true;
      clearInterval(interval);
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await flushPending();
      await writeWatcherState({
        running: false,
        pid: undefined,
        lastHeartbeatAt: new Date().toISOString(),
      });
    },
    getStatus: async () => readCaptureStatus(bridgeRoot),
  } satisfies RunningCaptureWatcher;
}

export { renderCaptureStatus };

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AibridgeCaptureStatus } from "../../../src/lib/aibridge/types";

const CAPTURE_DIRNAME = "capture";
const CAPTURE_STATUS_FILE = "status.json";
const VALIDATION_WARNINGS_FILE = "validation-errors.jsonl";

export interface CapturePaths {
  captureDir: string;
  statusFile: string;
  validationWarningsFile: string;
}

export interface CaptureValidationWarningRecord {
  id: string;
  timestamp: string;
  kind: "malformed-event" | "invalid-agent" | "invalid-metadata";
  message: string;
  payload?: Record<string, unknown>;
}

export function getCapturePaths(rootPath: string): CapturePaths {
  const captureDir = path.join(rootPath, CAPTURE_DIRNAME);
  return {
    captureDir,
    statusFile: path.join(captureDir, CAPTURE_STATUS_FILE),
    validationWarningsFile: path.join(captureDir, VALIDATION_WARNINGS_FILE),
  };
}

export function defaultCaptureStatus(): AibridgeCaptureStatus {
  return {
    hooksInstalled: [],
    watcher: {
      running: false,
      debounceMs: 1500,
    },
    validationWarnings: 0,
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

export function isWatcherProcessAlive(pid: number | undefined) {
  if (!pid || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
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

function mergeCaptureStatus(base: AibridgeCaptureStatus, partial: Partial<AibridgeCaptureStatus>) {
  return {
    ...base,
    ...partial,
    hooksInstalled: partial.hooksInstalled ?? base.hooksInstalled,
    watcher: {
      ...base.watcher,
      ...(partial.watcher ?? {}),
    },
  } satisfies AibridgeCaptureStatus;
}

function normalizeCaptureStatus(status: AibridgeCaptureStatus) {
  if (!status.watcher.running || !status.watcher.lastHeartbeatAt) {
    if (status.watcher.running && status.watcher.pid && !isWatcherProcessAlive(status.watcher.pid)) {
      return {
        ...status,
        watcher: {
          ...status.watcher,
          running: false,
          pid: undefined,
          lastError: status.watcher.lastError ?? "Watcher process is not running.",
        },
      } satisfies AibridgeCaptureStatus;
    }

    return status;
  }

  const heartbeatAge = Date.now() - new Date(status.watcher.lastHeartbeatAt).getTime();
  const staleAfterMs = Math.max(5_000, (status.watcher.debounceMs || 1500) * 4);
  if (Number.isNaN(heartbeatAge) || heartbeatAge <= staleAfterMs) {
    if (status.watcher.pid && !isWatcherProcessAlive(status.watcher.pid)) {
      return {
        ...status,
        watcher: {
          ...status.watcher,
          running: false,
          pid: undefined,
          lastError: status.watcher.lastError ?? "Watcher process is not running.",
        },
      } satisfies AibridgeCaptureStatus;
    }

    return status;
  }

  return {
    ...status,
    watcher: {
      ...status.watcher,
      running: false,
      pid: undefined,
      lastError: status.watcher.lastError ?? "Watcher heartbeat is stale.",
    },
  } satisfies AibridgeCaptureStatus;
}

export async function readCaptureStatus(rootPath: string) {
  const defaults = defaultCaptureStatus();
  const { statusFile } = getCapturePaths(rootPath);
  if (!(await fileExists(statusFile))) {
    return defaults;
  }

  try {
    const raw = await fs.readFile(statusFile, "utf8");
    return normalizeCaptureStatus(mergeCaptureStatus(defaults, JSON.parse(raw) as Partial<AibridgeCaptureStatus>));
  } catch {
    return defaults;
  }
}

export async function writeCaptureStatus(rootPath: string, next: AibridgeCaptureStatus) {
  const { statusFile } = getCapturePaths(rootPath);
  await writeJsonAtomic(statusFile, next);
  return next;
}

export async function updateCaptureStatus(
  rootPath: string,
  update: Partial<AibridgeCaptureStatus> | ((current: AibridgeCaptureStatus) => AibridgeCaptureStatus),
) {
  const current = await readCaptureStatus(rootPath);
  const next = typeof update === "function" ? update(current) : mergeCaptureStatus(current, update);
  return writeCaptureStatus(rootPath, next);
}

export async function appendCaptureValidationWarning(rootPath: string, warning: CaptureValidationWarningRecord) {
  const { captureDir, validationWarningsFile } = getCapturePaths(rootPath);
  await ensureDir(captureDir);
  await fs.appendFile(validationWarningsFile, `${JSON.stringify(warning)}\n`, "utf8");
}

export async function markWatcherStopped(rootPath: string, reason?: string | null) {
  return updateCaptureStatus(rootPath, (current) => ({
    ...current,
    watcher: {
      ...current.watcher,
      running: false,
      pid: undefined,
      lastHeartbeatAt: new Date().toISOString(),
      lastError: reason === null ? undefined : reason ?? current.watcher.lastError,
    },
  }));
}

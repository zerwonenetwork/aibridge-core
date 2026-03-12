// @vitest-environment node

import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { initBridge, loadBridgeSnapshot } from "../../runtime/store";
import { getCapturePaths, readCaptureStatus } from "./state";
import { installCaptureHooks, recordCaptureEvent, startCaptureWatcher, stopCaptureWatcher } from "./capture";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];
const TSX_CLI = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const CLI_ENTRY = path.join(process.cwd(), "aibridge", "cli", "bin", "aibridge.ts");

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
  });
  return stdout.trim();
}

async function createGitBridgeRepo(name: string) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-capture-"));
  tempDirs.push(tempDir);
  await git(tempDir, ["init"]);
  await git(tempDir, ["config", "user.email", "aibridge@example.com"]);
  await git(tempDir, ["config", "user.name", "AiBridge Tester"]);
  await initBridge({
    cwd: tempDir,
    name,
    agents: ["cursor", "claude"],
  });
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("capture layer", () => {
  it("installs managed git hooks into the repo-local hooks directory", async () => {
    const repoRoot = await createGitBridgeRepo("Capture Hooks");

    const result = await installCaptureHooks({ cwd: repoRoot });
    const postCommit = await readFile(path.join(result.hooksDir, "post-commit"), "utf8");
    const postMerge = await readFile(path.join(result.hooksDir, "post-merge"), "utf8");

    expect(result.installed).toContain("post-commit");
    expect(result.installed).toContain("post-merge");
    expect(postCommit).toContain("# aibridge capture hook");
    expect(postCommit).toContain("capture hook post-commit");
    expect(postMerge).toContain("capture hook post-merge");

    const status = await readCaptureStatus(path.join(repoRoot, ".aibridge"));
    expect(status.hooksInstalled).toContain("post-commit");
  });

  it("captures commit activity through the installed post-commit hook and regenerates context", async () => {
    const repoRoot = await createGitBridgeRepo("Capture Commit");
    await installCaptureHooks({ cwd: repoRoot });

    await writeFile(path.join(repoRoot, "README.capture.md"), "commit through hook\n", "utf8");
    await git(repoRoot, ["add", "README.capture.md"]);
    await git(repoRoot, ["commit", "-m", "feat: capture hook"], {
      AIBRIDGE_AGENT: "cursor",
      GIT_AUTHOR_NAME: "Cursor Agent",
      GIT_COMMITTER_NAME: "Cursor Agent",
    });

    const snapshot = await loadBridgeSnapshot(path.join(repoRoot, ".aibridge"));
    const context = await readFile(path.join(repoRoot, ".aibridge", "CONTEXT.md"), "utf8");

    expect(snapshot.logs.some((entry) => entry.action === "commit" && entry.description.includes("feat: capture hook"))).toBe(true);
    expect(context).toContain("Committed: feat: capture hook");
  });

  it("batches watcher events into a debounced auto-captured edit log", async () => {
    const repoRoot = await createGitBridgeRepo("Capture Watcher");
    const watcher = await startCaptureWatcher({
      cwd: repoRoot,
      agentId: "cursor",
      debounceMs: 150,
      scanIntervalMs: 50,
    });

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "src", "one.ts"), "export const one = 1;\n", "utf8");
    await writeFile(path.join(repoRoot, "src", "two.ts"), "export const two = 2;\n", "utf8");
    await new Promise((resolve) => setTimeout(resolve, 550));
    await watcher.close();

    const snapshot = await loadBridgeSnapshot(path.join(repoRoot, ".aibridge"));
    const watcherLogs = snapshot.logs.filter((entry) => entry.metadata?.capture && entry.action === "edit");

    expect(watcherLogs).toHaveLength(1);
    expect(JSON.stringify(watcherLogs[0].metadata)).toContain("one.ts");
    expect(JSON.stringify(watcherLogs[0].metadata)).toContain("two.ts");

    const status = await readCaptureStatus(path.join(repoRoot, ".aibridge"));
    expect(status.watcher.running).toBe(false);
    expect(status.lastCapturedAt).toBeTruthy();
  });

  it("prevents duplicate watchers and supports explicit stop for a real CLI watcher process", async () => {
    const repoRoot = await createGitBridgeRepo("Capture Stop");
    const watcher = await startCaptureWatcher({
      cwd: repoRoot,
      agentId: "cursor",
      debounceMs: 120,
      scanIntervalMs: 50,
    });

    await expect(
      startCaptureWatcher({
        cwd: repoRoot,
        agentId: "cursor",
      }),
    ).rejects.toThrow(/already running/);

    await watcher.close();

    const child = spawn(process.execPath, [TSX_CLI, CLI_ENTRY, "capture", "watch", "--agent", "cursor", "--debounce", "120", "--interval", "50"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    try {
      const deadline = Date.now() + 5000;
      let watcherPid: number | undefined;
      while (Date.now() < deadline) {
        const status = await readCaptureStatus(path.join(repoRoot, ".aibridge"));
        if (status.watcher.running && status.watcher.pid && status.watcher.pid !== process.pid) {
          watcherPid = status.watcher.pid;
          break;
        }

        await sleep(100);
      }

      expect(watcherPid).toBeTruthy();

      const stopped = await stopCaptureWatcher({ cwd: repoRoot });
      expect(stopped.stopped).toBe(true);
      expect(stopped.status.watcher.running).toBe(false);

      await new Promise<void>((resolve, reject) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }

        child.once("exit", () => resolve());
        child.once("error", reject);
      });
    } finally {
      child.kill("SIGTERM");
    }
  });

  it("records malformed capture events as warnings instead of crashing", async () => {
    const repoRoot = await createGitBridgeRepo("Capture Validation");
    const result = await recordCaptureEvent({
      cwd: repoRoot,
      source: "watcher",
      action: "",
      description: "",
    });

    expect(result).toBeNull();

    const capturePaths = getCapturePaths(path.join(repoRoot, ".aibridge"));
    const warningLog = await readFile(capturePaths.validationWarningsFile, "utf8");
    const status = await readCaptureStatus(path.join(repoRoot, ".aibridge"));

    expect(warningLog).toContain("missing action or description");
    expect(status.validationWarnings).toBeGreaterThan(0);
  });

  it("supports an end-to-end local capture flow from init through hooks and watcher updates", async () => {
    const repoRoot = await createGitBridgeRepo("Capture End To End");
    await installCaptureHooks({ cwd: repoRoot });
    const watcher = await startCaptureWatcher({
      cwd: repoRoot,
      agentId: "cursor",
      debounceMs: 120,
      scanIntervalMs: 50,
    });

    await mkdir(path.join(repoRoot, "src"), { recursive: true });
    await writeFile(path.join(repoRoot, "src", "feature.ts"), "export const feature = true;\n", "utf8");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await git(repoRoot, ["add", "src/feature.ts"]);
    await git(repoRoot, ["commit", "-m", "feat: auto capture"], {
      AIBRIDGE_AGENT: "cursor",
      GIT_AUTHOR_NAME: "Cursor Agent",
      GIT_COMMITTER_NAME: "Cursor Agent",
    });
    await watcher.close();

    const snapshot = await loadBridgeSnapshot(path.join(repoRoot, ".aibridge"));
    const context = await readFile(path.join(repoRoot, ".aibridge", "CONTEXT.md"), "utf8");

    expect(snapshot.logs.some((entry) => entry.action === "edit")).toBe(true);
    expect(snapshot.logs.some((entry) => entry.action === "commit")).toBe(true);
    expect(context).toContain("feat: auto capture");
    expect(context).toContain("Modified 1 files:");
    expect(context).toContain("feature.ts");
  });
});

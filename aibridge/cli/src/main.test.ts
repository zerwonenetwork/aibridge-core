// @vitest-environment node

import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "./main.ts";

const tempDirs: string[] = [];
const execFileAsync = promisify(execFile);

function createIo() {
  let stdout = "";
  let stderr = "";

  return {
    io: {
      stdout: (text: string) => {
        stdout += text;
      },
      stderr: (text: string) => {
        stderr += text;
      },
    },
    getStdout: () => stdout,
    getStderr: () => stderr,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runCli", () => {
  it("initializes a bridge and drives a local workflow across tasks, messages, handoffs, decisions, conventions, and logs", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-cli-"));
    tempDirs.push(tempDir);

    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const initIo = createIo();
      await runCli(["init", "--name", "Temp Bridge", "--agents", "cursor,claude,codex"], initIo.io);
      await expect(access(path.join(tempDir, ".aibridge", "bridge.json"))).resolves.toBeUndefined();

      const taskIo = createIo();
      await runCli(["task", "add", "Ship local runtime", "--assign", "cursor", "--priority", "high"], taskIo.io);
      expect(taskIo.getStdout()).toContain("Task");
      expect(taskIo.getStdout()).toContain("Ship local runtime");

      const messageIo = createIo();
      await runCli(["message", "add", "Parser is ready", "--from", "cursor", "--to", "claude"], messageIo.io);
      expect(messageIo.getStdout()).toContain("Message");
      expect(messageIo.getStdout()).toContain("cursor");
      expect(messageIo.getStdout()).toContain("claude");

      const handoffIo = createIo();
      await runCli(
        ["handoff", "create", "claude", "CLI scaffold is ready for review", "--from", "cursor"],
        handoffIo.io,
      );
      expect(handoffIo.getStdout()).toContain("Handoff");
      expect(handoffIo.getStdout()).toContain("cursor");
      expect(handoffIo.getStdout()).toContain("claude");

      const decisionIo = createIo();
      await runCli(
        ["decision", "add", "ServiceBoundary", "Canonical local HTTP service", "--status", "accepted", "--from", "cursor"],
        decisionIo.io,
      );
      expect(decisionIo.getStdout()).toContain("Decision");
      expect(decisionIo.getStdout()).toContain("ServiceBoundary");

      const conventionIo = createIo();
      await runCli(
        ["convention", "set", "Regenerate CONTEXT.md after every structured write", "--category", "workflow", "--from", "cursor"],
        conventionIo.io,
      );
      expect(conventionIo.getStdout()).toContain("Convention");
      expect(conventionIo.getStdout()).toContain("workflow");

      const logIo = createIo();
      await runCli(["log", "add", "test", "Verified CLI writes", "--from", "cursor"], logIo.io);
      expect(logIo.getStdout()).toContain("Logged action test");

      const contextIo = createIo();
      await runCli(["context", "generate"], contextIo.io);
      expect(contextIo.getStdout()).toContain("# Project Context - Temp Bridge");

      const statusIo = createIo();
      await runCli(["status", "--json"], statusIo.io);
      const status = JSON.parse(statusIo.getStdout());

      expect(status.context.projectName).toBe("Temp Bridge");
      expect(status.tasks).toHaveLength(1);
      expect(status.messages).toHaveLength(1);
      expect(status.handoffs).toHaveLength(1);
      expect(status.decisions).toHaveLength(1);
      expect(status.conventions).toHaveLength(1);
      expect(status.logs.length).toBeGreaterThanOrEqual(5);

      const contextFile = await readFile(path.join(tempDir, ".aibridge", "CONTEXT.md"), "utf8");
      expect(contextFile).toContain("Ship local runtime");
      expect(contextFile).toContain("Regenerate CONTEXT.md after every structured write");
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("installs and reports capture hooks through the CLI", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-cli-capture-"));
    tempDirs.push(tempDir);
    await execFileAsync("git", ["init"], { cwd: tempDir });
    await execFileAsync("git", ["config", "user.email", "cli@example.com"], { cwd: tempDir });
    await execFileAsync("git", ["config", "user.name", "CLI Tester"], { cwd: tempDir });

    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const initIo = createIo();
      await runCli(["init", "--name", "Capture Bridge"], initIo.io);

      const installIo = createIo();
      await runCli(["capture", "install-hooks"], installIo.io);
      expect(installIo.getStdout()).toContain("Installed capture hooks");

      const doctorIo = createIo();
      const doctorExit = await runCli(["capture", "doctor"], doctorIo.io);
      expect(doctorExit).toBe(0);
      expect(doctorIo.getStdout()).toContain("hook:post-commit");
      expect(doctorIo.getStdout()).toContain("Installed");

      const statusIo = createIo();
      await runCli(["capture", "status"], statusIo.io);
      expect(statusIo.getStdout()).toContain("Watcher");
      expect(statusIo.getStdout()).toContain("stopped");
      expect(statusIo.getStdout()).toContain("post-commit");
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("supports inline flag syntax for init agent lists", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-cli-inline-"));
    tempDirs.push(tempDir);

    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const initIo = createIo();
      await runCli(["init", "--name=Inline Bridge", "--agents=cursor,claude"], initIo.io);

      const statusIo = createIo();
      await runCli(["status", "--json"], statusIo.io);
      const status = JSON.parse(statusIo.getStdout());

      expect(status.context.projectName).toBe("Inline Bridge");
      expect(status.context.activeAgents.map((agent: { id: string }) => agent.id)).toEqual(["cursor", "claude"]);
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("supports template-driven setup plan and setup-backed init flows", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-cli-setup-"));
    tempDirs.push(tempDir);

    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const planIo = createIo();
      await runCli(["setup", "plan", "--template", "landing-page", "--name", "Launch Deck"], planIo.io);
      expect(planIo.getStdout()).toContain("Landing Page (landing-page)");
      expect(planIo.getStdout()).toContain("Audit the repo and confirm landing-page surface");

      const initIo = createIo();
      await runCli(["init", "--template", "api-backend", "--stack", "node,supabase", "--multi-agent"], initIo.io);
      expect(initIo.getStdout()).toContain("Initialized AiBridge setup");
      expect(initIo.getStdout()).toContain("API Backend (api-backend)");

      const statusIo = createIo();
      await runCli(["status", "--json"], statusIo.io);
      const status = JSON.parse(statusIo.getStdout());

      expect(status.context.projectName).toBe(path.basename(tempDir));
      expect(status.context.setup.templateId).toBe("api-backend");
      expect(status.tasks.length).toBeGreaterThanOrEqual(5);
      expect(status.conventions.length).toBeGreaterThanOrEqual(2);

      const contextFile = await readFile(path.join(tempDir, ".aibridge", "CONTEXT.md"), "utf8");
      expect(contextFile).toContain("## Setup Brief");
      expect(contextFile).toContain("## Setup Workflow");
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("supports agent launch, acknowledgement, heartbeat, recovery, and stop flows", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-cli-agent-"));
    tempDirs.push(tempDir);

    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const initIo = createIo();
      await runCli(["init", "--name", "Agent Bridge", "--agents", "cursor,codex"], initIo.io);

      const launchIo = createIo();
      await runCli(["agent", "launch", "--agent", "cursor", "--tool", "cursor"], launchIo.io);
      expect(launchIo.getStdout()).toContain("Agent Launch");
      expect(launchIo.getStdout()).toContain("Acknowledge this session");

      const statusIo = createIo();
      await runCli(["agent", "status", "--json"], statusIo.io);
      const launched = JSON.parse(statusIo.getStdout());
      expect(launched).toHaveLength(1);
      expect(launched[0].status).toBe("pending");

      const sessionId = launched[0].id as string;

      const startIo = createIo();
      await runCli(["agent", "start", "--session", sessionId], startIo.io);
      expect(startIo.getStdout()).toContain("Started agent session");

      const heartbeatIo = createIo();
      await runCli(["agent", "heartbeat", "--session", sessionId], heartbeatIo.io);
      expect(heartbeatIo.getStdout()).toContain("Heartbeat recorded");

      const recoverIo = createIo();
      await runCli(["agent", "recover", "--session", sessionId], recoverIo.io);
      expect(recoverIo.getStdout()).toContain("Recovery Prompt");
      expect(recoverIo.getStdout()).toContain("No recovery prompt needed.");

      const stopIo = createIo();
      await runCli(["agent", "stop", "--session", sessionId, "--reason", "Paused for review"], stopIo.io);
      expect(stopIo.getStdout()).toContain("Stopped agent session");

      const finalStatusIo = createIo();
      await runCli(["agent", "status", "--json"], finalStatusIo.io);
      const finalSessions = JSON.parse(finalStatusIo.getStdout());
      expect(finalSessions[0].status).toBe("stopped");
      expect(finalSessions[0].stoppedReason).toContain("Paused for review");
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("redirects release and announcement commands to the hosted admin UI", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-cli-hosted-"));
    tempDirs.push(tempDir);

    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const releaseIo = createIo();
      await expect(runCli(["release", "list"], releaseIo.io)).rejects.toThrow(
        "`release` CLI commands have been removed. Manage hosted product updates and notices from /app as an admin.",
      );

      const announcementIo = createIo();
      await expect(runCli(["announcement", "list"], announcementIo.io)).rejects.toThrow(
        "`announcement` CLI commands have been removed. Manage hosted product updates and notices from /app as an admin.",
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
});

// @vitest-environment node

import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initBridge } from "../../runtime/store";
import { installCaptureHooks, startCaptureWatcher } from "../capture/capture";
import { createLocalBridgeHttpServer, startLocalBridgeService } from "./service";

const decoder = new TextDecoder();

async function startServer(server: Server, port = 0, host = "127.0.0.1") {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address.");
  }

  return `http://${host}:${address.port}`;
}

describe("standalone local bridge service", () => {
  let baseUrl = "";
  let server: Server | null = null;
  const testRoot = path.join(os.tmpdir(), `aibridge-service-${randomUUID()}`);

  beforeAll(async () => {
    await mkdir(testRoot, { recursive: true });
    await initBridge({ cwd: testRoot, name: "Service Test Bridge", agents: ["cursor", "claude"] });
    await installCaptureHooks({ cwd: testRoot }).catch(() => undefined);
    server = createLocalBridgeHttpServer({
      cwd: testRoot,
      pollIntervalMs: 100,
    });
    baseUrl = await startServer(server);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await rm(testRoot, { recursive: true, force: true });
  });

  it("responds to health and status checks", async () => {
    const healthResponse = await fetch(`${baseUrl}/health`);
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toMatchObject({
      ok: true,
      service: "aibridge-local-service",
      apiVersion: 1,
      cwd: testRoot,
    });

    const statusResponse = await fetch(`${baseUrl}/bridge/status?source=workspace`);
    expect(statusResponse.status).toBe(200);
    const statusBody = await statusResponse.json();
    expect(statusBody.runtime.mode).toBe("local");
    expect(statusBody.data.context.projectName).toBe("Service Test Bridge");
    expect(statusBody.data.capture).toBeDefined();
    expect(Array.isArray(statusBody.data.releases)).toBe(true);
    expect(Array.isArray(statusBody.data.announcements)).toBe(true);
    expect(statusBody.data.access.role).toBe("admin");

    const captureResponse = await fetch(`${baseUrl}/bridge/capture/status?source=workspace`);
    expect(captureResponse.status).toBe(200);
    const captureBody = await captureResponse.json();
    expect(captureBody.data.hooksInstalled).toBeDefined();
  });

  it("attaches only to a verified compatible AiBridge service for the same workspace", async () => {
    const compatible = await startLocalBridgeService({
      cwd: testRoot,
      host: "127.0.0.1",
      port: Number(new URL(baseUrl).port),
    });

    expect(compatible.ownsServer).toBe(false);
    expect(compatible.identity.cwd).toBe(testRoot);
  });

  it("fails clearly when the port is occupied by a non-AiBridge process", async () => {
    const dummy = createServer((_, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, service: "not-aibridge" }));
    });
    const dummyUrl = await startServer(dummy);
    const port = Number(new URL(dummyUrl).port);

    try {
      await expect(
        startLocalBridgeService({
          cwd: testRoot,
          host: "127.0.0.1",
          port,
        }),
      ).rejects.toThrow(/non-AiBridge process|could not be verified as AiBridge/);
    } finally {
      await new Promise<void>((resolve, reject) => {
        dummy.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  it("fails clearly when the port is occupied by AiBridge for a different workspace", async () => {
    const otherRoot = path.join(os.tmpdir(), `aibridge-service-other-${randomUUID()}`);
    await mkdir(otherRoot, { recursive: true });
    await initBridge({ cwd: otherRoot, name: "Other Workspace", agents: ["cursor"] });

    try {
      await expect(
        startLocalBridgeService({
          cwd: otherRoot,
          host: "127.0.0.1",
          port: Number(new URL(baseUrl).port),
        }),
      ).rejects.toThrow(/different workspace/);
    } finally {
      await rm(otherRoot, { recursive: true, force: true });
    }
  });

  it("supports an end-to-end local flow through the HTTP boundary", async () => {
    const createTaskResponse = await fetch(`${baseUrl}/bridge/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "workspace",
        title: "Verify local service flow",
        priority: "high",
        agentId: "cursor",
      }),
    });
    expect(createTaskResponse.status).toBe(201);
    const createdTask = await createTaskResponse.json();
    expect(createdTask.data.title).toBe("Verify local service flow");

    const regenerateResponse = await fetch(`${baseUrl}/bridge/context/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "workspace",
      }),
    });
    expect(regenerateResponse.status).toBe(200);
    const regenerated = await regenerateResponse.json();
    expect(regenerated.data.markdown).toContain("Verify local service flow");

    const statusResponse = await fetch(`${baseUrl}/bridge/status?source=workspace`);
    const statusBody = await statusResponse.json();
    expect(statusBody.data.tasks.some((task: { id: string }) => task.id === createdTask.data.id)).toBe(true);

    const contextFile = await readFile(path.join(testRoot, ".aibridge", "CONTEXT.md"), "utf8");
    expect(contextFile).toContain("Verify local service flow");
  });

  it("serves agent launch, acknowledgement, heartbeat, recovery, and stop endpoints", async () => {
    const launchResponse = await fetch(`${baseUrl}/bridge/agents/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "workspace",
        agentId: "cursor",
        toolKind: "cursor",
        launchSource: "dashboard",
      }),
    });
    expect(launchResponse.status).toBe(201);
    const launchBody = await launchResponse.json();
    expect(launchBody.data.status).toBe("pending");
    expect(launchBody.data.instructions.prompt).toContain("Acknowledge this session");

    const sessionId = launchBody.data.id as string;

    const startResponse = await fetch(`${baseUrl}/bridge/agents/sessions/${sessionId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "workspace" }),
    });
    expect(startResponse.status).toBe(200);
    const startBody = await startResponse.json();
    expect(startBody.data.status).toBe("active");

    const heartbeatResponse = await fetch(`${baseUrl}/bridge/agents/sessions/${sessionId}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "workspace" }),
    });
    expect(heartbeatResponse.status).toBe(200);
    const heartbeatBody = await heartbeatResponse.json();
    expect(heartbeatBody.data.status).toBe("active");

    const recoveryResponse = await fetch(`${baseUrl}/bridge/agents/sessions/${sessionId}/recovery?source=workspace`);
    expect(recoveryResponse.status).toBe(200);
    const recoveryBody = await recoveryResponse.json();
    expect(recoveryBody.data.recovery.recommended).toBe(false);
    expect(recoveryBody.data.recovery.prompt).toBeUndefined();

    const stopResponse = await fetch(`${baseUrl}/bridge/agents/sessions/${sessionId}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "workspace",
        reason: "Paused from service test.",
      }),
    });
    expect(stopResponse.status).toBe(200);
    const stopBody = await stopResponse.json();
    expect(stopBody.data.status).toBe("stopped");

    const listResponse = await fetch(`${baseUrl}/bridge/agents/sessions?source=workspace&status=stopped`);
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data.some((session: { id: string }) => session.id === sessionId)).toBe(true);
  });

  it("enforces admin mutations and filters release center visibility for viewers", async () => {
    const viewerCreate = await fetch(`${baseUrl}/bridge/releases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-aibridge-role": "viewer",
      },
      body: JSON.stringify({
        source: "workspace",
        version: "9.9.9",
        title: "Blocked",
        summary: "Viewer create should fail.",
      }),
    });
    expect(viewerCreate.status).toBe(400);

    const createRelease = await fetch(`${baseUrl}/bridge/releases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-aibridge-role": "admin",
      },
      body: JSON.stringify({
        source: "workspace",
        version: "1.2.0",
        title: "Release Center",
        summary: "Published release",
        status: "published",
        createdBy: "cursor",
      }),
    });
    expect(createRelease.status).toBe(201);
    const releaseBody = await createRelease.json();

    const createAnnouncement = await fetch(`${baseUrl}/bridge/announcements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-aibridge-role": "admin",
      },
      body: JSON.stringify({
        source: "workspace",
        title: "Public update",
        body: "Published for everyone.",
        status: "published",
        audience: "all",
        severity: "success",
        createdBy: "cursor",
      }),
    });
    expect(createAnnouncement.status).toBe(201);

    await fetch(`${baseUrl}/bridge/releases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-aibridge-role": "admin",
      },
      body: JSON.stringify({
        source: "workspace",
        version: "2.0.0-beta",
        title: "Draft only",
        summary: "Not for viewers",
        status: "draft",
        createdBy: "cursor",
      }),
    });

    const viewerReleases = await fetch(`${baseUrl}/bridge/releases?source=workspace`, {
      headers: { "x-aibridge-role": "viewer" },
    });
    const viewerReleaseBody = await viewerReleases.json();
    expect(viewerReleaseBody.data).toHaveLength(1);
    expect(viewerReleaseBody.data[0].id).toBe(releaseBody.data.id);

    const viewerAnnouncements = await fetch(`${baseUrl}/bridge/announcements?source=workspace`, {
      headers: { "x-aibridge-role": "viewer" },
    });
    const viewerAnnouncementBody = await viewerAnnouncements.json();
    expect(viewerAnnouncementBody.data).toHaveLength(1);
    expect(viewerAnnouncementBody.data[0].title).toBe("Public update");
  });

  it("streams ready and change events when the bridge folder updates", async () => {
    const eventsResponse = await fetch(`${baseUrl}/bridge/events?source=workspace`, {
      headers: { Accept: "text/event-stream" },
    });
    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.headers.get("content-type")).toContain("text/event-stream");

    if (!eventsResponse.body) throw new Error("SSE response body is not readable.");
    const reader = eventsResponse.body.getReader();
    let buffer = "";
    const deadline = Date.now() + 6000;

    const readUntil = async (expectedEvent: "ready" | "bridge.changed") => {
      while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const lines = frame.split(/\r?\n/).filter(Boolean);
          const eventName = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (eventName && dataLine && eventName === expectedEvent) {
            return JSON.parse(dataLine) as { event: string; revision: string };
          }
        }
      }
      throw new Error(`Timed out waiting for ${expectedEvent}`);
    };

    const readyEvent = await readUntil("ready");
    expect(readyEvent.revision).toBeTruthy();

    const mutationPromise = fetch(`${baseUrl}/bridge/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "workspace",
        title: "Trigger SSE refresh",
        agentId: "cursor",
      }),
    });
    await mutationPromise;

    const changeEvent = await readUntil("bridge.changed");
    expect(changeEvent.revision).toBeTruthy();
    await reader.cancel();
  });

  it("supports a full local V1 flow through service status plus watcher-driven context updates", async () => {
    const watcher = await startCaptureWatcher({
      cwd: testRoot,
      agentId: "cursor",
      debounceMs: 120,
      scanIntervalMs: 50,
    });

    try {
      await mkdir(path.join(testRoot, "src"), { recursive: true });
      await writeFile(path.join(testRoot, "src", "captured.ts"), "export const captured = true;\n", "utf8");
      await new Promise((resolve) => setTimeout(resolve, 500));

      const statusResponse = await fetch(`${baseUrl}/bridge/status?source=workspace`);
      expect(statusResponse.status).toBe(200);
      const statusBody = await statusResponse.json();

      expect(statusBody.data.capture.watcher.running).toBe(true);
      expect(statusBody.data.logs.some((entry: { action: string }) => entry.action === "edit")).toBe(true);

      const contextFile = await readFile(path.join(testRoot, ".aibridge", "CONTEXT.md"), "utf8");
      expect(contextFile).toContain("captured.ts");
    } finally {
      await watcher.close();
    }
  });

  it("serves setup templates, previews a generated plan, and initializes a bridge from setup input", async () => {
    const templatesResponse = await fetch(`${baseUrl}/bridge/setup/templates`);
    expect(templatesResponse.status).toBe(200);
    const templatesBody = await templatesResponse.json();
    expect(templatesBody.data.templates.some((template: { id: string }) => template.id === "web-app")).toBe(true);

    const previewResponse = await fetch(`${baseUrl}/bridge/setup/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: "Setup Service Demo",
        templateId: "landing-page",
        preferredStack: ["html", "css"],
      }),
    });
    expect(previewResponse.status).toBe(200);
    const previewBody = await previewResponse.json();
    expect(previewBody.data.result.brief.summary).toContain("Setup Service Demo");
    expect(previewBody.data.plan.starterTasks.some((task: { key: string }) => task.key === "audit")).toBe(true);

    const initCwd = path.join(os.tmpdir(), `aibridge-service-setup-${randomUUID()}`);
    await mkdir(initCwd, { recursive: true });

    try {
      const initResponse = await fetch(`${baseUrl}/bridge/setup/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: "Setup Service Demo",
          templateId: "web-app",
          shortDescription: "Initialize a local bridge from the setup service.",
          preferredStack: ["react", "vite", "typescript"],
          priorities: ["quality", "speed"],
          cwd: initCwd,
        }),
      });

      expect(initResponse.status).toBe(201);
      const initBody = await initResponse.json();
      expect(initBody.data.result.template.id).toBe("web-app");
      expect(initBody.status.tasks.length).toBeGreaterThan(0);
      expect(initBody.status.context.setup.templateId).toBe("web-app");

      const contextMarkdown = await readFile(path.join(initCwd, ".aibridge", "CONTEXT.md"), "utf8");
      expect(contextMarkdown).toContain("## Setup Brief");
    } finally {
      await rm(initCwd, { recursive: true, force: true });
    }
  });
});

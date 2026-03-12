// @vitest-environment node

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initBridge } from "../../runtime/store";
import { LocalBridgeServer } from "./server";

describe("LocalBridgeServer", () => {
  let server: LocalBridgeServer;
  let port: number;
  const testRoot = path.join(process.cwd(), ".aibridge-test-server-" + randomUUID());
  const customRoot = path.join(testRoot, ".aibridge");

  beforeAll(async () => {
    await initBridge({ cwd: testRoot });
    server = new LocalBridgeServer({
      cwd: testRoot,
      port: 0,
      customRoot,
      source: "custom",
    });
    await server.start();
    port = server.getPort();
  });

  afterAll(async () => {
    if (server) await server.stop();
    await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
  });

  it("binds to a port and returns it from getPort()", () => {
    expect(port).toBeGreaterThan(0);
    expect(server.getPort()).toBe(port);
  });

  it("responds to GET /health with ok and service name", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.service).toBeDefined();
  });

  it("serves bridge status when bridge root is configured", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/bridge/status`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.runtime.mode).toBe("local");
  });
});

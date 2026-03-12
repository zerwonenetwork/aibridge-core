// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadBridgeSnapshot } from "../runtime/store";
import { initializeLocalBridgeFromSetup } from "./local";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("initializeLocalBridgeFromSetup", () => {
  it("turns setup input into a real local bridge with starter state and generated context", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aibridge-setup-local-"));
    tempDirs.push(tempDir);

    const initialized = await initializeLocalBridgeFromSetup(
      {
        projectName: "Setup Demo",
        templateId: "web-app",
        shortDescription: "Build a collaborative setup experience.",
        preferredStack: ["react", "vite", "typescript"],
        priorities: ["quality", "speed"],
        agentMode: "multi-agent",
        customInstructions: "Keep the first slice shippable.",
      },
      { cwd: tempDir },
    );

    const snapshot = await loadBridgeSnapshot(initialized.rootPath);
    const bridgeJson = JSON.parse(await readFile(path.join(initialized.rootPath, "bridge.json"), "utf8"));
    const contextMarkdown = await readFile(path.join(initialized.rootPath, "CONTEXT.md"), "utf8");

    expect(bridgeJson.projectName).toBe("Setup Demo");
    expect(bridgeJson.setup.templateId).toBe("web-app");
    expect(bridgeJson.setup.customInstructions).toBe("Keep the first slice shippable.");
    expect(snapshot.tasks.length).toBeGreaterThanOrEqual(6);
    expect(snapshot.messages.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.handoffs.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.decisions.some((decision) => decision.title === "Web App setup baseline")).toBe(true);
    expect(snapshot.conventions.some((convention) => convention.rule.includes("Keep the first slice shippable."))).toBe(true);
    expect(initialized.status.context.setup?.templateId).toBe("web-app");
    expect(contextMarkdown).toContain("## Setup Brief");
    expect(contextMarkdown).toContain("## Definition Of Done");
    expect(contextMarkdown).toContain("## Setup Workflow");
  });
});

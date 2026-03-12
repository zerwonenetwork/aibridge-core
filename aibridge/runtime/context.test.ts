// @vitest-environment node

import { describe, expect, it } from "vitest";
import { compileContextMarkdown } from "./context";
import { loadBridgeSnapshot, SAMPLE_BRIDGE_ROOT } from "./store";

describe("compileContextMarkdown", () => {
  it("produces deterministic context sections from a bridge snapshot", async () => {
    const snapshot = await loadBridgeSnapshot(SAMPLE_BRIDGE_ROOT);
    const markdown = compileContextMarkdown(snapshot, {
      generatedAt: "2026-03-09T00:00:00Z",
      budget: 2000,
    });

    expect(markdown).toContain("# Project Context - AiBridge Workspace");
    expect(markdown).toContain("> Last updated: 2026-03-09T00:00:00Z");
    expect(markdown).toContain("## Task Summary");
    expect(markdown).toContain("## Unread Messages");
    expect(markdown).toContain("## Suggested Next Actions");
    expect(markdown.indexOf("The dashboard still needs a non-mock bridge source")).toBeLessThan(
      markdown.indexOf("Keep the landing page untouched while wiring the real local slice."),
    );
  });
});

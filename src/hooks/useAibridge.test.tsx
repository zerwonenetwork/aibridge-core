import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAibridge } from "./useAibridge";
import type { AibridgeStatus } from "@/lib/aibridge/types";

const stubStatus: AibridgeStatus = {
  context: {
    projectName: "test-project",
    repoPath: "/test",
    lastSyncAt: "2026-03-08T10:00:00Z",
    schemaVersion: "1.0",
    activeAgents: [],
    taskCounts: { pending: 0, in_progress: 0, done: 0 },
  },
  tasks: [],
  logs: [],
  handoffs: [],
  decisions: [],
  conventions: [],
  messages: [],
  releases: [],
  announcements: [],
  sessions: [],
  capture: { hooksInstalled: [], watcher: { running: false, debounceMs: 300 }, validationWarnings: 0 },
  access: { role: "admin", canMutate: true, adminConfigured: false, authMode: "local-header" },
  contextMarkdown: "",
  issues: [],
};
function HookProbe() {
  const { status, runtime, loading, error } = useAibridge();

  return (
    <div>
      <span data-testid="project">{status.context.projectName}</span>
      <span data-testid="mode">{runtime.mode}</span>
      <span data-testid="source">{runtime.sourceLabel}</span>
      <span data-testid="loading">{loading ? "yes" : "no"}</span>
      <span data-testid="error">{error?.message ?? ""}</span>
      <span data-testid="error-code">{error?.code ?? ""}</span>
    </div>
  );
}

interface MockEventSourceInstance {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  emit: (eventName: string, data: unknown) => void;
}

let eventSourceInstance: MockEventSourceInstance;

beforeEach(() => {
  const listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  eventSourceInstance = {
    addEventListener: vi.fn((eventName: string, listener: (event: MessageEvent<string>) => void) => {
      const next = listeners.get(eventName) ?? new Set<(event: MessageEvent<string>) => void>();
      next.add(listener);
      listeners.set(eventName, next);
    }),
    removeEventListener: vi.fn((eventName: string, listener: (event: MessageEvent<string>) => void) => {
      listeners.get(eventName)?.delete(listener);
    }),
    close: vi.fn(),
    emit: (eventName: string, data: unknown) => {
      const event = {
        data: JSON.stringify(data),
      } as MessageEvent<string>;
      listeners.get(eventName)?.forEach((listener) => listener(event));
    },
  };

  vi.stubGlobal(
    "EventSource",
    vi.fn(() => eventSourceInstance),
  );
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAibridge", () => {
  it("loads local bridge data through the unified hook", async () => {
    localStorage.setItem(
      "aibridge-data-source",
      JSON.stringify({
        mode: "local",
        localSource: "sample",
        customRoot: "",
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            ...stubStatus,
            context: {
              ...stubStatus.context,
              projectName: "Local Sample Bridge",
            },
          },
          runtime: {
            mode: "local",
            localSource: "sample",
            sourceLabel: "Sample Bridge",
            rootPath: "/sample/.aibridge",
            isSample: true,
          },
        }),
      }),
    );

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("project")).toHaveTextContent("Local Sample Bridge");
    });

    expect(screen.getByTestId("mode")).toHaveTextContent("local");
    expect(screen.getByTestId("source")).toHaveTextContent("Sample Bridge");
    expect(screen.getByTestId("loading")).toHaveTextContent("no");
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it(
    "opens an SSE subscription in local mode and refreshes on bridge.changed",
    async () => {
      localStorage.setItem(
        "aibridge-data-source",
        JSON.stringify({
          mode: "local",
          localSource: "workspace",
          customRoot: "",
        }),
      );

      let fetchCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => {
          fetchCount += 1;
          return {
            ok: true,
            json: async () => ({
              data: {
                ...stubStatus,
                context: {
                  ...stubStatus.context,
                  projectName: `Fetch ${fetchCount}`,
                },
              },
              runtime: {
                mode: "local",
                localSource: "workspace",
                sourceLabel: "Workspace Bridge",
                rootPath: "/workspace/.aibridge",
                isSample: false,
              },
            }),
          };
        }),
      );

      render(<HookProbe />);

      await waitFor(() => {
        expect(screen.getByTestId("project")).toHaveTextContent("Fetch 1");
      });

      expect(vi.mocked(EventSource)).toHaveBeenCalledWith(
        expect.stringContaining("/bridge/events?source=workspace"),
      );

      eventSourceInstance.emit("bridge.changed", {
        event: "bridge.changed",
        revision: "rev-2",
        timestamp: new Date().toISOString(),
        runtime: {
          mode: "local",
          localSource: "workspace",
          sourceLabel: "Workspace Bridge",
        },
      });

      await waitFor(
        () => {
          expect(screen.getByTestId("project")).toHaveTextContent("Fetch 2");
        },
        { timeout: 2500 },
      );
    },
    8000,
  );

  it("surfaces SERVICE_UNAVAILABLE when the local service is offline", async () => {
    localStorage.setItem(
      "aibridge-data-source",
      JSON.stringify({
        mode: "local",
        localSource: "workspace",
        customRoot: "",
      }),
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("error-code")).toHaveTextContent("SERVICE_UNAVAILABLE");
    });

    expect(screen.getByTestId("error")).toHaveTextContent("Local bridge service is not running");
    expect(screen.getByTestId("loading")).toHaveTextContent("no");
  });

  it("stored demo mode preference is forced to local", async () => {
    localStorage.setItem(
      "aibridge-data-source",
      JSON.stringify({
        mode: "demo",
        localSource: "sample",
        customRoot: "",
      }),
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<HookProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("local");
    });
  });
});

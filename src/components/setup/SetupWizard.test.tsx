import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";
import type { GeneratedProjectPlan, SetupQuestionnaire, SetupResult, SetupTemplate } from "@/lib/aibridge/setup/types";

const previewPlan = vi.fn();
const initializeLocal = vi.fn();
const mockTemplate = {
  id: "web-app",
  label: "Web App",
  description: "Build a web app",
  defaultPrimaryDeliverable: "Responsive web application",
  structureAssumptions: [],
  suggestedStacks: ["react", "typescript"],
  defaultPriorities: ["speed"],
  defaultAgentMode: "multi-agent",
  defaultAgentRoles: [],
  defaultConventions: [],
  defaultTaskBlueprints: [],
  definitionOfDone: ["Ship the first slice"],
  workflowPattern: {
    summary: "Ship in small slices.",
    handoffPattern: "Cursor -> Codex",
    reviewCadence: "Per milestone",
    milestones: ["scope", "build"],
  },
} satisfies SetupTemplate;
const mockDefaults = {
  projectName: "",
  shortDescription: "",
  templateId: "web-app",
  primaryDeliverable: "Responsive web application",
  preferredStack: ["react", "typescript"],
  priorities: ["speed"],
  agentMode: "multi-agent",
  hardConstraints: [],
  existingRepo: false,
  existingFilesSummary: "",
  customInstructions: "",
} satisfies SetupQuestionnaire;

vi.mock("@/hooks/useProjectSetup", () => ({
  useProjectSetup: () => ({
    templates: [mockTemplate],
    defaults: mockDefaults,
    loading: false,
    error: null,
    previewPlan,
    initializeLocal,
  }),
}));

function renderWizard(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function createResult(projectName: string): SetupResult {
  const plan: GeneratedProjectPlan = {
    templateId: "web-app",
    brief: {
      projectName,
      summary: `${projectName} summary`,
      primaryDeliverable: "Responsive web application",
      templateId: "web-app",
      preferredStack: ["react", "typescript"],
      priorities: ["speed"],
      hardConstraints: [],
      existingRepo: false,
    },
    starterAgentRoles: [
      { key: "builder", name: "Builder", agentKind: "cursor", responsibilities: ["Implement the first slice"], ownership: ["src"] },
    ],
    starterTasks: [
      { key: "scope", title: "Define scope", summary: "Scope the first slice", priority: "high", status: "pending", suggestedRoleKey: "builder" },
    ],
    conventions: [
      { key: "workflow", rule: "Regenerate context after changes.", category: "workflow" },
    ],
    starterMessages: [],
    starterHandoffs: [],
    definitionOfDone: ["First slice is shipped"],
    workflow: {
      summary: "Ship in small slices.",
      handoffPattern: "Cursor -> Codex",
      reviewCadence: "Per milestone",
      milestones: ["scope", "build"],
    },
  };

  return {
    template: { ...mockTemplate },
    questionnaire: {
      projectName,
      shortDescription: "",
      templateId: "web-app",
      primaryDeliverable: "Responsive web application",
      preferredStack: ["react", "typescript"],
      priorities: ["speed"],
      agentMode: "multi-agent",
      hardConstraints: [],
      existingRepo: false,
      existingFilesSummary: "",
      customInstructions: "",
    },
    brief: plan.brief,
    preferences: {
      preferredStack: ["react", "typescript"],
      priorities: ["speed"],
      agentMode: "multi-agent",
      hardConstraints: [],
      existingRepo: false,
    },
    plan,
    localBridge: {
      projectName,
      agentKinds: ["cursor"],
      initialize: true,
      setupMetadata: {
        templateId: "web-app",
        summary: `${projectName} summary`,
        primaryDeliverable: "Responsive web application",
        preferredStack: ["react", "typescript"],
        priorities: ["speed"],
        agentMode: "multi-agent",
        hardConstraints: [],
        definitionOfDone: ["First slice is shipped"],
        workflowSummary: "Ship in small slices.",
        roles: [{ key: "builder", name: "Builder", agentKind: "cursor", responsibilities: ["Implement the first slice"] }],
        createdAt: "2026-03-11T00:00:00.000Z",
      },
    },
    generatedAt: "2026-03-11T00:00:00.000Z",
  };
}

async function walkToCreateStep(projectName: string) {
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: projectName } });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  fireEvent.click(screen.getByRole("button", { name: /generate plan/i }));
  await screen.findByText("Generated plan");
  await waitFor(() => { expect(previewPlan).toHaveBeenCalled(); });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
}

describe("SetupWizard (local mode)", () => {
  beforeEach(() => {
    previewPlan.mockReset();
    initializeLocal.mockReset();
    window.localStorage.clear();
  });

  it("completes local setup through the shared initialization path", async () => {
    const result = createResult("Local Setup");
    previewPlan.mockResolvedValue({ template: result.template, questionnaire: result.questionnaire, plan: result.plan, result });
    initializeLocal.mockResolvedValue({ rootPath: "D:/Projects/local-setup/.aibridge", result, markdown: "# Context" });

    renderWizard(<SetupWizard mode="local" localRequestOptions={{ source: "workspace", accessRole: "admin" }} />);

    await walkToCreateStep("Local Setup");
    fireEvent.click(screen.getByRole("button", { name: /initialize local bridge/i }));

    await screen.findByText("Local workspace ready");

    expect(initializeLocal).toHaveBeenCalledWith(
      expect.objectContaining({ source: "workspace", accessRole: "admin" }),
      expect.objectContaining({ projectName: "Local Setup" }),
      expect.objectContaining({ cwd: undefined, clearExistingData: false }),
    );
  });
});

import { describe, expect, it } from "vitest";
import { buildSetupResult, listSetupTemplates } from "./index";

describe("setup generator", () => {
  it("loads the supported setup templates and generates a default brief without manual boilerplate", () => {
    const templates = listSetupTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      "web-app",
      "api-backend",
      "mobile-app",
      "landing-page",
      "ai-automation",
      "research-docs",
      "empty",
    ]);

    const result = buildSetupResult({
      projectName: "Orbit",
      templateId: "web-app",
    });

    expect(result.template.label).toBe("Web App");
    expect(result.brief.summary).toContain("Orbit");
    expect(result.plan.starterAgentRoles.map((role) => role.agentKind)).toEqual(["cursor", "codex", "claude"]);
    expect(result.plan.starterTasks.some((task) => task.title === "Implement the first working UI slice")).toBe(true);
    expect(result.plan.starterMessages).toHaveLength(1);
    expect(result.plan.starterHandoffs).toHaveLength(1);
    expect(result.plan.definitionOfDone[0]).toContain("Responsive web application");
  });

  it("changes starter tasks and conventions by template and setup preferences", () => {
    const apiResult = buildSetupResult({
      projectName: "Relay API",
      templateId: "api-backend",
      preferredStack: ["node", "supabase"],
      priorities: ["security", "quality"],
      existingRepo: true,
      customInstructions: "Keep the first slice small.",
    });

    expect(apiResult.plan.starterTasks.some((task) => task.key === "security-review")).toBe(true);
    expect(apiResult.plan.conventions.some((convention) => convention.key === "existing-repo")).toBe(true);
    expect(apiResult.plan.conventions.some((convention) => convention.key === "custom-instructions")).toBe(true);
    expect(apiResult.plan.workflow.summary).toContain("Contract-first");

    const landingResult = buildSetupResult({
      projectName: "Pulse Launch",
      templateId: "landing-page",
      shortDescription: "Ship a product landing page.",
    });

    expect(landingResult.plan.starterTasks.map((task) => task.key)).toContain("audit");
    expect(landingResult.plan.starterTasks.map((task) => task.key)).toContain("implement");
    expect(landingResult.plan.definitionOfDone.some((item) => item.includes("landing page"))).toBe(true);
  });
});

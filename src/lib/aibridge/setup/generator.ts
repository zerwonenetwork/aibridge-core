import { createDefaultSetupQuestionnaire } from "./questionnaire";
import { getSetupTemplate } from "./templates";
import type {
  BridgeSetupMetadata,
  GeneratedAgentRole,
  GeneratedConvention,
  GeneratedProjectPlan,
  GeneratedStarterMessage,
  GeneratedStarterTask,
  ProjectBrief,
  SetupAgentKind,
  SetupPreferences,
  SetupQuestionnaire,
  SetupResult,
  SetupTemplate,
  SetupTemplateId,
} from "./types";

function slugifyProjectName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "aibridge-project";
}

function normalizeList(values: string[] | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function uniqueList(values: string[]) {
  return [...new Set(values)];
}

function resolveTemplate(questionnaire: SetupQuestionnaire): SetupTemplate {
  const template = getSetupTemplate(questionnaire.templateId);
  if (!template) {
    throw new Error(`Unknown setup template: ${questionnaire.templateId}`);
  }

  return template;
}

function resolveSetupSummary(
  projectName: string,
  providedSummary: string | undefined,
  primaryDeliverable: string,
  template: SetupTemplate,
) {
  const summary = providedSummary?.trim();
  if (summary) {
    return summary;
  }

  return `${projectName} is a ${template.label.toLowerCase()} focused on ${primaryDeliverable.toLowerCase()}.`;
}

function resolveBrief(questionnaire: SetupQuestionnaire, template: SetupTemplate): ProjectBrief {
  const projectName = questionnaire.projectName.trim();
  const primaryDeliverable = questionnaire.primaryDeliverable.trim() || template.defaultPrimaryDeliverable;

  return {
    projectName,
    summary: resolveSetupSummary(projectName, questionnaire.shortDescription, primaryDeliverable, template),
    primaryDeliverable,
    templateId: questionnaire.templateId,
    preferredStack: uniqueList(normalizeList(questionnaire.preferredStack).length > 0 ? normalizeList(questionnaire.preferredStack) : template.suggestedStacks),
    priorities: questionnaire.priorities.length > 0 ? questionnaire.priorities.slice() : template.defaultPriorities.slice(),
    hardConstraints: normalizeList(questionnaire.hardConstraints),
    existingRepo: questionnaire.existingRepo,
    existingFilesSummary: questionnaire.existingFilesSummary?.trim() || undefined,
    customInstructions: questionnaire.customInstructions?.trim() || undefined,
  };
}

function resolvePreferences(brief: ProjectBrief, template: SetupTemplate, questionnaire: SetupQuestionnaire): SetupPreferences {
  return {
    preferredStack: brief.preferredStack.length > 0 ? brief.preferredStack : template.suggestedStacks.slice(),
    priorities: brief.priorities.length > 0 ? brief.priorities : template.defaultPriorities.slice(),
    agentMode: questionnaire.agentMode || template.defaultAgentMode,
    hardConstraints: brief.hardConstraints,
    customInstructions: brief.customInstructions,
    existingRepo: brief.existingRepo,
    existingFilesSummary: brief.existingFilesSummary,
  };
}

function resolveRoles(template: SetupTemplate, preferences: SetupPreferences): GeneratedAgentRole[] {
  const seedRoles = preferences.agentMode === "single-agent"
    ? template.defaultAgentRoles.slice(0, 1)
    : template.defaultAgentRoles;

  return seedRoles.map((role) => ({
    key: role.key,
    name: role.name,
    agentKind: role.agentKind,
    responsibilities: role.responsibilities.slice(),
    ownership: role.ownership?.slice() ?? [],
  }));
}

function resolveTasks(
  template: SetupTemplate,
  brief: ProjectBrief,
  preferences: SetupPreferences,
  roles: GeneratedAgentRole[],
): GeneratedStarterTask[] {
  const tasks: GeneratedStarterTask[] = template.defaultTaskBlueprints.map((task) => ({
    key: task.key,
    title: task.title,
    summary: `${task.summary} Target deliverable: ${brief.primaryDeliverable}.`,
    priority: task.priority,
    status: "pending",
    suggestedRoleKey: roles.find((role) => role.key === task.suggestedRoleKey)?.key ?? roles[0]?.key,
  }));

  if (preferences.preferredStack.length > 0) {
    tasks.splice(1, 0, {
      key: "stack-choice",
      title: "Lock preferred stack and tools",
      summary: `Confirm the working stack and toolchain: ${preferences.preferredStack.join(", ")}.`,
      priority: "high",
      status: "pending",
      suggestedRoleKey: roles[0]?.key,
    });
  }

  if (preferences.priorities.includes("security")) {
    tasks.push({
      key: "security-review",
      title: "Review security and risk constraints",
      summary: "Check the first slice against the requested security constraints before release.",
      priority: "high",
      status: "pending",
      suggestedRoleKey: roles[1]?.key ?? roles[0]?.key,
    });
  }

  if (preferences.priorities.includes("cost")) {
    tasks.push({
      key: "cost-review",
      title: "Review cost-sensitive implementation choices",
      summary: "Favor lower-complexity or lower-runtime-cost choices and document tradeoffs.",
      priority: "medium",
      status: "pending",
      suggestedRoleKey: roles[1]?.key ?? roles[0]?.key,
    });
  }

  return tasks;
}

function resolveConventions(template: SetupTemplate, brief: ProjectBrief, preferences: SetupPreferences): GeneratedConvention[] {
  const conventions: GeneratedConvention[] = template.defaultConventions.map((convention) => ({
    key: convention.key,
    rule: convention.rule,
    category: convention.category,
  }));

  if (preferences.existingRepo) {
    conventions.push({
      key: "existing-repo",
      rule: "Respect the existing repo structure and avoid broad rewrites during setup.",
      category: "workflow",
    });
  }

  if (brief.customInstructions) {
    conventions.push({
      key: "custom-instructions",
      rule: `Honor the custom project instructions: ${brief.customInstructions}`,
      category: "documentation",
    });
  }

  if (preferences.priorities.includes("speed")) {
    conventions.push({
      key: "speed-priority",
      rule: "Prefer the smallest production-worthy slice before expanding scope.",
      category: "workflow",
    });
  }

  return conventions;
}

function resolveDefinitionOfDone(template: SetupTemplate, brief: ProjectBrief) {
  const checklist = template.definitionOfDone.slice();
  checklist.unshift(`The primary deliverable is clear: ${brief.primaryDeliverable}.`);
  return uniqueList(checklist);
}

function resolveWorkflow(template: SetupTemplate, preferences: SetupPreferences) {
  const workflow = { ...template.workflowPattern };
  if (preferences.agentMode === "single-agent") {
    workflow.summary = `${workflow.summary} Use one lead agent and explicit self-review before handoff or release.`;
  }
  return workflow;
}

function resolveStarterMessages(brief: ProjectBrief, roles: GeneratedAgentRole[], workflowSummary: string): GeneratedStarterMessage[] {
  if (roles.length < 2) {
    return [];
  }

  return [
    {
      fromRoleKey: roles[0].key,
      toRoleKey: roles[1].key,
      severity: "info",
      content: `Kickoff for ${brief.projectName}: focus on ${brief.primaryDeliverable}. Workflow: ${workflowSummary}`,
    },
  ];
}

function resolveStarterHandoffs(brief: ProjectBrief, roles: GeneratedAgentRole[]): GeneratedProjectPlan["starterHandoffs"] {
  if (roles.length < 2) {
    return [];
  }

  return [
    {
      fromRoleKey: roles[0].key,
      toRoleKey: roles[1].key,
      description: `Review the initial setup slice for ${brief.projectName} and tighten the first execution plan.`,
    },
  ];
}

function buildBridgeSetupMetadata(
  brief: ProjectBrief,
  preferences: SetupPreferences,
  roles: GeneratedAgentRole[],
  definitionOfDone: string[],
  workflowSummary: string,
  generatedAt: string,
): BridgeSetupMetadata {
  return {
    templateId: brief.templateId,
    summary: brief.summary,
    primaryDeliverable: brief.primaryDeliverable,
    preferredStack: preferences.preferredStack.slice(),
    priorities: preferences.priorities.slice(),
    agentMode: preferences.agentMode,
    hardConstraints: preferences.hardConstraints.slice(),
    customInstructions: preferences.customInstructions,
    definitionOfDone: definitionOfDone.slice(),
    workflowSummary,
    roles: roles.map((role) => ({
      key: role.key,
      name: role.name,
      agentKind: role.agentKind,
      responsibilities: role.responsibilities.slice(),
    })),
    createdAt: generatedAt,
  };
}

export function generateProjectPlan(questionnaire: SetupQuestionnaire): GeneratedProjectPlan {
  const template = resolveTemplate(questionnaire);
  const brief = resolveBrief(questionnaire, template);
  const preferences = resolvePreferences(brief, template, questionnaire);
  const starterAgentRoles = resolveRoles(template, preferences);
  const workflow = resolveWorkflow(template, preferences);
  const definitionOfDone = resolveDefinitionOfDone(template, brief);

  return {
    templateId: template.id,
    brief,
    starterAgentRoles,
    starterTasks: resolveTasks(template, brief, preferences, starterAgentRoles),
    conventions: resolveConventions(template, brief, preferences),
    starterMessages: resolveStarterMessages(brief, starterAgentRoles, workflow.summary),
    starterHandoffs: resolveStarterHandoffs(brief, starterAgentRoles),
    definitionOfDone,
    workflow,
  };
}

export function createSetupResult(questionnaireInput: Partial<SetupQuestionnaire> & Pick<SetupQuestionnaire, "projectName" | "templateId">): SetupResult {
  const defaults = createDefaultSetupQuestionnaire(questionnaireInput.templateId);
  const questionnaire: SetupQuestionnaire = {
    ...defaults,
    ...questionnaireInput,
    projectName: questionnaireInput.projectName.trim(),
    shortDescription: questionnaireInput.shortDescription?.trim() ?? "",
    primaryDeliverable: questionnaireInput.primaryDeliverable?.trim() || defaults.primaryDeliverable,
    preferredStack: normalizeList(questionnaireInput.preferredStack ?? defaults.preferredStack),
    priorities: questionnaireInput.priorities?.length ? questionnaireInput.priorities.slice() : defaults.priorities.slice(),
    agentMode: questionnaireInput.agentMode ?? defaults.agentMode,
    hardConstraints: normalizeList(questionnaireInput.hardConstraints ?? defaults.hardConstraints),
    existingRepo: questionnaireInput.existingRepo ?? defaults.existingRepo,
    existingFilesSummary: questionnaireInput.existingFilesSummary?.trim() ?? defaults.existingFilesSummary,
    customInstructions: questionnaireInput.customInstructions?.trim() ?? defaults.customInstructions,
  };

  if (!questionnaire.projectName) {
    throw new Error("Project name is required for setup.");
  }

  const template = resolveTemplate(questionnaire);
  const plan = generateProjectPlan(questionnaire);
  const brief = plan.brief;
  const preferences = resolvePreferences(brief, template, questionnaire);
  const generatedAt = new Date().toISOString();
  const setupMetadata = buildBridgeSetupMetadata(
    brief,
    preferences,
    plan.starterAgentRoles,
    plan.definitionOfDone,
    plan.workflow.summary,
    generatedAt,
  );

  return {
    template,
    questionnaire,
    brief,
    preferences,
    plan,
    localBridge: {
      projectName: brief.projectName,
      agentKinds: uniqueList(plan.starterAgentRoles.map((role) => role.agentKind)) as SetupAgentKind[],
      initialize: true,
      setupMetadata,
    },
    hostedProject: {
      slug: slugifyProjectName(brief.projectName),
      name: brief.projectName,
      description: brief.summary,
      tags: uniqueList([template.id, ...brief.preferredStack]),
      templateId: template.id,
      setupBrief: brief,
      setupPreferences: preferences,
      setupPlan: plan,
    },
    generatedAt,
  };
}

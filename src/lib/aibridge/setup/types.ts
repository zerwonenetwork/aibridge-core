export const setupTemplateIds = [
  "web-app",
  "api-backend",
  "mobile-app",
  "landing-page",
  "ai-automation",
  "research-docs",
  "empty",
] as const;

export const setupPriorityValues = ["speed", "quality", "security", "cost"] as const;
export const setupAgentModes = ["single-agent", "multi-agent"] as const;
export const setupAgentKinds = ["cursor", "claude", "codex", "copilot", "windsurf", "antigravity", "custom"] as const;

export type SetupTemplateId = (typeof setupTemplateIds)[number];
export type SetupPriority = (typeof setupPriorityValues)[number];
export type SetupAgentMode = (typeof setupAgentModes)[number];
export type SetupAgentKind = (typeof setupAgentKinds)[number];

export interface SetupTemplateRoleDefinition {
  key: string;
  name: string;
  agentKind: SetupAgentKind;
  responsibilities: string[];
  ownership?: string[];
}

export interface SetupTaskBlueprint {
  key: string;
  title: string;
  summary: string;
  priority: "low" | "medium" | "high";
  suggestedRoleKey?: string;
}

export interface SetupConventionBlueprint {
  key: string;
  rule: string;
  category: "code-style" | "architecture" | "testing" | "documentation" | "workflow" | "other";
}

export interface SetupTemplate {
  id: SetupTemplateId;
  label: string;
  description: string;
  defaultPrimaryDeliverable: string;
  structureAssumptions: string[];
  suggestedStacks: string[];
  defaultPriorities: SetupPriority[];
  defaultAgentMode: SetupAgentMode;
  defaultAgentRoles: SetupTemplateRoleDefinition[];
  defaultConventions: SetupConventionBlueprint[];
  defaultTaskBlueprints: SetupTaskBlueprint[];
  definitionOfDone: string[];
  workflowPattern: {
    summary: string;
    handoffPattern: string;
    reviewCadence: string;
    milestones: string[];
  };
}

export interface SetupQuestionnaire {
  projectName: string;
  shortDescription: string;
  templateId: SetupTemplateId;
  primaryDeliverable: string;
  preferredStack: string[];
  priorities: SetupPriority[];
  agentMode: SetupAgentMode;
  hardConstraints: string[];
  existingRepo: boolean;
  existingFilesSummary?: string;
  customInstructions?: string;
}

export interface ProjectBrief {
  projectName: string;
  summary: string;
  primaryDeliverable: string;
  templateId: SetupTemplateId;
  preferredStack: string[];
  priorities: SetupPriority[];
  hardConstraints: string[];
  existingRepo: boolean;
  existingFilesSummary?: string;
  customInstructions?: string;
}

export interface SetupPreferences {
  preferredStack: string[];
  priorities: SetupPriority[];
  agentMode: SetupAgentMode;
  hardConstraints: string[];
  customInstructions?: string;
  existingRepo: boolean;
  existingFilesSummary?: string;
}

export interface GeneratedAgentRole {
  key: string;
  name: string;
  agentKind: SetupAgentKind;
  responsibilities: string[];
  ownership: string[];
}

export interface GeneratedStarterTask {
  key: string;
  title: string;
  summary: string;
  priority: "low" | "medium" | "high";
  status: "pending";
  suggestedRoleKey?: string;
}

export interface GeneratedConvention {
  key: string;
  rule: string;
  category: "code-style" | "architecture" | "testing" | "documentation" | "workflow" | "other";
}

export interface GeneratedStarterMessage {
  fromRoleKey: string;
  toRoleKey?: string;
  severity: "info" | "warning" | "critical";
  content: string;
}

export interface GeneratedStarterHandoff {
  fromRoleKey: string;
  toRoleKey: string;
  description: string;
  relatedTaskKeys?: string[];
}

export interface GeneratedProjectPlan {
  templateId: SetupTemplateId;
  brief: ProjectBrief;
  starterAgentRoles: GeneratedAgentRole[];
  starterTasks: GeneratedStarterTask[];
  conventions: GeneratedConvention[];
  starterMessages: GeneratedStarterMessage[];
  starterHandoffs: GeneratedStarterHandoff[];
  definitionOfDone: string[];
  workflow: {
    summary: string;
    handoffPattern: string;
    reviewCadence: string;
    milestones: string[];
  };
}

export interface BridgeSetupMetadata {
  templateId: SetupTemplateId;
  summary: string;
  primaryDeliverable: string;
  preferredStack: string[];
  priorities: SetupPriority[];
  agentMode: SetupAgentMode;
  hardConstraints: string[];
  customInstructions?: string;
  definitionOfDone: string[];
  workflowSummary: string;
  roles: Array<{
    key: string;
    name: string;
    agentKind: SetupAgentKind;
    responsibilities: string[];
  }>;
  createdAt: string;
}

export interface SetupResult {
  template: SetupTemplate;
  questionnaire: SetupQuestionnaire;
  brief: ProjectBrief;
  preferences: SetupPreferences;
  plan: GeneratedProjectPlan;
  localBridge: {
    projectName: string;
    agentKinds: SetupAgentKind[];
    initialize: boolean;
    setupMetadata: BridgeSetupMetadata;
  };
  generatedAt: string;
}

export interface SetupPlanPreview {
  template: SetupTemplate;
  questionnaire: SetupQuestionnaire;
  plan: GeneratedProjectPlan;
}

export interface LocalSetupInitializationOptions {
  cwd?: string;
  clearExistingData?: boolean;
}

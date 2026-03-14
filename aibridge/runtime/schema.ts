import { z } from "zod";

export const agentKinds = [
  "cursor",
  "claude",
  "codex",
  "antigravity",
  "copilot",
  "windsurf",
  "custom",
] as const;

export const taskStatuses = ["pending", "in_progress", "done"] as const;
export const priorities = ["low", "medium", "high"] as const;
export const messageSeverities = ["info", "warning", "critical"] as const;
export const decisionStatuses = ["proposed", "accepted", "superseded"] as const;
export const releaseStatuses = ["draft", "published", "archived"] as const;
export const announcementStatuses = ["draft", "published", "pinned", "archived"] as const;
export const announcementAudiences = ["all", "admin", "internal"] as const;
export const announcementSeverities = ["info", "success", "warning", "critical"] as const;
export const conventionCategories = [
  "code-style",
  "architecture",
  "testing",
  "documentation",
  "workflow",
  "other",
] as const;
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
export const agentToolKinds = ["cursor", "codex", "antigravity"] as const;
export const agentSessionStatuses = ["pending", "active", "stale", "stopped", "failed"] as const;
export const agentLaunchSources = ["dashboard", "app", "cli"] as const;

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(agentKinds),
  configPath: z.string().min(1),
  ownedPaths: z.array(z.string().min(1)).optional(),
  lastActiveAt: z.string().datetime().optional(),
});

const bridgeSetupRoleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  agentKind: z.enum(agentKinds),
  responsibilities: z.array(z.string().min(1)).default([]),
});

export const bridgeSetupSchema = z.object({
  templateId: z.enum(setupTemplateIds),
  summary: z.string().min(1),
  primaryDeliverable: z.string().min(1),
  preferredStack: z.array(z.string().min(1)).default([]),
  priorities: z.array(z.enum(setupPriorityValues)).default([]),
  agentMode: z.enum(setupAgentModes),
  hardConstraints: z.array(z.string().min(1)).default([]),
  customInstructions: z.string().min(1).optional(),
  definitionOfDone: z.array(z.string().min(1)).default([]),
  workflowSummary: z.string().min(1),
  roles: z.array(bridgeSetupRoleSchema).default([]),
  createdAt: z.string().datetime(),
});

export const bridgeSchema = z.object({
  schemaVersion: z.string().min(1),
  projectName: z.string().min(1),
  createdAt: z.string().datetime(),
  agents: z.array(agentSchema),
  setup: bridgeSetupSchema.optional(),
});

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(taskStatuses),
  priority: z.enum(priorities),
  agentId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const logEntrySchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  action: z.string().min(1),
  description: z.string().min(1),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const handoffSchema = z.object({
  id: z.string().min(1),
  fromAgentId: z.string().min(1),
  toAgentId: z.string().min(1),
  description: z.string().min(1),
  timestamp: z.string().datetime(),
  relatedTaskIds: z.array(z.string().min(1)).optional(),
});

export const decisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.string().datetime(),
  status: z.enum(decisionStatuses).optional(),
});

export const conventionSchema = z.object({
  id: z.string().min(1),
  rule: z.string().min(1),
  addedAt: z.string().datetime(),
  addedBy: z.string().min(1).optional(),
  category: z.enum(conventionCategories).optional(),
});

export const messageSchema = z.object({
  id: z.string().min(1),
  fromAgentId: z.string().min(1),
  toAgentId: z.string().min(1).optional(),
  severity: z.enum(messageSeverities).default("info"),
  content: z.string().min(1),
  timestamp: z.string().datetime(),
  acknowledged: z.boolean().default(false),
});

export const agentRecoveryStateSchema = z.object({
  recommended: z.boolean(),
  reason: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  generatedAt: z.string().datetime().optional(),
});

export const launchInstructionSetSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  toolKind: z.enum(agentToolKinds),
  launchSource: z.enum(agentLaunchSources),
  generatedAt: z.string().datetime(),
  prompt: z.string().min(1),
  firstSteps: z.array(z.string().min(1)).default([]),
  checklist: z.array(z.string().min(1)).default([]),
  cliCommand: z.string().min(1),
  recoveryPrompt: z.string().min(1).optional(),
});

export const agentSessionSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  toolKind: z.enum(agentToolKinds),
  launchSource: z.enum(agentLaunchSources),
  repoPath: z.string().min(1),
  bridgeRoot: z.string().min(1),
  status: z.enum(agentSessionStatuses),
  launchedAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().optional(),
  acknowledgedContextTimestamp: z.string().datetime().optional(),
  lastHeartbeatAt: z.string().datetime().optional(),
  lastActivityAt: z.string().datetime().optional(),
  currentTaskIds: z.array(z.string().min(1)).optional(),
  stoppedAt: z.string().datetime().optional(),
  stoppedReason: z.string().min(1).optional(),
  failureReason: z.string().min(1).optional(),
  instructions: launchInstructionSetSchema,
  recovery: agentRecoveryStateSchema.optional(),
});

export const releaseSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(releaseStatuses),
  publishedAt: z.string().datetime().optional(),
  highlights: z.array(z.string().min(1)).default([]),
  breakingChanges: z.array(z.string().min(1)).default([]),
  upgradeNotes: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  createdBy: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const announcementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(announcementStatuses),
  audience: z.enum(announcementAudiences),
  severity: z.enum(announcementSeverities),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  createdBy: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BridgeDocument = z.infer<typeof bridgeSchema>;
export type BridgeSetupDocument = z.infer<typeof bridgeSetupSchema>;
export type TaskDocument = z.infer<typeof taskSchema>;
export type LogEntryDocument = z.infer<typeof logEntrySchema>;
export type HandoffDocument = z.infer<typeof handoffSchema>;
export type DecisionDocument = z.infer<typeof decisionSchema>;
export type ConventionDocument = z.infer<typeof conventionSchema>;
export type MessageDocument = z.infer<typeof messageSchema>;
export type AgentSessionDocument = z.infer<typeof agentSessionSchema>;
export type ReleaseDocument = z.infer<typeof releaseSchema>;
export type AnnouncementDocument = z.infer<typeof announcementSchema>;

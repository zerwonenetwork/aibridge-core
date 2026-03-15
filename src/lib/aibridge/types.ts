export type AgentId = string;
export type TaskStatus = "pending" | "in_progress" | "done";
export type AibridgeAgentKind =
  | "cursor"
  | "claude"
  | "codex"
  | "antigravity"
  | "copilot"
  | "windsurf"
  | "custom";
export type AibridgeMessageSeverity = "info" | "warning" | "critical";
export type AibridgeDecisionStatus = "proposed" | "accepted" | "superseded";
export type AibridgeConventionCategory =
  | "code-style"
  | "architecture"
  | "testing"
  | "documentation"
  | "workflow"
  | "other";
export type AibridgeReleaseStatus = "draft" | "published" | "archived";
export type AibridgeAnnouncementStatus = "draft" | "published" | "pinned" | "archived";
export type AibridgeAnnouncementAudience = "all" | "admin" | "internal";
export type AibridgeAnnouncementSeverity = "info" | "success" | "warning" | "critical";
export type AibridgeMode = "local";
export type AibridgeLocalSource = "sample" | "workspace" | "custom";
export type AibridgeCaptureConfidence = "high" | "medium" | "low";
export type AibridgeAccessRole = "admin" | "viewer";
export type AibridgeAgentToolKind = "cursor" | "codex" | "antigravity";
export type AibridgeAgentSessionStatus = "pending" | "active" | "stale" | "stopped" | "failed";
export type AibridgeAgentLaunchSource = "dashboard" | "app" | "cli";
export type AibridgeAgentLaunchMode = "prompt_copy" | "ui_dispatch" | "background_remote" | "non_chat_exec";
export type AibridgeAgentDispatchStatus = "not_attempted" | "launched" | "unsupported" | "failed";
export type AibridgeSetupTemplateId =
  | "web-app"
  | "api-backend"
  | "mobile-app"
  | "landing-page"
  | "ai-automation"
  | "research-docs"
  | "empty";
export type AibridgeSetupPriority = "speed" | "quality" | "security" | "cost";
export type AibridgeSetupAgentMode = "single-agent" | "multi-agent";

export interface AibridgeTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  agentId?: AgentId;
  createdAt: string;
  updatedAt: string;
}

export interface AibridgeAgent {
  id: AgentId;
  name: string;
  kind: AibridgeAgentKind;
  configPath: string;
  ownedPaths?: string[];
  lastActiveAt?: string;
}

export interface AibridgeLogEntry {
  id: string;
  agentId: AgentId;
  action: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AibridgeHandoff {
  id: string;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  description: string;
  timestamp: string;
  relatedTaskIds?: string[];
}

export interface AibridgeDecision {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  status?: AibridgeDecisionStatus;
}

export interface AibridgeConvention {
  id: string;
  rule: string;
  addedAt: string;
  addedBy?: string;
  category?: AibridgeConventionCategory;
}

export interface AibridgeMessage {
  id: string;
  fromAgentId: AgentId;
  toAgentId?: AgentId;
  severity: AibridgeMessageSeverity;
  content: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface AibridgeRelease {
  id: string;
  version: string;
  title: string;
  summary: string;
  status: AibridgeReleaseStatus;
  publishedAt?: string;
  highlights: string[];
  breakingChanges: string[];
  upgradeNotes: string[];
  tags: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AibridgeAnnouncement {
  id: string;
  title: string;
  body: string;
  status: AibridgeAnnouncementStatus;
  audience: AibridgeAnnouncementAudience;
  severity: AibridgeAnnouncementSeverity;
  publishedAt?: string;
  expiresAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AibridgeBridgeSetupSummary {
  templateId: AibridgeSetupTemplateId;
  summary: string;
  primaryDeliverable: string;
  preferredStack: string[];
  priorities: AibridgeSetupPriority[];
  agentMode: AibridgeSetupAgentMode;
  hardConstraints: string[];
  customInstructions?: string;
  definitionOfDone: string[];
  workflowSummary: string;
  roles: Array<{
    key: string;
    name: string;
    agentKind: AibridgeAgentKind;
    responsibilities: string[];
  }>;
  createdAt: string;
}

export interface AibridgeContextSummary {
  projectName: string;
  repoPath: string;
  lastSyncAt: string;
  schemaVersion: string;
  activeAgents: AibridgeAgent[];
  taskCounts: Record<TaskStatus, number>;
  sourceRoot?: string;
  sourceLabel?: string;
  setup?: AibridgeBridgeSetupSummary;
}

export interface AibridgeCaptureAttribution {
  agentId: AgentId;
  source: string;
  confidence: AibridgeCaptureConfidence;
}

export interface AibridgeCaptureWatcherState {
  running: boolean;
  pid?: number;
  watchedRoot?: string;
  debounceMs: number;
  startedAt?: string;
  lastHeartbeatAt?: string;
  lastEventAt?: string;
  recentPaths?: string[];
  attribution?: AibridgeCaptureAttribution;
  lastError?: string;
}

export interface AibridgeCaptureStatus {
  hooksInstalled: string[];
  watcher: AibridgeCaptureWatcherState;
  validationWarnings: number;
  lastWarningAt?: string;
  lastCapturedAt?: string;
}

export interface AibridgeAgentRecoveryState {
  recommended: boolean;
  reason?: string;
  prompt?: string;
  generatedAt?: string;
  mode?: AibridgeAgentLaunchMode;
  filesToAttach?: string[];
  commandPreview?: string;
  dispatchStatus?: AibridgeAgentDispatchStatus;
  dispatchNote?: string;
}

export interface AibridgeLaunchInstructionSet {
  sessionId: string;
  agentId: AgentId;
  toolKind: AibridgeAgentToolKind;
  launchSource: AibridgeAgentLaunchSource;
  generatedAt: string;
  mode: AibridgeAgentLaunchMode;
  title: string;
  subtitle?: string;
  prompt: string;
  firstSteps: string[];
  checklist: string[];
  cliCommand: string;
  filesToAttach: string[];
  commandPreview?: string;
  dispatchStatus: AibridgeAgentDispatchStatus;
  dispatchNote?: string;
  recoveryPrompt?: string;
}

export interface AibridgeAgentSession {
  id: string;
  agentId: AgentId;
  toolKind: AibridgeAgentToolKind;
  launchSource: AibridgeAgentLaunchSource;
  repoPath: string;
  bridgeRoot: string;
  status: AibridgeAgentSessionStatus;
  launchedAt: string;
  acknowledgedAt?: string;
  acknowledgedContextTimestamp?: string;
  lastHeartbeatAt?: string;
  lastActivityAt?: string;
  currentTaskIds?: string[];
  stoppedAt?: string;
  stoppedReason?: string;
  failureReason?: string;
  instructions: AibridgeLaunchInstructionSet;
  recovery?: AibridgeAgentRecoveryState;
}

export interface AibridgeAgentToolCapability {
  tool: AibridgeAgentToolKind;
  installed: boolean;
  version?: string;
  promptCopy: boolean;
  uiDispatch: boolean;
  recoveryDispatch: boolean;
  nonChatExec: boolean;
  fileAttach: boolean;
  generatedRules: boolean;
  mcpSupport: boolean;
}

export interface AibridgeProtocolIssue {
  id: string;
  type: "invalid_entity" | "stale_session" | "failed_session" | "stopped_with_work";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  agentId?: AgentId;
  sessionId?: string;
  entityKind?: "task" | "message" | "handoff" | "decision" | "convention" | "release" | "announcement" | "session";
  filePath?: string;
  recommendedAction: "cleanup_and_reprompt" | "copy_recovery_prompt" | "review_session" | "none";
}

export interface AibridgeAccessState {
  role: AibridgeAccessRole;
  canMutate: boolean;
  adminConfigured: boolean;
  authMode: "local-header";
}

export interface AibridgeStatus {
  context: AibridgeContextSummary;
  tasks: AibridgeTask[];
  logs: AibridgeLogEntry[];
  handoffs: AibridgeHandoff[];
  decisions: AibridgeDecision[];
  conventions: AibridgeConvention[];
  messages: AibridgeMessage[];
  sessions: AibridgeAgentSession[];
  releases: AibridgeRelease[];
  announcements: AibridgeAnnouncement[];
  capture: AibridgeCaptureStatus;
  access: AibridgeAccessState;
  contextMarkdown?: string;
  issues?: string[];
  protocolIssues?: AibridgeProtocolIssue[];
  toolCapabilities?: AibridgeAgentToolCapability[];
}

export interface AibridgeBridgeConfig {
  schemaVersion: string;
  projectName: string;
  createdAt: string;
  agents: AibridgeAgent[];
  setup?: AibridgeBridgeSetupSummary;
}

export interface AibridgeBridgeSnapshot {
  bridge: AibridgeBridgeConfig;
  contextMarkdown: string;
  conventionsMarkdown: string;
  tasks: AibridgeTask[];
  logs: AibridgeLogEntry[];
  handoffs: AibridgeHandoff[];
  decisions: AibridgeDecision[];
  conventions: AibridgeConvention[];
  messages: AibridgeMessage[];
  sessions: AibridgeAgentSession[];
  releases: AibridgeRelease[];
  announcements: AibridgeAnnouncement[];
  repoPath: string;
  lastSyncAt: string;
  issues: string[];
}

export interface AibridgeRuntimeState {
  mode: AibridgeMode;
  localSource?: AibridgeLocalSource;
  sourceLabel: string;
  rootPath?: string;
  isSample?: boolean;
  isFallback?: boolean;
}

export interface AibridgeLocalEvent {
  event: "ready" | "bridge.changed";
  revision: string;
  timestamp: string;
  runtime: AibridgeRuntimeState;
}

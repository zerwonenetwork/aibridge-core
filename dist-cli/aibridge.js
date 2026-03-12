#!/usr/bin/env node

// aibridge/cli/src/main.ts
import { promises as fs6 } from "fs";
import path7 from "path";
import readline from "readline/promises";

// aibridge/runtime/store.ts
import { randomUUID as randomUUID2 } from "crypto";
import { promises as fs2 } from "fs";
import { existsSync as existsSync2 } from "fs";
import path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// aibridge/runtime/context.ts
var PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2
};
var SEVERITY_ORDER = {
  critical: 0,
  warning: 1,
  info: 2
};
function compareDescByDate(left, right, getValue) {
  const timeDelta = getValue(right).localeCompare(getValue(left));
  return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
}
function estimateTokens(markdown) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.35);
}
function formatTaskAssignment(task) {
  return task.agentId ?? "unassigned";
}
function renderLimitedList(items, remainingLabel) {
  if (items.length === 0) {
    return "_(none)_";
  }
  const rendered = [...items];
  if (remainingLabel) {
    rendered.push(remainingLabel);
  }
  return rendered.join("\n");
}
function truncateSummary(summary, max) {
  if (!max || summary.length <= max) {
    return summary;
  }
  return `${summary.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;
}
function renderSuggestedActions(snapshot) {
  const sections = snapshot.bridge.agents.map((agent) => {
    const suggestions = [];
    const assignedPending = snapshot.tasks.filter((task) => task.agentId === agent.id && task.status === "pending").sort((left, right) => {
      const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const createdDelta = left.createdAt.localeCompare(right.createdAt);
      return createdDelta !== 0 ? createdDelta : left.id.localeCompare(right.id);
    });
    const handoffsToAgent = snapshot.handoffs.filter((handoff) => handoff.toAgentId === agent.id).sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));
    const unreadMessages = snapshot.messages.filter((message) => !message.acknowledged && (!message.toAgentId || message.toAgentId === agent.id)).sort((left, right) => {
      const severityDelta = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return compareDescByDate(left, right, (item) => item.timestamp);
    });
    const inProgress = snapshot.tasks.filter((task) => task.agentId === agent.id && task.status === "in_progress").sort((left, right) => compareDescByDate(left, right, (item) => item.updatedAt));
    assignedPending.slice(0, 1).forEach((task) => {
      suggestions.push(`- Start working on: ${task.title}`);
    });
    handoffsToAgent.slice(0, 1).forEach((handoff) => {
      suggestions.push(`- Review handoff from ${handoff.fromAgentId}: ${handoff.description}`);
    });
    unreadMessages.slice(0, 1).forEach((message) => {
      suggestions.push(`- Read message from ${message.fromAgentId}`);
    });
    if (suggestions.length === 0 && inProgress.length > 0) {
      suggestions.push(`- Continue working on: ${inProgress[0].title}`);
    }
    if (suggestions.length === 0) {
      suggestions.push("- No pending work - available for new assignments");
    }
    return [`### ${agent.name}`, suggestions.slice(0, 3).join("\n")].join("\n");
  });
  return sections.length > 0 ? sections.join("\n\n") : "_(none)_";
}
function renderReleaseSummary(release) {
  return `- **${release.version}** - ${release.title}: ${truncateSummary(release.summary, 120)}`;
}
function renderAnnouncementSummary(announcement) {
  return `- [${announcement.severity}] **${announcement.title}** (${announcement.audience})`;
}
function renderSessionSummary(session) {
  return `- **${session.agentId}** (${session.toolKind}) - ${session.status}${session.recovery?.reason ? `: ${session.recovery.reason}` : ""}`;
}
function renderContext(snapshot, limits, generatedAt) {
  const taskCounts = {
    pending: snapshot.tasks.filter((task) => task.status === "pending").length,
    in_progress: snapshot.tasks.filter((task) => task.status === "in_progress").length,
    done: snapshot.tasks.filter((task) => task.status === "done").length
  };
  const inProgressTasks = snapshot.tasks.filter((task) => task.status === "in_progress").sort((left, right) => compareDescByDate(left, right, (item) => item.updatedAt));
  const pendingTasks = snapshot.tasks.filter((task) => task.status === "pending").sort((left, right) => {
    const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    const createdDelta = left.createdAt.localeCompare(right.createdAt);
    return createdDelta !== 0 ? createdDelta : left.id.localeCompare(right.id);
  });
  const recentActivity = snapshot.logs.slice().sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));
  const openHandoffs = snapshot.handoffs.slice().sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));
  const unreadMessages = snapshot.messages.filter((message) => !message.acknowledged).sort((left, right) => {
    const severityDelta = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return compareDescByDate(left, right, (item) => item.timestamp);
  });
  const recentDecisions = snapshot.decisions.filter((decision) => !decision.status || decision.status === "accepted").sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));
  const publishedReleases = snapshot.releases.filter((release) => release.status === "published").sort((left, right) => compareDescByDate(left, right, (item) => item.publishedAt ?? item.updatedAt));
  const activeAnnouncements = snapshot.announcements.filter((announcement) => announcement.status === "published" || announcement.status === "pinned").sort((left, right) => compareDescByDate(left, right, (item) => item.publishedAt ?? item.updatedAt));
  const activeSessions = snapshot.sessions.slice().sort((left, right) => right.launchedAt.localeCompare(left.launchedAt));
  const conventions = snapshot.conventions.slice().sort((left, right) => {
    const addedDelta = left.addedAt.localeCompare(right.addedAt);
    return addedDelta !== 0 ? addedDelta : left.id.localeCompare(right.id);
  });
  const inProgressVisible = inProgressTasks.slice(0, limits.inProgressTasks);
  const pendingVisible = pendingTasks.slice(0, limits.pendingTasks);
  const activityVisible = recentActivity.slice(0, limits.recentActivity);
  const handoffVisible = openHandoffs.slice(0, limits.handoffs);
  const messageVisible = unreadMessages.slice(0, limits.unreadMessages);
  const decisionVisible = recentDecisions.slice(0, limits.recentDecisions);
  const releaseVisible = publishedReleases.slice(0, limits.publishedReleases);
  const announcementVisible = activeAnnouncements.slice(0, limits.announcements);
  const activeAgentsRows = snapshot.bridge.agents.length ? snapshot.bridge.agents.map((agent) => `| ${agent.name} | ${agent.kind} | ${agent.configPath} |`).join("\n") : "| _(none)_ | _(none)_ | _(none)_ |";
  const sections = [
    `# Project Context - ${snapshot.bridge.projectName}`,
    "",
    "> Auto-generated by AiBridge. Do not edit manually.",
    `> Last updated: ${generatedAt}`,
    "",
    "## Project",
    "",
    `- **Name**: ${snapshot.bridge.projectName}`,
    `- **Repo**: ${snapshot.repoPath}`,
    `- **Schema version**: ${snapshot.bridge.schemaVersion}`,
    `- **Last sync**: ${snapshot.lastSyncAt}`,
    ...snapshot.bridge.setup ? [
      "",
      "## Setup Brief",
      "",
      `- **Template**: ${snapshot.bridge.setup.templateId}`,
      `- **Goal**: ${snapshot.bridge.setup.summary}`,
      `- **Primary deliverable**: ${snapshot.bridge.setup.primaryDeliverable}`,
      `- **Preferred stack**: ${snapshot.bridge.setup.preferredStack.join(", ") || "(not specified)"}`,
      `- **Priorities**: ${snapshot.bridge.setup.priorities.join(", ") || "(not specified)"}`,
      `- **Agent mode**: ${snapshot.bridge.setup.agentMode}`,
      snapshot.bridge.setup.hardConstraints.length > 0 ? `- **Constraints**: ${snapshot.bridge.setup.hardConstraints.join("; ")}` : "- **Constraints**: _(none)_"
    ] : [],
    ...activeSessions.length > 0 ? [
      "",
      "## Agent Sessions",
      "",
      ...activeSessions.slice(0, 5).map(renderSessionSummary)
    ] : [],
    "",
    "## Active Agents",
    "",
    "| Agent | Kind | Config |",
    "|-------|------|--------|",
    activeAgentsRows,
    "",
    "## Task Summary",
    "",
    "| Status | Count |",
    "|--------|-------|",
    `| Pending | ${taskCounts.pending} |`,
    `| In Progress | ${taskCounts.in_progress} |`,
    `| Done | ${taskCounts.done} |`,
    "",
    "### In-Progress Tasks",
    "",
    renderLimitedList(
      inProgressVisible.map(
        (task) => `- **${task.title}** - assigned to ${formatTaskAssignment(task)} (priority: ${task.priority})`
      ),
      inProgressTasks.length > inProgressVisible.length ? `+${inProgressTasks.length - inProgressVisible.length} more in-progress tasks` : void 0
    ),
    "",
    "### Pending Tasks",
    "",
    renderLimitedList(
      pendingVisible.map(
        (task) => `- **${task.title}** - assigned to ${formatTaskAssignment(task)} (priority: ${task.priority})`
      ),
      pendingTasks.length > pendingVisible.length ? `+${pendingTasks.length - pendingVisible.length} more pending tasks` : void 0
    ),
    "",
    "## Recent Activity",
    "",
    renderLimitedList(
      activityVisible.map(
        (entry) => `- [${entry.timestamp}] **${entry.agentId}** ${entry.action}: ${entry.description}`
      ),
      recentActivity.length > activityVisible.length ? `+${recentActivity.length - activityVisible.length} more entries` : void 0
    ),
    "",
    "## Open Handoffs",
    "",
    renderLimitedList(
      handoffVisible.map(
        (handoff) => `- **${handoff.fromAgentId} -> ${handoff.toAgentId}**: ${handoff.description} (${handoff.timestamp})`
      ),
      openHandoffs.length > handoffVisible.length ? `+${openHandoffs.length - handoffVisible.length} more handoffs` : void 0
    ),
    "",
    "## Unread Messages",
    "",
    renderLimitedList(
      messageVisible.map(
        (message) => `- [${message.severity}] **${message.fromAgentId}** -> ${message.toAgentId ?? "all"}: ${message.content}`
      ),
      unreadMessages.length > messageVisible.length ? `+${unreadMessages.length - messageVisible.length} more unread messages` : void 0
    ),
    "",
    "## Recent Decisions",
    "",
    renderLimitedList(
      decisionVisible.map(
        (decision) => `- **${decision.title}**: ${truncateSummary(decision.summary, limits.decisionSummaryLimit)}`
      ),
      recentDecisions.length > decisionVisible.length ? `+${recentDecisions.length - decisionVisible.length} more decisions` : void 0
    ),
    "",
    "## Releases",
    "",
    renderLimitedList(
      releaseVisible.map(renderReleaseSummary),
      publishedReleases.length > releaseVisible.length ? `+${publishedReleases.length - releaseVisible.length} more published releases` : void 0
    ),
    "",
    "## Announcements",
    "",
    renderLimitedList(
      announcementVisible.map(renderAnnouncementSummary),
      activeAnnouncements.length > announcementVisible.length ? `+${activeAnnouncements.length - announcementVisible.length} more announcements` : void 0
    ),
    "",
    "## Active Conventions",
    "",
    conventions.length > 0 ? conventions.map((convention) => `- ${convention.rule}`).join("\n") : "_(none)_",
    ...snapshot.bridge.setup ? [
      "",
      "## Definition Of Done",
      "",
      renderLimitedList(snapshot.bridge.setup.definitionOfDone.map((item) => `- ${item}`)),
      "",
      "## Setup Workflow",
      "",
      snapshot.bridge.setup.workflowSummary
    ] : []
  ];
  if (limits.includeSuggestions) {
    sections.push("", "## Suggested Next Actions", "", renderSuggestedActions(snapshot));
  }
  return `${sections.join("\n").trim()}
`;
}
function compileContextMarkdown(snapshot, options = {}) {
  const budget = options.budget ?? 2e3;
  const generatedAt = options.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  const limits = {
    inProgressTasks: 10,
    pendingTasks: 10,
    recentActivity: 10,
    handoffs: 5,
    unreadMessages: 5,
    recentDecisions: 5,
    publishedReleases: 3,
    announcements: 5,
    includeSuggestions: true
  };
  let markdown = renderContext(snapshot, limits, generatedAt);
  if (estimateTokens(markdown) <= budget) {
    return markdown;
  }
  limits.recentActivity = 5;
  markdown = renderContext(snapshot, limits, generatedAt);
  if (estimateTokens(markdown) <= budget) {
    return markdown;
  }
  limits.pendingTasks = 5;
  markdown = renderContext(snapshot, limits, generatedAt);
  if (estimateTokens(markdown) <= budget) {
    return markdown;
  }
  limits.decisionSummaryLimit = 80;
  markdown = renderContext(snapshot, limits, generatedAt);
  if (estimateTokens(markdown) <= budget) {
    return markdown;
  }
  limits.includeSuggestions = false;
  return renderContext(snapshot, limits, generatedAt);
}
function parseContextTimestamp(markdown) {
  const match = markdown.match(/^> Last updated: (.+)$/m);
  return match?.[1]?.trim();
}

// aibridge/runtime/agent-sessions.ts
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
var ACTIVE_STALE_MS = 10 * 60 * 1e3;
var PENDING_STALE_MS = 5 * 60 * 1e3;
var RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url));
var CLI_ENTRY_PATH = path.resolve(RUNTIME_DIR, "../cli/bin/aibridge.ts");
function pickLatestTimestamp(...values) {
  return values.filter(Boolean).sort((left, right) => String(right).localeCompare(String(left)))[0];
}
function toMillis(timestamp) {
  return timestamp ? new Date(timestamp).getTime() : 0;
}
function listAssignedTasks(snapshot, agentId) {
  return snapshot.tasks.filter((task) => task.agentId === agentId && task.status !== "done").sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
function unreadMessagesForAgent(snapshot, agentId) {
  return snapshot.messages.filter((message) => !message.acknowledged && (!message.toAgentId || message.toAgentId === agentId)).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}
function openHandoffsForAgent(snapshot, agentId) {
  return snapshot.handoffs.filter((handoff) => handoff.toAgentId === agentId).sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}
function summarizeRole(agent, snapshot) {
  const role = snapshot.bridge.setup?.roles.find((item) => item.agentKind === agent.kind || item.key === agent.id);
  if (!role) {
    return `${agent.name} should inspect the repo, continue the highest-priority assigned task, and coordinate through AiBridge when blocked.`;
  }
  return `${role.name}: ${role.responsibilities.join("; ")}`;
}
function buildCliCommandHint() {
  if (existsSync(CLI_ENTRY_PATH)) {
    return `node ${CLI_ENTRY_PATH.replace(/\\/g, "/")} `;
  }
  return "aibridge ";
}
function buildLaunchInstructionSet(snapshot, agent, toolKind, sessionId, launchSource, generatedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const assignedTasks = listAssignedTasks(snapshot, agent.id).slice(0, 3);
  const unreadMessages = unreadMessagesForAgent(snapshot, agent.id).slice(0, 2);
  const handoffs = openHandoffsForAgent(snapshot, agent.id).slice(0, 2);
  const cliCommand = buildCliCommandHint();
  const firstSteps = [
    "Read .aibridge/CONTEXT.md before making changes.",
    "Inspect the repo and confirm the current working surface before coding.",
    `Acknowledge this session by running: ${cliCommand}agent start --session ${sessionId}`
  ];
  const checklist = [
    "Use the canonical AiBridge CLI path below, not manual JSON edits.",
    "Record meaningful work through tasks, messages, handoffs, decisions, or logs.",
    "If you are blocked or handing off, create a handoff or warning message in AiBridge.",
    "Regenerate context after meaningful state changes."
  ];
  const supportiveFile = toolKind === "cursor" ? ".cursorrules" : "AGENTS.md";
  const promptSections = [
    `You are operating as the ${agent.name} agent in the AiBridge workspace "${snapshot.bridge.projectName}".`,
    `Tool: ${toolKind}. Launch source: ${launchSource}.`,
    "",
    "Read these first:",
    "- .aibridge/CONTEXT.md",
    "- .aibridge/CONVENTIONS.md",
    `- ${supportiveFile} (supportive context only; AiBridge launch prompt is primary)`,
    `- ${agent.configPath}`,
    "",
    `Role focus: ${summarizeRole(agent, snapshot)}`,
    "",
    assignedTasks.length > 0 ? `Current assigned work:
${assignedTasks.map((task) => `- ${task.title} [${task.status}]`).join("\n")}` : "Current assigned work:\n- No assigned tasks. Continue the highest-priority visible task or ask for clarification.",
    "",
    unreadMessages.length > 0 ? `Unread messages:
${unreadMessages.map((message) => `- ${message.fromAgentId}: ${message.content}`).join("\n")}` : "Unread messages:\n- None.",
    "",
    handoffs.length > 0 ? `Open handoffs:
${handoffs.map((handoff) => `- ${handoff.fromAgentId}: ${handoff.description}`).join("\n")}` : "Open handoffs:\n- None.",
    "",
    "Required workflow:",
    ...firstSteps.map((step) => `- ${step}`),
    ...checklist.map((step) => `- ${step}`),
    "",
    `Canonical CLI path: ${cliCommand}<command>`
  ];
  return {
    sessionId,
    agentId: agent.id,
    toolKind,
    launchSource,
    generatedAt,
    prompt: promptSections.join("\n"),
    firstSteps,
    checklist,
    cliCommand
  };
}
function buildRecoveryPromptFromReason(snapshot, session, reason, lastActivityAt) {
  const recentLogs = snapshot.logs.filter((entry) => entry.agentId === session.agentId && (!lastActivityAt || entry.timestamp > lastActivityAt)).sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, 5);
  const assignedTasks = listAssignedTasks(snapshot, session.agentId).slice(0, 3);
  const unreadMessages = unreadMessagesForAgent(snapshot, session.agentId).slice(0, 3);
  const handoffs = openHandoffsForAgent(snapshot, session.agentId).slice(0, 2);
  const cliCommand = buildCliCommandHint();
  return [
    `Resume your AiBridge session for agent ${session.agentId}.`,
    `Reason: ${reason}`,
    "",
    "Before continuing:",
    "- Re-read .aibridge/CONTEXT.md and .aibridge/CONVENTIONS.md.",
    "- Compare your current understanding with the latest repo state.",
    `- Confirm recovery by running: ${cliCommand}agent heartbeat --session ${session.id}`,
    "",
    assignedTasks.length > 0 ? `Current assigned tasks:
${assignedTasks.map((task) => `- ${task.title} [${task.status}]`).join("\n")}` : "Current assigned tasks:\n- None.",
    "",
    unreadMessages.length > 0 ? `Unread messages:
${unreadMessages.map((message) => `- ${message.fromAgentId}: ${message.content}`).join("\n")}` : "Unread messages:\n- None.",
    "",
    handoffs.length > 0 ? `Open handoffs:
${handoffs.map((handoff) => `- ${handoff.fromAgentId}: ${handoff.description}`).join("\n")}` : "Open handoffs:\n- None.",
    "",
    recentLogs.length > 0 ? `Recent activity since your last healthy checkpoint:
${recentLogs.map((entry) => `- ${entry.timestamp}: ${entry.description}`).join("\n")}` : "Recent activity since your last healthy checkpoint:\n- No new logged activity."
  ].join("\n");
}
function deriveAgentSession(snapshot, session, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const latestLogActivity = snapshot.logs.filter((entry) => entry.agentId === session.agentId && entry.timestamp >= session.launchedAt).sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0]?.timestamp;
  const lastActivityAt = pickLatestTimestamp(session.lastActivityAt, session.lastHeartbeatAt, latestLogActivity);
  const currentTaskIds = listAssignedTasks(snapshot, session.agentId).map((task) => task.id);
  const nowMs = toMillis(now);
  const launchMs = toMillis(session.launchedAt);
  const activityMs = toMillis(lastActivityAt);
  const staleReferenceMs = activityMs || launchMs;
  let status = session.status;
  let reason;
  if (session.status === "active" && nowMs - staleReferenceMs > ACTIVE_STALE_MS) {
    status = "stale";
    reason = "Agent session has gone stale and needs a restart prompt.";
  } else if (session.status === "pending" && nowMs - launchMs > PENDING_STALE_MS) {
    reason = "Agent session never acknowledged the latest context.";
  } else if ((session.status === "stopped" || session.status === "failed") && currentTaskIds.length > 0) {
    reason = session.recovery?.reason ?? (session.status === "stopped" ? "Agent stopped while assigned work remains." : "Agent session failed while assigned work remains.");
  }
  if ((session.status === "active" || session.status === "pending") && session.acknowledgedContextTimestamp && snapshot.lastSyncAt > session.acknowledgedContextTimestamp) {
    status = status === "active" ? "stale" : status;
    reason = "Context changed after this agent acknowledged the workspace.";
  }
  const recoveryPrompt = reason ? buildRecoveryPromptFromReason(snapshot, { ...session, status }, reason, lastActivityAt) : session.recovery?.prompt;
  return {
    ...session,
    status,
    lastActivityAt,
    currentTaskIds,
    recovery: {
      recommended: Boolean(reason),
      reason,
      prompt: recoveryPrompt,
      generatedAt: recoveryPrompt ? now : session.recovery?.generatedAt
    }
  };
}
function sessionNotice(session) {
  if (!session.recovery?.recommended || !session.recovery.reason) {
    return null;
  }
  return `${session.agentId} (${session.toolKind}) \u2014 ${session.recovery.reason}`;
}

// aibridge/runtime/schema.ts
import { z } from "zod";
var agentKinds = [
  "cursor",
  "claude",
  "codex",
  "antigravity",
  "copilot",
  "windsurf",
  "custom"
];
var taskStatuses = ["pending", "in_progress", "done"];
var priorities = ["low", "medium", "high"];
var messageSeverities = ["info", "warning", "critical"];
var decisionStatuses = ["proposed", "accepted", "superseded"];
var releaseStatuses = ["draft", "published", "archived"];
var announcementStatuses = ["draft", "published", "pinned", "archived"];
var announcementAudiences = ["all", "admin", "internal"];
var announcementSeverities = ["info", "success", "warning", "critical"];
var conventionCategories = [
  "code-style",
  "architecture",
  "testing",
  "documentation",
  "workflow",
  "other"
];
var setupTemplateIds = [
  "web-app",
  "api-backend",
  "mobile-app",
  "landing-page",
  "ai-automation",
  "research-docs",
  "empty"
];
var setupPriorityValues = ["speed", "quality", "security", "cost"];
var setupAgentModes = ["single-agent", "multi-agent"];
var agentToolKinds = ["cursor", "codex"];
var agentSessionStatuses = ["pending", "active", "stale", "stopped", "failed"];
var agentLaunchSources = ["dashboard", "app", "cli"];
var agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(agentKinds),
  configPath: z.string().min(1),
  ownedPaths: z.array(z.string().min(1)).optional(),
  lastActiveAt: z.string().datetime().optional()
});
var bridgeSetupRoleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  agentKind: z.enum(agentKinds),
  responsibilities: z.array(z.string().min(1)).default([])
});
var bridgeSetupSchema = z.object({
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
  createdAt: z.string().datetime()
});
var bridgeSchema = z.object({
  schemaVersion: z.string().min(1),
  projectName: z.string().min(1),
  createdAt: z.string().datetime(),
  agents: z.array(agentSchema),
  setup: bridgeSetupSchema.optional()
});
var taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(taskStatuses),
  priority: z.enum(priorities),
  agentId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
var logEntrySchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  action: z.string().min(1),
  description: z.string().min(1),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional()
});
var handoffSchema = z.object({
  id: z.string().min(1),
  fromAgentId: z.string().min(1),
  toAgentId: z.string().min(1),
  description: z.string().min(1),
  timestamp: z.string().datetime(),
  relatedTaskIds: z.array(z.string().min(1)).optional()
});
var decisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.string().datetime(),
  status: z.enum(decisionStatuses).optional()
});
var conventionSchema = z.object({
  id: z.string().min(1),
  rule: z.string().min(1),
  addedAt: z.string().datetime(),
  addedBy: z.string().min(1).optional(),
  category: z.enum(conventionCategories).optional()
});
var messageSchema = z.object({
  id: z.string().min(1),
  fromAgentId: z.string().min(1),
  toAgentId: z.string().min(1).optional(),
  severity: z.enum(messageSeverities).default("info"),
  content: z.string().min(1),
  timestamp: z.string().datetime(),
  acknowledged: z.boolean().default(false)
});
var agentRecoveryStateSchema = z.object({
  recommended: z.boolean(),
  reason: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  generatedAt: z.string().datetime().optional()
});
var launchInstructionSetSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  toolKind: z.enum(agentToolKinds),
  launchSource: z.enum(agentLaunchSources),
  generatedAt: z.string().datetime(),
  prompt: z.string().min(1),
  firstSteps: z.array(z.string().min(1)).default([]),
  checklist: z.array(z.string().min(1)).default([]),
  cliCommand: z.string().min(1),
  recoveryPrompt: z.string().min(1).optional()
});
var agentSessionSchema = z.object({
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
  recovery: agentRecoveryStateSchema.optional()
});
var releaseSchema = z.object({
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
  updatedAt: z.string().datetime()
});
var announcementSchema = z.object({
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
  updatedAt: z.string().datetime()
});

// aibridge/services/capture/state.ts
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path2 from "path";
var CAPTURE_DIRNAME = "capture";
var CAPTURE_STATUS_FILE = "status.json";
var VALIDATION_WARNINGS_FILE = "validation-errors.jsonl";
function getCapturePaths(rootPath) {
  const captureDir = path2.join(rootPath, CAPTURE_DIRNAME);
  return {
    captureDir,
    statusFile: path2.join(captureDir, CAPTURE_STATUS_FILE),
    validationWarningsFile: path2.join(captureDir, VALIDATION_WARNINGS_FILE)
  };
}
function defaultCaptureStatus() {
  return {
    hooksInstalled: [],
    watcher: {
      running: false,
      debounceMs: 1500
    },
    validationWarnings: 0
  };
}
async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}
function isWatcherProcessAlive(pid) {
  if (!pid || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error2) {
    const code = error2.code;
    return code === "EPERM";
  }
}
async function writeJsonAtomic(targetPath, value) {
  await ensureDir(path2.dirname(targetPath));
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
    await fs.rename(tempPath, targetPath);
  } catch (error2) {
    await fs.rm(tempPath, { force: true }).catch(() => void 0);
    throw error2;
  }
}
function mergeCaptureStatus(base, partial) {
  return {
    ...base,
    ...partial,
    hooksInstalled: partial.hooksInstalled ?? base.hooksInstalled,
    watcher: {
      ...base.watcher,
      ...partial.watcher ?? {}
    }
  };
}
function normalizeCaptureStatus(status) {
  if (!status.watcher.running || !status.watcher.lastHeartbeatAt) {
    if (status.watcher.running && status.watcher.pid && !isWatcherProcessAlive(status.watcher.pid)) {
      return {
        ...status,
        watcher: {
          ...status.watcher,
          running: false,
          pid: void 0,
          lastError: status.watcher.lastError ?? "Watcher process is not running."
        }
      };
    }
    return status;
  }
  const heartbeatAge = Date.now() - new Date(status.watcher.lastHeartbeatAt).getTime();
  const staleAfterMs = Math.max(5e3, (status.watcher.debounceMs || 1500) * 4);
  if (Number.isNaN(heartbeatAge) || heartbeatAge <= staleAfterMs) {
    if (status.watcher.pid && !isWatcherProcessAlive(status.watcher.pid)) {
      return {
        ...status,
        watcher: {
          ...status.watcher,
          running: false,
          pid: void 0,
          lastError: status.watcher.lastError ?? "Watcher process is not running."
        }
      };
    }
    return status;
  }
  return {
    ...status,
    watcher: {
      ...status.watcher,
      running: false,
      pid: void 0,
      lastError: status.watcher.lastError ?? "Watcher heartbeat is stale."
    }
  };
}
async function readCaptureStatus(rootPath) {
  const defaults = defaultCaptureStatus();
  const { statusFile } = getCapturePaths(rootPath);
  if (!await fileExists(statusFile)) {
    return defaults;
  }
  try {
    const raw = await fs.readFile(statusFile, "utf8");
    return normalizeCaptureStatus(mergeCaptureStatus(defaults, JSON.parse(raw)));
  } catch {
    return defaults;
  }
}
async function writeCaptureStatus(rootPath, next) {
  const { statusFile } = getCapturePaths(rootPath);
  await writeJsonAtomic(statusFile, next);
  return next;
}
async function updateCaptureStatus(rootPath, update) {
  const current = await readCaptureStatus(rootPath);
  const next = typeof update === "function" ? update(current) : mergeCaptureStatus(current, update);
  return writeCaptureStatus(rootPath, next);
}
async function appendCaptureValidationWarning(rootPath, warning2) {
  const { captureDir, validationWarningsFile } = getCapturePaths(rootPath);
  await ensureDir(captureDir);
  await fs.appendFile(validationWarningsFile, `${JSON.stringify(warning2)}
`, "utf8");
}
async function markWatcherStopped(rootPath, reason) {
  return updateCaptureStatus(rootPath, (current) => ({
    ...current,
    watcher: {
      ...current.watcher,
      running: false,
      pid: void 0,
      lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastError: reason === null ? void 0 : reason ?? current.watcher.lastError
    }
  }));
}

// aibridge/runtime/store.ts
var DEFAULT_BRIDGE_DIRNAME = ".aibridge";
var BRIDGE_WRITE_LOCK = ".aibridge.write.lock";
var LOCK_POLL_INTERVAL_MS = 50;
var LOCK_STALE_MS = 3e4;
var LOCK_TIMEOUT_MS = 1e4;
var RUNTIME_DIR2 = path3.dirname(fileURLToPath2(import.meta.url));
function resolveFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (existsSync2(candidate)) return candidate;
  }
  return candidates[0];
}
var PROTOCOL_TEMPLATES_ROOT = resolveFirstExistingPath([
  path3.resolve(RUNTIME_DIR2, "../protocol/templates"),
  path3.resolve(RUNTIME_DIR2, "aibridge/protocol/templates")
]);
var SAMPLE_BRIDGE_ROOT = resolveFirstExistingPath([
  path3.resolve(RUNTIME_DIR2, "../../public/examples/aibridge/local-bridge"),
  path3.resolve(RUNTIME_DIR2, "public/examples/aibridge/local-bridge")
]);
var AGENT_LABELS = {
  cursor: "Cursor",
  claude: "Claude Code",
  codex: "Codex",
  antigravity: "Antigravity",
  copilot: "Copilot",
  windsurf: "Windsurf",
  custom: "Custom Agent"
};
var BridgeRuntimeError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "BridgeRuntimeError";
  }
};
function getBridgePaths(root) {
  return {
    root,
    bridgeFile: path3.join(root, "bridge.json"),
    contextFile: path3.join(root, "CONTEXT.md"),
    conventionsFile: path3.join(root, "CONVENTIONS.md"),
    captureDir: path3.join(root, "capture"),
    agentsDir: path3.join(root, "agents"),
    tasksDir: path3.join(root, "tasks"),
    logsDir: path3.join(root, "logs"),
    handoffsDir: path3.join(root, "handoffs"),
    decisionsDir: path3.join(root, "decisions"),
    conventionsDir: path3.join(root, "conventions"),
    messagesDir: path3.join(root, "messages"),
    releasesDir: path3.join(root, "releases"),
    announcementsDir: path3.join(root, "announcements"),
    sessionsDir: path3.join(root, "sessions")
  };
}
async function fileExists2(targetPath) {
  try {
    await fs2.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
async function ensureDir2(targetPath) {
  await fs2.mkdir(targetPath, { recursive: true });
}
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
function buildAgent(kind) {
  return {
    id: kind,
    name: AGENT_LABELS[kind],
    kind,
    configPath: `${DEFAULT_BRIDGE_DIRNAME}/agents/${kind}.md`
  };
}
async function normalizeBridgeRoot(targetPath) {
  const explicitBridge = path3.resolve(targetPath);
  if (await fileExists2(path3.join(explicitBridge, "bridge.json"))) {
    return explicitBridge;
  }
  const nestedBridge = path3.join(explicitBridge, DEFAULT_BRIDGE_DIRNAME);
  if (await fileExists2(path3.join(nestedBridge, "bridge.json"))) {
    return nestedBridge;
  }
  return explicitBridge;
}
async function acquireBridgeWriteLock(rootPath) {
  await ensureDir2(rootPath);
  const lockPath = path3.join(rootPath, BRIDGE_WRITE_LOCK);
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await fs2.open(lockPath, "wx");
      await handle.writeFile(
        `${JSON.stringify({
          pid: process.pid,
          acquiredAt: (/* @__PURE__ */ new Date()).toISOString()
        })}
`,
        "utf8"
      );
      return async () => {
        await handle.close().catch(() => void 0);
        await fs2.rm(lockPath, { force: true }).catch(() => void 0);
      };
    } catch (error2) {
      const lockError = error2;
      if (lockError.code !== "EEXIST") {
        throw lockError;
      }
      try {
        const metadata = await fs2.stat(lockPath);
        if (Date.now() - metadata.mtimeMs > LOCK_STALE_MS) {
          await fs2.rm(lockPath, { force: true }).catch(() => void 0);
          continue;
        }
      } catch (statError) {
        if (statError.code === "ENOENT") {
          continue;
        }
        throw statError;
      }
      if (Date.now() - startedAt > LOCK_TIMEOUT_MS) {
        throw new BridgeRuntimeError("BAD_REQUEST", `Timed out waiting for bridge write lock at ${rootPath}.`, {
          rootPath,
          lockPath
        });
      }
      await sleep(LOCK_POLL_INTERVAL_MS);
    }
  }
}
async function withBridgeWriteLock(rootPath, operation) {
  const root = await normalizeBridgeRoot(rootPath);
  const release = await acquireBridgeWriteLock(root);
  try {
    return await operation(root);
  } finally {
    await release();
  }
}
async function resolveBridgeRoot(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  if (options.source === "sample") {
    return SAMPLE_BRIDGE_ROOT;
  }
  if (options.source === "custom") {
    if (!options.customRoot?.trim()) {
      throw new BridgeRuntimeError("BAD_REQUEST", "A custom bridge path is required for custom local mode.");
    }
    return normalizeBridgeRoot(path3.resolve(cwd, options.customRoot));
  }
  return normalizeBridgeRoot(path3.resolve(cwd, DEFAULT_BRIDGE_DIRNAME));
}
async function readTextIfExists(targetPath) {
  if (!await fileExists2(targetPath)) {
    return "";
  }
  return fs2.readFile(targetPath, "utf8");
}
async function readJsonFile(targetPath, parse, issues) {
  try {
    const raw = await fs2.readFile(targetPath, "utf8");
    const parsed = JSON.parse(raw);
    const result = parse(parsed);
    if (!result.success) {
      issues.push(
        `Invalid ${path3.basename(targetPath)}: ${result.error.issues.map((issue) => issue.message).join(", ")}`
      );
      return null;
    }
    return result.data;
  } catch (error2) {
    issues.push(`Unable to read ${path3.basename(targetPath)}: ${error2.message}`);
    return null;
  }
}
async function readJsonCollection(dirPath, parse, issues) {
  if (!await fileExists2(dirPath)) {
    return [];
  }
  const entries = (await fs2.readdir(dirPath)).filter((name) => name.endsWith(".json")).sort((left, right) => left.localeCompare(right));
  const data = [];
  for (const entry of entries) {
    const item = await readJsonFile(path3.join(dirPath, entry), parse, issues);
    if (item) {
      data.push(item);
    }
  }
  return data;
}
function parseConventionMetadata(rawMetadata) {
  const metadata = {};
  if (!rawMetadata) {
    return metadata;
  }
  for (const match of rawMetadata.matchAll(/([a-zA-Z]+)=([^\s]+)/g)) {
    metadata[match[1]] = match[2];
  }
  return metadata;
}
function parseConventionLine(rawLine, index, defaultAddedAt) {
  const match = rawLine.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
  if (!match) {
    return null;
  }
  const content = match[1];
  const metadataMatch = content.match(/^(.*?)(?:\s*<!--\s*aibridge:(.*?)\s*-->)?\s*$/);
  const rule = metadataMatch?.[1]?.trim() ?? "";
  if (!rule) {
    return null;
  }
  const metadata = parseConventionMetadata(metadataMatch?.[2]);
  const convention = {
    id: metadata.id ?? `conv-${index + 1}`,
    rule,
    addedAt: metadata.addedAt ?? defaultAddedAt,
    addedBy: metadata.addedBy,
    category: metadata.category
  };
  const result = conventionSchema.safeParse(convention);
  return result.success ? result.data : null;
}
async function parseConventions(conventionsFile, defaultAddedAt, issues) {
  if (!await fileExists2(conventionsFile)) {
    return [];
  }
  const markdown = await fs2.readFile(conventionsFile, "utf8");
  const conventions = markdown.split(/\r?\n/).map((line, index) => parseConventionLine(line, index, defaultAddedAt)).filter(Boolean);
  return conventions;
}
function conventionsToMarkdownDocument(conventions) {
  const body = conventions.slice().sort((left, right) => {
    const addedDelta = left.addedAt.localeCompare(right.addedAt);
    return addedDelta !== 0 ? addedDelta : left.id.localeCompare(right.id);
  }).map((convention, index) => {
    const metadata = [
      `id=${convention.id}`,
      `addedAt=${convention.addedAt}`,
      convention.addedBy ? `addedBy=${convention.addedBy}` : "",
      convention.category ? `category=${convention.category}` : ""
    ].filter(Boolean).join(" ");
    return `${index + 1}. ${convention.rule}${metadata ? ` <!-- aibridge:${metadata} -->` : ""}`;
  }).join("\n");
  return `# Project Conventions

> Shared rules all agents must follow. Managed via \`aibridge convention add\`.

${body || "_(none)_"}
`;
}
async function parseLogFiles(logsDir, issues) {
  if (!await fileExists2(logsDir)) {
    return [];
  }
  const entries = (await fs2.readdir(logsDir)).filter((name) => name.endsWith(".jsonl")).sort((left, right) => left.localeCompare(right));
  const logs = [];
  for (const entry of entries) {
    const fullPath = path3.join(logsDir, entry);
    const raw = await fs2.readFile(fullPath, "utf8");
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const [lineIndex, line] of lines.entries()) {
      try {
        const parsed = JSON.parse(line);
        const result = logEntrySchema.safeParse(parsed);
        if (result.success) {
          logs.push(result.data);
        } else {
          issues.push(
            `Invalid ${entry}:${lineIndex + 1}: ${result.error.issues.map((issue) => issue.message).join(", ")}`
          );
        }
      } catch (error2) {
        issues.push(`Unable to parse ${entry}:${lineIndex + 1}: ${error2.message}`);
      }
    }
  }
  return logs;
}
async function readBridgeConfig(paths, issues) {
  const config = await readJsonFile(paths.bridgeFile, bridgeSchema.safeParse.bind(bridgeSchema), issues);
  if (!config) {
    throw new BridgeRuntimeError(
      "NOT_INITIALIZED",
      `No valid bridge configuration found at ${paths.bridgeFile}.`,
      { rootPath: paths.root }
    );
  }
  return config;
}
function getRepoPath(root) {
  return path3.basename(root) === DEFAULT_BRIDGE_DIRNAME ? path3.dirname(root) : root;
}
function normalizeList(values) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}
function normalizeBridgeSetup(setup) {
  if (!setup) {
    return void 0;
  }
  return bridgeSetupSchema.parse({
    ...setup,
    summary: setup.summary.trim(),
    primaryDeliverable: setup.primaryDeliverable.trim(),
    preferredStack: normalizeList(setup.preferredStack),
    hardConstraints: normalizeList(setup.hardConstraints),
    definitionOfDone: normalizeList(setup.definitionOfDone),
    workflowSummary: setup.workflowSummary.trim(),
    roles: setup.roles.map((role) => ({
      ...role,
      key: role.key.trim(),
      name: role.name.trim(),
      responsibilities: normalizeList(role.responsibilities)
    })),
    customInstructions: setup.customInstructions?.trim() || void 0
  });
}
function resolveBridgeAccess(access = {}) {
  const expectedToken = access.expectedAdminToken?.trim();
  const requestedRole = access.role ?? "admin";
  const canMutate = requestedRole === "admin" && (!expectedToken || access.adminToken?.trim() === expectedToken);
  return {
    role: canMutate ? "admin" : "viewer",
    canMutate,
    adminConfigured: Boolean(expectedToken),
    authMode: "local-header"
  };
}
function filterVisibleReleases(releases, access) {
  const visible = access.canMutate ? releases : releases.filter((release) => release.status === "published");
  return visible.slice().sort((left, right) => {
    const publishedDelta = (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt);
    return publishedDelta !== 0 ? publishedDelta : left.id.localeCompare(right.id);
  });
}
function filterVisibleAnnouncements(announcements, access) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const visible = announcements.filter((announcement) => {
    if (announcement.expiresAt && announcement.expiresAt < now) {
      return false;
    }
    if (access.canMutate) {
      return true;
    }
    return announcement.status === "published" || announcement.status === "pinned";
  });
  return visible.slice().sort((left, right) => {
    if (left.status === "pinned" && right.status !== "pinned") {
      return -1;
    }
    if (left.status !== "pinned" && right.status === "pinned") {
      return 1;
    }
    const publishedDelta = (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt);
    return publishedDelta !== 0 ? publishedDelta : left.id.localeCompare(right.id);
  });
}
function normalizeStatus(snapshot, accessOptions = {}) {
  const access = resolveBridgeAccess(accessOptions);
  const sessions = snapshot.sessions.map((session) => deriveAgentSession(snapshot, session)).sort((left, right) => right.launchedAt.localeCompare(left.launchedAt));
  const activeAgents = snapshot.bridge.agents.map((agent) => {
    const lastActive = snapshot.logs.filter((entry) => entry.agentId === agent.id).sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
    const activeSession = sessions.filter((session) => session.agentId === agent.id).sort((left, right) => right.lastActivityAt?.localeCompare(left.lastActivityAt ?? "") || right.launchedAt.localeCompare(left.launchedAt))[0];
    return {
      ...agent,
      lastActiveAt: agent.lastActiveAt ?? activeSession?.lastActivityAt ?? lastActive?.timestamp
    };
  });
  const issues = [...snapshot.issues];
  for (const session of sessions) {
    const notice = sessionNotice(session);
    if (notice) {
      issues.push(notice);
    }
  }
  return {
    context: {
      projectName: snapshot.bridge.projectName,
      repoPath: snapshot.repoPath,
      lastSyncAt: snapshot.lastSyncAt,
      schemaVersion: snapshot.bridge.schemaVersion,
      activeAgents,
      taskCounts: {
        pending: snapshot.tasks.filter((task) => task.status === "pending").length,
        in_progress: snapshot.tasks.filter((task) => task.status === "in_progress").length,
        done: snapshot.tasks.filter((task) => task.status === "done").length
      },
      sourceRoot: snapshot.repoPath,
      sourceLabel: path3.basename(snapshot.repoPath) || snapshot.repoPath,
      setup: snapshot.bridge.setup
    },
    tasks: snapshot.tasks.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    logs: snapshot.logs.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    handoffs: snapshot.handoffs.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    decisions: snapshot.decisions.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    conventions: snapshot.conventions.slice().sort((left, right) => left.addedAt.localeCompare(right.addedAt)),
    messages: snapshot.messages.slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    releases: filterVisibleReleases(snapshot.releases, access),
    announcements: filterVisibleAnnouncements(snapshot.announcements, access),
    sessions,
    capture: {
      hooksInstalled: [],
      watcher: {
        running: false,
        debounceMs: 1500
      },
      validationWarnings: 0
    },
    access,
    contextMarkdown: snapshot.contextMarkdown,
    issues
  };
}
async function loadBridgeSnapshot(rootPath) {
  const root = await normalizeBridgeRoot(rootPath);
  const paths = getBridgePaths(root);
  const issues = [];
  const bridge = await readBridgeConfig(paths, issues);
  const [tasks, logs, handoffs, decisions, conventionFiles, messages, releases, announcements, sessions, conventionsMarkdown, contextMarkdown] = await Promise.all([
    readJsonCollection(paths.tasksDir, taskSchema.safeParse.bind(taskSchema), issues),
    parseLogFiles(paths.logsDir, issues),
    readJsonCollection(paths.handoffsDir, handoffSchema.safeParse.bind(handoffSchema), issues),
    readJsonCollection(paths.decisionsDir, decisionSchema.safeParse.bind(decisionSchema), issues),
    readJsonCollection(paths.conventionsDir, conventionSchema.safeParse.bind(conventionSchema), issues),
    readJsonCollection(paths.messagesDir, messageSchema.safeParse.bind(messageSchema), issues),
    readJsonCollection(paths.releasesDir, releaseSchema.safeParse.bind(releaseSchema), issues),
    readJsonCollection(paths.announcementsDir, announcementSchema.safeParse.bind(announcementSchema), issues),
    readJsonCollection(paths.sessionsDir, agentSessionSchema.safeParse.bind(agentSessionSchema), issues),
    readTextIfExists(paths.conventionsFile),
    readTextIfExists(paths.contextFile)
  ]);
  const conventions = conventionFiles.length > 0 ? conventionFiles : await parseConventions(paths.conventionsFile, bridge.createdAt, issues);
  const lastSyncAt = parseContextTimestamp(contextMarkdown) ?? bridge.createdAt;
  return {
    bridge,
    contextMarkdown,
    conventionsMarkdown,
    tasks,
    logs,
    handoffs,
    decisions,
    conventions,
    messages,
    releases,
    announcements,
    sessions,
    repoPath: getRepoPath(root),
    lastSyncAt,
    issues
  };
}
async function loadBridgeStatus(rootPath, accessOptions = {}) {
  const root = await normalizeBridgeRoot(rootPath);
  const status = normalizeStatus(await loadBridgeSnapshot(root), accessOptions);
  status.capture = await readCaptureStatus(root);
  return status;
}
function assertAgentExists(bridge, agentId) {
  if (!agentId) {
    return;
  }
  if (!bridge.agents.some((agent) => agent.id === agentId)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unknown agent: ${agentId}`);
  }
}
async function writeJsonAtomic2(targetPath, value) {
  await ensureDir2(path3.dirname(targetPath));
  const tempPath = `${targetPath}.${process.pid}.${randomUUID2()}.tmp`;
  try {
    await fs2.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
    await fs2.rename(tempPath, targetPath);
  } catch (error2) {
    await fs2.rm(tempPath, { force: true }).catch(() => void 0);
    throw error2;
  }
}
async function writeTextAtomic(targetPath, value) {
  await ensureDir2(path3.dirname(targetPath));
  const tempPath = `${targetPath}.${process.pid}.${randomUUID2()}.tmp`;
  try {
    await fs2.writeFile(tempPath, value, "utf8");
    await fs2.rename(tempPath, targetPath);
  } catch (error2) {
    await fs2.rm(tempPath, { force: true }).catch(() => void 0);
    throw error2;
  }
}
async function appendLog(rootPath, log) {
  const paths = getBridgePaths(rootPath);
  await ensureDir2(paths.logsDir);
  const filename = `${log.timestamp.slice(0, 10)}.jsonl`;
  await fs2.appendFile(path3.join(paths.logsDir, filename), `${JSON.stringify(log)}
`, "utf8");
}
async function createMutationLog(rootPath, agentId, action, description, metadata) {
  const log = logEntrySchema.parse({
    id: `log-${randomUUID2()}`,
    agentId,
    action,
    description,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    metadata
  });
  await appendLog(rootPath, log);
}
async function addStructuredLog(rootPath, payload, options = {}) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    const resolvedAgentId = payload.agentId === "unknown" || payload.agentId === "human" ? payload.agentId : snapshot.bridge.agents.some((agent) => agent.id === payload.agentId) ? payload.agentId : options.allowUnknownAgent ? "unknown" : void 0;
    if (!resolvedAgentId) {
      assertAgentExists(snapshot.bridge, payload.agentId);
    }
    const log = logEntrySchema.parse({
      id: `log-${randomUUID2()}`,
      agentId: resolvedAgentId ?? payload.agentId,
      action: payload.action.trim(),
      description: payload.description.trim(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: payload.metadata
    });
    await appendLog(lockedRoot, log);
    await regenerateContextUnlocked(lockedRoot);
    return log;
  });
}
async function regenerateContextUnlocked(rootPath, budget) {
  const paths = getBridgePaths(rootPath);
  const snapshot = await loadBridgeSnapshot(rootPath);
  const markdown = compileContextMarkdown(snapshot, { budget, generatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  await writeTextAtomic(paths.contextFile, markdown);
  return markdown;
}
async function regenerateContext(rootPath, budget) {
  return withBridgeWriteLock(rootPath, async (root) => regenerateContextUnlocked(root, budget));
}
async function ensureBridge(rootPath) {
  const root = await normalizeBridgeRoot(rootPath);
  const bridgeFile = path3.join(root, "bridge.json");
  if (!await fileExists2(bridgeFile)) {
    throw new BridgeRuntimeError("NOT_INITIALIZED", `No .aibridge directory found at ${root}.`, { rootPath: root });
  }
  return root;
}
async function resolveJsonFileById(dirPath, idOrPrefix) {
  const entries = (await fs2.readdir(dirPath)).filter((name) => name.endsWith(".json")).sort((left, right) => left.localeCompare(right));
  const exact = entries.find((entry) => entry === `${idOrPrefix}.json`);
  if (exact) {
    return path3.join(dirPath, exact);
  }
  const matches = entries.filter((entry) => entry.startsWith(idOrPrefix));
  if (matches.length === 1) {
    return path3.join(dirPath, matches[0]);
  }
  if (matches.length > 1) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `ID prefix "${idOrPrefix}" is ambiguous.`);
  }
  throw new BridgeRuntimeError("NOT_FOUND", `No file found for "${idOrPrefix}".`);
}
async function readTask(rootPath, idOrPrefix, issues = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).tasksDir, idOrPrefix);
  const task = await readJsonFile(filePath, taskSchema.safeParse.bind(taskSchema), issues);
  if (!task) {
    throw new BridgeRuntimeError("INVALID_STATE", `Task ${idOrPrefix} is invalid.`);
  }
  return { filePath, task, root };
}
async function readMessage(rootPath, idOrPrefix, issues = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).messagesDir, idOrPrefix);
  const message = await readJsonFile(filePath, messageSchema.safeParse.bind(messageSchema), issues);
  if (!message) {
    throw new BridgeRuntimeError("INVALID_STATE", `Message ${idOrPrefix} is invalid.`);
  }
  return { filePath, message, root };
}
async function readDecision(rootPath, idOrPrefix, issues = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).decisionsDir, idOrPrefix);
  const decision = await readJsonFile(filePath, decisionSchema.safeParse.bind(decisionSchema), issues);
  if (!decision) {
    throw new BridgeRuntimeError("INVALID_STATE", `Decision ${idOrPrefix} is invalid.`);
  }
  return { filePath, decision, root };
}
async function readRelease(rootPath, idOrPrefix, issues = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).releasesDir, idOrPrefix);
  const release = await readJsonFile(filePath, releaseSchema.safeParse.bind(releaseSchema), issues);
  if (!release) {
    throw new BridgeRuntimeError("INVALID_STATE", `Release ${idOrPrefix} is invalid.`);
  }
  return { filePath, release, root };
}
async function readAnnouncement(rootPath, idOrPrefix, issues = []) {
  const root = await ensureBridge(rootPath);
  const filePath = await resolveJsonFileById(getBridgePaths(root).announcementsDir, idOrPrefix);
  const announcement = await readJsonFile(filePath, announcementSchema.safeParse.bind(announcementSchema), issues);
  if (!announcement) {
    throw new BridgeRuntimeError("INVALID_STATE", `Announcement ${idOrPrefix} is invalid.`);
  }
  return { filePath, announcement, root };
}
async function listTasks(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.tasks.filter((task) => {
    if (filters.status && task.status !== filters.status) {
      return false;
    }
    if (filters.agentId && task.agentId !== filters.agentId) {
      return false;
    }
    return true;
  });
}
async function addTask(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.agentId);
    const task = taskSchema.parse({
      id: `task-${randomUUID2()}`,
      title: payload.title?.trim(),
      status: payload.status ?? "pending",
      priority: payload.priority ?? "medium",
      agentId: payload.agentId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await writeJsonAtomic2(path3.join(paths.tasksDir, `${task.id}.json`), task);
    if (task.agentId) {
      await createMutationLog(lockedRoot, task.agentId, "create", `Created task: ${task.title}`, { taskId: task.id });
    }
    await regenerateContextUnlocked(lockedRoot);
    return task;
  });
}
async function updateTask(rootPath, idOrPrefix, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues = [];
    const { filePath, task } = await readTask(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    if (payload.agentId !== void 0) {
      assertAgentExists(snapshot.bridge, payload.agentId);
    }
    const updated = taskSchema.parse({
      ...task,
      title: payload.title?.trim() || task.title,
      priority: payload.priority ?? task.priority,
      agentId: payload.agentId ?? task.agentId,
      status: payload.status ?? task.status,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await writeJsonAtomic2(filePath, updated);
    if (updated.agentId) {
      const action = payload.status === "done" ? "done" : payload.status === "in_progress" ? "start" : "update";
      await createMutationLog(lockedRoot, updated.agentId, action, `Updated task: ${updated.title}`, {
        taskId: updated.id,
        status: updated.status
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}
async function listMessages(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const filtered = snapshot.messages.filter((message) => {
    if (filters.toAgentId && message.toAgentId !== filters.toAgentId) {
      return false;
    }
    if (filters.severity && message.severity !== filters.severity) {
      return false;
    }
    if (filters.unreadOnly && message.acknowledged) {
      return false;
    }
    return true;
  });
  return typeof filters.limit === "number" ? filtered.slice(0, filters.limit) : filtered;
}
async function addMessage(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.fromAgentId);
    assertAgentExists(snapshot.bridge, payload.toAgentId);
    const message = messageSchema.parse({
      id: `message-${randomUUID2()}`,
      fromAgentId: payload.fromAgentId,
      toAgentId: payload.toAgentId,
      severity: payload.severity ?? "info",
      content: payload.content.trim(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      acknowledged: false
    });
    await writeJsonAtomic2(path3.join(paths.messagesDir, `${message.id}.json`), message);
    await createMutationLog(lockedRoot, message.fromAgentId, "message", `Sent message: ${message.content}`, {
      messageId: message.id,
      toAgentId: message.toAgentId ?? "all"
    });
    await regenerateContextUnlocked(lockedRoot);
    return message;
  });
}
async function acknowledgeMessage(rootPath, idOrPrefix) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues = [];
    const { filePath, message } = await readMessage(lockedRoot, idOrPrefix, issues);
    const updated = messageSchema.parse({
      ...message,
      acknowledged: true
    });
    await writeJsonAtomic2(filePath, updated);
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}
async function listHandoffs(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.handoffs.filter((handoff) => {
    if (!filters.agentId) {
      return true;
    }
    return handoff.fromAgentId === filters.agentId || handoff.toAgentId === filters.agentId;
  });
}
async function createHandoff(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.fromAgentId);
    assertAgentExists(snapshot.bridge, payload.toAgentId);
    if (payload.relatedTaskIds?.length) {
      for (const taskId of payload.relatedTaskIds) {
        const exists = snapshot.tasks.some((task) => task.id === taskId || task.id.startsWith(taskId));
        if (!exists) {
          throw new BridgeRuntimeError("VALIDATION_ERROR", `Unknown related task: ${taskId}`);
        }
      }
    }
    const handoff = handoffSchema.parse({
      id: `handoff-${randomUUID2()}`,
      fromAgentId: payload.fromAgentId,
      toAgentId: payload.toAgentId,
      description: payload.description.trim(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      relatedTaskIds: payload.relatedTaskIds?.length ? payload.relatedTaskIds : void 0
    });
    await writeJsonAtomic2(path3.join(paths.handoffsDir, `${handoff.id}.json`), handoff);
    await createMutationLog(lockedRoot, handoff.fromAgentId, "handoff", `Created handoff to ${handoff.toAgentId}`, {
      handoffId: handoff.id
    });
    await regenerateContextUnlocked(lockedRoot);
    return handoff;
  });
}
async function getStatusSummary(rootPath, accessOptions = {}) {
  const root = await ensureBridge(rootPath);
  return loadBridgeStatus(root, accessOptions);
}
function parseAgentSessionStatus(value) {
  if (!value) {
    return void 0;
  }
  if (!agentSessionStatuses.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent session status: ${value}`);
  }
  return value;
}
function parseAgentToolKind(value) {
  if (!value) {
    return void 0;
  }
  if (!agentToolKinds.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent tool: ${value}`);
  }
  return value;
}
function parseAgentLaunchSource(value) {
  if (!value) {
    return void 0;
  }
  if (!agentLaunchSources.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent launch source: ${value}`);
  }
  return value;
}
async function readAgentSession(rootPath, idOrPrefix) {
  const root = await ensureBridge(rootPath);
  const paths = getBridgePaths(root);
  const target = await resolveJsonFileById(paths.sessionsDir, idOrPrefix);
  return readJsonFile(target, agentSessionSchema.safeParse.bind(agentSessionSchema), []);
}
async function writeAgentSession(rootPath, session) {
  const paths = getBridgePaths(rootPath);
  await writeJsonAtomic2(path3.join(paths.sessionsDir, `${session.id}.json`), session);
}
async function listAgentSessions(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.sessions.map((session) => deriveAgentSession(snapshot, session)).filter((session) => {
    if (filters.agentId && session.agentId !== filters.agentId) {
      return false;
    }
    if (filters.toolKind && session.toolKind !== filters.toolKind) {
      return false;
    }
    if (filters.status && session.status !== filters.status) {
      return false;
    }
    return true;
  }).sort((left, right) => right.launchedAt.localeCompare(left.launchedAt));
}
async function launchAgentSession(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.agentId);
    const agent = snapshot.bridge.agents.find((item) => item.id === payload.agentId);
    if (!agent) {
      throw new BridgeRuntimeError("NOT_FOUND", `Agent ${payload.agentId} is not configured for this bridge.`);
    }
    const launchedAt = (/* @__PURE__ */ new Date()).toISOString();
    const sessionId = `session-${randomUUID2()}`;
    const instructions = buildLaunchInstructionSet(
      snapshot,
      agent,
      parseAgentToolKind(payload.toolKind) ?? payload.toolKind,
      sessionId,
      parseAgentLaunchSource(payload.launchSource) ?? payload.launchSource ?? "cli",
      launchedAt
    );
    const session = agentSessionSchema.parse({
      id: sessionId,
      agentId: agent.id,
      toolKind: instructions.toolKind,
      repoPath: snapshot.repoPath,
      bridgeRoot: lockedRoot,
      launchedAt,
      acknowledgedContextTimestamp: void 0,
      lastHeartbeatAt: void 0,
      lastActivityAt: void 0,
      launchSource: instructions.launchSource,
      status: "pending",
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === agent.id && task.status !== "done").map((task) => task.id),
      instructions,
      recovery: {
        recommended: false
      }
    });
    await writeAgentSession(lockedRoot, session);
    await createMutationLog(lockedRoot, agent.id, "launch", `Created ${session.toolKind} launch prompt`, {
      sessionId: session.id,
      toolKind: session.toolKind,
      launchSource: session.launchSource
    });
    await regenerateContextUnlocked(lockedRoot);
    const updated = await readAgentSession(lockedRoot, session.id);
    if (!updated) {
      throw new BridgeRuntimeError("INVALID_STATE", `Agent session ${session.id} could not be read after creation.`);
    }
    return deriveAgentSession(await loadBridgeSnapshot(lockedRoot), updated);
  });
}
async function updateAgentSessionState(rootPath, idOrPrefix, mutate) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    const session = await readAgentSession(lockedRoot, idOrPrefix);
    if (!session) {
      throw new BridgeRuntimeError("NOT_FOUND", `Unknown agent session: ${idOrPrefix}`);
    }
    const updated = agentSessionSchema.parse(await mutate(session, snapshot));
    await writeAgentSession(lockedRoot, updated);
    await regenerateContextUnlocked(lockedRoot);
    const refreshed = await loadBridgeSnapshot(lockedRoot);
    const finalized = updated.status === "active" && refreshed.lastSyncAt > (updated.acknowledgedContextTimestamp ?? "") ? agentSessionSchema.parse({
      ...updated,
      acknowledgedContextTimestamp: refreshed.lastSyncAt
    }) : updated;
    if (finalized !== updated) {
      await writeAgentSession(lockedRoot, finalized);
    }
    return deriveAgentSession(refreshed, finalized);
  });
}
async function startAgentSession(rootPath, idOrPrefix) {
  return updateAgentSessionState(rootPath, idOrPrefix, async (session, snapshot) => {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await createMutationLog(
      await ensureBridge(rootPath),
      session.agentId,
      "start",
      `Acknowledged session ${session.id}`,
      { sessionId: session.id, toolKind: session.toolKind }
    );
    return {
      ...session,
      status: "active",
      acknowledgedAt: timestamp,
      lastHeartbeatAt: timestamp,
      lastActivityAt: timestamp,
      acknowledgedContextTimestamp: snapshot.lastSyncAt,
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === session.agentId && task.status !== "done").map((task) => task.id),
      recovery: { recommended: false, generatedAt: timestamp }
    };
  });
}
async function heartbeatAgentSession(rootPath, idOrPrefix) {
  return updateAgentSessionState(rootPath, idOrPrefix, async (session, snapshot) => {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await createMutationLog(
      await ensureBridge(rootPath),
      session.agentId,
      "heartbeat",
      `Heartbeat received for session ${session.id}`,
      { sessionId: session.id, toolKind: session.toolKind }
    );
    return {
      ...session,
      status: session.status === "failed" ? "failed" : "active",
      lastHeartbeatAt: timestamp,
      lastActivityAt: timestamp,
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === session.agentId && task.status !== "done").map((task) => task.id),
      recovery: { recommended: false, generatedAt: timestamp }
    };
  });
}
async function stopAgentSession(rootPath, idOrPrefix, payload = {}) {
  return updateAgentSessionState(rootPath, idOrPrefix, async (session, snapshot) => {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await createMutationLog(
      await ensureBridge(rootPath),
      session.agentId,
      "stop",
      payload.reason?.trim() ? `Stopped session: ${payload.reason.trim()}` : `Stopped session ${session.id}`,
      { sessionId: session.id, toolKind: session.toolKind, reason: payload.reason?.trim() || void 0 }
    );
    return {
      ...session,
      status: "stopped",
      stoppedAt: timestamp,
      stoppedReason: payload.reason?.trim() || "Agent session was stopped manually.",
      lastHeartbeatAt: session.lastHeartbeatAt ?? timestamp,
      lastActivityAt: timestamp,
      currentTaskIds: snapshot.tasks.filter((task) => task.agentId === session.agentId && task.status !== "done").map((task) => task.id),
      recovery: {
        recommended: snapshot.tasks.some((task) => task.agentId === session.agentId && task.status !== "done"),
        reason: payload.reason?.trim() || "Agent session was stopped manually.",
        generatedAt: timestamp
      }
    };
  });
}
async function getAgentSessionRecovery(rootPath, idOrPrefix) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const session = await readAgentSession(root, idOrPrefix);
  if (!session) {
    throw new BridgeRuntimeError("NOT_FOUND", `Unknown agent session: ${idOrPrefix}`);
  }
  return deriveAgentSession(snapshot, session);
}
async function listDecisions(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.decisions.filter((decision) => {
    if (!filters.status) {
      return true;
    }
    return decision.status === filters.status;
  });
}
async function addDecision(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.agentId);
    const decision = decisionSchema.parse({
      id: `decision-${randomUUID2()}`,
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: payload.status ?? "proposed"
    });
    await writeJsonAtomic2(path3.join(paths.decisionsDir, `${decision.id}.json`), decision);
    if (payload.agentId) {
      await createMutationLog(lockedRoot, payload.agentId, "decision", `Recorded decision: ${decision.title}`, {
        decisionId: decision.id,
        status: decision.status ?? "proposed"
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return decision;
  });
}
async function updateDecisionStatus(rootPath, idOrPrefix, status, agentId) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues = [];
    const { filePath, decision } = await readDecision(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, agentId);
    const updated = decisionSchema.parse({
      ...decision,
      status
    });
    await writeJsonAtomic2(filePath, updated);
    if (agentId) {
      await createMutationLog(lockedRoot, agentId, "decision", `Updated decision: ${updated.title}`, {
        decisionId: updated.id,
        status
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}
async function listReleases(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const access = resolveBridgeAccess(filters.access);
  const visible = filterVisibleReleases(snapshot.releases, access);
  return visible.filter((release) => {
    if (filters.status && release.status !== filters.status) {
      return false;
    }
    if (!filters.includeArchived && release.status === "archived") {
      return false;
    }
    return true;
  });
}
async function addRelease(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const status = payload.status ?? "draft";
    const release = releaseSchema.parse({
      id: `release-${randomUUID2()}`,
      version: payload.version.trim(),
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      status,
      publishedAt: status === "published" ? createdAt : void 0,
      highlights: normalizeList(payload.highlights),
      breakingChanges: normalizeList(payload.breakingChanges),
      upgradeNotes: normalizeList(payload.upgradeNotes),
      tags: normalizeList(payload.tags),
      createdBy: payload.createdBy,
      createdAt,
      updatedAt: createdAt
    });
    await writeJsonAtomic2(path3.join(paths.releasesDir, `${release.id}.json`), release);
    if (release.createdBy) {
      await createMutationLog(
        lockedRoot,
        release.createdBy,
        "release",
        `${release.status === "published" ? "Published" : "Drafted"} release: ${release.version}`,
        { releaseId: release.id, status: release.status }
      );
    }
    await regenerateContextUnlocked(lockedRoot);
    return release;
  });
}
async function updateRelease(rootPath, idOrPrefix, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues = [];
    const { filePath, release } = await readRelease(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);
    const nextStatus = payload.status ?? release.status;
    const updated = releaseSchema.parse({
      ...release,
      version: payload.version?.trim() || release.version,
      title: payload.title?.trim() || release.title,
      summary: payload.summary?.trim() || release.summary,
      status: nextStatus,
      publishedAt: nextStatus === "published" ? payload.publishedAt?.trim() || release.publishedAt || (/* @__PURE__ */ new Date()).toISOString() : payload.publishedAt !== void 0 ? payload.publishedAt : release.publishedAt,
      highlights: payload.highlights ? normalizeList(payload.highlights) : release.highlights,
      breakingChanges: payload.breakingChanges ? normalizeList(payload.breakingChanges) : release.breakingChanges,
      upgradeNotes: payload.upgradeNotes ? normalizeList(payload.upgradeNotes) : release.upgradeNotes,
      tags: payload.tags ? normalizeList(payload.tags) : release.tags,
      createdBy: payload.createdBy ?? release.createdBy,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await writeJsonAtomic2(filePath, updated);
    if (updated.createdBy) {
      await createMutationLog(lockedRoot, updated.createdBy, "release", `Updated release: ${updated.version}`, {
        releaseId: updated.id,
        status: updated.status
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}
async function listAnnouncements(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const access = resolveBridgeAccess(filters.access);
  const visible = filterVisibleAnnouncements(snapshot.announcements, access);
  return visible.filter((announcement) => {
    if (filters.status && announcement.status !== filters.status) {
      return false;
    }
    if (!filters.includeArchived && announcement.status === "archived") {
      return false;
    }
    return true;
  });
}
async function addAnnouncement(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const status = payload.status ?? "draft";
    const announcement = announcementSchema.parse({
      id: `announcement-${randomUUID2()}`,
      title: payload.title.trim(),
      body: payload.body.trim(),
      status,
      audience: payload.audience ?? "all",
      severity: payload.severity ?? "info",
      publishedAt: status === "published" || status === "pinned" ? payload.publishedAt ?? createdAt : payload.publishedAt,
      expiresAt: payload.expiresAt,
      createdBy: payload.createdBy,
      createdAt,
      updatedAt: createdAt
    });
    await writeJsonAtomic2(path3.join(paths.announcementsDir, `${announcement.id}.json`), announcement);
    if (announcement.createdBy) {
      await createMutationLog(
        lockedRoot,
        announcement.createdBy,
        "announcement",
        `${announcement.status === "draft" ? "Drafted" : "Published"} announcement: ${announcement.title}`,
        { announcementId: announcement.id, status: announcement.status, audience: announcement.audience }
      );
    }
    await regenerateContextUnlocked(lockedRoot);
    return announcement;
  });
}
async function updateAnnouncement(rootPath, idOrPrefix, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const issues = [];
    const { filePath, announcement } = await readAnnouncement(lockedRoot, idOrPrefix, issues);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.createdBy);
    const nextStatus = payload.status ?? announcement.status;
    const updated = announcementSchema.parse({
      ...announcement,
      title: payload.title?.trim() || announcement.title,
      body: payload.body?.trim() || announcement.body,
      status: nextStatus,
      audience: payload.audience ?? announcement.audience,
      severity: payload.severity ?? announcement.severity,
      publishedAt: nextStatus === "published" || nextStatus === "pinned" ? payload.publishedAt?.trim() || announcement.publishedAt || (/* @__PURE__ */ new Date()).toISOString() : payload.publishedAt !== void 0 ? payload.publishedAt : announcement.publishedAt,
      expiresAt: payload.expiresAt === null ? void 0 : payload.expiresAt ?? announcement.expiresAt,
      createdBy: payload.createdBy ?? announcement.createdBy,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await writeJsonAtomic2(filePath, updated);
    if (updated.createdBy) {
      await createMutationLog(
        lockedRoot,
        updated.createdBy,
        "announcement",
        `Updated announcement: ${updated.title}`,
        { announcementId: updated.id, status: updated.status, audience: updated.audience }
      );
    }
    await regenerateContextUnlocked(lockedRoot);
    return updated;
  });
}
async function listConventions(rootPath) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  return snapshot.conventions;
}
async function addConvention(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    assertAgentExists(snapshot.bridge, payload.addedBy);
    const convention = conventionSchema.parse({
      id: `convention-${randomUUID2()}`,
      rule: payload.rule.trim(),
      addedAt: (/* @__PURE__ */ new Date()).toISOString(),
      addedBy: payload.addedBy,
      category: payload.category
    });
    await ensureDir2(paths.conventionsDir);
    await writeJsonAtomic2(path3.join(paths.conventionsDir, `${convention.id}.json`), convention);
    const updatedConventions = [...snapshot.conventions, convention];
    await writeTextAtomic(paths.conventionsFile, conventionsToMarkdownDocument(updatedConventions));
    if (payload.addedBy) {
      await createMutationLog(lockedRoot, payload.addedBy, "convention", "Added convention", {
        conventionId: convention.id,
        category: convention.category ?? "other"
      });
    }
    await regenerateContextUnlocked(lockedRoot);
    return convention;
  });
}
async function setConventions(rootPath, payload) {
  const root = await ensureBridge(rootPath);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    const snapshot = await loadBridgeSnapshot(lockedRoot);
    for (const item of payload) {
      assertAgentExists(snapshot.bridge, item.addedBy);
    }
    await ensureDir2(paths.conventionsDir);
    const existing = await fs2.readdir(paths.conventionsDir).catch(() => []);
    await Promise.all(
      existing.filter((name) => name.endsWith(".json")).map((name) => fs2.rm(path3.join(paths.conventionsDir, name), { force: true }))
    );
    const conventions = payload.map(
      (item, index) => conventionSchema.parse({
        id: item.id ?? `convention-${randomUUID2()}`,
        rule: item.rule.trim(),
        addedAt: item.addedAt ?? new Date(Date.now() + index).toISOString(),
        addedBy: item.addedBy,
        category: item.category
      })
    );
    await Promise.all(
      conventions.map(
        (convention) => writeJsonAtomic2(path3.join(paths.conventionsDir, `${convention.id}.json`), convention)
      )
    );
    await writeTextAtomic(paths.conventionsFile, conventionsToMarkdownDocument(conventions));
    await regenerateContextUnlocked(lockedRoot);
    return conventions;
  });
}
async function showConventionsMarkdown(rootPath) {
  const root = await ensureBridge(rootPath);
  return readTextIfExists(getBridgePaths(root).conventionsFile);
}
async function listLogs(rootPath, filters = {}) {
  const root = await ensureBridge(rootPath);
  const snapshot = await loadBridgeSnapshot(root);
  const filtered = snapshot.logs.filter((log) => {
    if (filters.agentId && log.agentId !== filters.agentId) return false;
    return true;
  });
  return typeof filters.limit === "number" ? filtered.slice(0, filters.limit) : filtered;
}
async function addLog(rootPath, payload) {
  return addStructuredLog(rootPath, payload);
}
async function addCapturedLog(rootPath, payload) {
  return addStructuredLog(rootPath, payload, { allowUnknownAgent: true });
}
async function createMissingStructure(paths) {
  await Promise.all([
    ensureDir2(paths.root),
    ensureDir2(paths.captureDir),
    ensureDir2(paths.agentsDir),
    ensureDir2(paths.tasksDir),
    ensureDir2(paths.logsDir),
    ensureDir2(paths.handoffsDir),
    ensureDir2(paths.decisionsDir),
    ensureDir2(paths.conventionsDir),
    ensureDir2(paths.messagesDir),
    ensureDir2(paths.releasesDir),
    ensureDir2(paths.announcementsDir),
    ensureDir2(paths.sessionsDir)
  ]);
}
async function createAgentTemplate(kind, destinationPath) {
  const templatePath = path3.resolve(PROTOCOL_TEMPLATES_ROOT, `${kind}.md`);
  if (await fileExists2(destinationPath)) {
    return false;
  }
  const template = await readTextIfExists(templatePath);
  await fs2.writeFile(destinationPath, template || `# ${AGENT_LABELS[kind]}
`, "utf8");
  return true;
}
function uniqueAgentKinds(agentIds) {
  const seen = /* @__PURE__ */ new Set();
  const normalized = [];
  for (const raw of agentIds.map((value) => value.trim()).filter(Boolean)) {
    if (!agentKinds.includes(raw)) {
      throw new BridgeRuntimeError("VALIDATION_ERROR", `Unsupported agent kind: ${raw}`);
    }
    if (!seen.has(raw)) {
      normalized.push(raw);
      seen.add(raw);
    }
  }
  return normalized.length > 0 ? normalized : ["cursor"];
}
async function initBridge(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const root = path3.resolve(cwd, DEFAULT_BRIDGE_DIRNAME);
  await ensureDir2(root);
  return withBridgeWriteLock(root, async (lockedRoot) => {
    const paths = getBridgePaths(lockedRoot);
    await createMissingStructure(paths);
    const createdFiles = [];
    const alreadyInitialized = await fileExists2(paths.bridgeFile);
    const normalizedSetup = normalizeBridgeSetup(options.setup);
    if (!alreadyInitialized) {
      const bridge2 = bridgeSchema.parse({
        schemaVersion: "1.0",
        projectName: options.name?.trim() || path3.basename(cwd),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        agents: uniqueAgentKinds(options.agents ?? ["cursor"]).map(buildAgent),
        setup: normalizedSetup
      });
      await writeJsonAtomic2(paths.bridgeFile, bridge2);
      createdFiles.push(paths.bridgeFile);
    }
    if (!await fileExists2(paths.conventionsFile)) {
      await fs2.writeFile(
        paths.conventionsFile,
        "# Project Conventions\n\n> Shared rules all agents must follow. Managed via `aibridge convention add`.\n",
        "utf8"
      );
      createdFiles.push(paths.conventionsFile);
    }
    let bridge = await readBridgeConfig(paths, []);
    if (normalizedSetup) {
      const updatedBridge = bridgeSchema.parse({
        ...bridge,
        projectName: options.name?.trim() || bridge.projectName,
        agents: options.agents && options.agents.length > 0 ? uniqueAgentKinds(options.agents).map(buildAgent) : bridge.agents,
        setup: normalizedSetup
      });
      await writeJsonAtomic2(paths.bridgeFile, updatedBridge);
      bridge = updatedBridge;
    }
    for (const agent of bridge.agents) {
      const destinationPath = path3.join(paths.agentsDir, `${agent.kind}.md`);
      if (await createAgentTemplate(agent.kind, destinationPath)) {
        createdFiles.push(destinationPath);
      }
    }
    const contextExisted = await fileExists2(paths.contextFile);
    const markdown = await regenerateContextUnlocked(lockedRoot);
    if (!alreadyInitialized || !contextExisted || markdown.length > 0) {
      createdFiles.push(paths.contextFile);
    }
    return {
      rootPath: lockedRoot,
      createdFiles,
      alreadyInitialized
    };
  });
}
function parsePriority(value) {
  if (!value) {
    return "medium";
  }
  if (!priorities.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid priority: ${value}`);
  }
  return value;
}
function parseTaskStatus(value) {
  if (!["pending", "in_progress", "done"].includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid task status: ${value}`);
  }
  return value;
}
function parseMessageSeverity(value) {
  if (!messageSeverities.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid message severity: ${value}`);
  }
  return value;
}
function parseDecisionStatus(value) {
  if (!decisionStatuses.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid decision status: ${value}`);
  }
  return value;
}
function parseReleaseStatus(value) {
  if (!releaseStatuses.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid release status: ${value}`);
  }
  return value;
}
function parseAnnouncementStatus(value) {
  if (!announcementStatuses.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid announcement status: ${value}`);
  }
  return value;
}
function parseAnnouncementAudience(value) {
  if (!announcementAudiences.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid announcement audience: ${value}`);
  }
  return value;
}
function parseAnnouncementSeverity(value) {
  if (!announcementSeverities.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid announcement severity: ${value}`);
  }
  return value;
}
function parseConventionCategory(value) {
  if (!conventionCategories.includes(value)) {
    throw new BridgeRuntimeError("VALIDATION_ERROR", `Invalid convention category: ${value}`);
  }
  return value;
}

// aibridge/services/local/service.ts
import { createServer } from "http";
import { promises as fs5 } from "fs";
import path6 from "path";

// aibridge/services/capture/capture.ts
import { randomUUID as randomUUID3 } from "crypto";
import { execFile } from "child_process";
import { promises as fs3 } from "fs";
import path4 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
var CURRENT_DIR = path4.dirname(fileURLToPath3(import.meta.url));
var TOOL_ROOT = path4.resolve(CURRENT_DIR, "../../..");
var CLI_ENTRY = path4.join(TOOL_ROOT, "aibridge", "cli", "bin", "aibridge.ts");
var TSX_CLI = path4.join(TOOL_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
var HOOK_MARKER = "# aibridge capture hook";
var DEFAULT_HOOKS = ["post-commit", "post-merge", "post-checkout"];
var DEFAULT_WATCH_DEBOUNCE_MS = 1500;
var DEFAULT_WATCH_SCAN_INTERVAL_MS = 750;
var HEARTBEAT_INTERVAL_MS = 2e3;
var WATCHER_STOP_TIMEOUT_MS = 5e3;
var IGNORED_PREFIXES = [
  ".aibridge/",
  ".git/",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  ".next/"
];
function repoRootFromBridgeRoot(bridgeRoot2) {
  return path4.basename(bridgeRoot2) === ".aibridge" ? path4.dirname(bridgeRoot2) : bridgeRoot2;
}
function normalizePathForPattern(value) {
  return value.replace(/\\/g, "/").toLowerCase();
}
function agentPatternMatch(value) {
  const normalized = normalizePathForPattern(value);
  if (!normalized) {
    return null;
  }
  const patterns = [
    { token: ".cursor", agentId: "cursor" },
    { token: "cursor", agentId: "cursor" },
    { token: ".claude", agentId: "claude" },
    { token: "claude", agentId: "claude" },
    { token: ".codex", agentId: "codex" },
    { token: "codex", agentId: "codex" },
    { token: "windsurf", agentId: "windsurf" },
    { token: "copilot", agentId: "copilot" },
    { token: "antigravity", agentId: "antigravity" }
  ];
  return patterns.find((pattern) => normalized.includes(pattern.token))?.agentId ?? null;
}
function isIgnoredPath(relativePath) {
  const normalized = normalizePathForPattern(relativePath);
  if (!normalized || normalized === ".") {
    return false;
  }
  if (IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  return normalized.endsWith(".log");
}
async function resolveGitDir(repoRoot) {
  const gitPath = path4.join(repoRoot, ".git");
  const stats = await fs3.stat(gitPath).catch(() => null);
  if (!stats) {
    throw new BridgeRuntimeError("NOT_FOUND", `No .git directory found at ${repoRoot}.`);
  }
  if (stats.isDirectory()) {
    return gitPath;
  }
  const raw = await fs3.readFile(gitPath, "utf8");
  const match = raw.match(/^gitdir:\s*(.+)$/im);
  if (!match?.[1]) {
    throw new BridgeRuntimeError("INVALID_STATE", `Unsupported .git file format at ${gitPath}.`);
  }
  return path4.resolve(repoRoot, match[1].trim());
}
async function pathExists(targetPath) {
  try {
    await fs3.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
function buildHookScript(repoRoot, hookName) {
  const toolRoot = TOOL_ROOT.replace(/\\/g, "/");
  const targetRoot = repoRoot.replace(/\\/g, "/");
  return `#!/bin/sh
${HOOK_MARKER}
set -e
HOOK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKUP="$HOOK_DIR/${hookName}.aibridge.backup"
if [ -x "$BACKUP" ]; then
  "$BACKUP" "$@"
fi
cd "${targetRoot}" || exit 1
if [ -f "${toolRoot}/node_modules/tsx/dist/cli.mjs" ]; then
  node "${toolRoot}/node_modules/tsx/dist/cli.mjs" "${toolRoot}/aibridge/cli/bin/aibridge.ts" capture hook ${hookName} "$@" || true
fi
`;
}
async function sleep2(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function installManagedHook(hooksDir, repoRoot, hookName) {
  const hookPath = path4.join(hooksDir, hookName);
  const backupPath = `${hookPath}.aibridge.backup`;
  const nextScript = buildHookScript(repoRoot, hookName);
  let state = "installed";
  if (await pathExists(hookPath)) {
    const current = await fs3.readFile(hookPath, "utf8");
    if (current === nextScript) {
      return null;
    }
    if (!current.includes(HOOK_MARKER) && current.trim().length > 0 && !await pathExists(backupPath)) {
      await fs3.rename(hookPath, backupPath);
    }
    state = "updated";
  }
  await fs3.writeFile(hookPath, nextScript, { mode: 493, encoding: "utf8" });
  await fs3.chmod(hookPath, 493).catch(() => void 0);
  return state;
}
async function execGit(repoRoot, args) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: repoRoot });
    return stdout.trim();
  } catch (error2) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Git command failed: git ${args.join(" ")}`, {
      reason: error2.message
    });
  }
}
function resolveAgentFromBridge(agents, candidate) {
  if (candidate === "unknown" || candidate === "human") {
    return candidate;
  }
  const exact = agents.find((agent) => agent.id === candidate);
  if (exact) {
    return exact.id;
  }
  const byKind = agents.find((agent) => agent.kind === candidate);
  return byKind?.id ?? "unknown";
}
function detectAttribution(options) {
  const env = options.env ?? process.env;
  const explicit = options.explicitAgentId?.trim();
  if (explicit) {
    const agentId = resolveAgentFromBridge(options.bridgeAgents, explicit);
    return {
      agentId,
      rawAgentId: explicit,
      source: "explicit",
      confidence: "high"
    };
  }
  const envCandidates = [
    ["AIBRIDGE_AGENT", env.AIBRIDGE_AGENT],
    ["AGENT", env.AGENT],
    ["CODEX_AGENT", env.CODEX_AGENT]
  ];
  for (const [key, value] of envCandidates) {
    if (!value?.trim()) {
      continue;
    }
    const agentId = resolveAgentFromBridge(options.bridgeAgents, value.trim());
    return {
      agentId,
      rawAgentId: value.trim(),
      source: `env:${key}`,
      confidence: "high"
    };
  }
  const authorMatch = options.authorName ? agentPatternMatch(options.authorName) : null;
  if (authorMatch) {
    return {
      agentId: resolveAgentFromBridge(options.bridgeAgents, authorMatch),
      rawAgentId: authorMatch,
      source: "git-author",
      confidence: "medium"
    };
  }
  const pathMatch = options.changedPaths?.map(agentPatternMatch).find(Boolean) ?? null;
  if (pathMatch) {
    return {
      agentId: resolveAgentFromBridge(options.bridgeAgents, pathMatch),
      rawAgentId: pathMatch,
      source: "path-marker",
      confidence: "low"
    };
  }
  return {
    agentId: "unknown",
    rawAgentId: "unknown",
    source: "fallback",
    confidence: "low"
  };
}
async function recordCaptureWarning(bridgeRoot2, kind, message, payload) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await appendCaptureValidationWarning(bridgeRoot2, {
    id: `capture-warning-${randomUUID3()}`,
    timestamp,
    kind,
    message,
    payload
  });
  await updateCaptureStatus(bridgeRoot2, (current) => ({
    ...current,
    validationWarnings: current.validationWarnings + 1,
    lastWarningAt: timestamp
  }));
}
async function ingestCaptureEvent(bridgeRoot2, input, agents) {
  const action = input.action?.trim();
  const description = input.description?.trim();
  if (!action || !description) {
    await recordCaptureWarning(bridgeRoot2, "malformed-event", "Capture event was missing action or description.", {
      action: input.action,
      description: input.description,
      source: input.source
    });
    return null;
  }
  if (input.metadata !== void 0 && (typeof input.metadata !== "object" || input.metadata === null)) {
    await recordCaptureWarning(bridgeRoot2, "invalid-metadata", "Capture event metadata must be an object.", {
      source: input.source
    });
    return null;
  }
  const requestedAgentId = input.agentId?.trim() || "unknown";
  const resolvedAgentId = resolveAgentFromBridge(agents, requestedAgentId);
  if (requestedAgentId !== resolvedAgentId && requestedAgentId !== "unknown") {
    await recordCaptureWarning(bridgeRoot2, "invalid-agent", `Unknown capture agent "${requestedAgentId}". Falling back to unknown.`, {
      requestedAgentId,
      source: input.source
    });
  }
  const metadata = {
    ...input.metadata ?? {},
    capture: {
      source: input.source,
      attributionSource: input.attributionSource ?? "unknown",
      confidence: input.confidence ?? "low"
    }
  };
  return addCapturedLog(bridgeRoot2, {
    agentId: resolvedAgentId,
    action,
    description,
    metadata
  });
}
async function collectWorkspaceSnapshot(repoRoot) {
  const files = /* @__PURE__ */ new Map();
  async function walk(currentPath) {
    const entries = await fs3.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path4.join(currentPath, entry.name);
      const relativePath = path4.relative(repoRoot, fullPath);
      if (isIgnoredPath(relativePath)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const stats = await fs3.stat(fullPath);
      files.set(relativePath, {
        mtimeMs: stats.mtimeMs,
        size: stats.size
      });
    }
  }
  await walk(repoRoot);
  return files;
}
function diffSnapshots(previous, next) {
  const changed = /* @__PURE__ */ new Set();
  for (const [relativePath, details] of next.entries()) {
    const prior = previous.get(relativePath);
    if (!prior || prior.mtimeMs !== details.mtimeMs || prior.size !== details.size) {
      changed.add(relativePath);
    }
  }
  for (const relativePath of previous.keys()) {
    if (!next.has(relativePath)) {
      changed.add(relativePath);
    }
  }
  return [...changed].sort((left, right) => left.localeCompare(right));
}
function summarizeChangedPaths(paths) {
  if (paths.length === 0) {
    return "Modified files";
  }
  const preview = paths.slice(0, 5).join(", ");
  return paths.length > 5 ? `Modified ${paths.length} files: ${preview}, ...` : `Modified ${paths.length} files: ${preview}`;
}
async function installCaptureHooks(options = {}) {
  const bridgeRoot2 = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  await loadBridgeSnapshot(bridgeRoot2);
  const repoRoot = repoRootFromBridgeRoot(bridgeRoot2);
  const gitDir = await resolveGitDir(repoRoot);
  const hooksDir = path4.join(gitDir, "hooks");
  await fs3.mkdir(hooksDir, { recursive: true });
  const installed = [];
  const updated = [];
  for (const hookName of DEFAULT_HOOKS) {
    const result = await installManagedHook(hooksDir, repoRoot, hookName);
    if (result === "installed") {
      installed.push(hookName);
    }
    if (result === "updated") {
      updated.push(hookName);
    }
  }
  await updateCaptureStatus(bridgeRoot2, (current) => ({
    ...current,
    hooksInstalled: [...DEFAULT_HOOKS]
  }));
  return {
    repoRoot,
    hooksDir,
    installed,
    updated
  };
}
async function getCaptureStatus(options = {}) {
  const bridgeRoot2 = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  return readCaptureStatus(bridgeRoot2);
}
async function stopCaptureWatcher(options = {}) {
  const bridgeRoot2 = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  const status = await readCaptureStatus(bridgeRoot2);
  const pid = status.watcher.pid;
  if (!status.watcher.running) {
    const normalized = pid && !isWatcherProcessAlive(pid) ? await markWatcherStopped(bridgeRoot2, status.watcher.lastError ?? "Watcher process is not running.") : status;
    return {
      stopped: false,
      details: "Watcher is already stopped.",
      status: normalized
    };
  }
  if (!pid || !isWatcherProcessAlive(pid)) {
    const normalized = await markWatcherStopped(bridgeRoot2, status.watcher.lastError ?? "Watcher process is not running.");
    return {
      stopped: true,
      details: "Marked stale watcher as stopped.",
      status: normalized
    };
  }
  if (pid === process.pid) {
    return {
      stopped: false,
      details: "Watcher is running in the current process. Stop it from that process with Ctrl+C or watcher.close().",
      status
    };
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (error2) {
    const normalized = await markWatcherStopped(bridgeRoot2, `Unable to signal watcher process ${pid}: ${error2.message}`);
    return {
      stopped: true,
      details: `Watcher process ${pid} was not reachable; marked as stopped.`,
      status: normalized
    };
  }
  const deadline = Date.now() + WATCHER_STOP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep2(100);
    const nextStatus = await readCaptureStatus(bridgeRoot2);
    if (!nextStatus.watcher.running || !isWatcherProcessAlive(pid)) {
      const normalized = nextStatus.watcher.running ? await markWatcherStopped(bridgeRoot2, null) : await markWatcherStopped(bridgeRoot2, null);
      return {
        stopped: true,
        details: `Stopped watcher process ${pid}.`,
        status: normalized
      };
    }
  }
  throw new BridgeRuntimeError("BAD_REQUEST", `Timed out waiting for capture watcher ${pid} to stop.`, {
    pid,
    bridgeRoot: bridgeRoot2
  });
}
async function runCaptureDoctor(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const checks = [];
  let bridgeRoot2 = "";
  try {
    bridgeRoot2 = await resolveBridgeRoot({ cwd });
    await fs3.access(path4.join(bridgeRoot2, "bridge.json"));
    checks.push({ name: "bridge", ok: true, details: `Bridge found at ${bridgeRoot2}` });
  } catch (error2) {
    checks.push({ name: "bridge", ok: false, details: error2.message });
  }
  if (bridgeRoot2) {
    try {
      const repoRoot = repoRootFromBridgeRoot(bridgeRoot2);
      const gitDir = await resolveGitDir(repoRoot);
      const hooksDir = path4.join(gitDir, "hooks");
      checks.push({ name: "git", ok: true, details: `Git hooks directory: ${hooksDir}` });
      for (const hookName of DEFAULT_HOOKS) {
        const hookPath = path4.join(hooksDir, hookName);
        const installed = await pathExists(hookPath) ? (await fs3.readFile(hookPath, "utf8")).includes(HOOK_MARKER) : false;
        checks.push({
          name: `hook:${hookName}`,
          ok: installed,
          details: installed ? `Installed at ${hookPath}` : `Missing or unmanaged hook at ${hookPath}`
        });
      }
    } catch (error2) {
      checks.push({ name: "git", ok: false, details: error2.message });
    }
    checks.push({
      name: "tsx",
      ok: await pathExists(TSX_CLI),
      details: await pathExists(TSX_CLI) ? `Found ${TSX_CLI}` : `Not found: ${TSX_CLI}`
    });
    const captureStatus = await readCaptureStatus(bridgeRoot2);
    checks.push({
      name: "capture-status",
      ok: true,
      details: captureStatus.hooksInstalled.length > 0 ? `Persisted hooks: ${captureStatus.hooksInstalled.join(", ")}` : "No hooks recorded in capture status."
    });
    checks.push({
      name: "watcher",
      ok: !captureStatus.watcher.running || (captureStatus.watcher.pid ? isWatcherProcessAlive(captureStatus.watcher.pid) : false),
      details: captureStatus.watcher.running ? `Watcher running with PID ${captureStatus.watcher.pid ?? "unknown"} at ${captureStatus.watcher.watchedRoot ?? bridgeRoot2}` : captureStatus.watcher.lastError ? `Watcher stopped: ${captureStatus.watcher.lastError}` : "Watcher stopped."
    });
  }
  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}
async function handleCaptureHook(options) {
  const bridgeRoot2 = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  const repoRoot = repoRootFromBridgeRoot(bridgeRoot2);
  const snapshot = await loadBridgeSnapshot(bridgeRoot2);
  if (options.hookName === "post-commit") {
    const metadataBlock = await execGit(repoRoot, ["log", "-1", "--pretty=%H%n%s%n%an"]);
    const [commitHash = "", subject = "Commit", authorName = ""] = metadataBlock.split(/\r?\n/);
    const changedPaths = (await execGit(repoRoot, ["show", "--pretty=", "--name-only", "--no-renames", "HEAD"])).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const attribution = detectAttribution({
      bridgeAgents: snapshot.bridge.agents,
      explicitAgentId: options.explicitAgentId,
      authorName,
      changedPaths
    });
    const log = await ingestCaptureEvent(bridgeRoot2, {
      agentId: attribution.agentId,
      action: "commit",
      description: `Committed: ${subject}`,
      metadata: {
        commitHash,
        changedPaths,
        filesChanged: changedPaths.length,
        hook: "post-commit"
      },
      source: "git-hook",
      attributionSource: attribution.source,
      confidence: attribution.confidence
    }, snapshot.bridge.agents);
    await updateCaptureStatus(bridgeRoot2, (current) => ({
      ...current,
      lastCapturedAt: (/* @__PURE__ */ new Date()).toISOString(),
      watcher: {
        ...current.watcher,
        lastEventAt: (/* @__PURE__ */ new Date()).toISOString(),
        recentPaths: changedPaths.slice(0, 5),
        attribution
      }
    }));
    return log;
  }
  if (options.hookName === "post-merge" || options.hookName === "post-checkout") {
    const branch = await execGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]) || "HEAD";
    const changedPaths = (await execGit(repoRoot, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const attribution = detectAttribution({
      bridgeAgents: snapshot.bridge.agents,
      explicitAgentId: options.explicitAgentId,
      changedPaths
    });
    return ingestCaptureEvent(bridgeRoot2, {
      agentId: attribution.agentId,
      action: options.hookName === "post-merge" ? "merge" : "checkout",
      description: options.hookName === "post-merge" ? `Merged updates into ${branch}` : `Checked out ${branch}`,
      metadata: {
        branch,
        changedPaths,
        hook: options.hookName,
        hookArgs: options.args ?? []
      },
      source: "git-hook",
      attributionSource: attribution.source,
      confidence: attribution.confidence
    }, snapshot.bridge.agents);
  }
  throw new BridgeRuntimeError("BAD_REQUEST", `Unsupported capture hook: ${options.hookName}`);
}
async function startCaptureWatcher(options = {}) {
  const bridgeRoot2 = await resolveBridgeRoot({ cwd: options.cwd ?? process.cwd() });
  const repoRoot = repoRootFromBridgeRoot(bridgeRoot2);
  const snapshot = await loadBridgeSnapshot(bridgeRoot2);
  const debounceMs = options.debounceMs ?? DEFAULT_WATCH_DEBOUNCE_MS;
  const scanIntervalMs = options.scanIntervalMs ?? DEFAULT_WATCH_SCAN_INTERVAL_MS;
  const currentStatus = await readCaptureStatus(bridgeRoot2);
  if (currentStatus.watcher.running && currentStatus.watcher.pid && isWatcherProcessAlive(currentStatus.watcher.pid)) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Capture watcher is already running for ${currentStatus.watcher.watchedRoot ?? repoRoot}.`, {
      pid: currentStatus.watcher.pid,
      watchedRoot: currentStatus.watcher.watchedRoot ?? repoRoot
    });
  }
  if (currentStatus.watcher.running && (!currentStatus.watcher.pid || !isWatcherProcessAlive(currentStatus.watcher.pid))) {
    await markWatcherStopped(bridgeRoot2, currentStatus.watcher.lastError ?? "Recovered stale watcher state before restart.");
  }
  let currentSnapshot = await collectWorkspaceSnapshot(repoRoot);
  const pendingPaths = /* @__PURE__ */ new Set();
  let flushTimer = null;
  let heartbeatAt = 0;
  let scanInFlight = false;
  let stopped = false;
  const writeWatcherState = async (partial, extras) => {
    await updateCaptureStatus(bridgeRoot2, (current) => ({
      ...current,
      ...extras ?? {},
      watcher: {
        ...current.watcher,
        ...partial
      }
    }));
  };
  const flushPending = async () => {
    if (pendingPaths.size === 0) {
      return;
    }
    const changedPaths = [...pendingPaths].sort((left, right) => left.localeCompare(right));
    pendingPaths.clear();
    options.onBatch?.(changedPaths);
    const attribution = detectAttribution({
      bridgeAgents: snapshot.bridge.agents,
      explicitAgentId: options.agentId,
      changedPaths
    });
    await ingestCaptureEvent(
      bridgeRoot2,
      {
        agentId: attribution.agentId,
        action: "edit",
        description: summarizeChangedPaths(changedPaths),
        metadata: {
          changedPaths,
          filesChanged: changedPaths.length
        },
        source: "watcher",
        attributionSource: attribution.source,
        confidence: attribution.confidence
      },
      snapshot.bridge.agents
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await writeWatcherState(
      {
        lastEventAt: now,
        recentPaths: changedPaths.slice(0, 5),
        attribution,
        lastError: void 0
      },
      { lastCapturedAt: now }
    );
  };
  await updateCaptureStatus(bridgeRoot2, (current) => ({
    ...current,
    watcher: {
      ...current.watcher,
      running: true,
      pid: process.pid,
      watchedRoot: repoRoot,
      debounceMs,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastError: void 0
    }
  }));
  const interval = setInterval(async () => {
    if (stopped || scanInFlight) {
      return;
    }
    scanInFlight = true;
    try {
      const nextSnapshot = await collectWorkspaceSnapshot(repoRoot);
      const changed = diffSnapshots(currentSnapshot, nextSnapshot);
      currentSnapshot = nextSnapshot;
      changed.forEach((relativePath) => pendingPaths.add(relativePath));
      if (changed.length > 0) {
        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        flushTimer = setTimeout(() => {
          void flushPending();
        }, debounceMs);
      }
      if (Date.now() - heartbeatAt >= HEARTBEAT_INTERVAL_MS) {
        heartbeatAt = Date.now();
        await writeWatcherState({
          lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } catch (error2) {
      await writeWatcherState({
        lastError: error2.message,
        lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } finally {
      scanInFlight = false;
    }
  }, scanIntervalMs);
  return {
    close: async () => {
      stopped = true;
      clearInterval(interval);
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await flushPending();
      await writeWatcherState({
        running: false,
        pid: void 0,
        lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    },
    getStatus: async () => readCaptureStatus(bridgeRoot2)
  };
}

// src/lib/aibridge/setup/templates.ts
var sharedWorkflow = {
  handoffPattern: "Lead agent creates scope and starter tasks, implementation agent executes, review agent validates before handoff back to lead.",
  reviewCadence: "Review after scaffold completion, after first working slice, and before release/update notes."
};
var templates = [
  {
    id: "web-app",
    label: "Web App",
    description: "Browser-based product with UI, routing, and integration layers.",
    defaultPrimaryDeliverable: "Responsive web application with a working primary user flow.",
    structureAssumptions: ["frontend app shell", "core UI routes", "shared components", "tests for primary flow"],
    suggestedStacks: ["react", "vite", "typescript", "tailwind", "supabase"],
    defaultPriorities: ["quality", "speed"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Lead Builder", agentKind: "cursor", responsibilities: ["define scope", "implement UI shell"], ownership: ["app shell", "primary flow"] },
      { key: "review", name: "Reviewer", agentKind: "codex", responsibilities: ["review architecture", "tighten tests"], ownership: ["testing", "quality gates"] },
      { key: "content", name: "Content & QA", agentKind: "claude", responsibilities: ["refine copy", "check UX edge cases"], ownership: ["copy", "handoffs"] }
    ],
    defaultConventions: [
      { key: "web-flow", rule: "Preserve the primary user flow while iterating on UI structure.", category: "workflow" },
      { key: "web-tests", rule: "Add regression coverage for the main route before shipping changes.", category: "testing" }
    ],
    defaultTaskBlueprints: [
      { key: "scope", title: "Define product scope and acceptance flow", summary: "Turn the brief into a clear implementation slice for the first release.", priority: "high", suggestedRoleKey: "lead" },
      { key: "stack", title: "Confirm frontend stack and app structure", summary: "Lock the stack, routing approach, and shared component boundaries.", priority: "high", suggestedRoleKey: "lead" },
      { key: "build", title: "Implement the first working UI slice", summary: "Build the primary route and make it functional end to end.", priority: "high", suggestedRoleKey: "lead" },
      { key: "tests", title: "Add regression coverage for the primary flow", summary: "Protect the working slice with practical tests.", priority: "medium", suggestedRoleKey: "review" },
      { key: "review", title: "Review polish, responsiveness, and accessibility", summary: "Validate the first slice on desktop/mobile and fix obvious issues.", priority: "medium", suggestedRoleKey: "content" },
      { key: "release", title: "Prepare release notes and definition-of-done review", summary: "Capture what shipped and what still blocks release.", priority: "low", suggestedRoleKey: "review" }
    ],
    definitionOfDone: [
      "Primary route works end to end.",
      "Responsive layout is acceptable on desktop and mobile.",
      "Main user flow has regression coverage.",
      "Known gaps are documented before release notes are written."
    ],
    workflowPattern: {
      summary: "UI-first implementation with explicit review and release-note preparation.",
      ...sharedWorkflow,
      milestones: ["scope approved", "working UI slice", "tests green", "release notes drafted"]
    }
  },
  {
    id: "api-backend",
    label: "API Backend",
    description: "Service or backend API with schema, handlers, and tests.",
    defaultPrimaryDeliverable: "Versioned API with documented contract and passing tests.",
    structureAssumptions: ["service entrypoints", "data layer", "API contract", "integration tests"],
    suggestedStacks: ["node", "typescript", "postgres", "supabase", "vitest"],
    defaultPriorities: ["quality", "security"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "API Lead", agentKind: "cursor", responsibilities: ["shape contracts", "implement handlers"], ownership: ["API surface", "persistence"] },
      { key: "review", name: "Reliability Reviewer", agentKind: "codex", responsibilities: ["check edge cases", "tighten tests"], ownership: ["validation", "test quality"] }
    ],
    defaultConventions: [
      { key: "api-contract", rule: "Keep request/response contracts explicit and versioned.", category: "architecture" },
      { key: "api-validation", rule: "Validate all external input before it touches persistence.", category: "testing" }
    ],
    defaultTaskBlueprints: [
      { key: "contract", title: "Define API contract and persistence boundaries", summary: "Document the API shape and data model before implementation.", priority: "high", suggestedRoleKey: "lead" },
      { key: "scaffold", title: "Scaffold service and data access layer", summary: "Create the executable service entrypoint and repository structure.", priority: "high", suggestedRoleKey: "lead" },
      { key: "core", title: "Implement the first production route", summary: "Ship the highest-value API route with validation and persistence.", priority: "high", suggestedRoleKey: "lead" },
      { key: "tests", title: "Add integration and validation tests", summary: "Cover success path, invalid input, and permission edge cases.", priority: "high", suggestedRoleKey: "review" },
      { key: "ops", title: "Document operational constraints and rollout checks", summary: "Capture how to run, verify, and troubleshoot the service.", priority: "medium", suggestedRoleKey: "review" }
    ],
    definitionOfDone: [
      "API contract is documented and matches implementation.",
      "Core routes pass integration tests.",
      "Validation and permission failures are covered.",
      "Operational runbook exists for local verification."
    ],
    workflowPattern: {
      summary: "Contract-first backend delivery with validation and test review before release.",
      ...sharedWorkflow,
      milestones: ["contract locked", "service scaffolded", "core route working", "integration tests green"]
    }
  },
  {
    id: "mobile-app",
    label: "Mobile App",
    description: "Mobile-first application with navigation, responsive states, and offline-aware decisions.",
    defaultPrimaryDeliverable: "Mobile experience for the primary user flow with clear state handling.",
    structureAssumptions: ["app shell", "mobile navigation", "device-aware state handling", "testing plan"],
    suggestedStacks: ["react-native", "expo", "typescript", "supabase"],
    defaultPriorities: ["quality", "cost"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Mobile Builder", agentKind: "cursor", responsibilities: ["build mobile flow", "own navigation"], ownership: ["mobile shell", "main screens"] },
      { key: "review", name: "QA Reviewer", agentKind: "codex", responsibilities: ["spot state edge cases", "test device behavior"], ownership: ["QA", "stability"] }
    ],
    defaultConventions: [
      { key: "mobile-states", rule: "Design loading, offline, and empty states before secondary polish.", category: "workflow" },
      { key: "mobile-performance", rule: "Prefer simple layouts and avoid avoidable heavy client work on first pass.", category: "architecture" }
    ],
    defaultTaskBlueprints: [
      { key: "flow", title: "Define the primary mobile user flow", summary: "Map the first user journey and key screens.", priority: "high", suggestedRoleKey: "lead" },
      { key: "shell", title: "Implement navigation and screen scaffold", summary: "Create the shell and navigation for the first slice.", priority: "high", suggestedRoleKey: "lead" },
      { key: "states", title: "Handle loading, empty, and error states", summary: "Make the primary flow resilient to state changes.", priority: "high", suggestedRoleKey: "lead" },
      { key: "qa", title: "Review device constraints and regression risks", summary: "Check interaction edge cases before widening scope.", priority: "medium", suggestedRoleKey: "review" }
    ],
    definitionOfDone: [
      "Primary mobile flow works on the target shell.",
      "Loading, empty, and error states are present.",
      "Navigation is stable and understandable.",
      "Device-specific caveats are documented."
    ],
    workflowPattern: {
      summary: "Mobile-first flow validation before broadening scope.",
      ...sharedWorkflow,
      milestones: ["flow mapped", "navigation working", "states covered", "device review complete"]
    }
  },
  {
    id: "landing-page",
    label: "Landing Page",
    description: "Marketing or product landing page focused on narrative, layout, and conversion flow.",
    defaultPrimaryDeliverable: "High-quality landing page with a clear narrative and conversion path.",
    structureAssumptions: ["hero section", "supporting proof sections", "CTA flow", "responsive styling"],
    suggestedStacks: ["html", "css", "typescript", "react", "tailwind"],
    defaultPriorities: ["speed", "quality"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Landing Builder", agentKind: "cursor", responsibilities: ["build the first pass", "shape layout"], ownership: ["hero", "overall structure"] },
      { key: "review", name: "Landing Reviewer", agentKind: "codex", responsibilities: ["tighten polish", "review responsiveness"], ownership: ["layout review", "follow-up fixes"] }
    ],
    defaultConventions: [
      { key: "landing-focus", rule: "Prioritize a strong narrative and conversion path over decorative extras.", category: "workflow" },
      { key: "landing-scope", rule: "Do not fabricate frontend implementation when the repo only contains metadata.", category: "documentation" }
    ],
    defaultTaskBlueprints: [
      { key: "audit", title: "Audit the repo and confirm landing-page surface", summary: "Identify the real app entrypoints or static files before designing changes.", priority: "high", suggestedRoleKey: "lead" },
      { key: "narrative", title: "Define the landing-page narrative and section plan", summary: "Map hero, proof, feature, and CTA sections before implementation.", priority: "high", suggestedRoleKey: "lead" },
      { key: "implement", title: "Build the first production landing-page pass", summary: "Implement the page with responsive layout and intentional styling.", priority: "high", suggestedRoleKey: "lead" },
      { key: "review", title: "Review copy, responsiveness, and polish", summary: "Validate the page and apply targeted improvements.", priority: "medium", suggestedRoleKey: "review" },
      { key: "ship", title: "Document release copy and final QA notes", summary: "Capture what shipped and any remaining follow-up items.", priority: "low", suggestedRoleKey: "review" }
    ],
    definitionOfDone: [
      "The landing page communicates the product clearly above the fold.",
      "Primary CTA and supporting proof sections are present.",
      "Layout works across desktop and mobile breakpoints.",
      "Any missing source files or blockers are explicitly documented."
    ],
    workflowPattern: {
      summary: "Narrative-first landing-page build with explicit repo audit before implementation.",
      ...sharedWorkflow,
      milestones: ["repo audit complete", "section plan agreed", "first pass built", "review fixes applied"]
    }
  },
  {
    id: "ai-automation",
    label: "AI Automation",
    description: "Workflow, agent, or automation project with prompts, tools, and validation rules.",
    defaultPrimaryDeliverable: "Working automation flow with explicit inputs, outputs, and validation.",
    structureAssumptions: ["workflow definitions", "tool interfaces", "prompt rules", "validation harness"],
    suggestedStacks: ["typescript", "python", "openai", "supabase", "workers"],
    defaultPriorities: ["quality", "cost"],
    defaultAgentMode: "multi-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Automation Lead", agentKind: "cursor", responsibilities: ["design the flow", "implement orchestration"], ownership: ["automation graph", "tooling"] },
      { key: "review", name: "Evaluation Reviewer", agentKind: "codex", responsibilities: ["design checks", "stress prompts"], ownership: ["evals", "failure analysis"] }
    ],
    defaultConventions: [
      { key: "automation-observability", rule: "Keep automation inputs, outputs, and failure reasons observable.", category: "architecture" },
      { key: "automation-evals", rule: "Add a concrete validation path before expanding scope.", category: "testing" }
    ],
    defaultTaskBlueprints: [
      { key: "spec", title: "Define the automation inputs, outputs, and workflow", summary: "Turn the brief into an explicit automation contract.", priority: "high", suggestedRoleKey: "lead" },
      { key: "tools", title: "Wire the first tool or integration boundary", summary: "Implement the smallest useful integration slice.", priority: "high", suggestedRoleKey: "lead" },
      { key: "flow", title: "Implement the first automation path", summary: "Make the workflow execute from input to output.", priority: "high", suggestedRoleKey: "lead" },
      { key: "evals", title: "Add validation and failure-case coverage", summary: "Protect the automation with checks and review criteria.", priority: "high", suggestedRoleKey: "review" }
    ],
    definitionOfDone: [
      "The automation path runs on real inputs.",
      "Failure cases are observable.",
      "A validation/eval path exists.",
      "Scope and follow-up improvements are documented."
    ],
    workflowPattern: {
      summary: "Automation contract first, then implementation, then evaluation hardening.",
      ...sharedWorkflow,
      milestones: ["workflow specified", "tooling wired", "automation path working", "evals passing"]
    }
  },
  {
    id: "research-docs",
    label: "Research & Docs",
    description: "Research brief, architectural exploration, or documentation-heavy project.",
    defaultPrimaryDeliverable: "Decision-ready research package or documentation set.",
    structureAssumptions: ["research questions", "sources", "synthesis", "final recommendation"],
    suggestedStacks: ["markdown", "docs", "notion-export", "typescript"],
    defaultPriorities: ["quality", "cost"],
    defaultAgentMode: "single-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Research Lead", agentKind: "cursor", responsibilities: ["gather inputs", "write synthesis"], ownership: ["research doc", "recommendation"] },
      { key: "review", name: "Reviewer", agentKind: "codex", responsibilities: ["check gaps", "challenge reasoning"], ownership: ["review notes"] }
    ],
    defaultConventions: [
      { key: "research-sourcing", rule: "Separate source facts from recommendations and inference.", category: "documentation" },
      { key: "research-decision", rule: "End each research pass with a clear recommendation and unresolved questions.", category: "workflow" }
    ],
    defaultTaskBlueprints: [
      { key: "questions", title: "Define the research questions and scope", summary: "Clarify the decisions this work should inform.", priority: "high", suggestedRoleKey: "lead" },
      { key: "gather", title: "Gather primary references and evidence", summary: "Collect the materials needed to answer the scope.", priority: "high", suggestedRoleKey: "lead" },
      { key: "synthesis", title: "Write the synthesis and recommendation", summary: "Turn evidence into a decision-ready summary.", priority: "high", suggestedRoleKey: "lead" },
      { key: "review", title: "Review gaps and unresolved questions", summary: "Challenge the synthesis before finalizing.", priority: "medium", suggestedRoleKey: "review" }
    ],
    definitionOfDone: [
      "Research questions are explicit.",
      "Recommendations are backed by source evidence.",
      "Open questions are listed separately from conclusions.",
      "The output is ready to hand off for a decision."
    ],
    workflowPattern: {
      summary: "Research scope, evidence gathering, synthesis, and review before final recommendation.",
      ...sharedWorkflow,
      milestones: ["scope written", "evidence gathered", "synthesis drafted", "review complete"]
    }
  },
  {
    id: "empty",
    label: "Empty",
    description: "Minimal setup when the user wants full control with only light starter structure.",
    defaultPrimaryDeliverable: "Lightweight project brief and starter workspace scaffold.",
    structureAssumptions: ["basic bridge metadata", "starter tasks", "starter conventions"],
    suggestedStacks: ["custom"],
    defaultPriorities: ["speed"],
    defaultAgentMode: "single-agent",
    defaultAgentRoles: [
      { key: "lead", name: "Builder", agentKind: "cursor", responsibilities: ["shape the project", "own the first slice"], ownership: ["initial project scope"] }
    ],
    defaultConventions: [
      { key: "empty-scope", rule: "Write down the first slice before broadening scope.", category: "workflow" }
    ],
    defaultTaskBlueprints: [
      { key: "brief", title: "Write the initial project brief", summary: "Capture what this project is and what success looks like.", priority: "high", suggestedRoleKey: "lead" },
      { key: "first-slice", title: "Define and deliver the first meaningful slice", summary: "Pick the smallest useful outcome and ship it.", priority: "high", suggestedRoleKey: "lead" },
      { key: "review", title: "Review what the next slice should be", summary: "Decide what follows the first delivered slice.", priority: "medium", suggestedRoleKey: "lead" }
    ],
    definitionOfDone: [
      "The project brief exists.",
      "The first meaningful slice is defined.",
      "Conventions and next actions are recorded."
    ],
    workflowPattern: {
      summary: "Minimal setup with only a brief, first slice, and explicit next-step review.",
      ...sharedWorkflow,
      milestones: ["brief written", "first slice defined", "next step documented"]
    }
  }
];
function listSetupTemplates() {
  return templates.slice();
}
function getSetupTemplate(templateId) {
  return templates.find((template) => template.id === templateId);
}

// src/lib/aibridge/setup/questionnaire.ts
function createDefaultSetupQuestionnaire(templateId = "web-app") {
  const template = getSetupTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown setup template: ${templateId}`);
  }
  return {
    projectName: "",
    shortDescription: "",
    templateId,
    primaryDeliverable: template.defaultPrimaryDeliverable,
    preferredStack: template.suggestedStacks.slice(0, Math.min(3, template.suggestedStacks.length)),
    priorities: template.defaultPriorities.slice(),
    agentMode: template.defaultAgentMode,
    hardConstraints: [],
    existingRepo: false,
    existingFilesSummary: "",
    customInstructions: ""
  };
}

// src/lib/aibridge/setup/generator.ts
function normalizeList2(values) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}
function uniqueList(values) {
  return [...new Set(values)];
}
function resolveTemplate(questionnaire) {
  const template = getSetupTemplate(questionnaire.templateId);
  if (!template) {
    throw new Error(`Unknown setup template: ${questionnaire.templateId}`);
  }
  return template;
}
function resolveSetupSummary(projectName, providedSummary, primaryDeliverable, template) {
  const summary = providedSummary?.trim();
  if (summary) {
    return summary;
  }
  return `${projectName} is a ${template.label.toLowerCase()} focused on ${primaryDeliverable.toLowerCase()}.`;
}
function resolveBrief(questionnaire, template) {
  const projectName = questionnaire.projectName.trim();
  const primaryDeliverable = questionnaire.primaryDeliverable.trim() || template.defaultPrimaryDeliverable;
  return {
    projectName,
    summary: resolveSetupSummary(projectName, questionnaire.shortDescription, primaryDeliverable, template),
    primaryDeliverable,
    templateId: questionnaire.templateId,
    preferredStack: uniqueList(normalizeList2(questionnaire.preferredStack).length > 0 ? normalizeList2(questionnaire.preferredStack) : template.suggestedStacks),
    priorities: questionnaire.priorities.length > 0 ? questionnaire.priorities.slice() : template.defaultPriorities.slice(),
    hardConstraints: normalizeList2(questionnaire.hardConstraints),
    existingRepo: questionnaire.existingRepo,
    existingFilesSummary: questionnaire.existingFilesSummary?.trim() || void 0,
    customInstructions: questionnaire.customInstructions?.trim() || void 0
  };
}
function resolvePreferences(brief, template, questionnaire) {
  return {
    preferredStack: brief.preferredStack.length > 0 ? brief.preferredStack : template.suggestedStacks.slice(),
    priorities: brief.priorities.length > 0 ? brief.priorities : template.defaultPriorities.slice(),
    agentMode: questionnaire.agentMode || template.defaultAgentMode,
    hardConstraints: brief.hardConstraints,
    customInstructions: brief.customInstructions,
    existingRepo: brief.existingRepo,
    existingFilesSummary: brief.existingFilesSummary
  };
}
function resolveRoles(template, preferences) {
  const seedRoles = preferences.agentMode === "single-agent" ? template.defaultAgentRoles.slice(0, 1) : template.defaultAgentRoles;
  return seedRoles.map((role) => ({
    key: role.key,
    name: role.name,
    agentKind: role.agentKind,
    responsibilities: role.responsibilities.slice(),
    ownership: role.ownership?.slice() ?? []
  }));
}
function resolveTasks(template, brief, preferences, roles) {
  const tasks = template.defaultTaskBlueprints.map((task) => ({
    key: task.key,
    title: task.title,
    summary: `${task.summary} Target deliverable: ${brief.primaryDeliverable}.`,
    priority: task.priority,
    status: "pending",
    suggestedRoleKey: roles.find((role) => role.key === task.suggestedRoleKey)?.key ?? roles[0]?.key
  }));
  if (preferences.preferredStack.length > 0) {
    tasks.splice(1, 0, {
      key: "stack-choice",
      title: "Lock preferred stack and tools",
      summary: `Confirm the working stack and toolchain: ${preferences.preferredStack.join(", ")}.`,
      priority: "high",
      status: "pending",
      suggestedRoleKey: roles[0]?.key
    });
  }
  if (preferences.priorities.includes("security")) {
    tasks.push({
      key: "security-review",
      title: "Review security and risk constraints",
      summary: "Check the first slice against the requested security constraints before release.",
      priority: "high",
      status: "pending",
      suggestedRoleKey: roles[1]?.key ?? roles[0]?.key
    });
  }
  if (preferences.priorities.includes("cost")) {
    tasks.push({
      key: "cost-review",
      title: "Review cost-sensitive implementation choices",
      summary: "Favor lower-complexity or lower-runtime-cost choices and document tradeoffs.",
      priority: "medium",
      status: "pending",
      suggestedRoleKey: roles[1]?.key ?? roles[0]?.key
    });
  }
  return tasks;
}
function resolveConventions(template, brief, preferences) {
  const conventions = template.defaultConventions.map((convention) => ({
    key: convention.key,
    rule: convention.rule,
    category: convention.category
  }));
  if (preferences.existingRepo) {
    conventions.push({
      key: "existing-repo",
      rule: "Respect the existing repo structure and avoid broad rewrites during setup.",
      category: "workflow"
    });
  }
  if (brief.customInstructions) {
    conventions.push({
      key: "custom-instructions",
      rule: `Honor the custom project instructions: ${brief.customInstructions}`,
      category: "documentation"
    });
  }
  if (preferences.priorities.includes("speed")) {
    conventions.push({
      key: "speed-priority",
      rule: "Prefer the smallest production-worthy slice before expanding scope.",
      category: "workflow"
    });
  }
  return conventions;
}
function resolveDefinitionOfDone(template, brief) {
  const checklist = template.definitionOfDone.slice();
  checklist.unshift(`The primary deliverable is clear: ${brief.primaryDeliverable}.`);
  return uniqueList(checklist);
}
function resolveWorkflow(template, preferences) {
  const workflow = { ...template.workflowPattern };
  if (preferences.agentMode === "single-agent") {
    workflow.summary = `${workflow.summary} Use one lead agent and explicit self-review before handoff or release.`;
  }
  return workflow;
}
function resolveStarterMessages(brief, roles, workflowSummary) {
  if (roles.length < 2) {
    return [];
  }
  return [
    {
      fromRoleKey: roles[0].key,
      toRoleKey: roles[1].key,
      severity: "info",
      content: `Kickoff for ${brief.projectName}: focus on ${brief.primaryDeliverable}. Workflow: ${workflowSummary}`
    }
  ];
}
function resolveStarterHandoffs(brief, roles) {
  if (roles.length < 2) {
    return [];
  }
  return [
    {
      fromRoleKey: roles[0].key,
      toRoleKey: roles[1].key,
      description: `Review the initial setup slice for ${brief.projectName} and tighten the first execution plan.`
    }
  ];
}
function buildBridgeSetupMetadata(brief, preferences, roles, definitionOfDone, workflowSummary, generatedAt) {
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
      responsibilities: role.responsibilities.slice()
    })),
    createdAt: generatedAt
  };
}
function generateProjectPlan(questionnaire) {
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
    workflow
  };
}
function createSetupResult(questionnaireInput) {
  const defaults = createDefaultSetupQuestionnaire(questionnaireInput.templateId);
  const questionnaire = {
    ...defaults,
    ...questionnaireInput,
    projectName: questionnaireInput.projectName.trim(),
    shortDescription: questionnaireInput.shortDescription?.trim() ?? "",
    primaryDeliverable: questionnaireInput.primaryDeliverable?.trim() || defaults.primaryDeliverable,
    preferredStack: normalizeList2(questionnaireInput.preferredStack ?? defaults.preferredStack),
    priorities: questionnaireInput.priorities?.length ? questionnaireInput.priorities.slice() : defaults.priorities.slice(),
    agentMode: questionnaireInput.agentMode ?? defaults.agentMode,
    hardConstraints: normalizeList2(questionnaireInput.hardConstraints ?? defaults.hardConstraints),
    existingRepo: questionnaireInput.existingRepo ?? defaults.existingRepo,
    existingFilesSummary: questionnaireInput.existingFilesSummary?.trim() ?? defaults.existingFilesSummary,
    customInstructions: questionnaireInput.customInstructions?.trim() ?? defaults.customInstructions
  };
  if (!questionnaire.projectName) {
    throw new Error("Project name is required for setup.");
  }
  const template = resolveTemplate(questionnaire);
  const plan = generateProjectPlan(questionnaire);
  const brief = plan.brief;
  const preferences = resolvePreferences(brief, template, questionnaire);
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const setupMetadata = buildBridgeSetupMetadata(
    brief,
    preferences,
    plan.starterAgentRoles,
    plan.definitionOfDone,
    plan.workflow.summary,
    generatedAt
  );
  return {
    template,
    questionnaire,
    brief,
    preferences,
    plan,
    localBridge: {
      projectName: brief.projectName,
      agentKinds: uniqueList(plan.starterAgentRoles.map((role) => role.agentKind)),
      initialize: true,
      setupMetadata
    },
    generatedAt
  };
}

// src/lib/aibridge/setup/service.ts
function listSetupTemplates2() {
  return listSetupTemplates();
}
function createSetupQuestionnaireDefaults(templateId = "web-app") {
  return createDefaultSetupQuestionnaire(templateId);
}
function buildSetupResult(questionnaire) {
  return createSetupResult(questionnaire);
}

// aibridge/setup/local.ts
import path5 from "path";
import { promises as fs4 } from "fs";
function resolveLeadAgentId(agentKinds2) {
  return agentKinds2[0] ?? "cursor";
}
async function initializeLocalBridgeFromSetup(questionnaire, options = {}) {
  const result = createSetupResult(questionnaire);
  const cwd = options.cwd ?? process.cwd();
  if (options.clearExistingData) {
    await fs4.rm(path5.join(cwd, ".aibridge"), { recursive: true, force: true });
  }
  const initResult = await initBridge({
    cwd,
    name: result.localBridge.projectName,
    agents: result.localBridge.agentKinds,
    setup: result.localBridge.setupMetadata
  });
  const rootPath = initResult.rootPath;
  const leadAgentId = resolveLeadAgentId(result.localBridge.agentKinds);
  await setConventions(
    rootPath,
    result.plan.conventions.map((convention, index) => ({
      id: `setup-convention-${index + 1}`,
      rule: convention.rule,
      category: convention.category,
      addedBy: leadAgentId
    }))
  );
  for (const task of result.plan.starterTasks) {
    const role = result.plan.starterAgentRoles.find((candidate) => candidate.key === task.suggestedRoleKey);
    await addTask(rootPath, {
      title: task.title,
      priority: task.priority,
      agentId: role?.agentKind,
      status: "pending"
    });
  }
  for (const message of result.plan.starterMessages) {
    const fromRole = result.plan.starterAgentRoles.find((role) => role.key === message.fromRoleKey);
    const toRole = result.plan.starterAgentRoles.find((role) => role.key === message.toRoleKey);
    await addMessage(rootPath, {
      fromAgentId: fromRole?.agentKind ?? leadAgentId,
      toAgentId: toRole?.agentKind,
      severity: message.severity,
      content: message.content
    });
  }
  for (const handoff of result.plan.starterHandoffs) {
    const fromRole = result.plan.starterAgentRoles.find((role) => role.key === handoff.fromRoleKey);
    const toRole = result.plan.starterAgentRoles.find((role) => role.key === handoff.toRoleKey);
    if (!toRole) {
      continue;
    }
    await createHandoff(rootPath, {
      fromAgentId: fromRole?.agentKind ?? leadAgentId,
      toAgentId: toRole.agentKind,
      description: handoff.description
    });
  }
  await addDecision(rootPath, {
    title: `${result.template.label} setup baseline`,
    summary: `Initialized from the ${result.template.id} template. Definition of done: ${result.plan.definitionOfDone.join("; ")}`,
    status: "accepted",
    agentId: leadAgentId
  });
  const markdown = await regenerateContext(rootPath);
  const status = await getStatusSummary(rootPath);
  return {
    rootPath,
    result,
    initResult,
    status,
    markdown
  };
}

// aibridge/services/local/service.ts
var DEFAULT_HOST = "127.0.0.1";
var DEFAULT_PORT = 4545;
var POLL_INTERVAL_MS = 1500;
var ATTACH_TIMEOUT_MS = 1500;
var LOCAL_SOURCES = ["sample", "workspace", "custom"];
var LOCAL_SERVICE_NAME = "aibridge-local-service";
var LOCAL_SERVICE_API_VERSION = 1;
function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-AiBridge-Role, X-AiBridge-Admin-Token");
}
function sendJson(response, statusCode, payload) {
  setCorsHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}
function sendError(response, error2) {
  if (error2 instanceof BridgeRuntimeError) {
    sendJson(response, error2.code === "BAD_REQUEST" ? 400 : error2.code === "NOT_INITIALIZED" || error2.code === "NOT_FOUND" ? 404 : 422, {
      error: {
        code: error2.code,
        message: error2.message,
        details: error2.details
      }
    });
    return;
  }
  sendJson(response, 500, {
    error: {
      code: "INTERNAL_ERROR",
      message: error2.message
    }
  });
}
async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error2) {
    throw new BridgeRuntimeError("BAD_REQUEST", "Request body must be valid JSON.", {
      reason: error2.message
    });
  }
}
function parseUrl(request) {
  return new URL(request.url ?? "/", "http://127.0.0.1");
}
function normalizeServiceCwd(cwd) {
  return path6.resolve(cwd ?? process.cwd());
}
function normalizeComparisonPath(targetPath) {
  return path6.normalize(targetPath).toLowerCase();
}
function serviceUrl(host, port) {
  return `http://${host}:${port}`;
}
function createServiceHealth(cwd, startedAt) {
  return {
    ok: true,
    service: LOCAL_SERVICE_NAME,
    apiVersion: LOCAL_SERVICE_API_VERSION,
    pid: process.pid,
    cwd,
    startedAt,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function buildRuntimeState(source, rootPath) {
  return {
    mode: "local",
    localSource: source,
    sourceLabel: source === "sample" ? "Sample Bridge" : source === "workspace" ? "Workspace Bridge" : "Custom Bridge",
    rootPath,
    isSample: source === "sample"
  };
}
function parseLocalSource(source, fallback = "workspace") {
  if (!source) {
    return fallback;
  }
  if (!LOCAL_SOURCES.includes(source)) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Invalid local source: ${source}`);
  }
  return source;
}
function configuredAdminToken(options) {
  return options.adminToken?.trim() || process.env.AIBRIDGE_ADMIN_TOKEN?.trim() || void 0;
}
function resolveAccess(request, options) {
  const requestedRoleHeader = request.headers["x-aibridge-role"];
  const requestedRole = typeof requestedRoleHeader === "string" && requestedRoleHeader.trim() === "viewer" ? "viewer" : "admin";
  const providedTokenHeader = request.headers["x-aibridge-admin-token"];
  const adminToken = typeof providedTokenHeader === "string" ? providedTokenHeader.trim() : void 0;
  const expectedAdminToken = configuredAdminToken(options);
  return {
    role: requestedRole,
    adminToken,
    expectedAdminToken
  };
}
function requireAdmin(request, options) {
  const access = resolveAccess(request, options);
  const tokenConfigured = Boolean(access.expectedAdminToken);
  const verified = access.role === "admin" && (!tokenConfigured || access.adminToken === access.expectedAdminToken);
  if (!verified) {
    throw new BridgeRuntimeError("BAD_REQUEST", "Admin access is required for this mutation.", {
      role: access.role,
      adminConfigured: tokenConfigured
    });
  }
  return access;
}
async function resolveRuntime(options, source, customRoot) {
  const cwd = options.cwd ?? process.cwd();
  const localSource = parseLocalSource(source, options.source ?? "workspace");
  const rootPath = await resolveBridgeRoot({
    cwd,
    source: localSource,
    customRoot: customRoot ?? options.customRoot ?? void 0
  });
  return {
    rootPath,
    runtime: buildRuntimeState(localSource, rootPath)
  };
}
async function computeRevision(rootPath) {
  async function walk(directoryPath) {
    const entries = await fs5.readdir(directoryPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path6.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await walk(fullPath));
        continue;
      }
      if (!entry.isFile() || entry.name.endsWith(".tmp")) {
        continue;
      }
      const metadata = await fs5.stat(fullPath);
      files.push({
        path: fullPath,
        mtimeMs: metadata.mtimeMs,
        size: metadata.size
      });
    }
    return files;
  }
  try {
    const files = await walk(rootPath);
    const signature = files.sort((left, right) => left.path.localeCompare(right.path)).map((file) => `${file.path}:${Math.round(file.mtimeMs)}:${file.size}`).join("|");
    return `${files.length}:${signature}`;
  } catch {
    return "missing";
  }
}
function sendSseEvent(response, event) {
  response.write(`event: ${event.event}
`);
  response.write(`data: ${JSON.stringify(event)}

`);
}
async function handleEvents(request, response, options) {
  const url = parseUrl(request);
  const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
  setCorsHeaders(response);
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  let revision = await computeRevision(rootPath);
  sendSseEvent(response, {
    event: "ready",
    revision,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    runtime
  });
  const interval = setInterval(async () => {
    try {
      const nextRevision = await computeRevision(rootPath);
      if (nextRevision === revision) {
        return;
      }
      revision = nextRevision;
      sendSseEvent(response, {
        event: "bridge.changed",
        revision,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        runtime
      });
    } catch {
    }
  }, options.pollIntervalMs ?? POLL_INTERVAL_MS);
  const close = () => {
    clearInterval(interval);
    if (!response.writableEnded) {
      response.end();
    }
  };
  request.on("close", close);
  response.on("close", close);
}
function numberParam(value) {
  if (!value) {
    return void 0;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BridgeRuntimeError("BAD_REQUEST", `Invalid numeric query parameter: ${value}`);
  }
  return parsed;
}
function withStatusEnvelope(data, status, runtime, revision) {
  return {
    data,
    status,
    runtime,
    revision
  };
}
function parseDecisionStatusParam(value) {
  return value ? parseDecisionStatus(value) : void 0;
}
function parseConventionCategoryParam(value) {
  return typeof value === "string" ? parseConventionCategory(value) : void 0;
}
function parseSeverityParam(value) {
  return value ? parseMessageSeverity(value) : void 0;
}
async function handleRequest(request, response, options) {
  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.statusCode = 204;
    response.end();
    return;
  }
  const url = parseUrl(request);
  const serviceCwd = normalizeServiceCwd(options.cwd);
  const serviceStartedAt = options.startedAt ?? (/* @__PURE__ */ new Date()).toISOString();
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, createServiceHealth(serviceCwd, serviceStartedAt));
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/events") {
    await handleEvents(request, response, options);
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/status") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, {
      data: status,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/capture/status") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const capture = await getCaptureStatus({ cwd: path6.dirname(rootPath) });
    sendJson(response, 200, {
      data: capture,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/agents/sessions") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const sessions = await listAgentSessions(rootPath, {
      agentId: url.searchParams.get("agent") ?? void 0,
      toolKind: parseAgentToolKind(url.searchParams.get("tool")),
      status: parseAgentSessionStatus(url.searchParams.get("status"))
    });
    sendJson(response, 200, {
      data: sessions,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/agents/launch") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const session = await launchAgentSession(rootPath, {
      agentId: String(body.agentId ?? "").trim(),
      toolKind: parseAgentToolKind(typeof body.toolKind === "string" ? body.toolKind : void 0) ?? "cursor",
      launchSource: parseAgentLaunchSource(typeof body.launchSource === "string" ? body.launchSource : void 0)
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, withStatusEnvelope(session, status, runtime, await computeRevision(rootPath)));
    return;
  }
  const sessionMutationMatch = url.pathname.match(/^\/bridge\/agents\/sessions\/([^/]+)\/(start|heartbeat|stop|recovery)$/);
  if (sessionMutationMatch) {
    const [, sessionId, action] = sessionMutationMatch;
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const { rootPath, runtime } = await resolveRuntime(
      options,
      request.method === "GET" ? url.searchParams.get("source") : body.source,
      request.method === "GET" ? url.searchParams.get("root") : body.rootPath
    );
    let data;
    if (request.method === "POST" && action === "start") {
      data = await startAgentSession(rootPath, sessionId);
    } else if (request.method === "POST" && action === "heartbeat") {
      data = await heartbeatAgentSession(rootPath, sessionId);
    } else if (request.method === "POST" && action === "stop") {
      data = await stopAgentSession(rootPath, sessionId, {
        reason: typeof body.reason === "string" ? body.reason : void 0
      });
    } else if (request.method === "GET" && action === "recovery") {
      data = await getAgentSessionRecovery(rootPath, sessionId);
    } else {
      throw new BridgeRuntimeError("BAD_REQUEST", `Unsupported session action: ${action}`);
    }
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope(data, status, runtime, await computeRevision(rootPath)));
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/setup/templates") {
    sendJson(response, 200, {
      data: {
        templates: listSetupTemplates2(),
        defaults: createSetupQuestionnaireDefaults()
      }
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/setup/plan") {
    const body = await readJsonBody(request);
    const result = buildSetupResult({
      projectName: String(body.projectName ?? "").trim(),
      shortDescription: String(body.shortDescription ?? "").trim(),
      templateId: body.templateId,
      primaryDeliverable: typeof body.primaryDeliverable === "string" ? body.primaryDeliverable : void 0,
      preferredStack: Array.isArray(body.preferredStack) ? body.preferredStack.map((value) => String(value)) : void 0,
      priorities: Array.isArray(body.priorities) ? body.priorities : void 0,
      agentMode: body.agentMode,
      hardConstraints: Array.isArray(body.hardConstraints) ? body.hardConstraints.map((value) => String(value)) : void 0,
      existingRepo: Boolean(body.existingRepo),
      existingFilesSummary: typeof body.existingFilesSummary === "string" ? body.existingFilesSummary : void 0,
      customInstructions: typeof body.customInstructions === "string" ? body.customInstructions : void 0
    });
    sendJson(response, 200, {
      data: {
        template: result.template,
        questionnaire: result.questionnaire,
        plan: result.plan,
        result
      }
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/setup/init") {
    const body = await readJsonBody(request);
    const initialized = await initializeLocalBridgeFromSetup(
      {
        projectName: String(body.projectName ?? "").trim(),
        shortDescription: String(body.shortDescription ?? "").trim(),
        templateId: body.templateId,
        primaryDeliverable: typeof body.primaryDeliverable === "string" ? body.primaryDeliverable : void 0,
        preferredStack: Array.isArray(body.preferredStack) ? body.preferredStack.map((value) => String(value)) : void 0,
        priorities: Array.isArray(body.priorities) ? body.priorities : void 0,
        agentMode: body.agentMode,
        hardConstraints: Array.isArray(body.hardConstraints) ? body.hardConstraints.map((value) => String(value)) : void 0,
        existingRepo: Boolean(body.existingRepo),
        existingFilesSummary: typeof body.existingFilesSummary === "string" ? body.existingFilesSummary : void 0,
        customInstructions: typeof body.customInstructions === "string" ? body.customInstructions : void 0
      },
      {
        cwd: typeof body.cwd === "string" ? body.cwd : options.cwd,
        clearExistingData: Boolean(body.clearExistingData)
      }
    );
    const runtime = buildRuntimeState("workspace", initialized.rootPath);
    sendJson(response, 201, {
      data: {
        rootPath: initialized.rootPath,
        result: initialized.result,
        markdown: initialized.markdown
      },
      status: initialized.status,
      runtime,
      revision: await computeRevision(initialized.rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/context/generate") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const markdown = await regenerateContext(rootPath, typeof body.budget === "number" ? body.budget : void 0);
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope({ markdown }, status, runtime, await computeRevision(rootPath)));
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/tasks") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const tasks = await listTasks(rootPath, {
      status: url.searchParams.get("status") ? parseTaskStatus(url.searchParams.get("status")) : void 0,
      agentId: url.searchParams.get("agent") ?? void 0
    });
    sendJson(response, 200, {
      data: tasks,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/tasks") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const task = await addTask(rootPath, {
      title: String(body.title ?? "").trim(),
      status: typeof body.status === "string" ? parseTaskStatus(body.status) : void 0,
      priority: parsePriority(typeof body.priority === "string" ? body.priority : void 0),
      agentId: typeof body.agentId === "string" ? body.agentId : void 0
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, {
      data: task,
      status,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  const taskMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/tasks\/([^/]+)$/) : null;
  if (taskMatch) {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const task = await updateTask(rootPath, taskMatch[1], {
      title: typeof body.title === "string" ? body.title : void 0,
      status: typeof body.status === "string" ? parseTaskStatus(body.status) : void 0,
      priority: typeof body.priority === "string" ? parsePriority(body.priority) : void 0,
      agentId: typeof body.agentId === "string" ? body.agentId : void 0
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, {
      data: task,
      status,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/messages") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const messages = await listMessages(rootPath, {
      toAgentId: url.searchParams.get("to") ?? void 0,
      severity: parseSeverityParam(url.searchParams.get("severity")),
      unreadOnly: url.searchParams.get("unread") === "true",
      limit: numberParam(url.searchParams.get("limit"))
    });
    sendJson(response, 200, {
      data: messages,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/messages") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const message = await addMessage(rootPath, {
      fromAgentId: String(body.fromAgentId ?? "").trim(),
      toAgentId: typeof body.toAgentId === "string" ? body.toAgentId : void 0,
      severity: typeof body.severity === "string" ? parseMessageSeverity(body.severity) : void 0,
      content: String(body.content ?? "").trim()
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, {
      data: message,
      status,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  const messageMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/messages\/([^/]+)\/ack$/) : null;
  if (messageMatch) {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const message = await acknowledgeMessage(rootPath, messageMatch[1]);
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, {
      data: message,
      status,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/handoffs") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const handoffs = await listHandoffs(rootPath, {
      agentId: url.searchParams.get("agent") ?? void 0
    });
    sendJson(response, 200, {
      data: handoffs,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/handoffs") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const handoff = await createHandoff(rootPath, {
      fromAgentId: String(body.fromAgentId ?? "").trim(),
      toAgentId: String(body.toAgentId ?? "").trim(),
      description: String(body.description ?? "").trim(),
      relatedTaskIds: Array.isArray(body.relatedTaskIds) ? body.relatedTaskIds.map((value) => String(value)) : void 0
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, {
      data: handoff,
      status,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/releases") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const releases = await listReleases(rootPath, {
      status: url.searchParams.get("status") ? parseReleaseStatus(url.searchParams.get("status")) : void 0,
      includeArchived: url.searchParams.get("includeArchived") === "true",
      access: resolveAccess(request, options)
    });
    sendJson(response, 200, {
      data: releases,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/releases") {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const release = await addRelease(rootPath, {
      version: String(body.version ?? "").trim(),
      title: String(body.title ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      status: typeof body.status === "string" ? parseReleaseStatus(body.status) : void 0,
      highlights: Array.isArray(body.highlights) ? body.highlights.map((value) => String(value)) : void 0,
      breakingChanges: Array.isArray(body.breakingChanges) ? body.breakingChanges.map((value) => String(value)) : void 0,
      upgradeNotes: Array.isArray(body.upgradeNotes) ? body.upgradeNotes.map((value) => String(value)) : void 0,
      tags: Array.isArray(body.tags) ? body.tags.map((value) => String(value)) : void 0,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : void 0
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(response, 201, withStatusEnvelope(release, status, runtime, await computeRevision(rootPath)));
    return;
  }
  const releaseMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/releases\/([^/]+)$/) : null;
  if (releaseMatch) {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const release = await updateRelease(rootPath, releaseMatch[1], {
      version: typeof body.version === "string" ? body.version : void 0,
      title: typeof body.title === "string" ? body.title : void 0,
      summary: typeof body.summary === "string" ? body.summary : void 0,
      status: typeof body.status === "string" ? parseReleaseStatus(body.status) : void 0,
      highlights: Array.isArray(body.highlights) ? body.highlights.map((value) => String(value)) : void 0,
      breakingChanges: Array.isArray(body.breakingChanges) ? body.breakingChanges.map((value) => String(value)) : void 0,
      upgradeNotes: Array.isArray(body.upgradeNotes) ? body.upgradeNotes.map((value) => String(value)) : void 0,
      tags: Array.isArray(body.tags) ? body.tags.map((value) => String(value)) : void 0,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : void 0
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(response, 200, withStatusEnvelope(release, status, runtime, await computeRevision(rootPath)));
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/announcements") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const announcements = await listAnnouncements(rootPath, {
      status: url.searchParams.get("status") ? parseAnnouncementStatus(url.searchParams.get("status")) : void 0,
      includeArchived: url.searchParams.get("includeArchived") === "true",
      access: resolveAccess(request, options)
    });
    sendJson(response, 200, {
      data: announcements,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/announcements") {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const announcement = await addAnnouncement(rootPath, {
      title: String(body.title ?? "").trim(),
      body: String(body.body ?? "").trim(),
      status: typeof body.status === "string" ? parseAnnouncementStatus(body.status) : void 0,
      audience: typeof body.audience === "string" ? parseAnnouncementAudience(body.audience) : void 0,
      severity: typeof body.severity === "string" ? parseAnnouncementSeverity(body.severity) : void 0,
      publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : void 0,
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : void 0,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : void 0
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(
      response,
      201,
      withStatusEnvelope(announcement, status, runtime, await computeRevision(rootPath))
    );
    return;
  }
  const announcementMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/announcements\/([^/]+)$/) : null;
  if (announcementMatch) {
    const access = requireAdmin(request, options);
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const announcement = await updateAnnouncement(rootPath, announcementMatch[1], {
      title: typeof body.title === "string" ? body.title : void 0,
      body: typeof body.body === "string" ? body.body : void 0,
      status: typeof body.status === "string" ? parseAnnouncementStatus(body.status) : void 0,
      audience: typeof body.audience === "string" ? parseAnnouncementAudience(body.audience) : void 0,
      severity: typeof body.severity === "string" ? parseAnnouncementSeverity(body.severity) : void 0,
      publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : void 0,
      expiresAt: body.expiresAt === null ? null : typeof body.expiresAt === "string" ? body.expiresAt : void 0,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : void 0
    });
    const status = await getStatusSummary(rootPath, access);
    sendJson(
      response,
      200,
      withStatusEnvelope(announcement, status, runtime, await computeRevision(rootPath))
    );
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/decisions") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const decisions = await listDecisions(rootPath, {
      status: parseDecisionStatusParam(url.searchParams.get("status"))
    });
    sendJson(response, 200, {
      data: decisions,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/decisions") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const decision = await addDecision(rootPath, {
      title: String(body.title ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      status: typeof body.status === "string" ? parseDecisionStatus(body.status) : void 0,
      agentId: typeof body.agentId === "string" ? body.agentId : void 0
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, withStatusEnvelope(decision, status, runtime, await computeRevision(rootPath)));
    return;
  }
  const decisionMatch = request.method === "PATCH" ? url.pathname.match(/^\/bridge\/decisions\/([^/]+)$/) : null;
  if (decisionMatch) {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const decision = await updateDecisionStatus(
      rootPath,
      decisionMatch[1],
      parseDecisionStatus(String(body.status ?? "")),
      typeof body.agentId === "string" ? body.agentId : void 0
    );
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 200, withStatusEnvelope(decision, status, runtime, await computeRevision(rootPath)));
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/conventions") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    if (url.searchParams.get("format") === "markdown") {
      const markdown = await showConventionsMarkdown(rootPath);
      const status = await getStatusSummary(rootPath, resolveAccess(request, options));
      sendJson(response, 200, withStatusEnvelope({ markdown }, status, runtime, await computeRevision(rootPath)));
      return;
    }
    const conventions = await listConventions(rootPath);
    sendJson(response, 200, {
      data: conventions,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/conventions") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const convention = await addConvention(rootPath, {
      rule: String(body.rule ?? "").trim(),
      addedBy: typeof body.addedBy === "string" ? body.addedBy : void 0,
      category: parseConventionCategoryParam(body.category)
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(
      response,
      201,
      withStatusEnvelope(convention, status, runtime, await computeRevision(rootPath))
    );
    return;
  }
  if (request.method === "GET" && url.pathname === "/bridge/logs") {
    const { rootPath, runtime } = await resolveRuntime(options, url.searchParams.get("source"), url.searchParams.get("root"));
    const logs = await listLogs(rootPath, {
      agentId: url.searchParams.get("agent") ?? void 0,
      limit: numberParam(url.searchParams.get("limit"))
    });
    sendJson(response, 200, {
      data: logs,
      runtime,
      revision: await computeRevision(rootPath)
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/bridge/logs") {
    const body = await readJsonBody(request);
    const { rootPath, runtime } = await resolveRuntime(options, body.source, body.rootPath);
    const log = await addLog(rootPath, {
      agentId: String(body.agentId ?? "").trim(),
      action: String(body.action ?? "").trim(),
      description: String(body.description ?? "").trim(),
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : void 0
    });
    const status = await getStatusSummary(rootPath, resolveAccess(request, options));
    sendJson(response, 201, withStatusEnvelope(log, status, runtime, await computeRevision(rootPath)));
    return;
  }
  sendJson(response, 404, {
    error: {
      code: "NOT_FOUND",
      message: "Unknown local bridge route."
    }
  });
}
function createLocalBridgeHttpServer(options = {}) {
  const serviceOptions = {
    ...options,
    cwd: normalizeServiceCwd(options.cwd),
    startedAt: options.startedAt ?? (/* @__PURE__ */ new Date()).toISOString()
  };
  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, serviceOptions);
    } catch (error2) {
      sendError(response, error2);
    }
  });
}
var runningServicePromise = null;
var runningServiceKey = null;
function buildRunningServiceKey(options) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const cwd = normalizeServiceCwd(options.cwd);
  return `${host}:${port}:${cwd}`;
}
async function readAttachedServiceHealth(host, port) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATTACH_TIMEOUT_MS);
  try {
    const response = await fetch(`${serviceUrl(host, port)}/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `Port ${port} is already in use, but the process did not return a healthy AiBridge response.`,
        {
          host,
          port,
          status: response.status
        }
      );
    }
    const payload = await response.json();
    if (payload.ok !== true || payload.service !== LOCAL_SERVICE_NAME) {
      throw new BridgeRuntimeError("BAD_REQUEST", `Port ${port} is already in use by a non-AiBridge process.`, {
        host,
        port,
        payload
      });
    }
    if (payload.apiVersion !== LOCAL_SERVICE_API_VERSION) {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `Port ${port} is already in use by an incompatible AiBridge local service.`,
        {
          host,
          port,
          expectedApiVersion: LOCAL_SERVICE_API_VERSION,
          actualApiVersion: payload.apiVersion
        }
      );
    }
    if (!payload.cwd) {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `Port ${port} is already in use by an AiBridge service without workspace identity.`,
        {
          host,
          port,
          payload
        }
      );
    }
    return payload;
  } catch (error2) {
    if (error2 instanceof BridgeRuntimeError) {
      throw error2;
    }
    throw new BridgeRuntimeError(
      "BAD_REQUEST",
      `Port ${port} is already in use, but the existing process could not be verified as AiBridge.`,
      {
        host,
        port,
        reason: error2.message
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
async function verifyExistingService(options, host, port) {
  const expectedCwd = normalizeServiceCwd(options.cwd);
  const health = await readAttachedServiceHealth(host, port);
  if (normalizeComparisonPath(health.cwd) !== normalizeComparisonPath(expectedCwd)) {
    throw new BridgeRuntimeError(
      "BAD_REQUEST",
      `Port ${port} is already in use by an AiBridge service for a different workspace.`,
      {
        host,
        port,
        expectedCwd,
        actualCwd: health.cwd
      }
    );
  }
  return health;
}
function withManagedClose(service, serviceKey) {
  const originalClose = service.close;
  return {
    ...service,
    close: async () => {
      try {
        await originalClose();
      } finally {
        if (runningServiceKey === serviceKey) {
          runningServicePromise = null;
          runningServiceKey = null;
        }
      }
    }
  };
}
async function startLocalBridgeService(options = {}) {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const cwd = normalizeServiceCwd(options.cwd);
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const server = createLocalBridgeHttpServer({
    ...options,
    cwd,
    startedAt
  });
  const serviceKey = buildRunningServiceKey({
    ...options,
    cwd,
    host,
    port
  });
  const started = await new Promise((resolve, reject) => {
    server.once("error", (error2) => {
      void (async () => {
        if (error2.code === "EADDRINUSE") {
          try {
            const identity = await verifyExistingService({ ...options, cwd }, host, port);
            server.close();
            resolve({
              url: serviceUrl(host, port),
              host,
              port,
              ownsServer: false,
              identity,
              server,
              close: async () => {
              }
            });
          } catch (verificationError) {
            reject(verificationError);
          }
          return;
        }
        reject(error2);
      })();
    });
    server.listen(port, host, () => {
      resolve({
        url: serviceUrl(host, port),
        host,
        port,
        ownsServer: true,
        identity: createServiceHealth(cwd, startedAt),
        server,
        close: async () => await new Promise((closeResolve, closeReject) => {
          server.close((error2) => {
            if (error2) {
              closeReject(error2);
              return;
            }
            closeResolve();
          });
        })
      });
    });
  });
  return withManagedClose(started, serviceKey);
}

// aibridge/cli/src/style.ts
import chalk from "chalk";
var useColor = process.stdout?.isTTY === true;
var ansiPattern = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");
function noop(s) {
  return s;
}
function stripAnsi(value) {
  return value.replace(ansiPattern, "");
}
function visibleLength(value) {
  return stripAnsi(value).length;
}
var dim = useColor ? chalk.dim : noop;
var bold = useColor ? chalk.bold : noop;
var success = useColor ? chalk.green : noop;
var error = useColor ? chalk.red : noop;
var warning = useColor ? chalk.yellow : noop;
var info = useColor ? chalk.cyan : noop;
var muted = useColor ? chalk.gray : noop;
var label = useColor ? chalk.dim : noop;
var id = useColor ? chalk.magenta : noop;
var brandCyan = useColor ? chalk.hex("#52e3ff") : noop;
var brandMint = useColor ? chalk.hex("#2ce6a6") : noop;
var brandAmber = useColor ? chalk.hex("#f5c451") : noop;
var brandSurface = useColor ? chalk.hex("#8aa0a6") : noop;
var headline = useColor ? (s) => `${brandMint("\u25E2")} ${chalk.bold(brandCyan(s))}` : (s) => `AiBridge ${s}`;
function section(title) {
  return useColor ? `${brandSurface("\u2500")} ${chalk.bold(brandMint(title))}` : `${title}:`;
}
function commandText(value) {
  return useColor ? chalk.bold(brandCyan(value)) : value;
}
function note(symbol, text) {
  return useColor ? `${brandMint(symbol)} ${text}` : `${symbol} ${text}`;
}
function successLine(text) {
  return useColor ? `${brandMint("\u2713")} ${success(text)}` : `OK ${text}`;
}
function errorLine(text) {
  return useColor ? `${chalk.red("\u2715")} ${error(text)}` : `ERROR ${text}`;
}
function infoLine(text) {
  return useColor ? `${brandCyan("\u2022")} ${info(text)}` : `INFO ${text}`;
}
function kv(labelText, value) {
  return `${label(labelText)}${value}`;
}
function panel(title, body) {
  if (!useColor) {
    return `${title}
${body}`;
  }
  const lines = body.replace(/\n$/, "").split("\n");
  const terminalWidth = process.stdout?.columns ?? 96;
  const maxWidth = Math.max(48, Math.min(96, terminalWidth - 2));
  const contentWidth = Math.max(visibleLength(title) + 4, ...lines.map((line) => visibleLength(line))) + 4;
  if (contentWidth > maxWidth) {
    return `${title}
${body}`;
  }
  const width = contentWidth;
  const top = `${brandSurface("\u256D")}${brandSurface("\u2500".repeat(Math.max(1, width - 2)))}${brandSurface("\u256E")}`;
  const bottom = `${brandSurface("\u2570")}${brandSurface("\u2500".repeat(Math.max(1, width - 2)))}${brandSurface("\u256F")}`;
  const styledTitle = chalk.bold(brandMint(title));
  const titlePadding = Math.max(0, width - visibleLength(styledTitle) - 3);
  const titleRow = `${brandSurface("\u2502")} ${styledTitle}${" ".repeat(titlePadding)}${brandSurface("\u2502")}`;
  const contentRows = lines.map((line) => {
    const padding = Math.max(0, width - visibleLength(line) - 3);
    return `${brandSurface("\u2502")} ${line}${" ".repeat(padding)}${brandSurface("\u2502")}`;
  });
  return [top, titleRow, ...contentRows, bottom].join("\n") + "\n";
}
function truncateText(value, maxLength = 52) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}
function errorPanel(title, message, details) {
  const body = [errorLine(message), details ? muted(details) : void 0].filter(Boolean).join("\n");
  return panel(title, body);
}
function statusBadge(value) {
  if (!useColor) return value;
  const lower = value.toLowerCase();
  if (["done", "published", "accepted", "yes", "running", "connected"].includes(lower)) return brandMint(value);
  if (["in_progress", "pending", "draft", "proposed"].includes(lower)) return brandAmber(value);
  if (["critical", "fail", "superseded", "archived", "stopped"].includes(lower)) return chalk.red(value);
  if (["warning"].includes(lower)) return brandAmber(value);
  if (["info"].includes(lower)) return brandCyan(value);
  return brandSurface(value);
}
function table(headers, rows, options) {
  const colWidths = headers.map((h, i) => {
    const maxContent = Math.max(
      visibleLength(headers[i]),
      ...rows.map((r) => visibleLength(r[i] ?? ""))
    );
    return Math.min(maxContent + 2, 40);
  });
  const pad = (s, i) => {
    const target = colWidths[i] ?? visibleLength(s);
    const padding = Math.max(0, target - visibleLength(s));
    return s + " ".repeat(padding);
  };
  const headerRow = headers.map((h, i) => pad(bold(h), i)).join("");
  const separator = muted(headers.map((_, i) => "\u2500".repeat(Math.min(colWidths[i] ?? 0, 36))).join(""));
  const dataRows = rows.map(
    (row) => row.map((cell, i) => {
      const styled = options?.statusColumnIndex === i ? statusBadge(cell) : cell;
      return pad(styled, i);
    }).join("")
  );
  return [headerRow, separator, ...dataRows].join("\n") + "\n";
}

// aibridge/cli/src/main.ts
function parseArgs(args) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const inlineEqualsIndex = token.indexOf("=");
    if (inlineEqualsIndex !== -1) {
      flags[token.slice(2, inlineEqualsIndex)] = token.slice(inlineEqualsIndex + 1);
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { positionals, flags };
}
function flagString(flags, name) {
  const value = flags[name];
  return typeof value === "string" ? value : void 0;
}
function flagBoolean(flags, name) {
  return flags[name] === true;
}
function requireValue(value, message) {
  if (!value?.trim()) {
    throw new BridgeRuntimeError("BAD_REQUEST", message);
  }
  return value.trim();
}
function parseNumberFlag(flags, name) {
  const value = flagString(flags, name);
  if (!value) {
    return void 0;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BridgeRuntimeError("BAD_REQUEST", `\`--${name}\` must be a number.`);
  }
  return parsed;
}
function parseListFlag(flags, name) {
  const value = flagString(flags, name);
  if (!value) {
    return void 0;
  }
  return value.split(/[,\s]+/).map((entry) => entry.trim()).filter(Boolean);
}
function parsePriorityList(flags) {
  const values = parseListFlag(flags, "priority") ?? parseListFlag(flags, "priorities");
  return values;
}
function parseTemplateFlag(flags) {
  return flagString(flags, "template");
}
function defaultSetupProjectName() {
  return path7.basename(process.cwd()) || "aibridge-project";
}
function resolveAgentFlag(flags) {
  return flagString(flags, "from") ?? flagString(flags, "agent") ?? process.env.AIBRIDGE_AGENT?.trim();
}
function toJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function usesSetupFlow(flags) {
  return Boolean(
    flagString(flags, "template") || flagString(flags, "description") || flagString(flags, "deliverable") || flagString(flags, "stack") || flagString(flags, "priorities") || flagString(flags, "priority") || flagString(flags, "instructions") || flagString(flags, "constraint") || flagString(flags, "constraints") || flagBoolean(flags, "interactive") || flagBoolean(flags, "single-agent") || flagBoolean(flags, "multi-agent") || flagBoolean(flags, "existing-repo")
  );
}
function resolveAgentMode(flags, fallback) {
  if (flagBoolean(flags, "single-agent")) {
    return "single-agent";
  }
  if (flagBoolean(flags, "multi-agent")) {
    return "multi-agent";
  }
  return fallback;
}
function buildSetupQuestionnaireFromFlags(flags) {
  const templateId = parseTemplateFlag(flags) ?? "web-app";
  const defaults = createSetupQuestionnaireDefaults(templateId);
  return {
    templateId,
    shortDescription: flagString(flags, "description") ?? defaults.shortDescription,
    primaryDeliverable: flagString(flags, "deliverable") ?? defaults.primaryDeliverable,
    preferredStack: parseListFlag(flags, "stack") ?? defaults.preferredStack,
    priorities: parsePriorityList(flags) ?? defaults.priorities,
    agentMode: resolveAgentMode(flags, defaults.agentMode) ?? defaults.agentMode,
    hardConstraints: parseListFlag(flags, "constraint") ?? parseListFlag(flags, "constraints") ?? defaults.hardConstraints,
    existingRepo: flagBoolean(flags, "existing-repo") || defaults.existingRepo,
    existingFilesSummary: flagString(flags, "existing-files") ?? defaults.existingFilesSummary,
    customInstructions: flagString(flags, "instructions") ?? defaults.customInstructions
  };
}
async function collectInteractiveSetupQuestionnaire(flags) {
  const templateId = parseTemplateFlag(flags) ?? "web-app";
  const defaults = createSetupQuestionnaireDefaults(templateId);
  const cli = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = async (prompt, fallback) => {
    const suffix = fallback ? ` [${fallback}]` : "";
    const answer = (await cli.question(`${prompt}${suffix}: `)).trim();
    return answer || fallback || "";
  };
  try {
    const projectName = await ask("Project name", flagString(flags, "name") ?? defaultSetupProjectName());
    const shortDescription = await ask("Short description / goal", flagString(flags, "description"));
    const chosenTemplate = await ask("Template", templateId);
    const templateDefaults = createSetupQuestionnaireDefaults(chosenTemplate);
    const primaryDeliverable = await ask("Primary deliverable", flagString(flags, "deliverable") ?? templateDefaults.primaryDeliverable);
    const preferredStack = (await ask("Preferred stack (comma-separated)", (parseListFlag(flags, "stack") ?? templateDefaults.preferredStack).join(","))).split(",").map((value) => value.trim()).filter(Boolean);
    const priorities2 = (await ask("Priorities (comma-separated)", (parsePriorityList(flags) ?? templateDefaults.priorities).join(","))).split(",").map((value) => value.trim()).filter(Boolean);
    const agentMode = await ask("Agent mode", resolveAgentMode(flags, templateDefaults.agentMode) ?? templateDefaults.agentMode);
    const hardConstraints = (await ask("Hard constraints (comma-separated)", (parseListFlag(flags, "constraint") ?? templateDefaults.hardConstraints).join(","))).split(",").map((value) => value.trim()).filter(Boolean);
    const existingRepoAnswer = (await ask("Existing repo/files? (yes/no)", flagBoolean(flags, "existing-repo") ? "yes" : "no")).toLowerCase();
    const existingFilesSummary = existingRepoAnswer.startsWith("y") ? await ask("Existing repo/files summary", flagString(flags, "existing-files")) : "";
    const customInstructions = await ask("Custom instructions", flagString(flags, "instructions"));
    return {
      projectName,
      shortDescription,
      templateId: chosenTemplate,
      primaryDeliverable,
      preferredStack,
      priorities: priorities2,
      agentMode,
      hardConstraints,
      existingRepo: existingRepoAnswer.startsWith("y"),
      existingFilesSummary,
      customInstructions
    };
  } finally {
    cli.close();
  }
}
function renderSetupPlan(result) {
  const lines = [
    kv("Project      ", result.brief.projectName),
    kv("Template     ", `${result.template.label} (${result.template.id})`),
    kv("Goal         ", result.brief.summary),
    kv("Deliverable  ", result.brief.primaryDeliverable),
    kv("Stack        ", result.brief.preferredStack.join(", ") || dim("(not specified)")),
    kv("Priorities   ", result.brief.priorities.join(", ") || dim("(not specified)")),
    kv("Agent mode   ", result.preferences.agentMode),
    "",
    bold("Starter Roles")
  ];
  result.plan.starterAgentRoles.forEach((role) => {
    lines.push(note("\u2022", `${role.name}${dim(` [${role.agentKind}]`)}`));
  });
  lines.push("", bold("Starter Tasks"));
  result.plan.starterTasks.forEach((task) => {
    lines.push(note("\u2022", `${task.title}${dim(` (${task.priority})`)}`));
  });
  lines.push("", bold("Starter Conventions"));
  result.plan.conventions.forEach((convention) => {
    lines.push(note("\u2022", convention.rule));
  });
  lines.push("", bold("Definition of Done"));
  result.plan.definitionOfDone.forEach((item) => {
    lines.push(note("\u2022", item));
  });
  return panel("Setup Plan", lines.join("\n"));
}
function renderTaskTable(tasks) {
  if (tasks.length === 0) {
    return muted("No tasks found.") + "\n";
  }
  const headers = ["ID", "STATUS", "PRIORITY", "AGENT", "TITLE"];
  const rows = tasks.map((t) => [t.id, t.status, t.priority, t.agentId ?? "-", truncateText(t.title)]);
  return table(headers, rows, { statusColumnIndex: 1 });
}
function renderMessageTable(messages) {
  if (messages.length === 0) {
    return muted("No messages found.") + "\n";
  }
  const headers = ["ID", "FROM", "TO", "SEVERITY", "ACK", "CONTENT"];
  const rows = messages.map((m) => [
    m.id,
    m.fromAgentId,
    m.toAgentId ?? "all",
    m.severity,
    m.acknowledged ? "yes" : "no",
    truncateText(m.content, 56)
  ]);
  return table(headers, rows, { statusColumnIndex: 3 });
}
function renderHandoffTable(handoffs) {
  if (handoffs.length === 0) {
    return muted("No handoffs found.") + "\n";
  }
  const headers = ["ID", "FROM", "TO", "TIME", "DESCRIPTION"];
  const rows = handoffs.map((h) => [h.id, h.fromAgentId, h.toAgentId, h.timestamp, truncateText(h.description, 56)]);
  return table(headers, rows);
}
function renderDecisionTable(decisions) {
  if (decisions.length === 0) {
    return muted("No decisions found.") + "\n";
  }
  const headers = ["ID", "STATUS", "TIME", "TITLE"];
  const rows = decisions.map((d) => [d.id, d.status ?? "proposed", d.timestamp, truncateText(d.title)]);
  return table(headers, rows, { statusColumnIndex: 1 });
}
function renderConventionTable(conventions) {
  if (conventions.length === 0) {
    return muted("No conventions found.") + "\n";
  }
  const headers = ["ID", "CATEGORY", "ADDED_AT", "RULE"];
  const rows = conventions.map((c) => [c.id, c.category ?? "other", c.addedAt, truncateText(c.rule, 64)]);
  return table(headers, rows);
}
function renderLogTable(logs) {
  if (logs.length === 0) {
    return muted("No log entries found.") + "\n";
  }
  const headers = ["ID", "TIME", "AGENT", "ACTION", "DESCRIPTION"];
  const rows = logs.map((e) => [e.id, e.timestamp, e.agentId, e.action, truncateText(e.description, 56)]);
  return table(headers, rows);
}
function renderAgentSessionTable(sessions) {
  if (sessions.length === 0) {
    return muted("No tracked agent sessions.") + "\n";
  }
  const headers = ["ID", "AGENT", "TOOL", "STATUS", "LAUNCHED", "NOTE"];
  const rows = sessions.map((session) => [
    session.id,
    session.agentId,
    session.toolKind,
    session.status,
    session.launchedAt,
    truncateText(session.recovery?.reason ?? "-", 56)
  ]);
  return table(headers, rows, { statusColumnIndex: 3 });
}
function formatTimestampForStatus(timestamp) {
  return timestamp.replace("T", " ").replace("Z", "Z");
}
function formatStatusTextStyled(status) {
  const criticalUnread = status.messages.filter((m) => !m.acknowledged && m.severity === "critical").length;
  const unread = status.messages.filter((m) => !m.acknowledged).length;
  const recentActivity = status.logs.slice(0, 5);
  const lines = [
    kv("Project      ", status.context.projectName),
    kv("Repo         ", status.context.repoPath),
    kv("Last sync    ", formatTimestampForStatus(status.context.lastSyncAt)),
    "",
    kv(
      "Tasks        ",
      `${status.context.taskCounts.pending} pending \xB7 ${status.context.taskCounts.in_progress} in progress \xB7 ${status.context.taskCounts.done} done`
    ),
    kv(
      "Messages     ",
      (unread > 0 ? info(`${unread} unread`) : muted("0 unread")) + (criticalUnread > 0 ? " " + error(`(${criticalUnread} critical)`) : "")
    ),
    kv("Handoffs     ", `${status.handoffs.length} open`),
    kv(
      "Agent sessions",
      status.sessions.length > 0 ? `${status.sessions.filter((session) => session.status === "active").length} active \xB7 ${status.sessions.filter((session) => session.status === "stale").length} stale` : muted("none")
    ),
    "",
    bold("Recent Activity")
  ];
  if (recentActivity.length === 0) {
    lines.push(dim("  (none)"));
  } else {
    recentActivity.forEach((entry) => {
      lines.push(dim(`  [${entry.timestamp.slice(11, 16)}]`) + ` ${entry.agentId} - ${entry.action}: ${entry.description}`);
    });
  }
  return panel("Bridge Status", lines.join("\n"));
}
function renderCaptureStatusStyled(status) {
  const lines = [
    kv("Watcher      ", statusBadge(status.watcher.running ? "running" : "stopped")),
    kv("Hooks        ", status.hooksInstalled.length > 0 ? status.hooksInstalled.join(", ") : dim("(none)")),
    kv("Warnings     ", String(status.validationWarnings))
  ];
  if (status.watcher.pid) lines.push(kv("PID          ", String(status.watcher.pid)));
  if (status.watcher.watchedRoot) lines.push(kv("Root         ", status.watcher.watchedRoot));
  if (status.watcher.startedAt) lines.push(kv("Started      ", status.watcher.startedAt));
  if (status.watcher.lastHeartbeatAt) lines.push(kv("Heartbeat    ", status.watcher.lastHeartbeatAt));
  if (status.watcher.lastEventAt) lines.push(kv("Last event   ", status.watcher.lastEventAt));
  if (status.lastCapturedAt) lines.push(kv("Last captured", status.lastCapturedAt));
  if (status.watcher.attribution) {
    lines.push(
      kv(
        "Attribution  ",
        `${status.watcher.attribution.agentId} via ${status.watcher.attribution.source} (${status.watcher.attribution.confidence})`
      )
    );
  }
  if (status.watcher.lastError) lines.push(errorLine(`Last error: ${status.watcher.lastError}`));
  return panel("Capture Status", lines.join("\n"));
}
function helpText() {
  const usage = `  aibridge init [--name <project-name>] [--agents <cursor,claude,...>]
  aibridge init --template <template> --name <project-name> --description <goal> [--stack <a,b>] [--priority <a,b>] [--single-agent|--multi-agent] [--constraint <a,b>] [--instructions <text>] [--existing-repo] [--existing-files <summary>] [--clear-existing]
  aibridge init --interactive
  aibridge setup plan --template <template> --name <project-name> --description <goal> [--stack <a,b>] [--priority <a,b>] [--single-agent|--multi-agent] [--constraint <a,b>] [--instructions <text>] [--existing-repo] [--existing-files <summary>]
  aibridge status [--json]
  aibridge task add <title> [--priority <low|medium|high>] [--assign <agent-id>] [--status <status>]
  aibridge task list [--status <status>] [--agent <agent-id>] [--json]
  aibridge task update <task-id> [--title <title>] [--status <status>] [--priority <priority>] [--assign <agent-id>]
  aibridge task assign <task-id> <agent-id>
  aibridge task in-progress <task-id>
  aibridge task done <task-id>
  aibridge message add <content> --from <agent-id> [--to <agent-id>] [--severity <info|warning|critical>]
  aibridge message list [--to <agent-id>] [--severity <level>] [--unread] [--limit <n>] [--json]
  aibridge message ack <message-id>
  aibridge handoff create <to-agent-id> <description> --from <agent-id> [--tasks <id,id>]
  aibridge handoff list [--agent <agent-id>] [--json]
  aibridge decision add <title> <summary> [--status <proposed|accepted|superseded>] [--from <agent-id>]
  aibridge decision accept <decision-id> [--from <agent-id>]
  aibridge decision supersede <decision-id> [--from <agent-id>]
  aibridge decision list [--status <status>] [--json]
  aibridge convention set <rule> [--category <category>] [--from <agent-id>]
  aibridge convention show [--json]
  aibridge convention list [--json]
  aibridge convention sync
  aibridge agent launch --agent <agent-id> --tool <cursor|codex> [--source <dashboard|app|cli>] [--json]
  aibridge agent start --session <session-id>
  aibridge agent heartbeat --session <session-id>
  aibridge agent stop --session <session-id> [--reason <text>]
  aibridge agent recover --session <session-id> [--json]
  aibridge agent status [--agent <agent-id>] [--tool <cursor|codex>] [--status <status>] [--json]
  aibridge log add <action> <description> [--from <agent-id>]
  aibridge log list [--agent <agent-id>] [--limit <n>] [--json]
  aibridge capture install-hooks
  aibridge capture doctor
  aibridge capture status [--json]
  aibridge capture watch [--agent <agent-id>] [--debounce <ms>] [--interval <ms>]
  aibridge capture stop
  aibridge sync
  aibridge context generate [--output <path>] [--budget <tokens>]
  aibridge serve [--host <host>] [--port <port>]`;
  const examples = `  aibridge init --name "My Project" --agents cursor,claude,codex
  aibridge init --template web-app --name "Acme Web" --description "Ship the first customer-facing web flow" --stack react,typescript,supabase --multi-agent
  aibridge init --interactive
  aibridge setup plan --template api-backend --name "Billing API" --description "Create the first billing endpoints" --stack node,postgres
  aibridge task add "Ship Local V1" --assign cursor --priority high
  aibridge message add "Parser is ready" --from cursor --to claude
  aibridge handoff create claude "Review the runtime changes" --from cursor
  aibridge decision add ServiceBoundary "Canonical local HTTP service" --status accepted --from cursor
  aibridge convention set "Regenerate CONTEXT.md after writes" --category workflow --from cursor
  aibridge agent launch --agent cursor --tool cursor
  aibridge agent status
  aibridge capture install-hooks
  aibridge capture watch --agent cursor`;
  return headline("CLI") + "\n" + muted("Local workspace engine \xB7 hosted control plane companion \xB7 shared setup flow") + "\n\n" + section("Usage") + "\n" + usage.split("\n").map((line) => commandText(line)).join("\n") + "\n\n" + section("Examples") + "\n" + examples.split("\n").map((line) => commandText(line)).join("\n") + "\n\n" + section("Hints") + "\n" + note("\u2022", `Use ${commandText("aibridge init --interactive")} for guided setup.`) + "\n" + note("\u2022", `Use ${commandText("aibridge setup plan --template web-app")} to preview starter tasks and conventions.`) + "\n" + note("\u2022", `Use ${commandText("aibridge agent launch --agent cursor --tool cursor")} to generate the startup handshake prompt.`) + "\n" + note("\u2022", `Use ${commandText("aibridge serve")} to expose the local bridge to /dashboard.`) + "\n";
}
async function writeIfNeeded(outputPath, markdown) {
  if (!outputPath) {
    return;
  }
  const resolved = path7.resolve(process.cwd(), outputPath);
  await fs6.mkdir(path7.dirname(resolved), { recursive: true });
  await fs6.writeFile(resolved, markdown, "utf8");
}
function bridgeRoot() {
  return path7.resolve(process.cwd(), ".aibridge");
}
function renderCreatedEntity(kind, entityId, details) {
  const lines = [successLine(`${kind} ready`), kv("ID           ", entityId)];
  details.forEach(([key, value]) => {
    if (value?.trim()) {
      lines.push(kv(`${key.padEnd(12, " ")}`, value));
    }
  });
  return `${lines.join("\n")}
`;
}
async function runCli(rawArgs, io) {
  const { positionals, flags } = parseArgs(rawArgs);
  const [command, subcommand, ...rest] = positionals;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.stdout(helpText());
    return 0;
  }
  switch (command) {
    case "init": {
      if (usesSetupFlow(flags)) {
        const questionnaire = flagBoolean(flags, "interactive") ? await collectInteractiveSetupQuestionnaire(flags) : {
          projectName: flagString(flags, "name")?.trim() || defaultSetupProjectName(),
          ...buildSetupQuestionnaireFromFlags(flags)
        };
        const initialized = await initializeLocalBridgeFromSetup(questionnaire, {
          cwd: process.cwd(),
          clearExistingData: flagBoolean(flags, "clear-existing")
        });
        io.stdout(`${successLine(`Initialized AiBridge setup at ${initialized.rootPath}`)}
`);
        io.stdout(renderSetupPlan(initialized.result));
        return 0;
      }
      const result = await initBridge({
        cwd: process.cwd(),
        name: flagString(flags, "name"),
        agents: parseListFlag(flags, "agents")
      });
      io.stdout(
        `${successLine(
          result.alreadyInitialized ? `Already initialized at ${result.rootPath}` : `Initialized AiBridge at ${result.rootPath}`
        )}
`
      );
      if (result.createdFiles.length > 0) {
        io.stdout(dim(result.createdFiles.map((filePath) => `  \u2022 ${filePath}`).join("\n")) + "\n");
      }
      return 0;
    }
    case "setup": {
      const normalizedSubcommand = subcommand ?? "plan";
      if (normalizedSubcommand === "plan") {
        const templateId = parseTemplateFlag(flags) ?? "web-app";
        const questionnaire = flagBoolean(flags, "interactive") ? await collectInteractiveSetupQuestionnaire(flags) : {
          projectName: flagString(flags, "name")?.trim() || defaultSetupProjectName(),
          templateId,
          ...buildSetupQuestionnaireFromFlags(flags)
        };
        const result = buildSetupResult(questionnaire);
        io.stdout(flagBoolean(flags, "json") ? toJson(result) : renderSetupPlan(result));
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown setup subcommand.");
    }
    case "status": {
      const status = await getStatusSummary(bridgeRoot());
      io.stdout(flagBoolean(flags, "json") ? toJson(status) : formatStatusTextStyled(status));
      return 0;
    }
    case "task": {
      if (subcommand === "add") {
        const title = requireValue(rest.join(" "), "Task title is required.");
        const task = await addTask(bridgeRoot(), {
          title,
          priority: parsePriority(flagString(flags, "priority")),
          agentId: flagString(flags, "assign"),
          status: flagString(flags, "status") ? parseTaskStatus(flagString(flags, "status")) : void 0
        });
        io.stdout(
          renderCreatedEntity("Task", task.id, [
            ["Title", task.title],
            ["Status", task.status],
            ["Priority", task.priority],
            ["Agent", task.agentId ?? "unassigned"]
          ])
        );
        return 0;
      }
      if (subcommand === "list") {
        const tasks = await listTasks(bridgeRoot(), {
          status: flagString(flags, "status") ? parseTaskStatus(flagString(flags, "status")) : void 0,
          agentId: flagString(flags, "agent")
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(tasks) : renderTaskTable(tasks));
        return 0;
      }
      if (subcommand === "update") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, {
          title: flagString(flags, "title"),
          status: flagString(flags, "status") ? parseTaskStatus(flagString(flags, "status")) : void 0,
          priority: flagString(flags, "priority") ? parsePriority(flagString(flags, "priority")) : void 0,
          agentId: flagString(flags, "assign")
        });
        io.stdout(
          renderCreatedEntity("Task updated", task.id, [
            ["Title", task.title],
            ["Status", task.status],
            ["Priority", task.priority],
            ["Agent", task.agentId ?? "unassigned"]
          ])
        );
        return 0;
      }
      if (subcommand === "assign") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const agentId = requireValue(rest[1], "Agent ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, { agentId });
        io.stdout(`${successLine(`Assigned task ${task.id} to ${agentId}`)}
`);
        return 0;
      }
      if (subcommand === "in-progress") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, { status: "in_progress" });
        io.stdout(`${successLine(`Moved task ${task.id} to in progress`)}
`);
        return 0;
      }
      if (subcommand === "done") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, { status: "done" });
        io.stdout(`${successLine(`Marked task ${task.id} as done`)}
`);
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown task subcommand.");
    }
    case "message": {
      const normalizedSubcommand = subcommand === "send" ? "add" : subcommand;
      if (normalizedSubcommand === "add") {
        const content = requireValue(rest.join(" "), "Message content is required.");
        const fromAgentId = requireValue(resolveAgentFlag(flags), "`--from` is required.");
        const message = await addMessage(bridgeRoot(), {
          fromAgentId,
          toAgentId: flagString(flags, "to"),
          severity: flagString(flags, "severity"),
          content
        });
        io.stdout(
          renderCreatedEntity("Message sent", message.id, [
            ["From", message.fromAgentId],
            ["To", message.toAgentId ?? "broadcast"],
            ["Severity", message.severity]
          ])
        );
        return 0;
      }
      if (normalizedSubcommand === "list") {
        const limitValue = flagString(flags, "limit");
        const messages = await listMessages(bridgeRoot(), {
          toAgentId: flagString(flags, "to"),
          severity: flagString(flags, "severity"),
          unreadOnly: flagBoolean(flags, "unread"),
          limit: limitValue ? parseNumberFlag(flags, "limit") : void 0
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(messages) : renderMessageTable(messages));
        return 0;
      }
      if (normalizedSubcommand === "ack") {
        const messageId = requireValue(rest[0], "Message ID is required.");
        const message = await acknowledgeMessage(bridgeRoot(), messageId);
        io.stdout(`${successLine(`Acknowledged message ${message.id}`)}
`);
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown message subcommand.");
    }
    case "handoff": {
      const normalizedSubcommand = subcommand && !["create", "list"].includes(subcommand) ? "create" : subcommand ?? "create";
      if (normalizedSubcommand === "create") {
        const toAgentId = requireValue(subcommand === "create" ? rest[0] : subcommand, "Target agent ID is required.");
        const description = requireValue(
          (subcommand === "create" ? rest.slice(1) : rest).join(" "),
          "Handoff description is required."
        );
        const fromAgentId = requireValue(resolveAgentFlag(flags), "`--from` is required.");
        const handoff = await createHandoff(bridgeRoot(), {
          fromAgentId,
          toAgentId,
          description,
          relatedTaskIds: flagString(flags, "tasks")?.split(",").filter(Boolean)
        });
        io.stdout(
          renderCreatedEntity("Handoff created", handoff.id, [
            ["From", handoff.fromAgentId],
            ["To", handoff.toAgentId],
            ["Tasks", handoff.relatedTaskIds?.join(", ") || "-"]
          ])
        );
        return 0;
      }
      if (normalizedSubcommand === "list") {
        const handoffs = await listHandoffs(bridgeRoot(), {
          agentId: flagString(flags, "agent")
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(handoffs) : renderHandoffTable(handoffs));
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown handoff subcommand.");
    }
    case "decision": {
      const normalizedSubcommand = subcommand ?? "list";
      if (normalizedSubcommand === "add" || normalizedSubcommand === "propose") {
        const title = requireValue(rest[0], "Decision title is required.");
        const summary = requireValue(rest.slice(1).join(" "), "Decision summary is required.");
        const decision = await addDecision(bridgeRoot(), {
          title,
          summary,
          status: flagString(flags, "status") ? parseDecisionStatus(flagString(flags, "status")) : void 0,
          agentId: resolveAgentFlag(flags)
        });
        io.stdout(
          renderCreatedEntity("Decision recorded", decision.id, [
            ["Title", decision.title],
            ["Status", decision.status ?? "proposed"],
            ["Agent", decision.agentId ?? "-"]
          ])
        );
        return 0;
      }
      if (normalizedSubcommand === "accept") {
        const decisionId = requireValue(rest[0], "Decision ID is required.");
        const decision = await updateDecisionStatus(bridgeRoot(), decisionId, "accepted", resolveAgentFlag(flags));
        io.stdout(`${successLine(`Accepted decision ${decision.id}`)}
`);
        return 0;
      }
      if (normalizedSubcommand === "supersede") {
        const decisionId = requireValue(rest[0], "Decision ID is required.");
        const decision = await updateDecisionStatus(bridgeRoot(), decisionId, "superseded", resolveAgentFlag(flags));
        io.stdout(`${successLine(`Superseded decision ${decision.id}`)}
`);
        return 0;
      }
      if (normalizedSubcommand === "list") {
        const decisions = await listDecisions(bridgeRoot(), {
          status: flagString(flags, "status") ? parseDecisionStatus(flagString(flags, "status")) : void 0
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(decisions) : renderDecisionTable(decisions));
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown decision subcommand.");
    }
    case "convention": {
      const normalizedSubcommand = subcommand ?? "show";
      if (normalizedSubcommand === "set" || normalizedSubcommand === "add") {
        const rule = requireValue(rest.join(" "), "Convention rule is required.");
        const convention = await addConvention(bridgeRoot(), {
          rule,
          addedBy: resolveAgentFlag(flags),
          category: flagString(flags, "category") ? parseConventionCategory(flagString(flags, "category")) : void 0
        });
        io.stdout(
          renderCreatedEntity("Convention added", convention.id, [
            ["Category", convention.category ?? "other"],
            ["Added by", convention.addedBy ?? "-"]
          ])
        );
        return 0;
      }
      if (normalizedSubcommand === "show") {
        if (flagBoolean(flags, "json")) {
          const conventions = await listConventions(bridgeRoot());
          io.stdout(toJson(conventions));
          return 0;
        }
        io.stdout(await showConventionsMarkdown(bridgeRoot()));
        return 0;
      }
      if (normalizedSubcommand === "list") {
        const conventions = await listConventions(bridgeRoot());
        io.stdout(flagBoolean(flags, "json") ? toJson(conventions) : renderConventionTable(conventions));
        return 0;
      }
      if (normalizedSubcommand === "sync") {
        const conventions = await listConventions(bridgeRoot());
        await setConventions(bridgeRoot(), conventions);
        io.stdout(`${successLine(`Synced ${conventions.length} conventions into CONVENTIONS.md`)}
`);
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown convention subcommand.");
    }
    case "release":
    case "announcement": {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `\`${command}\` CLI commands have been removed. Manage hosted product updates and notices from /app as an admin.`
      );
    }
    case "agent": {
      const normalizedSubcommand = subcommand ?? "status";
      if (normalizedSubcommand === "launch") {
        const agentId = requireValue(flagString(flags, "agent"), "`--agent` is required.");
        const toolKind = parseAgentToolKind(flagString(flags, "tool")) ?? "cursor";
        const session = await launchAgentSession(bridgeRoot(), {
          agentId,
          toolKind,
          launchSource: parseAgentLaunchSource(flagString(flags, "source")) ?? "cli"
        });
        if (flagBoolean(flags, "json")) {
          io.stdout(toJson(session));
        } else {
          io.stdout(
            panel(
              "Agent Launch",
              [
                kv("Session      ", session.id),
                kv("Agent        ", session.agentId),
                kv("Tool         ", session.toolKind),
                kv("Status       ", session.status),
                "",
                bold("Prompt"),
                session.instructions.prompt
              ].join("\n")
            )
          );
        }
        return 0;
      }
      if (normalizedSubcommand === "start") {
        const sessionId = requireValue(flagString(flags, "session") ?? rest[0], "`--session` is required.");
        const session = await startAgentSession(bridgeRoot(), sessionId);
        io.stdout(`${successLine(`Started agent session ${session.id}`)}
`);
        return 0;
      }
      if (normalizedSubcommand === "heartbeat") {
        const sessionId = requireValue(flagString(flags, "session") ?? rest[0], "`--session` is required.");
        const session = await heartbeatAgentSession(bridgeRoot(), sessionId);
        io.stdout(`${successLine(`Heartbeat recorded for ${session.id}`)}
`);
        return 0;
      }
      if (normalizedSubcommand === "stop") {
        const sessionId = requireValue(flagString(flags, "session") ?? rest[0], "`--session` is required.");
        const session = await stopAgentSession(bridgeRoot(), sessionId, {
          reason: flagString(flags, "reason")
        });
        io.stdout(`${successLine(`Stopped agent session ${session.id}`)}
`);
        return 0;
      }
      if (normalizedSubcommand === "recover") {
        const sessionId = requireValue(flagString(flags, "session") ?? rest[0], "`--session` is required.");
        const session = await getAgentSessionRecovery(bridgeRoot(), sessionId);
        if (flagBoolean(flags, "json")) {
          io.stdout(toJson(session));
        } else {
          io.stdout(
            panel(
              "Recovery Prompt",
              [
                kv("Session      ", session.id),
                kv("Agent        ", session.agentId),
                kv("Status       ", session.status),
                session.recovery?.reason ? kv("Reason       ", session.recovery.reason) : void 0,
                "",
                bold("Prompt"),
                session.recovery?.prompt ?? dim("No recovery prompt needed.")
              ].filter(Boolean).join("\n")
            )
          );
        }
        return 0;
      }
      if (normalizedSubcommand === "status") {
        const sessions = await listAgentSessions(bridgeRoot(), {
          agentId: flagString(flags, "agent"),
          toolKind: parseAgentToolKind(flagString(flags, "tool")),
          status: parseAgentSessionStatus(flagString(flags, "status"))
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(sessions) : renderAgentSessionTable(sessions));
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown agent subcommand.");
    }
    case "log": {
      const normalizedSubcommand = !subcommand || ["add", "list"].includes(subcommand) ? subcommand ?? "list" : "add";
      const addArgs = normalizedSubcommand === "add" && subcommand && subcommand !== "add" ? [subcommand, ...rest] : rest;
      if (normalizedSubcommand === "add") {
        const action = requireValue(addArgs[0], "Action name is required.");
        const description = requireValue(addArgs.slice(1).join(" "), "Log description is required.");
        const agentId = requireValue(resolveAgentFlag(flags), "`--from` is required.");
        await addLog(bridgeRoot(), { agentId, action, description });
        io.stdout(`${successLine(`Logged action ${action} for agent ${agentId}`)}
`);
        return 0;
      }
      if (normalizedSubcommand === "list") {
        const logs = await listLogs(bridgeRoot(), {
          agentId: flagString(flags, "agent"),
          limit: parseNumberFlag(flags, "limit")
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(logs) : renderLogTable(logs));
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown log subcommand.");
    }
    case "capture": {
      const normalizedSubcommand = subcommand ?? "status";
      if (normalizedSubcommand === "install-hooks") {
        const result = await installCaptureHooks({ cwd: process.cwd() });
        io.stdout(`${successLine(`Installed capture hooks in ${result.hooksDir}`)}
`);
        if (result.installed.length > 0) {
          io.stdout(`${note("\u2022", `New: ${result.installed.join(", ")}`)}
`);
        }
        if (result.updated.length > 0) {
          io.stdout(`${note("\u2022", `Updated: ${result.updated.join(", ")}`)}
`);
        }
        return 0;
      }
      if (normalizedSubcommand === "doctor") {
        const result = await runCaptureDoctor({ cwd: process.cwd() });
        result.checks.forEach((check) => {
          io.stdout(`${check.ok ? successLine(check.name) : errorLine(check.name)}${check.details ? ` ${dim("\u2014")} ${check.details}` : ""}
`);
        });
        return result.ok ? 0 : 1;
      }
      if (normalizedSubcommand === "status") {
        const status = await getCaptureStatus({ cwd: process.cwd() });
        io.stdout(flagBoolean(flags, "json") ? toJson(status) : renderCaptureStatusStyled(status));
        return 0;
      }
      if (normalizedSubcommand === "stop") {
        const result = await stopCaptureWatcher({ cwd: process.cwd() });
        io.stdout(`${result.details}
`);
        io.stdout(flagBoolean(flags, "json") ? toJson(result.status) : renderCaptureStatusStyled(result.status));
        return result.stopped ? 0 : 0;
      }
      if (normalizedSubcommand === "watch") {
        const debounceMs = parseNumberFlag(flags, "debounce");
        const scanIntervalMs = parseNumberFlag(flags, "interval");
        const watcher = await startCaptureWatcher({
          cwd: process.cwd(),
          agentId: resolveAgentFlag(flags),
          debounceMs,
          scanIntervalMs
        });
        io.stdout(`${infoLine("AiBridge capture watcher running. Press Ctrl+C or `aibridge capture stop` to stop.")}
`);
        io.stdout(renderCaptureStatusStyled(await watcher.getStatus()));
        await new Promise((resolve) => {
          const shutdown = async () => {
            process.off("SIGINT", onSigint);
            process.off("SIGTERM", onSigterm);
            await watcher.close();
            resolve();
          };
          const onSigint = () => {
            void shutdown();
          };
          const onSigterm = () => {
            void shutdown();
          };
          process.on("SIGINT", onSigint);
          process.on("SIGTERM", onSigterm);
        });
        return 0;
      }
      if (normalizedSubcommand === "hook") {
        const hookName = requireValue(rest[0], "Hook name is required.");
        await handleCaptureHook({
          cwd: process.cwd(),
          hookName,
          args: rest.slice(1),
          explicitAgentId: resolveAgentFlag(flags)
        });
        return 0;
      }
      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown capture subcommand.");
    }
    case "sync": {
      io.stdout(muted("Sync is not implemented locally yet. For now, data is just written to disk.\n"));
      return 0;
    }
    case "context": {
      const normalizedSubcommand = subcommand ?? "generate";
      if (normalizedSubcommand !== "generate") {
        throw new BridgeRuntimeError("BAD_REQUEST", "Unknown context subcommand.");
      }
      const budget = flagString(flags, "budget") ? Number(flagString(flags, "budget")) : void 0;
      const markdown = await regenerateContext(bridgeRoot(), budget);
      await writeIfNeeded(flagString(flags, "output"), markdown);
      io.stdout(markdown);
      return 0;
    }
    case "serve": {
      const portValue = flagString(flags, "port");
      const hostValue = flagString(flags, "host");
      const service = await startLocalBridgeService({
        cwd: process.cwd(),
        host: hostValue,
        port: parseNumberFlag(flags, "port")
      });
      io.stdout(
        `${successLine(
          service.ownsServer ? `AiBridge local service started on ${service.url}` : `AiBridge local service already running at ${service.url} for ${service.identity.cwd}`
        )}
`
      );
      if (!service.ownsServer) {
        return 0;
      }
      await new Promise((resolve) => {
        const shutdown = async () => {
          process.off("SIGINT", onSigint);
          process.off("SIGTERM", onSigterm);
          await service.close();
          resolve();
        };
        const onSigint = () => {
          void shutdown();
        };
        const onSigterm = () => {
          void shutdown();
        };
        process.on("SIGINT", onSigint);
        process.on("SIGTERM", onSigterm);
      });
      return 0;
    }
    default:
      throw new BridgeRuntimeError("BAD_REQUEST", `Unknown command: ${command}`);
  }
}

// aibridge/cli/bin/aibridge.ts
async function main() {
  try {
    const exitCode = await runCli(process.argv.slice(2), {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text)
    });
    process.exitCode = exitCode;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const details = err instanceof Error && err.name ? `${err.name}` : void 0;
    process.stderr.write(errorPanel("AiBridge CLI Error", message, details));
    process.exitCode = 1;
  }
}
void main();

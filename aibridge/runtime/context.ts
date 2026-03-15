import type {
  AibridgeAgent,
  AibridgeAgentSession,
  AibridgeAnnouncement,
  AibridgeBridgeSnapshot,
  AibridgeDecision,
  AibridgeHandoff,
  AibridgeLogEntry,
  AibridgeMessage,
  AibridgeRelease,
  AibridgeTask,
} from "../../src/lib/aibridge/types";
import { deriveAgentSession } from "./agent-sessions";

const PRIORITY_ORDER: Record<AibridgeTask["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const SEVERITY_ORDER: Record<NonNullable<AibridgeMessage["severity"]>, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

interface RenderLimits {
  inProgressTasks: number;
  pendingTasks: number;
  recentActivity: number;
  handoffs: number;
  unreadMessages: number;
  recentDecisions: number;
  publishedReleases: number;
  announcements: number;
  decisionSummaryLimit?: number;
  includeSuggestions: boolean;
}

export interface ContextCompilerOptions {
  budget?: number;
  generatedAt?: string;
}

function compareDescByDate<T extends { id: string }>(left: T, right: T, getValue: (item: T) => string) {
  const timeDelta = getValue(right).localeCompare(getValue(left));
  return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
}

function estimateTokens(markdown: string) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.35);
}

function formatTaskAssignment(task: AibridgeTask) {
  return task.agentId ?? "unassigned";
}

function renderLimitedList(items: string[], remainingLabel?: string) {
  if (items.length === 0) {
    return "_(none)_";
  }

  const rendered = [...items];
  if (remainingLabel) {
    rendered.push(remainingLabel);
  }

  return rendered.join("\n");
}

function truncateSummary(summary: string, max?: number) {
  if (!max || summary.length <= max) {
    return summary;
  }

  return `${summary.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function renderSuggestedActions(snapshot: AibridgeBridgeSnapshot) {
  const sections = snapshot.bridge.agents.map((agent) => {
    const suggestions: string[] = [];
    const assignedPending = snapshot.tasks
      .filter((task) => task.agentId === agent.id && task.status === "pending")
      .sort((left, right) => {
        const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        const createdDelta = left.createdAt.localeCompare(right.createdAt);
        return createdDelta !== 0 ? createdDelta : left.id.localeCompare(right.id);
      });

    const handoffsToAgent = snapshot.handoffs
      .filter((handoff) => isOpenHandoff(handoff) && handoff.toAgentId === agent.id)
      .sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));

    const unreadMessages = snapshot.messages
      .filter((message) => !message.acknowledged && (!message.toAgentId || message.toAgentId === agent.id))
      .sort((left, right) => {
        const severityDelta = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
        if (severityDelta !== 0) {
          return severityDelta;
        }

        return compareDescByDate(left, right, (item) => item.timestamp);
      });

    const inProgress = snapshot.tasks
      .filter((task) => task.agentId === agent.id && task.status === "in_progress")
      .sort((left, right) => compareDescByDate(left, right, (item) => item.updatedAt));

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

function renderReleaseSummary(release: AibridgeRelease) {
  return `- **${release.version}** - ${release.title}: ${truncateSummary(release.summary, 120)}`;
}

function renderAnnouncementSummary(announcement: AibridgeAnnouncement) {
  return `- [${announcement.severity}] **${announcement.title}** (${announcement.audience})`;
}

function renderSessionSummary(session: AibridgeAgentSession) {
  return `- **${session.agentId}** (${session.toolKind}) - ${session.status}${session.recovery?.reason ? `: ${session.recovery.reason}` : ""}`;
}

function isOpenHandoff(handoff: AibridgeHandoff) {
  return (handoff.status ?? "open") !== "completed";
}

function renderContext(snapshot: AibridgeBridgeSnapshot, limits: RenderLimits, generatedAt: string) {
  const taskCounts = {
    pending: snapshot.tasks.filter((task) => task.status === "pending").length,
    in_progress: snapshot.tasks.filter((task) => task.status === "in_progress").length,
    done: snapshot.tasks.filter((task) => task.status === "done").length,
  };

  const inProgressTasks = snapshot.tasks
    .filter((task) => task.status === "in_progress")
    .sort((left, right) => compareDescByDate(left, right, (item) => item.updatedAt));

  const pendingTasks = snapshot.tasks
    .filter((task) => task.status === "pending")
    .sort((left, right) => {
      const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const createdDelta = left.createdAt.localeCompare(right.createdAt);
      return createdDelta !== 0 ? createdDelta : left.id.localeCompare(right.id);
    });

  const recentActivity = snapshot.logs
    .slice()
    .sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));

  const openHandoffs = snapshot.handoffs
    .filter((handoff) => isOpenHandoff(handoff))
    .slice()
    .sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));

  const unreadMessages = snapshot.messages
    .filter((message) => !message.acknowledged)
    .sort((left, right) => {
      const severityDelta = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return compareDescByDate(left, right, (item) => item.timestamp);
    });

  const recentDecisions = snapshot.decisions
    .filter((decision) => !decision.status || decision.status === "accepted")
    .sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));

  const publishedReleases = snapshot.releases
    .filter((release) => release.status === "published")
    .sort((left, right) => compareDescByDate(left, right, (item) => item.publishedAt ?? item.updatedAt));

  const activeAnnouncements = snapshot.announcements
    .filter((announcement) => announcement.status === "published" || announcement.status === "pinned")
    .sort((left, right) => compareDescByDate(left, right, (item) => item.publishedAt ?? item.updatedAt));
  const activeSessions = snapshot.sessions
    .map((session) => deriveAgentSession(snapshot, session, generatedAt))
    .slice()
    .sort((left, right) => right.launchedAt.localeCompare(left.launchedAt));

  const conventions = snapshot.conventions
    .slice()
    .sort((left, right) => {
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

  const activeAgentsRows = snapshot.bridge.agents.length
    ? snapshot.bridge.agents
        .map((agent) => `| ${agent.name} | ${agent.kind} | ${agent.configPath} |`)
        .join("\n")
    : "| _(none)_ | _(none)_ | _(none)_ |";

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
    ...(snapshot.bridge.setup
      ? [
          "",
          "## Setup Brief",
          "",
          `- **Template**: ${snapshot.bridge.setup.templateId}`,
          `- **Goal**: ${snapshot.bridge.setup.summary}`,
          `- **Primary deliverable**: ${snapshot.bridge.setup.primaryDeliverable}`,
          `- **Preferred stack**: ${snapshot.bridge.setup.preferredStack.join(", ") || "(not specified)"}`,
          `- **Priorities**: ${snapshot.bridge.setup.priorities.join(", ") || "(not specified)"}`,
          `- **Agent mode**: ${snapshot.bridge.setup.agentMode}`,
          snapshot.bridge.setup.hardConstraints.length > 0
            ? `- **Constraints**: ${snapshot.bridge.setup.hardConstraints.join("; ")}`
            : "- **Constraints**: _(none)_",
        ]
      : []),
    ...(activeSessions.length > 0
      ? [
          "",
          "## Agent Sessions",
          "",
          ...activeSessions.slice(0, 5).map(renderSessionSummary),
        ]
      : []),
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
        (task) => `- **${task.title}** - assigned to ${formatTaskAssignment(task)} (priority: ${task.priority})`,
      ),
      inProgressTasks.length > inProgressVisible.length
        ? `+${inProgressTasks.length - inProgressVisible.length} more in-progress tasks`
        : undefined,
    ),
    "",
    "### Pending Tasks",
    "",
    renderLimitedList(
      pendingVisible.map(
        (task) => `- **${task.title}** - assigned to ${formatTaskAssignment(task)} (priority: ${task.priority})`,
      ),
      pendingTasks.length > pendingVisible.length
        ? `+${pendingTasks.length - pendingVisible.length} more pending tasks`
        : undefined,
    ),
    "",
    "## Recent Activity",
    "",
    renderLimitedList(
      activityVisible.map(
        (entry) => `- [${entry.timestamp}] **${entry.agentId}** ${entry.action}: ${entry.description}`,
      ),
      recentActivity.length > activityVisible.length
        ? `+${recentActivity.length - activityVisible.length} more entries`
        : undefined,
    ),
    "",
    "## Open Handoffs",
    "",
    renderLimitedList(
      handoffVisible.map(
        (handoff) =>
          `- **${handoff.fromAgentId} -> ${handoff.toAgentId}**: ${handoff.description} (${handoff.timestamp})`,
      ),
      openHandoffs.length > handoffVisible.length
        ? `+${openHandoffs.length - handoffVisible.length} more handoffs`
        : undefined,
    ),
    "",
    "## Unread Messages",
    "",
    renderLimitedList(
      messageVisible.map(
        (message) =>
          `- [${message.severity}] **${message.fromAgentId}** -> ${message.toAgentId ?? "all"}: ${message.content}`,
      ),
      unreadMessages.length > messageVisible.length
        ? `+${unreadMessages.length - messageVisible.length} more unread messages`
        : undefined,
    ),
    "",
    "## Recent Decisions",
    "",
    renderLimitedList(
      decisionVisible.map(
        (decision) => `- **${decision.title}**: ${truncateSummary(decision.summary, limits.decisionSummaryLimit)}`,
      ),
      recentDecisions.length > decisionVisible.length
        ? `+${recentDecisions.length - decisionVisible.length} more decisions`
        : undefined,
    ),
    "",
    "## Releases",
    "",
    renderLimitedList(
      releaseVisible.map(renderReleaseSummary),
      publishedReleases.length > releaseVisible.length
        ? `+${publishedReleases.length - releaseVisible.length} more published releases`
        : undefined,
    ),
    "",
    "## Announcements",
    "",
    renderLimitedList(
      announcementVisible.map(renderAnnouncementSummary),
      activeAnnouncements.length > announcementVisible.length
        ? `+${activeAnnouncements.length - announcementVisible.length} more announcements`
        : undefined,
    ),
    "",
    "## Active Conventions",
    "",
    conventions.length > 0 ? conventions.map((convention) => `- ${convention.rule}`).join("\n") : "_(none)_",
    ...(snapshot.bridge.setup
      ? [
          "",
          "## Definition Of Done",
          "",
          renderLimitedList(snapshot.bridge.setup.definitionOfDone.map((item) => `- ${item}`)),
          "",
          "## Setup Workflow",
          "",
          snapshot.bridge.setup.workflowSummary,
        ]
      : []),
  ];

  if (limits.includeSuggestions) {
    sections.push("", "## Suggested Next Actions", "", renderSuggestedActions(snapshot));
  }

  return `${sections.join("\n").trim()}\n`;
}

export function compileContextMarkdown(
  snapshot: AibridgeBridgeSnapshot,
  options: ContextCompilerOptions = {},
) {
  const budget = options.budget ?? 2000;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const limits: RenderLimits = {
    inProgressTasks: 10,
    pendingTasks: 10,
    recentActivity: 10,
    handoffs: 5,
    unreadMessages: 5,
    recentDecisions: 5,
    publishedReleases: 3,
    announcements: 5,
    includeSuggestions: true,
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

export function parseContextTimestamp(markdown: string) {
  const match = markdown.match(/^> Last updated: (.+)$/m);
  return match?.[1]?.trim();
}

export function collectAgentActivity(logs: AibridgeLogEntry[], agent: AibridgeAgent) {
  return logs
    .filter((entry) => entry.agentId === agent.id)
    .sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));
}

export function collectAgentHandoffs(handoffs: AibridgeHandoff[], agent: AibridgeAgent) {
  return handoffs
    .filter((handoff) => isOpenHandoff(handoff) && (handoff.fromAgentId === agent.id || handoff.toAgentId === agent.id))
    .sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));
}

export function collectAcceptedDecisions(decisions: AibridgeDecision[]) {
  return decisions
    .filter((decision) => !decision.status || decision.status === "accepted")
    .sort((left, right) => compareDescByDate(left, right, (item) => item.timestamp));
}

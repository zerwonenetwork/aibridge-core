import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  AibridgeAgent,
  AibridgeAgentLaunchSource,
  AibridgeAgentSession,
  AibridgeAgentToolKind,
  AibridgeBridgeSnapshot,
  AibridgeLaunchInstructionSet,
} from "../../src/lib/aibridge/types";

const ACTIVE_STALE_MS = 10 * 60 * 1000;
const PENDING_STALE_MS = 5 * 60 * 1000;
const RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY_PATH = path.resolve(RUNTIME_DIR, "../cli/bin/aibridge.ts");

function pickLatestTimestamp(...values: Array<string | undefined>) {
  return values.filter(Boolean).sort((left, right) => String(right).localeCompare(String(left)))[0];
}

function toMillis(timestamp: string | undefined) {
  return timestamp ? new Date(timestamp).getTime() : 0;
}

function listAssignedTasks(snapshot: AibridgeBridgeSnapshot, agentId: string) {
  return snapshot.tasks
    .filter((task) => task.agentId === agentId && task.status !== "done")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function unreadMessagesForAgent(snapshot: AibridgeBridgeSnapshot, agentId: string) {
  return snapshot.messages
    .filter((message) => !message.acknowledged && (!message.toAgentId || message.toAgentId === agentId))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function openHandoffsForAgent(snapshot: AibridgeBridgeSnapshot, agentId: string) {
  return snapshot.handoffs
    .filter((handoff) => handoff.toAgentId === agentId)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function summarizeRole(agent: AibridgeAgent, snapshot: AibridgeBridgeSnapshot) {
  const role = snapshot.bridge.setup?.roles.find((item) => item.agentKind === agent.kind || item.key === agent.id);
  if (!role) {
    return `${agent.name} should inspect the repo, continue the highest-priority assigned task, and coordinate through AiBridge when blocked.`;
  }

  return `${role.name}: ${role.responsibilities.join("; ")}`;
}

export function buildCliCommandHint() {
  if (existsSync(CLI_ENTRY_PATH)) {
    return `node ${CLI_ENTRY_PATH.replace(/\\/g, "/")} `;
  }
  return "aibridge ";
}

export function buildLaunchInstructionSet(
  snapshot: AibridgeBridgeSnapshot,
  agent: AibridgeAgent,
  toolKind: AibridgeAgentToolKind,
  sessionId: string,
  launchSource: AibridgeAgentLaunchSource,
  generatedAt = new Date().toISOString(),
): AibridgeLaunchInstructionSet {
  const assignedTasks = listAssignedTasks(snapshot, agent.id).slice(0, 3);
  const unreadMessages = unreadMessagesForAgent(snapshot, agent.id).slice(0, 2);
  const handoffs = openHandoffsForAgent(snapshot, agent.id).slice(0, 2);
  const cliCommand = buildCliCommandHint();
  const firstSteps = [
    "Read .aibridge/CONTEXT.md before making changes.",
    "Inspect the repo and confirm the current working surface before coding.",
    `Acknowledge this session by running: ${cliCommand}agent start --session ${sessionId}`,
  ];
  const checklist = [
    "Use the canonical AiBridge CLI path below, not manual JSON edits.",
    "Record meaningful work through tasks, messages, handoffs, decisions, or logs.",
    "If you are blocked or handing off, create a handoff or warning message in AiBridge.",
    "Regenerate context after meaningful state changes.",
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
    assignedTasks.length > 0
      ? `Current assigned work:\n${assignedTasks.map((task) => `- ${task.title} [${task.status}]`).join("\n")}`
      : "Current assigned work:\n- No assigned tasks. Continue the highest-priority visible task or ask for clarification.",
    "",
    unreadMessages.length > 0
      ? `Unread messages:\n${unreadMessages.map((message) => `- ${message.fromAgentId}: ${message.content}`).join("\n")}`
      : "Unread messages:\n- None.",
    "",
    handoffs.length > 0
      ? `Open handoffs:\n${handoffs.map((handoff) => `- ${handoff.fromAgentId}: ${handoff.description}`).join("\n")}`
      : "Open handoffs:\n- None.",
    "",
    "Required workflow:",
    ...firstSteps.map((step) => `- ${step}`),
    ...checklist.map((step) => `- ${step}`),
    "",
    `Canonical CLI path: ${cliCommand}<command>`,
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
    cliCommand,
  };
}

function buildRecoveryPromptFromReason(
  snapshot: AibridgeBridgeSnapshot,
  session: AibridgeAgentSession,
  reason: string,
  lastActivityAt?: string,
) {
  const recentLogs = snapshot.logs
    .filter((entry) => entry.agentId === session.agentId && (!lastActivityAt || entry.timestamp > lastActivityAt))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 5);
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
    assignedTasks.length > 0
      ? `Current assigned tasks:\n${assignedTasks.map((task) => `- ${task.title} [${task.status}]`).join("\n")}`
      : "Current assigned tasks:\n- None.",
    "",
    unreadMessages.length > 0
      ? `Unread messages:\n${unreadMessages.map((message) => `- ${message.fromAgentId}: ${message.content}`).join("\n")}`
      : "Unread messages:\n- None.",
    "",
    handoffs.length > 0
      ? `Open handoffs:\n${handoffs.map((handoff) => `- ${handoff.fromAgentId}: ${handoff.description}`).join("\n")}`
      : "Open handoffs:\n- None.",
    "",
    recentLogs.length > 0
      ? `Recent activity since your last healthy checkpoint:\n${recentLogs.map((entry) => `- ${entry.timestamp}: ${entry.description}`).join("\n")}`
      : "Recent activity since your last healthy checkpoint:\n- No new logged activity.",
  ].join("\n");
}

export function deriveAgentSession(
  snapshot: AibridgeBridgeSnapshot,
  session: AibridgeAgentSession,
  now = new Date().toISOString(),
): AibridgeAgentSession {
  const latestLogActivity = snapshot.logs
    .filter((entry) => entry.agentId === session.agentId && entry.timestamp >= session.launchedAt)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0]?.timestamp;
  const lastActivityAt = pickLatestTimestamp(session.lastActivityAt, session.lastHeartbeatAt, latestLogActivity);
  const currentTaskIds = listAssignedTasks(snapshot, session.agentId).map((task) => task.id);
  const nowMs = toMillis(now);
  const launchMs = toMillis(session.launchedAt);
  const activityMs = toMillis(lastActivityAt);
  const staleReferenceMs = activityMs || launchMs;
  let status = session.status;
  let reason: string | undefined;

  if (session.status === "active" && nowMs - staleReferenceMs > ACTIVE_STALE_MS) {
    status = "stale";
    reason = "Agent session has gone stale and needs a restart prompt.";
  } else if (session.status === "pending" && nowMs - launchMs > PENDING_STALE_MS) {
    reason = "Agent session never acknowledged the latest context.";
  } else if ((session.status === "stopped" || session.status === "failed") && currentTaskIds.length > 0) {
    reason = session.recovery?.reason
      ?? (session.status === "stopped"
        ? "Agent stopped while assigned work remains."
        : "Agent session failed while assigned work remains.");
  }

  if (
    (session.status === "active" || session.status === "pending") &&
    session.acknowledgedContextTimestamp &&
    snapshot.lastSyncAt > session.acknowledgedContextTimestamp
  ) {
    status = status === "active" ? "stale" : status;
    reason = "Context changed after this agent acknowledged the workspace.";
  }

  const recoveryPrompt = reason
    ? buildRecoveryPromptFromReason(snapshot, { ...session, status }, reason, lastActivityAt)
    : session.recovery?.prompt;

  return {
    ...session,
    status,
    lastActivityAt,
    currentTaskIds,
    recovery: {
      recommended: Boolean(reason),
      reason,
      prompt: recoveryPrompt,
      generatedAt: recoveryPrompt ? now : session.recovery?.generatedAt,
    },
  };
}

export function sessionNotice(session: AibridgeAgentSession) {
  if (!session.recovery?.recommended || !session.recovery.reason) {
    return null;
  }

  return `${session.agentId} (${session.toolKind}) — ${session.recovery.reason}`;
}

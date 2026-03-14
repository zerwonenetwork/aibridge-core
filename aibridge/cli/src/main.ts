import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import {
  BridgeRuntimeError,
  acknowledgeMessage,
  addAgent,
  addConvention,
  addDecision,
  addLog,
  addMessage,
  addTask,
  getAgentSessionRecovery,
  createHandoff,
  getStatusSummary,
  heartbeatAgentSession,
  initBridge,
  launchAgentSession,
  type AibridgeStatus,
  listAgentSessions,
  listAnnouncements,
  listConventions,
  listDecisions,
  listHandoffs,
  listLogs,
  listMessages,
  listTasks,
  parseAgentLaunchSource,
  parseAgentSessionStatus,
  parseAgentToolKind,
  parseConventionCategory,
  parseDecisionStatus,
  parsePriority,
  parseTaskStatus,
  regenerateContext,
  startAgentSession,
  setConventions,
  showConventionsMarkdown,
  stopAgentSession,
  updateDecisionStatus,
  updateTask,
} from "../../runtime/store";
import { startLocalBridgeService } from "../../services/local/service";
import {
  getCaptureStatus,
  handleCaptureHook,
  installCaptureHooks,
  runCaptureDoctor,
  stopCaptureWatcher,
  startCaptureWatcher,
} from "../../services/capture/capture";
import {
  buildSetupResult,
  createSetupQuestionnaireDefaults,
  listSetupTemplates,
} from "../../../src/lib/aibridge/setup/service";
import { initializeLocalBridgeFromSetup } from "../../setup/local";
import type { SetupAgentMode, SetupPriority, SetupQuestionnaire, SetupTemplateId } from "../../../src/lib/aibridge/setup/types";
import {
  bold,
  commandText,
  dim,
  error,
  errorLine,
  errorPanel,
  headline,
  info,
  infoLine,
  kv,
  muted,
  note,
  panel,
  section,
  success,
  successLine,
  table,
  statusBadge,
  truncateText,
} from "./style";

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

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

function flagString(flags: ParsedArgs["flags"], name: string) {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function flagBoolean(flags: ParsedArgs["flags"], name: string) {
  return flags[name] === true;
}

function requireValue(value: string | undefined, message: string) {
  if (!value?.trim()) {
    throw new BridgeRuntimeError("BAD_REQUEST", message);
  }

  return value.trim();
}

function parseNumberFlag(flags: ParsedArgs["flags"], name: string) {
  const value = flagString(flags, name);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BridgeRuntimeError("BAD_REQUEST", `\`--${name}\` must be a number.`);
  }

  return parsed;
}

function parseListFlag(flags: ParsedArgs["flags"], name: string) {
  const value = flagString(flags, name);
  if (!value) {
    return undefined;
  }

  return value
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePriorityList(flags: ParsedArgs["flags"]) {
  const values = parseListFlag(flags, "priority") ?? parseListFlag(flags, "priorities");
  return values as SetupPriority[] | undefined;
}

function parseTemplateFlag(flags: ParsedArgs["flags"]) {
  return flagString(flags, "template") as SetupTemplateId | undefined;
}

function defaultSetupProjectName() {
  return path.basename(process.cwd()) || "aibridge-project";
}

function resolveAgentFlag(flags: ParsedArgs["flags"]) {
  return flagString(flags, "from") ?? flagString(flags, "agent") ?? process.env.AIBRIDGE_AGENT?.trim();
}

function toJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function usesSetupFlow(flags: ParsedArgs["flags"]) {
  return Boolean(
    flagString(flags, "template") ||
      flagString(flags, "description") ||
      flagString(flags, "deliverable") ||
      flagString(flags, "stack") ||
      flagString(flags, "priorities") ||
      flagString(flags, "priority") ||
      flagString(flags, "instructions") ||
      flagString(flags, "constraint") ||
      flagString(flags, "constraints") ||
      flagBoolean(flags, "interactive") ||
      flagBoolean(flags, "single-agent") ||
      flagBoolean(flags, "multi-agent") ||
      flagBoolean(flags, "existing-repo"),
  );
}

function resolveAgentMode(flags: ParsedArgs["flags"], fallback?: SetupAgentMode) {
  if (flagBoolean(flags, "single-agent")) {
    return "single-agent" as const;
  }

  if (flagBoolean(flags, "multi-agent")) {
    return "multi-agent" as const;
  }

  return fallback;
}

function buildSetupQuestionnaireFromFlags(flags: ParsedArgs["flags"]): Partial<SetupQuestionnaire> {
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
    customInstructions: flagString(flags, "instructions") ?? defaults.customInstructions,
  };
}

async function collectInteractiveSetupQuestionnaire(flags: ParsedArgs["flags"]) {
  const templateId = parseTemplateFlag(flags) ?? "web-app";
  const defaults = createSetupQuestionnaireDefaults(templateId);
  const cli = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = async (prompt: string, fallback?: string) => {
    const suffix = fallback ? ` [${fallback}]` : "";
    const answer = (await cli.question(`${prompt}${suffix}: `)).trim();
    return answer || fallback || "";
  };

  try {
    const projectName = await ask("Project name", flagString(flags, "name") ?? defaultSetupProjectName());
    const shortDescription = await ask("Short description / goal", flagString(flags, "description"));
    const chosenTemplate = (await ask("Template", templateId)) as SetupTemplateId;
    const templateDefaults = createSetupQuestionnaireDefaults(chosenTemplate);
    const primaryDeliverable = await ask("Primary deliverable", flagString(flags, "deliverable") ?? templateDefaults.primaryDeliverable);
    const preferredStack = (await ask("Preferred stack (comma-separated)", (parseListFlag(flags, "stack") ?? templateDefaults.preferredStack).join(",")))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const priorities = (await ask("Priorities (comma-separated)", (parsePriorityList(flags) ?? templateDefaults.priorities).join(",")))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean) as SetupPriority[];
    const agentMode = (await ask("Agent mode", resolveAgentMode(flags, templateDefaults.agentMode) ?? templateDefaults.agentMode)) as SetupAgentMode;
    const hardConstraints = (await ask("Hard constraints (comma-separated)", (parseListFlag(flags, "constraint") ?? templateDefaults.hardConstraints).join(",")))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const existingRepoAnswer = (await ask("Existing repo/files? (yes/no)", flagBoolean(flags, "existing-repo") ? "yes" : "no")).toLowerCase();
    const existingFilesSummary = existingRepoAnswer.startsWith("y")
      ? await ask("Existing repo/files summary", flagString(flags, "existing-files"))
      : "";
    const customInstructions = await ask("Custom instructions", flagString(flags, "instructions"));

    return {
      projectName,
      shortDescription,
      templateId: chosenTemplate,
      primaryDeliverable,
      preferredStack,
      priorities,
      agentMode,
      hardConstraints,
      existingRepo: existingRepoAnswer.startsWith("y"),
      existingFilesSummary,
      customInstructions,
    } satisfies SetupQuestionnaire;
  } finally {
    cli.close();
  }
}

function renderSetupPlan(result: ReturnType<typeof buildSetupResult>) {
  const lines: string[] = [
    kv("Project      ", result.brief.projectName),
    kv("Template     ", `${result.template.label} (${result.template.id})`),
    kv("Goal         ", result.brief.summary),
    kv("Deliverable  ", result.brief.primaryDeliverable),
    kv("Stack        ", result.brief.preferredStack.join(", ") || dim("(not specified)")),
    kv("Priorities   ", result.brief.priorities.join(", ") || dim("(not specified)")),
    kv("Agent mode   ", result.preferences.agentMode),
    "",
    bold("Starter Roles"),
  ];
  result.plan.starterAgentRoles.forEach((role) => {
    lines.push(note("•", `${role.name}${dim(` [${role.agentKind}]`)}`));
  });
  lines.push("", bold("Starter Tasks"));
  result.plan.starterTasks.forEach((task) => {
    lines.push(note("•", `${task.title}${dim(` (${task.priority})`)}`));
  });
  lines.push("", bold("Starter Conventions"));
  result.plan.conventions.forEach((convention) => {
    lines.push(note("•", convention.rule));
  });
  lines.push("", bold("Definition of Done"));
  result.plan.definitionOfDone.forEach((item) => {
    lines.push(note("•", item));
  });
  return panel("Setup Plan", lines.join("\n"));
}

function renderTaskTable(tasks: Awaited<ReturnType<typeof listTasks>>) {
  if (tasks.length === 0) {
    return muted("No tasks found.") + "\n";
  }
  const headers = ["ID", "STATUS", "PRIORITY", "AGENT", "TITLE"];
  const rows = tasks.map((t) => [t.id, t.status, t.priority, t.agentId ?? "-", truncateText(t.title)]);
  return table(headers, rows, { statusColumnIndex: 1 });
}

function renderMessageTable(messages: Awaited<ReturnType<typeof listMessages>>) {
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
    truncateText(m.content, 56),
  ]);
  return table(headers, rows, { statusColumnIndex: 3 });
}

function renderHandoffTable(handoffs: Awaited<ReturnType<typeof listHandoffs>>) {
  if (handoffs.length === 0) {
    return muted("No handoffs found.") + "\n";
  }
  const headers = ["ID", "FROM", "TO", "TIME", "DESCRIPTION"];
  const rows = handoffs.map((h) => [h.id, h.fromAgentId, h.toAgentId, h.timestamp, truncateText(h.description, 56)]);
  return table(headers, rows);
}

function renderDecisionTable(decisions: Awaited<ReturnType<typeof listDecisions>>) {
  if (decisions.length === 0) {
    return muted("No decisions found.") + "\n";
  }
  const headers = ["ID", "STATUS", "TIME", "TITLE"];
  const rows = decisions.map((d) => [d.id, d.status ?? "proposed", d.timestamp, truncateText(d.title)]);
  return table(headers, rows, { statusColumnIndex: 1 });
}

function renderConventionTable(conventions: Awaited<ReturnType<typeof listConventions>>) {
  if (conventions.length === 0) {
    return muted("No conventions found.") + "\n";
  }
  const headers = ["ID", "CATEGORY", "ADDED_AT", "RULE"];
  const rows = conventions.map((c) => [c.id, c.category ?? "other", c.addedAt, truncateText(c.rule, 64)]);
  return table(headers, rows);
}

function renderLogTable(logs: Awaited<ReturnType<typeof listLogs>>) {
  if (logs.length === 0) {
    return muted("No log entries found.") + "\n";
  }
  const headers = ["ID", "TIME", "AGENT", "ACTION", "DESCRIPTION"];
  const rows = logs.map((e) => [e.id, e.timestamp, e.agentId, e.action, truncateText(e.description, 56)]);
  return table(headers, rows);
}

function renderAgentSessionTable(sessions: Awaited<ReturnType<typeof listAgentSessions>>) {
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
    truncateText(session.recovery?.reason ?? "-", 56),
  ]);
  return table(headers, rows, { statusColumnIndex: 3 });
}

function formatTimestampForStatus(timestamp: string) {
  return timestamp.replace("T", " ").replace("Z", "Z");
}

function formatStatusTextStyled(status: Awaited<ReturnType<typeof getStatusSummary>>) {
  const criticalUnread = status.messages.filter((m) => !m.acknowledged && m.severity === "critical").length;
  const unread = status.messages.filter((m) => !m.acknowledged).length;
  const recentActivity = status.logs.slice(0, 5);
  const lines: string[] = [
    kv("Project      ", status.context.projectName),
    kv("Repo         ", status.context.repoPath),
    kv("Last sync    ", formatTimestampForStatus(status.context.lastSyncAt)),
    "",
    kv(
      "Tasks        ",
      `${status.context.taskCounts.pending} pending · ${status.context.taskCounts.in_progress} in progress · ${status.context.taskCounts.done} done`,
    ),
    kv(
      "Messages     ",
      (unread > 0 ? info(`${unread} unread`) : muted("0 unread")) +
        (criticalUnread > 0 ? " " + error(`(${criticalUnread} critical)`) : ""),
    ),
    kv("Handoffs     ", `${status.handoffs.length} open`),
    kv(
      "Agent sessions",
      status.sessions.length > 0
        ? `${status.sessions.filter((session) => session.status === "active").length} active · ${status.sessions.filter((session) => session.status === "stale").length} stale`
        : muted("none"),
    ),
    "",
    bold("Recent Activity"),
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

function renderCaptureStatusStyled(status: Awaited<ReturnType<typeof getCaptureStatus>>) {
  const lines: string[] = [
    kv("Watcher      ", statusBadge(status.watcher.running ? "running" : "stopped")),
    kv("Hooks        ", status.hooksInstalled.length > 0 ? status.hooksInstalled.join(", ") : dim("(none)")),
    kv("Warnings     ", String(status.validationWarnings)),
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
        `${status.watcher.attribution.agentId} via ${status.watcher.attribution.source} (${status.watcher.attribution.confidence})`,
      ),
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
  aibridge agent add <agent-id>
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
  return (
    headline("CLI") +
    "\n" +
    muted("Local workspace engine · hosted control plane companion · shared setup flow") +
    "\n\n" +
    section("Usage") +
    "\n" +
    usage.split("\n").map((line) => commandText(line)).join("\n") +
    "\n\n" +
    section("Examples") +
    "\n" +
    examples.split("\n").map((line) => commandText(line)).join("\n") +
    "\n\n" +
    section("Hints") +
    "\n" +
    note("•", `Use ${commandText("aibridge init --interactive")} for guided setup.`) +
    "\n" +
    note("•", `Use ${commandText("aibridge setup plan --template web-app")} to preview starter tasks and conventions.`) +
    "\n" +
    note("•", `Use ${commandText("aibridge agent launch --agent cursor --tool cursor")} to generate the startup handshake prompt.`) +
    "\n" +
    note("•", `Use ${commandText("aibridge serve")} to expose the local bridge to /dashboard.`) +
    "\n"
  );
}

async function writeIfNeeded(outputPath: string | undefined, markdown: string) {
  if (!outputPath) {
    return;
  }

  const resolved = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, markdown, "utf8");
}

function bridgeRoot() {
  return path.resolve(process.cwd(), ".aibridge");
}

function renderCreatedEntity(kind: string, entityId: string, details: Array<[string, string | undefined]>) {
  const lines = [successLine(`${kind} ready`), kv("ID           ", entityId)];
  details.forEach(([key, value]) => {
    if (value?.trim()) {
      lines.push(kv(`${key.padEnd(12, " ")}`, value));
    }
  });
  return `${lines.join("\n")}\n`;
}

/** Injected at build time by scripts/build-cli.mjs */
declare const __AIBRIDGE_CLI_VERSION__: string | undefined;

const CLI_VERSION = typeof __AIBRIDGE_CLI_VERSION__ === "string" ? __AIBRIDGE_CLI_VERSION__ : "0.0.0";

export async function runCli(rawArgs: string[], io: { stdout: (text: string) => void; stderr: (text: string) => void }) {
  const { positionals, flags } = parseArgs(rawArgs);
  const [command, subcommand, ...rest] = positionals;

  if (command === "-v" || flagBoolean(flags, "version")) {
    io.stdout(`${CLI_VERSION}\n`);
    return 0;
  }

  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.stdout(helpText());
    return 0;
  }

  switch (command) {
    case "init": {
      if (usesSetupFlow(flags)) {
        const questionnaire = flagBoolean(flags, "interactive")
          ? await collectInteractiveSetupQuestionnaire(flags)
          : {
              projectName: flagString(flags, "name")?.trim() || defaultSetupProjectName(),
              ...buildSetupQuestionnaireFromFlags(flags),
            };

        const initialized = await initializeLocalBridgeFromSetup(questionnaire, {
          cwd: process.cwd(),
          clearExistingData: flagBoolean(flags, "clear-existing"),
        });

        io.stdout(`${successLine(`Initialized AiBridge setup at ${initialized.rootPath}`)}\n`);
        io.stdout(renderSetupPlan(initialized.result));
        return 0;
      }

      const result = await initBridge({
        cwd: process.cwd(),
        name: flagString(flags, "name"),
        agents: parseListFlag(flags, "agents"),
      });

      io.stdout(
        `${successLine(
          result.alreadyInitialized
            ? `Already initialized at ${result.rootPath}`
            : `Initialized AiBridge at ${result.rootPath}`,
        )}\n`,
      );
      if (result.createdFiles.length > 0) {
        io.stdout(dim(result.createdFiles.map((filePath) => `  • ${filePath}`).join("\n")) + "\n");
      }
      return 0;
    }

    case "setup": {
      const normalizedSubcommand = subcommand ?? "plan";
      if (normalizedSubcommand === "plan") {
        const templateId = parseTemplateFlag(flags) ?? "web-app";
        const questionnaire = flagBoolean(flags, "interactive")
          ? await collectInteractiveSetupQuestionnaire(flags)
          : {
              projectName: flagString(flags, "name")?.trim() || defaultSetupProjectName(),
              templateId,
              ...buildSetupQuestionnaireFromFlags(flags),
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
          status: flagString(flags, "status") ? parseTaskStatus(flagString(flags, "status") as string) : undefined,
        });
        io.stdout(
          renderCreatedEntity("Task", task.id, [
            ["Title", task.title],
            ["Status", task.status],
            ["Priority", task.priority],
            ["Agent", task.agentId ?? "unassigned"],
          ]),
        );
        return 0;
      }

      if (subcommand === "list") {
        const tasks = await listTasks(bridgeRoot(), {
          status: flagString(flags, "status") ? parseTaskStatus(flagString(flags, "status") as string) : undefined,
          agentId: flagString(flags, "agent"),
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(tasks) : renderTaskTable(tasks));
        return 0;
      }

      if (subcommand === "update") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, {
          title: flagString(flags, "title"),
          status: flagString(flags, "status") ? parseTaskStatus(flagString(flags, "status") as string) : undefined,
          priority: flagString(flags, "priority") ? parsePriority(flagString(flags, "priority")) : undefined,
          agentId: flagString(flags, "assign"),
        });
        io.stdout(
          renderCreatedEntity("Task updated", task.id, [
            ["Title", task.title],
            ["Status", task.status],
            ["Priority", task.priority],
            ["Agent", task.agentId ?? "unassigned"],
          ]),
        );
        return 0;
      }

      if (subcommand === "assign") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const agentId = requireValue(rest[1], "Agent ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, { agentId });
        io.stdout(`${successLine(`Assigned task ${task.id} to ${agentId}`)}\n`);
        return 0;
      }

      if (subcommand === "in-progress") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, { status: "in_progress" });
        io.stdout(`${successLine(`Moved task ${task.id} to in progress`)}\n`);
        return 0;
      }

      if (subcommand === "done") {
        const taskId = requireValue(rest[0], "Task ID is required.");
        const task = await updateTask(bridgeRoot(), taskId, { status: "done" });
        io.stdout(`${successLine(`Marked task ${task.id} as done`)}\n`);
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
          severity: flagString(flags, "severity") as "info" | "warning" | "critical" | undefined,
          content,
        });
        io.stdout(
          renderCreatedEntity("Message sent", message.id, [
            ["From", message.fromAgentId],
            ["To", message.toAgentId ?? "broadcast"],
            ["Severity", message.severity],
          ]),
        );
        return 0;
      }

      if (normalizedSubcommand === "list") {
        const limitValue = flagString(flags, "limit");
        const messages = await listMessages(bridgeRoot(), {
          toAgentId: flagString(flags, "to"),
          severity: flagString(flags, "severity") as "info" | "warning" | "critical" | undefined,
          unreadOnly: flagBoolean(flags, "unread"),
          limit: limitValue ? parseNumberFlag(flags, "limit") : undefined,
        });
        io.stdout(flagBoolean(flags, "json") ? toJson(messages) : renderMessageTable(messages));
        return 0;
      }

      if (normalizedSubcommand === "ack") {
        const messageId = requireValue(rest[0], "Message ID is required.");
        const message = await acknowledgeMessage(bridgeRoot(), messageId);
        io.stdout(`${successLine(`Acknowledged message ${message.id}`)}\n`);
        return 0;
      }

      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown message subcommand.");
    }

    case "handoff": {
      const normalizedSubcommand =
        subcommand && !["create", "list"].includes(subcommand) ? "create" : subcommand ?? "create";

      if (normalizedSubcommand === "create") {
        const toAgentId = requireValue(subcommand === "create" ? rest[0] : subcommand, "Target agent ID is required.");
        const description = requireValue(
          (subcommand === "create" ? rest.slice(1) : rest).join(" "),
          "Handoff description is required.",
        );
        const fromAgentId = requireValue(resolveAgentFlag(flags), "`--from` is required.");
        const handoff = await createHandoff(bridgeRoot(), {
          fromAgentId,
          toAgentId,
          description,
          relatedTaskIds: flagString(flags, "tasks")?.split(",").filter(Boolean),
        });
        io.stdout(
          renderCreatedEntity("Handoff created", handoff.id, [
            ["From", handoff.fromAgentId],
            ["To", handoff.toAgentId],
            ["Tasks", handoff.relatedTaskIds?.join(", ") || "-"],
          ]),
        );
        return 0;
      }

      if (normalizedSubcommand === "list") {
        const handoffs = await listHandoffs(bridgeRoot(), {
          agentId: flagString(flags, "agent"),
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
          status: flagString(flags, "status") ? parseDecisionStatus(flagString(flags, "status") as string) : undefined,
          agentId: resolveAgentFlag(flags),
        });
        io.stdout(
          renderCreatedEntity("Decision recorded", decision.id, [
            ["Title", decision.title],
            ["Status", decision.status ?? "proposed"],
            ["Agent", decision.agentId ?? "-"],
          ]),
        );
        return 0;
      }

      if (normalizedSubcommand === "accept") {
        const decisionId = requireValue(rest[0], "Decision ID is required.");
        const decision = await updateDecisionStatus(bridgeRoot(), decisionId, "accepted", resolveAgentFlag(flags));
        io.stdout(`${successLine(`Accepted decision ${decision.id}`)}\n`);
        return 0;
      }

      if (normalizedSubcommand === "supersede") {
        const decisionId = requireValue(rest[0], "Decision ID is required.");
        const decision = await updateDecisionStatus(bridgeRoot(), decisionId, "superseded", resolveAgentFlag(flags));
        io.stdout(`${successLine(`Superseded decision ${decision.id}`)}\n`);
        return 0;
      }

      if (normalizedSubcommand === "list") {
        const decisions = await listDecisions(bridgeRoot(), {
          status: flagString(flags, "status") ? parseDecisionStatus(flagString(flags, "status") as string) : undefined,
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
          category: flagString(flags, "category")
            ? parseConventionCategory(flagString(flags, "category") as string)
            : undefined,
        });
        io.stdout(
          renderCreatedEntity("Convention added", convention.id, [
            ["Category", convention.category ?? "other"],
            ["Added by", convention.addedBy ?? "-"],
          ]),
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
        io.stdout(`${successLine(`Synced ${conventions.length} conventions into CONVENTIONS.md`)}\n`);
        return 0;
      }

      throw new BridgeRuntimeError("BAD_REQUEST", "Unknown convention subcommand.");
    }

    case "release":
    case "announcement": {
      throw new BridgeRuntimeError(
        "BAD_REQUEST",
        `\`${command}\` CLI commands have been removed. Manage hosted product updates and notices from /app as an admin.`,
      );
    }

    case "agent": {
      const normalizedSubcommand = subcommand ?? "status";

      if (normalizedSubcommand === "add") {
        const agentKind = requireValue(rest[0], "Agent kind is required (e.g. cursor, claude, codex, antigravity, copilot, windsurf, custom).");
        const result = await addAgent(bridgeRoot(), agentKind);
        if (result.added) {
          io.stdout(`${successLine(`Added agent ${result.agentId}`)}\n`);
        } else {
          io.stdout(`${info(result.reason)}\n`);
        }
        return 0;
      }

      if (normalizedSubcommand === "launch") {
        const agentId = requireValue(flagString(flags, "agent"), "`--agent` is required.");
        const toolKind = parseAgentToolKind(flagString(flags, "tool")) ?? "cursor";
        const session = await launchAgentSession(bridgeRoot(), {
          agentId,
          toolKind,
          launchSource: parseAgentLaunchSource(flagString(flags, "source")) ?? "cli",
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
                session.instructions.prompt,
              ].join("\n"),
            ),
          );
        }
        return 0;
      }

      if (normalizedSubcommand === "start") {
        const sessionId = requireValue(flagString(flags, "session") ?? rest[0], "`--session` is required.");
        const session = await startAgentSession(bridgeRoot(), sessionId);
        io.stdout(`${successLine(`Started agent session ${session.id}`)}\n`);
        return 0;
      }

      if (normalizedSubcommand === "heartbeat") {
        const sessionId = requireValue(flagString(flags, "session") ?? rest[0], "`--session` is required.");
        const session = await heartbeatAgentSession(bridgeRoot(), sessionId);
        io.stdout(`${successLine(`Heartbeat recorded for ${session.id}`)}\n`);
        return 0;
      }

      if (normalizedSubcommand === "stop") {
        const sessionId = requireValue(flagString(flags, "session") ?? rest[0], "`--session` is required.");
        const session = await stopAgentSession(bridgeRoot(), sessionId, {
          reason: flagString(flags, "reason"),
        });
        io.stdout(`${successLine(`Stopped agent session ${session.id}`)}\n`);
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
                session.recovery?.reason ? kv("Reason       ", session.recovery.reason) : undefined,
                "",
                bold("Prompt"),
                session.recovery?.prompt ?? dim("No recovery prompt needed."),
              ]
                .filter(Boolean)
                .join("\n"),
            ),
          );
        }
        return 0;
      }

      if (normalizedSubcommand === "status") {
        const sessions = await listAgentSessions(bridgeRoot(), {
          agentId: flagString(flags, "agent"),
          toolKind: parseAgentToolKind(flagString(flags, "tool")),
          status: parseAgentSessionStatus(flagString(flags, "status")),
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
        io.stdout(`${successLine(`Logged action ${action} for agent ${agentId}`)}\n`);
        return 0;
      }

      if (normalizedSubcommand === "list") {
        const logs = await listLogs(bridgeRoot(), {
          agentId: flagString(flags, "agent"),
          limit: parseNumberFlag(flags, "limit"),
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
        io.stdout(`${successLine(`Installed capture hooks in ${result.hooksDir}`)}\n`);
        if (result.installed.length > 0) {
          io.stdout(`${note("•", `New: ${result.installed.join(", ")}`)}\n`);
        }
        if (result.updated.length > 0) {
          io.stdout(`${note("•", `Updated: ${result.updated.join(", ")}`)}\n`);
        }
        return 0;
      }

      if (normalizedSubcommand === "doctor") {
        const result = await runCaptureDoctor({ cwd: process.cwd() });
        result.checks.forEach((check) => {
          io.stdout(`${check.ok ? successLine(check.name) : errorLine(check.name)}${check.details ? ` ${dim("—")} ${check.details}` : ""}\n`);
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
        io.stdout(`${result.details}\n`);
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
          scanIntervalMs,
        });

        io.stdout(`${infoLine("AiBridge capture watcher running. Press Ctrl+C or `aibridge capture stop` to stop.")}\n`);
        io.stdout(renderCaptureStatusStyled(await watcher.getStatus()));

        await new Promise<void>((resolve) => {
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
        const hookName = requireValue(rest[0], "Hook name is required.") as "post-commit" | "post-merge" | "post-checkout";
        await handleCaptureHook({
          cwd: process.cwd(),
          hookName,
          args: rest.slice(1),
          explicitAgentId: resolveAgentFlag(flags),
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

      const budget = flagString(flags, "budget") ? Number(flagString(flags, "budget")) : undefined;
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
        port: parseNumberFlag(flags, "port"),
      });

      io.stdout(
        `${successLine(
          service.ownsServer
            ? `AiBridge local service started on ${service.url}`
            : `AiBridge local service already running at ${service.url} for ${service.identity.cwd}`,
        )}\n`,
      );

      if (!service.ownsServer) {
        return 0;
      }

      await new Promise<void>((resolve) => {
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

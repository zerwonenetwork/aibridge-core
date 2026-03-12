import path from "node:path";
import { promises as fs } from "node:fs";
import { createSetupResult } from "../../src/lib/aibridge/setup/generator";
import type { LocalSetupInitializationOptions, SetupQuestionnaire } from "../../src/lib/aibridge/setup/types";
import {
  addDecision,
  addMessage,
  addTask,
  createHandoff,
  getStatusSummary,
  initBridge,
  regenerateContext,
  setConventions,
} from "../runtime/store";

function resolveLeadAgentId(agentKinds: string[]) {
  return agentKinds[0] ?? "cursor";
}

export async function initializeLocalBridgeFromSetup(
  questionnaire: Partial<SetupQuestionnaire> & Pick<SetupQuestionnaire, "projectName" | "templateId">,
  options: LocalSetupInitializationOptions = {},
) {
  const result = createSetupResult(questionnaire);
  const cwd = options.cwd ?? process.cwd();

  if (options.clearExistingData) {
    await fs.rm(path.join(cwd, ".aibridge"), { recursive: true, force: true });
  }

  const initResult = await initBridge({
    cwd,
    name: result.localBridge.projectName,
    agents: result.localBridge.agentKinds,
    setup: result.localBridge.setupMetadata,
  });

  const rootPath = initResult.rootPath;
  const leadAgentId = resolveLeadAgentId(result.localBridge.agentKinds);

  await setConventions(
    rootPath,
    result.plan.conventions.map((convention, index) => ({
      id: `setup-convention-${index + 1}`,
      rule: convention.rule,
      category: convention.category,
      addedBy: leadAgentId,
    })),
  );

  for (const task of result.plan.starterTasks) {
    const role = result.plan.starterAgentRoles.find((candidate) => candidate.key === task.suggestedRoleKey);
    await addTask(rootPath, {
      title: task.title,
      priority: task.priority,
      agentId: role?.agentKind,
      status: "pending",
    });
  }

  for (const message of result.plan.starterMessages) {
    const fromRole = result.plan.starterAgentRoles.find((role) => role.key === message.fromRoleKey);
    const toRole = result.plan.starterAgentRoles.find((role) => role.key === message.toRoleKey);
    await addMessage(rootPath, {
      fromAgentId: fromRole?.agentKind ?? leadAgentId,
      toAgentId: toRole?.agentKind,
      severity: message.severity,
      content: message.content,
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
      description: handoff.description,
    });
  }

  await addDecision(rootPath, {
    title: `${result.template.label} setup baseline`,
    summary: `Initialized from the ${result.template.id} template. Definition of done: ${result.plan.definitionOfDone.join("; ")}`,
    status: "accepted",
    agentId: leadAgentId,
  });

  const markdown = await regenerateContext(rootPath);
  const status = await getStatusSummary(rootPath);

  return {
    rootPath,
    result,
    initResult,
    status,
    markdown,
  };
}

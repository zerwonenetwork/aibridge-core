import { getSetupTemplate } from "./templates";
import type { SetupQuestionnaire, SetupTemplateId } from "./types";

export function createDefaultSetupQuestionnaire(templateId: SetupTemplateId = "web-app"): SetupQuestionnaire {
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
    customInstructions: "",
  };
}

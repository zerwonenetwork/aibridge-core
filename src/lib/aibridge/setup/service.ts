import { createDefaultSetupQuestionnaire } from "./questionnaire";
import { createSetupResult, generateProjectPlan } from "./generator";
import { getSetupTemplate, listSetupTemplates as listTemplates } from "./templates";
import type {
  CreateHostedProjectFromSetupOptions,
  SetupPlanPreview,
  SetupQuestionnaire,
  SetupTemplateId,
} from "./types";

export function listSetupTemplates() {
  return listTemplates();
}

export function getProjectSetupTemplate(templateId: SetupTemplateId) {
  return getSetupTemplate(templateId);
}

export function createSetupQuestionnaireDefaults(templateId: SetupTemplateId = "web-app") {
  return createDefaultSetupQuestionnaire(templateId);
}

export function previewSetupPlan(questionnaire: SetupQuestionnaire): SetupPlanPreview {
  const template = getSetupTemplate(questionnaire.templateId);
  if (!template) {
    throw new Error(`Unknown setup template: ${questionnaire.templateId}`);
  }

  return {
    template,
    questionnaire,
    plan: generateProjectPlan(questionnaire),
  };
}

export function buildSetupResult(questionnaire: Partial<SetupQuestionnaire> & Pick<SetupQuestionnaire, "projectName" | "templateId">) {
  return createSetupResult(questionnaire);
}

export function buildHostedProjectFromSetupPayload(
  questionnaire: Partial<SetupQuestionnaire> & Pick<SetupQuestionnaire, "projectName" | "templateId">,
  options: CreateHostedProjectFromSetupOptions = {},
) {
  const result = createSetupResult(questionnaire);
  return {
    slug: result.hostedProject.slug,
    name: result.hostedProject.name,
    description: result.hostedProject.description,
    visibility: options.visibility ?? "private",
    tags: options.tags ?? result.hostedProject.tags,
    localBridgeHint: options.localBridgeHint,
    setupTemplate: result.hostedProject.templateId,
    setupBrief: result.hostedProject.setupBrief,
    setupPreferences: result.hostedProject.setupPreferences,
    setupPlan: result.hostedProject.setupPlan,
    initializedAt: null,
    result,
  };
}

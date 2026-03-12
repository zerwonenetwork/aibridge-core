import { useCallback, useEffect, useState } from "react";
import type { LocalBridgeRequestOptions } from "@/lib/aibridge/local/client";
import { LocalBridgeClientError } from "@/lib/aibridge/local/client";
import {
  fetchSetupTemplates,
  initializeLocalBridgeFromSetupClient,
  previewLocalSetup,
} from "@/lib/aibridge/setup/client";
import { createSetupQuestionnaireDefaults, buildSetupResult } from "@/lib/aibridge/setup/service";
import { listSetupTemplates as listBuiltInTemplates } from "@/lib/aibridge/setup/templates";
import type {
  SetupQuestionnaire,
  SetupTemplate,
  SetupTemplateId,
} from "@/lib/aibridge/setup/types";

interface ProjectSetupState {
  templates: SetupTemplate[];
  defaults: SetupQuestionnaire;
  loading: boolean;
  error: Error | null;
}

export function useProjectSetup(templateId: SetupTemplateId = "web-app") {
  const [state, setState] = useState<ProjectSetupState>(() => ({
    templates: listBuiltInTemplates(),
    defaults: createSetupQuestionnaireDefaults(templateId),
    loading: true,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchSetupTemplates();
        if (cancelled) return;
        setState({
          templates: response.data.templates,
          defaults: createSetupQuestionnaireDefaults(templateId),
          loading: false,
          error: null,
        });
      } catch {
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          templates: previous.templates.length > 0 ? previous.templates : listBuiltInTemplates(),
          loading: false,
          error: null,
        }));
      }
    })();
    return () => { cancelled = true; };
  }, [templateId]);

  const previewPlan = useCallback(
    async (options: LocalBridgeRequestOptions, questionnaire: SetupQuestionnaire) => {
      try {
        const response = await previewLocalSetup(options, questionnaire);
        return response.data;
      } catch (error) {
        if (!(error instanceof LocalBridgeClientError) || error.code !== "SERVICE_UNAVAILABLE") {
          throw error;
        }
        const result = buildSetupResult(questionnaire);
        return { template: result.template, questionnaire: result.questionnaire, plan: result.plan, result };
      }
    },
    [],
  );

  const initializeLocal = useCallback(
    async (
      options: LocalBridgeRequestOptions,
      questionnaire: SetupQuestionnaire,
      initOptions?: { cwd?: string; clearExistingData?: boolean },
    ) => {
      const response = await initializeLocalBridgeFromSetupClient(options, questionnaire, initOptions);
      return response.data;
    },
    [],
  );

  return { ...state, previewPlan, initializeLocal };
}

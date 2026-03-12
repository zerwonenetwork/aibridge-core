import { useCallback, useEffect, useMemo, useState } from "react";
import { useProjectSetup } from "@/hooks/useProjectSetup";
import type { LocalBridgeRequestOptions } from "@/lib/aibridge/local/client";
import { LocalBridgeClientError } from "@/lib/aibridge/local/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WizardProgress, type WizardStep } from "./WizardProgress";
import { TemplateStep } from "./TemplateStep";
import { BasicsStep } from "./BasicsStep";
import { PreferencesStep } from "./PreferencesStep";
import { PlanPreviewStep } from "./PlanPreviewStep";
import { CreateProjectStep, type SetupWizardMode } from "./CreateProjectStep";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import type {
  GeneratedProjectPlan,
  SetupQuestionnaire,
  SetupResult,
  SetupTemplateId,
} from "@/lib/aibridge/setup/types";

const WIZARD_STEPS: WizardStep[] = [
  { id: "template", label: "Template", description: "Choose a project template" },
  { id: "basics", label: "Basics", description: "Name and describe your project" },
  { id: "preferences", label: "Preferences", description: "Stack, priorities, and agent mode" },
  { id: "preview", label: "Preview", description: "Review the generated plan" },
  { id: "create", label: "Create", description: "Initialize the project" },
];

interface SetupWizardProps {
  mode?: SetupWizardMode;
  initialTemplateId?: SetupTemplateId;
  localRequestOptions?: LocalBridgeRequestOptions;
  initialWorkspacePath?: string;
  requireWorkspacePath?: boolean;
  onLocalInitialized?: (payload: { rootPath: string; workspacePath: string }) => void;
}

function normalizeWorkspacePathFromBridgeRoot(rootPath: string) {
  return rootPath.replace(/[\\/]\.aibridge$/i, "");
}

function persistLocalDashboardWorkspace(workspacePath: string, adminToken?: string) {
  try {
    localStorage.setItem(
      "aibridge-data-source",
      JSON.stringify({
        mode: "local",
        localSource: "custom",
        customRoot: workspacePath,
        accessRole: "admin",
        adminToken: adminToken ?? "",
      }),
    );
  } catch {
    // Ignore storage failures during setup.
  }
}

function buildPreviewRequestOptions(options?: LocalBridgeRequestOptions): LocalBridgeRequestOptions {
  return {
    source: options?.source ?? "workspace",
    rootPath: options?.rootPath,
    accessRole: options?.accessRole ?? "admin",
    adminToken: options?.adminToken,
  };
}

export function SetupWizard({
  mode = "local",
  initialTemplateId = "web-app",
  localRequestOptions,
  initialWorkspacePath = "",
  requireWorkspacePath = false,
  onLocalInitialized,
}: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<SetupTemplateId>(initialTemplateId);
  const [localWorkspacePath, setLocalWorkspacePath] = useState(initialWorkspacePath);
  const [localAdminToken, setLocalAdminToken] = useState(localRequestOptions?.adminToken ?? "");
  const [clearExistingData, setClearExistingData] = useState(false);

  const {
    templates,
    defaults,
    loading: templatesLoading,
    error: templatesError,
    previewPlan,
    initializeLocal,
  } = useProjectSetup(selectedTemplate);

  const [questionnaire, setQuestionnaire] = useState<SetupQuestionnaire>(() => ({
    ...defaults,
    templateId: initialTemplateId,
  }));

  useEffect(() => {
    setLocalAdminToken(localRequestOptions?.adminToken ?? "");
  }, [localRequestOptions?.adminToken]);

  useEffect(() => {
    if (!initialWorkspacePath) return;
    setLocalWorkspacePath(initialWorkspacePath);
  }, [initialWorkspacePath]);

  useEffect(() => {
    if (defaults.templateId !== selectedTemplate) return;
    setQuestionnaire((prev) => {
      const next = { ...defaults, ...prev, templateId: selectedTemplate };
      if (!prev.primaryDeliverable || prev.templateId !== selectedTemplate) {
        next.primaryDeliverable = defaults.primaryDeliverable;
        next.preferredStack = defaults.preferredStack;
        next.priorities = defaults.priorities;
        next.agentMode = defaults.agentMode;
      }
      return next;
    });
  }, [defaults, selectedTemplate]);

  const handleTemplateSelect = useCallback((id: SetupTemplateId) => {
    setSelectedTemplate(id);
    setQuestionnaire((prev) => ({ ...prev, templateId: id }));
  }, []);

  const handleQuestionnaireChange = useCallback((patch: Partial<SetupQuestionnaire>) => {
    setQuestionnaire((prev) => ({ ...prev, ...patch }));
  }, []);

  const [plan, setPlan] = useState<GeneratedProjectPlan | null>(null);
  const [planResult, setPlanResult] = useState<SetupResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const currentRequestOptions = useMemo<LocalBridgeRequestOptions>(() => ({
    ...buildPreviewRequestOptions(localRequestOptions),
    adminToken: localAdminToken.trim() || localRequestOptions?.adminToken,
  }), [localAdminToken, localRequestOptions]);

  const generatePlan = useCallback(async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const generated = await previewPlan(currentRequestOptions, questionnaire);
      setPlan(generated.plan);
      setPlanResult(generated.result);
    } catch (err) {
      setPlanError((err as Error).message);
    } finally {
      setPlanLoading(false);
    }
  }, [currentRequestOptions, previewPlan, questionnaire]);

  const [creating, setCreating] = useState(false);
  const [initializedRootPath, setInitializedRootPath] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCompleteSetup = useCallback(async () => {
    if (requireWorkspacePath && !localWorkspacePath.trim()) {
      setCreateError("A local workspace path is required to initialize the bridge from the app.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const initResponse = await initializeLocal(
        { ...currentRequestOptions, adminToken: localAdminToken.trim() || undefined },
        questionnaire,
        { cwd: localWorkspacePath.trim() || undefined, clearExistingData },
      );

      const workspacePath = localWorkspacePath.trim() || normalizeWorkspacePathFromBridgeRoot(initResponse.rootPath);
      setInitializedRootPath(initResponse.rootPath);
      setPlanResult(initResponse.result);

      onLocalInitialized?.({ rootPath: initResponse.rootPath, workspacePath });
    } catch (err) {
      if (err instanceof LocalBridgeClientError) {
        setCreateError(err.message);
      } else {
        setCreateError((err as Error).message);
      }
    } finally {
      setCreating(false);
    }
  }, [clearExistingData, currentRequestOptions, initializeLocal, localAdminToken, localWorkspacePath, onLocalInitialized, questionnaire, requireWorkspacePath]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateBasics = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!questionnaire.projectName.trim()) errs.projectName = "Project name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [questionnaire.projectName]);

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 0: return true;
      case 1: return questionnaire.projectName.trim().length > 0;
      case 2: return true;
      case 3: return plan !== null;
      case 4: return false;
      default: return false;
    }
  }, [currentStep, plan, questionnaire.projectName]);

  const goNext = useCallback(async () => {
    if (currentStep === 1 && !validateBasics()) return;
    if (currentStep === 2) {
      setCurrentStep(3);
      await generatePlan();
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  }, [currentStep, generatePlan, validateBasics]);

  const goBack = useCallback(() => setCurrentStep((prev) => Math.max(prev - 1, 0)), []);

  const currentTemplate = templates.find((template) => template.id === selectedTemplate);

  if (templatesLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-32" />))}
        </div>
      </div>
    );
  }

  if (templatesError) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="border-destructive/30">
          <CardContent className="p-6 space-y-3">
            <p className="text-sm font-medium text-foreground">Failed to load setup templates</p>
            <p className="text-sm text-muted-foreground">{templatesError.message}</p>
            <p className="text-xs text-muted-foreground">
              Using the built-in setup engine templates instead. You can still continue.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayTemplates = templates.length > 0 ? templates : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <WizardProgress steps={WIZARD_STEPS} currentStep={currentStep} />
      <div className="min-h-[400px]">
        {currentStep === 0 && <TemplateStep templates={displayTemplates} selectedId={selectedTemplate} onSelect={handleTemplateSelect} />}
        {currentStep === 1 && <BasicsStep questionnaire={questionnaire} onChange={handleQuestionnaireChange} errors={errors} />}
        {currentStep === 2 && <PreferencesStep questionnaire={questionnaire} template={currentTemplate} onChange={handleQuestionnaireChange} />}
        {currentStep === 3 && <PlanPreviewStep plan={plan} loading={planLoading} error={planError} />}
        {currentStep === 4 && (
          <CreateProjectStep
            mode={mode}
            creating={creating}
            initializedRootPath={initializedRootPath}
            setupResult={planResult}
            error={createError}
            onCompleteSetup={handleCompleteSetup}
            projectName={questionnaire.projectName || "Untitled project"}
            localWorkspacePath={localWorkspacePath}
            onLocalWorkspacePathChange={setLocalWorkspacePath}
            localAdminToken={localAdminToken}
            onLocalAdminTokenChange={setLocalAdminToken}
            clearExistingData={clearExistingData}
            onClearExistingDataChange={setClearExistingData}
            requireWorkspacePath={requireWorkspacePath}
          />
        )}
      </div>
      {!(currentStep === 4 && initializedRootPath) && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={currentStep === 0 || creating} className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
          {currentStep < 4 && (
            <Button size="sm" onClick={goNext} disabled={!canGoNext || creating} className="gap-1.5">
              {currentStep === 2 ? "Generate plan" : "Next"} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {currentStep === 3 && plan && (
            <Button variant="outline" size="sm" onClick={generatePlan} disabled={planLoading || creating} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

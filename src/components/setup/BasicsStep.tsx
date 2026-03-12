import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { SetupQuestionnaire } from "@/lib/aibridge/setup/types";

interface BasicsStepProps {
  questionnaire: SetupQuestionnaire;
  onChange: (patch: Partial<SetupQuestionnaire>) => void;
  errors: Record<string, string>;
}

export function BasicsStep({ questionnaire, onChange, errors }: BasicsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground font-display">Project basics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Give your project a name and describe what you're building.
        </p>
      </div>

      <div className="space-y-5 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="projectName">Project name *</Label>
          <Input
            id="projectName"
            placeholder="e.g. acme-dashboard"
            value={questionnaire.projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
            className={errors.projectName ? "border-destructive" : ""}
          />
          {errors.projectName && (
            <p className="text-xs text-destructive">{errors.projectName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortDescription">Short description</Label>
          <Textarea
            id="shortDescription"
            placeholder="What is this project about? What problem does it solve?"
            value={questionnaire.shortDescription}
            onChange={(e) => onChange({ shortDescription: e.target.value })}
            className="min-h-[80px] resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryDeliverable">Primary deliverable</Label>
          <Input
            id="primaryDeliverable"
            placeholder={questionnaire.primaryDeliverable || "e.g. Responsive web app with user auth"}
            value={questionnaire.primaryDeliverable}
            onChange={(e) => onChange({ primaryDeliverable: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            The main outcome this project should produce.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="existingRepo" className="cursor-pointer">Existing repository</Label>
            <p className="text-xs text-muted-foreground">
              Are you adding AiBridge to an existing codebase?
            </p>
          </div>
          <Switch
            id="existingRepo"
            checked={questionnaire.existingRepo}
            onCheckedChange={(checked) => onChange({ existingRepo: checked })}
          />
        </div>

        {questionnaire.existingRepo && (
          <div className="space-y-2">
            <Label htmlFor="existingFilesSummary">Existing files summary</Label>
            <Textarea
              id="existingFilesSummary"
              placeholder="Brief description of the existing codebase structure..."
              value={questionnaire.existingFilesSummary ?? ""}
              onChange={(e) => onChange({ existingFilesSummary: e.target.value })}
              className="min-h-[60px] resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface WizardStep {
  id: string;
  label: string;
  description: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 border-2",
                  isComplete && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary bg-primary/10",
                  !isComplete && !isCurrent && "border-border text-muted-foreground bg-muted/30"
                )}
              >
                {isComplete ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <div className="hidden sm:block">
                <p
                  className={cn(
                    "text-xs font-medium leading-tight",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2">
                <div
                  className={cn(
                    "h-px w-full transition-colors duration-300",
                    isComplete ? "bg-primary" : "bg-border"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SetupTemplate, SetupTemplateId } from "@/lib/aibridge/setup/types";
import {
  Globe, Server, Smartphone, Layout, Bot, BookOpen, Box,
} from "lucide-react";

const templateIcons: Record<SetupTemplateId, React.ElementType> = {
  "web-app": Globe,
  "api-backend": Server,
  "mobile-app": Smartphone,
  "landing-page": Layout,
  "ai-automation": Bot,
  "research-docs": BookOpen,
  "empty": Box,
};

interface TemplateStepProps {
  templates: SetupTemplate[];
  selectedId: SetupTemplateId;
  onSelect: (id: SetupTemplateId) => void;
}

export function TemplateStep({ templates, selectedId, onSelect }: TemplateStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground font-display">Choose a template</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Templates define your project's starter structure, tasks, and agent roles. Pick the closest match — you can customize everything later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((template) => {
          const Icon = templateIcons[template.id] ?? Box;
          const isSelected = selectedId === template.id;

          return (
            <Card
              key={template.id}
              onClick={() => onSelect(template.id)}
              className={cn(
                "cursor-pointer transition-all duration-200 border-2",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{template.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {template.defaultAgentMode === "multi-agent" ? "Multi-agent" : "Single-agent"}
                  </Badge>
                  {template.suggestedStacks.slice(0, 3).map((stack) => (
                    <Badge key={stack} variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      {stack}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

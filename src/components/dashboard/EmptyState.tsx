import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Database, GitBranch, Play } from "lucide-react";

interface EmptyStateProps {
  type: "no-bridge" | "service-unavailable" | "no-data";
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "outline";
    icon?: React.ReactNode;
  }>;
  status?: {
    label: string;
    variant?: "destructive" | "warning" | "secondary";
  };
}

const iconMap = {
  "no-bridge": GitBranch,
  "service-unavailable": Database,
  "no-data": Play,
};

export function EmptyState({ type, title, description, actions = [], status }: EmptyStateProps) {
  const Icon = iconMap[type];

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className="bg-card border-border max-w-md w-full text-center">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Icon className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-display font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
            {status && (
              <Badge 
                variant={status.variant === "destructive" ? "destructive" : status.variant === "warning" ? "secondary" : "outline"} 
                className="text-xs"
              >
                <AlertCircle className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            )}
          </div>
          {actions.length > 0 && (
            <div className="flex flex-col gap-2">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || "default"}
                  onClick={action.onClick}
                  className="gap-2"
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
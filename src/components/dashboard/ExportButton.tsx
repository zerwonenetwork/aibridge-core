import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { AibridgeStatus } from "@/lib/aibridge/types";
import { exportBridgeState, snapshotToMarkdown } from "@/lib/aibridge/export";

interface ExportButtonProps {
  status: AibridgeStatus;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportButton({ status }: ExportButtonProps) {
  const { toast } = useToast();

  const handleExportJSON = () => {
    try {
      const json = exportBridgeState(status);
      const name = status.context.projectName.toLowerCase().replace(/\s+/g, "-");
      downloadFile(json, `aibridge-${name}-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      toast({ title: "Exported", description: "Bridge data downloaded as JSON." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleExportMarkdown = () => {
    try {
      const md = [
        `# ${status.context.projectName}`,
        "",
        `> Exported ${new Date().toISOString()}`,
        "",
        status.contextMarkdown || "",
      ].join("\n");
      const name = status.context.projectName.toLowerCase().replace(/\s+/g, "-");
      downloadFile(md, `aibridge-${name}-context.md`, "text/markdown");
      toast({ title: "Exported", description: "Context downloaded as Markdown." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportJSON}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportMarkdown}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Export Context as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

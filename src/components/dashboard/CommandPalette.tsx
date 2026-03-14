import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { LayoutDashboard, CheckSquare, Activity, MessageSquare, Bot, BookOpen, Scale, Search, Settings, Inbox } from "lucide-react";
import type { DashboardView } from "@/pages/Dashboard";
import type { AibridgeTask } from "@/lib/aibridge/types";

interface CommandPaletteProps {
  onNavigate: (view: DashboardView) => void;
  tasks: AibridgeTask[];
}

const views: { id: DashboardView; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "conventions", label: "Conventions", icon: BookOpen },
  { id: "decisions", label: "Decisions", icon: Scale },
  { id: "settings", label: "Settings", icon: Settings },
];

export function CommandPalette({ onNavigate, tasks }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (view: DashboardView) => {
    onNavigate(view);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search views, tasks..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {views.map(v => (
              <CommandItem key={v.id} onSelect={() => handleSelect(v.id)}>
                <v.icon className="mr-2 h-4 w-4" />
                {v.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {tasks.length > 0 && (
            <CommandGroup heading="Tasks">
              {tasks.slice(0, 8).map(t => (
                <CommandItem key={t.id} onSelect={() => handleSelect("tasks")}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {t.title}
                  <span className="ml-auto text-xs text-muted-foreground">{t.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

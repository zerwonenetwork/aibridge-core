import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AibridgeTask, AibridgeAgent, TaskStatus } from "@/lib/aibridge/types";
import { getAgentColor } from "@/lib/aibridge/agent-colors";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Plus, X } from "lucide-react";

interface TaskBoardProps {
  tasks: AibridgeTask[];
  agents: AibridgeAgent[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (title: string, status: TaskStatus) => void;
}

const columns: { status: TaskStatus; label: string; dotColor: string }[] = [
  { status: "pending", label: "Pending", dotColor: "bg-yellow-400" },
  { status: "in_progress", label: "In Progress", dotColor: "bg-primary" },
  { status: "done", label: "Done", dotColor: "bg-emerald-400" },
];

const priorityBadge: Record<string, string> = {
  high: "border-red-500/30 text-red-400",
  medium: "border-yellow-500/30 text-yellow-400",
  low: "border-muted-foreground/30 text-muted-foreground",
};

export function TaskBoard({ tasks, agents, onStatusChange, onAddTask }: TaskBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<AibridgeTask | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");

  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (agentFilter !== "all" && (t.agentId || "") !== agentFilter) return false;
    return true;
  });

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverCol(null), []);

  const handleDrop = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) onStatusChange(taskId, status);
    setDraggedId(null);
    setDragOverCol(null);
  }, [onStatusChange]);

  const handleDragEnd = useCallback(() => { setDraggedId(null); setDragOverCol(null); }, []);

  const handleAdd = (status: TaskStatus) => {
    if (newTitle.trim() && onAddTask) {
      onAddTask(newTitle.trim(), status);
      setNewTitle("");
      setAddingTo(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-foreground">Task Board</h2>
        <div className="flex gap-2">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Agent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.status);
          const isOver = dragOverCol === col.status;
          return (
            <div
              key={col.status}
              className={`space-y-2 rounded-lg p-2 transition-colors duration-200 ${isOver ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className="text-xs font-display font-medium text-foreground uppercase tracking-wider">{col.label}</span>
                <Badge variant="outline" className="text-[10px] ml-auto">{colTasks.length}</Badge>
              </div>

              {/* Inline add */}
              {addingTo === col.status ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAdd(col.status)}
                    placeholder="Task title..."
                    className="h-8 text-xs"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => { setAddingTo(null); setNewTitle(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground h-7 gap-1"
                  onClick={() => setAddingTo(col.status)}
                >
                  <Plus className="w-3.5 h-3.5" /> Add task
                </Button>
              )}

              <div className="space-y-2 min-h-[80px]">
                <AnimatePresence mode="popLayout">
                  {colTasks.map(task => {
                    const agent = agents.find(a => a.id === task.agentId);
                    const agentColor = agent ? getAgentColor(agent.kind) : null;
                    const isDragged = draggedId === task.id;
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: isDragged ? 0.5 : 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          className="bg-card border-border card-hover cursor-grab active:cursor-grabbing"
                          onClick={() => setSelectedTask(task)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                <p className="text-sm font-medium text-foreground">{task.title}</p>
                              </div>
                              <Badge variant="outline" className={`text-[10px] shrink-0 border ${priorityBadge[task.priority]}`}>{task.priority}</Badge>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              {agent ? (
                                <Badge className={`text-[10px] font-display border ${agentColor?.bg} ${agentColor?.text} ${agentColor?.border}`}>
                                  {agent.name}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">Updated {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail sheet */}
      <Sheet open={!!selectedTask} onOpenChange={open => !open && setSelectedTask(null)}>
        <SheetContent>
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">{selectedTask.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground text-xs">Status</span><p className="font-medium text-foreground">{selectedTask.status}</p></div>
                  <div><span className="text-muted-foreground text-xs">Priority</span><p className="font-medium text-foreground">{selectedTask.priority}</p></div>
                  <div><span className="text-muted-foreground text-xs">Agent</span><p className="font-medium text-foreground">{agents.find(a => a.id === selectedTask.agentId)?.name || "Unassigned"}</p></div>
                  <div><span className="text-muted-foreground text-xs">ID</span><p className="font-mono text-foreground text-xs">{selectedTask.id}</p></div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Created {formatDistanceToNow(new Date(selectedTask.createdAt), { addSuffix: true })}</p>
                  <p>Updated {formatDistanceToNow(new Date(selectedTask.updatedAt), { addSuffix: true })}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

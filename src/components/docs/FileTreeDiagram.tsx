import { motion } from "framer-motion";
import { Folder, FileText, FolderOpen } from "lucide-react";

interface FileTreeItem {
  name: string;
  type: "file" | "folder";
  comment?: string;
  children?: FileTreeItem[];
}

const treeData: FileTreeItem[] = [
  {
    name: ".aibridge/",
    type: "folder",
    children: [
      { name: "bridge.json", type: "file", comment: "Project metadata & agent registry" },
      { name: "CONTEXT.md", type: "file", comment: "Auto-generated context snapshot" },
      { name: "CONVENTIONS.md", type: "file", comment: "Shared coding conventions" },
      {
        name: "agents/",
        type: "folder",
        comment: "Per-agent instruction files",
        children: [
          { name: "cursor.md", type: "file" },
          { name: "claude.md", type: "file" },
          { name: "codex.md", type: "file" },
        ],
      },
      { name: "tasks/", type: "folder", comment: "One JSON file per task" },
      { name: "handoffs/", type: "folder", comment: "Agent-to-agent handoff records" },
      { name: "decisions/", type: "folder", comment: "Architectural decision records" },
      { name: "messages/", type: "folder", comment: "Inter-agent messages" },
    ],
  },
];

const stagger = { show: { transition: { staggerChildren: 0.04 } } };
const fadeIn = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { duration: 0.3 } } };

function TreeNode({ item, depth = 0 }: { item: FileTreeItem; depth?: number }) {
  const isFolder = item.type === "folder";
  const Icon = isFolder ? (depth === 0 ? FolderOpen : Folder) : FileText;
  const iconColor = isFolder ? "text-amber-400" : "text-muted-foreground/70";
  const nameColor = isFolder ? "text-foreground font-semibold" : "text-foreground/80";

  return (
    <>
      <motion.div
        variants={fadeIn}
        className="flex items-center gap-2 py-1 group"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {depth > 0 && (
          <span
            className="absolute border-l border-border/40"
            style={{ left: `${(depth - 1) * 20 + 18}px`, height: "100%" }}
          />
        )}
        <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
        <span className={`text-sm font-mono ${nameColor}`}>{item.name}</span>
        {item.comment && (
          <span className="text-xs text-muted-foreground/50 ml-1 hidden sm:inline">
            {item.comment}
          </span>
        )}
      </motion.div>
      {item.children?.map((child) => (
        <TreeNode key={child.name} item={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function FileTreeDiagram() {
  return (
    <motion.div
      className="my-6 rounded-xl border border-border bg-card/50 overflow-hidden"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      variants={stagger}
    >
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-xs text-muted-foreground font-mono ml-2">Project directory</span>
      </div>
      <div className="p-3 relative">
        {treeData.map((item) => (
          <TreeNode key={item.name} item={item} />
        ))}
      </div>
    </motion.div>
  );
}

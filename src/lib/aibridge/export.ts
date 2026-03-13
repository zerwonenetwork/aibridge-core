import type {
  AibridgeBridgeSnapshot,
  AibridgeConvention,
  AibridgeDecision,
  AibridgeStatus,
  AibridgeTask,
} from "./types";

export function conventionsToMarkdown(items: AibridgeConvention[]): string {
  return `# Conventions\n\n${items.map((c, i) => `${i + 1}. ${c.rule}`).join("\n")}`;
}

export function decisionsToMarkdown(items: AibridgeDecision[]): string {
  return `# Architecture Decisions\n\n${items.map(d => `## ${d.title}\n${d.summary}`).join("\n\n")}`;
}

export function tasksToMarkdown(items: AibridgeTask[]): string {
  const grouped = { pending: items.filter(t => t.status === "pending"), in_progress: items.filter(t => t.status === "in_progress"), done: items.filter(t => t.status === "done") };
  return `# Tasks\n\n${Object.entries(grouped).map(([s, ts]) => `## ${s}\n${ts.map(t => `- [${t.priority}] ${t.title}`).join("\n")}`).join("\n\n")}`;
}

export function toJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export interface AibridgeExportBundle {
  exportedAt: string;
  schemaVersion: string;
  status: AibridgeStatus;
}

export function exportBridgeState(status: AibridgeStatus): string {
  const bundle: AibridgeExportBundle = {
    exportedAt: new Date().toISOString(),
    schemaVersion: status.context.schemaVersion,
    status,
  };

  return toJSON(bundle);
}

export function importBridgeState(serialized: string): AibridgeStatus {
  const parsed = JSON.parse(serialized);

  if (parsed?.status?.context?.projectName) {
    return parsed.status as AibridgeStatus;
  }

  if (parsed?.context?.projectName) {
    return parsed as AibridgeStatus;
  }

  throw new Error("Unsupported AiBridge export payload.");
}

export function snapshotToMarkdown(snapshot: AibridgeBridgeSnapshot): string {
  return [
    `# ${snapshot.bridge.projectName}`,
    "",
    `Repo: ${snapshot.repoPath}`,
    `Schema: ${snapshot.bridge.schemaVersion}`,
    `Last sync: ${snapshot.lastSyncAt}`,
    "",
    tasksToMarkdown(snapshot.tasks),
    "",
    decisionsToMarkdown(snapshot.decisions),
    "",
    conventionsToMarkdown(snapshot.conventions),
  ].join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

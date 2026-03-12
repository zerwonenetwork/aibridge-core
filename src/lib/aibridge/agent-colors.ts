/** Agent-specific color tokens used consistently across the dashboard */
export const agentColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  cursor:      { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20",   dot: "bg-blue-400" },
  claude:      { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",  dot: "bg-amber-400" },
  codex:       { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  copilot:     { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-400" },
  windsurf:    { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/20",   dot: "bg-cyan-400" },
  antigravity: { bg: "bg-pink-500/10",   text: "text-pink-400",   border: "border-pink-500/20",   dot: "bg-pink-400" },
  custom:      { bg: "bg-muted",         text: "text-muted-foreground", border: "border-border", dot: "bg-muted-foreground" },
};

export function getAgentColor(kind: string) {
  return agentColors[kind] ?? agentColors.custom;
}

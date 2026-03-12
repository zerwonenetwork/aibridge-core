import chalk from "chalk";

/** Use styled output only when stdout is a TTY (interactive terminal). */
const useColor = process.stdout?.isTTY === true;
const ansiPattern = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");

function noop(s: string): string {
  return s;
}

function stripAnsi(value: string) {
  return value.replace(ansiPattern, "");
}

function visibleLength(value: string) {
  return stripAnsi(value).length;
}

export const dim = useColor ? chalk.dim : noop;
export const bold = useColor ? chalk.bold : noop;
export const success = useColor ? chalk.green : noop;
export const error = useColor ? chalk.red : noop;
export const warning = useColor ? chalk.yellow : noop;
export const info = useColor ? chalk.cyan : noop;
export const muted = useColor ? chalk.gray : noop;
export const label = useColor ? chalk.dim : noop;
export const id = useColor ? chalk.magenta : noop;

const brandCyan = useColor ? chalk.hex("#52e3ff") : noop;
const brandMint = useColor ? chalk.hex("#2ce6a6") : noop;
const brandAmber = useColor ? chalk.hex("#f5c451") : noop;
const brandSurface = useColor ? chalk.hex("#8aa0a6") : noop;

export const headline = useColor
  ? (s: string) => `${brandMint("◢")} ${chalk.bold(brandCyan(s))}`
  : (s: string) => `AiBridge ${s}`;

export function section(title: string) {
  return useColor
    ? `${brandSurface("─")} ${chalk.bold(brandMint(title))}`
    : `${title}:`;
}

export function commandText(value: string) {
  return useColor ? chalk.bold(brandCyan(value)) : value;
}

export function note(symbol: string, text: string) {
  return useColor ? `${brandMint(symbol)} ${text}` : `${symbol} ${text}`;
}

export function successLine(text: string) {
  return useColor ? `${brandMint("✓")} ${success(text)}` : `OK ${text}`;
}

export function errorLine(text: string) {
  return useColor ? `${chalk.red("✕")} ${error(text)}` : `ERROR ${text}`;
}

export function warningLine(text: string) {
  return useColor ? `${brandAmber("!")} ${warning(text)}` : `WARN ${text}`;
}

export function infoLine(text: string) {
  return useColor ? `${brandCyan("•")} ${info(text)}` : `INFO ${text}`;
}

export function kv(labelText: string, value: string) {
  return `${label(labelText)}${value}`;
}

export function panel(title: string, body: string) {
  if (!useColor) {
    return `${title}\n${body}`;
  }

  const lines = body.replace(/\n$/, "").split("\n");
  const terminalWidth = process.stdout?.columns ?? 96;
  const maxWidth = Math.max(48, Math.min(96, terminalWidth - 2));
  const contentWidth = Math.max(visibleLength(title) + 4, ...lines.map((line) => visibleLength(line))) + 4;

  if (contentWidth > maxWidth) {
    return `${title}\n${body}`;
  }

  const width = contentWidth;
  const top = `${brandSurface("╭")}${brandSurface("─".repeat(Math.max(1, width - 2)))}${brandSurface("╮")}`;
  const bottom = `${brandSurface("╰")}${brandSurface("─".repeat(Math.max(1, width - 2)))}${brandSurface("╯")}`;
  const styledTitle = chalk.bold(brandMint(title));
  const titlePadding = Math.max(0, width - visibleLength(styledTitle) - 3);
  const titleRow = `${brandSurface("│")} ${styledTitle}${" ".repeat(titlePadding)}${brandSurface("│")}`;
  const contentRows = lines.map((line) => {
    const padding = Math.max(0, width - visibleLength(line) - 3);
    return `${brandSurface("│")} ${line}${" ".repeat(padding)}${brandSurface("│")}`;
  });

  return [top, titleRow, ...contentRows, bottom].join("\n") + "\n";
}

export function truncateText(value: string, maxLength = 52) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function errorPanel(title: string, message: string, details?: string) {
  const body = [errorLine(message), details ? muted(details) : undefined]
    .filter(Boolean)
    .join("\n");
  return panel(title, body);
}

/** Status badges with consistent width for table alignment */
export function statusBadge(value: string): string {
  if (!useColor) return value;
  const lower = value.toLowerCase();
  if (["done", "published", "accepted", "yes", "running", "connected"].includes(lower)) return brandMint(value);
  if (["in_progress", "pending", "draft", "proposed"].includes(lower)) return brandAmber(value);
  if (["critical", "fail", "superseded", "archived", "stopped"].includes(lower)) return chalk.red(value);
  if (["warning"].includes(lower)) return brandAmber(value);
  if (["info"].includes(lower)) return brandCyan(value);
  return brandSurface(value);
}

/**
 * Format rows as a table with styled header. Columns are separated by two spaces;
 * header is bold and dim; optional status column coloring via statusBadge.
 */
export function table(
  headers: string[],
  rows: string[][],
  options?: { statusColumnIndex?: number },
): string {
  const colWidths = headers.map((h, i) => {
    const maxContent = Math.max(
      visibleLength(headers[i]),
      ...rows.map((r) => visibleLength(r[i] ?? "")),
    );
    return Math.min(maxContent + 2, 40);
  });

  const pad = (s: string, i: number) => {
    const target = colWidths[i] ?? visibleLength(s);
    const padding = Math.max(0, target - visibleLength(s));
    return s + " ".repeat(padding);
  };
  const headerRow = headers.map((h, i) => pad(bold(h), i)).join("");
  const separator = muted(headers.map((_, i) => "─".repeat(Math.min(colWidths[i] ?? 0, 36))).join(""));
  const dataRows = rows.map((row) =>
    row
      .map((cell, i) => {
        const styled = options?.statusColumnIndex === i ? statusBadge(cell) : cell;
        return pad(styled, i);
      })
      .join(""),
  );

  return [headerRow, separator, ...dataRows].join("\n") + "\n";
}

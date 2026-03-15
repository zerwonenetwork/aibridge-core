import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type {
  AibridgeAgentDispatchStatus,
  AibridgeAgentLaunchMode,
  AibridgeAgentToolCapability,
  AibridgeAgentToolKind,
} from "../../src/lib/aibridge/types";

const DETECT_TIMEOUT_MS = 1500;

type DispatchResult = {
  dispatchStatus: AibridgeAgentDispatchStatus;
  dispatchNote?: string;
};

const CAPABILITY_DEFAULTS: Record<
  AibridgeAgentToolKind,
  Omit<AibridgeAgentToolCapability, "tool" | "installed" | "version">
> = {
  cursor: {
    promptCopy: true,
    uiDispatch: false,
    recoveryDispatch: false,
    nonChatExec: false,
    fileAttach: false,
    generatedRules: true,
    mcpSupport: true,
  },
  antigravity: {
    promptCopy: true,
    uiDispatch: true,
    recoveryDispatch: true,
    nonChatExec: false,
    fileAttach: true,
    generatedRules: false,
    mcpSupport: true,
  },
  codex: {
    promptCopy: true,
    uiDispatch: false,
    recoveryDispatch: false,
    nonChatExec: true,
    fileAttach: true,
    generatedRules: true,
    mcpSupport: false,
  },
};

function launchModeForTool(toolKind: AibridgeAgentToolKind): AibridgeAgentLaunchMode {
  if (toolKind === "antigravity") {
    return "ui_dispatch";
  }
  if (toolKind === "codex") {
    return "non_chat_exec";
  }
  return "prompt_copy";
}

function powerShellQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function captureCommand(command: string, args: string[]) {
  return new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ ok: false, stdout, stderr });
    }, DETECT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", () => {
      clearTimeout(timeout);
      resolve({ ok: false, stdout, stderr });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

async function resolveCommandPath(command: string) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = await captureCommand(checker, [command]);
  if (!result.ok) {
    return null;
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? null;
}

async function launchDetached(commandPath: string, args: string[], cwd: string) {
  if (process.platform === "win32") {
    const script = [`& ${powerShellQuote(commandPath)}`, ...args.map(powerShellQuote)].join(" ");
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      },
    );
    child.unref();
    return;
  }

  const child = spawn(commandPath, args, {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function writeTemporaryPrompt(prompt: string) {
  const promptFile = path.join(os.tmpdir(), `aibridge-codex-${randomUUID()}.prompt.md`);
  await fs.writeFile(promptFile, prompt, "utf8");
  return promptFile;
}

async function detectCodexSubcommand() {
  const help = await captureCommand("codex", ["--help"]);
  const output = `${help.stdout}\n${help.stderr}`;
  if (/\bexec\b/i.test(output)) {
    return "exec";
  }
  if (/\brun\b/i.test(output)) {
    return "run";
  }
  return "exec";
}

export async function listAgentToolCapabilities(): Promise<AibridgeAgentToolCapability[]> {
  const entries = await Promise.all(
    (Object.keys(CAPABILITY_DEFAULTS) as AibridgeAgentToolKind[]).map(async (tool) => {
      const command = tool === "antigravity" ? "antigravity" : tool;
      const commandPath = await resolveCommandPath(command);
      return {
        tool,
        installed: Boolean(commandPath),
        version: undefined,
        ...CAPABILITY_DEFAULTS[tool],
      } satisfies AibridgeAgentToolCapability;
    }),
  );

  return entries;
}

export function launchPresentation(
  toolKind: AibridgeAgentToolKind,
  sessionId: string,
  agentConfigPath: string,
) {
  if (toolKind === "antigravity") {
    return {
      mode: launchModeForTool(toolKind),
      title: "Launch in Antigravity",
      subtitle: "AiBridge can open an Antigravity agent session directly or give you a copy-safe prompt.",
      filesToAttach: [".aibridge/CONTEXT.md", "AGENTS.md", agentConfigPath],
      commandPreview: `antigravity chat "<prompt>" --mode agent --reuse-window --add-file ".aibridge/CONTEXT.md" --add-file "AGENTS.md" --add-file "${agentConfigPath}"`,
    };
  }

  if (toolKind === "codex") {
    return {
      mode: launchModeForTool(toolKind),
      title: "Run with Codex",
      subtitle: "AiBridge can attempt a non-chat Codex execution, then fall back to copy-safe prompts.",
      filesToAttach: [".aibridge/CONTEXT.md", "AGENTS.md", agentConfigPath],
      commandPreview: `codex exec --prompt-file ".aibridge/prompts/launch-${sessionId}.md"`,
    };
  }

  return {
    mode: launchModeForTool(toolKind),
    title: "What to paste into Cursor",
    subtitle: "Cursor uses the launch prompt plus generated rules and context files.",
    filesToAttach: [".aibridge/CONTEXT.md", ".cursor/rules/aibridge.mdc", agentConfigPath],
    commandPreview: undefined,
  };
}

export function recoveryPresentation(toolKind: AibridgeAgentToolKind, sessionId: string) {
  if (toolKind === "antigravity") {
    return {
      mode: launchModeForTool(toolKind),
      filesToAttach: [".aibridge/CONTEXT.md", "AGENTS.md"],
      commandPreview: `antigravity chat "<recovery prompt>" --mode agent --reuse-window --add-file ".aibridge/CONTEXT.md" --add-file "AGENTS.md"`,
    };
  }

  if (toolKind === "codex") {
    return {
      mode: launchModeForTool(toolKind),
      filesToAttach: [".aibridge/CONTEXT.md", "AGENTS.md"],
      commandPreview: `codex exec --prompt-file ".aibridge/prompts/recover-${sessionId}.md"`,
    };
  }

  return {
    mode: launchModeForTool(toolKind),
    filesToAttach: [".aibridge/CONTEXT.md", ".cursor/rules/aibridge.mdc"],
    commandPreview: undefined,
  };
}

export async function dispatchLaunchOrRecovery(
  toolKind: AibridgeAgentToolKind,
  repoRoot: string,
  prompt: string,
  filesToAttach: string[],
) : Promise<DispatchResult> {
  if (toolKind === "cursor") {
    return {
      dispatchStatus: "unsupported",
      dispatchNote: "Cursor foreground chat injection is not exposed as a stable local API. Copy the prompt into Cursor instead.",
    };
  }

  if (toolKind === "antigravity") {
    const commandPath = await resolveCommandPath("antigravity");
    if (!commandPath) {
      return {
        dispatchStatus: "failed",
        dispatchNote: "Antigravity is not installed or not available on PATH.",
      };
    }

    const args = ["chat", prompt, "--mode", "agent", "--reuse-window"];
    for (const file of filesToAttach) {
      args.push("--add-file", file);
    }

    await launchDetached(commandPath, args, repoRoot);
    return {
      dispatchStatus: "launched",
      dispatchNote: "Antigravity launch command was dispatched from AiBridge.",
    };
  }

  return runCodexNonChat(repoRoot, prompt);
}

export async function runCodexNonChat(repoRoot: string, prompt: string): Promise<DispatchResult> {
  const commandPath = await resolveCommandPath("codex");
  if (!commandPath) {
    return {
      dispatchStatus: "failed",
      dispatchNote: "Codex is not installed or not available on PATH.",
    };
  }

  const subcommand = await detectCodexSubcommand();
  const promptFile = await writeTemporaryPrompt(prompt);
  const candidateArgs =
    subcommand === "run"
      ? [subcommand, "--prompt-file", promptFile]
      : [subcommand, "--prompt-file", promptFile];

  try {
    await launchDetached(commandPath, candidateArgs, repoRoot);
    return {
      dispatchStatus: "launched",
      dispatchNote: "Codex non-chat execution was dispatched from AiBridge.",
    };
  } catch (error) {
    return {
      dispatchStatus: "failed",
      dispatchNote: `Codex dispatch failed: ${(error as Error).message}`,
    };
  }
}


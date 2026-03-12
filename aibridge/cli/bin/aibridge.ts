#!/usr/bin/env node

import { runCli } from "../src/main";
import { errorPanel } from "../src/style";

async function main() {
  try {
    const exitCode = await runCli(process.argv.slice(2), {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
    });
    process.exitCode = exitCode;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const details = err instanceof Error && err.name ? `${err.name}` : undefined;
    process.stderr.write(errorPanel("AiBridge CLI Error", message, details));
    process.exitCode = 1;
  }
}

void main();

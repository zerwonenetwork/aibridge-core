#!/usr/bin/env node

import { startLocalBridgeService } from "../service";

function readFlag(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const portValue = readFlag("port");
  const hostValue = readFlag("host");
  const service = await startLocalBridgeService({
    cwd: process.cwd(),
    host: hostValue,
    port: portValue ? Number(portValue) : undefined,
  });

  process.stdout.write(`[aibridge] local service listening at ${service.url}\n`);

  const shutdown = async () => {
    if (service.ownsServer) {
      await service.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main();

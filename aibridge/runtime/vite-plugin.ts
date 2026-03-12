import type { Plugin } from "vite";
import { ensureLocalBridgeService } from "../services/local/service";

export function aibridgeLocalApiPlugin(): Plugin {
  let serviceStarted = false;

  return {
    name: "aibridge-local-service-adapter",
    async configureServer(server) {
      if (serviceStarted) {
        return;
      }

      serviceStarted = true;
      const service = await ensureLocalBridgeService({
        cwd: server.config.root,
      });

      server.config.logger.info(
        `[aibridge] local service available at ${service.url}`,
        { timestamp: true },
      );

      server.httpServer?.once("close", () => {
        if (!service.ownsServer) {
          return;
        }

        void service.close();
      });
    },
  };
}

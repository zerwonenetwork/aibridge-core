import type { Server } from "node:http";
import type { AibridgeLocalSource } from "../../../src/lib/aibridge/types";
import { createLocalBridgeHttpServer } from "./service";

export interface LocalBridgeServerOptions {
  port?: number;
  host?: string;
  cwd?: string;
  source?: AibridgeLocalSource;
  customRoot?: string;
  pollIntervalMs?: number;
}

export class LocalBridgeServer {
  private readonly server: Server;
  private readonly host: string;
  private readonly port: number;

  constructor(private readonly options: LocalBridgeServerOptions = {}) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 4545;
    this.server = createLocalBridgeHttpServer(options);
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, () => {
        this.server.off("error", reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  getPort(): number {
    const address = this.server.address();
    return typeof address === "object" && address !== null ? address.port : this.port;
  }
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BridgeRuntimeError } from "../../runtime/store";
import { ensureLocalBridgeService } from "../local/service";

const DEFAULT_DASHBOARD_HOST = "127.0.0.1";
const DEFAULT_DASHBOARD_PORT = 8780;
const DEFAULT_SERVICE_HOST = "127.0.0.1";
const DEFAULT_SERVICE_PORT = 4545;
const DASHBOARD_SERVICE_NAME = "aibridge-dashboard";
const DASHBOARD_SERVICE_API_VERSION = 1;
const ATTACH_TIMEOUT_MS = 1500;

export interface DashboardServerOptions {
  cwd?: string;
  host?: string;
  port?: number;
  serviceHost?: string;
  servicePort?: number;
}

export interface DashboardServiceHealth {
  ok: true;
  service: typeof DASHBOARD_SERVICE_NAME;
  apiVersion: typeof DASHBOARD_SERVICE_API_VERSION;
  pid: number;
  cwd: string;
  host: string;
  port: number;
  startedAt: string;
  timestamp: string;
  url: string;
  serviceUrl: string;
}

export interface RunningDashboardServer {
  url: string;
  host: string;
  port: number;
  cwd: string;
  serviceUrl: string;
  startedAt: string;
  close: () => Promise<void>;
  ownsServer: boolean;
  identity: DashboardServiceHealth;
}

function normalizeServiceCwd(cwd: string | undefined) {
  return path.resolve(cwd ?? process.cwd());
}

function normalizeComparisonPath(targetPath: string) {
  return path.normalize(targetPath).toLowerCase();
}

function dashboardUrl(host: string, port: number) {
  return `http://${host}:${port}/dashboard`;
}

function dashboardServiceBaseUrl(host: string, port: number) {
  return `http://${host}:${port}`;
}

function localServiceUrl(host: string, port: number) {
  return `http://${host}:${port}`;
}

function isLoopbackAddress(address: string | undefined) {
  if (!address) {
    return false;
  }

  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function contentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".woff2":
      return "font/woff2";
    case ".woff":
      return "font/woff";
    case ".ttf":
      return "font/ttf";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveDashboardAssetRoot() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const argvDir = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : process.cwd();
  const candidates = [
    path.resolve(argvDir, "dashboard-app"),
    path.resolve(moduleDir, "../../../dist-cli/dashboard-app"),
    path.resolve(moduleDir, "../../../dist/dashboard"),
    path.resolve(process.cwd(), "dist"),
  ];

  for (const candidate of candidates) {
    if (await fileExists(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  throw new BridgeRuntimeError(
    "BAD_REQUEST",
    "Dashboard assets are not available. Build the web app first or install a package that includes the dashboard bundle.",
    { candidates },
  );
}

function createDashboardHealth(
  cwd: string,
  host: string,
  port: number,
  startedAt: string,
  serviceUrl: string,
): DashboardServiceHealth {
  return {
    ok: true,
    service: DASHBOARD_SERVICE_NAME,
    apiVersion: DASHBOARD_SERVICE_API_VERSION,
    pid: process.pid,
    cwd,
    host,
    port,
    startedAt,
    timestamp: new Date().toISOString(),
    url: dashboardUrl(host, port),
    serviceUrl,
  };
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function sendStaticFile(response: ServerResponse, filePath: string) {
  const body = await fs.readFile(filePath);
  response.statusCode = 200;
  response.setHeader("Content-Type", contentType(filePath));
  response.end(body);
}

async function readAttachedDashboardHealth(host: string, port: number): Promise<DashboardServiceHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATTACH_TIMEOUT_MS);

  try {
    const response = await fetch(`${dashboardServiceBaseUrl(host, port)}/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BridgeRuntimeError("BAD_REQUEST", "Existing dashboard did not respond with health.");
    }

    const payload = (await response.json()) as DashboardServiceHealth;
    if (!payload?.ok || payload.service !== DASHBOARD_SERVICE_NAME) {
      throw new BridgeRuntimeError("BAD_REQUEST", "Service on the dashboard port is not an AiBridge dashboard.");
    }

    return payload;
  } catch (error) {
    if (error instanceof BridgeRuntimeError) {
      throw error;
    }

    throw new BridgeRuntimeError("BAD_REQUEST", "Unable to connect to the existing dashboard process.", {
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyExistingDashboard(host: string, port: number, cwd: string) {
  const health = await readAttachedDashboardHealth(host, port);
  if (normalizeComparisonPath(health.cwd) !== normalizeComparisonPath(cwd)) {
    throw new BridgeRuntimeError(
      "BAD_REQUEST",
      `Port ${port} is already used by an AiBridge dashboard for a different workspace.`,
      {
        expectedCwd: cwd,
        actualCwd: health.cwd,
      },
    );
  }

  return health;
}

async function createDashboardHttpServer(options: Required<Pick<DashboardServerOptions, "cwd" | "host" | "port" | "serviceHost" | "servicePort">>) {
  const cwd = normalizeServiceCwd(options.cwd);
  const service = await ensureLocalBridgeService({
    cwd,
    host: options.serviceHost,
    port: options.servicePort,
  });
  const assetRoot = await resolveDashboardAssetRoot();
  const startedAt = new Date().toISOString();
  const health = () => createDashboardHealth(cwd, options.host, options.port, startedAt, service.url);

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === "/health") {
        sendJson(response, 200, health());
        return;
      }

      if (pathname === "/shutdown") {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "Method not allowed" });
          return;
        }

        if (!isLoopbackAddress(request.socket.remoteAddress)) {
          sendJson(response, 403, { error: "Forbidden" });
          return;
        }

        sendJson(response, 200, { ok: true });
        setImmediate(() => {
          void new Promise<void>((resolve) => {
            server.close(() => resolve());
          }).then(() => process.exit(0));
        });
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      const relativePath =
        pathname === "/" || pathname === "/dashboard"
          ? "index.html"
          : pathname.startsWith("/dashboard/")
            ? pathname.slice("/dashboard/".length)
            : pathname.startsWith("/")
              ? pathname.slice(1)
              : pathname;

      const candidatePath = path.resolve(assetRoot, relativePath);
      const assetRootResolved = path.resolve(assetRoot);
      if (!candidatePath.startsWith(assetRootResolved)) {
        sendJson(response, 403, { error: "Forbidden" });
        return;
      }

      if (await fileExists(candidatePath)) {
        await sendStaticFile(response, candidatePath);
        return;
      }

      await sendStaticFile(response, path.join(assetRoot, "index.html"));
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Dashboard request failed.",
      });
    }
  });

  return {
    server,
    health,
    startedAt,
    service,
  };
}

export async function startDashboardServer(options: DashboardServerOptions = {}): Promise<RunningDashboardServer> {
  const host = options.host ?? DEFAULT_DASHBOARD_HOST;
  const port = options.port ?? DEFAULT_DASHBOARD_PORT;
  const cwd = normalizeServiceCwd(options.cwd);
  const serviceHost = options.serviceHost ?? DEFAULT_SERVICE_HOST;
  const servicePort = options.servicePort ?? DEFAULT_SERVICE_PORT;

  try {
    const existing = await verifyExistingDashboard(host, port, cwd);
    return {
      url: existing.url,
      host,
      port,
      cwd,
      serviceUrl: existing.serviceUrl,
      startedAt: existing.startedAt,
      close: async () => {
        throw new BridgeRuntimeError("BAD_REQUEST", "Attached dashboard process cannot be closed from this handle.");
      },
      ownsServer: false,
      identity: existing,
    };
  } catch (error) {
    if (error instanceof BridgeRuntimeError && error.message.includes("different workspace")) {
      throw error;
    }
  }

  const { server, health, startedAt, service } = await createDashboardHttpServer({
    cwd,
    host,
    port,
    serviceHost,
    servicePort,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    url: dashboardUrl(host, port),
    host,
    port,
    cwd,
    serviceUrl: service.url,
    startedAt,
    ownsServer: true,
    identity: health(),
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      if (service.ownsServer) {
        await service.close();
      }
    },
  };
}

export async function stopDashboardServer(host = DEFAULT_DASHBOARD_HOST, port = DEFAULT_DASHBOARD_PORT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATTACH_TIMEOUT_MS);

  try {
    const response = await fetch(`${dashboardServiceBaseUrl(host, port)}/shutdown`, {
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BridgeRuntimeError("BAD_REQUEST", "Unable to stop the dashboard process.");
    }
  } catch (error) {
    if (error instanceof BridgeRuntimeError) {
      throw error;
    }

    throw new BridgeRuntimeError("BAD_REQUEST", "Unable to reach the dashboard process.", {
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDashboardHealth(
  options: Pick<DashboardServerOptions, "cwd" | "host" | "port"> = {},
) {
  const host = options.host ?? DEFAULT_DASHBOARD_HOST;
  const port = options.port ?? DEFAULT_DASHBOARD_PORT;
  const cwd = normalizeServiceCwd(options.cwd);
  return verifyExistingDashboard(host, port, cwd);
}

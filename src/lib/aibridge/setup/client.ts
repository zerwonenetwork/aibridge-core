import { LocalBridgeClientError, type LocalBridgeRequestOptions } from "../local/client";
import type {
  SetupQuestionnaire,
  SetupResult,
  SetupTemplate,
} from "./types";

const DEFAULT_LOCAL_BRIDGE_SERVICE_URL = "http://127.0.0.1:4545";
const SERVICE_URL_STORAGE_KEY = "aibridge-local-service-url";

function getLocalBridgeServiceBaseUrl() {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(SERVICE_URL_STORAGE_KEY)?.trim();
    if (stored) return stored;
  }
  return import.meta.env.VITE_AIBRIDGE_LOCAL_SERVICE_URL || DEFAULT_LOCAL_BRIDGE_SERVICE_URL;
}

function buildServiceUrl(routePath: string) {
  return new URL(routePath, getLocalBridgeServiceBaseUrl()).toString();
}

function buildRequestHeaders(options?: LocalBridgeRequestOptions, initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders);
  headers.set("x-aibridge-role", options?.accessRole ?? "admin");
  if (options?.adminToken?.trim()) {
    headers.set("x-aibridge-admin-token", options.adminToken.trim());
  }
  return headers;
}

async function requestLocalSetup<T>(input: RequestInfo, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new LocalBridgeClientError(
      "SERVICE_UNAVAILABLE",
      "Local bridge service is not running. Start it with `npm run aibridge:service` or `npm run dev`.",
    );
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new LocalBridgeClientError(
      payload?.error?.code ?? "UNKNOWN_ERROR",
      payload?.error?.message ?? "Local setup request failed.",
      payload?.error?.details,
    );
  }

  return payload as { data: T };
}

export async function fetchSetupTemplates() {
  return requestLocalSetup<{ templates: SetupTemplate[]; defaults: SetupQuestionnaire }>(buildServiceUrl("/bridge/setup/templates"));
}

export async function previewLocalSetup(
  options: LocalBridgeRequestOptions,
  questionnaire: SetupQuestionnaire,
) {
  return requestLocalSetup<{ template: SetupTemplate; questionnaire: SetupQuestionnaire; plan: SetupResult["plan"]; result: SetupResult }>(
    buildServiceUrl("/bridge/setup/plan"),
    {
      method: "POST",
      headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
      body: JSON.stringify(questionnaire),
    },
  );
}

export async function initializeLocalBridgeFromSetupClient(
  options: LocalBridgeRequestOptions,
  questionnaire: SetupQuestionnaire,
  initOptions?: { cwd?: string; clearExistingData?: boolean },
) {
  return requestLocalSetup<{ rootPath: string; result: SetupResult; markdown: string }>(buildServiceUrl("/bridge/setup/init"), {
    method: "POST",
    headers: buildRequestHeaders(options, { "Content-Type": "application/json" }),
    body: JSON.stringify({ ...questionnaire, ...initOptions }),
  });
}

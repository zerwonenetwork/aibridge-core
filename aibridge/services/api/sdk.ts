/**
 * AiBridge TypeScript SDK Contract
 *
 * This file defines the intended client interface for the service contract in
 * `aibridge/services/api/contract.md`.
 *
 * Current repo reality:
 * - The implemented service is the local-first HTTP/SSE runtime in
 *   `aibridge/services/local/service.ts`.
 * - The dashboard uses `src/hooks/useAibridge.ts` and `src/lib/aibridge/local/client.ts`.
 * - A full generic SDK factory is still not implemented.
 */

// ── Re-exported domain types ────────────────────────────────────────

export type {
  AgentId,
  TaskStatus,
  AibridgeTask,
  AibridgeAgent,
  AibridgeLogEntry,
  AibridgeHandoff,
  AibridgeDecision,
  AibridgeConvention,
  AibridgeMessage,
  AibridgeContextSummary,
  AibridgeStatus,
} from "../../src/lib/aibridge/types";

// ── Pagination ──────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}

// ── Query parameters ────────────────────────────────────────────────

export interface TaskQuery {
  status?: "pending" | "in_progress" | "done";
  agentId?: string;
  limit?: number;
  offset?: number;
}

export interface LogQuery {
  agentId?: string;
  limit?: number;
  offset?: number;
}

export interface HandoffQuery {
  agentId?: string;
  limit?: number;
}

export interface DecisionQuery {
  status?: string;
  limit?: number;
}

export interface MessageQuery {
  acknowledged?: boolean;
  severity?: "info" | "warning" | "critical";
  toAgentId?: string;
}

// ── Mutation payloads ───────────────────────────────────────────────

export interface CreateTaskPayload {
  title: string;
  priority?: "low" | "medium" | "high";
  agentId?: string;
}

export interface UpdateTaskPayload {
  status?: "pending" | "in_progress" | "done";
  agentId?: string;
  priority?: "low" | "medium" | "high";
  title?: string;
}

export interface CreateLogPayload {
  agentId: string;
  action: string;
  description: string;
}

export interface CreateHandoffPayload {
  fromAgentId: string;
  toAgentId: string;
  description: string;
  relatedTaskIds?: string[];
}

export interface CreateDecisionPayload {
  title: string;
  summary: string;
}

export interface UpdateDecisionPayload {
  status: string;
}

export interface CreateMessagePayload {
  fromAgentId: string;
  toAgentId?: string;
  severity: "info" | "warning" | "critical";
  content: string;
}

export interface CreateConventionPayload {
  rule: string;
  category?: string;
}

// ── Error shape ─────────────────────────────────────────────────────

export interface AibridgeApiError {
  error: {
    code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
    message: string;
    details?: Record<string, unknown>;
  };
}

// ── WebSocket event types ───────────────────────────────────────────

export type WsEventType =
  | "task.created"
  | "task.updated"
  | "log.created"
  | "handoff.created"
  | "message.created"
  | "message.acknowledged"
  | "decision.created"
  | "decision.updated"
  | "convention.created"
  | "convention.deleted"
  | "context.regenerated"
  | "sync.completed";

export interface WsEvent<T = unknown> {
  event: WsEventType;
  data: T;
  timestamp: string;
}

// ── Client interface ────────────────────────────────────────────────

export interface AibridgeClient {
  // Status
  getStatus(): Promise<import("../../src/lib/aibridge/types").AibridgeStatus>;

  // Tasks
  getTasks(query?: TaskQuery): Promise<PaginatedResponse<import("../../src/lib/aibridge/types").AibridgeTask>>;
  createTask(payload: CreateTaskPayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeTask>>;
  updateTask(id: string, payload: UpdateTaskPayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeTask>>;

  // Logs
  getLogs(query?: LogQuery): Promise<PaginatedResponse<import("../../src/lib/aibridge/types").AibridgeLogEntry>>;
  createLog(payload: CreateLogPayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeLogEntry>>;

  // Handoffs
  getHandoffs(query?: HandoffQuery): Promise<PaginatedResponse<import("../../src/lib/aibridge/types").AibridgeHandoff>>;
  createHandoff(payload: CreateHandoffPayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeHandoff>>;

  // Decisions
  getDecisions(query?: DecisionQuery): Promise<PaginatedResponse<import("../../src/lib/aibridge/types").AibridgeDecision>>;
  createDecision(payload: CreateDecisionPayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeDecision>>;
  updateDecision(id: string, payload: UpdateDecisionPayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeDecision>>;

  // Messages
  getMessages(query?: MessageQuery): Promise<PaginatedResponse<import("../../src/lib/aibridge/types").AibridgeMessage>>;
  createMessage(payload: CreateMessagePayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeMessage>>;
  acknowledgeMessage(id: string): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeMessage>>;

  // Conventions
  getConventions(): Promise<PaginatedResponse<import("../../src/lib/aibridge/types").AibridgeConvention>>;
  createConvention(payload: CreateConventionPayload): Promise<SingleResponse<import("../../src/lib/aibridge/types").AibridgeConvention>>;
  deleteConvention(id: string): Promise<void>;

  // Context
  regenerateContext(): Promise<SingleResponse<{ markdown: string }>>;

  // WebSocket
  subscribe(handler: (event: WsEvent) => void): () => void;
}

// ── Factory (to be implemented) ─────────────────────────────────────

export interface AibridgeClientOptions {
  baseUrl: string;
  apiKey?: string;
}

/**
 * Creates an AiBridge API client.
 * Not implemented yet in this repo. Local mode currently uses the dashboard-specific
 * client in `src/lib/aibridge/local/client.ts`.
 */
export declare function createAibridgeClient(options: AibridgeClientOptions): AibridgeClient;

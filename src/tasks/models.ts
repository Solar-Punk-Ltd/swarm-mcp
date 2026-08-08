import { Bee } from "@ethersphere/bee-js";
import { TaskStatusSchema } from "@modelcontextprotocol/core";
import {
  CreateTaskResult,
  RequestId,
  Result,
  Task,
} from "@modelcontextprotocol/server";
import { TaskManager } from "./task-manager";

// Only CreateTaskResult is re-exported: the SDK's CancelTaskResult and
// GetTaskResult are the deprecated 2025 types, and their target shapes differ
// structurally — SEP-2663 makes tasks/cancel an empty ack (`Result`) and
// tasks/get flat (`Result & DetailedTask`). The revival should take those from
// the extension's own types, not from here.
export type { CreateTaskResult, Task };

export const TaskStatus = TaskStatusSchema.enum;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export type UpdateStatusFunction = (
  task: ExtendedTask,
  bee: Bee,
  taskManager: TaskManager
) => void;

// 2025-shaped field names, kept while task-mode is dormant. SEP-2663 uses
// `ttlMs: number | null` and `pollIntervalMs?: number` — see revival checklist
// item 3 in mcp-service.ts.
export interface CreateTaskOptions {
  ttl: number;
  pollInterval: number;
}

/**
 * Internal storage record — NOT a wire shape. Deliberately keeps the handle
 * nested alongside bookkeeping that can never be serialized (`updateStatus`).
 * SEP-2663's tasks/get is flat (`Result & DetailedTask`, with `result` on
 * CompletedTask and `error` on FailedTask); the revival should project this
 * record to that shape at the handler boundary rather than flatten the store.
 */
export interface ExtendedTask {
  task: Task;
  result: Result | null;
  updateStatus: UpdateStatusFunction | null;
  _meta?: {
    [x: string]: string | null;
  };
}

export interface CreateTaskModel {
  taskOptions: CreateTaskOptions;
  requestId: RequestId;
  request: unknown;
}

export function isTaskTerminal(status: TaskStatus): boolean {
  return (
    status === TaskStatus.completed ||
    status === TaskStatus.failed ||
    status === TaskStatus.cancelled
  );
}

import { Bee } from "@ethersphere/bee-js";
import { RequestId, Result } from "@modelcontextprotocol/server";
import { TaskManager } from "./task-manager";

export type UpdateStatusFunction = (
  task: ExtendedTask,
  bee: Bee,
  taskManager: TaskManager
) => void;

export enum TaskState {
  WORKING = "working",
  INPUT_REQUIRED = "input_required",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface Task {
  taskId: string;
  status: TaskState;
  ttl: number | null;
  createdAt: string;
  lastUpdatedAt: string;
  pollInterval?: number;
  statusMessage?: string;
}

export interface CreateTaskOptions {
  ttl: number;
  pollInterval: number;
}

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

export function isTaskTerminal(status: TaskState): boolean {
  return (
    status === TaskState.COMPLETED ||
    status === TaskState.FAILED ||
    status === TaskState.CANCELLED
  );
}

export interface CreateTaskResult {
  task: Task;
  _meta?: Record<string, unknown>;
}

export interface GetTaskResult {
  task: Task;
  result?: Result;
  _meta?: Record<string, unknown>;
}

export interface CancelTaskResult {
  task: Task;
  _meta?: Record<string, unknown>;
}

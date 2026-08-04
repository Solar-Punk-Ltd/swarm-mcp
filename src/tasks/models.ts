import { Bee } from "@ethersphere/bee-js";
import { TaskStatusSchema } from "@modelcontextprotocol/core";
import {
  CancelTaskResult,
  CreateTaskResult,
  GetTaskResult,
  RequestId,
  Result,
  Task,
} from "@modelcontextprotocol/server";
import { TaskManager } from "./task-manager";

export type { CancelTaskResult, CreateTaskResult, GetTaskResult, Task };

export const TaskStatus = TaskStatusSchema.enum;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export type UpdateStatusFunction = (
  task: ExtendedTask,
  bee: Bee,
  taskManager: TaskManager
) => void;

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

export function isTaskTerminal(status: TaskStatus): boolean {
  return (
    status === TaskStatus.completed ||
    status === TaskStatus.failed ||
    status === TaskStatus.cancelled
  );
}

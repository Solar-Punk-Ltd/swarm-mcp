import { Bee } from "@ethersphere/bee-js";
import { TaskStore } from "@modelcontextprotocol/sdk/experimental/tasks/interfaces.js";
import { Task } from "@modelcontextprotocol/sdk/types.js";

export interface ExtendedTask {
  task: Task;
  store: TaskStore;
  result?: unknown;
  updateStatus?: (task: ExtendedTask, bee: Bee) => void;
}

export enum TaskState {
  WORKING = "working",
  INPUT_REQUIRED = "input_required",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

import { Bee } from "@ethersphere/bee-js";
import { Task } from "@modelcontextprotocol/sdk/types.js";

export interface ExtendedTask extends Task {
  meta?: {
    type: string;
    [key: string]: unknown;
  };
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

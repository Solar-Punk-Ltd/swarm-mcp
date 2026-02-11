import { Task } from "@modelcontextprotocol/sdk/types.js";
import { TaskState } from "./models";
import { ToolResponse } from "../utils";

/**
 * Checks if a task status is in a terminal state
 */
export const isTaskTerminal = (status: string): status is TaskState => {
  return [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED].includes(
    status as TaskState
  );
};

export const isTask = (data: Task | ToolResponse): data is Task => {
  return (
    data &&
    typeof data === "object" &&
    "taskId" in data &&
    typeof data.taskId === "string"
  );
};

import { TaskState } from "./models";

/**
 * Checks if a task status is in a terminal state
 */
export const isTaskTerminal = (status: string): status is TaskState => {
  return [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED].includes(
    status as TaskState
  );
};

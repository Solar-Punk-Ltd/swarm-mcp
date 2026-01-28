import { Bee } from "@ethersphere/bee-js";
import { v4 as uuidv4 } from "uuid";
import { McpError, ErrorCode, Task } from "@modelcontextprotocol/sdk/types.js";
import {
  PAGE_SIZE,
  TASK_CLEANUP_INTERVAL_MS,
  TASK_POLL_INTERVAL,
  TASK_STATUS_UPDATE_INTERVAL_MS,
  TASK_TTL_MS,
} from "./constants";
import { ExtendedTask, TaskState } from "./models";
import { isTaskTerminal } from "./utils";

export class TaskManager {
  private extendedTasks: Map<string, ExtendedTask> = new Map();
  private bee: Bee;
  private cleanupInterval: NodeJS.Timeout;
  private statusUpdateInterval: NodeJS.Timeout;

  constructor(bee: Bee) {
    this.bee = bee;

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldTasks();
    }, TASK_CLEANUP_INTERVAL_MS);

    // Start periodic status updates for active Swarm tasks
    this.statusUpdateInterval = setInterval(() => {
      this.updateAllSwarmTasks();
    }, TASK_STATUS_UPDATE_INTERVAL_MS);
  }

  createTask(
    name: string,
    type: string,
    updateStatus: (task: ExtendedTask, bee: Bee) => void,
    id?: number
  ): Task {
    const taskId = uuidv4();
    const task: Task = {
      taskId,
      status: TaskState.WORKING,
      statusMessage: `${name} started`,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      pollInterval: TASK_POLL_INTERVAL,
      ttl: TASK_TTL_MS,
    };

    const extendedTask: ExtendedTask = {
      task,
      meta: {
        type,
        id,
      },
      updateStatus,
    };

    this.extendedTasks.set(taskId, extendedTask);
    return task;
  }

  getTask(taskId: string): Task {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      throw new McpError(ErrorCode.InvalidRequest, `Task not found: ${taskId}`);
    }

    return extendedTask.task;
  }

  // In TaskManager class
  async getTaskResult(taskId: string): Promise<unknown> {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      throw new McpError(ErrorCode.InvalidRequest, `Task not found: ${taskId}`);
    }

    // Block until terminal state
    while (!isTaskTerminal(extendedTask.task.status)) {
      await new Promise((resolve) =>
        setTimeout(resolve, extendedTask.task.pollInterval ?? 1000)
      );

      // Re-check task still exists
      if (!this.extendedTasks.has(taskId)) {
        throw new McpError(ErrorCode.InvalidRequest, `Task expired: ${taskId}`);
      }
    }

    // Handle different terminal states
    if (extendedTask.task.status === TaskState.COMPLETED) {
      return extendedTask.result;
    } else if (extendedTask.task.status === TaskState.FAILED) {
      throw new McpError(
        ErrorCode.InternalError,
        extendedTask.task.statusMessage ?? "Task failed"
      );
    } else if (extendedTask.task.status === TaskState.CANCELLED) {
      throw new McpError(ErrorCode.InvalidRequest, "Task was cancelled");
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Unexpected task state: ${extendedTask.task.status}`
    );
  }

  setTaskResult(taskId: string, result: unknown): void {
    const extendedTask = this.extendedTasks.get(taskId);
    if (extendedTask) {
      extendedTask.result = result;
    }
  }

  listTasks(cursor?: string): { tasks: Task[]; nextCursor?: string } {
    const allTasks = Array.from(this.extendedTasks.values());

    // Sort by creation date (newest first)
    allTasks.sort(
      (a: ExtendedTask, b: ExtendedTask) =>
        new Date(b.task.createdAt).getTime() -
        new Date(a.task.createdAt).getTime()
    );

    // Implement cursor-based pagination
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedTasks = allTasks.slice(startIndex, endIndex);

    const response: { tasks: Task[]; nextCursor?: string } = {
      tasks: paginatedTasks.map((extendedTask) => extendedTask.task),
    };

    // Add nextCursor if there are more tasks
    if (endIndex < allTasks.length) {
      response.nextCursor = endIndex.toString();
    }

    return response;
  }

  cancelTask(taskId: string): Task {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Task not found: ${taskId}.`
      );
    }

    // Cannot cancel tasks in terminal states
    if (isTaskTerminal(extendedTask.task.status)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Cannot cancel task in terminal state: ${extendedTask.task.status}.`
      );
    }

    // Update task status
    extendedTask.task.status = TaskState.CANCELLED;
    extendedTask.task.statusMessage = "Task cancelled by user.";
    extendedTask.task.lastUpdatedAt = new Date().toISOString();

    return extendedTask.task;
  }

  private async updateAllSwarmTasks(): Promise<void> {
    const activeTasks = Array.from(this.extendedTasks.values()).filter(
      (extendedTask) =>
        typeof extendedTask.updateStatus === "function" &&
        !isTaskTerminal(extendedTask.task.status)
    );

    // Update all active Swarm tasks in parallel
    await Promise.allSettled(
      activeTasks.map((task) => task.updateStatus!(task, this.bee))
    );
  }

  private cleanupOldTasks(): void {
    const now = Date.now();
    const tasksToDelete: string[] = [];

    for (const [taskId, extendedTask] of this.extendedTasks.entries()) {
      // Only clean up terminal tasks
      if (isTaskTerminal(extendedTask.task.status)) {
        const lastUpdated = new Date(extendedTask.task.lastUpdatedAt).getTime();
        if (now - lastUpdated > TASK_TTL_MS) {
          tasksToDelete.push(taskId);
        }
      }
    }

    // Delete old tasks
    for (const taskId of tasksToDelete) {
      this.extendedTasks.delete(taskId);
    }

    if (tasksToDelete.length > 0) {
      console.log(`Cleaned up ${tasksToDelete.length} old task(s)`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
    }
  }
}

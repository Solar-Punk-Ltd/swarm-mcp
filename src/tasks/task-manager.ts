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
  private tasks: Map<string, ExtendedTask> = new Map();
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
    const task: ExtendedTask = {
      taskId,
      status: TaskState.WORKING,
      statusMessage: `${name} started`,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      pollInterval: TASK_POLL_INTERVAL,
      ttl: TASK_TTL_MS,
      meta: {
        type,
        id,
      },
      updateStatus,
    };

    this.tasks.set(taskId, task);
    return task;
  }

  getTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new McpError(ErrorCode.InvalidRequest, `Task not found: ${taskId}`);
    }

    return task;
  }

  getTaskResult(taskId: string): unknown {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Task not found: ${taskId}.`
      );
    }

    if (task.status !== TaskState.COMPLETED) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Task is not completed yet: ${task.status}`
      );
    }

    return task.result;
  }

  setTaskResult(taskId: string, result: unknown): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.result = result;
    }
  }

  listTasks(cursor?: string): { tasks: Task[]; nextCursor?: string } {
    const allTasks = Array.from(this.tasks.values());

    // Sort by creation date (newest first)
    allTasks.sort(
      (a: ExtendedTask, b: ExtendedTask) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Implement cursor-based pagination
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedTasks = allTasks.slice(startIndex, endIndex);

    const response: { tasks: Task[]; nextCursor?: string } = {
      tasks: paginatedTasks,
    };

    // Add nextCursor if there are more tasks
    if (endIndex < allTasks.length) {
      response.nextCursor = endIndex.toString();
    }

    return response;
  }

  cancelTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Task not found: ${taskId}.`
      );
    }

    // Cannot cancel tasks in terminal states
    if (isTaskTerminal(task.status)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Cannot cancel task in terminal state: ${task.status}.`
      );
    }

    // Update task status
    task.status = TaskState.CANCELLED;
    task.statusMessage = "Task cancelled by user.";
    task.lastUpdatedAt = new Date().toISOString();

    return task;
  }

  private async updateAllSwarmTasks(): Promise<void> {
    const activeTasks = Array.from(this.tasks.values()).filter(
      (task) =>
        typeof task.updateStatus === "function" && !isTaskTerminal(task.status)
    );

    // Update all active Swarm tasks in parallel
    await Promise.allSettled(
      activeTasks.map((task) => task.updateStatus!(task, this.bee))
    );
  }

  private cleanupOldTasks(): void {
    const now = Date.now();
    const tasksToDelete: string[] = [];

    for (const [taskId, task] of this.tasks.entries()) {
      // Only clean up terminal tasks
      if (isTaskTerminal(task.status)) {
        const lastUpdated = new Date(task.lastUpdatedAt).getTime();
        if (now - lastUpdated > TASK_TTL_MS) {
          tasksToDelete.push(taskId);
        }
      }
    }

    // Delete old tasks
    for (const taskId of tasksToDelete) {
      this.tasks.delete(taskId);
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

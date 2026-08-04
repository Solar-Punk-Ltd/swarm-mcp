import { Bee } from "@ethersphere/bee-js";
import {
  CreateTaskModel,
  ExtendedTask,
  TaskStatus,
  UpdateStatusFunction,
  isTaskTerminal,
} from "./models";
import {
  ProtocolError,
  ProtocolErrorCode,
  Result,
  Task,
} from "@modelcontextprotocol/server";
import {
  TASK_CLEANUP_INTERVAL_MS,
  TASK_STATUS_UPDATE_INTERVAL_MS,
} from "./constants";
import config from "../config";
import { randomUUID } from "crypto";

/**
 * In-process task store and update loop.
 *
 * Task state lives in this.extendedTasks — invisible across processes.
 * tasks/get and tasks/cancel must route to the process that minted the handle.
 * See plan §"Sticky routing required for task polling".
 */
export class TaskManager {
  private bee: Bee;
  private extendedTasks: Map<string, ExtendedTask> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private statusUpdateInterval: NodeJS.Timeout;

  constructor(bee: Bee) {
    this.bee = bee;

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldTasks();
    }, TASK_CLEANUP_INTERVAL_MS);

    // The status-update loop writes into the in-process Map so that the next
    // tasks/get poll observes fresh status. No push notifications — the
    // originating tools/call stream is closed under SEP-2663.
    this.statusUpdateInterval = setInterval(() => {
      this.updateAllSwarmTasks();
    }, TASK_STATUS_UPDATE_INTERVAL_MS);
  }

  async createTask(
    createTaskModel: CreateTaskModel,
    updateStatus: UpdateStatusFunction | null,
    result: Result | null,
    _meta?: Record<string, string | null>
  ): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      taskId: randomUUID(),
      status: TaskStatus.working,
      ttl: createTaskModel.taskOptions.ttl,
      pollInterval: createTaskModel.taskOptions.pollInterval,
      createdAt: now,
      lastUpdatedAt: now,
    };

    const extendedTask: ExtendedTask = {
      task,
      updateStatus,
      result,
      _meta,
    };

    this.extendedTasks.set(task.taskId, extendedTask);
    return task;
  }

  removeTask(taskId: string) {
    this.extendedTasks.delete(taskId);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const extendedTask = this.extendedTasks.get(taskId);
    return extendedTask?.task ?? null;
  }

  /**
   * Returns the task plus its terminal result, when terminal. This is what
   * SEP-2663's tasks/get returns: a task handle whose result is embedded
   * once status is terminal.
   */
  async getTaskWithResult(
    taskId: string
  ): Promise<{ task: Task; result?: Result }> {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        `Task not found: ${taskId}`
      );
    }
    if (isTaskTerminal(extendedTask.task.status) && extendedTask.result) {
      return { task: extendedTask.task, result: extendedTask.result };
    }
    return { task: extendedTask.task };
  }

  async cancelTask(taskId: string): Promise<Task> {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        `Task not found: ${taskId}`
      );
    }
    if (!isTaskTerminal(extendedTask.task.status)) {
      extendedTask.task.status = TaskStatus.cancelled;
      extendedTask.task.statusMessage = "Cancelled by client.";
      extendedTask.task.lastUpdatedAt = new Date().toISOString();
    }
    return extendedTask.task;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, message: string) {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      return;
    }
    extendedTask.task.status = status;
    extendedTask.task.statusMessage = message;
    extendedTask.task.lastUpdatedAt = new Date().toISOString();
  }

  async addExtendedTaskMetadata(taskId: string, key: string, value: string) {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      return;
    }
    extendedTask._meta = {
      ...(extendedTask._meta ?? {}),
      [key]: value,
    };
  }

  /**
   * Store a task's result. When `deferredCompletion` is true, keep status as
   * WORKING — the poll loop marks completion once the underlying operation
   * (e.g. Swarm tag processing) is done. Otherwise mark COMPLETED.
   */
  async setTaskResult(
    taskId: string,
    result: Result,
    deferredCompletion: boolean = false
  ): Promise<void> {
    const extendedTask = this.extendedTasks.get(taskId);
    if (!extendedTask) {
      return;
    }
    extendedTask.result = result;
    extendedTask.task.lastUpdatedAt = new Date().toISOString();
    if (!deferredCompletion) {
      extendedTask.task.status = TaskStatus.completed;
    }
  }

  private async updateAllSwarmTasks(): Promise<void> {
    const activeTasks = Array.from(this.extendedTasks.values()).filter(
      (extendedTask) =>
        typeof extendedTask.updateStatus === "function" &&
        !isTaskTerminal(extendedTask.task.status)
    );

    await Promise.allSettled(
      activeTasks.map((task) => task.updateStatus!(task, this.bee, this))
    );
  }

  private cleanupOldTasks(): void {
    const now = Date.now();
    const tasksToDelete: string[] = [];

    for (const [taskId, extendedTask] of this.extendedTasks.entries()) {
      if (isTaskTerminal(extendedTask.task.status)) {
        const lastUpdated = new Date(extendedTask.task.lastUpdatedAt).getTime();
        if (now - lastUpdated > config.bee.taskTtlMs) {
          tasksToDelete.push(taskId);
        }
      }
    }

    for (const taskId of tasksToDelete) {
      this.extendedTasks.delete(taskId);
    }
  }

  destroy(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

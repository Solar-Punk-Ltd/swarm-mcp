import { Bee } from "@ethersphere/bee-js";
import { ExtendedTask } from "./models";
import { Task } from "@modelcontextprotocol/sdk/types.js";
import { TASK_STATUS_UPDATE_INTERVAL_MS } from "./constants";
import { TaskStore } from "@modelcontextprotocol/sdk/experimental/tasks/interfaces.js";
import { isTaskTerminal } from "./utils";

export class TaskManager {
  private bee: Bee;
  private extendedTasks: Map<string, ExtendedTask> = new Map();
  private statusUpdateInterval: NodeJS.Timeout;

  constructor(bee: Bee) {
    this.bee = bee;

    this.statusUpdateInterval = setInterval(() => {
      this.updateAllSwarmTasks();
    }, TASK_STATUS_UPDATE_INTERVAL_MS);
  }

  createTask(
    task: Task,
    store: TaskStore,
    updateStatus: (task: ExtendedTask, bee: Bee) => void,
    result?: unknown
  ): Task {
    const extendedTask: ExtendedTask = {
      task,
      store,
      updateStatus,
      result,
    };

    this.extendedTasks.set(task.taskId, extendedTask);

    return task;
  }

  removeTask(taskId: string) {
    this.extendedTasks.delete(taskId);
  }

  async getTaskResult(taskId: string): Promise<unknown> {
    const extendedTask = this.extendedTasks.get(taskId);

    if (!extendedTask) {
      return null;
    }

    return extendedTask.result;
  }

  setTaskResult(taskId: string, result: unknown): void {
    const extendedTask = this.extendedTasks.get(taskId);
    if (extendedTask) {
      extendedTask.result = result;
    }
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

  destroy(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
    }
  }
}

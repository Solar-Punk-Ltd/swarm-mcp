import { PostageBatch } from "@ethersphere/bee-js";
import { TaskManager } from "./tasks/task-manager";
import { TaskStore } from "@modelcontextprotocol/sdk/experimental/tasks/interfaces.js";

export type PostageBatchCurated = Omit<PostageBatch, "batchID"> & {
  batchID: string;
};

export interface PostageBatchSummary {
  stampID: string;
  usage: string;
  capacity: string;
  ttl: string;
  immutable: boolean;
}

export interface ResponseContent<U, V> {
  raw: U;
  summary: V;
}

export interface ResponseWithStructuredContent<T> {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
}

export interface TaskInformation {
  manager: TaskManager;
  taskId: string;
}

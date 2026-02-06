/**
 * MCP Service implementation for handling blob data operations with Bee (Swarm)
 * Using Experimental MCP SDK Tasks API
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  CallToolRequestSchema,
  ErrorCode,
  InitializeRequestSchema,
  ListTasksRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { Bee } from "@ethersphere/bee-js";
import config from "./config";
import { SwarmToolsSchema } from "./schemas";
import { determineIfGateway } from "./utils";

// Regular sync tools
import { uploadData } from "./tools/upload_data";
import { downloadData } from "./tools/download_data";
import { updateFeed } from "./tools/update_feed";
import { readFeed } from "./tools/read_feed";
import { downloadFiles } from "./tools/download_files";
import { listPostageStamps } from "./tools/list-postage-stamps";
import { getPostageStamp } from "./tools/get_postage_stamp";
import { queryUploadProgress } from "./tools/query_upload_progress";
import { createPostageStamp } from "./tools/create_postage_stamp";
import { extendPostageStamp } from "./tools/extend_postage_stamp";

// Model types
import type { UploadFileArgs } from "./tools/upload_file/models";
import type { UploadFolderArgs } from "./tools/upload_folder/models";
import type { UploadDataArgs } from "./tools/upload_data/models";
import type { DownloadDataArgs } from "./tools/download_data/models";
import type { UpdateFeedArgs } from "./tools/update_feed/models";
import type { ReadFeedArgs } from "./tools/read_feed/models";
import type { DownloadFilesArgs } from "./tools/download_files/models";
import type { ListPostageStampsArgs } from "./tools/list-postage-stamps/models";
import type { GetPostageStampArgs } from "./tools/get_postage_stamp/models";
import type { CreatePostageStampArgs } from "./tools/create_postage_stamp/models";
import type { ExtendPostageStampArgs } from "./tools/extend_postage_stamp/models";
import type { QueryUploadProgressArgs } from "./tools/query_upload_progress/models";

// Zod schemas
import {
  uploadFileSchema,
  uploadFolderSchema,
  uploadDataSchema,
  downloadDataSchema,
  updateFeedSchema,
  readFeedSchema,
  downloadFilesSchema,
  listPostageStampsSchema,
  getPostageStampSchema,
  createPostageStampSchema,
  extendPostageStampSchema,
  queryUploadProgressSchema,
} from "./schemas/zod-schemas";
import {
  AnySchema,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { TASK_POLL_INTERVAL, TASK_TTL_MS } from "./tasks/constants";
import { uploadFile } from "./tools/upload_file";
import { uploadFolder } from "./tools/upload_folder";
import { TaskManager } from "./tasks/task-manager";
import { TaskState } from "./tasks/models";

/**
 * Swarm MCP Server class using Experimental Tasks API
 */
export class SwarmMCPServer {
  public readonly server: McpServer;
  private readonly bee: Bee;
  private readonly taskManager: TaskManager;

  constructor() {
    // Initialize Bee client
    this.bee = new Bee(config.bee.endpoint);
    this.taskManager = new TaskManager(this.bee);

    this.server = new McpServer(
      {
        name: "swarm-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          tasks: {
            list: {},
            requests: {
              tools: {
                call: {},
              },
            },
          },
          resources: {},
        },
      }
    );

    this.registerTaskTools();
    this.registerTaskHandlers();

    // Setup regular sync tools
    this.registerSyncTools();

    this.server.server.onerror = (error: Error) =>
      console.error("[Error]", error);

    process.on("SIGINT", async () => {
      // Clear all active polls
      await this.server.close();
      process.exit(0);
    });
  }

  private registerTaskTools() {
    const experimental = this.server.experimental.tasks;

    experimental.registerToolTask(
      "upload_file",
      {
        description:
          "Upload a file to Swarm with deferred upload support for large files.",
        inputSchema: {
          data: z.string(),
          isPath: z.boolean().optional(),
          redundancyLevel: z.number().optional(),
          postageBatchId: z.string().optional(),
        } as unknown as AnySchema | ZodRawShapeCompat,
        execution: { taskSupport: "optional" },
      },
      {
        createTask: async (
          args: z.infer<typeof uploadFileSchema>,
          extra: RequestHandlerExtra<ServerRequest, ServerNotification>
        ) => {

          const validArgs = uploadFileSchema.parse(args);
          const taskStore = extra.taskStore!;

          const task = await taskStore.createTask({
            ttl: TASK_TTL_MS,
            pollInterval: TASK_POLL_INTERVAL,
          });

          uploadFile(
            validArgs as unknown as UploadFileArgs,
            this.bee,
            this.server.server.transport,
            {
              manager: this.taskManager,
              store: taskStore,
              taskId: task.taskId,
            },
            task
          ).catch(async (error) => {
            console.error(
              `[Task Error] Background upload failed for task ${task.taskId}:`,
              error
            );
            try {
              await taskStore.updateTaskStatus(
                task.taskId,
                TaskState.FAILED,
                `Upload failed: ${error.message || "Unknown error"}`
              );
            } catch (updateError) {
              console.error(
                `[Task Error] Failed to update task status for ${task.taskId}:`,
                updateError
              );
            }
          });

          return { task };
        },
        getTask: async (
          args: Record<string, unknown>,
          extra: RequestHandlerExtra<ServerRequest, ServerNotification>
        ) => {
          if (!extra.taskId) {
            throw new McpError(ErrorCode.InvalidParams, `Missing task id.`);
          }

          const task = await extra.taskStore!.getTask(extra.taskId);

          if (!task) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Task not found: ${extra.taskId}`
            );
          }
          return { task };
        },
        getTaskResult: async (
          args: Record<string, unknown>,
          extra: RequestHandlerExtra<ServerRequest, ServerNotification>
        ) => {
          if (!extra.taskId) {
            throw new McpError(ErrorCode.InvalidParams, `Missing task id.`);
          }

          return await extra.taskStore!.getTaskResult(extra.taskId);
        },
      } as any
    );
  }

  private registerTaskHandlers() {
    // List tasks handler
    this.server.server.setRequestHandler(
      // Replace with actual MCP tasks/list schema import
      ListTasksRequestSchema,
      async (
        request,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => {
        return await extra.taskStore!.listTasks(request.params?.cursor);
      }
    );
  }

  private registerSyncTools() {
    // List tools
    this.server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const isGateway = await determineIfGateway(this.bee);
      let tools = SwarmToolsSchema;

      if (isGateway) {
        const nodeOnlyTools = [
          "list_postage_stamps",
          "get_postage_stamp",
          "create_postage_stamp",
          "extend_postage_stamp",
          "query_upload_progress",
        ];
        tools = tools.filter((item) => !nodeOnlyTools.includes(item.name));
      }

      return { tools };
    });

    // Handle sync tool calls
    this.server.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const args = request.params.arguments;

        switch (request.params.name) {
          case "upload_data": {
            const validArgs = uploadDataSchema.parse(args);
            return uploadData(validArgs as UploadDataArgs, this.bee);
          }

          case "download_data": {
            const validArgs = downloadDataSchema.parse(args);
            return downloadData(validArgs as DownloadDataArgs, this.bee);
          }

          case "update_feed": {
            const validArgs = updateFeedSchema.parse(args);
            return updateFeed(validArgs as UpdateFeedArgs, this.bee);
          }

          case "read_feed": {
            const validArgs = readFeedSchema.parse(args);
            return readFeed(validArgs as ReadFeedArgs, this.bee);
          }

          case "upload_folder": {
            const validArgs = uploadFolderSchema.parse(args);
            return uploadFolder(
              validArgs as unknown as UploadFolderArgs,
              this.bee,
              this.server.server.transport
            );
          }

          case "download_files": {
            const validArgs = downloadFilesSchema.parse(args);
            return downloadFiles(
              validArgs as DownloadFilesArgs,
              this.bee,
              this.server.server.transport
            );
          }

          case "list_postage_stamps": {
            const validArgs = listPostageStampsSchema.parse(args);
            return listPostageStamps(
              validArgs as ListPostageStampsArgs,
              this.bee
            );
          }

          case "get_postage_stamp": {
            const validArgs = getPostageStampSchema.parse(args);
            return getPostageStamp(validArgs as GetPostageStampArgs, this.bee);
          }

          case "create_postage_stamp": {
            const validArgs = createPostageStampSchema.parse(args);
            return createPostageStamp(
              validArgs as CreatePostageStampArgs,
              this.bee
            );
          }

          case "extend_postage_stamp": {
            const validArgs = extendPostageStampSchema.parse(args);
            return extendPostageStamp(
              validArgs as ExtendPostageStampArgs,
              this.bee
            );
          }

          case "query_upload_progress": {
            const validArgs = queryUploadProgressSchema.parse(args);
            return queryUploadProgress(
              validArgs as QueryUploadProgressArgs,
              this.bee,
              this.server.server.transport
            );
          }

          case "upload_file": {
            const validArgs = uploadFileSchema.parse(args);
            return uploadFile(
              validArgs as unknown as UploadFileArgs,
              this.bee,
              this.server.server.transport
            );
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      }
    );
  }
}

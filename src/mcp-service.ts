/**
 * MCP Service implementation for handling blob data operations with Bee (Swarm)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  GetTaskRequestSchema,
  GetTaskPayloadRequestSchema,
  ListTasksRequestSchema,
  CancelTaskRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Bee } from "@ethersphere/bee-js";
import config from "./config";
// Import refactored tool modules
import { uploadData } from "./tools/upload_data";
import { downloadData } from "./tools/download_data";
import { uploadFile } from "./tools/upload_file";
import { uploadFolder } from "./tools/upload_folder";
import { downloadFiles } from "./tools/download_files";
import { queryUploadProgress } from "./tools/query_upload_progress";
import { listPostageStamps } from "./tools/list-postage-stamps";
import { getPostageStamp } from "./tools/get_postage_stamp";
import { ListPostageStampsArgs } from "./tools/list-postage-stamps/models";
import { GetPostageStampArgs } from "./tools/get_postage_stamp/models";
import { extendPostageStamp } from "./tools/extend_postage_stamp";
import { createPostageStamp } from "./tools/create_postage_stamp";
import { CreatePostageStampArgs } from "./tools/create_postage_stamp/models";
import { ExtendPostageStampArgs } from "./tools/extend_postage_stamp/models";
import { SwarmToolsSchema } from "./schemas";
import { updateFeed } from "./tools/update_feed";
import { readFeed } from "./tools/read_feed";
import { UploadDataArgs } from "./tools/upload_data/models";
import { DownloadDataArgs } from "./tools/download_data/models";
import { UpdateFeedArgs } from "./tools/update_feed/models";
import { ReadFeedArgs } from "./tools/read_feed/models";
import { UploadFileArgs } from "./tools/upload_file/models";
import { UploadFolderArgs } from "./tools/upload_folder/models";
import { DownloadFilesArgs } from "./tools/download_files/models";
import { QueryUploadProgressArgs } from "./tools/query_upload_progress/models";
import {
  uploadDataSchema,
  updateFeedSchema,
  downloadDataSchema,
  readFeedSchema,
  uploadFileSchema,
  uploadFolderSchema,
  downloadFilesSchema,
  listPostageStampsSchema,
  getPostageStampSchema,
  createPostageStampSchema,
  extendPostageStampSchema,
  queryUploadProgressSchema,
} from "./schemas/zod-schemas";
import { TaskManager } from "./tasks/task-manager";
import { determineIfGateway } from "./utils";
import { isTaskTerminal } from "./tasks/utils";
import { ExtendedTask } from "./tasks/models";

/**
 * Swarm MCP Server class
 */
export class SwarmMCPServer {
  public readonly server: McpServer;
  private readonly bee: Bee;
  private readonly taskManager: TaskManager;

  constructor() {
    // Initialize Bee client with the configured endpoint
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
            cancel: {},
          },
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupTaskHandlers();

    this.server.server.onerror = (error: Error) =>
      console.error("[Error]", error);

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    const nodeOnlyTools = [
      "list_postage_stamps",
      "get_postage_stamp",
      "create_postage_stamp",
      "extend_postage_stamp",
      "query_upload_progress",
    ];

    this.server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const isGateway = await determineIfGateway(this.bee);

      let tools = SwarmToolsSchema;
      if (isGateway) {
        tools = SwarmToolsSchema.filter(
          (item) => !nodeOnlyTools.includes(item.name)
        );
      }

      return {
        tools,
      };
    });

    this.server.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        // Extract arguments from the request
        const args = request.params.arguments;

        // Call the appropriate tool based on the request name
        switch (request.params.name) {
          case "upload_data": {
            const validArgs = uploadDataSchema.parse(args);
            return uploadData(validArgs as unknown as UploadDataArgs, this.bee);
          }

          case "download_data": {
            const validArgs = downloadDataSchema.parse(args);
            return downloadData(
              validArgs as unknown as DownloadDataArgs,
              this.bee
            );
          }

          case "update_feed": {
            const validArgs = updateFeedSchema.parse(args);
            return updateFeed(validArgs as unknown as UpdateFeedArgs, this.bee);
          }

          case "read_feed": {
            const validArgs = readFeedSchema.parse(args);
            return readFeed(validArgs as unknown as ReadFeedArgs, this.bee);
          }

          case "upload_file": {
            const validArgs = uploadFileSchema.parse(args);
            return uploadFile(
              validArgs as unknown as UploadFileArgs,
              this.bee,
              this.server.server.transport,
              this.taskManager
            );
          }

          case "upload_folder": {
            const validArgs = uploadFolderSchema.parse(args);
            return uploadFolder(
              validArgs as unknown as UploadFolderArgs,
              this.bee,
              this.server.server.transport,
              this.taskManager
            );
          }

          case "download_files": {
            const validArgs = downloadFilesSchema.parse(args);
            return downloadFiles(
              validArgs as unknown as DownloadFilesArgs,
              this.bee,
              this.server.server.transport
            );
          }

          case "query_upload_progress": {
            const validArgs = queryUploadProgressSchema.parse(args);
            return queryUploadProgress(
              validArgs as unknown as QueryUploadProgressArgs,
              this.bee,
              this.server.server.transport
            );
          }

          case "list_postage_stamps": {
            const validArgs = listPostageStampsSchema.parse(args);
            return listPostageStamps(
              validArgs as unknown as ListPostageStampsArgs,
              this.bee
            );
          }

          case "get_postage_stamp": {
            const validArgs = getPostageStampSchema.parse(args);
            return getPostageStamp(
              validArgs as unknown as GetPostageStampArgs,
              this.bee
            );
          }

          case "create_postage_stamp": {
            const validArgs = createPostageStampSchema.parse(args);
            return createPostageStamp(
              validArgs as unknown as CreatePostageStampArgs,
              this.bee
            );
          }

          case "extend_postage_stamp": {
            const validArgs = extendPostageStampSchema.parse(args);
            return extendPostageStamp(
              validArgs as unknown as ExtendPostageStampArgs,
              this.bee
            );
          }
        }

        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }
    );
  }

  private setupTaskHandlers() {
    this.server.server.setRequestHandler(
      ListTasksRequestSchema,
      async (request) => {
        const cursor = request.params?.cursor ?? "0";
        return this.taskManager.listTasks(cursor);
      }
    );

    this.server.server.setRequestHandler(
      GetTaskRequestSchema,
      async (request) => {
        const taskId = request.params.taskId;
        return this.taskManager.getTask(taskId);
      }
    );

    this.server.server.setRequestHandler(
      CancelTaskRequestSchema,
      async (request) => {
        const taskId = request.params.taskId;
        const cancelledTask = this.taskManager.cancelTask(taskId);
        return cancelledTask;
      }
    );

    this.server.server.setRequestHandler(
      GetTaskPayloadRequestSchema,
      async (request) => {
        const taskId = request.params.taskId;

        // Check task exists first
        let task: ExtendedTask;
        try {
          task = this.taskManager.getTask(taskId);
        } catch {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Task not found: ${taskId}`
          );
        }

        // Block until terminal OR timeout (30s max)
        const maxWait = 30000;
        const startTime = Date.now();

        while (
          !isTaskTerminal(task.status) &&
          Date.now() - startTime < maxWait
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, task.pollInterval ?? 1000)
          );

          try {
            task = this.taskManager.getTask(taskId);
          } catch {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Task expired: ${taskId}`
            );
          }
        }

        if (!isTaskTerminal(task.status)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Task timeout: ${taskId}`
          );
        }

        // Return the original result structure (e.g., CallToolResult for tools/call)
        const result = this.taskManager.getTaskResult(taskId);
        return result as Record<string, unknown>;
      }
    );
  }
}

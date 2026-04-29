/**
 * MCP Service implementation for handling blob data operations with Bee (Swarm)
 * Using Experimental MCP SDK Tasks API
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  CreateTaskResult,
  ErrorCode,
  GetPromptRequest,
  GetPromptRequestSchema,
  GetTaskPayloadRequestSchema,
  GetTaskPayloadResult,
  GetTaskRequestSchema,
  GetTaskResult,
  ListPromptsRequestSchema,
  ListTasksRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { Bee } from "@ethersphere/bee-js";
import path from "path";
import { readFile } from "fs/promises";
import config from "./config";
import { SwarmToolsSchema } from "./schemas";
import {
  determineIfGateway,
  getToolsWithTaskSupport,
  getToolErrorResponse,
  ToolResponse,
} from "./utils";

// Regular sync tools
import { uploadData } from "./tools/upload_data";
import { downloadData } from "./tools/download_data";
import { updateFeed } from "./tools/update_feed";
import { readFeed } from "./tools/read_feed";
import { downloadFiles } from "./tools/download_files";
import { listPostageStamps } from "./tools/list_postage_stamps";
import { getPostageStamp } from "./tools/get_postage_stamp";
import { queryUploadProgress } from "./tools/query_upload_progress";
import { createPostageStamp } from "./tools/create_postage_stamp";
import { extendPostageStamp } from "./tools/extend_postage_stamp";

// Branch-specific tools
import { openApp } from "./tools/open_app";
import { openUrl } from "./tools/open_url";
import { selectPostageStamp, getSelectedStamps } from "./tools/select_postage_stamp";
import { listSelectedStamps } from "./tools/list_selected_stamps";
import { listUploadHistory } from "./tools/upload_history";
import { getNodeStatus } from "./tools/get_node_status";
import { getStorageCost } from "./tools/get_storage_cost";

// Model types
import type { UploadFileArgs } from "./tools/upload_file/models";
import type { UploadFolderArgs } from "./tools/upload_folder/models";
import type { UploadDataArgs } from "./tools/upload_data/models";
import type { DownloadDataArgs } from "./tools/download_data/models";
import type { UpdateFeedArgs } from "./tools/update_feed/models";
import type { ReadFeedArgs } from "./tools/read_feed/models";
import type { DownloadFilesArgs } from "./tools/download_files/models";
import type { ListPostageStampsArgs } from "./tools/list_postage_stamps/models";
import type { GetPostageStampArgs } from "./tools/get_postage_stamp/models";
import type { CreatePostageStampArgs } from "./tools/create_postage_stamp/models";
import type { ExtendPostageStampArgs } from "./tools/extend_postage_stamp/models";
import type { QueryUploadProgressArgs } from "./tools/query_upload_progress/models";
import type { OpenAppArgs } from "./tools/open_app/models";
import type { OpenUrlArgs } from "./tools/open_url/models";
import type { SelectPostageStampArgs } from "./tools/select_postage_stamp/models";
import type { ListSelectedStampsArgs } from "./tools/list_selected_stamps/models";
import type { ListUploadHistoryArgs } from "./tools/upload_history/models";
import type { GetStorageCostArgs } from "./tools/get_storage_cost/models";

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
import { TASK_POLL_INTERVAL } from "./tasks/constants";
import { uploadFile } from "./tools/upload_file";
import { uploadFolder } from "./tools/upload_folder";
import { TaskManager } from "./tasks/task-manager";
import { CreateTaskModel } from "./tasks/models";
import { InMemoryTaskStore } from "@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory.js";
import { CreateTaskOptions } from "@modelcontextprotocol/sdk/experimental/index.js";
import {
  getCreatePostageStampPrompt,
  getDownloadDataPrompt,
  getDownloadFilesPrompt,
  getExtendPostageStampPrompt,
  getGetPostageStampPrompt,
  getListPostageStampsPrompt,
  getQueryUploadProgressPrompt,
  getReadFeedPrompt,
  getSwarmPromptsSchema,
  getUpdateFeedPrompt,
  getUploadDataPrompt,
  getUploadFilePrompt,
  getUploadFolderPrompt,
} from "./utils/prompts";

const OPEN_APP_RESOURCE_URI = "content://open-app-ui";
const OPEN_APP_RESOURCE_MIME_TYPE = "text/html";
const SELECTED_STAMPS_RESOURCE_URI = "selected-stamps://list";
const SELECTED_STAMPS_RESOURCE_MIME_TYPE = "application/json";
const OPEN_APP_RESOURCE_DIST_PATH = path.join(
  process.cwd(),
  "public/open-app/dist/mcp-app.html",
);

/**
 * Swarm MCP Server class using Experimental Tasks API
 */
export class SwarmMCPServer {
  public readonly server: McpServer;
  private readonly bee: Bee;
  private readonly taskManager: TaskManager;
  private readonly inMemoryTaskStore: InMemoryTaskStore;

  constructor() {
    this.bee = new Bee(config.bee.endpoint);
    this.inMemoryTaskStore = new InMemoryTaskStore();
    this.taskManager = new TaskManager(this.bee, this.inMemoryTaskStore);

    this.server = new McpServer(
      {
        name: "swarm-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          logging: {},
          prompts: {},
          tools: {},
          resources: {
            subscribe: true,
            listChanged: true,
          },
          tasks: {
            list: {},
            requests: {
              tools: {
                call: {},
              },
            },
          },
        },
      }
    );

    const server = this.server.server;

    const taskSupportTools = getToolsWithTaskSupport();

    // Handle tool calls
    server.setRequestHandler(
      CallToolRequestSchema,
      async (request, ctx): Promise<ToolResponse | CreateTaskResult> => {
        const { name, arguments: args } = request.params;
        const taskParams = (request.params._meta?.task ||
          request.params.task) as
          | { ttl?: number; pollInterval?: number }
          | undefined;

        const isGateway = await determineIfGateway(this.bee);

        const shouldExecuteAsTask =
          !isGateway && taskParams && taskSupportTools.includes(name);

        try {
          if (shouldExecuteAsTask) {
            const taskOptions: CreateTaskOptions = {
              ttl: Math.max(config.bee.taskTtlMs, taskParams.ttl || 0),
              pollInterval: taskParams.pollInterval ?? TASK_POLL_INTERVAL,
            };
            const createTaskModel: CreateTaskModel = {
              taskOptions,
              requestId: ctx.requestId,
              request,
              sessionId: ctx.sessionId,
            };

            switch (request.params.name) {
              case "upload_file": {
                const validArgs = uploadFileSchema.parse(args);
                return uploadFile(
                  validArgs as unknown as UploadFileArgs,
                  this.bee,
                  this.server.server.transport,
                  this.taskManager,
                  createTaskModel
                );
              }

              case "upload_folder": {
                const validArgs = uploadFolderSchema.parse(args);
                return uploadFolder(
                  validArgs as unknown as UploadFolderArgs,
                  this.bee,
                  this.server.server.transport,
                  this.taskManager,
                  createTaskModel
                );
              }

              case "download_files": {
                const validArgs = downloadFilesSchema.parse(args);
                return downloadFiles(
                  validArgs as DownloadFilesArgs,
                  this.bee,
                  this.server.server.transport,
                  this.taskManager,
                  createTaskModel
                );
              }

              case "create_postage_stamp": {
                const validArgs = createPostageStampSchema.parse(args);
                return createPostageStamp(
                  validArgs as CreatePostageStampArgs,
                  this.bee,
                  this.taskManager,
                  createTaskModel
                );
              }

              case "extend_postage_stamp": {
                const validArgs = extendPostageStampSchema.parse(args);
                return extendPostageStamp(
                  validArgs as ExtendPostageStampArgs,
                  this.bee,
                  this.taskManager,
                  createTaskModel
                );
              }

              default:
                throw new McpError(
                  ErrorCode.MethodNotFound,
                  `Unknown tool: ${request.params.name}`
                );
            }
          }
        } catch (error) {
          if (error instanceof ZodError) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              error.errors[0].message
            );
          }
          throw error;
        }

        try {
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

            case "upload_file": {
              const validArgs = uploadFileSchema.parse(args);
              return uploadFile(
                validArgs as unknown as UploadFileArgs,
                this.bee,
                this.server.server.transport
              );
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
              return getPostageStamp(
                validArgs as GetPostageStampArgs,
                this.bee
              );
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
                this.bee
              );
            }

            case "open_app":
              return openApp(args as unknown as OpenAppArgs);

            case "open_url":
              return openUrl(args as unknown as OpenUrlArgs);

            case "select_postage_stamp":
              return selectPostageStamp(args as unknown as SelectPostageStampArgs);

            case "list_selected_stamps":
              return listSelectedStamps(args as unknown as ListSelectedStampsArgs);

            case "list_upload_history":
              return listUploadHistory(args as unknown as ListUploadHistoryArgs);

            case "get_node_status":
              return getNodeStatus(this.bee);

            case "get_storage_cost":
              return getStorageCost(args as unknown as GetStorageCostArgs, this.bee);

            default:
              throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown tool: ${request.params.name}`
              );
          }
        } catch (error) {
          if (error instanceof ZodError) {
            return getToolErrorResponse(error.errors[0].message);
          }
          throw error;
        }
      }
    );

    this.registerPrompts();

    this.registerTaskHandlers();

    this.registerSyncTools();

    this.registerResources();

    this.server.server.onerror = (error: Error) =>
      console.error("[Error]", error);

    process.on("SIGINT", async () => {
      // Clear all active polls
      await this.server.close();
      process.exit(0);
    });
  }

  private registerPrompts() {
    const server = this.server.server;

    server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      ...getSwarmPromptsSchema(),
    }));

    server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest) => {
        const { name, arguments: args = {} } = request.params ?? {};

        try {
          let prompt = "";
          let description = "";

          switch (name) {
            case "upload_data_prompt": {
              const validArgs = uploadDataSchema.parse(args);
              prompt = getUploadDataPrompt(validArgs as UploadDataArgs);
              description = "Upload data prompt";
              break;
            }

            case "download_data_prompt": {
              const validArgs = downloadDataSchema.parse(args);
              prompt = getDownloadDataPrompt(validArgs as DownloadDataArgs);
              description = "Download data prompt";
              break;
            }

            case "update_feed_prompt": {
              const validArgs = updateFeedSchema.parse(args);
              prompt = getUpdateFeedPrompt(validArgs as UpdateFeedArgs);
              description = "Update feed prompt";
              break;
            }

            case "read_feed_prompt": {
              const validArgs = readFeedSchema.parse(args);
              prompt = getReadFeedPrompt(validArgs as ReadFeedArgs);
              description = "Read feed prompt";
              break;
            }

            case "upload_file_prompt": {
              const validArgs = uploadFileSchema.parse(args);
              prompt = getUploadFilePrompt(validArgs as UploadFileArgs);
              description = "Upload file prompt";
              break;
            }

            case "upload_folder_prompt": {
              const validArgs = uploadFolderSchema.parse(args);
              prompt = getUploadFolderPrompt(validArgs as UploadFolderArgs);
              description = "Upload folder prompt";
              break;
            }

            case "download_files_prompt": {
              const validArgs = downloadFilesSchema.parse(args);
              prompt = getDownloadFilesPrompt(validArgs as DownloadFilesArgs);
              description = "Download files prompt";
              break;
            }

            case "list_postage_stamps_prompt": {
              const validArgs = listPostageStampsSchema.parse(args);
              prompt = getListPostageStampsPrompt(
                validArgs as ListPostageStampsArgs
              );
              description = "List postage stamps prompt";
              break;
            }

            case "get_postage_stamp_prompt": {
              const validArgs = getPostageStampSchema.parse(args);
              prompt = getGetPostageStampPrompt(
                validArgs as GetPostageStampArgs
              );
              description = "Get postage stamp prompt";
              break;
            }

            case "create_postage_stamp_prompt": {
              const validArgs = createPostageStampSchema.parse(args);
              prompt = getCreatePostageStampPrompt(
                validArgs as CreatePostageStampArgs
              );
              description = "Create postage stamp prompt";
              break;
            }

            case "extend_postage_stamp_prompt": {
              const validArgs = extendPostageStampSchema.parse(args);
              prompt = getExtendPostageStampPrompt(
                validArgs as ExtendPostageStampArgs
              );
              description = "Extend postage stamp prompt";
              break;
            }

            case "query_upload_progress_prompt": {
              const validArgs = queryUploadProgressSchema.parse(args);
              prompt = getQueryUploadProgressPrompt(
                validArgs as QueryUploadProgressArgs
              );
              description = "Query upload progress prompt";
              break;
            }

            default:
              throw new McpError(
                ErrorCode.InvalidParams,
                `Unknown tool: ${request.params.name}`
              );
          }

          return {
            description,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: prompt,
                },
              },
            ],
          };
        } catch (error) {
          if (error instanceof ZodError) {
            throw new McpError(
              ErrorCode.InvalidParams,
              error.errors[0].message
            );
          }
          throw error;
        }
      }
    );
  }

  private registerTaskHandlers() {
    const server = this.server.server;

    // Handle tasks/get
    server.setRequestHandler(
      GetTaskRequestSchema,
      async (request): Promise<GetTaskResult> => {
        const { taskId } = request.params;
        const task = await this.taskManager.getTask(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }
        return task;
      }
    );

    // Handle tasks/result
    server.setRequestHandler(
      GetTaskPayloadRequestSchema,
      async (request, ctx): Promise<GetTaskPayloadResult> => {
        const { taskId } = request.params;

        return this.taskManager.getTaskResult(taskId, ctx.sessionId ?? "");
      }
    );

    server.setRequestHandler(ListTasksRequestSchema, async (request) => {
      return this.taskManager.listTasks(request.params?.cursor);
    });
  }

  private registerSyncTools() {
    // List tools
    this.server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const isGateway = await determineIfGateway(this.bee);
      let tools = [...SwarmToolsSchema];

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
  }

  private registerResources() {
    this.server.registerResource(
      "open-app-ui",
      OPEN_APP_RESOURCE_URI,
      {
        title: "Swarm MCP App UI",
        description: "Static HTML interface for the open_app tool.",
        mimeType: OPEN_APP_RESOURCE_MIME_TYPE,
      },
      async () => {
        try {
          const html = await readFile(OPEN_APP_RESOURCE_DIST_PATH, "utf-8");

          if (html.includes('src="/src/')) {
            throw new McpError(
              ErrorCode.InternalError,
              "CRITICAL: The server loaded the raw source HTML instead of the bundled build. Please run 'npm run build' again.",
            );
          }

          return {
            contents: [
              {
                uri: OPEN_APP_RESOURCE_URI,
                mimeType: OPEN_APP_RESOURCE_MIME_TYPE,
                text: html,
              },
            ],
          };
        } catch (error) {
          if (error instanceof McpError) {
            throw error;
          }

          const message =
            error instanceof Error ? error.message : "unknown error";

          throw new McpError(
            ErrorCode.InternalError,
            `Unable to load resource at ${OPEN_APP_RESOURCE_URI}: ${message}`,
          );
        }
      },
    );

    this.server.registerResource(
      "selected-stamps-list",
      SELECTED_STAMPS_RESOURCE_URI,
      {
        title: "Selected Postage Stamps",
        description: "List of currently selected postage stamp labels.",
        mimeType: SELECTED_STAMPS_RESOURCE_MIME_TYPE,
      },
      async () => {
        const selectedStamps = getSelectedStamps();
        return {
          contents: [
            {
              uri: SELECTED_STAMPS_RESOURCE_URI,
              mimeType: SELECTED_STAMPS_RESOURCE_MIME_TYPE,
              text: JSON.stringify({ selectedStamps }, null, 2),
            },
          ],
        };
      },
    );
  }
}

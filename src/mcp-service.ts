/**
 * MCP Service implementation for Swarm operations, targeting spec 2026-07-28.
 *
 * Task creation is server-directed under SEP-2663: the client advertises the
 * `io.modelcontextprotocol/tasks` extension in its per-request `_meta`, and
 * the server decides whether a task-eligible tool should run async. A scoped
 * 2025-era compatibility branch inside `shouldRunAsTask` honors legacy
 * `_meta.task` opt-in for 2025-era clients (option A shim; delete when
 * 2025-era clients are gone).
 */
import {
  McpServer,
  ProtocolError,
  ProtocolErrorCode,
  ServerContext,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { z, ZodError } from "zod";
import { Bee } from "@ethersphere/bee-js";
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
import {
  CreateTaskModel,
  CreateTaskResult,
  CreateTaskOptions,
  Task,
} from "./tasks/models";
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

const TASKS_EXTENSION_KEY = "io.modelcontextprotocol/tasks" as const;

const TASK_MODE_TOOLS: ReadonlySet<string> = new Set([
  "upload_file",
  "upload_folder",
  "download_files",
  "create_postage_stamp",
  "extend_postage_stamp",
]);

interface TaskGateResult {
  shouldRun: boolean;
  taskOptions?: CreateTaskOptions;
}

/**
 * Per-request task-mode gate. Reads era and client capabilities from _meta on
 * every request — never cached on connection or server state.
 *
 * 2026-era branch: modern protocol version + client advertised the tasks
 * extension in its capabilities.
 *
 * 2025-era branch (option A shim): honor legacy _meta.task / params.task as
 * an implicit tasks-extension signal. Isolated here for later removal.
 */
function shouldRunAsTask(
  toolName: string,
  params: { _meta?: Record<string, unknown>; task?: unknown },
  ctx: ServerContext
): TaskGateResult {
  if (!TASK_MODE_TOOLS.has(toolName)) {
    return { shouldRun: false };
  }

  const envelope = (ctx.mcpReq as { envelope?: Record<string, unknown> })
    .envelope;
  const protocolVersion =
    (envelope?.[PROTOCOL_VERSION_META_KEY] as string | undefined) ??
    (params._meta?.[PROTOCOL_VERSION_META_KEY] as string | undefined);
  const isModern =
    typeof protocolVersion === "string" &&
    protocolVersion.startsWith("2026-");

  if (isModern) {
    // Modern-era task-mode is temporarily disabled: at SDK 2.0.0 the modern
    // wire codec rejects `tasks/get` / `tasks/cancel` with -32601 because
    // extension-namespace method routing isn't wired in yet. Returning a
    // task handle here would give the client nothing to poll. When the SDK
    // ships first-class io.modelcontextprotocol/tasks routing (plan §"SEP-
    // 2663 SDK support timing"), restore the gate: read
    // _meta[CLIENT_CAPABILITIES_META_KEY].extensions[TASKS_EXTENSION_KEY]
    // and route to task-mode when advertised.
    return { shouldRun: false };
  }

  // 2025-era shim (option A). Honors legacy _meta.task / params.task so the
  // current userbase's async-upload behavior survives the migration. Delete
  // this branch when 2025-era clients are gone.
  const legacyTaskParams =
    ((params._meta as { task?: { ttl?: number; pollInterval?: number } })
      ?.task ??
      (params as { task?: { ttl?: number; pollInterval?: number } }).task) as
      | { ttl?: number; pollInterval?: number }
      | undefined;
  if (legacyTaskParams) {
    return {
      shouldRun: true,
      taskOptions: {
        ttl: Math.max(config.bee.taskTtlMs, legacyTaskParams.ttl ?? 0),
        pollInterval: legacyTaskParams.pollInterval ?? TASK_POLL_INTERVAL,
      },
    };
  }

  return { shouldRun: false };
}

// Schemas for the tasks extension (SEP-2663). Hand-rolled via
// `setRequestHandler(method, { params, result }, handler)` because the v2 SDK
// removed the experimental tasks interception and left task wire types
// deprecated. When first-class extension support ships in
// @modelcontextprotocol/server, replace these with the SDK's registration API.

const GetTaskParamsSchema = z.object({
  taskId: z.string(),
});

const CancelTaskParamsSchema = z.object({
  taskId: z.string(),
});

const SERVER_NAME = "swarm-mcp-server";
const SERVER_VERSION = "0.1.0";

/**
 * Swarm MCP Server class.
 *
 * Owns process-scoped shared state — Bee client and in-process TaskManager.
 * `.server` is an McpServer wired for direct-transport use (stdio).
 *
 * For HTTP via `createMcpHandler(factory)`, use `.buildFreshServer()` — the
 * SDK calls the factory once per HTTP request and requires a fresh McpServer
 * each time. Shared state (bee, taskManager) is closed over so all fresh
 * server instances observe the same tasks Map — sticky routing to this
 * process is still required for task polling (plan §"Sticky routing").
 */
export class SwarmMCPServer {
  public readonly server: McpServer;
  private readonly bee: Bee;
  private readonly taskManager: TaskManager;

  constructor() {
    this.bee = new Bee(config.bee.endpoint);
    this.taskManager = new TaskManager(this.bee);

    this.server = this.buildServerInstance();

    this.server.server.onerror = (error: Error) =>
      console.error("[Error]", error);

    process.on("SIGINT", async () => {
      this.taskManager.destroy();
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Factory for `createMcpHandler` — returns a fresh McpServer per call,
   * closing over this instance's shared bee + taskManager.
   */
  buildFreshServer(): McpServer {
    return this.buildServerInstance();
  }

  private buildServerInstance(): McpServer {
    const server = new McpServer(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          prompts: {},
          tools: {},
          extensions: {
            [TASKS_EXTENSION_KEY]: {},
          },
        } as Record<string, unknown>,
        supportedProtocolVersions: [
          "2026-07-28",
          "2025-11-25",
          "2025-06-18",
          "2025-03-26",
        ],
        cacheHints: {
          "tools/list": { ttlMs: 300_000, cacheScope: "private" },
          "prompts/list": { ttlMs: 300_000, cacheScope: "private" },
          "server/discover": { ttlMs: 3_600_000, cacheScope: "public" },
        },
        fallbackRequestHandler: this.buildTasksFallbackHandler(),
        instructions:
          "Only call tools with parameter values explicitly provided by the user. " +
          "Never invent, guess, or fill in values (postage batch IDs, references, addresses, " +
          "labels, etc.) that the user did not supply. If a required value is missing, ask the " +
          "user for it instead of fabricating one. Omit optional parameters unless the user asked for them." +
          "Always display the references in the response.",
      } as ConstructorParameters<typeof McpServer>[1]
    );

    this.registerToolsCallHandler(server);
    this.registerPrompts(server);
    this.registerTaskHandlers(server);
    this.registerListTools(server);
    // server/discover is auto-registered by the SDK when
    // supportedProtocolVersions contains a modern (>=2026-07-28) entry.
    // It reads capabilities we passed to the constructor and returns the
    // spec-shaped { supportedVersions, capabilities, instructions? } result.

    return server;
  }

  private registerToolsCallHandler(mcpServer: McpServer) {
    const server = mcpServer.server;
    const bee = this.bee;
    const taskManager = this.taskManager;
    const mcpServerRef = mcpServer;
    const taskSupportTools = getToolsWithTaskSupport();

    server.setRequestHandler(
      "tools/call",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (request: any, ctx): Promise<any> => {
        const { name, arguments: args } = request.params as {
          name: string;
          arguments?: unknown;
        };

        const isGateway = await determineIfGateway(this.bee);

        const gate =
          !isGateway && taskSupportTools.includes(name)
            ? shouldRunAsTask(name, request.params, ctx)
            : { shouldRun: false };

        try {
          if (gate.shouldRun && gate.taskOptions) {
            const createTaskModel: CreateTaskModel = {
              taskOptions: gate.taskOptions,
              requestId: ctx.mcpReq.id,
              request,
            };

            switch (name) {
              case "upload_file": {
                const validArgs = uploadFileSchema.parse(args);
                return uploadFile(
                  validArgs as unknown as UploadFileArgs,
                  this.bee,
                  mcpServerRef.server.transport,
                  this.taskManager,
                  createTaskModel
                ) as unknown as Promise<CreateTaskResult>;
              }

              case "upload_folder": {
                const validArgs = uploadFolderSchema.parse(args);
                return uploadFolder(
                  validArgs as unknown as UploadFolderArgs,
                  this.bee,
                  mcpServerRef.server.transport,
                  this.taskManager,
                  createTaskModel
                ) as unknown as Promise<CreateTaskResult>;
              }

              case "download_files": {
                const validArgs = downloadFilesSchema.parse(args);
                return downloadFiles(
                  validArgs as DownloadFilesArgs,
                  this.bee,
                  mcpServerRef.server.transport,
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
                throw new ProtocolError(
                  ProtocolErrorCode.MethodNotFound,
                  `Unknown tool: ${name}`
                );
            }
          }
        } catch (error) {
          if (error instanceof ZodError) {
            throw new ProtocolError(
              ProtocolErrorCode.InvalidRequest,
              error.issues[0].message
            );
          }
          throw error;
        }

        try {
          switch (name) {
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
                mcpServerRef.server.transport
              );
            }

            case "upload_folder": {
              const validArgs = uploadFolderSchema.parse(args);
              return uploadFolder(
                validArgs as unknown as UploadFolderArgs,
                this.bee,
                mcpServerRef.server.transport
              );
            }

            case "download_files": {
              const validArgs = downloadFilesSchema.parse(args);
              return downloadFiles(
                validArgs as DownloadFilesArgs,
                this.bee,
                mcpServerRef.server.transport
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

            default:
              throw new ProtocolError(
                ProtocolErrorCode.MethodNotFound,
                `Unknown tool: ${name}`
              );
          }
        } catch (error) {
          if (error instanceof ZodError) {
            return getToolErrorResponse(error.issues[0].message) as ToolResponse;
          }
          throw error;
        }
      }
    );
  }

  private registerPrompts(mcpServer: McpServer) {
    const server = mcpServer.server;

    server.setRequestHandler("prompts/list", async () => ({
      ...getSwarmPromptsSchema(),
    }));

    server.setRequestHandler(
      "prompts/get",
      async (request) => {
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
              throw new ProtocolError(
                ProtocolErrorCode.InvalidParams,
                `Unknown prompt: ${name}`
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
            throw new ProtocolError(
              ProtocolErrorCode.InvalidParams,
              error.issues[0].message
            );
          }
          throw error;
        }
      }
    );
  }

  private buildTasksFallbackHandler(): (request: {
    method: string;
    params?: unknown;
  }) => Promise<unknown> {
    // Fallback handler for tasks/* methods.
    //
    // The v2 SDK's modern wire codec doesn't route the tasks/* extension
    // methods to setRequestHandler registrations (SEP-2663 tasks moved to
    // an extension; the SDK will add first-class routing later). Under
    // modern era those requests bypass the typed handler map and land
    // here as "unknown method". Under legacy era our 3-arg
    // setRequestHandler registrations catch them directly and this
    // fallback is not invoked. Same handler logic either way — the
    // dispatch path differs by era.
    const taskManager = this.taskManager;
    return async (request) => {
      const { method, params } = request;
      const p = params as { taskId?: string } | undefined;
      if (method === "tasks/get") {
        if (!p?.taskId) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            "taskId required"
          );
        }
        return taskManager.getTaskWithResult(p.taskId);
      }
      if (method === "tasks/cancel") {
        if (!p?.taskId) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            "taskId required"
          );
        }
        const task = await taskManager.cancelTask(p.taskId);
        return { task };
      }
      throw new ProtocolError(
        ProtocolErrorCode.MethodNotFound,
        `Method not found: ${method}`
      );
    };
  }

  private registerTaskHandlers(mcpServer: McpServer) {
    const server = mcpServer.server;

    // tasks/get — canonical poll for task status; terminal responses embed result.
    server.setRequestHandler(
      "tasks/get",
      {
        params: GetTaskParamsSchema,
        result: z.object({
          task: z.unknown(),
          result: z.unknown().optional(),
        }),
      },
      async (params) => {
        const { taskId } = params;
        return this.taskManager.getTaskWithResult(taskId);
      }
    );

    // tasks/cancel — terminate a running task; returns the updated handle.
    server.setRequestHandler(
      "tasks/cancel",
      {
        params: CancelTaskParamsSchema,
        result: z.object({
          task: z.unknown(),
        }),
      },
      async (params) => {
        const { taskId } = params;
        const task = await this.taskManager.cancelTask(taskId);
        return { task };
      }
    );
  }

  private registerListTools(mcpServer: McpServer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mcpServer.server.setRequestHandler("tools/list", async (): Promise<any> => {
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

      // Stable ordering (spec Minor #3) enables client-side caching and
      // improves LLM prompt-cache hit rates.
      tools.sort((a, b) => a.name.localeCompare(b.name));

      return { tools };
    });
  }
}

// Type re-exports to keep tools happy with local task types.
export type { CreateTaskModel, CreateTaskResult, Task };

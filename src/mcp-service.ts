/**
 * MCP Service implementation for Swarm operations, targeting spec 2026-07-28.
 */
import {
  McpServer,
  ProtocolError,
  ProtocolErrorCode,
} from "@modelcontextprotocol/server";
import { ZodError } from "zod";
import { Bee } from "@ethersphere/bee-js";
import config from "./config";
import { SwarmToolsSchema } from "./schemas";
import {
  determineIfGateway,
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

// Tools whose dormant task branches the tasks-extension revival will re-enable
// (see shouldRunAsTask). Server-side only, by design: SEP-2663 task-mode is
// server-directed — the client opts in once per request via its `_meta`
// capabilities and must handle either result shape, so there is no per-tool
// declaration on the wire. The 2025-era `execution.taskSupport` field that
// used to mirror this list was deleted from the 2026 Tool schema and is not
// re-introduced by the extension.
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
 * Per-request task-mode gate — DORMANT, the single reactivation point for
 * MCP tasks (SEP-2663, io.modelcontextprotocol/tasks extension).
 *
 * Always declines today. The feasibility boundary, verified against
 * @modelcontextprotocol/server 2.0.0:
 *
 * - tasks/get and tasks/cancel are genuinely blocked under the 2026 era:
 *   they are 2025 spec methods absent from the 2026 registry, so the SDK's
 *   era-registry guard answers -32601 before dispatch — no server-side
 *   registration or fallback can intercept them. Returning a task handle
 *   would give the client a taskId it cannot poll, hence the decline.
 * - tools/call CAN carry a task handle: the extension's CreateTaskResult is
 *   `Result & Task` — Task fields FLAT on the result, no `task` key
 *   (ext-tasks schema/draft/schema.ts). `resultType: "task"` passes the
 *   encode seam verbatim (open union), the 2026 CallToolResultSchema is a
 *   loose object, and because the flat shape carries no foreign-family key
 *   (`task`, `inputRequests`), `normalizeContentlessToolResult` auto-fills
 *   `content: []` — the handler need not provide one. (Only the legacy
 *   `{ task }`-keyed shape trips the foreign-family guard and requires an
 *   explicit `content` block.)
 * - tasks/update is registrable (absent from every era registry).
 * - Entry-level interception of tasks/get before the pinned instance is the
 *   SDK's own pattern (serveStdio does it for subscriptions/listen), but for
 *   us it would mean owning wire parsing outside the SDK — rejected;
 *   waiting for SDK tasks-extension dispatch instead.
 *
 * Revival checklist:
 * 1. Advertise the extension in capabilities.extensions (deliberately NOT
 *    advertised while dormant — advertise it in the change that makes it
 *    work).
 * 2. Read the client's advertised extension here, per request, from
 *    _meta[CLIENT_CAPABILITIES_META_KEY].extensions["io.modelcontextprotocol/tasks"]
 *    (never cached on connection or server state) and return
 *    `{ shouldRun: true, taskOptions }` for tools in TASK_MODE_TOOLS.
 * 3. Register tasks/get, tasks/cancel (empty ack — `CancelTaskResult =
 *    Result`; cancellation is cooperative) and tasks/update (inputResponses)
 *    via the SDK's extension API. SEP-2663 has no tasks/list and no
 *    tasks/result. Two shape changes to make, both verified against the
 *    ext-tasks schema:
 *    a. tasks/get returns `Result & DetailedTask` — FLAT, with `result` on
 *       CompletedTask and `error` on FailedTask. Project ExtendedTask to that
 *       at the handler boundary; do NOT flatten the internal store, which
 *       also holds unserializable bookkeeping (updateStatus).
 *    b. Task field names differ from our SDK-typed Task: `ttlMs: number |
 *       null` and `pollIntervalMs?: number` — not ttl/pollInterval
 *       (CreateTaskOptions in tasks/models.ts).
 * 4. Make TaskManager.cancelTask abort the underlying Bee operation (TODO
 *    in task-manager.ts).
 * 5. Consider task-mode for create_postage_stamp / extend_postage_stamp,
 *    which are sync-only and can exceed client timeouts on slow purchases.
 */
function shouldRunAsTask(toolName: string): TaskGateResult {
  if (!TASK_MODE_TOOLS.has(toolName)) {
    return { shouldRun: false };
  }

  return { shouldRun: false };
}

const SERVER_NAME = "swarm-mcp-server";
const SERVER_VERSION = "0.1.0";

/**
 * Swarm MCP Server class.
 *
 * Owns process-scoped shared state — Bee client and in-process TaskManager.
 *
 * Both entry points build their McpServer through `.buildFreshServer()`:
 * `createMcpHandler(factory)` (HTTP) calls it once per request, `serveStdio`
 * (stdio) calls it once per connection. Shared state (bee, taskManager) is
 * closed over so all fresh server instances observe the same tasks Map —
 * sticky routing to this process is still required for task polling
 * (plan §"Sticky routing").
 */
export class SwarmMCPServer {
  private readonly bee: Bee;
  private readonly taskManager: TaskManager;

  constructor() {
    this.bee = new Bee(config.bee.endpoint);
    this.taskManager = new TaskManager(this.bee);

    process.on("SIGINT", () => {
      this.taskManager.destroy();
    });
  }

  /**
   * Factory for the serving entries (`createMcpHandler`, `serveStdio`) —
   * returns a fresh McpServer per call, closing over this instance's shared
   * bee + taskManager.
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
          // No `extensions` entry: the io.modelcontextprotocol/tasks
          // extension is deliberately NOT advertised while task-mode is
          // dormant — advertise it in the same change that makes it work
          // (revival checklist in the file header).
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
    this.registerListTools(server);
    // server/discover is auto-registered by the SDK when
    // supportedProtocolVersions contains a modern (>=2026-07-28) entry.
    // It reads capabilities we passed to the constructor and returns the
    // spec-shaped { supportedVersions, capabilities, instructions? } result.

    return server;
  }

  private registerToolsCallHandler(mcpServer: McpServer) {
    const server = mcpServer.server;

    server.setRequestHandler(
      "tools/call",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (request: any, ctx): Promise<any> => {
        const { name, arguments: args } = request.params as {
          name: string;
          arguments?: unknown;
        };

        const isGateway = await determineIfGateway(this.bee);

        // Gateways cannot mint tasks (no postage/tag operations of their own),
        // so they never enter task-mode. shouldRunAsTask owns the
        // TASK_MODE_TOOLS membership check.
        const gate: TaskGateResult = isGateway
          ? { shouldRun: false }
          : shouldRunAsTask(name);

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
                  this.taskManager,
                  createTaskModel
                ) as unknown as Promise<CreateTaskResult>;
              }

              case "upload_folder": {
                const validArgs = uploadFolderSchema.parse(args);
                return uploadFolder(
                  validArgs as unknown as UploadFolderArgs,
                  this.bee,
                  this.taskManager,
                  createTaskModel
                ) as unknown as Promise<CreateTaskResult>;
              }

              case "download_files": {
                const validArgs = downloadFilesSchema.parse(args);
                return downloadFiles(
                  validArgs as DownloadFilesArgs,
                  this.bee,
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
                this.bee
              );
            }

            case "upload_folder": {
              const validArgs = uploadFolderSchema.parse(args);
              return uploadFolder(
                validArgs as unknown as UploadFolderArgs,
                this.bee
              );
            }

            case "download_files": {
              const validArgs = downloadFilesSchema.parse(args);
              return downloadFiles(validArgs as DownloadFilesArgs, this.bee);
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
            return getToolErrorResponse(
              error.issues[0].message
            ) as ToolResponse;
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

    server.setRequestHandler("prompts/get", async (request) => {
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
            prompt = getGetPostageStampPrompt(validArgs as GetPostageStampArgs);
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
    });
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

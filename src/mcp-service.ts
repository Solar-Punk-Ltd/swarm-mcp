/**
 * MCP Service implementation for handling blob data operations with Bee (Swarm)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { fileURLToPath } from "url";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Bee } from "@ethersphere/bee-js";
import path from "node:path";
import { readFile } from "node:fs/promises";
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
import { getTime } from "./tools/get_time";
import { openUrl } from "./tools/open_url";
import { ListPostageStampsArgs } from "./tools/list-postage-stamps/models";
import { GetPostageStampArgs } from "./tools/get_postage_stamp/models";
import { extendPostageStamp } from "./tools/extend_postage_stamp";
import { createPostageStamp } from "./tools/create_postage_stamp";
import { CreatePostageStampArgs } from "./tools/create_postage_stamp/models";
import { ExtendPostageStampArgs } from "./tools/extend_postage_stamp/models";
import {
  PostageBatchCuratedSchema,
  PostageBatchSummarySchema,
  SwarmToolsSchema,
} from "./schemas";
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
import { GetTimeArgs } from "./tools/get_time/models";
import { OpenUrlArgs } from "./tools/open_url/models";
import { selectPostageStamp, getSelectedStamps } from "./tools/select_postage_stamp";
import { SelectPostageStampArgs } from "./tools/select_postage_stamp/models";
import { listSelectedStamps } from "./tools/list_selected_stamps";
import { ListSelectedStampsArgs } from "./tools/list_selected_stamps/models";
import { listUploadHistory } from "./tools/upload_history";
import { ListUploadHistoryArgs } from "./tools/upload_history/models";
import { determineIfGateway } from "./utils";

const GET_TIME_RESOURCE_URI = "content://get-time-ui";
const GET_TIME_RESOURCE_MIME_TYPE = "text/html";
const SELECTED_STAMPS_RESOURCE_URI = "selected-stamps://list";
const SELECTED_STAMPS_RESOURCE_MIME_TYPE = "application/json";
// CommonJS környezetben (mivel a tsconfig szerint ez az) a __dirname használatos
const GET_TIME_RESOURCE_DIST_PATH = path.join(
  process.cwd(),
  "public/get-time/dist/mcp-app.html",
);
/**
 * Swarm MCP Server class
 */
export class SwarmMCPServer {
  public readonly server: McpServer;
  private readonly bee: Bee;

  constructor() {
    // Initialize Bee client with the configured endpoint
    this.bee = new Bee(config.bee.endpoint);

    this.server = new McpServer(
      {
        name: "swarm-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {
            subscribe: true,
            listChanged: true,
          },
        },
      },
    );

    this.registerResources();
    this.setupToolHandlers();

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
          (item) => !nodeOnlyTools.includes(item.name),
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
          case "upload_data":
            return uploadData(args as unknown as UploadDataArgs, this.bee);

          case "download_data":
            return downloadData(args as unknown as DownloadDataArgs, this.bee);

          case "update_feed":
            return updateFeed(args as unknown as UpdateFeedArgs, this.bee);

          case "read_feed":
            return readFeed(args as unknown as ReadFeedArgs, this.bee);

          case "upload_file":
            return uploadFile(
              args as unknown as UploadFileArgs,
              this.bee,
              this.server.server.transport,
            );

          case "upload_folder":
            return uploadFolder(
              args as unknown as UploadFolderArgs,
              this.bee,
              this.server.server.transport,
            );

          case "download_files":
            return downloadFiles(
              args as unknown as DownloadFilesArgs,
              this.bee,
              this.server.server.transport,
            );

          case "query_upload_progress":
            return queryUploadProgress(
              args as unknown as QueryUploadProgressArgs,
              this.bee,
              this.server.server.transport,
            );

          case "list_postage_stamps":
            return listPostageStamps(
              args as unknown as ListPostageStampsArgs,
              this.bee,
            );

          case "get_postage_stamp":
            return getPostageStamp(
              args as unknown as GetPostageStampArgs,
              this.bee,
            );

          case "create_postage_stamp":
            return createPostageStamp(
              args as unknown as CreatePostageStampArgs,
              this.bee,
            );

          case "extend_postage_stamp":
            return extendPostageStamp(
              args as unknown as ExtendPostageStampArgs,
              this.bee,
            );

          case "swarm-mcp-app-tool":
            return getTime(args as unknown as GetTimeArgs);

          case "open_url":
            return openUrl(args as unknown as OpenUrlArgs);

          case "select_postage_stamp":
            return selectPostageStamp(args as unknown as SelectPostageStampArgs);

          case "list_selected_stamps":
            return listSelectedStamps(args as unknown as ListSelectedStampsArgs);

          case "list_upload_history":
            return listUploadHistory(args as unknown as ListUploadHistoryArgs);
        }

        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`,
        );
      },
    );
  }

  
  private registerResources() {
    this.server.registerResource(
      "get-time-ui",
      GET_TIME_RESOURCE_URI,
      {
        title: "Swarm MCP App UI",
        description: "Static HTML interface for the swarm-mcp-app-tool.",
        mimeType: GET_TIME_RESOURCE_MIME_TYPE,
      },
      async () => {
        try {
         
          const html = await readFile(GET_TIME_RESOURCE_DIST_PATH, "utf-8");

          
          if (html.includes('src="/src/')) {
            throw new McpError(
              ErrorCode.InternalError,
              "CRITICAL: The server loaded the raw source HTML instead of the bundled build. Please run 'npm run build' again.",
            );
          }
          return {
            contents: [
              {
                uri: GET_TIME_RESOURCE_URI,
                mimeType: GET_TIME_RESOURCE_MIME_TYPE,
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
            `Unable to load resource at ${GET_TIME_RESOURCE_URI}: ${message}`,
          );
        }
      },
    );

    // Register selected stamps resource
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

/**
 * MCP Tool: upload_file
 * Upload a file to Swarm
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Bee, FileUploadOptions } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import { promisify } from "util";
import config from "../../config";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import { UploadFileArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

import { TaskManager } from "../../tasks/task-manager";
import { updateUploadFileTaskStatus } from "./utils";

export async function uploadFile(
  args: UploadFileArgs,
  bee: Bee,
  transport: any,
  taskManager?: TaskManager
): Promise<ToolResponse | any> {
  if (!args.data) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: data"
    );
  }

  const postageBatchId = await getUploadPostageBatchId(
    args.postageBatchId,
    bee
  );

  let binaryData: Buffer;
  let name: string | undefined;

  if (args.isPath) {
    // Check if in stdio mode for file path uploads
    if (!(transport instanceof StdioServerTransport)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "File path uploads are only supported in stdio mode"
      );
    }

    // Read file from path
    try {
      binaryData = await promisify(fs.readFile)(args.data);
    } catch (fileError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unable to read file at path: ${args.data}`
      );
    }
    name = args.data.split("/").pop();
  } else {
    binaryData = Buffer.from(args.data, "base64");
  }

  const redundancyLevel = args.redundancyLevel;
  const options: FileUploadOptions = {};

  const deferred =
    binaryData.length > config.bee.deferredUploadSizeThreshold * 1024 * 1024;
  options.deferred = deferred;
  options.redundancyLevel = redundancyLevel;

  let message = "File successfully uploaded to Swarm";
  let tagId: string | undefined = undefined;
  // Create tag for deferred uploads or when explicitly requested
  if (deferred) {
    try {
      const tag = await bee.createTag();
      options.tag = tag.uid;
      tagId = tag.uid.toString();
      message =
        "File upload started in deferred mode. Use query_upload_progress to track progress.";

      // Create MCP Task if manager is available
      if (taskManager) {
        const task = taskManager.createTask(
          "swarm_upload",
          "swarm_upload",
          updateUploadFileTaskStatus,
          tag.uid
        );
        // Start the upload in background
        bee
          .uploadFile(postageBatchId, binaryData, name, options)
          .catch(() => {});

        // Return Task immediately
        return {
          task,
        };
      }
    } catch (error) {
      // Ignore tag creation error
    }
  }

  let result;

  try {
    // Start the deferred upload
    result = await bee.uploadFile(postageBatchId, binaryData, name, options);
  } catch (error) {
    if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
      throw new McpError(ErrorCode.InvalidRequest, getErrorMessage(error));
    } else {
      throw new McpError(ErrorCode.InvalidParams, "Unable to upload file.");
    }
  }

  return getResponseWithStructuredContent({
    reference: result.reference.toString(),
    url: config.bee.endpoint + "/bzz/" + result.reference.toString(),
    message,
    tagId,
  });
}

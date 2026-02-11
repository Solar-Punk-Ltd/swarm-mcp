import {
  McpError,
  ErrorCode,
  CreateTaskResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Bee, CollectionUploadOptions } from "@ethersphere/bee-js";
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
import { UploadFolderArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

import { updateUploadFolderTaskStatus } from "./utils";
import { TaskManager } from "../../tasks/task-manager";
import { CreateTaskModel, TaskState } from "../../tasks/models";

export async function uploadFolder(
  args: UploadFolderArgs,
  bee: Bee,
  transport: any,
  taskManager?: TaskManager,
  createTaskModel?: CreateTaskModel
): Promise<ToolResponse | CreateTaskResult> {
  if (!args.folderPath) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: folderPath"
    );
  }

  // Check if in stdio mode for folder path uploads
  if (!(transport instanceof StdioServerTransport)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Folder path uploads are only supported in stdio mode"
    );
  }

  // Check if folder exists
  const stats = await promisify(fs.stat)(args.folderPath);
  if (!stats.isDirectory()) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Path is not a directory: ${args.folderPath}`
    );
  }

  const postageBatchId = await getUploadPostageBatchId(
    args.postageBatchId,
    bee
  );

  const redundancyLevel = args.redundancyLevel;
  const options: CollectionUploadOptions = {};

  if (redundancyLevel) {
    options.redundancyLevel = redundancyLevel;
  }

  const deferred = true; // Folders are always deferred if possible/requested
  options.deferred = deferred;
  let message = "Folder successfully uploaded to Swarm";

  let tagId: string | undefined = undefined;
  if (deferred) {
    try {
      const tag = await bee.createTag();
      tagId = tag.uid.toString();
      options.tag = tag.uid;
      message =
        "Folder upload started in deferred mode. Use query_upload_progress to track progress.";
    } catch (error) {
      options.deferred = false;
    }
  }

  const isRunningAsTask = taskManager && createTaskModel;

  if (isRunningAsTask) {
    const task = await taskManager.createTask(
      createTaskModel,
      updateUploadFolderTaskStatus,
      null,
      {
        tagId: tagId ?? null,
      }
    );

    bee
      .uploadFilesFromDirectory(postageBatchId, args.folderPath, options)
      .then(async (result) => {
        const responseWithStructuredContent = getResponseWithStructuredContent({
          reference: result.reference.toString(),
          url: config.bee.endpoint + "/bzz/" + result.reference.toString(),
          message: "Folder upload complete.",
          tagId,
        });
        await taskManager.setTaskResult(
          task.taskId,
          responseWithStructuredContent,
          deferred
        );
      })
      .catch((error) => {
        let errorMessage = "Unable to upload folder.";
        if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
          errorMessage = getErrorMessage(error);
        }

        taskManager.updateTaskStatus(
          task.taskId,
          TaskState.FAILED,
          errorMessage
        );
      });

    return {
      task,
    };
  }

  let result;

  try {
    // Start the deferred upload
    result = await bee.uploadFilesFromDirectory(
      postageBatchId,
      args.folderPath,
      options
    );
  } catch (error) {
    if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
      throw new McpError(ErrorCode.InvalidRequest, getErrorMessage(error));
    } else {
      throw new McpError(ErrorCode.InvalidParams, "Unable to upload folder.");
    }
  }

  return getResponseWithStructuredContent({
    reference: result.reference.toString(),
    url: config.bee.endpoint + "/bzz/" + result.reference.toString(),
    message,
    tagId,
  });
}

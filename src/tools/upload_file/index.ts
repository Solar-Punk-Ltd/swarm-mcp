/**
 * MCP Tool: upload_file
 * Upload a file to Swarm
 */
import { CreateTaskResult } from "@modelcontextprotocol/sdk/types.js";
import { Bee, FileUploadOptions } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "fs/promises";
import path from "path";
import config from "../../config";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import { UploadFileArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";
import { updateUploadFileTaskStatus } from "./utils";
import { TaskManager } from "../../tasks/task-manager";
import { CreateTaskModel, TaskState } from "../../tasks/models";

export async function uploadFile(
  args: UploadFileArgs,
  bee: Bee,
  transport: any,
  taskManager?: TaskManager,
  createTaskModel?: CreateTaskModel
): Promise<ToolResponse | CreateTaskResult> {
  if (!args.data) {
    return getToolErrorResponse("Missing required parameter: data.22");
  }

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee
  );

  if (error !== null) {
    return getToolErrorResponse(error);
  } else if (postageBatchId === null) {
    return getToolErrorResponse("No postage batch id.");
  }

  let binaryData: Buffer;
  let name: string | undefined;

  if (args.isPath) {
    // Check if in stdio mode for file path uploads
    if (!(transport instanceof StdioServerTransport)) {
      return getToolErrorResponse(
        "File path uploads are only supported in stdio mode."
      );
    }

    // Read file from path
    try {
      binaryData = await readFile(args.data);
    } catch (fileError) {
      return getToolErrorResponse(`Unable to read file at path: ${args.data}.`);
    }
    name = path.basename(args.data);
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
    } catch (error) {
      /* empty */
    }
  }

  const isRunningAsTask = taskManager && createTaskModel;

  if (isRunningAsTask) {
    const task = await taskManager.createTask(
      createTaskModel,
      updateUploadFileTaskStatus,
      null,
      {
        tagId: tagId ?? null,
      }
    );

    bee
      .uploadFile(postageBatchId, binaryData, name, options)
      .then(async (result) => {
        const responseWithStructuredContent = getResponseWithStructuredContent({
          reference: result.reference.toString(),
          url: config.bee.endpoint + "/bzz/" + result.reference.toString(),
          message: "File upload complete.",
          tagId,
        });

        taskManager.addExtendedTaskMetadata(
          task.taskId,
          "reference",
          result.reference.toString()
        );

        await taskManager.setTaskResult(
          task.taskId,
          responseWithStructuredContent,
          deferred
        );
      })
      .catch((error) => {
        let errorMessage = "Unable to upload file.";
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
    result = await bee.uploadFile(postageBatchId, binaryData, name, options);
  } catch (error) {
    const errorMsg = errorHasStatus(error, BAD_REQUEST_STATUS)
      ? getErrorMessage(error)
      : "Unable to upload file.";

    return getToolErrorResponse(errorMsg);
  }

  return getResponseWithStructuredContent({
    reference: result.reference.toString(),
    url: config.bee.endpoint + "/bzz/" + result.reference.toString(),
    message,
    tagId,
  });
}

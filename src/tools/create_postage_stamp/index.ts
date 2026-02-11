/**
 * MCP Tool: create_postage_stamp
 * Buy postage stamp based on size and duration.
 */
import {
  McpError,
  ErrorCode,
  CreateTaskResult,
} from "@modelcontextprotocol/sdk/types.js";
import { BatchId, Bee, Duration, Size } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  makeDate,
  runWithTimeout,
  ToolResponse,
} from "../../utils";
import { CreatePostageStampArgs } from "./models";
import {
  BAD_REQUEST_STATUS,
  CALL_TIMEOUT,
  POSTAGE_CREATE_TIMEOUT_MESSAGE,
} from "../../constants";
import { TaskManager } from "../../tasks/task-manager";
import { CreateTaskModel, TaskState } from "../../tasks/models";

export async function createPostageStamp(
  args: CreatePostageStampArgs,
  bee: Bee,
  taskManager?: TaskManager,
  createTaskModel?: CreateTaskModel
): Promise<ToolResponse | CreateTaskResult> {
  const { size, duration, label } = args;

  if (!size) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: size."
    );
  } else if (!duration) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: duration."
    );
  }

  let durationMs;

  try {
    durationMs = makeDate(duration);
  } catch (makeDateError) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid parameter: duration");
  }

  const isRunningAsTask = taskManager && createTaskModel;
  if (isRunningAsTask) {
    const task = await taskManager.createTask(createTaskModel, null, null);

    bee
      .buyStorage(
        Size.fromMegabytes(size),
        Duration.fromMilliseconds(durationMs),
        {
          label,
        }
      )
      .then(async (result) => {
        const buyStorageResponse = result as BatchId;
        const postageBatchReference = buyStorageResponse.toHex();
        const responseWithStructuredContent = getResponseWithStructuredContent({
          postageBatchId: postageBatchReference,
          message: `Postage batch creation succeeded. You can request postage batch ${postageBatchReference} to find out details about it.`,
        });

        await taskManager!.setTaskResult(
          task.taskId,
          responseWithStructuredContent
        );
      })
      .catch((error) => {
        let errorMessage = "Unable to buy storage.";
        if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
          errorMessage = getErrorMessage(error);
        }

        taskManager!.updateTaskStatus(
          task.taskId,
          TaskState.FAILED,
          errorMessage
        );
      });

    return {
      task,
    };
  }

  let buyStorageResponse: BatchId;

  try {
    const buyStoragePromise = bee.buyStorage(
      Size.fromMegabytes(size),
      Duration.fromMilliseconds(durationMs),
      {
        label,
      }
    );
    const [response, hasTimedOut] = await runWithTimeout(
      buyStoragePromise,
      CALL_TIMEOUT
    );

    if (hasTimedOut) {
      return {
        content: [
          {
            type: "text",
            text: POSTAGE_CREATE_TIMEOUT_MESSAGE,
          },
        ],
      };
    }

    buyStorageResponse = response as BatchId;
  } catch (error) {
    if (errorHasStatus(error, BAD_REQUEST_STATUS)) {
      throw new McpError(ErrorCode.InvalidRequest, getErrorMessage(error));
    } else {
      throw new McpError(ErrorCode.InvalidParams, "Unable to buy storage.");
    }
  }

  return getResponseWithStructuredContent({
    postageBatchId: buyStorageResponse.toHex(),
    message: "Postage batch creation succeeded.",
  });
}

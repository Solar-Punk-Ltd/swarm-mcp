import { CreateTaskResult } from "@modelcontextprotocol/sdk/types.js";
import { Bee, CollectionUploadOptions } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { stat } from "fs/promises";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import { normalizeGranteeList, normalizeReferenceHex } from "../../utils/act";
import { UploadFolderArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

import { collectFilesRelative, updateUploadFolderTaskStatus } from "./utils";
import { TaskManager } from "../../tasks/task-manager";
import { CreateTaskModel, TaskState } from "../../tasks/models";
import config from "../../config";

function isActRequested(args: UploadFolderArgs): boolean {
  return (
    args.act === true ||
    (Array.isArray(args.grantees) && args.grantees.length > 0) ||
    typeof args.historyAddress === "string"
  );
}

export async function uploadFolder(
  args: UploadFolderArgs,
  bee: Bee,
  transport: any,
  taskManager?: TaskManager,
  createTaskModel?: CreateTaskModel
): Promise<ToolResponse | CreateTaskResult> {
  if (!args.folderPath) {
    return getToolErrorResponse("Missing required parameter: folderPath.");
  }

  if (
    args.redundancyLevel !== undefined &&
    (!Number.isInteger(args.redundancyLevel) ||
      args.redundancyLevel < 0 ||
      args.redundancyLevel > 4)
  ) {
    return getToolErrorResponse(
      "Invalid redundancyLevel. Must be an integer between 0 and 4 (0=OFF, 1=MEDIUM, 2=STRONG, 3=INSANE, 4=PARANOID)."
    );
  }

  // Check if in stdio mode for folder path uploads
  if (!(transport instanceof StdioServerTransport)) {
    return getToolErrorResponse(
      "Folder path uploads are only supported in stdio mode."
    );
  }

  // Check if folder exists
  const stats = await stat(args.folderPath);
  if (!stats.isDirectory()) {
    return getToolErrorResponse(`Path is not a directory: ${args.folderPath}.`);
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

  if (isActRequested(args)) {
    return uploadFolderAct(args, bee, postageBatchId);
  }

  const redundancyLevel = args.redundancyLevel;
  const options: CollectionUploadOptions = {};

  if (redundancyLevel) {
    options.redundancyLevel = redundancyLevel;
  }

  const deferred = true; // Folders are always deferred if possible/requested
  options.deferred = deferred;

  // Single-file collections return raw manifest bytes from the Bee node unless an
  // index document is set, so auto-detect and set it to avoid garbled downloads.
  const allFiles = await collectFilesRelative(args.folderPath);
  if (allFiles.length === 1) {
    options.indexDocument = allFiles[0];
  }

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
          message: "Folder upload complete.",
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

  // Fire-and-forget path when a tag was created (folders always request
  // deferred). Return immediately with the tagId so the MCP client doesn't
  // time out; progress + final reference are discoverable via
  // query_upload_progress.
  if (deferred && tagId) {
    bee
      .uploadFilesFromDirectory(postageBatchId, args.folderPath, options)
      .catch(() => {
        /* failure surfaces via query_upload_progress on the tag */
      });
    return getResponseWithStructuredContent({
      tagId,
      message:
        "Folder upload started in the background. Poll query_upload_progress with this tagId to check completion; the final reference is available on the tag once processed=true.",
    });
  }

  let result;

  try {
    result = await bee.uploadFilesFromDirectory(
      postageBatchId,
      args.folderPath,
      options
    );
  } catch (error) {
    const detail =
      errorHasStatus(error, BAD_REQUEST_STATUS) && getErrorMessage(error)
        ? getErrorMessage(error)
        : error instanceof Error
          ? error.message
          : String(error);
    return getToolErrorResponse(`Unable to upload folder: ${detail}`);
  }

  return getResponseWithStructuredContent({
    reference: result.reference.toString(),
    message,
    tagId,
  });
}

async function uploadFolderAct(
  args: UploadFolderArgs,
  bee: Bee,
  postageBatchId: string
): Promise<ToolResponse> {
  let grantees: string[];
  try {
    grantees = normalizeGranteeList(args.grantees);
  } catch (e) {
    return getToolErrorResponse(
      `Invalid grantee: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  let initialHistoryAddress: string | undefined;
  if (args.historyAddress) {
    try {
      initialHistoryAddress = normalizeReferenceHex(args.historyAddress);
    } catch (e) {
      return getToolErrorResponse(
        `Invalid historyAddress: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  let granteeListRef: string | null = null;
  let actHistoryAddress = initialHistoryAddress;

  if (grantees.length > 0) {
    try {
      const g = await bee.createGrantees(postageBatchId, grantees);
      granteeListRef = g.ref.toHex();
      actHistoryAddress = g.historyref.toHex();
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Unable to create grantees list.";
      return getToolErrorResponse(msg);
    }
  }

  const options: CollectionUploadOptions = { act: true };
  if (actHistoryAddress) options.actHistoryAddress = actHistoryAddress;
  if (args.redundancyLevel !== undefined) {
    options.redundancyLevel = args.redundancyLevel;
  }

  const allFiles = await collectFilesRelative(args.folderPath);
  if (allFiles.length === 1) {
    options.indexDocument = allFiles[0];
  }

  let uploadResult;
  try {
    uploadResult = await bee.uploadFilesFromDirectory(
      postageBatchId,
      args.folderPath,
      options
    );
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to upload folder.";
    return getToolErrorResponse(msg);
  }

  let uploadHistHex: string | undefined;
  uploadResult.historyAddress?.ifPresent((r) => {
    uploadHistHex = r.toHex();
  });
  const finalHistory = uploadHistHex ?? actHistoryAddress ?? null;

  return getResponseWithStructuredContent({
    reference: uploadResult.reference.toHex(),
    historyAddress: finalHistory,
    granteeListRef,
    url: config.bee.endpoint + "/bzz/" + uploadResult.reference.toHex(),
    grantees,
    message:
      grantees.length > 0
        ? "Folder uploaded with ACT and granted access to the provided public keys."
        : "Folder uploaded with ACT (publisher-only decryption -- no grantees attached).",
  });
}

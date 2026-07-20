/**
 * MCP Tool: upload_file
 * Upload a file to Swarm. If any ACT parameter is provided (act=true,
 * grantees, or historyAddress), runs the ACT upload flow (no deferred/task
 * support in the ACT path; grantee-list creation happens first when
 * grantees[] is non-empty).
 */
import { CreateTaskResult } from "@modelcontextprotocol/sdk/types.js";
import { Bee, FileUploadOptions } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile, stat } from "fs/promises";
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
import { normalizeGranteeList, normalizeReferenceHex } from "../../utils/act";
import { UploadFileArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";
import { updateUploadFileTaskStatus } from "./utils";
import { TaskManager } from "../../tasks/task-manager";
import { CreateTaskModel, TaskState } from "../../tasks/models";

function isActRequested(args: UploadFileArgs): boolean {
  return (
    args.act === true ||
    (Array.isArray(args.grantees) && args.grantees.length > 0) ||
    typeof args.historyAddress === "string"
  );
}

export async function uploadFile(
  args: UploadFileArgs,
  bee: Bee,
  transport: any,
  taskManager?: TaskManager,
  createTaskModel?: CreateTaskModel
): Promise<ToolResponse | CreateTaskResult> {
  if (!args.data) {
    return getToolErrorResponse("Missing required parameter: data.");
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

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee
  );

  if (error !== null) {
    return getToolErrorResponse(error);
  } else if (postageBatchId === null) {
    return getToolErrorResponse("No postage batch id.");
  }

  // Detect path + size WITHOUT reading the file yet. For huge files, reading
  // 100+ MB into memory before returning would blow past the MCP client's
  // request timeout on its own -- we need to know the size to decide whether
  // to defer, but not the bytes.
  let isPath = false;
  let sizeBytes = 0;
  try {
    const s = await stat(args.data);
    if (s.isFile()) {
      isPath = true;
      sizeBytes = s.size;
    }
  } catch {
    isPath = false;
  }

  if (isPath && !(transport instanceof StdioServerTransport)) {
    return getToolErrorResponse(
      "File path uploads are only supported in stdio mode."
    );
  }

  const name = isPath ? path.basename(args.data) : undefined;

  if (isActRequested(args)) {
    return uploadFileAct(
      args,
      bee,
      postageBatchId,
      Buffer.from(args.data),
      name
    );
  }

  const effectiveSize = isPath
    ? sizeBytes
    : Buffer.byteLength(args.data, "utf8");

  const redundancyLevel = args.redundancyLevel;
  const options: FileUploadOptions = {};

  const deferred =
    effectiveSize > config.bee.deferredUploadSizeThreshold * 1024 * 1024;
  options.deferred = deferred;
  options.redundancyLevel = redundancyLevel;

  let message = "File successfully uploaded to Swarm";
  let tagId: string | undefined = undefined;
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

  // Fire-and-forget path for deferred uploads: return immediately with the
  // tagId so the MCP client doesn't time out on large files. The file read
  // AND the upload both happen in the background; progress and the final
  // reference are discoverable via query_upload_progress.
  const isRunningAsTask = taskManager && createTaskModel;
  if (!isRunningAsTask && deferred && tagId) {
    (async () => {
      try {
        const bytes = isPath
          ? await readFile(args.data)
          : Buffer.from(args.data);
        await bee.uploadFile(postageBatchId, bytes, name, options);
      } catch {
        /* failure surfaces via query_upload_progress on the tag */
      }
    })();
    return getResponseWithStructuredContent({
      tagId,
      message:
        "Upload started in the background. Poll query_upload_progress with this tagId to check completion; the final reference is available on the tag once processed=true.",
    });
  }

  // Small-file / inline sync path: read now, upload now.
  let binaryData: Buffer;
  if (isPath) {
    try {
      binaryData = await readFile(args.data);
    } catch {
      return getToolErrorResponse(`Unable to read file at path: ${args.data}.`);
    }
  } else {
    binaryData = Buffer.from(args.data);
  }

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
    result = await bee.uploadFile(postageBatchId, binaryData, name, options);
  } catch (error) {
    const detail =
      errorHasStatus(error, BAD_REQUEST_STATUS) && getErrorMessage(error)
        ? getErrorMessage(error)
        : error instanceof Error
          ? error.message
          : String(error);
    return getToolErrorResponse(`Unable to upload file: ${detail}`);
  }

  return getResponseWithStructuredContent({
    reference: result.reference.toString(),
    url: config.bee.endpoint + "/bzz/" + result.reference.toString(),
    message,
    tagId,
  });
}

async function uploadFileAct(
  args: UploadFileArgs,
  bee: Bee,
  postageBatchId: string,
  binaryData: Buffer,
  name: string | undefined
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

  const options: FileUploadOptions = { act: true };
  if (actHistoryAddress) options.actHistoryAddress = actHistoryAddress;
  if (args.redundancyLevel !== undefined) {
    options.redundancyLevel = args.redundancyLevel;
  }

  let uploadResult;
  try {
    uploadResult = await bee.uploadFile(
      postageBatchId,
      binaryData,
      name,
      options
    );
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to upload file.";
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
    name,
    grantees,
    message:
      grantees.length > 0
        ? "File uploaded with ACT and granted access to the provided public keys."
        : "File uploaded with ACT (publisher-only decryption -- no grantees attached).",
  });
}

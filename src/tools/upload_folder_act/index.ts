/**
 * MCP Tool: upload_folder_act
 * Uploads a directory to Swarm with ACT enabled.
 */
import { Bee, CollectionUploadOptions } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { stat } from "fs/promises";
import config from "../../config";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import {
  normalizeGranteeList,
  normalizeReferenceHex,
} from "../../utils/act";
import { UploadFolderActArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function uploadFolderAct(
  args: UploadFolderActArgs,
  bee: Bee,
  transport: unknown,
): Promise<ToolResponse> {
  if (!args.folderPath) {
    return getToolErrorResponse("Missing required parameter: folderPath.");
  }

  if (!(transport instanceof StdioServerTransport)) {
    return getToolErrorResponse(
      "Folder path uploads are only supported in stdio mode.",
    );
  }

  const stats = await stat(args.folderPath);
  if (!stats.isDirectory()) {
    return getToolErrorResponse(`Path is not a directory: ${args.folderPath}.`);
  }

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee,
  );
  if (error !== null) return getToolErrorResponse(error);
  if (postageBatchId === null)
    return getToolErrorResponse("No postage batch id.");

  let grantees: string[];
  try {
    grantees = normalizeGranteeList(args.grantees);
  } catch (e) {
    return getToolErrorResponse(
      `Invalid grantee: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let historyAddress: string | undefined;
  if (args.historyAddress) {
    try {
      historyAddress = normalizeReferenceHex(args.historyAddress);
    } catch (e) {
      return getToolErrorResponse(
        `Invalid historyAddress: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const options: CollectionUploadOptions = { act: true };
  if (historyAddress) options.actHistoryAddress = historyAddress;
  if (args.redundancyLevel !== undefined) {
    options.redundancyLevel = args.redundancyLevel;
  }

  let uploadResult;
  try {
    uploadResult = await bee.uploadFilesFromDirectory(
      postageBatchId,
      args.folderPath,
      options,
    );
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to upload folder.";
    return getToolErrorResponse(msg);
  }

  let finalHistory = uploadResult.historyAddress?.toString() ?? historyAddress;

  if (grantees.length > 0) {
    if (!finalHistory) {
      return getToolErrorResponse(
        "Upload did not return a historyAddress; cannot patch grantees.",
      );
    }
    try {
      const patch = await bee.patchGrantees(
        postageBatchId,
        uploadResult.reference,
        finalHistory,
        { add: grantees },
      );
      finalHistory = patch.historyref.toString();
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Upload succeeded but granting access failed.";
      return getToolErrorResponse(msg);
    }
  }

  return getResponseWithStructuredContent({
    reference: uploadResult.reference.toString(),
    historyAddress: finalHistory ?? null,
    url: config.bee.endpoint + "/bzz/" + uploadResult.reference.toString(),
    grantees,
    message: "Folder successfully uploaded to Swarm with ACT enabled.",
  });
}

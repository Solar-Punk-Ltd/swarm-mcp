/**
 * MCP Tool: upload_folder_act
 *
 * Uploads a folder with ACT. createGrantees first when grantees are provided.
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
import { normalizeGranteeList, normalizeReferenceHex } from "../../utils/act";
import { UploadFolderActArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function uploadFolderAct(
  args: UploadFolderActArgs,
  bee: Bee,
  transport: unknown
): Promise<ToolResponse> {
  if (!args.folderPath) {
    return getToolErrorResponse("Missing required parameter: folderPath.");
  }

  if (!(transport instanceof StdioServerTransport)) {
    return getToolErrorResponse(
      "Folder path uploads are only supported in stdio mode."
    );
  }

  const stats = await stat(args.folderPath);
  if (!stats.isDirectory()) {
    return getToolErrorResponse(`Path is not a directory: ${args.folderPath}.`);
  }

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee
  );
  if (error !== null) return getToolErrorResponse(error);
  if (postageBatchId === null)
    return getToolErrorResponse("No postage batch id.");

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

/**
 * MCP Tool: upload_file_act
 * Uploads a single file to Swarm with ACT enabled.
 */
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
import {
  normalizeGranteeList,
  normalizeReferenceHex,
} from "../../utils/act";
import { UploadFileActArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function uploadFileAct(
  args: UploadFileActArgs,
  bee: Bee,
  transport: unknown,
): Promise<ToolResponse> {
  if (!args.data) {
    return getToolErrorResponse("Missing required parameter: data.");
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

  let binaryData: Buffer;
  let name: string | undefined;

  if (args.isPath) {
    if (!(transport instanceof StdioServerTransport)) {
      return getToolErrorResponse(
        "File path uploads are only supported in stdio mode.",
      );
    }
    try {
      binaryData = await readFile(args.data);
    } catch {
      return getToolErrorResponse(`Unable to read file at path: ${args.data}.`);
    }
    name = path.basename(args.data);
  } else {
    binaryData = Buffer.from(args.data, "base64");
  }

  const options: FileUploadOptions = { act: true };
  if (historyAddress) options.actHistoryAddress = historyAddress;
  if (args.redundancyLevel !== undefined) {
    options.redundancyLevel = args.redundancyLevel;
  }

  let uploadResult;
  try {
    uploadResult = await bee.uploadFile(postageBatchId, binaryData, name, options);
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to upload file.";
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
    name,
    grantees,
    message: "File successfully uploaded to Swarm with ACT enabled.",
  });
}

/**
 * MCP Tool: upload_file_act
 *
 * Uploads a single file with ACT. If grantees are provided, createGrantees is
 * called first (see upload_data_act for the rationale) and the returned
 * historyref is threaded into the upload.
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
import { normalizeGranteeList, normalizeReferenceHex } from "../../utils/act";
import { UploadFileActArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function uploadFileAct(
  args: UploadFileActArgs,
  bee: Bee,
  transport: unknown
): Promise<ToolResponse> {
  if (!args.data) {
    return getToolErrorResponse("Missing required parameter: data.");
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

  let binaryData: Buffer;
  let name: string | undefined;

  if (args.isPath) {
    if (!(transport instanceof StdioServerTransport)) {
      return getToolErrorResponse(
        "File path uploads are only supported in stdio mode."
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

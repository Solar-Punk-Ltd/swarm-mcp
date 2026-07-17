/**
 * MCP Tool: upload_data
 * Uploads text data to Swarm. If any ACT parameter is provided
 * (act=true, grantees, or historyAddress), runs the ACT upload flow:
 *   1. bee.createGrantees(stamp, grantees) -> { ref (grantee-list), historyref }
 *      (only when grantees[] is non-empty)
 *   2. bee.uploadData(stamp, data, { act: true, actHistoryAddress: historyref })
 *
 * Otherwise runs a plain upload.
 */
import { Bee, UploadOptions } from "@ethersphere/bee-js";
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
import { UploadDataArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

function isActRequested(args: UploadDataArgs): boolean {
  return (
    args.act === true ||
    (Array.isArray(args.grantees) && args.grantees.length > 0) ||
    typeof args.historyAddress === "string"
  );
}

export async function uploadData(
  args: UploadDataArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.data) {
    return getToolErrorResponse("Missing required parameter: data.");
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
    return uploadDataAct(args, bee, postageBatchId);
  }

  const binaryData = Buffer.from(args.data);

  const redundancyLevel = args.redundancyLevel;
  const options = redundancyLevel ? { redundancyLevel } : undefined;

  let result;

  try {
    result = await bee.uploadData(postageBatchId, binaryData, options);
  } catch (error) {
    const errorMsg = errorHasStatus(error, BAD_REQUEST_STATUS)
      ? getErrorMessage(error)
      : "Unable to upload data.";

    return getToolErrorResponse(errorMsg);
  }

  return getResponseWithStructuredContent({
    reference: result.reference.toString(),
    url: config.bee.endpoint + "/bytes/" + result.reference.toString(),
    message: "Data successfully uploaded to Swarm",
  });
}

async function uploadDataAct(
  args: UploadDataArgs,
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

  const options: UploadOptions = { act: true };
  if (actHistoryAddress) options.actHistoryAddress = actHistoryAddress;
  if (args.redundancyLevel !== undefined) {
    (options as UploadOptions & { redundancyLevel?: number }).redundancyLevel =
      args.redundancyLevel;
  }

  let uploadResult;
  try {
    uploadResult = await bee.uploadData(
      postageBatchId,
      Buffer.from(args.data),
      options
    );
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to upload data.";
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
    url: config.bee.endpoint + "/bytes/" + uploadResult.reference.toHex(),
    grantees,
    message:
      grantees.length > 0
        ? "Data uploaded with ACT and granted access to the provided public keys."
        : "Data uploaded with ACT (publisher-only decryption -- no grantees attached).",
  });
}

/**
 * MCP Tool: upload_data_act
 * Uploads text data to Swarm with ACT (Access Control Trie) enabled.
 * Returns a content reference plus a history address that grantees need
 * to decrypt.
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
import { UploadDataActArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function uploadDataAct(
  args: UploadDataActArgs,
  bee: Bee
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

  let historyAddress: string | undefined;
  if (args.historyAddress) {
    try {
      historyAddress = normalizeReferenceHex(args.historyAddress);
    } catch (e) {
      return getToolErrorResponse(
        `Invalid historyAddress: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  const options: UploadOptions = { act: true };
  if (historyAddress) options.actHistoryAddress = historyAddress;
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

  let finalHistory = uploadResult.historyAddress?.toString() ?? historyAddress;

  if (grantees.length > 0) {
    if (!finalHistory) {
      return getToolErrorResponse(
        "Upload did not return a historyAddress; cannot patch grantees."
      );
    }
    try {
      const patch = await bee.patchGrantees(
        postageBatchId,
        uploadResult.reference,
        finalHistory,
        { add: grantees }
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
    url: config.bee.endpoint + "/bytes/" + uploadResult.reference.toString(),
    grantees,
    message: "Data successfully uploaded to Swarm with ACT enabled.",
  });
}

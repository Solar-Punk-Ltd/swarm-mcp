/**
 * MCP Tool: upload_data_act
 *
 * Uploads text data with ACT enabled. If `grantees` are provided, the flow is:
 *   1. bee.createGrantees(stamp, grantees) -> { ref (grantee-list), historyref }
 *   2. bee.uploadData(stamp, data, { act: true, actHistoryAddress: historyref })
 *
 * (The reverse order -- upload then patch -- is broken in Bee 2.7.x: the PATCH
 * endpoint returns 500 when the reference wasn't created via POST /grantee.)
 *
 * If `grantees` is empty, a plain ACT upload is performed. Only the publisher
 * (node's own wallet) can decrypt. A grantee list can be attached later via
 * patch_grantees once granteeListRef exists -- but that requires starting from
 * a createGrantees call.
 *
 * `historyAddress` (if provided) is threaded into the upload to extend an
 * existing ACT history.
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

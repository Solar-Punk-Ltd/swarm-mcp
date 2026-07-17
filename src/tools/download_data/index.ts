/**
 * MCP Tool: download_data
 * Downloads immutable data from a Swarm content address hash. If ACT
 * parameters (actPublisher, actHistoryAddress) are provided, downloads
 * ACT-protected content -- both must be provided together, otherwise the
 * request is rejected.
 */
import { Bee, DownloadOptions } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { normalizePublicKeyHex, normalizeReferenceHex } from "../../utils/act";
import { DownloadDataArgs } from "./models";
import { BAD_REQUEST_STATUS, NOT_FOUND_STATUS } from "../../constants";

export async function downloadData(
  args: DownloadDataArgs,
  bee: Bee
): Promise<ToolResponse> {
  const { reference } = args;

  if (!reference) {
    return getToolErrorResponse("Missing required parameter: reference.");
  }

  const isRefNotSwarmHash = reference.length !== 64 && reference.length !== 66;

  if (isRefNotSwarmHash) {
    return getToolErrorResponse(
      "Invalid Swarm content address hash value for reference."
    );
  }

  const hasPublisher = typeof args.actPublisher === "string";
  const hasHistory = typeof args.actHistoryAddress === "string";
  if (hasPublisher !== hasHistory) {
    return getToolErrorResponse(
      "ACT download requires both actPublisher and actHistoryAddress."
    );
  }

  if (hasPublisher && hasHistory) {
    return downloadDataAct(args, bee);
  }

  const data = await bee.downloadData(reference);
  const textData = data.toUtf8();

  return getResponseWithStructuredContent({
    textData,
  });
}

async function downloadDataAct(
  args: DownloadDataArgs,
  bee: Bee
): Promise<ToolResponse> {
  let reference: string;
  let actPublisher: string;
  let actHistoryAddress: string;
  try {
    reference = normalizeReferenceHex(args.reference);
    actPublisher = normalizePublicKeyHex(args.actPublisher!);
    actHistoryAddress = normalizeReferenceHex(args.actHistoryAddress!);
  } catch (e) {
    return getToolErrorResponse(e instanceof Error ? e.message : String(e));
  }

  const options: DownloadOptions = {
    actPublisher,
    actHistoryAddress,
  };
  if (args.actTimestamp !== undefined) {
    options.actTimestamp = args.actTimestamp;
  }

  try {
    const data = await bee.downloadData(reference, options);
    return getResponseWithStructuredContent({ textData: data.toUtf8() });
  } catch (err) {
    if (errorHasStatus(err, NOT_FOUND_STATUS)) {
      return getToolErrorResponse(
        "Reference not found, or this node is not a grantee for the given history."
      );
    }
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to download data.";
    return getToolErrorResponse(msg);
  }
}

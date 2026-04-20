/**
 * MCP Tool: download_data_act
 * Downloads ACT-protected text data. Requires the publisher's public key and
 * history address; the local Bee node uses its own identity to derive the
 * decryption key via ECDH.
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
import { DownloadDataActArgs } from "./models";
import { BAD_REQUEST_STATUS, NOT_FOUND_STATUS } from "../../constants";

export async function downloadDataAct(
  args: DownloadDataActArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.reference) {
    return getToolErrorResponse("Missing required parameter: reference.");
  }
  if (!args.actPublisher) {
    return getToolErrorResponse("Missing required parameter: actPublisher.");
  }
  if (!args.actHistoryAddress) {
    return getToolErrorResponse(
      "Missing required parameter: actHistoryAddress."
    );
  }

  let reference: string;
  let actPublisher: string;
  let actHistoryAddress: string;
  try {
    reference = normalizeReferenceHex(args.reference);
    actPublisher = normalizePublicKeyHex(args.actPublisher);
    actHistoryAddress = normalizeReferenceHex(args.actHistoryAddress);
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

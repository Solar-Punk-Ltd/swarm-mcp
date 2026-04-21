/**
 * MCP Tool: create_grantees
 * Creates an initial grantee list from an array of public keys. Returns
 * { reference, historyAddress } that can be used when uploading content with
 * ACT (via `actHistoryAddress`) so grantees can decrypt.
 */
import { Bee } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import { normalizeGranteeList } from "../../utils/act";
import { CreateGranteesArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function createGrantees(
  args: CreateGranteesArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.grantees || args.grantees.length === 0) {
    return getToolErrorResponse(
      "Missing required parameter: grantees (non-empty array)."
    );
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

  try {
    const result = await bee.createGrantees(postageBatchId, grantees);
    return getResponseWithStructuredContent({
      reference: result.ref.toString(),
      historyAddress: result.historyref.toString(),
      grantees,
      message: "Grantees list created.",
    });
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to create grantees list.";
    return getToolErrorResponse(msg);
  }
}

/**
 * MCP Tool: patch_grantees
 * Adds or revokes grantee public keys on an existing content reference +
 * history pair. Returns a new historyAddress advancing the grantee list.
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
import {
  normalizeGranteeList,
  normalizeReferenceHex,
} from "../../utils/act";
import { PatchGranteesArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function patchGrantees(
  args: PatchGranteesArgs,
  bee: Bee,
): Promise<ToolResponse> {
  if (!args.reference) {
    return getToolErrorResponse("Missing required parameter: reference.");
  }
  if (!args.historyAddress) {
    return getToolErrorResponse(
      "Missing required parameter: historyAddress.",
    );
  }

  const add = args.add ?? [];
  const revoke = args.revoke ?? [];
  if (add.length === 0 && revoke.length === 0) {
    return getToolErrorResponse(
      "Provide at least one public key in `add` or `revoke`.",
    );
  }

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee,
  );
  if (error !== null) return getToolErrorResponse(error);
  if (postageBatchId === null)
    return getToolErrorResponse("No postage batch id.");

  let reference: string;
  let historyAddress: string;
  let addList: string[];
  let revokeList: string[];
  try {
    reference = normalizeReferenceHex(args.reference);
    historyAddress = normalizeReferenceHex(args.historyAddress);
    addList = normalizeGranteeList(add);
    revokeList = normalizeGranteeList(revoke);
  } catch (e) {
    return getToolErrorResponse(e instanceof Error ? e.message : String(e));
  }

  try {
    const result = await bee.patchGrantees(
      postageBatchId,
      reference,
      historyAddress,
      { add: addList, revoke: revokeList },
    );
    return getResponseWithStructuredContent({
      reference: result.ref.toString(),
      historyAddress: result.historyref.toString(),
      added: addList,
      revoked: revokeList,
      message: "Grantees list updated.",
    });
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to patch grantees.";
    return getToolErrorResponse(msg);
  }
}

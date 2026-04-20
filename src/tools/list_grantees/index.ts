/**
 * MCP Tool: list_grantees
 * Returns the current grantee public keys for a grantees-list reference.
 */
import { Bee } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { normalizeReferenceHex } from "../../utils/act";
import { ListGranteesArgs } from "./models";
import { BAD_REQUEST_STATUS, NOT_FOUND_STATUS } from "../../constants";

export async function listGrantees(
  args: ListGranteesArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.reference) {
    return getToolErrorResponse("Missing required parameter: reference.");
  }

  let reference: string;
  try {
    reference = normalizeReferenceHex(args.reference);
  } catch (e) {
    return getToolErrorResponse(e instanceof Error ? e.message : String(e));
  }

  try {
    const result = await bee.getGrantees(reference);
    const grantees = result.grantees.map((g) => g.toHex());
    return getResponseWithStructuredContent({
      reference,
      grantees,
      count: grantees.length,
    });
  } catch (err) {
    if (errorHasStatus(err, NOT_FOUND_STATUS)) {
      return getToolErrorResponse("No grantees list found at that reference.");
    }
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to list grantees.";
    return getToolErrorResponse(msg);
  }
}

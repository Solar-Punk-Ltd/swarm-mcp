/**
 * MCP Tool: patch_feed_access
 * Adds or revokes a grantee public key on the latest feed entry and advances
 * the feed. mode="add" grants; mode="revoke" removes.
 *
 * Note: Swarm ACT revocation is forward-only -- anyone who already has an
 * earlier historyAddress + the content reference can keep decrypting. True
 * revocation requires re-encrypting (new upload).
 */
import { Bee } from "@ethersphere/bee-js";
import { getResponseWithStructuredContent, ToolResponse } from "../../utils";
import { PatchFeedAccessArgs } from "./models";
import { patchFeedAcl } from "./shared";

export async function patchFeedAccess(
  args: PatchFeedAccessArgs,
  bee: Bee
): Promise<ToolResponse> {
  const outcome = await patchFeedAcl(args, bee);
  if (!outcome.ok) return outcome.error;

  const message =
    args.mode === "add"
      ? "Grantee added to the latest feed entry. Consumer can now decrypt via fetch_from_feed_with_act."
      : "Grantee revoked from the latest feed entry. Note: old historyAddress values still decrypt -- revocation is forward-only.";

  return getResponseWithStructuredContent({
    ...outcome.result,
    message,
  });
}

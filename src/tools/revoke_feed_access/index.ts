/**
 * MCP Tool: revoke_feed_access
 * Revokes a grantee public key from the latest feed entry and advances the
 * feed.
 *
 * Note: Swarm ACT revocation is forward-only — anyone who already has an
 * earlier historyAddress + the content reference can keep decrypting. True
 * revocation requires re-encrypting (new upload).
 */
import { Bee } from "@ethersphere/bee-js";
import {
  getResponseWithStructuredContent,
  ToolResponse,
} from "../../utils";
import { RevokeFeedAccessArgs } from "./models";
import { patchFeedAcl } from "../grant_feed_access/shared";

export async function revokeFeedAccess(
  args: RevokeFeedAccessArgs,
  bee: Bee,
): Promise<ToolResponse> {
  const outcome = await patchFeedAcl({ ...args, mode: "revoke" }, bee);
  if (!outcome.ok) return outcome.error;
  return getResponseWithStructuredContent({
    ...outcome.result,
    message:
      "Grantee revoked from the latest feed entry. Note: old historyAddress values still decrypt — revocation is forward-only.",
  });
}

/**
 * MCP Tool: grant_feed_access
 * Adds a grantee public key to the grantee list of the latest feed entry and
 * advances the feed.
 */
import { Bee } from "@ethersphere/bee-js";
import { getResponseWithStructuredContent, ToolResponse } from "../../utils";
import { GrantFeedAccessArgs } from "./models";
import { patchFeedAcl } from "./shared";

export async function grantFeedAccess(
  args: GrantFeedAccessArgs,
  bee: Bee
): Promise<ToolResponse> {
  const outcome = await patchFeedAcl({ ...args, mode: "add" }, bee);
  if (!outcome.ok) return outcome.error;
  const message =
    outcome.kind === "marketplace-v1"
      ? `Grantee added to all ${outcome.result.itemsPatched} item(s) in the marketplace feed. Consumer can now decrypt via fetch_marketplace_feed + download_data_act.`
      : "Grantee added to the latest feed entry. Consumer can now decrypt via fetch_from_feed_with_act.";
  return getResponseWithStructuredContent({
    kind: outcome.kind,
    ...outcome.result,
    message,
  });
}

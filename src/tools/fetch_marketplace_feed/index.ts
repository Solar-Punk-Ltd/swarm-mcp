/**
 * MCP Tool: fetch_marketplace_feed
 *
 * Reads the latest feed entry and STRICT-parses it as a marketplace-v1
 * payload. Returns the full `dataItems[]` catalog so the caller can browse
 * and pick items to purchase / download. Does NOT auto-download anything --
 * the consumer uses `swarmHash` + `actHistoryRef` + publisherPubKey with
 * download_data_act after they've been granted access.
 *
 * Strict: throws on unknown fields and on schemeVersion !== "v1".
 */
import { Bee, PublicKey } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { normalizePublicKeyHex } from "../../utils/act";
import {
  decodeMarketplaceFeedPayload,
  normalizeFeedTopic,
} from "../../utils/feed";
import { FetchMarketplaceFeedArgs } from "./models";
import { NOT_FOUND_STATUS } from "../../constants";

export async function fetchMarketplaceFeed(
  args: FetchMarketplaceFeedArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.feedTopic) {
    return getToolErrorResponse("Missing required parameter: feedTopic.");
  }
  if (!args.publisherPubKey) {
    return getToolErrorResponse("Missing required parameter: publisherPubKey.");
  }

  let publisherPubKey: string;
  try {
    publisherPubKey = normalizePublicKeyHex(args.publisherPubKey);
  } catch (e) {
    return getToolErrorResponse(
      `Invalid publisherPubKey: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  let feedOwner = args.feedOwner;
  if (!feedOwner) {
    try {
      feedOwner = new PublicKey(publisherPubKey)
        .address()
        .toChecksum()
        .slice(2);
    } catch (e) {
      return getToolErrorResponse(
        `Unable to derive feed owner from publisherPubKey: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  } else {
    if (feedOwner.startsWith("0x")) feedOwner = feedOwner.slice(2);
    if (feedOwner.length !== 40) {
      return getToolErrorResponse("feedOwner must be a 20-byte eth address.");
    }
  }

  const topic = normalizeFeedTopic(args.feedTopic);

  let raw: Uint8Array;
  try {
    const feedReader = bee.makeFeedReader(topic.topicBytes, feedOwner);
    const latest = await feedReader.downloadPayload();
    raw = latest.payload.toUint8Array();
  } catch (err) {
    if (errorHasStatus(err, NOT_FOUND_STATUS)) {
      return getToolErrorResponse(
        "Feed entry not found. Check the topic and publisherPubKey are correct."
      );
    }
    return getToolErrorResponse(
      `Unable to read feed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let parsed;
  try {
    parsed = decodeMarketplaceFeedPayload(raw);
  } catch (e) {
    return getToolErrorResponse(
      `Feed payload is not a valid marketplace-v1: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  return getResponseWithStructuredContent({
    feedTopic: args.feedTopic,
    feedTopicHex: topic.topicHex,
    feedOwner,
    publisherPubKey,
    schemeVersion: parsed.schemeVersion,
    dataItems: parsed.dataItems,
    itemCount: parsed.dataItems.length,
  });
}

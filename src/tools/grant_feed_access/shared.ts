/**
 * Shared helper for grant_feed_access and revoke_feed_access.
 *
 * Reads the latest entry from the publisher's feed, dispatches on payload
 * shape:
 *   - { r, g, h }  (publish_to_feed_with_act default)
 *       → patch grantees on `g`, write back { r, g: newG, h: newH }
 *   - { schemeVersion: "v1", dataItems[...] }  (publish_marketplace_feed)
 *       → patch grantees on EVERY item's granteeRef, write back the same
 *         shape with updated granteeRef/actHistoryRef per item.
 *   - anything else → error (user must use patch_grantees directly)
 *
 * bee.patchGrantees must receive the grantee-LIST reference (the 128-hex
 * encrypted ref returned by createGrantees.ref), not the content reference.
 * The feed payload carries this as `g` or `granteeRef` respectively.
 */
import { Bee } from "@ethersphere/bee-js";
import config from "../../config";
import {
  errorHasStatus,
  getErrorMessage,
  getToolErrorResponse,
  hexToBytes,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import { normalizePublicKeyHex } from "../../utils/act";
import {
  detectFeedPayload,
  encodeFeedActPayload,
  encodeMarketplaceFeedPayload,
  feedOwnerFromPrivateKey,
  MARKETPLACE_SCHEME_VERSION,
  MarketplaceDataItem,
  normalizeFeedTopic,
} from "../../utils/feed";
import { BAD_REQUEST_STATUS } from "../../constants";

export interface PatchFeedAclArgs {
  feedTopic: string;
  granteePubKey: string;
  postageBatchId?: string;
  mode: "add" | "revoke";
}

export type PatchFeedAclSuccess =
  | {
      ok: true;
      kind: "r-g-h";
      result: {
        feedTopic: string;
        feedTopicHex: string;
        feedOwner: string;
        feedUrl: string;
        feedReference: string;
        reference: string;
        granteeListRef: string;
        historyAddress: string;
        mode: "add" | "revoke";
        granteePubKey: string;
      };
    }
  | {
      ok: true;
      kind: "marketplace-v1";
      result: {
        feedTopic: string;
        feedTopicHex: string;
        feedOwner: string;
        feedUrl: string;
        feedReference: string;
        schemeVersion: "v1";
        itemsPatched: number;
        dataItems: MarketplaceDataItem[];
        mode: "add" | "revoke";
        granteePubKey: string;
      };
    };

export async function patchFeedAcl(
  args: PatchFeedAclArgs,
  bee: Bee
): Promise<PatchFeedAclSuccess | { ok: false; error: ToolResponse }> {
  if (!args.feedTopic) {
    return {
      ok: false,
      error: getToolErrorResponse("Missing required parameter: feedTopic."),
    };
  }
  if (!args.granteePubKey) {
    return {
      ok: false,
      error: getToolErrorResponse("Missing required parameter: granteePubKey."),
    };
  }
  if (!config.bee.feedPrivateKey) {
    return {
      ok: false,
      error: getToolErrorResponse(
        "Feed private key not configured. Set BEE_FEED_PK."
      ),
    };
  }

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee
  );
  if (error !== null) return { ok: false, error: getToolErrorResponse(error) };
  if (postageBatchId === null) {
    return {
      ok: false,
      error: getToolErrorResponse("No postage batch id."),
    };
  }

  let granteePubKey: string;
  try {
    granteePubKey = normalizePublicKeyHex(args.granteePubKey);
  } catch (e) {
    return {
      ok: false,
      error: getToolErrorResponse(
        `Invalid granteePubKey: ${e instanceof Error ? e.message : String(e)}`
      ),
    };
  }

  const topic = normalizeFeedTopic(args.feedTopic);
  const feedPrivateKey = hexToBytes(
    config.bee.feedPrivateKey.startsWith("0x")
      ? config.bee.feedPrivateKey.slice(2)
      : config.bee.feedPrivateKey
  );
  const owner = feedOwnerFromPrivateKey(config.bee.feedPrivateKey);

  let detected;
  try {
    const feedReader = bee.makeFeedReader(topic.topicBytes, owner);
    const latest = await feedReader.downloadPayload();
    detected = detectFeedPayload(latest.payload.toUint8Array());
  } catch (err) {
    return {
      ok: false,
      error: getToolErrorResponse(
        `Unable to read the latest feed entry: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }

  const feedWriter = bee.makeFeedWriter(topic.topicBytes, feedPrivateKey);
  const feedUrl = `${config.bee.endpoint}/feeds/${owner}/${topic.topicHex}`;

  if (detected.kind === "r-g-h") {
    const latestPayload = detected.payload;
    if (!latestPayload.g) {
      return {
        ok: false,
        error: getToolErrorResponse(
          "Latest feed entry has no grantee-list reference (g). This feed was probably published without grantees -- cannot patch."
        ),
      };
    }
    let newGranteeRef: string;
    let newHistory: string;
    try {
      const patch = await bee.patchGrantees(
        postageBatchId,
        latestPayload.g,
        latestPayload.h,
        args.mode === "add"
          ? { add: [granteePubKey] }
          : { revoke: [granteePubKey] }
      );
      newGranteeRef = patch.ref.toHex();
      newHistory = patch.historyref.toHex();
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : `Unable to ${args.mode} grantee.`;
      return { ok: false, error: getToolErrorResponse(msg) };
    }

    let feedWriteResult;
    try {
      const payload = encodeFeedActPayload({
        r: latestPayload.r,
        g: newGranteeRef,
        h: newHistory,
      });
      feedWriteResult = await feedWriter.uploadPayload(postageBatchId, payload);
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Grantee patched but feed update failed.";
      return { ok: false, error: getToolErrorResponse(msg) };
    }

    return {
      ok: true,
      kind: "r-g-h",
      result: {
        feedTopic: args.feedTopic,
        feedTopicHex: topic.topicHex,
        feedOwner: owner,
        feedUrl,
        feedReference: feedWriteResult.reference.toHex(),
        reference: latestPayload.r,
        granteeListRef: newGranteeRef,
        historyAddress: newHistory,
        mode: args.mode,
        granteePubKey,
      },
    };
  }

  if (detected.kind === "marketplace-v1") {
    const priorItems = detected.payload.dataItems;
    if (priorItems.length === 0) {
      return {
        ok: false,
        error: getToolErrorResponse(
          "Marketplace feed has no items -- nothing to patch."
        ),
      };
    }

    const updated: MarketplaceDataItem[] = [];
    for (let i = 0; i < priorItems.length; i += 1) {
      const item = priorItems[i];
      if (!item.granteeRef) {
        return {
          ok: false,
          error: getToolErrorResponse(
            `dataItems[${i}] has empty granteeRef -- cannot patch. Publisher must first attach a grantee list via publish_marketplace_feed or patch_grantees.`
          ),
        };
      }
      try {
        const patch = await bee.patchGrantees(
          postageBatchId,
          item.granteeRef,
          item.actHistoryRef,
          args.mode === "add"
            ? { add: [granteePubKey] }
            : { revoke: [granteePubKey] }
        );
        updated.push({
          ...item,
          granteeRef: patch.ref.toHex(),
          actHistoryRef: patch.historyref.toHex(),
        });
      } catch (err) {
        const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
          ? getErrorMessage(err)
          : `Unable to ${args.mode} grantee on dataItems[${i}].`;
        return { ok: false, error: getToolErrorResponse(msg) };
      }
    }

    let feedWriteResult;
    try {
      const payload = encodeMarketplaceFeedPayload({
        schemeVersion: MARKETPLACE_SCHEME_VERSION,
        dataItems: updated,
      });
      feedWriteResult = await feedWriter.uploadPayload(postageBatchId, payload);
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Grantees patched but feed update failed.";
      return { ok: false, error: getToolErrorResponse(msg) };
    }

    return {
      ok: true,
      kind: "marketplace-v1",
      result: {
        feedTopic: args.feedTopic,
        feedTopicHex: topic.topicHex,
        feedOwner: owner,
        feedUrl,
        feedReference: feedWriteResult.reference.toHex(),
        schemeVersion: MARKETPLACE_SCHEME_VERSION,
        itemsPatched: updated.length,
        dataItems: updated,
        mode: args.mode,
        granteePubKey,
      },
    };
  }

  return {
    ok: false,
    error: getToolErrorResponse(
      "Latest feed entry is neither { r, g, h } nor marketplace-v1. Use patch_grantees directly with the grantee-list reference you know out-of-band."
    ),
  };
}

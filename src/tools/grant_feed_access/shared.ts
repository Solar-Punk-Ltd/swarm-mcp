/**
 * Shared helper for grant_feed_access and revoke_feed_access.
 *
 * Reads the latest entry from the publisher's feed, decodes { r, g, h },
 * patches grantees on the grantee-list reference (g) with the current history
 * (h), then writes a new feed entry pointing to the same content reference
 * with the advanced grantee-list ref and history.
 *
 * Important: bee.patchGrantees must receive the grantee-list reference (the
 * 128-hex encrypted ref returned by createGrantees.ref), not the content
 * reference. Passing the content ref yields a server-side 500 on Bee 2.7.x.
 * That is why the feed payload carries `g` alongside `r` and `h`.
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
  decodeFeedActPayload,
  encodeFeedActPayload,
  feedOwnerFromPrivateKey,
  normalizeFeedTopic,
} from "../../utils/feed";
import { BAD_REQUEST_STATUS } from "../../constants";

export interface PatchFeedAclArgs {
  feedTopic: string;
  granteePubKey: string;
  postageBatchId?: string;
  mode: "add" | "revoke";
}

export interface PatchFeedAclSuccess {
  ok: true;
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

  let latestPayload;
  try {
    const feedReader = bee.makeFeedReader(topic.topicBytes, owner);
    const latest = await feedReader.downloadPayload();
    latestPayload = decodeFeedActPayload(latest.payload.toUint8Array());
  } catch (err) {
    return {
      ok: false,
      error: getToolErrorResponse(
        `Unable to read the latest feed entry: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }

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
    const feedWriter = bee.makeFeedWriter(topic.topicBytes, feedPrivateKey);
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
    result: {
      feedTopic: args.feedTopic,
      feedTopicHex: topic.topicHex,
      feedOwner: owner,
      feedUrl: `${config.bee.endpoint}/feeds/${owner}/${topic.topicHex}`,
      feedReference: feedWriteResult.reference.toHex(),
      reference: latestPayload.r,
      granteeListRef: newGranteeRef,
      historyAddress: newHistory,
      mode: args.mode,
      granteePubKey,
    },
  };
}

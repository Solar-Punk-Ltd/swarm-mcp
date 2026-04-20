/**
 * Shared helper for grant_feed_access and revoke_feed_access.
 *
 * Reads the latest entry from the publisher's feed, patches grantees on the
 * referenced (r, h) pair, then writes a new feed entry pointing to the same
 * content reference with the advanced history address.
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

  let newHistory: string;
  try {
    const patch = await bee.patchGrantees(
      postageBatchId,
      latestPayload.r,
      latestPayload.h,
      args.mode === "add"
        ? { add: [granteePubKey] }
        : { revoke: [granteePubKey] }
    );
    newHistory = patch.historyref.toString();
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
      feedReference: feedWriteResult.reference.toString(),
      reference: latestPayload.r,
      historyAddress: newHistory,
      mode: args.mode,
      granteePubKey,
    },
  };
}

/**
 * MCP Tool: publish_to_feed_with_act
 *
 * Opinionated provider flow: upload content to Swarm with ACT enabled and
 * publish its { r, g, h } JSON to a feed entry identified by a plain-text
 * topic. Consumers look up the feed by (topic, publisherPubKey), read the
 * payload, and decrypt via ACT using the publisher pubkey + h.
 *
 * Flow when grantees are provided (required for the wizard -- without them
 * there's no grantee-list ref to patch later via grant_feed_access):
 *   1. bee.createGrantees(stamp, grantees) -> { granteeListRef, historyref }
 *   2. bee.uploadFile/uploadData(..., { act: true, actHistoryAddress: historyref })
 *   3. bee.makeFeedWriter(...).uploadPayload(JSON { r, g, h })
 *
 * Feed payload shape:
 *   r: content reference (64 hex)
 *   g: grantee-list reference (128 hex)  <-- carries the ref needed for PATCH
 *   h: history address (64 hex)
 */
import { Bee, UploadOptions, UploadResult } from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "fs/promises";
import path from "path";
import config from "../../config";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  hexToBytes,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import { normalizeGranteeList } from "../../utils/act";
import {
  encodeFeedActPayload,
  feedOwnerFromPrivateKey,
  normalizeFeedTopic,
} from "../../utils/feed";
import { PublishToFeedWithActArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function publishToFeedWithAct(
  args: PublishToFeedWithActArgs,
  bee: Bee,
  transport: unknown
): Promise<ToolResponse> {
  if (!args.feedTopic) {
    return getToolErrorResponse("Missing required parameter: feedTopic.");
  }
  if (!args.data && !args.filePath) {
    return getToolErrorResponse(
      "Provide either `data` (text) or `filePath` (path to a file)."
    );
  }
  if (!config.bee.feedPrivateKey) {
    return getToolErrorResponse(
      "Feed private key not configured. Set BEE_FEED_PK (must equal the Bee node's wallet key so feed owner and ACT publisher are the same identity)."
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
  if (grantees.length === 0) {
    return getToolErrorResponse(
      "publish_to_feed_with_act requires at least one grantee public key. Without one there is no grantee-list to patch later via grant_feed_access. Use upload_data_act + update_feed if you just want a publisher-only upload."
    );
  }

  let binaryData: Buffer;
  let fileName: string | undefined;
  if (args.filePath) {
    if (!(transport instanceof StdioServerTransport)) {
      return getToolErrorResponse(
        "File path uploads are only supported in stdio mode."
      );
    }
    try {
      binaryData = await readFile(args.filePath);
    } catch {
      return getToolErrorResponse(
        `Unable to read file at path: ${args.filePath}.`
      );
    }
    fileName = path.basename(args.filePath);
  } else {
    binaryData = Buffer.from(args.data as string);
  }

  let granteeListRef: string;
  let historyAddress: string;
  try {
    const g = await bee.createGrantees(postageBatchId, grantees);
    granteeListRef = g.ref.toHex();
    historyAddress = g.historyref.toHex();
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to create grantees list.";
    return getToolErrorResponse(msg);
  }

  const uploadOptions: UploadOptions = {
    act: true,
    actHistoryAddress: historyAddress,
  };
  if (args.redundancyLevel !== undefined) {
    (
      uploadOptions as UploadOptions & { redundancyLevel?: number }
    ).redundancyLevel = args.redundancyLevel;
  }

  let uploadResult: UploadResult;
  try {
    if (fileName) {
      uploadResult = await bee.uploadFile(
        postageBatchId,
        binaryData,
        fileName,
        uploadOptions
      );
    } else {
      uploadResult = await bee.uploadData(
        postageBatchId,
        binaryData,
        uploadOptions
      );
    }
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to upload content with ACT.";
    return getToolErrorResponse(msg);
  }

  let uploadHistHex: string | undefined;
  uploadResult.historyAddress?.ifPresent((r) => {
    uploadHistHex = r.toHex();
  });
  const finalHistory = uploadHistHex ?? historyAddress;

  const topic = normalizeFeedTopic(args.feedTopic);
  const feedPrivateKey = hexToBytes(
    config.bee.feedPrivateKey.startsWith("0x")
      ? config.bee.feedPrivateKey.slice(2)
      : config.bee.feedPrivateKey
  );
  const owner = feedOwnerFromPrivateKey(config.bee.feedPrivateKey);
  const payload = encodeFeedActPayload({
    r: uploadResult.reference.toHex(),
    g: granteeListRef,
    h: finalHistory,
  });

  let feedWriteResult;
  try {
    const feedWriter = bee.makeFeedWriter(topic.topicBytes, feedPrivateKey);
    feedWriteResult = await feedWriter.uploadPayload(postageBatchId, payload);
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Content uploaded but feed update failed.";
    return getToolErrorResponse(msg);
  }

  return getResponseWithStructuredContent({
    feedTopic: args.feedTopic,
    feedTopicHex: topic.topicHex,
    feedOwner: owner,
    feedUrl: `${config.bee.endpoint}/feeds/${owner}/${topic.topicHex}`,
    feedReference: feedWriteResult.reference.toHex(),
    reference: uploadResult.reference.toHex(),
    historyAddress: finalHistory,
    granteeListRef,
    grantees,
    fileName: fileName ?? null,
    message:
      "Content uploaded with ACT, granted access to the provided public keys, and published to feed.",
  });
}

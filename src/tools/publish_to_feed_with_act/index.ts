/**
 * MCP Tool: publish_to_feed_with_act
 *
 * Opinionated provider flow: upload content to Swarm with ACT enabled (+
 * optional grantees at publish time), then write a new entry on a feed
 * (identified by a plain-text topic) whose payload is the JSON
 *   { "r": <contentReference>, "h": <historyAddress> }
 * Consumers discover the feed by topic + publisher public key, fetch the
 * latest entry, and decrypt via ACT.
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
  transport: unknown,
): Promise<ToolResponse> {
  if (!args.feedTopic) {
    return getToolErrorResponse("Missing required parameter: feedTopic.");
  }
  if (!args.data && !args.filePath) {
    return getToolErrorResponse(
      "Provide either `data` (text) or `filePath` (path to a file).",
    );
  }
  if (!config.bee.feedPrivateKey) {
    return getToolErrorResponse(
      "Feed private key not configured. Set BEE_FEED_PK environment variable (must match the Bee node's wallet so feed owner and ACT publisher are the same identity).",
    );
  }

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee,
  );
  if (error !== null) return getToolErrorResponse(error);
  if (postageBatchId === null)
    return getToolErrorResponse("No postage batch id.");

  let grantees: string[];
  try {
    grantees = normalizeGranteeList(args.grantees);
  } catch (e) {
    return getToolErrorResponse(
      `Invalid grantee: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let binaryData: Buffer;
  let fileName: string | undefined;
  if (args.filePath) {
    if (!(transport instanceof StdioServerTransport)) {
      return getToolErrorResponse(
        "File path uploads are only supported in stdio mode.",
      );
    }
    try {
      binaryData = await readFile(args.filePath);
    } catch {
      return getToolErrorResponse(
        `Unable to read file at path: ${args.filePath}.`,
      );
    }
    fileName = path.basename(args.filePath);
  } else {
    binaryData = args.isPath
      ? Buffer.alloc(0)
      : Buffer.from(args.data as string);
  }

  const uploadOptions: UploadOptions = { act: true };
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
        uploadOptions,
      );
    } else {
      uploadResult = await bee.uploadData(
        postageBatchId,
        binaryData,
        uploadOptions,
      );
    }
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to upload content with ACT.";
    return getToolErrorResponse(msg);
  }

  let historyAddress = uploadResult.historyAddress?.toString();
  if (!historyAddress) {
    return getToolErrorResponse(
      "ACT upload did not return a historyAddress; cannot publish to feed.",
    );
  }

  if (grantees.length > 0) {
    try {
      const patch = await bee.patchGrantees(
        postageBatchId,
        uploadResult.reference,
        historyAddress,
        { add: grantees },
      );
      historyAddress = patch.historyref.toString();
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Upload succeeded but granting access failed.";
      return getToolErrorResponse(msg);
    }
  }

  const topic = normalizeFeedTopic(args.feedTopic);

  const feedPrivateKey = hexToBytes(
    config.bee.feedPrivateKey.startsWith("0x")
      ? config.bee.feedPrivateKey.slice(2)
      : config.bee.feedPrivateKey,
  );
  const owner = feedOwnerFromPrivateKey(config.bee.feedPrivateKey);
  const payload = encodeFeedActPayload({
    r: uploadResult.reference.toString(),
    h: historyAddress,
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
    feedReference: feedWriteResult.reference.toString(),
    reference: uploadResult.reference.toString(),
    historyAddress,
    grantees,
    fileName: fileName ?? null,
    message:
      grantees.length > 0
        ? "Content uploaded with ACT + granted access to the provided public keys + published to feed."
        : "Content uploaded with ACT + published to feed (no grantees yet — use grant_feed_access to share).",
  });
}

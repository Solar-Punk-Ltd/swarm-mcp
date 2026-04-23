/**
 * MCP Tool: publish_marketplace_feed
 *
 * Publishes ONE data item to a marketplace-v1 feed. When append=true (default)
 * the tool reads the latest feed entry, decodes the prior marketplace payload,
 * appends the new item to its `dataItems`, and writes the merged payload.
 * When append=false the new entry replaces the feed with a single-item
 * dataItems array.
 *
 * Each item follows the v1 schema:
 *   { swarmHash, actHistoryRef, granteeRef, displayName, metadata, tags }
 *
 * x402 context: consumers read this feed as a catalog, pick an item, and
 * initiate an x402 payment against the publisher's x402 server. On settlement
 * the server calls patchGrantees(granteeRef, ...) to add the buyer and serves
 * back the actHistoryRef so the buyer can download_data_act.
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
import { normalizeGranteeList, normalizePublicKeyHex } from "../../utils/act";
import {
  decodeMarketplaceFeedPayload,
  encodeMarketplaceFeedPayload,
  feedOwnerFromPrivateKey,
  MARKETPLACE_SCHEME_VERSION,
  MarketplaceDataItem,
  normalizeFeedTopic,
} from "../../utils/feed";
import { PublishMarketplaceFeedArgs } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

export async function publishMarketplaceFeed(
  args: PublishMarketplaceFeedArgs,
  bee: Bee,
  transport: unknown
): Promise<ToolResponse> {
  const feedTopic = args.feedTopic ?? config.bee.metadataFeedTopic;
  if (!feedTopic) {
    return getToolErrorResponse(
      "Missing feedTopic: pass it explicitly or set METADATA_FEED_TOPIC in the environment."
    );
  }
  if (!args.displayName) {
    return getToolErrorResponse("Missing required parameter: displayName.");
  }
  if (
    args.agentId === undefined ||
    args.agentId === null ||
    !Number.isFinite(args.agentId) ||
    !Number.isInteger(args.agentId)
  ) {
    return getToolErrorResponse(
      "Missing required parameter: agentId (must be an integer)."
    );
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

  const append = args.append ?? true;
  const metadata = args.metadata ?? [];
  const tags = args.tags ?? [];

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

  // Resolve publisher public key: honour an explicit arg, otherwise derive
  // from the local Bee node (which is also the ACT publisher identity).
  let publisherPublicKey: string;
  let nodePublicKey: string | null = null;
  if (args.publisherPublicKey) {
    try {
      publisherPublicKey = normalizePublicKeyHex(args.publisherPublicKey);
    } catch (e) {
      return getToolErrorResponse(
        `Invalid publisherPublicKey: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  } else {
    try {
      const addresses = await bee.getNodeAddresses();
      nodePublicKey = addresses.publicKey.toCompressedHex();
      publisherPublicKey = nodePublicKey;
    } catch (err) {
      return getToolErrorResponse(
        `publisherPublicKey not provided and derivation from node failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Auto-seed: Bee requires a non-empty grantees list at createGrantees time,
  // and only refs produced by createGrantees are patchable by patchGrantees
  // later (Bee 2.7.x behavior). If the caller omitted grantees, seed the list
  // with the publisher's own pubkey so buyers can be added via x402 later.
  let autoSeededGrantee: string | null = null;
  if (grantees.length === 0) {
    try {
      if (nodePublicKey === null) {
        const addresses = await bee.getNodeAddresses();
        nodePublicKey = addresses.publicKey.toCompressedHex();
      }
      autoSeededGrantee = nodePublicKey;
      grantees = [autoSeededGrantee];
    } catch (err) {
      return getToolErrorResponse(
        `grantees was empty and auto-seeding from node public key failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Read existing feed state FIRST (before any upload) so we can detect
  // incompatible prior payloads without burning a stamp.
  const topic = normalizeFeedTopic(feedTopic);
  const feedPrivateKey = hexToBytes(
    config.bee.feedPrivateKey.startsWith("0x")
      ? config.bee.feedPrivateKey.slice(2)
      : config.bee.feedPrivateKey
  );
  const owner = feedOwnerFromPrivateKey(config.bee.feedPrivateKey);

  let priorItems: MarketplaceDataItem[] = [];
  if (append) {
    try {
      const feedReader = bee.makeFeedReader(topic.topicBytes, owner);
      const latest = await feedReader.downloadPayload();
      const parsed = decodeMarketplaceFeedPayload(
        latest.payload.toUint8Array()
      );
      priorItems = parsed.dataItems;
    } catch (err) {
      // A missing feed OR a strictly-incompatible payload both land here.
      // We distinguish: "no feed yet" is fine (start with []), but a feed
      // that exists with a non-marketplace payload is an error -- we don't
      // want to silently overwrite another schema.
      const message = err instanceof Error ? err.message : String(err);
      const isNotFound =
        message.includes("Not Found") ||
        message.includes("404") ||
        message.includes("not found");
      if (!isNotFound) {
        return getToolErrorResponse(
          `append=true but the latest feed entry is not marketplace-v1: ${message}. ` +
            "Either pass append=false to replace the feed, or use a different feedTopic."
        );
      }
    }
  }

  // Load file / accept text.
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

  // createGrantees first (per ACT flow constraint).
  let granteeListRef: string;
  let actHistoryRef: string;
  try {
    const g = await bee.createGrantees(postageBatchId, grantees);
    granteeListRef = g.ref.toHex();
    actHistoryRef = g.historyref.toHex();
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to create grantees list.";
    return getToolErrorResponse(msg);
  }

  // Upload the content with ACT attached to that grantee list.
  const uploadOptions: UploadOptions = {
    act: true,
    actHistoryAddress: actHistoryRef,
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
  const finalHistoryRef = uploadHistHex ?? actHistoryRef;

  // Assemble and write the marketplace payload.
  const newItem: MarketplaceDataItem = {
    agentId: args.agentId,
    swarmHash: uploadResult.reference.toHex(),
    actHistoryRef: finalHistoryRef,
    granteeRef: granteeListRef,
    publisherPublicKey,
    displayName: args.displayName,
    metadata,
    tags,
  };

  const dataItems = append ? [...priorItems, newItem] : [newItem];
  const payloadBytes = encodeMarketplaceFeedPayload({
    schemeVersion: MARKETPLACE_SCHEME_VERSION,
    dataItems,
  });

  let feedWriteResult;
  try {
    const feedWriter = bee.makeFeedWriter(topic.topicBytes, feedPrivateKey);
    feedWriteResult = await feedWriter.uploadPayload(
      postageBatchId,
      payloadBytes
    );
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Content uploaded but feed update failed.";
    return getToolErrorResponse(msg);
  }

  return getResponseWithStructuredContent({
    feedTopic,
    feedTopicHex: topic.topicHex,
    feedOwner: owner,
    feedUrl: `${config.bee.endpoint}/feeds/${owner}/${topic.topicHex}`,
    feedReference: feedWriteResult.reference.toHex(),
    schemeVersion: MARKETPLACE_SCHEME_VERSION,
    itemIndex: dataItems.length - 1,
    totalItems: dataItems.length,
    item: newItem,
    grantees,
    autoSeededGrantee,
    fileName: fileName ?? null,
    appendMode: append,
    message: append
      ? priorItems.length > 0
        ? `Item appended. Catalog now has ${dataItems.length} items.`
        : "First item published (no prior feed entry to append to)."
      : "Feed replaced with a single-item catalog.",
  });
}

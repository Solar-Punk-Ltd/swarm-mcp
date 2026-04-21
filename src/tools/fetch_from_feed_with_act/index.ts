/**
 * MCP Tool: fetch_from_feed_with_act
 *
 * Consumer flow: read the latest feed entry for (topic, feedOwner), decode
 * the { r, h } payload, then download the content with ACT using the
 * publisher's public key. The local Bee node derives the decryption key via
 * ECDH against its own identity, which must be in the grantee list at the
 * given history (or at actTimestamp if provided).
 *
 * feedOwner defaults to the ethereum address derived from publisherPubKey,
 * matching the "align publisher identity with feed owner" convention. Override
 * explicitly only if the feed was signed by a different key.
 */
import {
  Bee,
  DownloadOptions,
  MantarayNode,
  PublicKey,
} from "@ethersphere/bee-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { normalizePublicKeyHex, normalizeReferenceHex } from "../../utils/act";
import { decodeFeedActPayload, normalizeFeedTopic } from "../../utils/feed";
import { FetchFromFeedWithActArgs } from "./models";
import { BAD_REQUEST_STATUS, NOT_FOUND_STATUS } from "../../constants";

export async function fetchFromFeedWithAct(
  args: FetchFromFeedWithActArgs,
  bee: Bee,
  transport: unknown
): Promise<ToolResponse> {
  if (!args.feedTopic) {
    return getToolErrorResponse("Missing required parameter: feedTopic.");
  }
  if (!args.publisherPubKey) {
    return getToolErrorResponse("Missing required parameter: publisherPubKey.");
  }
  if (args.filePath && !(transport instanceof StdioServerTransport)) {
    return getToolErrorResponse(
      "Saving to file path is only supported in stdio mode."
    );
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

  let payload;
  try {
    const feedReader = bee.makeFeedReader(topic.topicBytes, feedOwner);
    const latest = await feedReader.downloadPayload();
    payload = decodeFeedActPayload(latest.payload.toUint8Array());
  } catch (err) {
    if (errorHasStatus(err, NOT_FOUND_STATUS)) {
      return getToolErrorResponse(
        "Feed entry not found. Check the topic and feedOwner (or publisherPubKey) are correct."
      );
    }
    return getToolErrorResponse(
      `Unable to read feed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let reference: string;
  let historyAddress: string;
  try {
    reference = normalizeReferenceHex(payload.r);
    historyAddress = normalizeReferenceHex(payload.h);
  } catch (e) {
    return getToolErrorResponse(
      `Feed payload is malformed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const actOptions: DownloadOptions = {
    actPublisher: publisherPubKey,
    actHistoryAddress: historyAddress,
  };
  if (args.actTimestamp !== undefined) {
    actOptions.actTimestamp = args.actTimestamp;
  }

  if (!args.filePath) {
    try {
      const data = await bee.downloadData(reference, actOptions);
      return getResponseWithStructuredContent({
        feedTopic: args.feedTopic,
        feedTopicHex: topic.topicHex,
        feedOwner,
        reference,
        historyAddress,
        textData: data.toUtf8(),
      });
    } catch (err) {
      if (errorHasStatus(err, NOT_FOUND_STATUS)) {
        return getToolErrorResponse(
          "Content not found, or this node is not a grantee for the current history."
        );
      }
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Unable to download ACT-protected data.";
      return getToolErrorResponse(msg);
    }
  }

  let node: MantarayNode;
  try {
    node = await MantarayNode.unmarshal(bee, reference, actOptions);
    await node.loadRecursively(bee, actOptions);
  } catch {
    try {
      const data = await bee.downloadData(reference, actOptions);
      if (!fs.existsSync(args.filePath)) {
        await mkdir(args.filePath, { recursive: true });
      }
      const destination = path.join(args.filePath, "payload.bin");
      await writeFile(destination, data.toUint8Array());
      return getResponseWithStructuredContent({
        feedTopic: args.feedTopic,
        feedOwner,
        reference,
        historyAddress,
        savedTo: destination,
        type: "single-chunk",
      });
    } catch (err) {
      const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
        ? getErrorMessage(err)
        : "Unable to download ACT-protected content.";
      return getToolErrorResponse(msg);
    }
  }

  const nodes = node.collect();
  const destinationFolder = args.filePath;
  if (!fs.existsSync(destinationFolder)) {
    await mkdir(destinationFolder, { recursive: true });
  }

  try {
    for (const n of nodes) {
      const parsed = path.parse(n.fullPathString);
      const nodeDest = path.join(destinationFolder, parsed.dir);
      if (!fs.existsSync(nodeDest)) {
        await mkdir(nodeDest, { recursive: true });
      }
      const data = await bee.downloadData(n.targetAddress, actOptions);
      await writeFile(
        path.join(destinationFolder, n.fullPathString),
        data.toUint8Array()
      );
    }
  } catch (err) {
    const msg = errorHasStatus(err, BAD_REQUEST_STATUS)
      ? getErrorMessage(err)
      : "Unable to download ACT-protected manifest.";
    return getToolErrorResponse(msg);
  }

  return getResponseWithStructuredContent({
    feedTopic: args.feedTopic,
    feedOwner,
    reference,
    historyAddress,
    savedTo: destinationFolder,
    manifestNodeCount: nodes.length,
    type: "manifest",
    message: `ACT manifest (${nodes.length} files) saved to ${destinationFolder}.`,
  });
}

/**
 * MCP Tool: upload_dynamic_text
 * Uploads dynamic text data to Swarm
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Bee } from "@ethersphere/bee-js";
import { Wallet } from "@ethereumjs/wallet";
import crypto from "crypto";
import config from "../config";
import { hexToBytes, ToolResponse } from "../utils";

export interface UploadDynamicTextArgs {
  data: string;
  memoryTopic: string;
}

export async function uploadDynamicText(
  args: UploadDynamicTextArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.data) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: data"
    );
  } else if (!args.memoryTopic) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: topic"
    );
  }

  const binaryData = Buffer.from(args.data);

  // Feed upload if memoryTopic is specified
  if (!config.bee.feedPrivateKey) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Feed private key not configured. Set BEE_FEED_PK environment variable."
    );
  }

  // Process topic - if not a hex string, hash it
  let topic = args.memoryTopic;
  if (topic.startsWith("0x")) {
    topic = topic.slice(2);
  }
  const isHexString = /^[0-9a-fA-F]{64}$/.test(args.memoryTopic);

  if (!isHexString) {
    // Hash the topic string using SHA-256
    const hash = crypto
      .createHash("sha256")
      .update(args.memoryTopic)
      .digest("hex");
    topic = hash;
  }

  // Convert topic string to bytes
  const topicBytes = hexToBytes(topic);

  const feedPrivateKey = hexToBytes(config.bee.feedPrivateKey);
  const signer = new Wallet(feedPrivateKey);
  const owner = signer.getAddressString().slice(2);
  const feedWriter = bee.makeFeedWriter(topicBytes, feedPrivateKey);

  const result = await feedWriter.uploadPayload(
    config.bee.postageBatchId,
    binaryData
  );
  const reference = result.reference.toString();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            reference,
            topicString: args.memoryTopic,
            topic: topic,
            feedUrl: `${config.bee.endpoint}/feeds/${owner}/${topic}`,
            message: "Data successfully uploaded to Swarm and linked to feed",
          },
          null,
          2
        ),
      },
    ],
  };
}

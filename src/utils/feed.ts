/**
 * Feed helpers: topic normalization and JSON payload codec.
 *
 * Plain-text topics are hashed with SHA-256 to stay compatible with the
 * existing update_feed / read_feed tools.
 */
import crypto from "crypto";
import { Wallet } from "@ethereumjs/wallet";
import { hexToBytes } from ".";

export interface NormalizedTopic {
  topicHex: string;
  topicBytes: Uint8Array;
  topicString: string;
}

export function normalizeFeedTopic(input: string): NormalizedTopic {
  const topicString = input;
  let topic = input;
  if (topic.startsWith("0x") || topic.startsWith("0X")) {
    topic = topic.slice(2);
  }
  const isHex = /^[0-9a-fA-F]{64}$/.test(topic);
  const topicHex = isHex
    ? topic.toLowerCase()
    : crypto.createHash("sha256").update(input).digest("hex");
  return { topicHex, topicBytes: hexToBytes(topicHex), topicString };
}

export function feedOwnerFromPrivateKey(feedPrivateKeyHex: string): string {
  const key = feedPrivateKeyHex.startsWith("0x")
    ? feedPrivateKeyHex.slice(2)
    : feedPrivateKeyHex;
  const signer = new Wallet(hexToBytes(key));
  return signer.getAddressString().slice(2);
}

export interface FeedActPayload {
  r: string;
  h: string;
}

export function encodeFeedActPayload(payload: FeedActPayload): Uint8Array {
  return Buffer.from(JSON.stringify(payload));
}

export function decodeFeedActPayload(raw: Uint8Array | string): FeedActPayload {
  const text =
    typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
  const parsed = JSON.parse(text) as { r?: unknown; h?: unknown };
  if (typeof parsed.r !== "string" || typeof parsed.h !== "string") {
    throw new Error(
      'feed payload is not in the expected shape { "r": "<hex>", "h": "<hex>" }'
    );
  }
  return { r: parsed.r, h: parsed.h };
}

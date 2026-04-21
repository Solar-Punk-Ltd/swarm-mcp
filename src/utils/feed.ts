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
  /** content reference (what the consumer downloads with ACT) */
  r: string;
  /** grantee-list reference (needed for later patch/revoke; absent when publish had no grantees) */
  g?: string;
  /** ACT history address (needed for download + for patch) */
  h: string;
}

export function encodeFeedActPayload(payload: FeedActPayload): Uint8Array {
  return Buffer.from(JSON.stringify(payload));
}

export function decodeFeedActPayload(raw: Uint8Array | string): FeedActPayload {
  const text =
    typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
  const parsed = JSON.parse(text) as { r?: unknown; g?: unknown; h?: unknown };
  if (typeof parsed.r !== "string" || typeof parsed.h !== "string") {
    throw new Error(
      'feed payload is not in the expected shape { "r": "<hex>", "h": "<hex>", g?: "<hex>" }'
    );
  }
  return {
    r: parsed.r,
    h: parsed.h,
    ...(typeof parsed.g === "string" ? { g: parsed.g } : {}),
  };
}

/**
 * Marketplace feed schema v1. A single feed entry carries a catalog of data
 * items that consumers browse and (after x402 payment) access.
 */
export interface MarketplaceDataItem {
  swarmHash: string;
  actHistoryRef: string;
  granteeRef: string;
  displayName: string;
  metadata: string[];
  tags: string[];
}

export interface MarketplaceFeedPayload {
  schemeVersion: "v1";
  dataItems: MarketplaceDataItem[];
}

export const MARKETPLACE_SCHEME_VERSION = "v1";
const MARKETPLACE_ITEM_FIELDS = new Set([
  "swarmHash",
  "actHistoryRef",
  "granteeRef",
  "displayName",
  "metadata",
  "tags",
]);
const MARKETPLACE_PAYLOAD_FIELDS = new Set(["schemeVersion", "dataItems"]);

export function encodeMarketplaceFeedPayload(
  payload: MarketplaceFeedPayload
): Uint8Array {
  return Buffer.from(JSON.stringify(payload));
}

export function decodeMarketplaceFeedPayload(
  raw: Uint8Array | string
): MarketplaceFeedPayload {
  const text =
    typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("marketplace payload must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!MARKETPLACE_PAYLOAD_FIELDS.has(key)) {
      throw new Error(`marketplace payload has unknown field: ${key}`);
    }
  }
  if (obj.schemeVersion !== MARKETPLACE_SCHEME_VERSION) {
    throw new Error(
      `unsupported schemeVersion: ${String(obj.schemeVersion)} (expected "${MARKETPLACE_SCHEME_VERSION}")`
    );
  }
  if (!Array.isArray(obj.dataItems)) {
    throw new Error("marketplace payload missing dataItems array");
  }
  const items: MarketplaceDataItem[] = obj.dataItems.map((raw, i) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`dataItems[${i}] is not an object`);
    }
    const item = raw as Record<string, unknown>;
    for (const key of Object.keys(item)) {
      if (!MARKETPLACE_ITEM_FIELDS.has(key)) {
        throw new Error(`dataItems[${i}] has unknown field: ${key}`);
      }
    }
    const asString = (field: string): string => {
      const value = item[field];
      if (typeof value !== "string") {
        throw new Error(`dataItems[${i}].${field} must be a string`);
      }
      return value;
    };
    const asStringArray = (field: string): string[] => {
      const value = item[field];
      if (!Array.isArray(value)) {
        throw new Error(`dataItems[${i}].${field} must be an array`);
      }
      return value.map((entry, j) => {
        if (typeof entry !== "string") {
          throw new Error(`dataItems[${i}].${field}[${j}] must be a string`);
        }
        return entry;
      });
    };
    return {
      swarmHash: asString("swarmHash"),
      actHistoryRef: asString("actHistoryRef"),
      granteeRef: asString("granteeRef"),
      displayName: asString("displayName"),
      metadata: asStringArray("metadata"),
      tags: asStringArray("tags"),
    };
  });
  return { schemeVersion: MARKETPLACE_SCHEME_VERSION, dataItems: items };
}

/**
 * Tagged union for "what kind of payload is this feed entry?".
 * Tools that need to support both shapes (grant_feed_access, revoke_feed_access)
 * dispatch on `kind`.
 */
export type DetectedFeedPayload =
  | { kind: "marketplace-v1"; payload: MarketplaceFeedPayload }
  | { kind: "r-g-h"; payload: FeedActPayload }
  | { kind: "unknown"; raw: unknown };

export function detectFeedPayload(
  raw: Uint8Array | string
): DetectedFeedPayload {
  const text =
    typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "unknown", raw: text };
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (obj.schemeVersion !== undefined || obj.dataItems !== undefined) {
      return {
        kind: "marketplace-v1",
        payload: decodeMarketplaceFeedPayload(text),
      };
    }
    if (typeof obj.r === "string" && typeof obj.h === "string") {
      return { kind: "r-g-h", payload: decodeFeedActPayload(text) };
    }
  }
  return { kind: "unknown", raw: parsed };
}

/**
 * MCP Tool: gsoc_send
 *
 * Sends a GSOC message with a caller-provided signer (mined GSOC resource
 * key) and topic. The topic is a human-readable string; it's hashed into a
 * 32-byte identifier via Identifier.fromString (keccak under the hood).
 *
 * Flow:
 *   1. Resolve postage batch (falls back to AUTO_ASSIGN_STAMP).
 *   2. Decode the message per `encoding` (utf8 default; base64 and hex also
 *      supported for binary payloads).
 *   3. Call bee.gsocSend(stamp, signer, identifier, bytes).
 *   4. Return the chunk reference + the signerAddress a subscriber would
 *      plug into gsocSubscribe.
 *
 * Note: "Only full nodes can accept GSOC messages." Gateway Bee nodes will
 * error — that's why this tool is in the nodeOnlyTools filter.
 */
import { Bee, Identifier, PrivateKey } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getErrorMessage,
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { getUploadPostageBatchId } from "../../utils/upload-stamp";
import { GsocSendArgs, GsocSendEncoding } from "./models";
import { BAD_REQUEST_STATUS } from "../../constants";

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X")
    ? value.slice(2)
    : value;
}

function decodeMessage(
  raw: string,
  encoding: GsocSendEncoding
): { bytes: Buffer; error?: string } {
  try {
    if (encoding === "utf8") {
      return { bytes: Buffer.from(raw, "utf8") };
    }
    if (encoding === "hex") {
      const hex = stripHexPrefix(raw);
      if (!/^[0-9a-fA-F]*$/.test(hex)) {
        return {
          bytes: Buffer.alloc(0),
          error: "message is not valid hex",
        };
      }
      if (hex.length % 2 !== 0) {
        return {
          bytes: Buffer.alloc(0),
          error: "hex message must have even length",
        };
      }
      return { bytes: Buffer.from(hex, "hex") };
    }
    if (encoding === "base64") {
      if (!/^[A-Za-z0-9+/=_-]*$/.test(raw)) {
        return {
          bytes: Buffer.alloc(0),
          error: "message is not valid base64",
        };
      }
      return { bytes: Buffer.from(raw, "base64") };
    }
    return {
      bytes: Buffer.alloc(0),
      error: `unknown encoding: ${String(encoding)}`,
    };
  } catch (e) {
    return {
      bytes: Buffer.alloc(0),
      error: `failed to decode message (${encoding}): ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function gsocSend(
  args: GsocSendArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.message) {
    return getToolErrorResponse("Missing required parameter: message.");
  }
  if (!args.resourceId) {
    return getToolErrorResponse(
      "Missing required parameter: resourceId (32-byte hex private key mined for the target overlay)."
    );
  }
  if (!args.topic) {
    return getToolErrorResponse("Missing required parameter: topic.");
  }
  const encoding: GsocSendEncoding = args.encoding ?? "utf8";

  const { bytes, error: decodeError } = decodeMessage(args.message, encoding);
  if (decodeError) return getToolErrorResponse(decodeError);
  if (bytes.length === 0) {
    return getToolErrorResponse("Decoded message is empty.");
  }

  const { postageBatchId, error } = await getUploadPostageBatchId(
    args.postageBatchId,
    bee
  );
  if (error !== null) return getToolErrorResponse(error);
  if (postageBatchId === null)
    return getToolErrorResponse("No postage batch id.");

  let signer: PrivateKey;
  try {
    signer = new PrivateKey(stripHexPrefix(args.resourceId));
  } catch (e) {
    return getToolErrorResponse(
      `Invalid resourceId: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  const signerAddress = signer.publicKey().address();

  const identifier = Identifier.fromString(args.topic);

  try {
    const result = await bee.gsocSend(
      postageBatchId,
      signer,
      identifier,
      bytes
    );
    return getResponseWithStructuredContent({
      reference: result.reference.toHex(),
      bytesSent: bytes.length,
      encoding,
      topic: args.topic,
      topicHex: identifier.toHex(),
      signerAddress: signerAddress.toHex(),
      message: "GSOC message sent.",
    });
  } catch (err) {
    const body = getErrorMessage(err);
    if (errorHasStatus(err, BAD_REQUEST_STATUS)) {
      return getToolErrorResponse(
        `Bee rejected the GSOC send: ${body || (err instanceof Error ? err.message : String(err))}`
      );
    }
    return getToolErrorResponse(
      `Unable to send GSOC message: ${body || (err instanceof Error ? err.message : String(err))}. Note: GSOC requires a full Bee node; gateway nodes refuse.`
    );
  }
}

/**
 * MCP Tool: topup_postage_stamp
 * Increase the duration and size of a postage stamp.
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Bee, Duration, Size } from "@ethersphere/bee-js";
import {
  getResponseWithStructuredContent,
  makeDate,
  ToolResponse,
} from "../../utils";
import { TopupPostageStampArgs } from "./models";

export async function topupPostageStamp(
  args: TopupPostageStampArgs,
  bee: Bee
): Promise<ToolResponse> {
  const { postageBatchId, duration, size } = args;

  if (!postageBatchId) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: postageBatchId"
    );
  } else if (!duration && !size) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "You need at least one parameter from duration and size."
    );
  }

  const extendSize = Size.fromBytes(size || 1);
  let extendDuration = Duration.ZERO;

  try {
    if (duration) {
      extendDuration = Duration.fromMilliseconds(makeDate(duration));
    }
  } catch (makeDateError) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid parameter: duration");
  }

  const extendStorageResponse = await bee.extendStorage(
    postageBatchId,
    extendSize,
    extendDuration
  );

  return getResponseWithStructuredContent({
    batchId: extendStorageResponse.toHex(),
  });
}

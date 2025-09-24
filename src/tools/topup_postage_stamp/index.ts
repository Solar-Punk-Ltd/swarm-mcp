/**
 * MCP Tool: topup_postage_stamp
 * Increase the duration and size of a postage stamp.
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Bee, Duration, Size } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getResponseWithStructuredContent,
  makeDate,
  ToolResponse,
} from "../../utils";
import { TopupPostageStampArgs } from "./models";
import { GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../../constants";

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

  let extendStorageResponse;

  try {
    extendStorageResponse = await bee.extendStorage(
      postageBatchId,
      extendSize,
      extendDuration
    );
  } catch (error) {
    if (errorHasStatus(error, NOT_FOUND_STATUS)) {
      throw new McpError(ErrorCode.MethodNotFound, GATEWAY_STAMP_ERROR_MESSAGE);
    } else {
      throw new McpError(ErrorCode.InvalidParams, "Topup failed.");
    }
  }

  return getResponseWithStructuredContent({
    batchId: extendStorageResponse.toHex(),
  });
}

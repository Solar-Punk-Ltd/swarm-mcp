/**
 * MCP Tool: create_postage_stamp
 * Buy postage stamp based on size and duration.
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Bee, Duration, Size } from "@ethersphere/bee-js";
import {
  errorHasStatus,
  getResponseWithStructuredContent,
  makeDate,
  ToolResponse,
} from "../../utils";
import { CreatePostageStampArgs } from "./models";
import { GATEWAY_STAMP_ERROR_MESSAGE, NOT_FOUND_STATUS } from "../../constants";

export async function createPostageStamp(
  args: CreatePostageStampArgs,
  bee: Bee
): Promise<ToolResponse> {
  const { size, duration } = args;

  if (!size) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: size."
    );
  } else if (!duration) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: duration."
    );
  }

  let durationMs;

  try {
    durationMs = makeDate(duration);
  } catch (makeDateError) {
    throw new McpError(ErrorCode.InvalidParams, "Invalid parameter: duration");
  }

  let buyStorageResponse;

  try {
    buyStorageResponse = await bee.buyStorage(
      Size.fromBytes(size),
      Duration.fromMilliseconds(durationMs)
    );
  } catch (error) {
    if (errorHasStatus(error, NOT_FOUND_STATUS)) {
      throw new McpError(ErrorCode.MethodNotFound, GATEWAY_STAMP_ERROR_MESSAGE);
    } else {
      throw new McpError(ErrorCode.InvalidParams, "Unable to buy storage.");
    }
  }

  return getResponseWithStructuredContent({
    postageBatchId: buyStorageResponse.toHex(),
  });
}

/**
 * MCP Tool: get_storage_cost
 * Estimate the BZZ cost of a postage stamp for a given size and duration.
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Bee, Duration, Size } from "@ethersphere/bee-js";
import { getErrorMessage, getResponseWithStructuredContent, ToolResponse } from "../../utils";
import { GetStorageCostArgs } from "./models";

export async function getStorageCost(
  args: GetStorageCostArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.size || args.size <= 0) {
    throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: size");
  }
  if (!args.duration) {
    throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: duration");
  }

  let parsedDuration: Duration;
  try {
    parsedDuration = Duration.parseFromString(args.duration);
  } catch {
    throw new McpError(ErrorCode.InvalidParams, "Invalid parameter: duration");
  }

  try {
    const bzz = await bee.getStorageCost(
      Size.fromMegabytes(args.size),
      parsedDuration
    );

    const plurPerBzz = BigInt("10000000000000000"); // 1 BZZ = 10^16 PLUR
    const plurString = bzz.toPLURString ? bzz.toPLURString() : bzz.toString();
    const bzzDecimal = bzz.toDecimalString ? bzz.toDecimalString() : bzz.toString();

    return getResponseWithStructuredContent({
      bzz: bzzDecimal,
      plur: plurString,
    });
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, `Unable to estimate storage cost: ${getErrorMessage(error)}`);
  }
}

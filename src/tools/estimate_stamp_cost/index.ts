/**
 * MCP Tool: estimate_stamp_cost
 *
 * Read-only: given a data size and duration, returns the BZZ cost via
 * bee.getStorageCost (the same math bee.buyStorage uses -- guarantees the
 * estimate matches the actual purchase), plus a depth recommendation with
 * ~20% headroom for informational display.
 */
import { Bee, Duration, Size } from "@ethersphere/bee-js";
import {
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import {
  recommendDepthForBytes,
  theoreticalCapacityBytesForDepth,
} from "../../utils/stamp-recommendation";
import { EstimateStampCostArgs } from "./models";

export async function estimateStampCostTool(
  args: EstimateStampCostArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.size) {
    return getToolErrorResponse("Missing required parameter: size.");
  }
  if (!args.duration) {
    return getToolErrorResponse("Missing required parameter: duration.");
  }

  let size: Size;
  try {
    size = Size.parseFromString(args.size);
  } catch {
    return getToolErrorResponse("Invalid parameter: size.");
  }

  let duration: Duration;
  try {
    duration = Duration.parseFromString(args.duration);
  } catch {
    return getToolErrorResponse("Invalid parameter: duration.");
  }

  try {
    const cost = await bee.getStorageCost(size, duration);
    const depth =
      args.depth !== undefined
        ? args.depth
        : recommendDepthForBytes(size.toBytes());

    return getResponseWithStructuredContent({
      sizeInput: args.size,
      durationInput: args.duration,
      dataSizeBytes: size.toBytes(),
      depth,
      theoreticalCapacityBytes: theoreticalCapacityBytesForDepth(depth),
      totalCostBzz: cost.toDecimalString(),
      totalCostPlur: cost.toPLURString(),
      note:
        "Cost computed via bee.getStorageCost (matches what bee.buyStorage would charge at the current chain price). " +
        "Depth is a headroom-padded suggestion; bee.buyStorage derives its own depth from size. " +
        "Use create_postage_stamp to execute the purchase.",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return getToolErrorResponse(`Unable to estimate stamp cost: ${reason}`);
  }
}

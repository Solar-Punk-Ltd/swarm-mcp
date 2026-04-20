/**
 * MCP Tool: estimate_stamp_cost
 * Given a data size and duration, returns a recommended depth (with ~20%
 * headroom) and the BZZ cost at current chain price. Read-only: does not
 * purchase a stamp.
 */
import { Bee, Duration, Size } from "@ethersphere/bee-js";
import {
  getResponseWithStructuredContent,
  getToolErrorResponse,
  ToolResponse,
} from "../../utils";
import { estimateStampCost } from "../../utils/stamp-recommendation";
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
    const estimate = await estimateStampCost(
      bee,
      size,
      duration.toSeconds(),
      args.depth
    );
    return getResponseWithStructuredContent({
      ...estimate,
      sizeInput: args.size,
      durationInput: args.duration,
      note:
        "Estimate based on the current on-chain price and Gnosis block time. " +
        "Final stamp cost may differ slightly.",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return getToolErrorResponse(`Unable to estimate stamp cost: ${reason}`);
  }
}

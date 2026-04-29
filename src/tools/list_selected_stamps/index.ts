import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getSelectedStamps } from "../select_postage_stamp";
import {
  ListSelectedStampsArgs,
  ListSelectedStampsResult,
} from "./models";

export function listSelectedStamps(
  args: ListSelectedStampsArgs
): CallToolResult {
  const selectedStamps = getSelectedStamps();

  const result: ListSelectedStampsResult = {
    selectedStamps,
    count: selectedStamps.length,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

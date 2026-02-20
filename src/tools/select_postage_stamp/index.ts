import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  SelectPostageStampArgs,
  SelectPostageStampResult,
} from "./models";

// Store selected stamps (in-memory)
const selectedStamps: Set<string> = new Set();

export function selectPostageStamp(
  args: SelectPostageStampArgs
): CallToolResult {
  const { label, selected } = args;

  // Update the selection
  if (selected) {
    selectedStamps.add(label);
  } else {
    selectedStamps.delete(label);
  }

  const result: SelectPostageStampResult = {
    success: true,
    label,
    selected,
    selectedStamps: Array.from(selectedStamps),
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

export function getSelectedStamps(): string[] {
  return Array.from(selectedStamps);
}

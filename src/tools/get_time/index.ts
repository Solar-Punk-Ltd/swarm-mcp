/**
 * MCP Tool: get-time
 * Returns the current server time in ISO 8601 format.
 */
import { ToolResponse } from "../../utils";
import { GetTimeArgs, GetTimeResult } from "./models";

export async function getTime(_args: GetTimeArgs): Promise<ToolResponse> {
  const time = new Date().toISOString();
  const result: GetTimeResult = { time };

  return {
    content: [
      {
        type: "text",
        text: time,
      },
    ],
    structuredContent: result,
  };
}

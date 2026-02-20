/**
 * MCP Tool: swarm-mcp-app-tool (formerly get-time)
 * Triggers the Swarm MCP App UI interface.
 */
import { ToolResponse } from "../../utils";
import { GetTimeArgs } from "./models";

export async function getTime(_args: GetTimeArgs): Promise<ToolResponse> {
  return {
    content: [
      {
        type: "text",
        text: "Swarm MCP App UI interface",
      },
    ],
    structuredContent: {
      message: "UI interface available",
    },
  };
}

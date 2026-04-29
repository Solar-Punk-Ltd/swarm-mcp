/**
 * MCP Tool: open_app
 * Triggers the Swarm MCP App UI interface.
 */
import { ToolResponse } from "../../utils";
import { OpenAppArgs } from "./models";

export async function openApp(_args: OpenAppArgs): Promise<ToolResponse> {
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

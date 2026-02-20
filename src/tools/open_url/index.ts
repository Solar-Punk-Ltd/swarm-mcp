/**
 * MCP Tool: open_url
 * Opens a URL in the default browser
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getResponseWithStructuredContent, ToolResponse } from "../../utils";
import { OpenUrlArgs } from "./models";

export async function openUrl(args: OpenUrlArgs): Promise<ToolResponse> {
  if (!args.url) {
    throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: url");
  }

  try {
    // Dynamic import for ESM module
    const { default: open } = await import("open");
    await open(args.url);
    
    return getResponseWithStructuredContent({
      success: true,
      message: `Successfully opened URL: ${args.url}`,
      url: args.url,
    });
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to open URL: ${error.message}`
    );
  }
}

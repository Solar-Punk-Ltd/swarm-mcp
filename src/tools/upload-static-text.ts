/**
 * MCP Tool: upload_static_text
 * Uploads text data to Swarm
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Bee } from "@ethersphere/bee-js";
import config from "../config";
import { ToolResponse } from "../utils";

export interface UploadStaticTextArgs {
  data: string;
  redundancyLevel?: number;
}

export async function uploadStaticText(
  args: UploadStaticTextArgs,
  bee: Bee
): Promise<ToolResponse> {
  if (!args.data) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required parameter: data"
    );
  }

  const binaryData = Buffer.from(args.data);

  const redundancyLevel = args.redundancyLevel;
  const options = redundancyLevel ? { redundancyLevel } : undefined;

  const result = await bee.uploadData(
    config.bee.postageBatchId,
    binaryData,
    options
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            reference: result.reference.toString(),
            url: config.bee.endpoint + "/bytes/" + result.reference.toString(),
            message: "Data successfully uploaded to Swarm",
          },
          null,
          2
        ),
      },
    ],
  };
}

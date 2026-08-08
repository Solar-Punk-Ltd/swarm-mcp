import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

describe("can list tools", () => {
  let client: Client;

  // Setup before tests
  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
    });

    client = new Client({
      name: "example-client",
      version: "1.0.0",
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  test("List all Tools", async () => {
    const tools = await client.listTools();

    expect(tools).toBeDefined();
    expect(tools.tools).toHaveLength(12);
    // Alphabetical order per spec Minor #3 (stable tools/list ordering).
    expect(tools.tools.map((t: { name: string }) => t.name)).toEqual([
      "create_postage_stamp",
      "download_data",
      "download_files",
      "extend_postage_stamp",
      "get_postage_stamp",
      "list_postage_stamps",
      "query_upload_progress",
      "read_feed",
      "update_feed",
      "upload_data",
      "upload_file",
      "upload_folder",
    ]);
  });
  test("Should fail validation with invalid parameters", async () => {
    // Under v2, invalid args return an isError:true tool result rather than
    // rejecting — the request itself succeeded, the tool's response signals
    // the validation failure.
    const result = (await client.callTool({
      name: "upload_data",
      arguments: {
        // Missing required 'data' field
        redundancyLevel: 0,
      },
    })) as { isError?: boolean; content: Array<{ text?: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/expected string/);
  });
});

/**
 * MCP Tool: list_upload_history
 * In-memory upload history store shared across upload tools.
 */
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { UploadHistoryEntry, UploadType, ListUploadHistoryArgs, ListUploadHistoryResult } from "./models";

// In-memory store
const history: UploadHistoryEntry[] = [];
let counter = 0;

export function addUploadEntry(entry: Omit<UploadHistoryEntry, "id" | "timestamp">): UploadHistoryEntry {
  const newEntry: UploadHistoryEntry = {
    ...entry,
    id: String(++counter),
    timestamp: new Date().toISOString(),
  };
  history.unshift(newEntry); // newest first
  return newEntry;
}

export function listUploadHistory(_args: ListUploadHistoryArgs): CallToolResult {
  const result: ListUploadHistoryResult = {
    history,
    count: history.length,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: result as unknown as { [x: string]: unknown },
  };
}

export type UploadType = "file" | "data" | "folder";

export interface UploadHistoryEntry {
  id: string;
  type: UploadType;
  reference: string;
  url: string;
  name?: string;
  sizeBytes?: number;
  tagId?: string;
  timestamp: string;
}

export interface ListUploadHistoryArgs {}

export interface ListUploadHistoryResult {
  history: UploadHistoryEntry[];
  count: number;
}

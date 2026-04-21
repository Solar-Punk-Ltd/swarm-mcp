export interface PublishToFeedWithActArgs {
  feedTopic: string;
  data?: string;
  filePath?: string;
  isPath?: boolean;
  grantees?: string[];
  redundancyLevel?: number;
  postageBatchId?: string;
  /**
   * Escape hatch: when provided, this JSON (stringified or object) is written
   * to the feed verbatim INSTEAD OF the default { r, g, h } payload. Content
   * upload + createGrantees still run if data/filePath/grantees are provided,
   * and the ACT refs are returned in the tool output for the caller to embed.
   * Accepts either an already-stringified JSON or an object.
   */
  customPayload?: string | Record<string, unknown>;
}

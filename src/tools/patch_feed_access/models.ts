export interface PatchFeedAccessArgs {
  feedTopic: string;
  granteePubKey: string;
  mode: "add" | "revoke";
  postageBatchId?: string;
}

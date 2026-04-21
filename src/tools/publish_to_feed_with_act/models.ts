export interface PublishToFeedWithActArgs {
  feedTopic: string;
  data?: string;
  filePath?: string;
  isPath?: boolean;
  grantees?: string[];
  redundancyLevel?: number;
  postageBatchId?: string;
}

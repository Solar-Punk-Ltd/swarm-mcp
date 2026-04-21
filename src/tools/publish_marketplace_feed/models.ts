export interface PublishMarketplaceFeedArgs {
  feedTopic: string;
  data?: string;
  filePath?: string;
  isPath?: boolean;
  displayName: string;
  metadata?: string[];
  tags?: string[];
  grantees?: string[];
  append?: boolean;
  postageBatchId?: string;
  redundancyLevel?: number;
}

export interface MarketplaceMetadataEntryArg {
  key: string;
  value: string;
}

export interface PublishMarketplaceFeedArgs {
  feedTopic?: string;
  agentId: number;
  publisherPublicKey?: string;
  data?: string;
  filePath?: string;
  isPath?: boolean;
  displayName: string;
  metadata?: MarketplaceMetadataEntryArg[];
  tags?: string[];
  grantees?: string[];
  append?: boolean;
  postageBatchId?: string;
  redundancyLevel?: number;
}

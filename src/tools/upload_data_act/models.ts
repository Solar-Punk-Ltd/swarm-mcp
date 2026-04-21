export interface UploadDataActArgs {
  data: string;
  grantees?: string[];
  historyAddress?: string;
  redundancyLevel?: number;
  postageBatchId?: string;
}

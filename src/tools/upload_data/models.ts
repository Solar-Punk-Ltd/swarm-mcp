export interface UploadDataArgs {
  data: string;
  act?: boolean;
  grantees?: string[];
  historyAddress?: string;
  redundancyLevel?: number;
  postageBatchId?: string;
}

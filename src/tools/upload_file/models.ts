export interface UploadFileArgs {
  data: string;
  act?: boolean;
  grantees?: string[];
  historyAddress?: string;
  redundancyLevel?: number;
  postageBatchId?: string;
}

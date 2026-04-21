export interface UploadFileActArgs {
  data: string;
  isPath?: boolean;
  grantees?: string[];
  historyAddress?: string;
  redundancyLevel?: number;
  postageBatchId?: string;
}

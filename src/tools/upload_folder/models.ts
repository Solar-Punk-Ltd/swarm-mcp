export interface UploadFolderArgs {
  folderPath: string;
  act?: boolean;
  grantees?: string[];
  historyAddress?: string;
  redundancyLevel?: number;
  postageBatchId?: string;
}

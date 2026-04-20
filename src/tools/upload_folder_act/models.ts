export interface UploadFolderActArgs {
  folderPath: string;
  grantees?: string[];
  historyAddress?: string;
  redundancyLevel?: number;
  postageBatchId?: string;
}

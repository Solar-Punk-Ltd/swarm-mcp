export interface UploadFileArgs {
  data: string;
  isPath?: boolean;
  redundancyLevel?: number;
  postageBatchId?: string;
}

export interface UploadDeferredResult {
  reference: string;
  url: string;
  tagId: string;
}

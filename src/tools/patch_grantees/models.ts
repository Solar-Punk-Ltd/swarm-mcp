export interface PatchGranteesArgs {
  reference: string;
  historyAddress: string;
  add?: string[];
  revoke?: string[];
  postageBatchId?: string;
}

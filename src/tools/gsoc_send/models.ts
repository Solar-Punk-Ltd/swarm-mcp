export type GsocSendEncoding = "utf8" | "base64" | "hex";

export interface GsocSendArgs {
  message: string;
  resourceId: string;
  topic: string;
  encoding?: GsocSendEncoding;
  postageBatchId?: string;
}

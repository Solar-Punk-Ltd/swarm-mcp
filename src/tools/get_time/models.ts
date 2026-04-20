/**
 * Types for swarm-mcp-app-tool (formerly get-time)
 */

export interface GetTimeArgs {
  tab?: "stamps" | "upload" | "history";
  stamp?: string;
  modal?: "buy-stamp";
}

export interface GetTimeResult {
  time: string;
}

/**
 * Types for swarm-mcp-app-tool (formerly get-time)
 */

export interface GetTimeArgs {
  tab?: "stamps" | "upload" | "history";
  stamp?: string;
}

export interface GetTimeResult {
  time: string;
}

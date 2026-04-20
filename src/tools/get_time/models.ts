/**
 * Types for swarm-mcp-app-tool (formerly get-time)
 */

export interface GetTimeArgs {
  tab?: "stamps" | "upload" | "history";
}

export interface GetTimeResult {
  time: string;
}

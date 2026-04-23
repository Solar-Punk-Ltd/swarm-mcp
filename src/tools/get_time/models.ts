/**
 * Types for swarm-mcp-app-tool (formerly get-time)
 */

export interface GetTimeArgs {
  tab?: "stamps" | "upload" | "history" | "status";
  stamp?: string;
  modal?: "buy-stamp";
  size?: number;
  duration?: string;
  label?: string;
  immutable?: boolean;
}

export interface GetTimeResult {
  time: string;
}

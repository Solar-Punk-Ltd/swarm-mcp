/**
 * Types for open_app
 */

export interface OpenAppArgs {
  tab?: "stamps" | "upload" | "history" | "status";
  stamp?: string;
  modal?: "buy-stamp";
  size?: number;
  duration?: string;
  label?: string;
  immutable?: boolean;
}

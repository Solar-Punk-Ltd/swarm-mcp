/**
 * Process-wide transport mode, set once by the entry point.
 *
 * Tools that touch the local filesystem — upload_file with a path,
 * upload_folder, download_files with filePath — are only meaningful when the
 * server runs beside the user over stdio. That used to be inferred per call
 * with `transport instanceof StdioServerTransport`, which silently goes false
 * the moment stdio moves to `serveStdio()`: the entry owns the real transport
 * and connects the McpServer to its own wrapper, so every path upload would
 * start answering "only supported in stdio mode". The entry point knows the
 * answer for certain — ask it instead of sniffing the transport.
 *
 * Defaults to "http", the closed posture: filesystem access is denied unless
 * an entry point explicitly opts in.
 */
export type TransportMode = "stdio" | "http";

let transportMode: TransportMode = "http";

export function setTransportMode(mode: TransportMode): void {
  transportMode = mode;
}

export function isStdioMode(): boolean {
  return transportMode === "stdio";
}

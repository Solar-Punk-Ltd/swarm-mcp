#!/usr/bin/env node

import { SwarmMCPServer } from "./mcp-service";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { setTransportMode } from "./runtime";

async function main() {
  // Declares the transport mode for the filesystem-touching tools. serveStdio
  // owns the real transport and hands the McpServer a wrapper, so those tools
  // cannot detect stdio by inspecting `server.transport`.
  setTransportMode("stdio");

  // serveStdio owns the era decision for the connection: the opening exchange
  // selects the era, one instance from the factory is pinned for the
  // connection lifetime, and server/discover is installed for modern clients.
  // `legacy: 'serve'` (the default) keeps 2025-era clients working. The
  // hand-wired `server.connect(new StdioServerTransport())` path this
  // replaced pinned every stdio connection to the 2025 era.
  const swarmMCPServer = new SwarmMCPServer();

  const handle = serveStdio(() => swarmMCPServer.buildFreshServer(), {
    onerror: (error: Error) => console.error("[Error]", error),
  });

  process.on("SIGINT", () => {
    void handle.close().finally(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error("Failed to start Swarm MCP Server:", error);
  process.exit(1);
});

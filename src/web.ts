#!/usr/bin/env node

import express, { Request, Response } from "express";
import cors from "cors";
import { SwarmMCPServer } from "./mcp-service";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = process.env.HOST || "0.0.0.0";

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

async function main() {
  // Setup for stateless HTTP transport
  const httpSwarmMCPServer = new SwarmMCPServer();
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Enforce stateless behavior
  });
  await httpSwarmMCPServer.server.connect(httpTransport);

  // Handle all MCP requests on the /mcp endpoint
  app.all("/mcp", async (req: Request, res: Response) => {
    try {
      await httpTransport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: req.body?.id,
        });
      }
    }
  });
  // Start the server
  app.listen(port, host, () => {});
}

main().catch((error) => {
  console.error("Failed to start Swarm MCP Server:", error);
  process.exit(1);
});

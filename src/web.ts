#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { SwarmMCPServer } from "./mcp-service";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = process.env.HOST || "0.0.0.0";

const app = express();

app.use(cors());
app.use(express.json());

async function main() {
  // One SwarmMCPServer per process — owns the shared TaskManager. The
  // factory returns a fresh McpServer per HTTP request (createMcpHandler
  // contract), but all fresh instances share the same TaskManager state
  // via closure. Task polling therefore requires sticky routing to this
  // process (plan §"Sticky routing required for task polling").
  const swarmMCPServer = new SwarmMCPServer();

  const httpHandler = createMcpHandler(() => swarmMCPServer.buildFreshServer());
  const nodeHandler = toNodeHandler(httpHandler);

  // express.json() consumes the request stream; pass the parsed body through
  // as toNodeHandler's third argument so the handler doesn't try to re-read
  // an already-consumed stream (docs: "When a body parser already consumed
  // the stream (express.json()), pass the parsed value as parsedBody").
  app.all("/mcp", (req, res) => nodeHandler(req, res, req.body));

  app.listen(port, host, () => {});
}

main().catch((error) => {
  console.error("Failed to start Swarm MCP Server:", error);
  process.exit(1);
});

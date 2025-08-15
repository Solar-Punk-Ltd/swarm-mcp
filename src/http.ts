#!/usr/bin/env node

import express, { Request, Response } from 'express';
import cors from 'cors';
import { SwarmMCPServer } from './mcp-service';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const host = process.env.HOST || '0.0.0.0';

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Handle all MCP requests on the /mcp endpoint
app.all('/mcp', async (req: Request, res: Response) => {
  console.error(`[${req.method}] Handling request for ${req.path}`);
  try {
    // In stateless mode, create a new server and transport for each request
    const swarmMCPServer = new SwarmMCPServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Enforce stateless behavior
    });

    // Clean up when the request is closed
    res.on('close', () => {
      transport.close();
      swarmMCPServer.server.close();
      console.error('Request closed, resources released.');
    });

    // Connect the server and transport, then handle the request
    await swarmMCPServer.server.connect(transport);
    await transport.handleRequest(req, res, req.body);

  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Start the server
app.listen(port, host, () => {
  console.error(`Swarm MCP Server running on http://${host}:${port}`);
});

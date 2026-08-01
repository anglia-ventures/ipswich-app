#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GhostClient } from "./ghost-client.js";
import { registerGhostTools } from "./tools.js";

const GHOST_URL = process.env.GHOST_URL;
const GHOST_ADMIN_API_KEY = process.env.GHOST_ADMIN_API_KEY;

if (!GHOST_URL || !GHOST_ADMIN_API_KEY) {
  console.error(
    "Missing GHOST_URL or GHOST_ADMIN_API_KEY. Copy .env.example to .env and fill them in " +
      "(or set them as environment variables when launching this server).",
  );
  process.exit(1);
}

function buildServer(): McpServer {
  const server = new McpServer({ name: "ghost-cms", version: "0.1.0" });
  const client = new GhostClient({ url: GHOST_URL!, adminApiKey: GHOST_ADMIN_API_KEY! });
  registerGhostTools(server, client, GHOST_URL!);
  return server;
}

async function startStdio() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttp() {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    console.error("MCP_AUTH_TOKEN is required when MCP_TRANSPORT=http. Generate one with: openssl rand -hex 32");
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8787);

  const httpServer = createHttpServer(async (req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    if (req.headers.authorization !== `Bearer ${authToken}`) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Stateless mode: a fresh server + transport per request, no session state kept between calls.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  httpServer.listen(port, () => {
    console.error(`Ghost MCP server listening on http://localhost:${port}/mcp`);
  });
}

const transportMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();

if (transportMode === "http") {
  await startHttp();
} else {
  await startStdio();
}

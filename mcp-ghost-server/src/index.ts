#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const server = new McpServer({ name: "ghost-cms", version: "0.1.0" });
const client = new GhostClient({ url: GHOST_URL, adminApiKey: GHOST_ADMIN_API_KEY });
registerGhostTools(server, client, GHOST_URL);

await server.connect(new StdioServerTransport());

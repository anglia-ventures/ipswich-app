#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GhostClient } from "./ghost-client.js";
import { registerGhostTools } from "./tools.js";
import { OAuthStore } from "./oauth-store.js";
import {
  handleAuthServerMetadata,
  handleProtectedResourceMetadata,
  handleRegister,
  handleAuthorizeGet,
  handleAuthorizePost,
  handleToken,
  verifyAccessToken,
  sendUnauthorized,
  type OAuthConfig,
} from "./oauth.js";

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
  await buildServer().connect(new StdioServerTransport());
}

async function startHttp() {
  const passphrase = process.env.GHOST_MCP_PASSPHRASE;
  const publicUrl = process.env.PUBLIC_URL;
  if (!passphrase || !publicUrl) {
    console.error(
      "GHOST_MCP_PASSPHRASE and PUBLIC_URL are required when MCP_TRANSPORT=http. " +
        "PUBLIC_URL is this server's externally-reachable HTTPS origin (no trailing slash); " +
        "GHOST_MCP_PASSPHRASE gates the OAuth login page. Generate one with: openssl rand -hex 20",
    );
    process.exit(1);
  }
  const config: OAuthConfig = { publicUrl, passphrase };
  const store = new OAuthStore(process.env.OAUTH_STORE_PATH ?? "./oauth-store.json");
  const port = Number(process.env.PORT ?? 8787);

  const httpServer = createHttpServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];

    if (path === "/.well-known/oauth-authorization-server" && req.method === "GET") {
      return handleAuthServerMetadata(res, config);
    }
    if (path === "/.well-known/oauth-protected-resource" && req.method === "GET") {
      return handleProtectedResourceMetadata(res, config);
    }
    if (path === "/register" && req.method === "POST") {
      return handleRegister(req, res, store);
    }
    if (path === "/authorize" && req.method === "GET") {
      return handleAuthorizeGet(req, res, store);
    }
    if (path === "/authorize" && req.method === "POST") {
      return handleAuthorizePost(req, res, store, config);
    }
    if (path === "/token" && req.method === "POST") {
      return handleToken(req, res, store, config);
    }

    if (path === "/mcp") {
      if (!verifyAccessToken(req, store)) return sendUnauthorized(res, config);

      // Stateless mode: a fresh server + transport per request, no session state kept between calls.
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      return transport.handleRequest(req, res);
    }

    res.writeHead(404).end();
  });

  httpServer.listen(port, () => {
    console.error(`Ghost MCP server listening on ${publicUrl} (local port ${port})`);
  });
}

const transportMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();

if (transportMode === "http") {
  await startHttp();
} else {
  await startStdio();
}

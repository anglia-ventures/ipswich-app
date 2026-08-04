import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { signJwt, verifyJwt } from "./jwt.js";
import { OAuthStore } from "./oauth-store.js";

// A minimal OAuth 2.0 authorization server, just enough to satisfy what
// claude.ai's custom connector flow expects (RFC 8414 metadata, RFC 7591
// dynamic client registration, RFC 7636 PKCE, authorization_code + refresh
// grants). Ghost has no per-user login that maps onto this — every token
// this issues grants the same access, backed by one shared Ghost Admin key.
// "Login" is really just a shared passphrase gate, not real user accounts.
//
// Spec references:
// - MCP Authorization: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
// - RFC 8414 (AS metadata), RFC 9728 (protected resource metadata),
//   RFC 7591 (dynamic client registration), RFC 7636 (PKCE)

export interface OAuthConfig {
  publicUrl: string; // e.g. https://ghost-mcp.example.com (no trailing slash)
  passphrase: string;
}

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PendingAuthCode {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  expires_at: number;
}

const pendingAuthCodes = new Map<string, PendingAuthCode>();

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }).end(text);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** RFC 8414 authorization server metadata. */
export function handleAuthServerMetadata(res: ServerResponse, config: OAuthConfig): void {
  sendJson(res, 200, {
    issuer: config.publicUrl,
    authorization_endpoint: `${config.publicUrl}/authorize`,
    token_endpoint: `${config.publicUrl}/token`,
    registration_endpoint: `${config.publicUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}

/** RFC 9728 protected resource metadata — tells clients where the AS is. */
export function handleProtectedResourceMetadata(res: ServerResponse, config: OAuthConfig): void {
  sendJson(res, 200, {
    resource: `${config.publicUrl}/mcp`,
    authorization_servers: [config.publicUrl],
  });
}

/** RFC 7591 dynamic client registration — lets clients self-register with no pre-shared secret. */
export async function handleRegister(req: IncomingMessage, res: ServerResponse, store: OAuthStore): Promise<void> {
  let body: { redirect_uris?: unknown };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "invalid_client_metadata", error_description: "Body must be JSON." });
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every((u) => typeof u === "string")) {
    return sendJson(res, 400, {
      error: "invalid_client_metadata",
      error_description: "redirect_uris must be a non-empty array of strings.",
    });
  }

  const client = store.registerClient(redirectUris as string[]);
  sendJson(res, 201, {
    client_id: client.client_id,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
}

function loginForm(params: Record<string, string>, error?: string): string {
  const hidden = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`)
    .join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Connect Ghost CMS</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 4rem auto; padding: 0 1rem; }
  input[type=password] { width: 100%; padding: 0.5rem; font-size: 1rem; margin: 0.5rem 0; }
  button { padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; }
  .error { color: #b91c1c; }
</style></head>
<body>
  <h1>Connect Ghost CMS</h1>
  <p>Enter the shared access passphrase to let this app draft posts on your Ghost site.</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  <form method="POST">
    ${hidden}
    <input type="password" name="passphrase" placeholder="Passphrase" autofocus required>
    <button type="submit">Connect</button>
  </form>
</body></html>`;
}

/** GET /authorize — validates the request, then shows the passphrase form. */
export function handleAuthorizeGet(req: IncomingMessage, res: ServerResponse, store: OAuthStore): void {
  const url = new URL(req.url ?? "/", "http://placeholder");
  const client_id = url.searchParams.get("client_id") ?? "";
  const redirect_uri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const code_challenge = url.searchParams.get("code_challenge") ?? "";
  const code_challenge_method = url.searchParams.get("code_challenge_method") ?? "";
  const response_type = url.searchParams.get("response_type") ?? "";

  const client = store.getClient(client_id);
  if (response_type !== "code" || !client || !client.redirect_uris.includes(redirect_uri)) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Invalid client_id, redirect_uri, or response_type.");
    return;
  }
  if (code_challenge_method !== "S256" || !code_challenge) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("PKCE (S256) is required.");
    return;
  }

  res
    .writeHead(200, { "Content-Type": "text/html" })
    .end(loginForm({ client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type }));
}

/** POST /authorize — checks the passphrase, then issues a one-time auth code. */
export async function handleAuthorizePost(
  req: IncomingMessage,
  res: ServerResponse,
  store: OAuthStore,
  config: OAuthConfig,
): Promise<void> {
  const form = new URLSearchParams(await readBody(req));
  const client_id = form.get("client_id") ?? "";
  const redirect_uri = form.get("redirect_uri") ?? "";
  const state = form.get("state") ?? "";
  const code_challenge = form.get("code_challenge") ?? "";
  const code_challenge_method = form.get("code_challenge_method") ?? "";
  const response_type = form.get("response_type") ?? "";
  const passphrase = form.get("passphrase") ?? "";

  const client = store.getClient(client_id);
  if (response_type !== "code" || !client || !client.redirect_uris.includes(redirect_uri)) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Invalid client_id or redirect_uri.");
    return;
  }

  const expected = Buffer.from(config.passphrase);
  const actual = Buffer.from(passphrase);
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    res
      .writeHead(401, { "Content-Type": "text/html" })
      .end(loginForm({ client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type }, "Incorrect passphrase."));
    return;
  }

  const code = randomToken(24);
  pendingAuthCodes.set(code, { client_id, redirect_uri, code_challenge, expires_at: Date.now() + AUTH_CODE_TTL_MS });

  const redirect = new URL(redirect_uri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  res.writeHead(302, { Location: redirect.toString() }).end();
}

/** POST /token — exchanges an auth code (PKCE-verified) or refresh token for an access token. */
export async function handleToken(
  req: IncomingMessage,
  res: ServerResponse,
  store: OAuthStore,
  config: OAuthConfig,
): Promise<void> {
  const form = new URLSearchParams(await readBody(req));
  const grant_type = form.get("grant_type");

  if (grant_type === "authorization_code") {
    const code = form.get("code") ?? "";
    const redirect_uri = form.get("redirect_uri") ?? "";
    const client_id = form.get("client_id") ?? "";
    const code_verifier = form.get("code_verifier") ?? "";

    const pending = pendingAuthCodes.get(code);
    if (!pending || pending.expires_at < Date.now() || pending.client_id !== client_id || pending.redirect_uri !== redirect_uri) {
      return sendJson(res, 400, { error: "invalid_grant" });
    }
    pendingAuthCodes.delete(code); // single use

    if (sha256Base64Url(code_verifier) !== pending.code_challenge) {
      return sendJson(res, 400, { error: "invalid_grant", error_description: "PKCE verification failed." });
    }

    return issueTokens(res, store, config, client_id);
  }

  if (grant_type === "refresh_token") {
    const refresh_token = form.get("refresh_token") ?? "";
    const client_id = form.get("client_id") ?? "";
    const record = store.getRefreshToken(refresh_token);
    if (!record || record.client_id !== client_id) {
      return sendJson(res, 400, { error: "invalid_grant" });
    }
    store.revokeRefreshToken(refresh_token); // rotate on use
    return issueTokens(res, store, config, client_id);
  }

  sendJson(res, 400, { error: "unsupported_grant_type" });
}

function issueTokens(res: ServerResponse, store: OAuthStore, config: OAuthConfig, client_id: string): void {
  const access_token = signJwt({ client_id }, store.signingSecret, ACCESS_TOKEN_TTL_SECONDS);
  const refresh_token = randomToken(32);
  store.addRefreshToken(refresh_token, client_id);
  sendJson(res, 200, {
    access_token,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token,
  });
}

/** Validates the bearer token on requests to the MCP endpoint itself. */
export function verifyAccessToken(req: IncomingMessage, store: OAuthStore): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  return verifyJwt(token, store.signingSecret) !== null;
}

export function sendUnauthorized(res: ServerResponse, config: OAuthConfig): void {
  res
    .writeHead(401, {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${config.publicUrl}/.well-known/oauth-protected-resource"`,
    })
    .end(JSON.stringify({ error: "unauthorized" }));
}

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// File-backed storage for OAuth state that must survive a restart: the
// server's token-signing secret, dynamically registered clients (RFC 7591),
// and refresh tokens. Auth codes are not stored here — they live seconds,
// so an in-memory Map (see oauth.ts) is enough and simpler.

export interface OAuthClient {
  client_id: string;
  redirect_uris: string[];
  created_at: number;
}

interface StoreData {
  signingSecret: string; // hex
  clients: Record<string, OAuthClient>;
  refreshTokens: Record<string, { client_id: string; created_at: number }>;
}

export class OAuthStore {
  private data: StoreData;

  constructor(private readonly path: string) {
    if (existsSync(path)) {
      this.data = JSON.parse(readFileSync(path, "utf8"));
    } else {
      this.data = { signingSecret: randomBytes(32).toString("hex"), clients: {}, refreshTokens: {} };
      this.save();
    }
  }

  private save(): void {
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  get signingSecret(): Buffer {
    return Buffer.from(this.data.signingSecret, "hex");
  }

  registerClient(redirect_uris: string[]): OAuthClient {
    const client: OAuthClient = { client_id: randomBytes(16).toString("hex"), redirect_uris, created_at: Date.now() };
    this.data.clients[client.client_id] = client;
    this.save();
    return client;
  }

  getClient(client_id: string): OAuthClient | undefined {
    return this.data.clients[client_id];
  }

  addRefreshToken(token: string, client_id: string): void {
    this.data.refreshTokens[token] = { client_id, created_at: Date.now() };
    this.save();
  }

  getRefreshToken(token: string): { client_id: string; created_at: number } | undefined {
    return this.data.refreshTokens[token];
  }

  revokeRefreshToken(token: string): void {
    delete this.data.refreshTokens[token];
    this.save();
  }
}

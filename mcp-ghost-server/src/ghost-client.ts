import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// Ghost Admin API client.
// Docs: https://ghost.org/docs/admin-api/
//
// Auth: Admin API keys are "{id}:{hex secret}". Requests are authenticated
// with a short-lived JWT signed with the secret, sent as
// `Authorization: Ghost <token>`. See "Token authentication" in the docs.
// ---------------------------------------------------------------------------

export interface GhostClientConfig {
  url: string;
  adminApiKey: string;
}

export class GhostApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "GhostApiError";
  }
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signAdminToken(adminApiKey: string): string {
  const [id, secret] = adminApiKey.split(":");
  if (!id || !secret) {
    throw new Error(
      'GHOST_ADMIN_API_KEY must be in "{id}:{secret}" format, as shown in Ghost Admin → ' +
        "Settings → Integrations → your custom integration.",
    );
  }

  const header = { alg: "HS256", typ: "JWT", kid: id };
  const iat = Math.floor(Date.now() / 1000);
  const payload = { iat, exp: iat + 5 * 60, aud: "/admin/" };

  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac("sha256", Buffer.from(secret, "hex")).update(signingInput).digest();

  return `${signingInput}.${base64url(signature)}`;
}

export class GhostClient {
  private readonly baseUrl: string;
  private readonly adminApiKey: string;

  constructor(config: GhostClientConfig) {
    this.baseUrl = `${config.url.replace(/\/$/, "")}/ghost/api/admin`;
    this.adminApiKey = config.adminApiKey;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const queryString = query.toString();
    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Ghost ${signAdminToken(this.adminApiKey)}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message = data?.errors?.map((e: { message: string }) => e.message).join("; ") ?? res.statusText;
      throw new GhostApiError(`Ghost Admin API ${method} ${path} failed: ${message}`, res.status, data?.errors);
    }

    return data as T;
  }

  // -- Posts ------------------------------------------------------------

  browsePosts(params: {
    filter?: string;
    limit?: number;
    page?: number;
    order?: string;
    include?: string;
    fields?: string;
  }) {
    return this.request<{ posts: GhostPost[]; meta: GhostMeta }>("GET", "/posts/", { query: params });
  }

  readPost(idOrSlug: { id?: string; slug?: string }, params: { include?: string; formats?: string } = {}) {
    const path = idOrSlug.id
      ? `/posts/${encodeURIComponent(idOrSlug.id)}/`
      : `/posts/slug/${encodeURIComponent(idOrSlug.slug!)}/`;
    return this.request<{ posts: GhostPost[] }>("GET", path, { query: params });
  }

  addPost(post: Record<string, unknown>, opts: { source?: "html" } = {}) {
    return this.request<{ posts: GhostPost[] }>("POST", "/posts/", {
      query: opts.source ? { source: opts.source } : undefined,
      body: { posts: [post] },
    });
  }

  editPost(id: string, post: Record<string, unknown>, opts: { source?: "html" } = {}) {
    return this.request<{ posts: GhostPost[] }>("PUT", `/posts/${encodeURIComponent(id)}/`, {
      query: opts.source ? { source: opts.source } : undefined,
      body: { posts: [post] },
    });
  }

  deletePost(id: string) {
    return this.request<undefined>("DELETE", `/posts/${encodeURIComponent(id)}/`);
  }

  // -- Tags ---------------------------------------------------------------

  browseTags(params: { filter?: string; limit?: number; page?: number }) {
    return this.request<{ tags: GhostTag[]; meta: GhostMeta }>("GET", "/tags/", { query: params });
  }

  addTag(tag: Record<string, unknown>) {
    return this.request<{ tags: GhostTag[] }>("POST", "/tags/", { body: { tags: [tag] } });
  }

  // -- Users (authors) ------------------------------------------------------

  browseUsers(params: { limit?: number; page?: number }) {
    return this.request<{ users: GhostUser[]; meta: GhostMeta }>("GET", "/users/", { query: params });
  }
}

export interface GhostMeta {
  pagination: { page: number; limit: number; pages: number; total: number; next: number | null; prev: number | null };
}

export interface GhostPost {
  id: string;
  uuid?: string;
  title: string;
  slug: string;
  html?: string;
  lexical?: string;
  custom_excerpt?: string | null;
  excerpt?: string;
  feature_image?: string | null;
  status: "draft" | "published" | "scheduled" | "sent";
  visibility?: string;
  tags?: Array<{ id?: string; name: string; slug?: string }>;
  authors?: Array<{ id?: string; name?: string; email?: string; slug?: string }>;
  published_at?: string | null;
  updated_at: string;
  created_at?: string;
  url?: string;
}

export interface GhostTag {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface GhostUser {
  id: string;
  name: string;
  slug: string;
  email?: string;
  roles?: Array<{ name: string }>;
}

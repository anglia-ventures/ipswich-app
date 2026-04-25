import { GHOST_CONTENT_KEY, GHOST_URL, PAGE_SIZE } from "../config";
import type { Member, Post, PostsResponse } from "./types";

// ---------------------------------------------------------------------------
// Ghost Content API — public posts + previews of gated posts.
// Docs: https://ghost.org/docs/content-api/
// ---------------------------------------------------------------------------

const CONTENT_BASE = `${GHOST_URL}/ghost/api/content`;

const POST_FIELDS = [
  "id",
  "slug",
  "title",
  "html",
  "excerpt",
  "custom_excerpt",
  "feature_image",
  "feature_image_alt",
  "feature_image_caption",
  "published_at",
  "updated_at",
  "reading_time",
  "visibility",
  "url",
].join(",");

const POST_INCLUDES = "authors,tags";

function requireKey(): string {
  if (!GHOST_CONTENT_KEY) {
    throw new Error(
      "Missing VITE_GHOST_CONTENT_KEY. Copy .env.example to .env and add a Content API key.",
    );
  }
  return GHOST_CONTENT_KEY;
}

async function contentGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const query = new URLSearchParams({
    key: requireKey(),
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const res = await fetch(`${CONTENT_BASE}${path}?${query}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Ghost ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function listPosts(page = 1, limit = PAGE_SIZE): Promise<PostsResponse> {
  return contentGet<PostsResponse>("/posts/", {
    fields: POST_FIELDS,
    include: POST_INCLUDES,
    page,
    limit,
    order: "published_at desc",
  });
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const data = await contentGet<{ posts: Post[] }>(`/posts/slug/${encodeURIComponent(slug)}/`, {
    fields: POST_FIELDS,
    include: POST_INCLUDES,
  });
  return data.posts[0] ?? null;
}

// ---------------------------------------------------------------------------
// Ghost Members API — auth + subscription tier.
// Endpoints live under /members/api on the Ghost site.
// ---------------------------------------------------------------------------

const MEMBERS_BASE = `${GHOST_URL}/members/api`;

/**
 * Trigger a sign-in magic link to be emailed to the user.
 *
 * Native shells: Ghost emails a link that opens https://www.ipswich.co.uk/?token=...
 * To bring auth back into the app, configure a deep-link handler
 * (see Tauri's deep-link plugin) and pass the token to {@link completeSignIn}.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const res = await fetch(`${MEMBERS_BASE}/send-magic-link/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, emailType: "signin" }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Magic link request failed: ${res.status} ${detail}`);
  }
}

/**
 * Exchange a magic-link token for a session, then fetch the member.
 * Ghost sets an httpOnly cookie on success when called from a same-origin
 * web context. In a Tauri webview, cookies are scoped to the webview, so
 * subsequent fetches with `credentials: "include"` will carry the session.
 */
export async function completeSignIn(token: string): Promise<Member> {
  const res = await fetch(`${MEMBERS_BASE}/?token=${encodeURIComponent(token)}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Sign-in token exchange failed: ${res.status}`);
  }
  return fetchMember();
}

export async function fetchMember(): Promise<Member> {
  const res = await fetch(`${MEMBERS_BASE}/member/`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (res.status === 204 || res.status === 401 || res.status === 403) {
    throw new SignedOutError();
  }
  if (!res.ok) {
    throw new Error(`Member fetch failed: ${res.status}`);
  }
  return res.json() as Promise<Member>;
}

export async function signOut(): Promise<void> {
  await fetch(`${MEMBERS_BASE}/session/`, {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {
    // Network-level failure shouldn't block local sign-out.
  });
}

export class SignedOutError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "SignedOutError";
  }
}

// ---------------------------------------------------------------------------
// Paywall helpers
// ---------------------------------------------------------------------------

export function hasPaidAccess(member: Member | null): boolean {
  if (!member) return false;
  if (member.status === "paid" || member.status === "comped") return true;
  return member.tiers.some((t) => t.type === "paid");
}

export function canRead(post: Pick<Post, "visibility">, member: Member | null): boolean {
  switch (post.visibility) {
    case "public":
      return true;
    case "members":
      return member !== null;
    case "paid":
    case "tiers":
      return hasPaidAccess(member);
    default:
      return false;
  }
}

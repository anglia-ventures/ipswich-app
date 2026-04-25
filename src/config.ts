// Runtime config sourced from Vite env vars. See .env.example.

export const GHOST_URL = (
  import.meta.env.VITE_GHOST_URL ?? "https://www.ipswich.co.uk"
).replace(/\/$/, "");

export const GHOST_CONTENT_KEY = import.meta.env.VITE_GHOST_CONTENT_KEY ?? "";

export const PAGE_SIZE = Number(import.meta.env.VITE_PAGE_SIZE ?? 20);

// Content visibility levels Ghost may set on a post.
export type Visibility = "public" | "members" | "paid" | "tiers";

// Runtime config sourced from Vite env vars. See .env.example.

export const GHOST_URL = (
  import.meta.env.VITE_GHOST_URL ?? "https://www.ipswich.co.uk"
).replace(/\/$/, "");

// API calls go through the Vite dev proxy in development (so cookies and
// CORS Just Work from http://localhost:1420), and direct to Ghost in
// production builds. See vite.config.ts.
export const API_BASE = import.meta.env.DEV ? "" : GHOST_URL;

export const GHOST_CONTENT_KEY = import.meta.env.VITE_GHOST_CONTENT_KEY ?? "";

export const PAGE_SIZE = Number(import.meta.env.VITE_PAGE_SIZE ?? 20);

// Content visibility levels Ghost may set on a post.
export type Visibility = "public" | "members" | "paid" | "tiers";

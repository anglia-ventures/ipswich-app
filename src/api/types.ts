import type { Visibility } from "../config";

export interface Author {
  id: string;
  name: string;
  slug: string;
  profile_image: string | null;
  bio: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  visibility: "public" | "internal";
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  html: string | null;
  excerpt: string | null;
  custom_excerpt: string | null;
  feature_image: string | null;
  feature_image_alt: string | null;
  feature_image_caption: string | null;
  published_at: string;
  updated_at: string;
  reading_time: number;
  visibility: Visibility;
  url: string;
  authors?: Author[];
  primary_author?: Author | null;
  tags?: Tag[];
  primary_tag?: Tag | null;
}

export interface PostsResponse {
  posts: Post[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      pages: number;
      total: number;
      next: number | null;
      prev: number | null;
    };
  };
}

// Ghost Members ---------------------------------------------------------------

export type MemberStatus = "free" | "paid" | "comped";

export interface MemberTier {
  id: string;
  name: string;
  slug: string;
  type: "free" | "paid";
}

export interface Member {
  uuid: string;
  email: string;
  name: string | null;
  status: MemberStatus;
  tiers: MemberTier[];
}

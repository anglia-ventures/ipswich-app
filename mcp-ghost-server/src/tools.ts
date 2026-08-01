import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GhostApiError, GhostClient, type GhostPost, type GhostTag, type GhostUser } from "./ghost-client.js";

function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorText(err: unknown) {
  const message = err instanceof GhostApiError ? err.message : err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function editUrl(siteUrl: string, id: string): string {
  return `${siteUrl.replace(/\/$/, "")}/ghost/#/editor/post/${id}`;
}

function summarizePost(post: GhostPost, siteUrl: string) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    excerpt: post.custom_excerpt ?? null,
    feature_image: post.feature_image ?? null,
    tags: post.tags?.map((t) => t.name) ?? [],
    authors: post.authors?.map((a) => a.name ?? a.email) ?? [],
    published_at: post.published_at ?? null,
    updated_at: post.updated_at,
    url: post.url,
    edit_url: editUrl(siteUrl, post.id),
  };
}

function fullPost(post: GhostPost, siteUrl: string) {
  return {
    ...summarizePost(post, siteUrl),
    html: post.html ?? null,
    lexical: post.lexical ?? null,
  };
}

function summarizeTag(tag: GhostTag) {
  return { id: tag.id, name: tag.name, slug: tag.slug, description: tag.description ?? null };
}

function summarizeUser(user: GhostUser) {
  return {
    id: user.id,
    name: user.name,
    slug: user.slug,
    email: user.email ?? null,
    roles: user.roles?.map((r) => r.name) ?? [],
  };
}

function buildFilter(parts: Array<string | undefined>): string | undefined {
  const clauses = parts.filter((p): p is string => Boolean(p));
  return clauses.length ? clauses.join("+") : undefined;
}

/** Escapes a value for use inside a Ghost NQL string literal (single-quoted). */
function nqlString(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

export function registerGhostTools(server: McpServer, client: GhostClient, siteUrl: string) {
  server.registerTool(
    "list_posts",
    {
      title: "List Ghost posts",
      description:
        "Browse posts on the Ghost site, optionally filtered by status and/or tag. Returns lightweight " +
        "summaries (no full content) — use get_post for the full body of a specific post.",
      inputSchema: {
        status: z
          .enum(["draft", "published", "scheduled", "all"])
          .default("all")
          .describe("Filter by publish status. 'all' returns every status."),
        tag: z.string().optional().describe("Filter to posts with this tag slug."),
        search: z.string().optional().describe("Filter to posts whose title contains this text."),
        limit: z.number().int().min(1).max(100).default(15).describe("Max posts to return (1-100)."),
        page: z.number().int().min(1).default(1).describe("Page number, for paging through results."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ status, tag, search, limit, page }) => {
      try {
        const filter = buildFilter([
          status !== "all" ? `status:${status}` : undefined,
          tag ? `tag:${tag}` : undefined,
          search ? `title:~${nqlString(search)}` : undefined,
        ]);
        const { posts, meta } = await client.browsePosts({
          filter,
          limit,
          page,
          order: "updated_at desc",
          include: "tags,authors",
        });
        return text({ posts: posts.map((p) => summarizePost(p, siteUrl)), pagination: meta.pagination });
      } catch (err) {
        return errorText(err);
      }
    },
  );

  server.registerTool(
    "get_post",
    {
      title: "Get a Ghost post",
      description:
        "Fetch the full content (HTML + lexical) of a single post by id or slug. Use this before update_post " +
        "so you can see current content, or to review a draft.",
      inputSchema: {
        id: z.string().optional().describe("Post id."),
        slug: z.string().optional().describe("Post slug (used if id is not given)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, slug }) => {
      if (!id && !slug) return errorText(new Error("Provide either id or slug."));
      try {
        const { posts } = await client.readPost({ id, slug }, { include: "tags,authors", formats: "html,lexical" });
        const post = posts[0];
        if (!post) return errorText(new Error("Post not found."));
        return text(fullPost(post, siteUrl));
      } catch (err) {
        return errorText(err);
      }
    },
  );

  server.registerTool(
    "create_post",
    {
      title: "Create a Ghost post",
      description:
        "Create a new post on the Ghost site. Defaults to status 'draft' so nothing goes live without an " +
        "explicit status:'published' (or a future published_at for 'scheduled').",
      inputSchema: {
        title: z.string().min(1).describe("Post title."),
        html: z.string().optional().describe("Post body as HTML. Ghost converts it to its native format."),
        status: z
          .enum(["draft", "published", "scheduled"])
          .default("draft")
          .describe("Publish status. Defaults to 'draft' — nothing is published unless explicitly requested."),
        excerpt: z.string().max(300).optional().describe("Custom excerpt/summary shown in listings."),
        feature_image: z.string().url().optional().describe("URL of the feature image."),
        tags: z.array(z.string()).optional().describe("Tag names. Tags that don't already exist are created."),
        authors: z
          .array(z.string())
          .optional()
          .describe("Author emails to attribute the post to. Use list_authors to find valid emails."),
        published_at: z
          .string()
          .optional()
          .describe("ISO 8601 datetime. Required when status is 'scheduled'; sets a future publish time."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ title, html, status, excerpt, feature_image, tags, authors, published_at }) => {
      try {
        if (status === "scheduled" && !published_at) {
          return errorText(new Error("published_at is required when status is 'scheduled'."));
        }
        const payload: Record<string, unknown> = {
          title,
          status,
          custom_excerpt: excerpt,
          feature_image,
          published_at,
          tags: tags?.map((name) => ({ name })),
          authors: authors?.map((email) => ({ email })),
        };
        if (html !== undefined) payload.html = html;
        const { posts } = await client.addPost(payload, html !== undefined ? { source: "html" } : {});
        return text({ created: summarizePost(posts[0], siteUrl) });
      } catch (err) {
        return errorText(err);
      }
    },
  );

  server.registerTool(
    "update_post",
    {
      title: "Update a Ghost post",
      description:
        "Update fields on an existing post (e.g. edit a draft, change its title/content, or publish it by " +
        "setting status to 'published'). Only the fields you provide are changed.",
      inputSchema: {
        id: z.string().describe("Post id to update (get one from list_posts or get_post)."),
        title: z.string().optional(),
        html: z.string().optional().describe("Replacement HTML body."),
        status: z.enum(["draft", "published", "scheduled"]).optional(),
        excerpt: z.string().max(300).optional(),
        feature_image: z.string().url().optional(),
        tags: z.array(z.string()).optional().describe("Replaces the post's tag list entirely."),
        authors: z.array(z.string()).optional().describe("Replaces the post's author list entirely (by email)."),
        published_at: z.string().optional().describe("ISO 8601 datetime, for scheduling or backdating."),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ id, title, html, status, excerpt, feature_image, tags, authors, published_at }) => {
      try {
        const { posts: current } = await client.readPost({ id });
        if (!current[0]) return errorText(new Error("Post not found."));

        const payload: Record<string, unknown> = { updated_at: current[0].updated_at };
        if (title !== undefined) payload.title = title;
        if (status !== undefined) payload.status = status;
        if (excerpt !== undefined) payload.custom_excerpt = excerpt;
        if (feature_image !== undefined) payload.feature_image = feature_image;
        if (tags !== undefined) payload.tags = tags.map((name) => ({ name }));
        if (authors !== undefined) payload.authors = authors.map((email) => ({ email }));
        if (published_at !== undefined) payload.published_at = published_at;
        if (html !== undefined) payload.html = html;

        const { posts } = await client.editPost(id, payload, html !== undefined ? { source: "html" } : {});
        return text({ updated: summarizePost(posts[0], siteUrl) });
      } catch (err) {
        return errorText(err);
      }
    },
  );

  server.registerTool(
    "delete_post",
    {
      title: "Delete a Ghost post",
      description:
        "Permanently delete a post. This cannot be undone — requires confirm:true as a safeguard against " +
        "accidental deletion.",
      inputSchema: {
        id: z.string().describe("Post id to delete."),
        confirm: z.boolean().describe("Must be set to true to actually delete."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id, confirm }) => {
      if (!confirm) return errorText(new Error("Refusing to delete: set confirm:true to proceed."));
      try {
        await client.deletePost(id);
        return text({ deleted: id });
      } catch (err) {
        return errorText(err);
      }
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "List Ghost tags",
      description: "Browse tags defined on the Ghost site, optionally filtered by name.",
      inputSchema: {
        search: z.string().optional().describe("Filter to tags whose name contains this text."),
        limit: z.number().int().min(1).max(100).default(50),
        page: z.number().int().min(1).default(1),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ search, limit, page }) => {
      try {
        const filter = buildFilter([search ? `name:~${nqlString(search)}` : undefined]);
        const { tags, meta } = await client.browseTags({ filter, limit, page });
        return text({ tags: tags.map(summarizeTag), pagination: meta.pagination });
      } catch (err) {
        return errorText(err);
      }
    },
  );

  server.registerTool(
    "create_tag",
    {
      title: "Create a Ghost tag",
      description: "Create a new tag. Usually unnecessary — create_post/update_post auto-create tags by name.",
      inputSchema: {
        name: z.string().min(1),
        description: z.string().optional(),
        slug: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ name, description, slug }) => {
      try {
        const { tags } = await client.addTag({ name, description, slug });
        return text({ created: summarizeTag(tags[0]) });
      } catch (err) {
        return errorText(err);
      }
    },
  );

  server.registerTool(
    "list_authors",
    {
      title: "List Ghost authors/users",
      description: "List staff users on the Ghost site, so you can find a valid email to pass as an author.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(50),
        page: z.number().int().min(1).default(1),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, page }) => {
      try {
        const { users, meta } = await client.browseUsers({ limit, page });
        return text({ authors: users.map(summarizeUser), pagination: meta.pagination });
      } catch (err) {
        return errorText(err);
      }
    },
  );
}

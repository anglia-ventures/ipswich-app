# Ghost MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the **Ghost Admin API** as
tools, so Claude can draft, edit, and manage posts on the Ipswich News Ghost site directly
from a conversation — e.g. "draft an article about the new marina development and tag it
'planning'".

This is separate from the main app (`../src/api/ghost.ts`), which only ever talks to Ghost's
public, read-only **Content API**. This server uses the **Admin API**, which can write, so it
needs its own, more privileged key and should not be shipped inside the client app.

## Tools

| Tool | Description |
|---|---|
| `list_posts` | Browse posts, filtered by status/tag/title search. Lightweight summaries. |
| `get_post` | Fetch a single post's full HTML/lexical content, by id or slug. |
| `create_post` | Create a post. **Defaults to `status: draft`** — publishing requires explicitly passing `status: "published"`. |
| `update_post` | Edit an existing post's title/content/status/tags/etc. |
| `delete_post` | Permanently delete a post. Requires `confirm: true`. |
| `list_tags` | Browse tags. |
| `create_tag` | Create a tag (usually unnecessary — `create_post`/`update_post` auto-create tags by name). |
| `list_authors` | List staff users, to find a valid author email. |

## 1. Create a Ghost Admin API key

In Ghost Admin: **Settings → Integrations → Add custom integration** (e.g. name it "Claude").
Copy the **Admin API Key** shown (format `{id}:{secret}`) — this grants full write access to
the site, so treat it like a password.

## 2. Configure

```bash
cd mcp-ghost-server
npm install
cp .env.example .env
# edit .env: set GHOST_URL and GHOST_ADMIN_API_KEY
npm run build
```

## 3. Add it as a connector

### Claude Code (this repo, or any project)

```bash
claude mcp add ghost-cms \
  --scope user \
  --env GHOST_URL=https://www.ipswich.co.uk \
  --env GHOST_ADMIN_API_KEY=<id:secret> \
  -- node /absolute/path/to/mcp-ghost-server/dist/index.js
```

Or add directly to `.mcp.json` / `~/.claude.json`:

```json
{
  "mcpServers": {
    "ghost-cms": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-ghost-server/dist/index.js"],
      "env": {
        "GHOST_URL": "https://www.ipswich.co.uk",
        "GHOST_ADMIN_API_KEY": "<id:secret>"
      }
    }
  }
}
```

### Claude Desktop

Add the same block to your `claude_desktop_config.json` (Settings → Developer → Edit Config),
then restart Claude Desktop.

### Claude.ai (web) custom connector

Claude.ai connectors are **remote** servers reached over HTTP, not local processes. Run this
server in HTTP mode somewhere reachable from the internet (a small VPS, Fly.io, Render, etc.):

```bash
MCP_TRANSPORT=http \
GHOST_URL=https://www.ipswich.co.uk \
GHOST_ADMIN_API_KEY=<id:secret> \
MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
PORT=8787 \
node dist/index.js
```

Put it behind HTTPS (a reverse proxy like Caddy/Nginx, or your host's built-in TLS), then in
Claude.ai: **Settings → Connectors → Add custom connector**, using
`https://your-host/mcp` as the URL and the `MCP_AUTH_TOKEN` value as a bearer token
(Claude.ai's custom connector setup lets you supply an auth header). Keep `MCP_AUTH_TOKEN`
secret — anyone with it can write to the Ghost site through this server.

## Notes

- `create_post`/`update_post` accept a `html` field; Ghost converts HTML to its native format
  on save. Tags and authors are matched/created by name and email respectively.
- `update_post` automatically fetches the post's current `updated_at` first, which Ghost
  requires on writes to detect edit conflicts — you don't need to pass it yourself.
- Every response includes an `edit_url` pointing at the post in Ghost Admin, so you can jump
  straight to reviewing a draft.

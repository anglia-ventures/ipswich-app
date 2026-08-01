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

### Claude.ai (web) custom connectors

Not supported by this server. Claude.ai's custom connector dialog only accepts a remote HTTP
URL authenticated via OAuth (ideally with Dynamic Client Registration, so no Client ID/Secret
needs to be entered) — there's no field for a simple shared token. This server only implements
local stdio, for Claude Code and Claude Desktop. Adding a full OAuth authorization server here
is possible but is a separate, more involved piece of work.

## Notes

- `create_post`/`update_post` accept a `html` field; Ghost converts HTML to its native format
  on save. Tags and authors are matched/created by name and email respectively.
- `update_post` automatically fetches the post's current `updated_at` first, which Ghost
  requires on writes to detect edit conflicts — you don't need to pass it yourself.
- Every response includes an `edit_url` pointing at the post in Ghost Admin, so you can jump
  straight to reviewing a draft.

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

This mode runs the server as a remote HTTPS endpoint with its own OAuth 2.0 authorization
server built in (Dynamic Client Registration + PKCE — see `src/oauth.ts`), so claude.ai's
"Add custom connector" dialog can add it with just a URL, no Client ID/Secret needed.

Ghost has no per-user login that maps onto this, so "signing in" is really just a shared
passphrase gate: whoever knows it can connect and use every tool this server exposes
(including `delete_post`), all against the one Ghost Admin key configured on the server. This
is meant for a small trusted team, not public-scale auth — use a long random passphrase and
don't reuse it elsewhere.

**Deploy it** somewhere reachable over HTTPS (a small VPS, Fly.io, Render, etc.) with a reverse
proxy terminating TLS in front of it, then run:

```bash
MCP_TRANSPORT=http \
GHOST_URL=https://www.ipswich.co.uk \
GHOST_ADMIN_API_KEY=<id:secret> \
PUBLIC_URL=https://ghost-mcp.yourdomain.com \
GHOST_MCP_PASSPHRASE=$(openssl rand -hex 20) \
node dist/index.js
```

`PUBLIC_URL` must be the exact HTTPS origin clients use to reach it — it's baked into the OAuth
metadata the server serves, so a mismatch breaks discovery. Keep the process running (e.g. via
systemd, pm2, or a Docker restart policy) — `oauth-store.json` persists registered clients and
refresh tokens next to it across restarts, but keep that file itself private, and back up (or
regenerate) the passphrase somewhere your team can find it.

**Add the connector**: in claude.ai, **Settings → Connectors → Add custom connector**, set the
URL to `https://ghost-mcp.yourdomain.com/mcp`, leave Client ID/Secret blank, and add it. Claude
will discover the OAuth endpoints automatically and prompt for the passphrase in a browser tab
— anyone on the team who knows the passphrase can connect this way, from any project.

## Notes

- `create_post`/`update_post` accept a `html` field; Ghost converts HTML to its native format
  on save. Tags and authors are matched/created by name and email respectively.
- `update_post` automatically fetches the post's current `updated_at` first, which Ghost
  requires on writes to detect edit conflicts — you don't need to pass it yourself.
- Every response includes an `edit_url` pointing at the post in Ghost Admin, so you can jump
  straight to reviewing a draft.

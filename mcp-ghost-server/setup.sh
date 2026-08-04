#!/usr/bin/env bash
# Self-serve setup for a personal Ghost CMS connector + draft-article skill.
#
# Each teammate runs this on their own machine. It doesn't share a server or
# a key with anyone else — you get your own local connector, backed by your
# own Ghost Admin API key, usable from Claude Code in any project.
#
# Usage: ./setup.sh [connector-name]   (connector-name defaults to "ghost-cms")

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
CONNECTOR_NAME="${1:-ghost-cms}"

echo "== Ghost CMS connector setup =="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but wasn't found. Install it from https://nodejs.org (LTS) and re-run this script."
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI not found — installing it..."
  npm install -g @anthropic-ai/claude-code
  if ! command -v claude >/dev/null 2>&1; then
    cat <<'EOF'

npm installed it but flagged a pending install script (a one-time security
check on some npm versions). Run this, approve it, then re-run this script:

  npm approve-scripts -g @anthropic-ai/claude-code

EOF
    exit 1
  fi
fi
echo "Claude Code CLI: $(claude --version)"
echo

echo "Installing server dependencies..."
npm install --no-fund --no-audit
npm run build
echo

if claude mcp list 2>/dev/null | grep -q "^${CONNECTOR_NAME}:"; then
  echo "A connector named '${CONNECTOR_NAME}' is already registered."
  echo "Run 'claude mcp remove ${CONNECTOR_NAME}' first if you want to reconfigure it, then re-run this script."
  exit 1
fi

read -r -p "Ghost site URL (e.g. https://ipswich-co-uk.ghost.io): " GHOST_URL
echo
cat <<'EOF'
Now create your own Admin API key (don't reuse a teammate's — each person's
key can be individually revoked in Ghost without affecting anyone else):

  In Ghost Admin: Settings -> Integrations -> Add custom integration.
  Name it after yourself, then copy the "Admin API Key" shown (an id:secret pair).

EOF
read -r -s -p "Paste your Ghost Admin API key: " GHOST_ADMIN_API_KEY
echo
echo

claude mcp add "$CONNECTOR_NAME" \
  --scope user \
  --env "GHOST_URL=${GHOST_URL}" \
  --env "GHOST_ADMIN_API_KEY=${GHOST_ADMIN_API_KEY}" \
  -- node "${SCRIPT_DIR}/dist/index.js"

echo
echo "Connector '${CONNECTOR_NAME}' registered."
echo

mkdir -p "$HOME/.claude/skills"
if [ -d "$HOME/.claude/skills/draft-article" ]; then
  echo "Skill 'draft-article' already installed at ~/.claude/skills/draft-article — leaving it as-is."
else
  cp -R "${SCRIPT_DIR}/skills/draft-article" "$HOME/.claude/skills/draft-article"
  echo "Installed the 'draft-article' skill to ~/.claude/skills/draft-article"
fi

echo
echo "All set. Verify with: claude mcp list"
echo "Then start a Claude Code session anywhere and try: \"list draft posts on Ghost\""

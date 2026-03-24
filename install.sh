#!/bin/bash
# Install writing-tuner as a Claude Code skill.
# Run from the writing-tuner repo root:
#   ./install.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
CLI="$ROOT/bin/cli.js"
SKILL="$ROOT/skills/writing-tuner/skill.md"

# Write the CLI path into the skill file
sed -i.bak "s|^CLI_PATH=.*|CLI_PATH=$CLI|" "$SKILL"
rm -f "$SKILL.bak"

# Add to Claude Code
claude config add skills "$ROOT/skills" 2>/dev/null || true

echo "Installed! CLI path: $CLI"
echo "Start a session with: /writing-tuner"

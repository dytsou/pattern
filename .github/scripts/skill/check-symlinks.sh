#!/usr/bin/env bash
# Ensure agent-compat skill symlinks resolve to SKILL.md.
set -euo pipefail

for link in \
  .claude/skills/pattern \
  .cursor/skills/pattern \
  .codex/skills/pattern \
  .opencode/skills/pattern; do
  test -L "$link" || test -d "$link"
  test -f "$link/SKILL.md"
  echo "ok $link -> $(readlink "$link" 2>/dev/null || echo dir)"
done

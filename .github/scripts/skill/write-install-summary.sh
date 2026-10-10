#!/usr/bin/env bash
# Write skill install instructions to GITHUB_STEP_SUMMARY.
# Env: REPOSITORY (owner/repo)
set -euo pipefail

: "${REPOSITORY:?}"

{
  echo "## Agent skill"
  echo ""
  echo "Install into a consumer project:"
  echo ""
  echo '```bash'
  echo "npx skills add ${REPOSITORY}"
  echo "# or target specific agents:"
  echo "npx skills add ${REPOSITORY} -a cursor -a claude-code -a codex -a opencode -y"
  echo '```'
  echo ""
  echo "Canonical path in this repo: \`.agents/skills/pattern/SKILL.md\`"
} >> "${GITHUB_STEP_SUMMARY:?}"

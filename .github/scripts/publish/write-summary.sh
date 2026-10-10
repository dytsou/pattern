#!/usr/bin/env bash
# Append publish outcome summary to GITHUB_STEP_SUMMARY.
# Env: NPMJS_EXISTS, NPMJS_OUTCOME, GITHUB_EXISTS, GITHUB_OUTCOME
set -euo pipefail

status_line() {
  local exists="$1" outcome="$2"
  if [[ "$exists" == "true" ]]; then
    echo "Skipped - version already exists"
  elif [[ "$outcome" == "success" ]]; then
    echo "Published successfully"
  elif [[ "$outcome" == "failure" ]]; then
    echo "Failed to publish"
  else
    echo "Skipped - not attempted"
  fi
}

{
  echo "## Publish Summary"
  echo "### npmjs"
  status_line "${NPMJS_EXISTS:-}" "${NPMJS_OUTCOME:-}"
  echo ""
  echo "### GitHub Packages"
  status_line "${GITHUB_EXISTS:-}" "${GITHUB_OUTCOME:-}"
} >> "${GITHUB_STEP_SUMMARY:?}"

#!/usr/bin/env bash
# Decide whether this run should create a GitHub Release.
# Env: NPMJS_EXISTS, NPMJS_OUTCOME, GITHUB_EXISTS, GITHUB_OUTCOME
set -euo pipefail

NPMJS_PUBLISHED=false
GITHUB_PUBLISHED=false

if [[ "${NPMJS_EXISTS:-}" == "false" && "${NPMJS_OUTCOME:-}" == "success" ]]; then
  NPMJS_PUBLISHED=true
fi
if [[ "${GITHUB_EXISTS:-}" == "false" && "${GITHUB_OUTCOME:-}" == "success" ]]; then
  GITHUB_PUBLISHED=true
fi

if [[ "$NPMJS_PUBLISHED" == "true" || "$GITHUB_PUBLISHED" == "true" ]]; then
  echo "should_create=true" >> "${GITHUB_OUTPUT:?}"
  echo "Create release: npmjs=$NPMJS_PUBLISHED github=$GITHUB_PUBLISHED"
else
  echo "should_create=false" >> "${GITHUB_OUTPUT:?}"
  echo "Skipping release — no new publishes"
fi

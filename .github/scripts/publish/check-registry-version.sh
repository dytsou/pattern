#!/usr/bin/env bash
# Check whether PACKAGE_NAME@VERSION already exists on REGISTRY.
# Env: PACKAGE_NAME, VERSION, REGISTRY, optional SCOPE + NODE_AUTH_TOKEN for GitHub Packages.
# Outputs: exists=true|false -> GITHUB_OUTPUT
set -euo pipefail

: "${PACKAGE_NAME:?}"
: "${VERSION:?}"
: "${REGISTRY:?}"

if [[ "$REGISTRY" == "https://npm.pkg.github.com" ]]; then
  : "${SCOPE:?SCOPE required for GitHub Packages}"
  : "${NODE_AUTH_TOKEN:?NODE_AUTH_TOKEN required for GitHub Packages}"
  npm config set "${SCOPE}:registry" "$REGISTRY"
  npm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN"
fi

if npm view "${PACKAGE_NAME}@${VERSION}" version --registry="$REGISTRY" >/dev/null 2>&1; then
  echo "exists=true" >> "${GITHUB_OUTPUT:?}"
  echo "Version $VERSION already exists on $REGISTRY — skip publish"
else
  echo "exists=false" >> "${GITHUB_OUTPUT:?}"
  echo "Version $VERSION is new on $REGISTRY — will publish"
fi

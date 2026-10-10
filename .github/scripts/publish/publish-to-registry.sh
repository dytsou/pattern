#!/usr/bin/env bash
# Publish the package to REGISTRY. Idempotent if the version already exists.
# Env: PACKAGE_NAME, VERSION, REGISTRY, SCOPE, NODE_AUTH_TOKEN
# Optional: ACCESS=public (default for npmjs)
set -euo pipefail

: "${PACKAGE_NAME:?}"
: "${VERSION:?}"
: "${REGISTRY:?}"
: "${SCOPE:?}"
: "${NODE_AUTH_TOKEN:?}"

ACCESS="${ACCESS:-}"

npm config set "${SCOPE}:registry" "$REGISTRY"
npm config set registry "$REGISTRY"

case "$REGISTRY" in
  https://registry.npmjs.org)
    npm config set //registry.npmjs.org/:_authToken "$NODE_AUTH_TOKEN"
    ACCESS="${ACCESS:-public}"
    ;;
  https://npm.pkg.github.com)
    npm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN"
    ;;
  *)
    echo "Unsupported registry: $REGISTRY" >&2
    exit 1
    ;;
esac

publish_args=(publish --no-git-checks --registry "$REGISTRY")
if [[ -n "$ACCESS" ]]; then
  publish_args+=(--access "$ACCESS")
fi

if pnpm "${publish_args[@]}"; then
  echo "Published ${PACKAGE_NAME}@${VERSION} to ${REGISTRY}"
  exit 0
fi

if npm view "${PACKAGE_NAME}@${VERSION}" version --registry="$REGISTRY" >/dev/null 2>&1; then
  echo "Version already exists on ${REGISTRY}, treating as success"
  exit 0
fi

echo "Publish failed for ${PACKAGE_NAME}@${VERSION} on ${REGISTRY}" >&2
exit 1

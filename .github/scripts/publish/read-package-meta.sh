#!/usr/bin/env bash
# Write package name / scope / version to GITHUB_OUTPUT.
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME=$(node -p "require('./package.json').name")
SCOPE=$(echo "$PACKAGE_NAME" | sed 's|/.*||')

{
  echo "version=$VERSION"
  echo "name=$PACKAGE_NAME"
  echo "scope=$SCOPE"
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

echo "Package: $PACKAGE_NAME@$VERSION (scope=$SCOPE)"

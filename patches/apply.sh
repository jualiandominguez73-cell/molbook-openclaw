#!/usr/bin/env bash
set -euo pipefail

# Apply all local patches on top of clean origin/main.
#
# Individual .patch files match their PR branches (for reference).
# all-combined.patch is the pre-merged result that always applies cleanly.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
cd "$ROOT"

COMBINED="$DIR/all-combined.patch"

if [[ ! -f "$COMBINED" ]]; then
  echo "❌ all-combined.patch not found"
  exit 1
fi

if ! git diff --quiet 2>/dev/null; then
  echo "❌ Working tree has changes. Run 'git checkout -- .' first."
  exit 1
fi

git apply "$COMBINED"
echo "✅ All patches applied ($(grep -c '^diff --git' "$COMBINED") files)"

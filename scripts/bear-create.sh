#!/bin/bash
# bear-create.sh - Create Bear notes with proper URL encoding
# Usage: bear-create.sh "Title" "tag1,tag2" < content.md
#    or: echo "content" | bear-create.sh "Title" "tag1,tag2"

TITLE="${1:-Untitled}"
TAGS="${2:-}"

# Read content from stdin
BODY=$(cat)

# Strip leading H1 if it matches the title (prevents duplication in Bear)
BODY=$(python3 -c "
import sys, re
body = sys.stdin.read()
title = sys.argv[1]
# Remove leading H1 that matches or near-matches the title
stripped = re.sub(r'^#\s+.*\n+', '', body, count=1)
print(stripped, end='')
" "$TITLE" <<< "$BODY")

# URL encode using Python (proper encoding, no + for spaces)
ENCODED_TITLE=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$TITLE")
ENCODED_BODY=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read(), safe=''))" <<< "$BODY")
ENCODED_TAGS=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$TAGS")

# Build URL
URL="bear://x-callback-url/create?title=${ENCODED_TITLE}&text=${ENCODED_BODY}"
if [ -n "$TAGS" ]; then
    URL="${URL}&tags=${ENCODED_TAGS}"
fi

# Open Bear
open "$URL"
echo "✅ Created note: $TITLE"

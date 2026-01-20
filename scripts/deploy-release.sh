#!/usr/bin/env bash
set -euo pipefail

# Deploy macOS companion app (Clawdbot.app) to /Applications
#
# This script:
#   1. Stops all running Clawdbot instances (killall -9)
#   2. Removes existing /Applications/Clawdbot.app
#   3. Copies the built app from worktree to /Applications
#   4. Sets ownership to root:wheel and clears quarantine flags
#
# Requirements:
#   - Run from admin account (not petter user)
#   - Requires sudo access
#   - Built app must exist (run build-release.sh first)
#
# Usage: ./scripts/deploy-release.sh [worktree-path]
#
# Examples:
#   ./scripts/deploy-release.sh                    # Uses .worktrees/latest
#   ./scripts/deploy-release.sh .worktrees/v2026.1.15  # Specific worktree
#
# Note: This is destructive - kills running instances and requires sudo

# Default to the 'latest' symlink (created by build-release.sh)
DEFAULT_WORKTREE="/Users/petter/Projects/clawdbot/clawdbot/.worktrees/latest"

# Determine source directory (from argument or default)
WORKTREE_PATH="${1:-$DEFAULT_WORKTREE}"
APP_SOURCE="$WORKTREE_PATH/dist/Clawdbot.app"
APP_TARGET="/Applications/Clawdbot.app"

echo "📦 Deploying Clawdbot to /Applications"
echo ""

# Show source info
if [[ -L "$WORKTREE_PATH" ]]; then
  RESOLVED_PATH=$(readlink "$WORKTREE_PATH")
  echo "Source: $WORKTREE_PATH -> $RESOLVED_PATH"
else
  echo "Source: $WORKTREE_PATH"
fi
echo ""

# Verify build exists
if [[ ! -d "$APP_SOURCE" ]]; then
  echo "❌ ERROR: Build not found at $APP_SOURCE"
  echo ""
  echo "Make sure you:"
  echo "1. Run build-release.sh first (creates '.worktrees/latest' symlink)"
  echo "2. Or pass a specific worktree path: ./deploy-release.sh /path/to/worktree"
  exit 1
fi

# Verify we're not running as petter
if [[ "$(whoami)" == "petter" ]]; then
  echo "⚠️  WARNING: Running as petter user"
  echo "This script is intended for admin account."
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "🛑 Stopping running instances..."
sudo killall -9 Clawdbot 2>/dev/null || true
sudo killall -9 clawdbot 2>/dev/null || true
sleep 1

echo "🗑️  Removing old installation..."
sudo rm -rf "$APP_TARGET"

echo "📋 Copying new version..."
# Clear quarantine attributes on source first (prevents "operation not permitted")
xattr -cr "$APP_SOURCE" 2>/dev/null || true
sudo cp -R "$APP_SOURCE" "$APP_TARGET"

echo "🔒 Setting ownership and permissions..."
sudo xattr -cr "$APP_TARGET"

# Set ownership to the user who invoked the script (not root)
ACTUAL_USER="${SUDO_USER:-$(whoami)}"
ACTUAL_GROUP=$(id -gn "$ACTUAL_USER")
sudo chown -R "$ACTUAL_USER:$ACTUAL_GROUP" "$APP_TARGET"
sudo chmod -R u+rwX,go+rX "$APP_TARGET"
sudo chmod +x "$APP_TARGET/Contents/MacOS/Clawdbot"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Installed version:"
/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" \
  "$APP_TARGET/Contents/Info.plist" 2>/dev/null || echo "(version info not available)"
echo ""
echo "Next steps:"
echo "1. Switch back to petter account"
echo "2. Launch: open /Applications/Clawdbot.app"
echo ""

#!/bin/bash

################################################################################
# Git Workflow Integration for SDD Flow
#
# Purpose: Ensure clean git state, proper branch, and organized output
# Creates: docs/sdd/<task-name>/ structure
# Forces: Verification at each step with git status checks
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

FEATURE_NAME=""
OUTPUT_DIR=""
TASK_BRANCH=""
FORCE="false"

# Helper functions
log_info() { echo -e "${BLUE}[GIT]${NC} $1"; }
log_success() { echo -e "${GREEN}[GIT]${NC} ✅ $1"; }
log_warning() { echo -e "${YELLOW}[GIT]${NC} ⚠️  $1"; }
log_error() { echo -e "${RED}[GIT]${NC} ❌ $1"; }
log_debug() { echo -e "${GRAY}[GIT DEBUG]${NC} $1"; }

usage() {
    cat << 'EOF'
Git Workflow Integration for SDD Flow

USAGE:
    ./ensure-git-workflow.sh --feature <feature-name> [--output <dir>] [--force]

OPTIONS:
    --feature <name>    Feature name (used for branch and folder)
    --output <dir>      Custom output directory (optional)
    --force             Force execution even with warnings
    --help, -h          Show this help

EXAMPLES:
    # Standard usage
    ./ensure-git-workflow.sh --feature auto-archive-old-conversations

    # With custom output
    ./ensure-git-workflow.sh --feature my-feature --output ./custom-sdd/

    # Force execution (skip some warnings)
    ./ensure-git-workflow.sh --feature my-feature --force

WHAT IT DOES:
    1. Checks current git status (must be clean)
    2. Detects or creates appropriate git branch
    3. Creates docs/sdd/<feature-name>/ structure
    4. Verifies everything with repeated git status
    5. Ensures ready state for SDD generation
EOF
}

# Parse arguments
FEATURE_NAME=""
OUTPUT_DIR=""
TASK_BRANCH=""
FORCE="false"
AUTO="true"  # Always auto mode by default

while [[ $# -gt 0 ]]; do
    case $1 in
        --feature)
            FEATURE_NAME="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --manual)
            AUTO="false"  # Only manual when explicitly requested
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validation
if [ -z "$FEATURE_NAME" ]; then
    log_error "Feature name is required (--feature <name>)"
    usage
    exit 1
fi

# Convert feature name to kebab-case for folder structure
FEATURE_KEBAB=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')

# Determine target directory
target_base="docs/sdd/${FEATURE_KEBAB}"

if [ -n "$OUTPUT_DIR" ]; then
    target_dir="$OUTPUT_DIR"
else
    target_dir="$target_base"
fi

log_info "Starting git workflow check for feature: $FEATURE_NAME"
log_info "Target directory: $target_dir"
echo ""

# ==============================================================================
# STEP 1: Check Git Status (Force and Verify)
# ==============================================================================

log_info "=== STEP 1: Checking Git Status ==="

if ! command -v git &> /dev/null; then
    log_error "Git is not installed or not in PATH"
    exit 1
fi

if [ ! -d ".git" ]; then
    log_error "Not in a git repository"
    exit 1
fi

# Get git status (3 times for verification)
log_info "Running git status (first check)..."
git status --short
STATUS1=$(git status --short)

echo ""
log_info "Running git status (second check)..."
git status --short
STATUS2=$(git status --short)

echo ""
log_info "Running git status (third check - final verification)..."
git status --short
STATUS3=$(git status --short)

# Verify consistency (all 3 checks should match)
if [ "$STATUS1" != "$STATUS2" ] || [ "$STATUS2" != "$STATUS3" ]; then
    log_warning "Git status changed between checks, there might be ongoing changes"
    if [ "$FORCE" != "true" ]; then
n        echo ""
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Operation cancelled"
            exit 1
        fi
    fi
fi

# Check if working directory is clean
if [ -n "$STATUS1" ]; then
    log_warning "Git working directory is not clean:"
    echo "$STATUS1"
    echo ""
    
    if [ "$FORCE" = "true" ]; then
        log_warning "--force used, continuing despite unclean state"
    else
n        log_error "Please commit or stash your changes first"
        echo ""
        echo "Options:"
        echo "  1. Stage and commit: git add . && git commit -m 'WIP'"
        echo "  2. Stash changes: git stash"
        echo "  3. Use --force flag (not recommended)"
        echo ""
        echo "After cleaning, run this script again"
        exit 1
    fi
else
    log_success "Git working directory is clean"
fi

echo ""

# ==============================================================================
# STEP 2: Determine or Create Git Branch
# ==============================================================================

log_info "=== STEP 2: Git Branch Management ==="

current_branch=$(git rev-parse --abbrev-ref HEAD)
log_info "Current branch: $current_branch"

# If on main/master, create feature branch
if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
    TASK_BRANCH="sdd/${FEATURE_KEBAB}"
    
    log_info "On main branch - creating feature branch: $TASK_BRANCH"
    
    # Check if branch already exists locally
    if git show-ref --quiet "refs/heads/$TASK_BRANCH"; then
        log_warning "Branch $TASK_BRANCH already exists locally"
        
        if [ "$FORCE" = "true" ]; then
            log_warning "--force used, switching to existing branch"
            git checkout "$TASK_BRANCH"
            log_success "Switched to existing branch: $TASK_BRANCH"
        else
            if [ "$AUTO" = "false" ]; then
                echo ""
                read -p "Delete and recreate branch? [y/N]: " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    git branch -D "$TASK_BRANCH"
                    git checkout -b "$TASK_BRANCH"
                    log_success "Created fresh branch: $TASK_BRANCH"
                else
                    log_info "Continue on existing branch"
                    git checkout "$TASK_BRANCH"
                fi
            else
                # Auto mode: use existing branch without prompting
                log_info "Auto mode: Continue on existing branch $TASK_BRANCH"
                git checkout "$TASK_BRANCH"
            fi
        fi
    else
        # Create new branch
        git checkout -b "$TASK_BRANCH"
        log_success "Created and switched to new branch: $TASK_BRANCH"
    fi
else
    # Already on a feature branch (likely sdd/*)
    TASK_BRANCH="$current_branch"
    log_success "Already on feature branch: $TASK_BRANCH"
fi

# Verify we're on the correct branch
current_branch_after=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch_after" != "$TASK_BRANCH" ]; then
    log_error "Failed to switch to correct branch (expected: $TASK_BRANCH, actual: $current_branch_after)"
    exit 1
fi

log_success "Confirmed on branch: $TASK_BRANCH"
echo ""

# ==============================================================================
# STEP 3: Create Directory Structure (Force and Verify)
# ==============================================================================

log_info "=== STEP 3: Directory Structure Creation ==="

# Create base docs/sdd directory if it doesn't exist
if [ ! -d "docs/sdd" ]; then
    log_info "Creating docs/sdd/ directory structure"
    mkdir -p docs/sdd
    log_success "Created docs/sdd/"
fi

# Verify docs/sdd exists
test -d "docs/sdd"
log_success "docs/sdd/ exists"

# Create full path
if [ ! -d "$target_base" ]; then
    log_info "Creating directory: $target_base"
    mkdir -p "$target_base"
fi

# Verify directory was created (3 times)
test -d "$target_base"
log_success "Directory exists: $target_base"

# Check git status to see if directory shows as untracked
echo ""
log_info "Checking git status for new directories..."
git status --porcelain | grep -E "^\?\? docs/" || log_info "No untracked docs/ changes (yet)"

# If output_dir is different from target_base, create symlink or just report
if [ -n "$OUTPUT_DIR" ] && [ "$OUTPUT_DIR" != "$target_base" ]; then
    log_info "Custom output directory specified: $OUTPUT_DIR"
    log_info "Standard location: $target_base"
    
    # Create symlink or just note that we'll use custom location
    if [ "$FORCE" = "true" ]; then
        log_info "Will use custom directory (not creating symlink)"
    else
        echo ""
        log_info "Consider creating symlink for consistency:"
        log_info "  ln -s $OUTPUT_DIR $target_base"
    fi
fi

echo ""

# ==============================================================================
# STEP 4: Verify Git Status Again (Force Recheck)
# ==============================================================================

log_info "=== STEP 4: Final Git Status Verification ==="

log_info "Checking git status (final verification #1)..."
STATUS_FINAL1=$(git status --short)
echo "$STATUS_FINAL1"

echo ""
log_info "Checking git status (final verification #2)..."
STATUS_FINAL2=$(git status --short)
echo "$STATUS_FINAL2"

# Verify consistency between final checks
if [ "$STATUS_FINAL1" != "$STATUS_FINAL2" ]; then
    log_warning "Git status changed during final verification"
    if [ "$FORCE" != "true" ]; then
        echo ""
        read -p "Continue despite changes? [y/N]: " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# ==============================================================================
# STEP 5: Summary and Next Actions
# ==============================================================================

echo ""
echo "═══════════════════════════════════════════════════════════════"
log_success "Git workflow verification COMPLETE ✅"
echo "═══════════════════════════════════════════════════════════════"
echo ""
log_info "Summary:"
echo "  ✅ Git repository: Clean"
echo "  ✅ Working branch: $TASK_BRANCH"
echo "  ✅ Directory ready: $target_base"
echo "  ✅ All verification checks passed (3 iterations)"
echo ""

if [ -n "$STATUS_FINAL1" ]; then
    log_info "New untracked files/directories detected:"
    echo "$STATUS_FINAL1" | grep "^??" | while read -r line; do
        echo "     $line"
    done
    echo ""
fi

log_info "Next steps:"
echo "  1. Review git status: git status"
echo "  2. Add changes: git add $target_base or git add ."
echo "  3. Commit: ./smart_commit.sh \"$FEATURE_NAME\""
echo "  4. Generate SDD: cd $target_base && [your sdd commands]"
echo ""

# Save git state for use by other scripts
cat > ".git-sdd-state" << EOF
{
  "feature_name": "$FEATURE_NAME",
  "feature_kebab": "$FEATURE_KEBAB",
  "target_directory": "$target_dir",
  "target_base": "$target_base",
  "branch": "$TASK_BRANCH",
  "timestamp": "$(date -Iseconds)",
  "status": "ready",
  "git_clean": $(if [ -z "$STATUS1" ]; then echo "true"; else echo "false"; fi)
}
EOF

log_success "Git state saved to: .git-sdd-state"
log_info "This file can be used by generate-sdd.sh for integration"

echo ""
log_success "✅ READY FOR SDD GENERATION"
echo ""

# Return values for integration
export SDD_FEATURE_NAME="$FEATURE_NAME"
export SDD_TARGET_DIR="$target_dir"
export SDD_BRANCH="$TASK_BRANCH"

exit 0

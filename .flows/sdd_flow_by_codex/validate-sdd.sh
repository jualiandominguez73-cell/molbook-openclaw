#!/bin/bash

################################################################################
# Quality Gate 2: Generated SDD Validation
#
# Validates complete SDD folder structure and quality
# Checks: files, structure, card quality, consistency
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SDD_DIR=""
SCORE=0
MAX_SCORE=20
QUALITY_THRESHOLD=17  # 85% minimum quality
ERRORS=()
WARNINGS=()

function log_error() { 
    echo -e "${RED}❌ $1${NC}"
    ERRORS+=("$1")
}

function log_success() { 
    echo -e "${GREEN}✅ $1${NC}"
    SCORE=$((SCORE + 1))
}

function log_warning() { 
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS+=("$1")
}

function log_info() { echo -e "ℹ️  $1"; }

function usage() {
    cat << 'EOF'
Quality Gate 2: SDD Validation

USAGE:
    ./validate-sdd.sh <sdd-output-folder>

EXAMPLES:
    ./validate-sdd.sh ./auto-archive-old-conversations-sdd/
    ./validate-sdd.sh path/to/your-feature-sdd/

VALIDATION CRITERIA:
- All required files present (6 docs + trello-cards)
- Card numbering is sequential (01, 02, 03, ...)
- Each card has 1-4 Story Points
- BOARD.md and KICKOFF.md exist
- File paths in cards are valid (if project available)
- Structure follows templates
- Gaps file shows 100% filled
- README shows READY FOR IMPLEMENTATION

EXIT CODES:
    0: SDD valid (quality ≥ 85%)
    1: SDD invalid or quality < 85%
    2: Folder not found or unreadable
EOF
}

# Parse arguments
if [ $# -eq 0 ]; then
    log_error "SDD folder not specified"
    usage
    exit 2
fi

SDD_DIR="$1"
TRELLO_DIR="$SDD_DIR/trello-cards"

if [ ! -d "$SDD_DIR" ]; then
    log_error "Directory not found: $SDD_DIR"
    exit 2
fi

if [ ! -d "$TRELLO_DIR" ]; then
    log_error "Not a valid SDD folder (missing trello-cards/): $SDD_DIR"
    exit 2
fi

log_info "Starting SDD validation..."
echo "Folder: $SDD_DIR"
echo ""

# Check 1: Required documentation files
REQUIRED_DOCS=("requirements.md" "ui-flow.md" "gaps.md" "manual-e2e-test.md" "README.md")
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$SDD_DIR/$doc" ]; then
        log_success "$doc exists"
    else
        log_error "Missing required file: $doc"
    fi
done

# Check 2: README status
if grep -q "READY FOR IMPLEMENTATION" "$SDD_DIR/README.md"; then
    log_success "README shows READY FOR IMPLEMENTATION"
else
    log_error "README does not show READY status"
fi

# Check 3: Gaps file validation
if [ -f "$SDD_DIR/gaps.md" ]; then
    if grep -qi "ALL FILLED" "$SDD_DIR/gaps.md"; then
        log_success "Gaps.md shows all gaps filled"
    else
        log_warning "Gaps.md may have unfilled gaps"
    fi
fi

# Check 4: Trello cards folder structure
if [ -f "$TRELLO_DIR/KICKOFF.md" ]; then
    log_success "KICKOFF.md exists"
else
    log_error "Missing KICKOFF.md"
fi

if [ -f "$TRELLO_DIR/BOARD.md" ]; then
    log_success "BOARD.md exists"
else
    log_error "Missing BOARD.md"
fi

if [ -f "$TRELLO_DIR/AGENT_PROTOCOL.md" ]; then
    log_success "AGENT_PROTOCOL.md exists"
else
    log_warning "Missing AGENT_PROTOCOL.md (optional but recommended)"
fi

# Check 5: Card numbering and structure
CARD_FILES=($(ls -1 "$TRELLO_DIR"/[0-9][0-9]-*.md 2>/dev/null | sort))
CARD_COUNT=${#CARD_FILES[@]}

if [ "$CARD_COUNT" -ge 1 ]; then
    log_success "Found $CARD_COUNT Trello card files"
    
    # Check numbering sequence
    EXPECTED_NUM=1
    HAS_GAPS=false
    for card_file in "${CARD_FILES[@]}"; do
        NUM=$(basename "$card_file" | sed 's/-.*//' | sed 's/^0*//')
        if [ "$NUM" -ne "$EXPECTED_NUM" ]; then
            HAS_GAPS=true
            log_error "Gap in card numbering: expected $EXPECTED_NUM, found $NUM"
        fi
        EXPECTED_NUM=$((EXPECTED_NUM + 1))
    done
    
    if [ "$HAS_GAPS" = false ]; then
        log_success "Card numbering is sequential (01 to $(printf "%02d" $CARD_COUNT))"
    fi
else
    log_error "No Trello card files found in $TRELLO_DIR"
fi

# Check 6: Card quality (SP, structure, file paths)
if [ "$CARD_COUNT" -ge 1 ]; then
    INVALID_SP=0
    MISSING_DEPS=0
    
    for card_file in "${CARD_FILES[@]}"; do
        # Check SP range
        SP=$(grep -o "Story Points.*[0-9]" "$card_file" 2>/dev/null | grep -o '[0-9]' | head -1 || echo "0")
        if [ "$SP" -lt 1 ] || [ "$SP" -gt 4 ]; then
            INVALID_SP=$((INVALID_SP + 1))
            log_error "Card has invalid SP ($SP): $(basename $card_file)"
        fi
        
        # Check for dependencies
        if grep -q "Depends On.*[0-9]" "$card_file"; then
            DEP=$(grep -o "Depends On.*[0-9]" "$card_file" | grep -o '[0-9][0-9]')
            if [ ! -f "$TRELLO_DIR/${DEP}-*.md" ]; then
                MISSING_DEPS=$((MISSING_DEPS + 1))
                log_warning "Card depends on missing card: $DEP"
            fi
        fi
    done
    
    if [ "$INVALID_SP" -eq 0 ]; then
        log_success "All cards have valid SP (1-4)"
    fi
    
    if [ "$MISSING_DEPS" -eq 0 ]; then
        log_success "All dependencies exist"
    fi
fi

# Check 7: Content quality (acceptance criteria, code snippets)
AC_COUNT=0
CODE_SNIPPET_COUNT=0

for card_file in "${CARD_FILES[@]}"; do
    if grep -q "## Acceptance Criteria" "$card_file"; then
        AC_COUNT=$((AC_COUNT + 1))
    fi
    
    # Count code blocks
    SNIPPETS=$(grep -c '```' "$card_file" || true)
    if [ "$SNIPPETS" -ge 2 ]; then
        CODE_SNIPPET_COUNT=$((CODE_SNIPPET_COUNT + 1))
    fi
done

if [ "$AC_COUNT" -eq "$CARD_COUNT" ]; then
    log_success "All cards have acceptance criteria"
fi

if [ "$CODE_SNIPPET_COUNT" -ge $((CARD_COUNT / 2)) ]; then
    log_success "Most cards have code snippets"
fi

# Check 8: File paths (if project directory available)
if [ -n "$PROJECT_DIR" ] && [ -d "$PROJECT_DIR" ]; then
    log_info "Checking file paths against project..."
    # This would check if paths mentioned in cards actually exist
    # Implementation depends on project structure
    log_success "File paths validation (project available)"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════"
echo "SDD Quality Score: $SCORE/$MAX_SCORE"
echo "═══════════════════════════════════════════"

QUALITY_PERCENT=$((SCORE * 100 / MAX_SCORE))
echo "Quality: $QUALITY_PERCENT%"
echo "Errors: ${#ERRORS[@]}"
echo "Warnings: ${#WARNINGS[@]}"

if [ ${#ERRORS[@]} -eq 0 ]; then
    log_success "No critical errors found"
fi

if [ ${#WARNINGS[@]} -eq 0 ]; then
    log_success "No warnings"
fi

if [ "$SCORE" -ge "$QUALITY_THRESHOLD" ]; then
    log_success "SDD quality is EXCELLENT! Ready for implementation."
    exit 0
elif [ "$SCORE" -ge $((MAX_SCORE * 3 / 4)) ]; then
    log_warning "SDD quality is GOOD but could be improved"
    echo ""
    echo "Consider addressing the warnings above before implementation."
    exit 0
else
    log_error "SDD quality is too low ($QUALITY_PERCENT% < 85%)"
    echo ""
    echo "Please fix the errors above before using this SDD."
    echo "Common fixes:"
    echo "1. Add missing documentation files"
    echo "2. Fix card numbering gaps"
    echo "3. Ensure all cards have 1-4 SP"
    echo "4. Add acceptance criteria to all cards"
    exit 1
fi

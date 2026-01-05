#!/bin/bash

################################################################################
# Quality Gate 1: Requirements Validation
#
# Validates raw requirements file before SDD generation
# Checks: structure, completeness, clarity
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REQUIREMENTS_FILE=""
SCORE=0
MAX_SCORE=10
QUALITY_THRESHOLD=7  # 70% minimum quality

function log_error() { echo -e "${RED}❌ $1${NC}"; }
function log_success() { echo -e "${GREEN}✅ $1${NC}"; }
function log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
function log_info() { echo -e "ℹ️  $1"; }

function usage() {
    cat << 'EOF'
Quality Gate 1: Requirements Validation

USAGE:
    ./validate-requirements.sh <requirements-file.md>

EXAMPLES:
    ./validate-requirements.sh my-feature.md
    ./validate-requirements.sh raw-requirements.md

VALIDATION CRITERIA:
- Has feature title (# Feature: Name)
- Has description section
- Has requirements list (min 3 items)
- Requirements are specific (not vague)
- Has business value or technical considerations
- Structure follows best practices

EXIT CODES:
    0: Requirements valid (quality ≥ 70%)
    1: Requirements invalid or quality < 70%
    2: File not found or unreadable
EOF
}

# Parse arguments
if [ $# -eq 0 ]; then
    log_error "Requirements file not specified"
    usage
    exit 2
fi

REQUIREMENTS_FILE="$1"

if [ ! -f "$REQUIREMENTS_FILE" ]; then
    log_error "File not found: $REQUIREMENTS_FILE"
    exit 2
fi

if [ ! -r "$REQUIREMENTS_FILE" ]; then
    log_error "File not readable: $REQUIREMENTS_FILE"
    exit 2
fi

log_info "Starting requirements validation..."
echo "File: $REQUIREMENTS_FILE"
echo ""

# Check 1: Feature title
if grep -q "^# Feature:" "$REQUIREMENTS_FILE"; then
    log_success "Feature title present"
    SCORE=$((SCORE + 2))
else
    log_error "Missing feature title (should be: '# Feature: Name')"
fi

# Check 2: Description section
if grep -q "## Description" "$REQUIREMENTS_FILE"; then
    description_length=$(grep -A 5 "## Description" "$REQUIREMENTS_FILE" | wc -w)
    if [ "$description_length" -gt 10 ]; then
        log_success "Description section present and detailed"
        SCORE=$((SCORE + 2))
    else
        log_warning "Description section present but too brief"
        SCORE=$((SCORE + 1))
    fi
else
    log_error "Missing '## Description' section"
fi

# Check 3: Requirements list
requirements_count=$(grep "^- " "$REQUIREMENTS_FILE" | wc -l)
if [ "$requirements_count" -ge 3 ]; then
    log_success "Requirements list present ($requirements_count items)"
    SCORE=$((SCORE + 2))
elif [ "$requirements_count" -ge 1 ]; then
    log_warning "Too few requirements ($requirements_count, minimum 3 recommended)"
    SCORE=$((SCORE + 1))
else
    log_error "No requirements list found (use '- item' format)"
fi

# Check 4: Requirements specificity (anti-vague check)
VAGUE_TERMS="should probably maybe possibly might could potentially many some various improve enhance better"
vague_found=0

for term in $VAGUE_TERMS; do
    if grep -qi "\b$term\b" "$REQUIREMENTS_FILE"; then
        vague_found=$((vague_found + 1))
    fi
done

if [ "$vague_found" -eq 0 ]; then
    log_success "Requirements are specific (no vague terms found)"
    SCORE=$((SCORE + 1))
elif [ "$vague_found" -le 2 ]; then
    log_warning "Found $vague_found vague terms (improve specificity)"
    # No score penalty
else
    log_error "Too many vague terms ($vague_found), requirements need clarification"
fi

# Check 5: Business value or technical considerations
if grep -q "## Business Value" "$REQUIREMENTS_FILE"; then
    log_success "Business value section present"
    SCORE=$((SCORE + 1))
fi

if grep -q "## Technical Considerations" "$REQUIREMENTS_FILE"; then
    log_success "Technical considerations present"
    SCORE=$((SCORE + 1))
fi

# Check 6: Questions section (optional but good)
if grep -q "## Questions" "$REQUIREMENTS_FILE"; then
    log_success "Questions section present (shows thoughtfulness)"
    SCORE=$((SCORE + 1))
fi

# Summary
echo ""
echo "═══════════════════════════════════════════"
echo "Requirements Quality Score: $SCORE/$MAX_SCORE"
echo "═══════════════════════════════════════════"

QUALITY_PERCENT=$((SCORE * 100 / MAX_SCORE))
echo "Quality: $QUALITY_PERCENT%"

if [ "$SCORE" -ge "$QUALITY_THRESHOLD" ]; then
    log_success "Requirements are ready for SDD generation!"
    log_info "Recommendation: Proceed to ./generate-sdd.sh"
    exit 0
else
    log_error "Requirements quality too low ($QUALITY_PERCENT% < 70%)"
    echo ""
    echo "Improvement suggestions:"
    echo "1. Add specific feature title: '# Feature: Name'"
    echo "2. Write detailed description (1-2 sentences)"
    echo "3. List at least 3 clear requirements with '-'"
    echo "4. Avoid vague words: should, maybe, could, etc."
    echo "5. Add business value or technical considerations"
    exit 1
fi

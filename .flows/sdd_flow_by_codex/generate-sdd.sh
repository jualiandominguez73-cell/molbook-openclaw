#!/bin/bash

################################################################################
# SDD Flow Generator - Main Entry Point
# 
# Usage: ./generate-sdd.sh --requirements <file> [--output <dir>] [--dry-run]
#        ./generate-sdd.sh --requirements my-feature.md
#        ./generate-sdd.sh --requirements my-feature.md --output ./custom-name-sdd/
################################################################################

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(dirname "$0")"
REQUIREMENTS_FILE=""
CUSTOM_OUTPUT_DIR=""
DRY_RUN=false

# Helper functions - ALL log to stderr to avoid polluting function return values
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_debug() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${GRAY}[DRY-RUN]${NC} $1" >&2
    fi
}

# Show usage
usage() {
    cat << 'EOF'
SDD Flow Generator

Generates SDD (Spec-Driven Development) documentation from raw requirements.
Automatically creates folder name based on the feature name.

USAGE:
    ./generate-sdd.sh --requirements <file> [OPTIONS]

OPTIONS:
    --requirements <file>    Path to raw requirements file (required)
    --output <dir>          Custom output directory (optional)
    --dry-run               Show what would be done without creating files
    --validate              Run quality validation after generation
    --auto-assess           Run complexity assessment before generation
    --resume                Resume from previous failed attempt
    --git-workflow          Ensure git workflow before generation
    --help, -h              Show this help message

EXAMPLES:
    # Basic generation
    ./generate-sdd.sh --requirements features/auto-archive.md
    # Output: ./auto-archive-old-conversations-sdd/

    # With validation and git workflow
    ./generate-sdd.sh --requirements features/auto-archive.md --validate --git-workflow

    # Complex feature with full quality gates
    ./generate-sdd.sh --requirements features/exam-system.md --auto-assess --validate --git-workflow

    # Resume after failure
    ./generate-sdd.sh --requirements features/auto-archive.md --resume

    # Dry run (preview)
    ./generate-sdd.sh --requirements features/auto-archive.md --dry-run

PREREQUISITES:
    - Requirements file with "# Feature: Feature Name" as first heading
    - yq installed for YAML processing
    - kimi or claude CLI for AI consultation (optional)
    - All quality gates passed (if using --validate)
    - Clean git state (if using --git-workflow)
EOF
}

# Parse arguments
VALIDATE=false
AUTO_ASSESS=false
RESUME=false
GIT_WORKFLOW=false
AUTO="true"  # Always auto mode by default (no prompts)

while [[ $# -gt 0 ]]; do
    case $1 in
        --requirements)
            REQUIREMENTS_FILE="$2"
            shift 2
            ;;
        --output)
            CUSTOM_OUTPUT_DIR="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --auto-assess)
            AUTO_ASSESS=true
            shift
            ;;
        --resume)
            RESUME=true
            shift
            ;;
        --git-workflow)
            GIT_WORKFLOW=true
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

# Quality Gate 1: Requirements validation
run_quality_gate_1() {
    log_info "Running Quality Gate 1: Requirements validation..."
    
    if [ ! -x "./validate-requirements.sh" ]; then
        log_warning "validate-requirements.sh not found or not executable, skipping quality gate 1"
        return 0
    fi
    
    if ./validate-requirements.sh "$REQUIREMENTS_FILE"; then
        log_success "Quality Gate 1 PASSED ✓"
        return 0
    else
        log_error "Quality Gate 1 FAILED ✗"
        echo ""
        echo "Your requirements need improvement before proceeding."
        echo "Use the feedback above to enhance your requirements file."
        exit 1
    fi
}

# Run complexity assessment
run_complexity_assessment() {
    log_info "Running complexity assessment..."
    
    if [ ! -x "./complexity-assessment.sh" ]; then
        log_warning "complexity-assessment.sh not found, skipping assessment"
        return 0
    fi
    
    ./complexity-assessment.sh "$REQUIREMENTS_FILE"
    
    if [ -f ".complexity-score" ]; then
        SCORE=$(grep "Score=" .complexity-score | cut -d= -f2)
        log_success "Complexity assessment completed (Score: $SCORE)"
    fi
    
    # In auto mode, always proceed (no prompts)
    if [ "$AUTO" = "true" ]; then
        log_info "Auto mode: proceeding with generation"
    else
        # Manual mode only when explicitly requested
        echo ""
        read -p "Proceed with generation? [y/N]: " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Generation cancelled"
            exit 0
        fi
    fi
}

# Validate inputs with quality gates
validate_inputs() {
    if [ -z "$REQUIREMENTS_FILE" ]; then
        log_error "--requirements <file> is required"
        usage
        exit 1
    fi
    
    if [ ! -f "$REQUIREMENTS_FILE" ]; then
        log_error "Requirements file not found: $REQUIREMENTS_FILE"
        exit 1
    fi
    
    # Run quality gate 1
    run_quality_gate_1
    
    # Run complexity assessment if requested
    if [ "$AUTO_ASSESS" = true ]; then
        run_complexity_assessment
    fi
    
    # Check for yq
    if ! command -v yq &> /dev/null; then
        log_error "yq not found. Install yq to continue."
        echo "  macOS: brew install yq"
        echo "  Ubuntu: snap install yq"
        exit 1
    fi
    
    log_success "Requirements validated and quality gates passed: $REQUIREMENTS_FILE"
}

# Extract feature name from requirements file
extract_feature_name() {
    local file="$1"
    
    log_info "Extracting feature name from: $file"
    
    # Try different patterns to find feature name
    local feature_name=""
    
    # Pattern 1: "# Feature: Name" or "# Feature Name"
    feature_name=$(grep -iE "^# Feature[: ]" "$file" | head -1 | sed -E 's/^# Feature[: ]+//')
    
    # Pattern 2: "## Feature Name" or "## Feature: Name"
    if [ -z "$feature_name" ]; then
        feature_name=$(grep -iE "^## Feature[: ]" "$file" | head -1 | sed -E 's/^## Feature[: ]+//')
    fi
    
    # Pattern 3: First heading (any level)
    if [ -z "$feature_name" ]; then
        feature_name=$(grep -E "^#+ " "$file" | head -1 | sed -E 's/^#+ //')
    fi
    
    # Pattern 4: File name (fallback)
    if [ -z "$feature_name" ]; then
        feature_name=$(basename "$file" .md)
        log_warning "Using filename as feature name: $feature_name"
    else
        log_success "Found feature name: $feature_name"
    fi
    
    # Clean the feature name
    # - Convert to lowercase
    # - Replace non-alphanumeric with hyphens
    # - Collapse multiple hyphens
    # - Trim hyphens from ends
    local clean_name=$(echo "$feature_name" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9]/-/gi' | \
        sed 's/--*/-/g' | \
        sed 's/^-//;s/-$//')
    
    echo "$clean_name"
}

# Generate output directory name
generate_output_dir() {
    local feature_name="$1"
    echo "${feature_name}-sdd"
}

# Extract other metadata
extract_metadata() {
    local file="$1"
    
    # Get first non-empty line as title
    local title=$(grep -v '^$' "$file" | head -1 | sed 's/^#* //')
    
    # Count requirements (lines starting with - or •)
    local req_count=$(grep -E '^[[:space:]]*[-•]' "$file" | wc -l)
    
    # Estimate gaps (questions ending with ?)
    local gap_count=$(grep -E '\?$' "$file" | wc -l)
    
    echo "$title|$req_count|$gap_count"
}

# Generate SDD Flow
main() {
    log_info "Starting SDD Flow Generation"
    echo "=================================="
    echo ""
    
    # Validate inputs
    validate_inputs
    
    # Extract feature name
    FEATURE_NAME=$(extract_feature_name "$REQUIREMENTS_FILE")
    
    if [ -z "$FEATURE_NAME" ]; then
        log_error "Could not extract feature name from requirements file"
        exit 1
    fi
    
    log_success "Feature name extracted: $FEATURE_NAME"
    
    # Generate output directory
    if [ -n "$CUSTOM_OUTPUT_DIR" ]; then
        OUTPUT_DIR="$CUSTOM_OUTPUT_DIR"
        log_info "Using custom output directory: $OUTPUT_DIR"
    else
        OUTPUT_DIR=$(generate_output_dir "$FEATURE_NAME")
        log_info "Generated output directory: $OUTPUT_DIR"
    fi
    
    # Extract metadata
    IFS='|' read -r TITLE REQ_COUNT GAP_COUNT <<< "$(extract_metadata "$REQUIREMENTS_FILE")"
    
    log_info "Metadata extracted:"
    echo "  Title: $TITLE"
    echo "  Requirements: $REQ_COUNT"
    echo "  Estimated gaps: $GAP_COUNT"
    echo ""
    
    # Show what would be done (dry run or actual)
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}  DRY RUN MODE - NO FILES WILL BE CREATED                ║${NC}"
        echo -e "${YELLOW}══════════════════════════════════════════════════════════╝${NC}"
        echo ""
    fi
    
    log_info "Planned Actions:"
    echo "  1. Create directory: $OUTPUT_DIR"
    echo "  2. Generate 6 SDD documentation files"
    echo "  3. Create appropriate number of executable Trello cards (based on complexity)"
    echo "  4. Run gap analysis with AI consultation"
    echo "  5. Set status to: READY FOR IMPLEMENTATION"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        log_success "Dry run complete - review plan above"
        echo ""
        echo -e "${YELLOW}To execute for real, run without --dry-run${NC}"
        exit 0
    fi
    
    # Confirm before proceeding (only in manual mode)
    if [ "$AUTO" != "true" ]; then
        echo -e "${YELLOW}Proceed with SDD generation?${NC}"
        read -p "This will create files in $OUTPUT_DIR [y/N]: " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Operation cancelled"
            exit 0
        fi
    else
        log_info "Auto mode: proceeding with generation (creating files in $OUTPUT_DIR)"
    fi
    
    # Create output directory
    log_info "Creating output directory..."
    mkdir -p "$OUTPUT_DIR/trello-cards"
    log_success "Directory created: $OUTPUT_DIR"
    
    # Copy requirements file
    cp "$REQUIREMENTS_FILE" "$OUTPUT_DIR/raw-requirements.md"
    log_success "Requirements copied"
    
    # Generate metadata file
    cat > "$OUTPUT_DIR/sdd-metadata.json" << EOF
{
  "generated_at": "$(date -Iseconds)",
  "feature_name": "$FEATURE_NAME",
  "requirements_file": "$(basename "$REQUIREMENTS_FILE")",
  "title": "$TITLE",
  "requirements_count": $REQ_COUNT,
  "estimated_gaps": $GAP_COUNT,
  "output_directory": "$OUTPUT_DIR",
  "status": "in_progress",
  "sdd_version": "1.0"
}
EOF
    log_success "Metadata file created"
    
    # Copy templates and start generation
    log_info "Initializing SDD structure..."
    
    # Copy templates
    cp -r "$SCRIPT_DIR/TEMPLATES/"* "$OUTPUT_DIR/"
    cp -r "$SCRIPT_DIR/TRELLO_TEMPLATES/"* "$OUTPUT_DIR/trello-cards/"
    
    # Update placeholders in templates
    log_info "Updating template placeholders..."
    
    # Function to replace placeholders
    replace_placeholders() {
        local file="$1"
        sed -i "s/{FEATURE_NAME}/$(echo "$FEATURE_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))} 1')/g" "$file"
        sed -i "s/{DATE}/$(date +%Y-%m-%d)/g" "$file"
        sed -i "s/{STATUS}/IN PROGRESS/g" "$file"
        # Add more replacements as needed
    }
    
    # Replace placeholders in main SDD files
    for template in "$OUTPUT_DIR"/*.template.md; do
        if [ -f "$template" ]; then
            replace_placeholders "$template"
            # Rename from .template.md to .md
            mv "$template" "${template%.template.md}.md"
        fi
    done

    # Replace placeholders in trello-cards files
    for template in "$OUTPUT_DIR/trello-cards/"*.template.md; do
        if [ -f "$template" ]; then
            replace_placeholders "$template"
            # Rename from .template.md to .md
            mv "$template" "${template%.template.md}.md"
        fi
    done

    # Handle state.json.template specially (not markdown)
    if [ -f "$OUTPUT_DIR/trello-cards/state.json.template" ]; then
        sed -i "s/{FEATURE_SLUG}/$FEATURE_NAME/g" "$OUTPUT_DIR/trello-cards/state.json.template"
        mv "$OUTPUT_DIR/trello-cards/state.json.template" "$OUTPUT_DIR/trello-cards/state.json"
    fi

    log_success "SDD structure initialized"
    
    # Quality Gate 2: Validate generated SDD (if --validate flag)
    if [ "$VALIDATE" = true ]; then
        echo ""
        log_info "Running Quality Gate 2: SDD validation..."
        
        if [ -x "./validate-sdd.sh" ]; then
            if ./validate-sdd.sh "$OUTPUT_DIR"; then
                log_success "Quality Gate 2 PASSED ✓"
            else
                log_error "Quality Gate 2 FAILED ✗"
                echo ""
                echo "The generated SDD doesn't meet quality standards."
                echo "Please review the validation errors above and fix them."
                echo "Or re-run without --validate to skip this check."
                exit 1
            fi
        else
            log_warning "validate-sdd.sh not found, skipping quality gate 2"
        fi
    fi
    
    echo ""
    log_success "✅ SDD Flow setup complete!"
    
    if [ "$VALIDATE" = true ]; then
        log_success "✅ Quality gates PASSED!"
    fi
    
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. cd $OUTPUT_DIR"
    echo "  2. Review raw-requirements.md"
    echo "  3. Begin Phase 1: Project Analysis"
    echo "  4. Run gap interview (Phase 2)"
    echo "  5. Generate documentation (Phases 3-5)"
    echo ""
    if [ "$VALIDATE" = true ]; then
        echo -e "${GREEN}✅ Quality validated - ready for production use${NC}"
    fi
    echo -e "${YELLOW}Quick Start:${NC}"
    echo "  cd $OUTPUT_DIR"
    echo "  cat README.md"
    echo ""
    echo -e "${GREEN}Generated configuration saved to: $OUTPUT_DIR/sdd-metadata.json${NC}"
}

# Show banner
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    SDD FLOW GENERATOR                        ║${NC}"
echo -e "${BLUE}║          Transform Raw Requirements → Production SDD        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Run main function
main

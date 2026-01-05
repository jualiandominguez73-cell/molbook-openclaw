#!/bin/bash

################################################################################
# SDD Flow - Code Review & Decision Support Script
# 
# Purpose: Consult Kimi and Claude AI for collective decision making
#          Achieve 95%+ confidence on each SDD gap decision
#
# Usage:
#   ./code-review.sh --check-install
#   ./code-review.sh --question "Should detection be case-insensitive?" \
#                    --context "Pattern from src/telegram/bot.ts" \
#                    --confidence-threshold 95
#   ./code-review.sh --phase verification --sdd-output ./generated
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KIMI_CLI="kimi"
CLAUDE_CLI="claude"
DEFAULT_CONFIDENCE_THRESHOLD=95
TEMP_DIR="/tmp/sdd-flow-reviews"
mkdir -p "$TEMP_DIR"

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if CLI tools are installed
check_installation() {
    log_info "Checking AI CLI installations..."
    
    local all_good=true
    
    if command -v "$KIMI_CLI" &> /dev/null; then
        log_success "Kimi CLI installed: $(which $KIMI_CLI)"
    else
        log_error "Kimi CLI not found. Install with: npm install -g @kimi-ai/cli"
        all_good=false
    fi
    
    if command -v "$CLAUDE_CLI" &> /dev/null; then
        log_success "Claude CLI installed: $(which $CLAUDE_CLI)"
    else
        log_error "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-cli"
        all_good=false
    fi
    
    if [ "$all_good" = false ]; then
        exit 1
    fi
    
    # Test API keys
    log_info "Testing API keys..."
    
    if $KIMI_CLI "Test connection" &> /dev/null; then
        log_success "Kimi API key valid"
    else
        log_error "Kimi API key invalid or missing. Run: kimi config set-api-key YOUR_KEY"
        all_good=false
    fi
    
    if $CLAUDE_CLI "Test connection" &> /dev/null; then
        log_success "Claude API key valid"
    else
        log_error "Claude API key invalid or missing. Run: claude config set-api-key YOUR_KEY"
        all_good=false
    fi
    
    if [ "$all_good" = true ]; then
        log_success "All tools ready!"
        exit 0
    else
        exit 1
    fi
}

# Consult AIs for a single question
consult_ais() {
    local question="$1"
    local context="$2"
    local project_context_file="$3"
    local confidence_threshold="${4:-$DEFAULT_CONFIDENCE_THRESHOLD}"
    
    local timestamp=$(date +%s)
    local kimi_response_file="$TEMP_DIR/kimi_response_$timestamp.txt"
    local claude_response_file="$TEMP_DIR/claude_response_$timestamp.txt"
    local project_context=""
    
    # Load project context if provided
    if [ -n "$project_context_file" ] && [ -f "$project_context_file" ]; then
        project_context=$(cat "$project_context_file")
        log_info "Loaded project context: $project_context_file"
    fi
    
    log_info "Consulting AIs for: $question"
    log_info "Confidence threshold: ${confidence_threshold}%"
    
    # Prepare prompts
    local kimi_prompt="""
I need your expert opinion on a software design decision for a technical specification.

QUESTION: $question

CONTEXT FROM CODEBASE:
$context

PROJECT CONTEXT (existing patterns):
$project_context

INSTRUCTIONS:
1. Analyze the question thoroughly
2. Consider the project context and existing patterns
3. Provide a clear YES/NO/RECOMMENDATION answer
4. Include your confidence level (0-100%)
5. Explain your reasoning with pros and cons
6. Suggest alternative approaches if applicable
7. Cite specific references from context if relevant

FORMAT YOUR RESPONSE AS:
DECISION: [Your clear decision]
CONFIDENCE: [X]%
REASONING: [Detailed explanation]
PROS: [List of advantages]
CONS: [List of disadvantages]
ALTERNATIVES: [If applicable]
RISKS: [If confidence < 100%]
"""

    local claude_prompt="""
As a senior software architect, review this design decision:

QUESTION: $question

CODE CONTEXT:
$context

PROJECT PATTERNS:
$project_context

Provide your expert analysis:

1. Make a clear recommendation (YES/NO/CUSTOM)
2. State your confidence percentage (0-100%)
3. Detail your reasoning with specific examples from context
4. List advantages and disadvantages
5. Suggest any improvements or alternatives
6. Flag any risks if confidence is below 100%

Respond in this format:
DECISION: [Clear recommendation]
CONFIDENCE: [X]%
REASONING: [Detailed analysis]
PROS: [Advantages]
CONS: [Disadvantages]
ALTERNATIVES: [Other options]
CONCERNS: [Any concerns or risks]
"""
    
    # Call Kimi (background)
    log_info "Querying Kimi..."
    echo "$kimi_prompt" | $KIMI_CLI > "$kimi_response_file" &
    local kimi_pid=$!
    
    # Call Claude (background)
    log_info "Querying Claude..."
    echo "$claude_prompt" | $CLAUDE_CLI > "$claude_response_file" &
    local claude_pid=$!
    
    # Wait for both to complete
    log_info "Waiting for AI responses..."
    wait $kimi_pid
    local kimi_exit=$?
    wait $claude_pid
    local claude_exit=$?
    
    if [ $kimi_exit -ne 0 ]; then
        log_error "Kimi query failed (exit code: $kimi_exit)"
        return 1
    fi
    
    if [ $claude_exit -ne 0 ]; then
        log_error "Claude query failed (exit code: $claude_exit)"
        return 1
    fi
    
    # Parse responses
    local kimi_decision=$(grep -i "^DECISION:" "$kimi_response_file" | head -1 | cut -d: -f2- | xargs)
    local kimi_confidence=$(grep -i "^CONFIDENCE:" "$kimi_response_file" | head -1 | grep -oP '\d+' || echo "0")
    
    local claude_decision=$(grep -i "^DECISION:" "$claude_response_file" | head -1 | cut -d: -f2- | xargs)
    local claude_confidence=$(grep -i "^CONFIDENCE:" "$claude_response_file" | head -1 | grep -oP '\d+' || echo "0")
    
    # Analyze agreement
    local agreement="disagree"
    if [ "${kimi_decision,,}" = "${claude_decision,,}" ]; then
        agreement="agree"
    elif [[ "${kimi_decision,,}" == *"${claude_decision,,}"* ]] || [[ "${claude_decision,,}" == *"${kimi_decision,,}"* ]]; then
        agreement="partial"
    fi
    
    # Calculate average confidence
    local avg_confidence=$(( (kimi_confidence + claude_confidence) / 2 ))
    
    # Display results
    echo
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              AI CONSULTATION RESULTS                       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo
    echo -e "Question: ${YELLOW}$question${NC}"
    echo
    echo "────────────── KIMI RESPONSE ──────────────"
    echo -e "Decision:    $kimi_decision"
    echo -e "Confidence:  ${kimi_confidence}%"
    cat "$kimi_response_file" | grep -A 100 "REASONING:" | head -50
    echo
    echo "───────────── CLAUDE RESPONSE ─────────────"
    echo -e "Decision:    $claude_decision"
    echo -e "Confidence:  ${claude_confidence}%"
    cat "$claude_response_file" | grep -A 100 "REASONING:" | head -50
    echo
    echo "───────────────────────────────────────────"
    echo -e "Agreement:   $agreement"
    echo -e "Avg Conf:    ${avg_confidence}% (threshold: ${confidence_threshold}%)"
    echo
    
    # Save detailed report
    local report_file="$TEMP_DIR/consultation_$(date +%Y%m%d_%H%M%S).md"
    cat > "$report_file" << EOF
# AI Consultation Report

**Question:** $question
**Timestamp:** $(date)
**Confidence Threshold:** ${confidence_threshold}%

## Kimi AI

- **Decision:** $kimi_decision
- **Confidence:** ${kimi_confidence}%

### Full Response
\`\`\`
$(cat "$kimi_response_file")
\`\`\`

## Claude AI

- **Decision:** $claude_decision
- **Confidence:** ${claude_confidence}%

### Full Response
\`\`\`
$(cat "$claude_response_file")
\`\`\`

## Analysis

- **Agreement:** $agreement
- **Average Confidence:** ${avg_confidence}%
- **Meets Threshold:** $([ $avg_confidence -ge $confidence_threshold ] && echo "✅ YES" || echo "❌ NO")

## Recommendation

$([ $avg_confidence -ge $confidence_threshold ] && echo "✅ PROCEED with decision: $kimi_decision" || echo "❌ DO NOT PROCEED - need more analysis")
EOF

    log_info "Detailed report saved: $report_file"
    
    # Clean up temp response files
    rm -f "$kimi_response_file" "$claude_response_file"
    
    # Return success if meets threshold
    if [ $avg_confidence -ge $confidence_threshold ]; then
        return 0
    else
        return 1
    fi
}

# Verify SDD output structure
verify_sdd_structure() {
    local sdd_output="$1"
    
    log_info "Verifying SDD structure in: $sdd_output"
    
    if [ ! -d "$sdd_output" ]; then
        log_error "SDD output directory not found: $sdd_output"
        return 1
    fi
    
    local issues=0
    
    # Check required files
    local required_files=(
        "requirements.md"
        "ui-flow.md"
        "gaps.md"
        "manual-e2e-test.md"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$sdd_output/$file" ]; then
            log_success "✓ $file exists"
        else
            log_error "✗ $file missing"
            ((issues++))
        fi
    done
    
    # Check trello-cards folder
    if [ -d "$sdd_output/trello-cards" ]; then
        log_success "✓ trello-cards/ directory exists"
        
        # Check for key files
        for file in "BOARD.md" "KICKOFF.md" "AGENT_PROTOCOL.md"; do
            if [ -f "$sdd_output/trello-cards/$file" ]; then
                log_success "  ✓ trello-cards/$file exists"
            else
                log_error "  ✗ trello-cards/$file missing"
                ((issues++))
            fi
        done
        
        # Count card files
        local card_count=$(find "$sdd_output/trello-cards" -name "*.md" | grep -E '[0-9]{2}-' | wc -l)
        if [ $card_count -ge 10 ]; then
            log_success "  ✓ Found $card_count card files"
        else
            log_error "  ✗ Only found $card_count card files (expected 10+)"
            ((issues++))
        fi
    else
        log_error "✗ trello-cards/ directory missing"
        ((issues++))
    fi
    
    # Check README.md
    if [ -f "$sdd_output/README.md" ]; then
        log_success "✓ README.md exists"
        
        # Check for ready status
        if grep -q "READY FOR IMPLEMENTATION" "$sdd_output/README.md"; then
            log_success "  ✓ README.md shows READY status"
        else
            log_error "  ✗ README.md does not show READY status"
            ((issues++))
        fi
    else
        log_error "✗ README.md missing"
        ((issues++))
    fi
    
    if [ $issues -eq 0 ]; then
        log_success "All SDD structure checks passed!"
        return 0
    else
        log_error "Found $issues issues in SDD structure"
        return 1
    fi
}

# Generate review report
generate_review_report() {
    local sdd_output="$1"
    local output_file="${2:-review-report.md}"
    
    log_info "Generating comprehensive review report..."
    
    cat > "$output_file" << EOF
# SDD Flow Review Report

**Generated:** $(date)
**SDD Location:** $sdd_output

## Executive Summary

This report documents the SDD flow execution and verification process.

## Gap Interview Results

$(if [ -f "$sdd_output/gaps.md" ]; then
    echo "Gap analysis completed. See gaps.md for details."
    grep -c "✅ FILLED" "$sdd_output/gaps.md" | xargs echo "Gaps filled:"
else
    echo "⚠️ gaps.md not found"
fi)

## Generated Deliverables

$(if [ -d "$sdd_output" ]; then
    echo "Files generated:"
    find "$sdd_output" -name "*.md" -type f | wc -l | xargs echo "- Markdown files:"
    find "$sdd_output/trello-cards" -name "*.md" -type f | wc -l | xargs echo "- Trello cards:"
else
    echo "⚠️ SDD output directory not found"
fi)

## Confidence Assessment

Confidence threshold: ${DEFAULT_CONFIDENCE_THRESHOLD}%

$(if [ -f "$sdd_output/gaps.md" ]; then
    echo "Gap confidence levels:"
    grep -E "confidence:|Confidence:" "$sdd_output/gaps.md" | head -10 || echo "No confidence data found"
fi)

## AI Consultation History

$(ls -1 "$TEMP_DIR"/consultation_*.md 2>/dev/null | wc -l | xargs echo "Consultations performed:")

Latest consultations:
$(ls -t "$TEMP_DIR"/consultation_*.md 2>/dev/null | head -5 | xargs -I {} basename {} .md)

## Verification Results

$(verify_sdd_structure "$sdd_output" > /dev/null 2>&1 && echo "✅ Structure verification PASSED" || echo "❌ Structure verification FAILED")

## Recommendations

- Review gaps.md for any low-confidence decisions
- Verify all file paths exist in project
- Test card executability with a sample card
- Run manual E2E test after implementation

## Next Steps

1. AI agent executes trello-cards/KICKOFF.md
2. Implement cards sequentially (01-NN)
3. Run E2E test (last card)
4. Production deployment with DRY_RUN=false

---

*Report generated by SDD Flow code-review.sh script*
EOF

    log_success "Review report generated: $output_file"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --check-install)
            check_installation
            exit 0
            ;;
        --question)
            QUESTION="$2"
            shift 2
            ;;
        --context)
            CONTEXT="$2"
            shift 2
            ;;
        --project-context)
            PROJECT_CONTEXT_FILE="$2"
            shift 2
            ;;
        --confidence-threshold)
            CONFIDENCE_THRESHOLD="$2"
            shift 2
            ;;
        --phase)
            PHASE="$2"
            shift 2
            ;;
        --sdd-output)
            SDD_OUTPUT="$2"
            shift 2
            ;;
        --project-path)
            PROJECT_PATH="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --check-install                    Check if Kimi/Claude are installed"
            echo "  --question \"Q\"                   Ask a single question"
            echo "  --context \"C\"                    Provide context for the question"
            echo "  --project-context FILE           Project analysis file"
            echo "  --confidence-threshold N         Confidence threshold (default: 95)"
            echo "  --phase verification             Run SDD structure verification"
            echo "  --phase review                   Generate comprehensive review report"
            echo "  --sdd-output PATH                Path to generated SDD"
            echo "  --project-path PATH              Path to project root"
            echo "  --output FILE                    Output file for report"
            exit 1
            ;;
    esac
done

# Execute based on phase
if [ "$PHASE" = "verification" ]; then
    if [ -z "$SDD_OUTPUT" ]; then
        log_error "--sdd-output required for verification phase"
        exit 1
    fi
    verify_sdd_structure "$SDD_OUTPUT"
    
elif [ "$PHASE" = "review" ]; then
    if [ -z "$SDD_OUTPUT" ]; then
        log_error "--sdd-output required for review phase"
        exit 1
    fi
    OUTPUT_FILE="${OUTPUT_FILE:-review-report.md}"
    generate_review_report "$SDD_OUTPUT" "$OUTPUT_FILE"
    
elif [ -n "$QUESTION" ]; then
    consult_ais "$QUESTION" "${CONTEXT:-}" "${PROJECT_CONTEXT_FILE:-}" \
                "${CONFIDENCE_THRESHOLD:-$DEFAULT_CONFIDENCE_THRESHOLD}"
    exit $?
    
else
    echo "No action specified. Use --help for usage."
    exit 1
fi

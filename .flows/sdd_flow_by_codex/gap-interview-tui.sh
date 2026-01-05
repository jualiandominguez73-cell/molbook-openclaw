#!/bin/bash

################################################################################
# Gap Interview - Visual TUI
#
# Purpose: Interactive gap filling with 3 AI suggestions + manual option
# The ONLY interactive component in the system
################################################################################

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
UNDERLINE='\033[4m'
NC='\033[0m'

# Helper functions
header() {
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║${NC} ${BOLD}GAP INTERVIEW - VISUAL TUI${NC} ${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
}

show_gap() {
    local gap_id="$1"
    local question="$2"
    
    echo -e "${BOLD}${YELLOW}[${gap_id}]${NC} ${BOLD}${question}${NC}"
}

show_suggestion() {
    local num="$1"
    local text="$2"
    local color="$3"
    
    echo -e "  ${color}${BOLD}[${num}]${NC} ${text}"
}

show_status() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Status:${NC} Gaps remaining"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

generate_suggestions() {
    local gap_id="$1"
    local question="$2"
    
    # Simulate AI suggestions (in real system, these would come from Kimi/Claude)
    case "$gap_id" in
        "GAP-001")
            suggestions=(
                "Case-insensitive detection (recommended for Telegram)"
                "Case-sensitive detection (only if user specifies)"
                "Configurable with default to case-insensitive"
            )
            ;;
        "GAP-002")
            suggestions=(
                "30-day threshold with admin override"
                "Configurable per-user setting (start with 30 as default)"
                "Hardcoded 30 days for v1, configurable in v2"
            )
            ;;
        "GAP-003")
            suggestions=(
                "Send Telegram DM only (single channel, expandable)"
                "User preference (Telegram/Discord) - default Telegram"
                "Admin-configured channel with Telegram as default"
            )
            ;;
        *)
            suggestions=(
                "Follow existing pattern from deep-research feature"
                "Simple implementation v1, expand based on usage"
                "Configurable option with sensible default"
            )
            ;;
    esac
    
    echo "${suggestions[0]}"
    echo "${suggestions[1]}"
    echo "${suggestions[2]}"
}

# Main TUI function
run_gap_interview() {
    # Mock gaps data (in real system, loaded from gaps.md)
    gaps=(
        "GAP-001|Should detection be case-sensitive?"
        "GAP-002|What should be the inactivity threshold?"
        "GAP-003|Which notification channel should be used?"
    )
    
    answers=()
    
    echo "═══════════════════════════════════════════════════════"
    echo "  GAP INTERVIEW SESSION"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    for gap in "${gaps[@]}"; do
        IFS='|' read -r gap_id question <<< "$gap"
        
        show_gap "$gap_id" "$question"
        echo ""
        
        # Generate 3 suggestions
        mapfile -t suggestions < <(generate_suggestions "$gap_id" "$question")
        
        echo -e "${BOLD}AI Suggestions (colored):${NC}"
        show_suggestion "1" "${suggestions[0]}" "$GREEN"
        show_suggestion "2" "${suggestions[1]}" "$YELLOW"
        show_suggestion "3" "${suggestions[2]}" "$BLUE"
        echo ""
        
        # Show option 4 (manual)
        echo -e "  ${CYAN}${BOLD}[4]${NC} ${UNDERLINE}Manual input${NC}"
        echo ""
        
        # User selection loop
        while true; do
            echo -ne "${BOLD}Select (1-4) or ${UNDERLINE}s${NC}${BOLD} to skip: ${NC}"
            read -n 1 selection
            echo ""
            
            case $selection in
                1|2|3)
                    answer="${suggestions[$((selection-1))]}"
                    echo -e "${GREEN}✓ Selected:${NC} $answer"
                    answers+=("$gap_id|$answer")
                    break
                    ;;
                4)
                    echo -ne "${CYAN}Manual input:${NC} "
                    read -r manual_answer
                    if [ -n "$manual_answer" ]; then
                        echo -e "${GREEN}✓ Manual answer:${NC} $manual_answer"
                        answers+=("$gap_id|$manual_answer")
                        break
                    else
                        echo -e "${RED}✗ Cannot be empty${NC}"
                    fi
                    ;;
                s|S)
                    echo -e "${YELLOW}⚠ Skipped${NC}"
                    break
                    ;;
                *)
                    echo -e "${RED}✗ Invalid selection${NC}"
                    ;;
            esac
        done
        
        echo ""
        echo -e "${MAGENTA}─────────────────────────────────────────────────────${NC}"
        echo ""
    done
    
    # Summary
    show_status
    
    echo -e "${GREEN}Answers recorded:${NC}"
    for answer in "${answers[@]}"; do
        IFS='|' read -r gap_id ans_text <<< "$answer"
        echo -e "  ${YELLOW}${gap_id}:${NC} $ans_text"
    done
    
    echo ""
    echo -e "${BOLD}${GREEN}✅ Gap interview complete!${NC}"
    echo ""
    
    # Save answers
    if [ ${#answers[@]} -gt 0 ]; then
        cat > .gap-answers.txt << EOF
# Gap Interview Answers
# Generated: $(date)

EOF
        
        for answer in "${answers[@]}"; do
            echo "$answer" >> .gap-answers.txt
        done
        
        echo -e "${CYAN}Answers saved to:${NC} .gap-answers.txt"
    fi
}

# Check if running directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo ""
    header
    run_gap_interview
else
    echo "Gap interview TUI functions loaded"
fi
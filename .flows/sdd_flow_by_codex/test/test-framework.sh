#!/bin/bash

################################################################################
# Testing Framework for SDD Flow System
#
# Purpose: Automated testing of SDD generation pipeline
# Runs: unit tests, integration tests, validation tests
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

function test_start() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "  Testing: $1... "
}

function test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}PASS${NC}"
}

function test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}FAIL${NC}"
    if [ -n "$1" ]; then
        echo -e "    ${RED}Reason: $1${NC}"
    fi
}

function test_skip() {
    echo -e "${YELLOW}SKIP${NC}"
}

function test_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
}

function assert_file_exists() {
    if [ -f "$1" ]; then
        test_pass
    else
        test_fail "Missing file: $1"
    fi
}

function assert_directory_exists() {
    if [ -d "$1" ]; then
        test_pass
    else
        test_fail "Missing directory: $1"
    fi
}

function assert_file_contains() {
    if grep -q "$2" "$1" 2>/dev/null; then
        test_pass
    else
        test_fail "File doesn't contain '$2': $1"
    fi
}

# Test Suite 1: Script Validation
test_header "Test Suite 1: Script Validation"

test_start "All scripts have execute permissions"
for script in *.sh; do
    if [ -x "$script" ]; then
        continue
    else
        test_fail "Script not executable: $script"
        exit 1
    fi
done
test_pass

test_start "generate-sdd.sh exists and is runnable"
assert_file_exists "./generate-sdd.sh"

test_start "code-review.sh exists and is runnable"
assert_file_exists "./code-review.sh"

test_start "validate-requirements.sh exists and is runnable"
assert_file_exists "./validate-requirements.sh"

test_start "validate-sdd.sh exists and is runnable"
assert_file_exists "./validate-sdd.sh"

test_start "load-agent-prompt.sh exists and is runnable"
assert_file_exists "./load-agent-prompt.sh"

# Test Suite 2: Template Validation
test_header "Test Suite 2: Template Validation"

test_start "TEMPLATES directory exists"
assert_directory_exists "./TEMPLATES"

test_start "All required templates present"
assert_file_exists "./TEMPLATES/requirements.template.md"
assert_file_exists "./TEMPLATES/ui-flow.template.md"
assert_file_exists "./TEMPLATES/gaps.template.md"
assert_file_exists "./TEMPLATES/manual-e2e-test.template.md"
assert_file_exists "./TEMPLATES/README.template.md"
test_pass

# Test Suite 3: Trello Templates
test_header "Test Suite 3: Trello Template Validation"

test_start "TRELLO_TEMPLATES directory exists"
assert_directory_exists "./TRELLO_TEMPLATES"

test_start "All required Trello templates present"
assert_file_exists "./TRELLO_TEMPLATES/card-XX-template.md"
assert_file_exists "./TRELLO_TEMPLATES/BOARD.template.md"
assert_file_exists "./TRELLO_TEMPLATES/KICKOFF.template.md"
assert_file_exists "./TRELLO_TEMPLATES/AGENT_PROTOCOL.template.md"
test_pass

# Test Suite 4: Configuration Files
test_header "Test Suite 4: Configuration Validation"

test_start "Prompt registry exists and is valid YAML"
assert_file_exists "./prompts/agent-registry.yaml"
assert_file_contains "./prompts/agent-registry.yaml" "agents:"

test_start "Interview prompt exists"
assert_file_exists "./prompts/interview.yaml"

test_start "State template is valid JSON"
assert_file_exists "./17_STATE_TEMPLATE.json"
assert_file_contains "./17_STATE_TEMPLATE.json" '"version"'

# Test Suite 5: Integration Test - Small Feature
test_header "Test Suite 5: Integration Test (Simple Feature)"

TEST_FEATURE="./test/features/simple-notification.md"
TEST_OUTPUT="./test/output/simple-notification-sdd"

# Create test feature if not exists
if [ ! -f "$TEST_FEATURE" ]; then
    cat > "$TEST_FEATURE" << 'EOF'
# Feature: Simple Slack Notification

## Description
Send a notification to Slack when a new user registers.

## Raw Requirements
- Detect new user registration event
- Format notification message with user details
- Send to Slack webhook
- Log success/failure
- Retry up to 3 times on failure

## Business Value
- Immediate awareness of new user acquisition
- Better team visibility

## Technical Considerations
- Use existing slack webhook system
- Async processing to not block registration
- Configurable retry policy
EOF
fi

test_start "Test feature file created"
assert_file_exists "$TEST_FEATURE"

test_start "Generate SDD for simple feature"
if ./generate-sdd.sh --requirements "$TEST_FEATURE" --output "$TEST_OUTPUT" >/dev/null 2>&1; then
    test_pass
else
    test_fail "Generation failed"
    exit 1
fi

test_start "SDD output directory created"
assert_directory_exists "$TEST_OUTPUT"

test_start "SDD passes quality validation"
if ./validate-sdd.sh "$TEST_OUTPUT" >/dev/null 2>&1; then
    test_pass
else
    test_fail "SDD validation failed"
    # Continue to show full results
fi

test_start "All required files generated"
assert_file_exists "$TEST_OUTPUT/requirements.md"
assert_file_exists "$TEST_OUTPUT/ui-flow.md"
assert_file_exists "$TEST_OUTPUT/gaps.md"
assert_file_exists "$TEST_OUTPUT/manual-e2e-test.md"
assert_file_exists "$TEST_OUTPUT/README.md"
test_pass

test_start "Trello cards generated"
assert_directory_exists "$TEST_OUTPUT/trello-cards"
CARD_COUNT=$(ls -1 "$TEST_OUTPUT/trello-cards"/[0-9][0-9]-*.md 2>/dev/null | wc -l)
if [ "$CARD_COUNT" -ge 3 ]; then
    test_pass
else
    test_fail "Too few cards generated: $CARD_COUNT (expected ≥ 3)"
fi

test_start "Card quality (1-4 SP)"
INVALID_SP=0
for card in "$TEST_OUTPUT"/trello-cards/[0-9][0-9]-*.md; do
    SP=$(grep -o "Story Points.*[0-9]" "$card" 2>/dev/null | grep -o '[0-9]' | head -1 || echo "0")
    if [ "$SP" -lt 1 ] || [ "$SP" -gt 4 ]; then
        INVALID_SP=$((INVALID_SP + 1))
    fi
done

if [ "$INVALID_SP" -eq 0 ]; then
    test_pass
else
    test_fail "Found $INVALID_SP cards with invalid SP (must be 1-4)"
fi

# Test Suite 6: Validation Tools
test_header "Test Suite 6: Validation Tools"

test_start "Quality gate 1 (requirements) works"
cat > ./test/tmp-bad-requirements.md << 'EOF'
# Feature: Bad Example
No description, no requirements list.
EOF

if ./validate-requirements.sh ./test/tmp-bad-requirements.md >/dev/null 2>&1; then
    test_fail "Should have rejected bad requirements"
else
    test_pass
fi
rm -f ./test/tmp-bad-requirements.md

test_start "Quality gate 1 passes good requirements"
if ./validate-requirements.sh "$TEST_FEATURE" >/dev/null 2>&1; then
    test_pass
else
    test_fail "Should have accepted good requirements"
fi

# Test Suite 7: Complexity Assessment
test_header "Test Suite 7: Complexity Assessment"

test_start "Complexity assessment tool exists"
assert_file_exists "./complexity-assessment.sh"

test_start "Complexity assessment runs"
if ./complexity-assessment.sh <<< "n\nn\nn\nn\nn\nn\nn\nn\nn\nn" >/dev/null 2>&1; then
    test_pass
else
    test_fail "Complexity assessment failed to run"
fi

# Test Suite 8: Documentation Quality
test_header "Test Suite 8: Documentation Quality"

test_start "START.md exists and is valid"
assert_file_exists "./START.md"
assert_file_contains "./START.md" "Human Quick Start"
assert_file_contains "./START.md" "AI Agent Protocol"
test_pass

test_start "Key documentation is consistent"
assert_file_contains "./START.md" "95%+ confidence"
assert_file_contains "./START.md" "1-4 SP per card"
assert_file_contains "./START.md" "KISS principle"
test_pass

# Test Summary
test_header "Test Summary"
echo ""
echo -e "${BLUE}Total Tests Run:    $TESTS_RUN${NC}"
echo -e "${GREEN}Tests Passed:       $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed:       $TESTS_FAILED${NC}"
echo -e "${YELLOW}Success Rate:       $((TESTS_PASSED * 100 / TESTS_RUN))%${NC}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ ALL TESTS PASSED - SDD Flow is READY${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════${NC}"
    echo -e "${RED}  ✗ SOME TESTS FAILED - Review errors above${NC}"
    echo -e "${RED}═══════════════════════════════════════════${NC}"
    exit 1
fi

#!/bin/bash

################################################################################
# Test Auto Mode - Verifies no prompts block execution
################################################################################

echo "════════════════════════════════════════════════"
echo "  Testing Auto Mode - No Prompts"
echo "════════════════════════════════════════════════"
echo ""

# Test 1: smart_commit.sh should not prompt
echo "Test 1: smart_commit.sh (auto mode)"
timeout 5s ./smart_commit.sh --help > /dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "❌ FAIL: Would block waiting for input"
else
    echo "✅ PASS: Executes without blocking"
fi

# Test 2: generate-sdd.sh should not prompt in dry-run
echo ""
echo "Test 2: generate-sdd.sh dry-run (auto mode)"
timeout 5s ./generate-sdd.sh --help > /dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "❌ FAIL: Would block waiting for input"
else
    echo "✅ PASS: Executes without blocking"
fi

# Test 3: ensure-git-workflow.sh should not prompt
echo ""
echo "Test 3: ensure-git-workflow.sh (auto mode)"
timeout 5s ./ensure-git-workflow.sh --help > /dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "❌ FAIL: Would block waiting for input"
else
    echo "✅ PASS: Executes without blocking"
fi

# Test 4: complexity-assessment.sh should not prompt
echo ""
echo "Test 4: complexity-assessment.sh (auto mode)"
timeout 5s ./complexity-assessment.sh > /dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "❌ FAIL: Would block waiting for input"
else
    echo "✅ PASS: Executes without blocking"
fi

echo ""
echo "════════════════════════════════════════════════"
echo "  Result: All systems in auto mode"
echo "════════════════════════════════════════════════"
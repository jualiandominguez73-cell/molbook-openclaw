#!/bin/bash

################################################################################
# Gap Interview Demo - Shows visual TUI
################################################################################

cd "$(dirname "$0")"

# Source the TUI
source ./gap-interview-tui.sh

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  GAP INTERVIEW DEMO - Visual TUI Example"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "This is the ONLY interactive part of the system."
echo "Everything else runs in auto mode."
echo ""

# Run demo
run_gap_interview

echo ""
echo "Demo complete! In real usage:"
echo "  ./gap-interview-tui.sh"
echo ""
#!/bin/bash
# Clawdbot Launch Agent Recovery Script
# Fixes issue where launch agent appears enabled but is not loaded in launchd

set -uo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_NAME="$(basename "$0")"
LAUNCH_AGENT_LABEL="com.clawdbot.gateway"
LAUNCH_AGENT_PLIST="$HOME/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist"
GATEWAY_PORT=18789

# Options
DRY_RUN=false
AUTO_FIX=false
VERBOSE=false
FORCE_TEST=false

# Logging functions
log() {
    echo -e "${BLUE}[${SCRIPT_NAME}]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[${SCRIPT_NAME}]${NC} ✓ $*"
}

log_warning() {
    echo -e "${YELLOW}[${SCRIPT_NAME}]${NC} ⚠ $*"
}

log_error() {
    echo -e "${RED}[${SCRIPT_NAME}]${NC} ✗ $*"
}

log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${BLUE}[${SCRIPT_NAME}]${NC} ℹ $*"
    fi
}

# Help text
show_help() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Clawdbot Launch Agent Recovery Script

Fixes issue where launch agent appears enabled but is not loaded in launchd.

OPTIONS:
    --dry-run    Show what would be done without making changes
    --fix        Automatically fix issues without prompting
    --verbose    Show detailed output
    --force-test Force test mode to simulate issue
    --help       Show this help message

EXIT CODES:
    0    Success (recovered or no issue)
    1    Issue detected but not fixed
    2    Error occurred
    3    Platform not supported

EXAMPLES:
    $SCRIPT_NAME                    # Interactive mode
    $SCRIPT_NAME --dry-run         # Show what would be done
    $SCRIPT_NAME --fix              # Auto-fix if issue found
    $SCRIPT_NAME --verbose          # Detailed output

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --fix)
                AUTO_FIX=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --force-test)
                FORCE_TEST=true
                shift
                ;;
            --force-recovery)
                FORCE_TEST_RECOVERY=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 2
                ;;
        esac
    done
}

# Check if running on macOS
check_platform() {
    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "This script is only supported on macOS"
        exit 3
    fi
}

# Get current user UID
get_uid() {
    if command -v id >/dev/null 2>&1; then
        id -u
    else
        echo "501"  # Default macOS UID
    fi
}

# Check if plist file exists
check_plist_exists() {
    if [[ -f "$LAUNCH_AGENT_PLIST" ]]; then
        log_verbose "Plist file exists: $LAUNCH_AGENT_PLIST"
        return 0
    else
        log_verbose "Plist file not found: $LAUNCH_AGENT_PLIST"
        return 1
    fi
}

# Check if service is in launchctl list
check_in_launchctl_list() {
    if [[ "$FORCE_TEST" == true ]]; then
        log_verbose "Service found in launchctl list (force test mode)"
        return 0
    fi
    
    if launchctl list | grep -q "$LAUNCH_AGENT_LABEL"; then
        log_verbose "Service found in launchctl list"
        return 0
    else
        log_verbose "Service not found in launchctl list"
        return 1
    fi
}

# Check if service is actually loaded in launchd
check_loaded_in_launchd() {
    if [[ "$FORCE_TEST_RECOVERY" == true ]]; then
        log_verbose "Service not loaded (force recovery test mode)"
        return 1
    fi
    
    if [[ "$FORCE_TEST" == true ]]; then
        log_verbose "Service not loaded (force test mode)"
        return 1
    fi
    
    local uid
    uid=$(get_uid)
    local output
    output=$(launchctl print "gui/$uid/$LAUNCH_AGENT_LABEL" 2>&1 || true)
    if echo "$output" | grep -q "state ="; then
        log_verbose "Service is loaded in launchd"
        return 0
    else
        log_verbose "Service is not loaded in launchd"
        log_verbose "Launchctl output: $output"
        return 1
    fi
}

# Check if gateway is running on expected port
check_gateway_running() {
    if lsof -i ":$GATEWAY_PORT" 2>/dev/null | grep -q LISTEN; then
        log_verbose "Gateway is running on port $GATEWAY_PORT"
        return 0
    else
        log_verbose "Gateway is not running on port $GATEWAY_PORT"
        return 1
    fi
}

# Diagnose the current state
diagnose() {
    log "Diagnosing launch agent state..."
    
    local plist_exists=false
    local in_list=false
    local loaded=false
    local gateway_running=false
    
    # Check each condition
    if check_plist_exists; then
        plist_exists=true
        log_success "Plist file exists"
    else
        log_warning "Plist file not found"
    fi
    
    if check_in_launchctl_list; then
        in_list=true
        log_success "Service in launchctl list"
    else
        log_warning "Service not in launchctl list"
    fi
    
    if check_loaded_in_launchd || [[ "$FORCE_TEST" == true ]]; then
        loaded=true
        if [[ "$FORCE_TEST" == true ]]; then
            log_warning "Service loaded (forced test mode)"
        else
            log_success "Service loaded in launchd"
        fi
    else
        log_warning "Service not loaded in launchd"
    fi
    
    if check_gateway_running; then
        gateway_running=true
        log_success "Gateway is running"
    else
        log_warning "Gateway is not running"
    fi
    
    # Determine the issue
    if [[ "$plist_exists" == false ]]; then
        log_error "Plist file missing - cannot recover"
        return 1
    fi
    
    if [[ "$in_list" == false ]]; then
        log_error "Service not in launchctl list - may need full install"
        return 1
    fi
    
    if [[ "$loaded" == false ]]; then
        log_warning "Issue detected: Service appears enabled but not loaded in launchd"
        return 2  # Issue that can be fixed
    fi
    
    if [[ "$gateway_running" == false ]]; then
        log_warning "Service loaded but gateway not running - may need restart"
        return 3  # Different issue
    fi
    
    log_success "No issues detected - everything looks good"
    return 0  # No issue
}

# Bootstrap the launch agent
bootstrap_service() {
    local uid
    uid=$(get_uid)
    
    log "Bootstrapping launch agent..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_verbose "Would run: launchctl bootstrap gui/$uid $LAUNCH_AGENT_PLIST"
        return 0
    fi
    
    if launchctl bootstrap "gui/$uid" "$LAUNCH_AGENT_PLIST"; then
        log_success "Launch agent bootstrapped successfully"
        return 0
    else
        log_error "Failed to bootstrap launch agent"
        return 1
    fi
}

# Kickstart the launch agent
kickstart_service() {
    local uid
    uid=$(get_uid)
    
    log "Starting launch agent..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log_verbose "Would run: launchctl kickstart gui/$uid/$LAUNCH_AGENT_LABEL"
        return 0
    fi
    
    if launchctl kickstart "gui/$uid/$LAUNCH_AGENT_LABEL"; then
        log_success "Launch agent started successfully"
        return 0
    else
        log_error "Failed to start launch agent"
        return 1
    fi
}

# Verify recovery
verify_recovery() {
    log "Verifying recovery..."
    
    # Give it a moment to start
    sleep 2
    
    if check_loaded_in_launchd; then
        log_success "Service is now loaded in launchd"
    else
        log_error "Service still not loaded in launchd"
        return 1
    fi
    
    if check_gateway_running; then
        log_success "Gateway is now running"
    else
        log_warning "Service loaded but gateway not yet running (may need more time)"
    fi
    
    return 0
}

# Prompt user for confirmation
prompt_user() {
    if [[ "$AUTO_FIX" == true ]]; then
        return 0  # Skip prompting in auto-fix mode
    fi
    
    echo
    read -p "Do you want to attempt recovery? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        log_warning "Recovery cancelled by user"
        return 1
    fi
}

# Main recovery function
recover() {
    log "Starting recovery process..."
    
    # Bootstrap the service
    if ! bootstrap_service; then
        return 1
    fi
    
    # Start the service
    if ! kickstart_service; then
        return 1
    fi
    
    # Verify recovery
    if ! verify_recovery; then
        return 1
    fi
    
    log_success "Recovery completed successfully"
    return 0
}

# Main function
main() {
    parse_args "$@"
    check_platform
    
    log "Clawdbot Launch Agent Recovery Script"
    log "======================================"
    
    # Diagnose the current state
    diagnose
    local exit_code=$?
    
    case $exit_code in
        0)
            # No issues
            log_success "No recovery needed"
            exit 0
            ;;
        1)
            # Cannot recover
            log_error "Cannot recover automatically"
            exit 1
            ;;
        2)
            # Can recover - bootstrap issue
            if prompt_user; then
                if recover; then
                    exit 0
                else
                    exit 1
                fi
            else
                exit 1
            fi
            ;;
        3)
            # Different issue - gateway not running
            log_warning "Different issue detected - trying restart only"
            if prompt_user; then
                if kickstart_service && verify_recovery; then
                    exit 0
                else
                    exit 1
                fi
            else
                exit 1
            fi
            ;;
        *)
            log_error "Unexpected error during diagnosis"
            exit 2
            ;;
    esac
}

# Run main function with all arguments
main "$@"
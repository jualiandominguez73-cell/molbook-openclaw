#!/usr/bin/env bash
#==============================================================================
# OpenClaw Production Deployment Script
# Manages Docker-based deployment with security, monitoring, and automation
#==============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.production.yml"
ENV_FILE="$SCRIPT_DIR/.env"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

#==============================================================================
# Helper Functions
#==============================================================================

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
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

require_cmd() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Required command not found: $1"
        exit 1
    fi
}

generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        python3 -c "import secrets; print(secrets.token_hex(32))"
    fi
}

#==============================================================================
# Commands
#==============================================================================

cmd_setup() {
    log_info "Running initial setup..."
    
    # Check requirements
    require_cmd docker
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose not available"
        exit 1
    fi
    
    # Create directories
    mkdir -p "$BACKUP_DIR"
    
    # Create .env file from template if not exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log_info "Creating .env file from template..."
        cp "$SCRIPT_DIR/.env.template" "$ENV_FILE"
        
        # Generate secrets
        log_info "Generating secure secrets..."
        
        local gateway_token
        local postgres_password
        local encryption_key
        
        gateway_token=$(generate_secret)
        postgres_password=$(generate_secret)
        encryption_key=$(generate_secret)
        
        # Update .env with generated secrets
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$gateway_token/" "$ENV_FILE"
            sed -i '' "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$postgres_password/" "$ENV_FILE"
            sed -i '' "s/OPENCLAW_ENCRYPTION_KEY=.*/OPENCLAW_ENCRYPTION_KEY=$encryption_key/" "$ENV_FILE"
        else
            sed -i "s/OPENCLAW_GATEWAY_TOKEN=.*/OPENCLAW_GATEWAY_TOKEN=$gateway_token/" "$ENV_FILE"
            sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$postgres_password/" "$ENV_FILE"
            sed -i "s/OPENCLAW_ENCRYPTION_KEY=.*/OPENCLAW_ENCRYPTION_KEY=$encryption_key/" "$ENV_FILE"
        fi
        
        log_success "Secrets generated and saved to .env"
        log_warning "Please edit .env and set your CLAUDE_AI_SESSION_KEY"
    else
        log_info ".env file already exists"
    fi
    
    log_success "Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Edit $ENV_FILE and set your API keys"
    echo "  2. Run: ./deploy.sh build"
    echo "  3. Run: ./deploy.sh start"
}

cmd_build() {
    log_info "Building Docker images..."
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build
    
    log_success "Build complete!"
}

cmd_start() {
    local profile="${1:-}"
    
    log_info "Starting services..."
    
    if [[ "$profile" == "monitoring" ]]; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile monitoring up -d
    elif [[ "$profile" == "browser" ]]; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile browser up -d
    elif [[ "$profile" == "all" ]]; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile monitoring --profile browser up -d
    else
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    fi
    
    log_success "Services started!"
    echo ""
    cmd_status
}

cmd_stop() {
    log_info "Stopping services..."
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile monitoring --profile browser --profile cli down
    
    log_success "Services stopped!"
}

cmd_restart() {
    log_info "Restarting services..."
    
    cmd_stop
    sleep 2
    cmd_start "$@"
}

cmd_status() {
    log_info "Service Status:"
    echo ""
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -a
}

cmd_health() {
    log_info "Checking service health..."
    echo ""
    
    # Check gateway
    if curl -sf http://localhost:18789/health &> /dev/null; then
        echo -e "Gateway:    ${GREEN}✓ Healthy${NC}"
    else
        echo -e "Gateway:    ${RED}✗ Unhealthy${NC}"
    fi
    
    # Check PostgreSQL
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_isready -U openclaw &> /dev/null; then
        echo -e "PostgreSQL: ${GREEN}✓ Healthy${NC}"
    else
        echo -e "PostgreSQL: ${RED}✗ Unhealthy${NC}"
    fi
    
    # Check Redis
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T redis redis-cli ping &> /dev/null; then
        echo -e "Redis:      ${GREEN}✓ Healthy${NC}"
    else
        echo -e "Redis:      ${RED}✗ Unhealthy${NC}"
    fi
    
    echo ""
}

cmd_logs() {
    local service="${1:-}"
    
    if [[ -n "$service" ]]; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f "$service"
    else
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
    fi
}

cmd_shell() {
    local service="${1:-openclaw-gateway}"
    
    log_info "Opening shell in $service..."
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec "$service" /bin/bash
}

cmd_backup() {
    log_info "Creating backup..."
    
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/openclaw_backup_$timestamp.tar.gz"
    
    mkdir -p "$BACKUP_DIR"
    
    # Dump PostgreSQL
    log_info "Dumping PostgreSQL database..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        pg_dump -U openclaw openclaw > "$BACKUP_DIR/postgres_$timestamp.sql"
    
    # Create archive
    log_info "Creating backup archive..."
    tar -czf "$backup_file" \
        -C "$BACKUP_DIR" "postgres_$timestamp.sql"
    
    # Cleanup temp files
    rm -f "$BACKUP_DIR/postgres_$timestamp.sql"
    
    log_success "Backup created: $backup_file"
}

cmd_restore() {
    local backup_file="${1:-}"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Usage: ./deploy.sh restore <backup_file>"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warning "This will overwrite current data. Continue? (y/N)"
    read -r confirm
    
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring from backup..."
    
    # Extract backup
    local temp_dir
    temp_dir=$(mktemp -d)
    tar -xzf "$backup_file" -C "$temp_dir"
    
    # Restore PostgreSQL
    local sql_file
    sql_file=$(find "$temp_dir" -name "postgres_*.sql" | head -1)
    
    if [[ -n "$sql_file" ]]; then
        log_info "Restoring PostgreSQL database..."
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
            psql -U openclaw -d openclaw < "$sql_file"
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_success "Restore complete!"
}

cmd_metrics() {
    log_info "Resource Usage:"
    echo ""
    
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

cmd_security_scan() {
    log_info "Running security scan..."
    
    # Scan images for vulnerabilities
    for image in openclaw:production openclaw-sandbox:production openclaw-browser:production; do
        log_info "Scanning $image..."
        if command -v trivy &> /dev/null; then
            trivy image --severity HIGH,CRITICAL "$image" || true
        else
            log_warning "Trivy not installed. Install with: brew install trivy"
        fi
    done
    
    log_success "Security scan complete!"
}

cmd_clean() {
    log_info "Cleaning up stopped containers and unused images..."
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" rm -f
    docker image prune -f
    
    log_success "Cleanup complete!"
}

cmd_purge() {
    log_warning "This will delete ALL data including volumes. Continue? (type 'DELETE' to confirm)"
    read -r confirm
    
    if [[ "$confirm" != "DELETE" ]]; then
        log_info "Purge cancelled"
        exit 0
    fi
    
    log_info "Purging all data..."
    
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v --remove-orphans
    
    log_success "Purge complete!"
}

cmd_help() {
    echo "OpenClaw Production Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  setup              Initial setup (create .env, generate secrets)"
    echo "  build              Build Docker images"
    echo "  start [profile]    Start services (profiles: monitoring, browser, all)"
    echo "  stop               Stop all services"
    echo "  restart [profile]  Restart services"
    echo "  status             Show service status"
    echo "  health             Check service health"
    echo "  logs [service]     View logs (all services or specific)"
    echo "  shell [service]    Open shell in container"
    echo "  backup             Create backup"
    echo "  restore <file>     Restore from backup"
    echo "  metrics            Show resource usage"
    echo "  security-scan      Run security vulnerability scan"
    echo "  clean              Remove stopped containers"
    echo "  purge              DANGER: Delete all data"
    echo "  help               Show this help"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh setup"
    echo "  ./deploy.sh start monitoring"
    echo "  ./deploy.sh logs openclaw-gateway"
    echo "  ./deploy.sh backup"
}

#==============================================================================
# Main
#==============================================================================

main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        setup)          cmd_setup "$@" ;;
        build)          cmd_build "$@" ;;
        start)          cmd_start "$@" ;;
        stop)           cmd_stop "$@" ;;
        restart)        cmd_restart "$@" ;;
        status)         cmd_status "$@" ;;
        health)         cmd_health "$@" ;;
        logs)           cmd_logs "$@" ;;
        shell)          cmd_shell "$@" ;;
        backup)         cmd_backup "$@" ;;
        restore)        cmd_restore "$@" ;;
        metrics)        cmd_metrics "$@" ;;
        security-scan)  cmd_security_scan "$@" ;;
        clean)          cmd_clean "$@" ;;
        purge)          cmd_purge "$@" ;;
        help|--help|-h) cmd_help ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"

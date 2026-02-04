# OpenClaw Docker Deployment Modules

Comprehensive Docker deployment solution for OpenClaw AI Agent Platform with production-grade security, monitoring, and orchestration.

## Quick Start

```bash
# 1. Navigate to orchestration directory
cd docker-modules/orchestration

# 2. Run initial setup
./deploy.sh setup

# 3. Edit .env and add your CLAUDE_AI_SESSION_KEY
nano .env

# 4. Build images
./deploy.sh build

# 5. Start services
./deploy.sh start

# 6. Verify health
./deploy.sh health
```

## Directory Structure

```
docker-modules/
├── README.md                          # This file
├── base/
│   └── Dockerfile.production          # Production application container
├── sandbox/
│   ├── Dockerfile.sandbox             # Code execution sandbox
│   ├── Dockerfile.browser             # Browser automation sandbox
│   └── entrypoint.sh                  # Browser entrypoint script
├── security/
│   ├── seccomp-sandbox.json           # System call filtering
│   └── apparmor-sandbox               # Mandatory access control
├── orchestration/
│   ├── docker-compose.production.yml  # Production stack
│   ├── deploy.sh                      # Deployment automation
│   ├── .env.template                  # Environment template
│   └── init-db.sql                    # Database initialization
├── monitoring/
│   ├── prometheus.yml                 # Metrics collection
│   ├── alerts.yml                     # Alert rules
│   └── loki-config.yml                # Log aggregation
└── networking/
    └── (future network policies)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Platform                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Gateway    │  │     CLI      │  │   Web UI     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         └─────────────────┴─────────────────┘              │
│                          │                                  │
│         ┌────────────────┴────────────────┐                │
│  ┌──────▼───────┐                 ┌───────▼──────┐         │
│  │  PostgreSQL  │                 │    Redis     │         │
│  └──────────────┘                 └──────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Sandbox Environment                      │
│  ┌──────────────┐                 ┌──────────────┐         │
│  │    Code      │                 │   Browser    │         │
│  │   Sandbox    │                 │   Sandbox    │         │
│  └──────────────┘                 └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Production Ready
- Multi-stage Docker builds for optimized images
- Health checks for all services
- Automated restart policies
- Resource limits and quotas

### Enterprise Security
- Non-root execution for all containers
- Seccomp syscall filtering
- AppArmor mandatory access control
- Network isolation (sandbox has no internet)
- Capability restrictions

### Observability
- Prometheus metrics collection
- Loki log aggregation
- Pre-configured alert rules
- Resource monitoring

### Automation
- One-command deployment
- Automated secret generation
- Backup and restore
- Security scanning

## Commands

```bash
# Deployment
./deploy.sh setup          # Initial setup
./deploy.sh build          # Build images
./deploy.sh start          # Start services
./deploy.sh stop           # Stop services
./deploy.sh restart        # Restart services

# Monitoring
./deploy.sh status         # Service status
./deploy.sh health         # Health checks
./deploy.sh logs [service] # View logs
./deploy.sh metrics        # Resource usage

# Maintenance
./deploy.sh backup         # Create backup
./deploy.sh restore <file> # Restore backup
./deploy.sh security-scan  # Vulnerability scan
./deploy.sh shell <service> # Access container

# Cleanup
./deploy.sh clean          # Remove stopped containers
./deploy.sh purge          # DANGER: Delete all data
```

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Gateway | 18789 | Main API endpoint |
| Bridge | 18790 | Bridge API |
| VNC | 5900 | Browser sandbox VNC |
| noVNC | 6080 | Browser sandbox web |
| Prometheus | 9090 | Metrics (monitoring profile) |
| Loki | 3100 | Logs (monitoring profile) |

## Profiles

Start with specific profiles:

```bash
# Core services only
./deploy.sh start

# With monitoring
./deploy.sh start monitoring

# With browser sandbox
./deploy.sh start browser

# Everything
./deploy.sh start all
```

## Security

### Container Security
- All containers run as non-root users
- Read-only filesystems where possible
- Capability restrictions (CAP_DROP=ALL)
- No new privileges flag

### Network Security
- Internal network for service communication
- Isolated sandbox network (no internet access)
- TLS encryption support

### Sandbox Security
- Seccomp syscall filtering (200+ whitelisted calls)
- AppArmor profiles for filesystem/network restrictions
- Resource limits (memory, CPU, PIDs)
- Process isolation

## Environment Variables

Key configuration in `.env`:

```bash
# Required
CLAUDE_AI_SESSION_KEY=your-key-here

# Auto-generated
OPENCLAW_GATEWAY_TOKEN=
POSTGRES_PASSWORD=
OPENCLAW_ENCRYPTION_KEY=

# Optional
OPENCLAW_GATEWAY_PORT=18789
ENABLE_PROMETHEUS=false
```

## Backup & Recovery

```bash
# Create backup
./deploy.sh backup

# Restore from backup
./deploy.sh restore backups/openclaw_backup_20260203_120000.tar.gz
```

Backups include:
- PostgreSQL database dump
- Configuration data

## Troubleshooting

### View logs
```bash
./deploy.sh logs                    # All services
./deploy.sh logs openclaw-gateway   # Specific service
```

### Check health
```bash
./deploy.sh health
```

### Access container shell
```bash
./deploy.sh shell openclaw-gateway
./deploy.sh shell postgres
```

### Common issues

**Gateway not starting:**
```bash
./deploy.sh logs openclaw-gateway
# Check if .env has CLAUDE_AI_SESSION_KEY
```

**Database connection failed:**
```bash
./deploy.sh health
./deploy.sh logs postgres
```

**Out of memory:**
```bash
./deploy.sh metrics
# Increase limits in docker-compose.production.yml
```

## License

Part of the OpenClaw project. See main repository for license details.

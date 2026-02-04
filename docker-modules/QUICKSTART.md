# OpenClaw Docker Quick Start Guide

Get OpenClaw running in production with Docker in 5 minutes.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 20GB+ disk space

## Step 1: Setup

```bash
cd docker-modules/orchestration
./deploy.sh setup
```

This will:
- Check system requirements
- Create `.env` file from template
- Generate secure secrets automatically

## Step 2: Configure

Edit the `.env` file and add your Claude AI session key:

```bash
nano .env
# or
code .env
```

Find and set:
```
CLAUDE_AI_SESSION_KEY=your-session-key-here
```

## Step 3: Build

```bash
./deploy.sh build
```

This builds all Docker images (~5 minutes first time).

## Step 4: Start

```bash
./deploy.sh start
```

## Step 5: Verify

```bash
./deploy.sh health
```

You should see:
```
Gateway:    ✓ Healthy
PostgreSQL: ✓ Healthy
Redis:      ✓ Healthy
```

## Access Points

- **Gateway API**: http://localhost:18789
- **Bridge API**: http://localhost:18790

## Common Commands

```bash
# View logs
./deploy.sh logs

# Check status
./deploy.sh status

# Stop services
./deploy.sh stop

# Restart
./deploy.sh restart
```

## Optional: Enable Monitoring

```bash
./deploy.sh start monitoring
```

Access Prometheus at http://localhost:9090

## Optional: Enable Browser Sandbox

```bash
./deploy.sh start browser
```

Access noVNC at http://localhost:6080

## Next Steps

1. Read the full [README.md](README.md) for advanced configuration
2. Set up automated backups: `./deploy.sh backup`
3. Configure monitoring alerts
4. Review security profiles in `security/`

## Troubleshooting

**Services won't start:**
```bash
./deploy.sh logs
```

**Health check fails:**
```bash
./deploy.sh status
docker ps -a
```

**Reset everything:**
```bash
./deploy.sh stop
./deploy.sh purge  # WARNING: Deletes all data
./deploy.sh setup
```

#!/bin/bash
#
# Moltbot Automated Server Deployment
# Deploys complete Moltbot stack to a new server
#

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if target server is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <server-address> [ssh-port]"
    echo ""
    echo "Example:"
    echo "  $0 root@192.168.1.100"
    echo "  $0 user@example.com 2222"
    exit 1
fi

SERVER=$1
SSH_PORT=${2:-22}

print_status "Starting Moltbot deployment to $SERVER..."
echo ""

# Test SSH connection
print_status "Testing SSH connection..."
if ! ssh -p $SSH_PORT -o ConnectTimeout=10 $SERVER "echo 'Connection successful'"; then
    print_error "Cannot connect to $SERVER"
    exit 1
fi

# Step 1: Update system
print_status "[1/10] Updating system packages..."
ssh -p $SSH_PORT $SERVER "apt-get update -qq && apt-get upgrade -y -qq"

# Step 2: Install dependencies
print_status "[2/10] Installing dependencies..."
ssh -p $SSH_PORT $SERVER "apt-get install -y -qq curl git wget python3 python3-pip postgresql postgresql-contrib nginx docker.io docker-compose nodejs npm build-essential"

# Step 3: Clone repository
print_status "[3/10] Cloning Moltbot repository..."
ssh -p $SSH_PORT $SERVER "cd /opt && rm -rf moltbot && git clone https://github.com/flowerjunjie/moltbot.git moltbot"

# Step 4: Install Python dependencies
print_status "[4/10] Installing Python packages..."
ssh -p $SSH_PORT $SERVER "pip3 install -q psycopg2-binary psutil"

# Step 5: Setup database
print_status "[5/10] Setting up PostgreSQL database..."
ssh -p $SSH_PORT $SERVER "sudo -u postgres psql -c 'CREATE DATABASE moltbot;' && sudo -u postgres psql -c \"CREATE USER root WITH SUPERUSER;\" && sudo -u postgres psql -c 'ALTER USER root WITH PASSWORD;'\""

# Step 6: Create database tables
print_status "[6/10] Creating database tables..."
ssh -p $SSH_PORT $SERVER "psql -d moltbot << 'SQL'
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    model VARCHAR(100),
    tokens INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    device_name VARCHAR(100) UNIQUE NOT NULL,
    device_type VARCHAR(50),
    ip_address VARCHAR(50),
    last_seen TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'online'
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20),
    source VARCHAR(100),
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Statistics table
CREATE TABLE IF NOT EXISTS statistics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100),
    metric_value DOUBLE PRECISION,
    tags JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_device_session ON conversations(device_id, session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created ON system_logs(level, created_at DESC);
VACUUM ANALYZE;
SQL
"

# Step 7: Setup directories
print_status "[7/10] Setting up directories..."
ssh -p $SSH_PORT $SERVER "mkdir -p /opt/moltbot-monitoring /opt/moltbot-sync /opt/moltbot-backup/{database,sessions,disaster-recovery}"

# Step 8: Copy monitoring configuration
print_status "[8/10] Setting up monitoring stack..."
ssh -p $SSH_PORT $SERVER "cd /opt/moltbot-monitoring && cat > docker-compose.yml << 'YAML'
version: '2.3'
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: moltbot-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - \"9090:9090\"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: moltbot-grafana
    ports:
      - \"3000:3000\"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=moltbot2024
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: moltbot-node-exporter
    ports:
      - \"9100:9100\"
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
YAML

mkdir -p prometheus
cat > prometheus/prometheus.yml << 'YAML'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
YAML
"

# Step 9: Start services
print_status "[9/10] Starting services..."
ssh -p $SSH_PORT $SERVER "cd /opt/moltbot-monitoring && docker-compose up -d"

# Step 10: Setup automated tasks
print_status "[10/10] Setting up automation..."
ssh -p $SSH_PORT $SERVER "cat > /etc/cron.d/moltbot-auto << 'CRON'
# Moltbot Automated Tasks
*/5 * * * * root curl -s http://localhost:18800/api/health > /dev/null
0 2 * * * root /opt/moltbot-backup/backup.sh
CRON
"

# Summary
echo ""
print_status "========================================"
print_status "  Deployment Complete!"
print_status "========================================"
echo ""
echo "Server: $SERVER"
echo ""
echo "Services deployed:"
echo "  ✓ PostgreSQL (5432)"
echo "  ✓ Prometheus (9090)"
echo "  ✓ Grafana (3000) - admin/moltbot2024"
echo "  ✓ Node Exporter (9100)"
echo ""
echo "Next steps:"
echo "  1. SSH to server: ssh -p $SSH_PORT $SERVER"
echo "  2. Configure Moltbot: cd /opt/moltbot"
echo "  3. Start Gateway: npm start"
echo ""
echo "For full configuration guide, see:"
echo "  https://github.com/flowerjunjie/moltbot"
echo ""

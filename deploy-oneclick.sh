#!/bin/bash
#
# Moltbot One-Click Deployment
# Run this script on a fresh server to deploy complete Moltbot stack
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root"
    print_info "Please run: sudo $0"
    exit 1
fi

print_header "Moltbot One-Click Deployment v2.1"

# Display system info
print_info "System Information"
echo "  Hostname: $(hostname)"
echo "  OS: $(lsb_release -d | cut -f2)"
echo "  CPUs: $(nproc)"
echo "  Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "  Disk: $(df -h / | tail -1 | awk '{print $4}') available"
echo ""

# Confirm deployment
read -p "Continue with deployment? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    print_info "Deployment cancelled"
    exit 0
fi

echo ""

# Step 1: Update system
print_header "Step 1/12: Updating System"
apt-get update -qq
apt-get upgrade -y -qq
print_info "System updated"

# Step 2: Install dependencies
print_header "Step 2/12: Installing Dependencies"
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl \
    wget \
    git \
    python3 \
    python3-pip \
    postgresql \
    postgresql-contrib \
    nginx \
    docker.io \
    docker-compose \
    nodejs \
    npm \
    build-essential \
    iptables-persistent \
    keepalived \
    htop \
    vim \
    ufw

print_info "Dependencies installed"

# Step 3: Setup Docker
print_header "Step 3/12: Setting Up Docker"
systemctl start docker
systemctl enable docker
usermod -aG docker $SUDO_USER
print_info "Docker configured"

# Step 4: Clone repository
print_header "Step 4/12: Cloning Moltbot Repository"
cd /opt
rm -rf moltbot
git clone https://github.com/flowerjunjie/moltbot.git moltbot
cd moltbot
print_info "Repository cloned"

# Step 5: Install Python packages
print_header "Step 5/12: Installing Python Packages"
pip3 install -q psycopg2-binary psutil
print_info "Python packages installed"

# Step 6: Setup PostgreSQL
print_header "Step 6/12: Setting Up PostgreSQL"
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql -c "CREATE DATABASE moltbot;"
sudo -u postgres psql -c "CREATE USER root WITH SUPERUSER;"
sudo -u postgres psql -c "ALTER USER root WITH PASSWORD '';"

# Create tables
sudo -u postgres psql -d moltbot << 'SQL'
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

CREATE TABLE IF NOT EXISTS devices (
    device_name VARCHAR(100) UNIQUE NOT NULL,
    device_type VARCHAR(50),
    ip_address VARCHAR(50),
    last_seen TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'online'
);

CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20),
    source VARCHAR(100),
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS statistics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100),
    metric_value DOUBLE PRECISION,
    tags JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_device_session ON conversations(device_id, session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created ON system_logs(level, created_at DESC);
VACUUM ANALYZE;
SQL

print_info "PostgreSQL configured"

# Step 7: Setup directories
print_header "Step 7/12: Setting Up Directories"
mkdir -p /opt/moltbot-monitoring/{prometheus,grafana/provisioning/datasources,grafana/provisioning/dashboards}
mkdir -p /opt/moltbot-sync
mkdir -p /opt/moltbot-backup/{database,sessions,disaster-recovery}
mkdir -p /var/log/moltbot
print_info "Directories created"

# Step 8: Setup monitoring stack
print_header "Step 8/12: Setting Up Monitoring Stack"

# Prometheus config
cat > /opt/moltbot-monitoring/prometheus/prometheus.yml << 'YAML'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'moltbot-metrics'
    static_configs:
      - targets: ['host.docker.internal:9101']
    scrape_interval: 10s
YAML

# Grafana datasource
cat > /opt/moltbot-monitoring/grafana/provisioning/datasources/prometheus.yml << 'YAML'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
YAML

# Docker Compose
cat > /opt/moltbot-monitoring/docker-compose.yml << 'YAML'
version: '2.3'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: moltbot-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: moltbot-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=moltbot2024
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: moltbot-node-exporter
    ports:
      - "9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/host:ro,rslave
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
YAML

cd /opt/moltbot-monitoring
docker-compose up -d
print_info "Monitoring stack started"

# Step 9: Setup database API
print_header "Step 9/12: Setting Up Database API"

cat > /opt/moltbot-sync/db-api.py << 'PYTHON'
#!/usr/bin/env python3
# Database API for Moltbot

import os
import sys
import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import psycopg2

DB_CONFIG = {'host': '/var/run/postgresql', 'database': 'moltbot', 'user': 'root'}

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

class APIHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            try:
                conn = get_connection()
                conn.close()
                self.send_json({'status': 'healthy', 'database': 'connected'})
            except:
                self.send_json({'status': 'unhealthy', 'database': 'disconnected'}, 503)
        elif parsed.path == '/api/devices':
            conn = get_connection()
            cur = conn.cursor()
            cur.execute('SELECT * FROM devices')
            self.send_json({'devices': [dict(zip(['name', 'type', 'ip', 'last_seen', 'status'], row)) for row in cur.fetchall()]})
            conn.close()
        else:
            self.send_json({'error': 'Not found'}, 404)

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 18800), APIHandler)
    print('Database API running on port 18800')
    server.serve_forever()
PYTHON

chmod +x /opt/moltbot-sync/db-api.py

# Create systemd service
cat > /etc/systemd/system/moltbot-db-api.service << 'SERVICE'
[Unit]
Description=Moltbot Database API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/moltbot-sync
ExecStart=/usr/bin/python3 /opt/moltbot-sync/db-api.py
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable moltbot-db-api
systemctl start moltbot-db-api
print_info "Database API started on port 18800"

# Step 10: Setup metrics exporter
print_header "Step 10/12: Setting Up Metrics Exporter"

cat > /usr/local/bin/moltbot-metrics.py << 'PYTHON'
#!/usr/bin/env python3
import os
import psycopg2
from http.server import HTTPServer, BaseHTTPRequestHandler

DB_CONFIG = {'host': '/var/run/postgresql', 'database': 'moltbot', 'user': 'root'}

class MetricsHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def do_GET(self):
        try:
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()
            cur.execute('SELECT COUNT(*) FROM devices WHERE status = %s', ('online',))
            online = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM devices')
            total = cur.fetchone()[0]
            conn.close()

            metrics = f'''# HELP moltbot_online_devices Number of online devices
# TYPE moltbot_online_devices gauge
moltbot_online_devices {online}
# HELP moltbot_total_devices Total number of devices
# TYPE moltbot_total_devices gauge
moltbot_total_devices {total}'''

            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(metrics.encode())
        except Exception as e:
            self.send_response(500)
            self.end_headers()

HTTPServer(('0.0.0.0', 9101), MetricsHandler).serve_forever()
PYTHON

chmod +x /usr/local/bin/moltbot-metrics.py

# Create systemd service
cat > /etc/systemd/system/moltbot-metrics.service << 'SERVICE'
[Unit]
Description=Moltbot Metrics Exporter
After=network.target postgresql.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /usr/local/bin/moltbot-metrics.py
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable moltbot-metrics
systemctl start moltbot-metrics
print_info "Metrics exporter started on port 9101"

# Step 11: Setup automation
print_header "Step 11/12: Setting Up Automation"

# Backup script
cat > /usr/local/bin/moltbot-backup-auto.sh << 'SCRIPT'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U root moltbot | gzip > /opt/moltbot-backup/database/moltbot_$DATE.sql.gz
find /opt/moltbot-backup/database -name "*.sql.gz" -mtime -7 -delete
echo "Backup completed: $DATE"
SCRIPT

chmod +x /usr/local/bin/moltbot-backup-auto.sh

# Cron jobs
cat > /etc/cron.d/moltbot-auto << 'CRON'
# Moltbot Automation
*/5 * * * * root curl -s http://localhost:18800/api/health > /dev/null
0 2 * * * root /usr/local/bin/moltbot-backup-auto.sh
*/10 * * * * root /opt/moltbot-sync/sync-sessions.sh sync 2>/dev/null || true
CRON

print_info "Automation configured"

# Step 12: Setup firewall
print_header "Step 12/12: Setting Up Firewall"

cat > /etc/iptables.rules << 'RULES'
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]

-A INPUT -i lo -j ACCEPT
-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp --dport 443 -j ACCEPT
-A INPUT -s 192.168.0.0/16 -p tcp --dport 18789 -j ACCEPT
-A INPUT -s 10.0.0.0/8 -p tcp --dport 18789 -j ACCEPT
-A INPUT -s 192.168.0.0/16 -p tcp --dport 18800 -j ACCEPT
-A INPUT -s 10.0.0.0/8 -p tcp --dport 18800 -j ACCEPT
-A INPUT -p tcp --dport 3000 -j ACCEPT
-A INPUT -p tcp --dport 9090 -j ACCEPT
-A INPUT -p tcp --dport 9100 -j ACCEPT
-A INPUT -p tcp --dport 9101 -j ACCEPT
-A INPUT -p icmp --icmp-type echo-request -j ACCEPT
COMMIT
RULES

iptables-restore < /etc/iptables.rules
netfilter-persistent save
print_info "Firewall configured"

# Final summary
echo ""
print_header "Deployment Complete!"
echo ""
print_info "Services Status:"
echo "  ✓ PostgreSQL (5432)"
echo "  ✓ Database API (18800)"
echo "  ✓ Prometheus (9090)"
echo "  ✓ Grafana (3000) - admin/moltbot2024"
echo "  ✓ Node Exporter (9100)"
echo "  ✓ Metrics Exporter (9101)"
echo ""
print_info "Access URLs:"
echo "  Grafana:    http://$(hostname -I | cut -d' ' -f1):3000"
echo "  Prometheus: http://$(hostname -I | cut -d' ' -f1):9090"
echo "  Database API: http://$(hostname -I | cut -d' ' -f1):18800"
echo ""
print_info "Quick Commands:"
echo "  View logs:    journalctl -u moltbot-db-api -f"
echo "  Check status: systemctl status moltbot-*"
echo "  Run backup:  /usr/local/bin/moltbot-backup-auto.sh"
echo ""
print_info "Configuration files:"
echo "  Database config: /opt/moltbot-sync/"
echo "  Monitoring:      /opt/moltbot-monitoring/"
echo "  Backups:         /opt/moltbot-backup/"
echo ""
echo -e "${GREEN}Moltbot is now ready!${NC}"
echo ""

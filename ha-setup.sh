#!/bin/bash
#
# Moltbot High Availability (HA) Configuration
# Configures redundant services and automatic failover
#

set -e

SERVER="root@38.14.254.51"

echo "========================================"
echo "  Moltbot High Availability Setup"
echo "========================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Install keepalived for VIP management
echo "[1/6] Installing keepalived for Virtual IP..."
ssh $SERVER "apt-get install -y keepalived"

# Configure keepalived
ssh $SERVER "cat > /etc/keepalived/keepalived.conf << 'EOF'
vrrp_script chk_moltbot_gateway {
    script \"curl -f http://localhost:18789/health || exit 1\"
    interval 2
    weight 2
}

vrrp_instance VI_MOLTBOT {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 100
    advert_int 1

    authentication {
        auth_type PASS
        auth_pass moltbot2024
    }

    virtual_ipaddress {
        38.14.254.100/24
    }

    track_script {
        chk_moltbot_gateway
    }

    notify_master \"/usr/local/bin/ha_notify.sh master\"
    notify_backup \"/usr/local/bin/ha_notify.sh backup\"
    notify_fault \"/usr/local/bin/ha_notify.sh fault\"
}
EOF
"

echo "Keepalived configured"

# Step 2: Create HA notification script
echo "[2/6] Creating HA notification script..."
ssh $SERVER "cat > /usr/local/bin/ha_notify.sh << 'SCRIPT'
#!/bin/bash
# HA State Change Notification

STATE=\$1
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
LOG=/var/log/moltbot-ha.log

echo \"[\$TIMESTAMP] HA State changed to: \$STATE\" >> \$LOG

case \$STATE in
    master)
        # Promote to master - start all services
        systemctl start moltbot-gateway 2>/dev/null || true
        systemctl start moltbot-db-api 2>/dev/null || true
        echo \"This node is now MASTER\" | logger -t moltbot-ha
        ;;
    backup)
        # Demote to backup - keep services running but ready
        echo \"This node is now BACKUP\" | logger -t moltbot-ha
        ;;
    fault)
        # Fault state - alert and try to recover
        echo \"FAULT detected - attempting recovery\" | logger -t moltbot-ha -p error
        systemctl restart moltbot-gateway 2>/dev/null || true
        ;;
esac
SCRIPT
chmod +x /usr/local/bin/ha_notify.sh
"

echo "HA notification script created"

# Step 3: Setup PostgreSQL replication
echo "[3/6] Configuring PostgreSQL streaming replication..."
ssh $SERVER "cat > /etc/postgresql/14/main/conf.d/replication.conf << 'SQL'
# WAL Settings for Replication
wal_level = replica
max_wal_senders = 5
max_replication_slots = 5
hot_standby = on

# Replication Slots
wal_keep_size = 1GB
SQL

# Create replication user
psql -d moltbot -c \"CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_pass';\"
psql -d moltbot -c \"ALTER USER replicator WITH REPLICATION;\"
"

echo "PostgreSQL replication configured"

# Step 4: Create automated failover script
echo "[4/6] Creating failover automation..."
ssh $SERVER "cat > /usr/local/bin/moltbot-failover.sh << 'SCRIPT'
#!/bin/bash
# Automated Failover Script

GATEWAY_HEALTH_URL='http://localhost:18789/health'
DB_API_HEALTH_URL='http://localhost:18800/api/health'
CHECK_INTERVAL=10
FAIL_THRESHOLD=3
fail_count=0

log_message() {
    echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] \$1\" | tee -a /var/log/moltbot-failover.log
}

check_service() {
    local url=\$1
    local name=\$2

    if curl -sf \"\$url\" > /dev/null 2>&1; then
        log_message \"\$name is healthy\"
        return 0
    else
        log_message \"WARNING: \$name health check failed\"
        return 1
    fi
}

restart_service() {
    local service=\$1
    log_message \"Attempting to restart \$service...\"
    systemctl restart \$service
    sleep 5

    if systemctl is-active --quiet \$service; then
        log_message \"\$service restarted successfully\"
        return 0
    else
        log_message \"ERROR: Failed to restart \$service\"
        return 1
    fi
}

# Main monitoring loop
log_message \"Failover monitor started\"

while true; do
    gateway_ok=true
    db_api_ok=true

    # Check Gateway
    if ! check_service \"\$GATEWAY_HEALTH_URL\" \"Gateway\"; then
        gateway_ok=false
    fi

    # Check Database API
    if ! check_service \"\$DB_API_HEALTH_URL\" \"Database API\"; then
        db_api_ok=false
    fi

    # Handle failures
    if [ \"\$gateway_ok\" = false ] || [ \"\$db_api_ok\" = false ]; then
        fail_count=\$((fail_count + 1))
        log_message \"Fail count: \$fail_count/\$FAIL_THRESHOLD\"

        if [ \$fail_count -ge \$FAIL_THRESHOLD ]; then
            log_message \"CRITICAL: Threshold reached, initiating recovery\"

            if [ \"\$gateway_ok\" = false ]; then
                restart_service moltbot-gateway
            fi

            if [ \"\$db_api_ok\" = false ]; then
                restart_service moltbot-db-api
            fi

            # Check database
            if ! sudo -u postgres psql -c 'SELECT 1' >/dev/null 2>&1; then
                log_message \"PostgreSQL not responding, restarting...\"
                systemctl restart postgresql
            fi

            fail_count=0
        fi
    else
        fail_count=0
    fi

    sleep \$CHECK_INTERVAL
done
SCRIPT
chmod +x /usr/local/bin/moltbot-failover.sh
"

echo "Failover script created"

# Step 5: Create systemd service for failover monitor
echo "[5/6] Creating failover monitor service..."
ssh $SERVER "cat > /etc/systemd/system/moltbot-failover.service << 'SERVICE'
[Unit]
Description=Moltbot Failover Monitor
After=network.target moltbot-gateway.service

[Service]
Type=simple
ExecStart=/usr/local/bin/moltbot-failover.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable moltbot-failover
systemctl start moltbot-failover
"

echo "Failover monitor service started"

# Step 6: Create disaster recovery backup
echo "[6/6] Creating disaster recovery backup..."
ssh $SERVER "cat > /usr/local/bin/moltbot-dr-backup.sh << 'SCRIPT'
#!/bin/bash
# Disaster Recovery Backup
# Creates complete system backup for DR purposes

DR_BACKUP_DIR=\"/opt/moltbot-backup/disaster-recovery\"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \"\$DR_BACKUP_DIR\"

echo \"[\$(date)] Starting disaster recovery backup...\"

# 1. Full database dump
echo \"Backing up PostgreSQL...\"
pg_dumpall -U root | gzip > \"\$DR_BACKUP_DIR/pg_all_\${DATE}.sql.gz\"

# 2. Configuration files
echo \"Backing up configurations...\"
mkdir -p \"\$DR_BACKUP_DIR/config_\${DATE}\"
cp -r /root/.clawdbot/* \"\$DR_BACKUP_DIR/config_\${DATE}/\" 2>/dev/null || true
cp -r /opt/moltbot-monitoring/*.json \"\$DR_BACKUP_DIR/config_\${DATE}/\" 2>/dev/null || true
cp -r /etc/moltbot* \"\$DR_BACKUP_DIR/config_\${DATE}/\" 2>/dev/null || true

# 3. Docker volumes
echo \"Backing up Docker volumes...\"
docker run --rm -v moltbot-monitoring_grafana-data:/data -v \"\$DR_BACKUP_DIR\":/backup busybox tar czf \"/backup/grafana_\${DATE}.tar.gz\" -C /data .
docker run --rm -v moltbot-monitoring_prometheus-data:/data -v \"\$DR_BACKUP_DIR\":/backup busybox tar czf \"/backup/prometheus_\${DATE}.tar.gz\" -C /data .

# 4. System state
echo \"Capturing system state...\"
dpkg --get-selections > \"\$DR_BACKUP_DIR/packages_\${DATE}.list\"
iptables-save > \"\$DR_BACKUP_DIR/iptables_\${DATE}.rules\"

# 5. Create recovery manifest
cat > \"\$DR_BACKUP_DIR/manifest_\${DATE}.txt\" << MANIFEST
Disaster Recovery Backup
Date: \$(date)
Hostname: \$(hostname)
IP Address: \$(hostname -I | cut -d' ' -f1)

Contents:
- PostgreSQL full dump: pg_all_\${DATE}.sql.gz
- Configurations: config_\${DATE}/
- Grafana data: grafana_\${DATE}.tar.gz
- Prometheus data: prometheus_\${DATE}.tar.gz
- Package list: packages_\${DATE}.list
- Firewall rules: iptables_\${DATE}.rules

To restore:
1. Install PostgreSQL: apt-get install postgresql
2. Restore database: gunzip -c pg_all_\${DATE}.sql.gz | psql
3. Restore configs: cp -r config_\${DATE}/* /
4. Restore Docker: docker load < backups/*.tar
5. Restore packages: dpkg --set-selections < packages_\${DATE}.list
6. Restore firewall: iptables-restore < iptables_\${DATE}.rules
MANIFEST

# 6. Cleanup old DR backups (keep last 3)
find \"\$DR_BACKUP_DIR\" -name \"pg_all_*.sql.gz\" -type f | sort -r | tail -n +4 | xargs rm -f
find \"\$DR_BACKUP_DIR\" -name \"config_*\" -type d | sort -r | tail -n +4 | xargs rm -rf

# 7. Upload to remote storage (optional)
# You can add S3, rsync, or other remote backup here

SIZE=\$(du -sh \"\$DR_BACKUP_DIR\" | cut -f1)
echo \"[\$(date)] DR backup completed. Size: \$SIZE\"
SCRIPT
chmod +x /usr/local/bin/moltbot-dr-backup.sh
"

echo "Disaster recovery backup script created"

# Summary
echo ""
echo "========================================"
echo "  HA Configuration Complete!"
echo "========================================"
echo ""
echo "Configured Components:"
echo "  ✓ Keepalived - Virtual IP (38.14.254.100)"
echo "  ✓ HA notification script"
echo "  ✓ PostgreSQL replication setup"
echo "  ✓ Automated failover monitor"
echo "  ✓ Disaster recovery backup"
echo ""
echo "Services:"
echo "  moltbot-failover.service - Monitor & auto-recovery"
echo "  keepalived.service - VIP management"
echo ""
echo "Commands:"
echo "  /usr/local/bin/moltbot-failover.sh - Manual failover"
echo "  /usr/local/bin/moltbot-dr-backup.sh - DR backup"
echo "  systemctl status moltbot-failover - Check status"
echo ""
echo "Note: For full HA, deploy a secondary server with"
echo "      priority 50 in keepalived.conf"
echo ""

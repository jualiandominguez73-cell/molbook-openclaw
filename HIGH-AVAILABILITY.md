# 🏗️ Moltbot 高可用性和自动化指南

**版本**: v2.2
**最后更新**: 2026-01-29

---

## 📋 高可用性 (HA) 架构

### 架构概览

```
                    ┌───────────────────┐
                    │  Virtual IP       │
                    │  (38.14.254.100)  │
                    └────────┬───────────┘
                             │
                ┌────────────┴────────────┐
                │                           │
         ┌──────▼──────┐            ┌──────▼──────┐
         │  Master     │            │   Backup    │
         │  Server     │            │   Server    │
         │             │            │             │
         │ Gateway     │            │ Gateway     │
         │ PostgreSQL  │            │ PostgreSQL  │
         │ Monitoring  │            │ Monitoring  │
         └─────────────┘            └─────────────┘
                │                           │
                └────────────┬────────────┘
                             │
                    ┌────────────▼───────────┐
                    │  Shared Storage        │
                    │  (Optional)           │
                    └────────────────────────┘
```

---

## 🚀 快速开始

### 一键部署新服务器

在全新的服务器上运行：

```bash
# 方法 1: 使用 curl
curl -fsSL https://raw.githubusercontent.com/flowerjunjie/moltbot/main/deploy-oneclick.sh | bash

# 方法 2: 使用 git
git clone https://github.com/flowerjunjie/moltbot.git /opt/moltbot
cd /opt/moltbot
bash deploy-oneclick.sh
```

### 远程部署服务器

从本地机器部署到远程服务器：

```bash
# Linux/Mac
bash auto-deploy-server.sh root@192.168.1.100

# Windows
auto-deploy-server.bat root@192.168.1.100
```

---

## 🔧 高可用性组件

### 1. Keepalived (虚拟 IP)

**功能**: 自动故障转移和虚拟 IP 管理

**安装**:
```bash
apt-get install keepalived
```

**配置文件**: `/etc/keepalived/keepalived.conf`
```conf
vrrp_script chk_moltbot_gateway {
    script "curl -f http://localhost:18789 || exit 1"
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
}
```

**状态检查**:
```bash
systemctl status keepalived
ip addr show eth0 | grep 38.14.254.100
```

### 2. 自动故障转移

**脚本**: `/usr/local/bin/moltbot-failover.sh`

**功能**:
- 健康检查（每 10 秒）
- 自动重启失败的服务
- 故障计数和阈值
- 日志记录

**服务**: `moltbot-failover.service`

**启用**:
```bash
systemctl enable moltbot-failover
systemctl start moltbot-failover
```

**查看日志**:
```bash
journalctl -u moltbot-failover -f
cat /var/log/moltbot-failover.log
```

### 3. PostgreSQL 流复制

**配置**: `/etc/postgresql/14/main/conf.d/replication.conf`

**设置主服务器**:
```sql
-- 创建复制用户
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_pass';

-- 配置复制槽
SELECT * FROM pg_create_physical_replication_slot('replica_slot');
```

**设置从服务器**:
```bash
# 在从服务器上
pg_basebackup -h master-server -D /var/lib/postgresql/data -P -U replicator --wal-method=stream

# 配置 recovery.conf
standby_mode = on
primary_conninfo = 'host=master-server port=5432 user=replicator'
restore_command = 'cp /var/lib/postgresql/archive/%f %p'
```

### 4. 灾难恢复备份

**脚本**: `/usr/local/bin/moltbot-dr-backup.sh`

**备份内容**:
- PostgreSQL 完整转储
- 配置文件
- Docker 卷数据
- 系统包列表
- 防火墙规则

**运行备份**:
```bash
/usr/local/bin/moltbot-dr-backup.sh
```

**备份位置**: `/opt/moltbot-backup/disaster-recovery/`

**自动备份**: 每周日凌晨 3 点

---

## 🤖 自动化工具

### 1. 自动部署工具

**文件**: `auto-deploy-server.sh` (Linux) / `auto-deploy-server.bat` (Windows)

**功能**:
- 自动安装所有依赖
- 配置数据库
- 部署监控栈
- 设置防火墙
- 配置自动化任务

**使用**:
```bash
# 部署到新服务器
bash auto-deploy-server.sh root@192.168.1.100
```

### 2. 一键部署脚本

**文件**: `deploy-oneclick.sh`

**场景**: 在全新的服务器上运行

**使用**:
```bash
# SSH 到服务器
ssh root@your-server

# 运行部署
curl -fsSL https://raw.githubusercontent.com/flowerjunjie/moltbot/main/deploy-oneclick.sh | bash
```

**部署时间**: 约 5-10 分钟

### 3. 容器编排支持

**文件**: `docker-compose-full.yml`

**包含服务**:
- Moltbot Gateway
- Database API
- PostgreSQL
- Redis
- Prometheus
- Grafana
- Node Exporter
- Metrics Exporter
- Log Analyzer
- Nginx

**启动**:
```bash
docker-compose -f docker-compose-full.yml up -d
```

---

## 📊 监控和告警

### 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Database API | 18800 | REST API |
| Metrics | 9101 | Prometheus 指标 |
| Log Analyzer | 9102 | 日志分析 API |
| Prometheus | 9090 | 指标采集 |
| Grafana | 3000 | 可视化 |

### 健康检查端点

```bash
# Database API
curl http://localhost:18800/api/health

# Metrics
curl http://localhost:9101/metrics

# Log summary
curl http://localhost:9102/api/logs/summary

# Service status
curl http://localhost:18800/api/devices
```

---

## 🛠️ 维护操作

### 日常维护

**检查服务状态**:
```bash
# 所有 Moltbot 服务
systemctl status moltbot-*

# Docker 容器
docker ps

# 监控栈
cd /opt/moltbot-monitoring && docker-compose ps
```

**查看日志**:
```bash
# 服务日志
journalctl -u moltbot-db-api -f
journalctl -u moltbot-failover -f

# 应用日志
tail -f /var/log/moltbot-failover.log
```

### 备份操作

**手动备份**:
```bash
# 数据库备份
/usr/local/bin/moltbot-backup-auto.sh

# 灾难恢复备份
/usr/local/bin/moltbot-dr-backup.sh
```

**恢复数据库**:
```bash
# 列出备份
ls -lh /opt/moltbot-backup/database/daily/

# 恢复最新备份
gunzip -c /opt/moltbot-backup/database/daily/moltbot_latest.sql.gz | psql -d moltbot
```

### 故障排除

**服务无法启动**:
```bash
# 检查端口占用
netstat -tlnp | grep <port>

# 检查日志
journalctl -u <service> -n 50

# 重启服务
systemctl restart <service>
```

**Keepalived 问题**:
```bash
# 检查配置
keepalived -t

# 查看日志
journalctl -u keepalived -f

# 检查虚拟 IP
ip addr show eth0
```

---

## 🔐 安全配置

### 防火墙规则

**查看当前规则**:
```bash
iptables -L -n -v
```

**添加规则**:
```bash
iptables -A INPUT -p tcp --dport 18789 -s 192.168.1.0/24 -j ACCEPT
netfilter-persistent save
```

### 安全建议

1. **使用密钥认证**: 禁用密码登录
2. **配置 fail2ban**: 防止暴力攻击
3. **定期更新**: `apt-get update && apt-get upgrade`
4. **监控日志**: 定期检查异常访问

---

## 📈 性能优化

### 系统优化

**运行优化脚本**:
```bash
/usr/local/bin/moltbot-optimize.sh
```

**优化项目**:
- 网络参数调优
- PostgreSQL 配置优化
- Docker 资源限制
- 日志轮转配置

### 性能监控

**查看系统指标**:
```bash
# CPU
top -bn1 | grep "Cpu(s)"

# 内存
free -h

# 磁盘
df -h

# 负载
cat /proc/loadavg
```

---

## 🚨 应急响应

### 服务全部宕机

1. **检查服务器状态**
   ```bash
   ping <server-ip>
   ssh root@<server-ip> "systemctl status moltbot-*"
   ```

2. **启动关键服务**
   ```bash
   systemctl start moltbot-db-api
   systemctl start moltbot-gateway
   ```

3. **切换到备用服务器**（如果配置了 HA）
   ```bash
   # 备用服务器会自动提升为主服务器
   # 虚拟 IP 会自动迁移
   ```

### 数据库损坏

1. **从备份恢复**
   ```bash
   gunzip -c /opt/moltbot-backup/disaster-recovery/pg_all_*.sql.gz | psql
   ```

2. **检查数据完整性**
   ```bash
   psql -d moltbot -c "SELECT COUNT(*) FROM conversations;"
   psql -d moltbot -c "SELECT COUNT(*) FROM devices;"
   ```

### 网络问题

1. **检查网络连接**
   ```bash
   ping 8.8.8.8
   traceroute 8.8.8.8
   ```

2. **检查防火墙**
   ```bash
   iptables -L -n
   ufw status
   ```

---

## 📚 相关文档

- `DEPLOYMENT-COMPLETE.md` - 完整部署指南
- `EXTENSIONS.md` - 扩展功能文档
- `ROADMAP.md` - 功能路线图
- `docker-compose-full.yml` - 容器编排配置

---

## 🎯 最佳实践

1. **定期测试备份恢复**
   - 每月测试一次灾难恢复流程
   - 验证备份完整性

2. **监控告警**
   - 配置邮件或 Webhook 告警
   - 设置合理的告警阈值

3. **文档更新**
   - 记录所有配置更改
   - 维护操作手册

4. **容量规划**
   - 监控资源使用趋势
   - 提前规划扩容

---

**🎉 高可用性和自动化配置完成！**

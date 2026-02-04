# OpenClaw Configuration & Security Setup

Complete configuration package with all capabilities enabled and comprehensive security monitoring.

---

## 📦 What's Included

### **Configuration Files**

1. **openclaw-config.json** - Master configuration
   - All features enabled
   - Security hardening
   - AI provider settings
   - Data collection preferences
   - Backup and monitoring

2. **security-config.json** - Security configuration
   - Vulnerability scanning
   - Threat detection
   - Access control
   - Audit logging
   - Incident response

### **Security Tools**

3. **security_monitor.py** - Security monitoring & vulnerability scanner
   - Scans Python dependencies for CVEs
   - Checks configuration for security issues
   - Monitors network connections
   - Analyzes security logs
   - Generates comprehensive reports

4. **setup_openclaw.py** - Automated setup script
   - Creates directory structure
   - Installs all configurations
   - Runs initial security scan
   - Provides next steps

### **Integration with Previous Modules**

This package works with the security modules you already have:
- `migrate_credentials.py` - Moves API keys to OS keychain
- `secure_config.py` - Secure credential access
- `secure_file_access.py` - Path traversal protection
- `encrypted_vault.py` - Encrypted data storage

---

## 🚀 Quick Start

### **Option 1: Automated Setup (Recommended)**

```bash
# Run the setup script
python3 setup_openclaw.py --enable-all

# This will:
# - Create ~/.openclaw directory structure
# - Install all config files
# - Install security modules
# - Run initial security scan
# - Install dependencies
```

### **Option 2: Manual Setup**

```bash
# 1. Create directories
mkdir -p ~/.openclaw/{config,logs/security,data,backups,modules}

# 2. Copy configuration files
cp openclaw-config.json ~/.openclaw/config/
cp security-config.json ~/.openclaw/config/

# 3. Copy security tools
cp security_monitor.py ~/.openclaw/modules/
cp migrate_credentials.py ~/.openclaw/modules/
cp secure_*.py ~/.openclaw/modules/

# 4. Set permissions
chmod 700 ~/.openclaw
chmod 600 ~/.openclaw/config/*.json
chmod 700 ~/.openclaw/modules/*.py

# 5. Install dependencies
pip install keyring cryptography safety --break-system-packages
```

---

## 🔒 Security Setup (Critical!)

### **Step 1: Migrate Credentials**

```bash
# Move API keys from plaintext to OS keychain
python3 ~/.openclaw/modules/migrate_credentials.py

# Or set manually:
python3 -c "
from secure_config import set_credential
set_credential('anthropic_api_key', 'your-actual-key-here')
"
```

### **Step 2: Run Security Scan**

```bash
# Full security report
python3 ~/.openclaw/modules/security_monitor.py --report

# Just dependency scan
python3 ~/.openclaw/modules/security_monitor.py --scan

# Monitor logs
python3 ~/.openclaw/modules/security_monitor.py --monitor
```

### **Step 3: Review Configuration**

```bash
# Check master config
cat ~/.openclaw/config/openclaw-config.json

# Check security config
cat ~/.openclaw/config/security-config.json
```

---

## 📋 Configuration Overview

### **openclaw-config.json**

```json
{
  "security": {
    "enabled": true,                    // Enable security features
    "credential_storage": "os_keychain", // Use OS keychain (NOT plaintext!)
    "encryption_enabled": true,         // Encrypt data at rest
    "audit_logging": true,              // Log all security events
    "rate_limiting": true               // Prevent DoS
  },
  
  "features": {
    "encrypted_vault": {
      "enabled": true                   // Secure data storage
    },
    "persona_system": {
      "enabled": true,                  // Context-aware responses
      "auto_detect_context": true
    },
    "data_collectors": {
      "file_collector": {
        "enabled": true                 // Index documents
      },
      "app_usage_collector": {
        "enabled": false                // Privacy: disabled by default
      }
    },
    "insight_engine": {
      "enabled": true,                  // Generate daily insights
      "min_confidence": 0.7
    }
  }
}
```

### **security-config.json**

```json
{
  "vulnerability_scanning": {
    "enabled": true,                    // Scan for CVEs
    "auto_scan": true,
    "scan_schedule": "daily"
  },
  
  "threat_detection": {
    "enabled": true,
    "intrusion_detection": {
      "enabled": true                   // Detect attacks
    },
    "prompt_injection_detection": {
      "enabled": true                   // Block prompt injection
    }
  },
  
  "access_control": {
    "file_access": {
      "whitelist_mode": true,           // Only allowed dirs
      "follow_symlinks": false          // Prevent symlink attacks
    }
  }
}
```

---

## 🛡️ Security Features Enabled

### **1. Credential Protection**
- ✅ API keys stored in OS keychain (NOT plaintext files)
- ✅ Automatic migration from plaintext
- ✅ Secure retrieval via `secure_config.py`

### **2. Encryption**
- ✅ AES-256-GCM for data at rest
- ✅ Per-record encryption keys
- ✅ Master key in OS keychain
- ✅ TLS for data in transit

### **3. Access Control**
- ✅ Directory whitelisting for file access
- ✅ Symlink attack prevention
- ✅ Path traversal protection
- ✅ Command execution whitelist

### **4. Vulnerability Scanning**
- ✅ Daily dependency scans for CVEs
- ✅ Configuration security checks
- ✅ Network monitoring
- ✅ Log analysis

### **5. Threat Detection**
- ✅ Prompt injection detection
- ✅ Failed login monitoring
- ✅ Suspicious activity alerts
- ✅ Malware scanning (file uploads)

### **6. Audit Logging**
- ✅ All security events logged
- ✅ 90-day retention
- ✅ Encrypted log storage
- ✅ Forensic-ready format

---

## 📊 Using the Security Monitor

### **Generate Security Report**

```bash
python3 security_monitor.py --report
```

**Output:**
```
======================================================================
OpenClaw Security Report
======================================================================

Generated: 2026-02-01T10:00:00
Security Score: 85/100 (GOOD)

📦 Dependency Scan:
   Total packages: 45
   Vulnerable: 2

   ⚠️  Vulnerabilities found:
      • requests (medium): CVE-2023-XXXXX
      • urllib3 (low): CVE-2023-XXXXX

⚙️  Configuration Scan:
   Issues found: 1
      • [MEDIUM] Insecure file permissions on config.json

📋 Log Analysis:
   Failed auth attempts: 0
   Blocked requests: 3
   Errors: 12

======================================================================

⚠️  RECOMMENDATIONS:
   1. Update vulnerable dependencies: pip install --upgrade requests
   2. Fix file permissions: chmod 600 ~/.openclaw/config/config.json
```

### **Scan Dependencies Only**

```bash
python3 security_monitor.py --scan

# Output:
# Running dependency scan...
# Found 2 vulnerable packages
# 
# Running configuration scan...
# Found 1 configuration issues
```

### **Monitor Security Logs**

```bash
python3 security_monitor.py --monitor

# Output:
# Monitoring security logs...
# 
# Failed auth attempts: 0
# Blocked requests: 3
# Errors: 12
```

---

## 🔧 Customizing Configuration

### **Enable/Disable Features**

Edit `~/.openclaw/config/openclaw-config.json`:

```json
{
  "features": {
    "data_collectors": {
      "app_usage_collector": {
        "enabled": false    // ← Change to true to enable
      }
    }
  }
}
```

### **Adjust Security Settings**

Edit `~/.openclaw/config/security-config.json`:

```json
{
  "vulnerability_scanning": {
    "scan_schedule": "weekly"  // ← Change from "daily"
  }
}
```

### **Add Allowed Directories**

```json
{
  "security": {
    "allowed_directories": [
      "~/Documents",
      "~/Downloads",
      "~/MyProject"  // ← Add custom directory
    ]
  }
}
```

---

## 📁 Directory Structure

After setup, you'll have:

```
~/.openclaw/
├── config/
│   ├── openclaw-config.json       # Master configuration
│   └── security-config.json       # Security settings
├── logs/
│   ├── security/
│   │   ├── security.log          # Security events
│   │   └── audit.log             # Audit trail
│   ├── application.log           # App logs
│   └── initialization.log        # Setup log
├── modules/
│   ├── migrate_credentials.py    # Credential migration
│   ├── secure_config.py          # Secure config loader
│   ├── secure_file_access.py     # File access protection
│   ├── encrypted_vault.py        # Encrypted storage
│   └── security_monitor.py       # Security scanner
├── data/
│   └── vault.db                  # Encrypted database
├── reports/
│   └── security/
│       └── security_report_*.json # Security reports
├── backups/                      # Automatic backups
└── cache/                        # Temporary cache
```

---

## 🔍 Verifying Security

### **Check Credential Storage**

```bash
# ❌ BAD: Should NOT see API keys
grep -r "sk-" ~/.openclaw/config/

# ✅ GOOD: API keys in keychain
python3 -c "
from secure_config import get_config
config = get_config()
status = config.verify_credentials()
print(status)
"
```

### **Check File Permissions**

```bash
# All should be 600 or 700
ls -la ~/.openclaw/config/
ls -la ~/.openclaw/data/
```

### **Check Encryption**

```bash
# Should show binary encrypted data, NOT readable text
sqlite3 ~/.openclaw/data/vault.db "SELECT * FROM encrypted_data LIMIT 1;"
```

---

## 🆘 Troubleshooting

### **"Module not found" errors**

```bash
# Add to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:~/.openclaw/modules"

# Or install in the script directory
cd ~/.openclaw/modules
python3 security_monitor.py
```

### **"Permission denied" on logs**

```bash
# Fix permissions
chmod 700 ~/.openclaw
chmod 600 ~/.openclaw/config/*.json
chmod 700 ~/.openclaw/logs
```

### **Security scan fails**

```bash
# Install missing dependencies
pip install safety --break-system-packages

# Or disable dependency scanning
# Edit security-config.json:
# "dependency_scanning": { "enabled": false }
```

---

## 📚 Related Documentation

- **OPENCLAW-SECURITY-HARDENING.md** - Complete security guide
- **AXIS-INTEGRATION-GUIDE.md** - Feature integration roadmap
- **migrate_credentials.py** - Credential migration tool
- **encrypted_vault.py** - Encrypted storage module

---

## ✅ Security Checklist

After setup, verify:

- [ ] All API keys moved to OS keychain (not in files)
- [ ] `openclaw-config.json` has no plaintext credentials
- [ ] File permissions are restrictive (600/700)
- [ ] Security monitor runs successfully
- [ ] Vault database is encrypted
- [ ] Security logs are being written
- [ ] Initial security report shows good score

---

## 🎯 Next Steps

1. **Run setup**: `python3 setup_openclaw.py --enable-all`
2. **Migrate credentials**: `python3 migrate_credentials.py`
3. **Security scan**: `python3 security_monitor.py --report`
4. **Review configs**: Check `~/.openclaw/config/`
5. **Start using OpenClaw** with all capabilities enabled!

---

## 🔐 Security Notice

This configuration enables comprehensive security monitoring and protection. All sensitive data is encrypted, credentials are in OS keychain, and suspicious activity is logged.

**Important:**
- Never commit config files with API keys to git
- Regularly review security reports
- Keep dependencies updated
- Monitor audit logs for suspicious activity

---

**Last Updated:** February 1, 2026  
**Version:** 1.0.0

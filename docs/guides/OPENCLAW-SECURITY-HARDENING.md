# 🔒 OpenClaw Security Hardening Guide

Complete guide to securing OpenClaw after installation and fixing critical vulnerabilities.

---

## 📋 TABLE OF CONTENTS

- [Critical Fixes (Do Immediately)](#critical-fixes)
- [High Priority Fixes](#high-priority-fixes)
- [Medium Priority Fixes](#medium-priority-fixes)
- [Ongoing Security Practices](#ongoing-security)
- [Security Verification Checklist](#verification-checklist)

---

## 🚨 CRITICAL FIXES (Within 24 Hours)

### FIX #1: Secure Credential Storage

**Current Risk:** API keys stored in plaintext files accessible to malware

**Solution:** Migrate to OS-level secure storage

#### Step 1: Identify Current Credentials

```bash
# Find all credential files
find ~/.openclaw -type f \( -name "*.json" -o -name "*.yaml" -o -name "*.env" \)

# Search for credentials in config
grep -r "api_key\|token\|password\|secret" ~/.openclaw/ 2>/dev/null

# Check what's exposed
ls -la ~/.openclaw/
```

#### Step 2: Install Secure Storage Library

```bash
# macOS/Linux
pip install keyring --break-system-packages

# Windows (requires pywin32)
pip install keyring pywin32 --break-system-packages

# Verify installation
python3 -c "import keyring; print(keyring.get_keyring())"
```

#### Step 3: Backup Current Configuration

```bash
# Create backup directory
mkdir -p ~/.openclaw/backups

# Backup all configs
cp ~/.openclaw/config.json ~/.openclaw/backups/config.json.$(date +%Y%m%d)
cp ~/.openclaw/.env ~/.openclaw/backups/.env.$(date +%Y%m%d) 2>/dev/null || true

# Verify backups
ls -lh ~/.openclaw/backups/
```

#### Step 4: Run Migration Script

See `migrate_credentials.py` in the modules package.

```bash
python3 migrate_credentials.py
```

#### Step 5: Verify Secure Storage

```bash
# Test credential retrieval
python3 -c "
import keyring
key = keyring.get_password('OpenClaw', 'anthropic_api_key')
print('✅ Credentials accessible' if key else '❌ Migration failed')
"
```

#### Step 6: Update OpenClaw Configuration

Replace credential access in OpenClaw code:

```python
# ❌ OLD (insecure)
import json
with open('~/.openclaw/config.json') as f:
    config = json.load(f)
api_key = config['anthropic_api_key']

# ✅ NEW (secure)
import keyring
api_key = keyring.get_password('OpenClaw', 'anthropic_api_key')
```

---

### FIX #2: File Access Path Traversal Protection

**Current Risk:** Malicious queries can access files outside allowed directories

**Solution:** Implement strict path validation

#### Step 1: Locate File Access Code

```bash
# Find file read/write operations
grep -rn "open(" ~/.openclaw/ | grep -v ".pyc"
grep -rn "read_file\|write_file" ~/.openclaw/
```

#### Step 2: Create Secure File Access Module

See `secure_file_access.py` in modules package.

#### Step 3: Replace Unsafe File Operations

```python
# ❌ UNSAFE
def read_file(path: str):
    with open(path, 'r') as f:
        return f.read()

# ✅ SAFE
from secure_file_access import SecureFileAccess

file_access = SecureFileAccess(allowed_dirs=[
    str(Path.home() / "Documents"),
    str(Path.home() / "Downloads"),
])

def read_file(path: str):
    return file_access.read_file(path)
```

---

### FIX #3: Network Access Control

**Current Risk:** OpenClaw can connect to any domain without restrictions

**Solution:** Implement domain whitelist and TLS verification

#### Step 1: Create Network Policy

```bash
# Create network policy file
cat > ~/.openclaw/network_policy.json << 'EOF'
{
  "allowed_domains": [
    "api.anthropic.com",
    "api.openai.com",
    "github.com",
    "pypi.org"
  ],
  "blocked_domains": [
    "*.cn",
    "*.ru",
    "temp-mail.org",
    "pastebin.com"
  ],
  "require_tls": true,
  "verify_certificates": true
}
EOF
```

#### Step 2: Implement Network Guard

See `network_guard.py` in modules package.

---

### FIX #4: Input Validation & Sanitization

**Current Risk:** User input directly passed to system commands and LLM

**Solution:** Validate and sanitize all inputs

#### Step 1: Create Input Validator

See `input_validator.py` in modules package.

#### Step 2: Apply to All User Inputs

```python
from input_validator import InputValidator

validator = InputValidator()

# Before processing any user input:
def process_query(user_query: str):
    # Validate
    is_valid, error = validator.validate_query(user_query)
    if not is_valid:
        raise ValueError(f"Invalid input: {error}")
    
    # Sanitize
    safe_query = validator.sanitize(user_query)
    
    # Process safely
    return execute_query(safe_query)
```

---

### FIX #5: Command Execution Restrictions

**Current Risk:** LLM can execute arbitrary system commands

**Solution:** Whitelist allowed commands and require confirmation

#### Step 1: Create Command Whitelist

```bash
cat > ~/.openclaw/allowed_commands.json << 'EOF'
{
  "allowed_commands": [
    "ls",
    "cat",
    "grep",
    "find",
    "git",
    "python3"
  ],
  "blocked_patterns": [
    "rm -rf",
    "sudo",
    "chmod 777",
    "curl.*|.*sh",
    "wget.*|.*sh",
    "nc -l",
    "dd if="
  ],
  "require_confirmation": true
}
EOF
```

#### Step 2: Implement Command Guard

See `command_guard.py` in modules package.

---

## 🔴 HIGH PRIORITY FIXES (Within 1 Week)

### FIX #6: Add Authentication Layer

**Current Risk:** Anyone with network access can use OpenClaw

**Solution:** Implement authentication

#### Option A: API Token Authentication

```bash
# Generate secure API token
python3 -c "import secrets; print(secrets.token_urlsafe(32))" > ~/.openclaw/api_token.txt
chmod 600 ~/.openclaw/api_token.txt

# Store in keyring
python3 << EOF
import keyring
with open('~/.openclaw/api_token.txt') as f:
    token = f.read().strip()
keyring.set_password('OpenClaw', 'api_token', token)
EOF
```

See `auth_middleware.py` in modules package.

#### Option B: OAuth2 Authentication

For web interface, implement OAuth2 with providers like GitHub or Google.

See `oauth_handler.py` in modules package.

---

### FIX #7: Rate Limiting

**Current Risk:** DoS attacks, resource exhaustion

**Solution:** Implement per-user rate limits

See `rate_limiter.py` in modules package.

**Configuration:**

```bash
cat > ~/.openclaw/rate_limits.json << 'EOF'
{
  "queries_per_hour": 100,
  "queries_per_minute": 10,
  "file_operations_per_hour": 50,
  "command_executions_per_hour": 20,
  "max_query_length": 10000,
  "max_file_size": 10485760
}
EOF
```

---

### FIX #8: Audit Logging

**Current Risk:** No forensic trail when security incidents occur

**Solution:** Comprehensive security audit logging

#### Step 1: Create Log Directory

```bash
mkdir -p ~/.openclaw/logs/security
chmod 700 ~/.openclaw/logs/security
```

#### Step 2: Implement Security Logger

See `security_logger.py` in modules package.

#### Step 3: Log All Security-Relevant Events

```python
from security_logger import SecurityLogger

logger = SecurityLogger()

# Log authentication attempts
logger.log_auth_attempt(username, success=True, ip_address="127.0.0.1")

# Log file access
logger.log_file_access(path="/home/user/document.txt", operation="read", success=True)

# Log command execution
logger.log_command_execution(command="ls -la", success=True, output_length=256)

# Log permission changes
logger.log_permission_change(permission="file_access", old_value="deny", new_value="allow")
```

---

### FIX #9: Encryption at Rest

**Current Risk:** Conversation history and cached data stored in plaintext

**Solution:** Encrypt all stored data

See `encrypted_storage.py` in modules package.

#### Usage:

```python
from encrypted_storage import EncryptedStorage

storage = EncryptedStorage()

# Store encrypted data
storage.store("conversation_123", {"messages": [...]})

# Retrieve and decrypt
data = storage.retrieve("conversation_123")
```

---

## 🟡 MEDIUM PRIORITY FIXES (Within 1 Month)

### FIX #10: Dependency Scanning

**Current Risk:** Vulnerable dependencies with known CVEs

**Solution:** Automated dependency scanning

```bash
# Install safety scanner
pip install safety --break-system-packages

# Scan for vulnerabilities
safety check --json > ~/.openclaw/logs/dependency_scan.json

# View results
safety check

# Set up automated weekly scans
cat > ~/.openclaw/scan_dependencies.sh << 'EOF'
#!/bin/bash
safety check --json > ~/.openclaw/logs/dependency_scan_$(date +%Y%m%d).json
if [ $? -ne 0 ]; then
    echo "⚠️  Vulnerabilities detected! Check ~/.openclaw/logs/"
fi
EOF

chmod +x ~/.openclaw/scan_dependencies.sh

# Add to crontab (weekly on Sunday at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * 0 ~/.openclaw/scan_dependencies.sh") | crontab -
```

---

### FIX #11: Network Monitoring

**Current Risk:** No visibility into outbound connections

**Solution:** Monitor and log all network activity

See `network_monitor.py` in modules package.

---

### FIX #12: Sandboxing for Plugins/Extensions

**Current Risk:** Malicious plugins can access entire system

**Solution:** Run plugins in isolated containers

#### Using Docker for Plugin Isolation:

```bash
# Create Dockerfile for plugin sandbox
cat > ~/.openclaw/plugin_sandbox/Dockerfile << 'EOF'
FROM python:3.11-slim

# Create non-root user
RUN useradd -m -u 1000 sandbox

# Install minimal dependencies
RUN pip install --no-cache-dir anthropic

# Set working directory
WORKDIR /sandbox

# Drop privileges
USER sandbox

# Read-only filesystem (plugins can only write to /tmp)
VOLUME /tmp

# No network access by default
CMD ["python3", "plugin.py"]
EOF

# Build sandbox image
docker build -t openclaw-plugin-sandbox ~/.openclaw/plugin_sandbox/
```

**Run plugin safely:**

```bash
#!/bin/bash
# run_plugin_safe.sh

PLUGIN_PATH=$1

docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  --memory=512m \
  --cpus=1 \
  -v "$PLUGIN_PATH:/sandbox/plugin.py:ro" \
  openclaw-plugin-sandbox
```

---

## 🔐 ONGOING SECURITY PRACTICES

### Weekly Security Checklist

```bash
#!/bin/bash
# weekly_security_check.sh

echo "🔒 OpenClaw Weekly Security Audit"
echo "=================================="

# 1. Check for exposed credentials
echo "1. Checking for plaintext credentials..."
if grep -r "api_key\|token\|password" ~/.openclaw/*.json 2>/dev/null; then
    echo "  ❌ Found plaintext credentials!"
else
    echo "  ✅ No plaintext credentials found"
fi

# 2. Verify file permissions
echo "2. Checking file permissions..."
find ~/.openclaw -type f -perm /o+r -ls | grep -v ".log" && echo "  ❌ World-readable files found" || echo "  ✅ Permissions OK"

# 3. Check for suspicious network connections
echo "3. Checking network connections..."
netstat -tuln | grep -E ":(8080|3000|5000)" || echo "  ✅ No suspicious connections"

# 4. Review recent audit logs
echo "4. Reviewing audit logs..."
tail -20 ~/.openclaw/logs/security/audit.log

# 5. Check dependency vulnerabilities
echo "5. Scanning dependencies..."
safety check --short-report

# 6. Check disk usage
echo "6. Checking disk usage..."
du -sh ~/.openclaw/

echo ""
echo "Audit complete: $(date)"
```

Make it executable and schedule:

```bash
chmod +x weekly_security_check.sh
(crontab -l 2>/dev/null; echo "0 9 * * 1 ~/.openclaw/weekly_security_check.sh | mail -s 'OpenClaw Security Report' your@email.com") | crontab -
```

---

### Monthly Security Review

1. **Review all audit logs** for suspicious activity
2. **Update dependencies** to latest secure versions
3. **Rotate credentials** (API keys, tokens)
4. **Review and revoke** unused permissions
5. **Test backup restoration** procedures
6. **Penetration test** with tools like OWASP ZAP
7. **Review firewall rules** and network policies

---

## ✅ SECURITY VERIFICATION CHECKLIST

After completing all fixes, verify security posture:

### Critical Security Controls

- [ ] All credentials stored in OS keychain (not plaintext)
- [ ] File access restricted to allowed directories only
- [ ] Path traversal protection implemented
- [ ] Network access limited to whitelisted domains
- [ ] TLS certificate verification enabled
- [ ] Input validation on all user inputs
- [ ] Command execution whitelist enforced
- [ ] Authentication required for all access
- [ ] Rate limiting active

### High Priority Controls

- [ ] Audit logging enabled for all security events
- [ ] Encryption at rest for sensitive data
- [ ] Dependency scanning automated
- [ ] Security headers configured
- [ ] Error messages sanitized (no info disclosure)
- [ ] Session management secure (timeouts, secure cookies)

### Medium Priority Controls

- [ ] Network monitoring active
- [ ] Plugin sandboxing implemented
- [ ] Weekly security scans scheduled
- [ ] Backup encryption enabled
- [ ] Incident response plan documented

---

## 🚨 EMERGENCY RESPONSE

### If You Detect a Breach:

1. **Immediately disconnect from network**
   ```bash
   sudo ifconfig en0 down  # macOS
   sudo ip link set eth0 down  # Linux
   ```

2. **Kill OpenClaw processes**
   ```bash
   pkill -9 -f openclaw
   ```

3. **Preserve evidence**
   ```bash
   tar -czf ~/openclaw_forensics_$(date +%Y%m%d_%H%M%S).tar.gz ~/.openclaw/logs/
   ```

4. **Revoke all credentials immediately**
   - Anthropic API keys: https://console.anthropic.com/settings/keys
   - OpenAI API keys: https://platform.openai.com/api-keys
   - GitHub tokens: https://github.com/settings/tokens

5. **Review audit logs**
   ```bash
   grep -i "failed\|error\|unauthorized" ~/.openclaw/logs/security/audit.log
   ```

6. **Scan for malware**
   ```bash
   # macOS
   sudo freshclam && sudo clamscan -r ~/.openclaw/
   
   # Linux
   sudo apt install clamav
   sudo freshclam
   sudo clamscan -r ~/.openclaw/
   ```

---

## 📚 Additional Resources

- **Security Best Practices**: See `SECURITY-BEST-PRACTICES.md`
- **Incident Response Plan**: See `INCIDENT-RESPONSE.md`
- **Threat Model**: See `THREAT-MODEL.md`

---

## 🆘 Getting Help

If you need assistance:

1. Check logs: `~/.openclaw/logs/security/`
2. Run diagnostics: `python3 security_diagnostics.py`
3. Review this guide's troubleshooting section
4. Open issue with: System info, error messages, steps to reproduce

---

**⚠️ Important:** Security is an ongoing process, not a one-time fix. Review and update these measures regularly as threats evolve.

---

**Last Updated:** February 1, 2026  
**Version:** 1.0

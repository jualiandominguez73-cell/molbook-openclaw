# Launch Agent Bootstrap Recovery

This page covers troubleshooting the macOS launch agent bootstrap issue where the service appears enabled but is not actually loaded in launchd.

## Issue Description

On macOS, the launchd service manager can get into an inconsistent state where:

1. **Service appears in `launchctl list`** - Shows as enabled with PID
2. **Service not in launchd domain** - `launchctl print gui/$UID/com.clawdbot.gateway` returns "no such process"
3. **Gateway fails to start** - `clawdbot health` shows connection errors
4. **Manual recovery needed** - Service requires bootstrap to be reloaded into launchd

## Symptoms

- `clawdbot health` returns "gateway closed (1006 abnormal closure)"
- `lsof -i:18789` shows no process listening
- `launchctl list | grep clawdbot` shows service as enabled
- `launchctl print gui/$(id -u)/com.clawdbot.gateway` returns error

## Causes

This typically happens after:
- macOS system updates
- System crashes or improper shutdown
- Manual service manipulation without proper cleanup
- Launch daemon corruption

## Manual Recovery

### Quick Fix

```bash
# Bootstrap and restart the service
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.clawdbot.gateway.plist
launchctl kickstart gui/$(id -u)/com.clawdbot.gateway

# Verify it's working
sleep 2
lsof -i:18789 | grep LISTEN
```

### Using Recovery Script

```bash
# Interactive mode
./scripts/recover-launch-agent.sh

# Dry-run (see what would be done)
./scripts/recover-launch-agent.sh --dry-run

# Auto-fix (no prompts)
./scripts/recover-launch-agent.sh --fix

# Verbose output
./scripts/recover-launch-agent.sh --verbose

# Force test recovery (simulate issue)
./scripts/recover-launch-agent.sh --force-recovery --fix
```

## Doctor Integration

The `clawdbot doctor` command now automatically detects and offers to fix this issue:

```bash
# Run doctor (will detect and offer fix)
clawdbot doctor

# Non-interactive auto-fix
clawdbot doctor --non-interactive
```

The doctor will:
1. Check if service is in `launchctl list`
2. Verify service is loaded in launchd domain  
3. If not loaded, offer bootstrap recovery
4. Perform automatic repair with verification
5. Report success/failure with detailed logs

## Troubleshooting Steps

1. **Check Current Status**
   ```bash
   launchctl list | grep clawdbot
   launchctl print gui/$(id -u)/com.clawdbot.gateway
   lsof -i:18789
   ```

2. **If Service Not Loaded**
   - Run recovery script: `./scripts/recover-launch-agent.sh --fix`
   - Or manual commands above
   - Verify with `clawdbot health`

3. **If Service Loading But Gateway Not Working**
   - Check logs: `tail -50 ~/.clawdbot/logs/gateway.log`
   - Check errors: `tail -50 ~/.clawdbot/logs/gateway.err.log`
   - Try full restart: `launchctl bootout && launchctl bootstrap && launchctl kickstart`

4. **If Issue Persists**
   - Reset service: `clawdbot daemon stop && clawdbot daemon install`
   - Check file permissions: `ls -la ~/Library/LaunchAgents/com.clawdbot.gateway.plist`
   - Check Node.js: `which node && node --version`

## Prevention

- Use proper shutdown: Avoid force-quit or power loss
- Let macOS manage services: Don't manually manipulate launchd
- Keep system updated: Install security updates promptly
- Monitor logs: Check `clawdbot logs` periodically

## Recovery Script Details

The recovery script (`scripts/recover-launch-agent.sh`) provides:

### Detection Logic
- Checks plist file exists
- Verifies service in `launchctl list`
- Tests if service loaded in launchd domain
- Checks if gateway is running on port 18789

### Recovery Actions
- `launchctl bootstrap` - Reload service into launchd
- `launchctl kickstart` - Restart the service
- Verification of successful startup

### Exit Codes
- `0` - Success (recovered or no issue)
- `1` - Issue detected but not fixed
- `2` - Error occurred during recovery
- `3` - Platform not supported

### Options
- `--dry-run` - Show actions without executing
- `--fix` - Auto-fix without prompting
- `--verbose` - Detailed output
- `--force-recovery` - Test recovery simulation
- `--help` - Show usage information

## Related Documentation

- [Gateway Configuration](/gateway)
- [macOS Installation](/platforms/mac)
- [Troubleshooting](/troubleshooting)
- [Daemon Management](/daemon)
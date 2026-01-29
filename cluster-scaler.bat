@echo off
chcp 65001 >nul
title Moltbot Cluster Scaling Tool

set "SERVER=root@38.14.254.51"
set "REPO_URL=https://github.com/flowerjunjie/moltbot.git"

echo ========================================
echo   Moltbot Cluster Scaling Tool
echo ========================================
echo.
echo This tool helps you scale your Moltbot cluster.
echo.

:menu
cls
echo ========================================
echo   Moltbot Cluster Scaling Tool
echo ========================================
echo.
echo Current Cluster Status:
echo.
echo [1] View current cluster status
echo [2] Add new device to cluster
echo [3] Remove device from cluster
echo [4] Configure load balancing
echo [5] Enable failover mode
echo [6] Generate cluster report
echo [7] Scale up (add resources)
echo [8] Scale down (remove resources)
echo [0] Exit
echo.
set /p choice="Select option (0-8): "

if "%choice%"=="1" goto view_status
if "%choice%"=="2" goto add_device
if "%choice%"=="3" goto remove_device
if "%choice%"=="4" goto load_balance
if "%choice%"=="5" goto failover
if "%choice%"=="6" goto cluster_report
if "%choice%"=="7" goto scale_up
if "%choice%"=="8" goto scale_down
if "%choice%"=="0" goto end
goto menu

:view_status
cls
echo ========================================
echo   Cluster Status
echo ========================================
echo.

echo Fetching cluster information...
echo.

ssh %SERVER% "curl -s http://localhost:18800/api/devices | python3 -m json.tool"

echo.
echo Service Status:
ssh %SERVER% "systemctl is-active moltbot-gateway moltbot-db-api moltbot-metrics-exporter --no-pager"

echo.
echo Docker Containers:
ssh %SERVER% "docker ps --format 'table {{.Names}}\t{{.Status}}'"

pause
goto menu

:add_device
cls
echo ========================================
echo   Add New Device
echo ========================================
echo.
echo This will prepare a new device for the cluster.
echo.
echo Steps:
echo 1. On the new device, run: notebook-auto-deploy.bat
echo 2. Then run: register-device.bat
echo 3. The device will automatically appear in the cluster
echo.
echo Would you like to:
echo [1] Generate deployment script for new device
echo [2] View existing devices
echo [3] Return to menu
echo.
set /p add_choice="Select option: "
if "%add_choice%"=="1" goto generate_script
if "%add_choice%"=="2" goto view_status
goto menu

:generate_script
set /p DEVICE_NAME="Enter device name (or press Enter for hostname): "
if "%DEVICE_NAME%"=="" set "DEVICE_NAME=%COMPUTERNAME%"

set /p DEVICE_TYPE="Enter device type (desktop/notebook/server): "

echo.
echo Generating deployment script...
echo.

cat > "deploy-%DEVICE_NAME%.bat" << EOFSHORT
@echo off
echo Deploying %DEVICE_NAME% to cluster...
echo.
git clone %REPO_URL% C:\moltbot
cd C:\moltbot
call notebook-auto-deploy.bat
call register-device.bat
EOFSHORT

echo Script generated: deploy-%DEVICE_NAME%.bat
echo.
echo Copy this script to the new device and run it.
echo.
pause
goto menu

:remove_device
cls
echo ========================================
echo   Remove Device
echo ========================================
echo.
echo WARNING: This will remove a device from the cluster database.
echo The device will no longer be monitored or synced.
echo.
echo To re-add, simply run register-device.bat on the device.
echo.
set /p DEVICE_TO_REMOVE="Enter device name to remove: "
if "%DEVICE_TO_REMOVE%"=="" goto menu

echo.
echo Removing device from cluster...
ssh %SERVER% "psql -d moltbot -c \"DELETE FROM devices WHERE device_name = '%DEVICE_TO_REMOVE%';\""

echo.
echo Device removed from cluster database.
echo.
pause
goto menu

:load_balance
cls
echo ========================================
echo   Load Balancing Configuration
echo ========================================
echo.
echo Moltbot Gateway supports multiple gateway instances.
echo.
echo Current architecture:
echo   Single Gateway on %SERVER%
echo.
echo Load balancing options:
echo.
echo [1] Add secondary gateway (recommended)
echo [2] Configure DNS round-robin
echo [3] Configure Nginx reverse proxy
echo [4] View current configuration
echo [0] Return to menu
echo.
set /p lb_choice="Select option: "
if "%lb_choice%"=="1" goto add_gateway
if "%lb_choice%"=="4" goto view_lb_config
goto menu

:add_gateway
echo.
echo To add a secondary gateway:
echo.
echo 1. Deploy Moltbot on another server
echo 2. Configure it with: "mode": "local"
echo 3. Set the same auth token
echo 4. Point clients to both gateways
echo.
echo Example configuration:
echo.
echo {
echo   "gateway": {
echo     "mode": "local",
echo     "bind": "all",
echo     "auth": {"token": "moltbot-cluster-2024"}
echo   }
echo }
echo.
pause
goto menu

:view_lb_config
echo.
echo Current Load Balancing Configuration:
echo.
echo Mode: Hybrid (local + remote failover)
echo Primary: Local Gateway
echo Fallback: %SERVER%
echo.
echo To change, edit: ~/.clawdbot/moltbot.json
echo.
pause
goto menu

:failover
cls
echo ========================================
echo   Failover Configuration
echo ========================================
echo.
echo Moltbot supports automatic failover.
echo.
echo Current failover status:
echo.
ssh %SERVER% "curl -s http://localhost:18800/api/devices | python3 -c 'import sys, json; devices=json.load(sys.stdin); online=[d for d in devices if d.get(\"status\")==\"online\"]; print(f\"Online devices: {len(online)}\"); print(f\"Total devices: {len(devices)}\")'"

echo.
echo Failover configuration:
echo - Health check interval: 5 minutes
echo - Auto-switch: Enabled
echo - Session sync: Every 10 minutes
echo.
echo To modify failover settings:
echo Edit: /etc/cron.d/moltbot-tasks
echo.
pause
goto menu

:cluster_report
cls
echo ========================================
echo   Cluster Report
echo ========================================
echo.
echo Generating cluster report...
echo.

ssh %SERVER% "/usr/local/bin/moltbot-health-report.py"

echo.
echo Full report saved to server.
echo View with: ssh %SERVER% "cat /opt/moltbot-monitoring/reports/report_*.txt"
echo.
pause
goto menu

:scale_up
cls
echo ========================================
echo   Scale Up - Add Resources
echo ========================================
echo.
echo Scale up options:
echo.
echo [1] Increase database connections
echo [2] Increase backup retention
echo [3] Enable additional monitoring
echo [4] Add more storage
echo [0] Return to menu
echo.
set /p scale_choice="Select option: "

if "%scale_choice%"=="1" (
    echo.
    echo Increasing database connections...
    ssh %SERVER% "psql -d moltbot -c 'ALTER SYSTEM SET max_connections = 200;' && systemctl restart postgresql"
    echo Done.
    pause
)
if "%scale_choice%"=="2" (
    echo.
    echo Current backup retention: 7 days
    set /p RETENTION="New retention (days): "
    ssh %SERVER% "sed -i 's/RETENTION_DAYS=30/RETENTION_DAYS=%RETENTION%/' /opt/moltbot-backup/backup.sh"
    echo Done.
    pause
)
if "%scale_choice%"=="3" (
    echo.
    echo Enabling additional monitoring...
    ssh %SERVER% "systemctl start moltbot-perf-monitor"
    echo Done.
    pause
)
if "%scale_choice%"=="4" (
    echo.
    echo To add more storage:
    echo 1. Add disk to server
    echo 2. Create new partition
    echo 3. Add to LVM or mount point
    echo 4. Update backup paths
    echo.
    pause
)

goto menu

:scale_down
cls
echo ========================================
echo   Scale Down - Remove Resources
echo ========================================
echo.
echo WARNING: Scaling down may reduce performance.
echo.
echo Scale down options:
echo.
echo [1] Decrease database connections
echo [2] Decrease backup retention
echo [3] Disable performance monitor
echo [0] Return to menu
echo.
set /p down_choice="Select option: "

if "%down_choice%"=="1" (
    echo.
    echo Decreasing database connections...
    ssh %SERVER% "psql -d moltbot -c 'ALTER SYSTEM SET max_connections = 100;' && systemctl restart postgresql"
    echo Done.
    pause
)
if "%down_choice%"=="2" (
    echo.
    echo Current backup retention: 30 days
    set /p RETENTION="New retention (days): "
    ssh %SERVER% "sed -i 's/RETENTION_DAYS=30/RETENTION_DAYS=%RETENTION%/' /opt/moltbot-backup/backup.sh"
    echo Done.
    pause
)
if "%down_choice%"=="3" (
    echo.
    echo Disabling performance monitor...
    ssh %SERVER% "systemctl stop moltbot-perf-monitor"
    echo Done.
    pause
)

goto menu

:end
echo.
echo Thank you for using Moltbot Cluster Scaling Tool!
echo.
exit /b 0

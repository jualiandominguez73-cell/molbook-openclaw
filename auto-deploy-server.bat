@echo off
chcp 65001 >nul
title Moltbot Automated Server Deployment

setlocal enabledelayedexpansion

echo ========================================
echo   Moltbot Server Auto Deployment
echo ========================================
echo.

if "%~1"=="" (
    echo Usage: auto-deploy-server.bat [server-address]
    echo.
    echo Examples:
    echo   auto-deploy-server.bat root@192.168.1.100
    echo   auto-deploy-server.bat user@example.com
    echo.
    pause
    exit /b 1
)

set "SERVER=%~1"
set "SCRIPT=%~dp0auto-deploy-server.sh"

echo Target server: %SERVER%
echo.

if not exist "%SCRIPT%" (
    echo ERROR: auto-deploy-server.sh not found
    echo This script requires the bash deployment script.
    pause
    exit /b 1
)

echo Checking for WSL or Git Bash...
where wsl.exe >nul 2>&1
if %errorlevel%==0 (
    echo Using WSL to run deployment script...
    wsl.exe bash "%SCRIPT%" "%SERVER%"
    goto end
)

where bash.exe >nul 2>&1
if %errorlevel%==0 (
    echo Using Git Bash to run deployment script...
    bash.exe "%SCRIPT%" "%SERVER%"
    goto end
)

echo ERROR: No bash interpreter found
echo Please install WSL or Git for Windows
echo.
pause
exit /b 1

:end
echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
pause

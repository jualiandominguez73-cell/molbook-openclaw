# Script to start the C++ Utils Microservice

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverBin = Join-Path $scriptDir "..\dist\services\utils_server"

if (-not (Test-Path $serverBin)) {
    Write-Error "Utils server binary not found at $serverBin. Please run build first."
}

Write-Host "Starting Utils Service..."
Start-Process -FilePath $serverBin -NoNewWindow
Write-Host "Utils Service started."

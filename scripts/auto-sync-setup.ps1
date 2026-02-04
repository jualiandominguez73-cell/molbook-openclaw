# Auto-Sync Setup Script for Windows
# Creates a scheduled task to automatically sync from upstream OpenClaw

param(
    [string]$Frequency = "Daily",  # Daily, Weekly, or Hourly
    [string]$Time = "06:00",       # Time for daily/weekly runs
    [switch]$Remove                # Remove the scheduled task
)

$TaskName = "NnemoClaw-AutoSync"
$ScriptPath = Join-Path $PSScriptRoot "sync-upstream.ps1"
$ProjectPath = Split-Path $PSScriptRoot -Parent

if ($Remove) {
    Write-Host "Removing scheduled task '$TaskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Task removed." -ForegroundColor Green
    exit 0
}

# Verify sync script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "Error: sync-upstream.ps1 not found at $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Setting up automated sync for NnemoClaw..." -ForegroundColor Cyan
Write-Host "  Frequency: $Frequency"
Write-Host "  Time: $Time"
Write-Host "  Project: $ProjectPath"

# Create the action
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`"" -WorkingDirectory $ProjectPath

# Create trigger based on frequency
switch ($Frequency) {
    "Hourly" {
        $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
    }
    "Weekly" {
        $Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $Time
    }
    default {
        $Trigger = New-ScheduledTaskTrigger -Daily -At $Time
    }
}

# Create settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

# Register the task
try {
    # Remove existing task if it exists
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Automatically sync NnemoClaw from upstream OpenClaw repository" -RunLevel Limited
    
    Write-Host "`nScheduled task '$TaskName' created successfully!" -ForegroundColor Green
    Write-Host "`nTo manage the task:"
    Write-Host "  View:    Get-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  Run now: Start-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  Remove:  .\auto-sync-setup.ps1 -Remove"
    Write-Host "`nLogs will appear in: $ProjectPath\sync.log"
} catch {
    Write-Host "Error creating scheduled task: $_" -ForegroundColor Red
    exit 1
}

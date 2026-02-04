# Sync with upstream OpenClaw repository
# Run this script to pull latest updates from the original project

param(
    [switch]$Merge,    # Use merge instead of rebase
    [switch]$Force,    # Force sync (will overwrite local changes)
    [switch]$Silent,   # Suppress console output (for scheduled tasks)
    [string]$Branch = "main"  # Branch to sync from
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$LogFile = Join-Path $ProjectDir "sync.log"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
    if (-not $Silent) {
        Write-Host $Message -ForegroundColor $Color
    }
}

Set-Location $ProjectDir

Write-Log "Syncing with upstream OpenClaw..." "Cyan"

# Fetch latest from upstream
Write-Log "Fetching from upstream..." "Yellow"
$fetchOutput = git fetch upstream 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "Failed to fetch from upstream: $fetchOutput" "Red"
    exit 1
}

# Check if we're behind
$localHead = git rev-parse HEAD
$upstreamHead = git rev-parse upstream/$Branch

if ($localHead -eq $upstreamHead) {
    Write-Log "Already up to date with upstream/$Branch" "Green"
    exit 0
}

# Check for uncommitted changes
$status = git status --porcelain
if ($status -and -not $Force) {
    Write-Log "Uncommitted changes detected. Use -Force to override." "Yellow"
    if (-not $Silent) {
        git status --short
    }
    exit 1
}

# Get current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Log "Current branch: $currentBranch" "Green"

if ($Force) {
    Write-Log "Force mode: Resetting to upstream/$Branch" "Yellow"
    git reset --hard upstream/$Branch 2>&1 | Out-Null
} elseif ($Merge) {
    Write-Log "Merging upstream/$Branch into $currentBranch..." "Yellow"
    $mergeOutput = git merge upstream/$Branch --no-edit --allow-unrelated-histories 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Try to resolve conflicts by accepting upstream
        Write-Log "Merge conflicts - accepting upstream versions" "Yellow"
        git checkout --theirs . 2>&1 | Out-Null
        git add -A 2>&1 | Out-Null
        git commit -m "Merge upstream/$Branch (auto-sync)" 2>&1 | Out-Null
    }
} else {
    Write-Log "Rebasing $currentBranch onto upstream/$Branch..." "Yellow"
    $rebaseOutput = git rebase upstream/$Branch 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Rebase failed, falling back to merge" "Yellow"
        git rebase --abort 2>&1 | Out-Null
        git merge upstream/$Branch --no-edit --allow-unrelated-histories 2>&1 | Out-Null
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Log "Sync failed. Manual intervention may be needed." "Red"
    exit 1
}

# Get version info
$versionLine = git log -1 --oneline upstream/$Branch
Write-Log "Sync complete! Latest: $versionLine" "Green"

if (-not $Silent) {
    Write-Host "`nRecent upstream changes:" -ForegroundColor Cyan
    git log --oneline -10 upstream/$Branch

    Write-Host "`nTips:" -ForegroundColor Cyan
    Write-Host "   - Run 'pnpm install' if dependencies changed" -ForegroundColor Gray
    Write-Host "   - Run 'pnpm build' to rebuild" -ForegroundColor Gray
    Write-Host "   - Check CHANGELOG.md for breaking changes" -ForegroundColor Gray
}

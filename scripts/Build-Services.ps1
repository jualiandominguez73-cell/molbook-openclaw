# Build-Services.ps1
$ErrorActionPreference = "Stop"

Write-Host "Building C++ Utils Service..."
$buildDir = "src/services/utils/build"
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}
Push-Location $buildDir
try {
    cmake ..
    cmake --build . --config Release
} finally {
    Pop-Location
}

$distDir = "dist/services"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}
# Handle potential .exe extension on Windows
if (Test-Path "$buildDir/Debug/utils_server.exe") {
    Copy-Item "$buildDir/Debug/utils_server.exe" -Destination "$distDir/" -Force
} elseif (Test-Path "$buildDir/Release/utils_server.exe") {
    Copy-Item "$buildDir/Release/utils_server.exe" -Destination "$distDir/" -Force
} elseif (Test-Path "$buildDir/utils_server") {
    Copy-Item "$buildDir/utils_server" -Destination "$distDir/" -Force
}
Write-Host "Utils Service built."

<#
.SYNOPSIS
    PixMath Full Stack Shutdown Script (PowerShell)
.DESCRIPTION
    Cleanly terminates all running PixMath services:
    1. Stops API Gateway, Forward Worker, Reverse Worker, DLX Monitor, and Web Studio
    2. Frees ports 8000 (API) and 5173 (Vite Web Studio)
    3. Stops Docker containers if active
#>

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "             PIXMATH -- STOPPING ALL SERVICES                " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

$PidFile = "$RootPath\.pixmath_services.json"

if (Test-Path $PidFile) {
    try {
        $Services = Get-Content $PidFile -Raw | ConvertFrom-Json
        if ($Services.Gateway) {
            Write-Host "[+] Stopping API Gateway (PID: $($Services.Gateway))..." -ForegroundColor DarkGray
            Stop-Process -Id $Services.Gateway -Force
        }
        if ($Services.ForwardWorker) {
            Write-Host "[+] Stopping Forward Worker (PID: $($Services.ForwardWorker))..." -ForegroundColor DarkGray
            Stop-Process -Id $Services.ForwardWorker -Force
        }
        if ($Services.ReverseWorker) {
            Write-Host "[+] Stopping Reverse Worker (PID: $($Services.ReverseWorker))..." -ForegroundColor DarkGray
            Stop-Process -Id $Services.ReverseWorker -Force
        }
        if ($Services.DLXMonitor) {
            Write-Host "[+] Stopping DLX Monitor (PID: $($Services.DLXMonitor))..." -ForegroundColor DarkGray
            Stop-Process -Id $Services.DLXMonitor -Force
        }
        if ($Services.WebStudio) {
            Write-Host "[+] Stopping Web Studio (PID: $($Services.WebStudio))..." -ForegroundColor DarkGray
            Stop-Process -Id $Services.WebStudio -Force
        }
    } catch {
        Write-Host "[-] Note reading PID tracking file: $_" -ForegroundColor DarkGray
    }
    Remove-Item $PidFile -Force
}

# Cleanly free port 8000 and 5173 if child processes are lingering
$portsToClean = @(8000, 5173)
foreach ($port in $portsToClean) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -and $conn.OwningProcess -gt 0) {
                Write-Host "[+] Freeing lingering process on port $port (PID: $($conn.OwningProcess))..." -ForegroundColor DarkGray
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # NetTCPConnection may not be available on all editions, ignore
    }
}

# Stop Docker infrastructure if running
try {
    $dockerCheck = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[+] Stopping Docker infrastructure..." -ForegroundColor DarkGray
        docker compose -f infra/compose.yaml stop
    }
} catch {
    # Docker not running or installed
}

Write-Host ""
Write-Host "[OK] All PixMath services have been stopped successfully." -ForegroundColor Green
Write-Host ""

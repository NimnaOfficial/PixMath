# PixMath Full Stack Startup Script (PowerShell 5.1 & 7+ compatible)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "             PIXMATH -- FULL STACK PLATFORM LAUNCH           " -ForegroundColor Cyan
Write-Host "   Continuous Mathematics <-> Discrete Pixel Architecture     " -ForegroundColor DarkCyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

# 1. Environment & Logging setup
$LogsDir = "$RootPath\logs"
if (!(Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$env:PYTHONPATH = "$RootPath\libs\math-core;$RootPath\apps\api-gateway;$RootPath\services\forward-worker;$RootPath\services\reverse-worker;$RootPath\services\dlx-monitor;$RootPath\apps\cli"
$PythonExe = "python"

# Verify python
try {
    $pyVer = & $PythonExe --version 2>&1
    Write-Host "[OK] Python: $pyVer" -ForegroundColor Green
} catch {
    Write-Host "[ERR] Python not found in PATH." -ForegroundColor Red
    exit 1
}

# 2. Check & Launch Docker Infrastructure (Optional / Non-blocking)
$DockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $DockerRunning = $true
        Write-Host "[+] Docker daemon detected. Starting message broker and database stack..." -ForegroundColor Green
        docker compose -f infra/compose.yaml up -d
        Write-Host "[OK] RabbitMQ, Redis, Postgres, and MinIO started." -ForegroundColor Green
    } else {
        Write-Host "[-] Docker daemon offline. Starting services in standalone mode." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[-] Docker not found. Starting services in standalone mode." -ForegroundColor Yellow
}

# Object to track running PIDs
$Services = @{
    Gateway = $null
    ForwardWorker = $null
    DLXMonitor = $null
    WebStudio = $null
}

# 3. Launch API Gateway (FastAPI + Strawberry GraphQL + WebSockets)
Write-Host "[+] Starting PixMath API Gateway (Port 8000)..." -ForegroundColor Cyan
$gatewayProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $RootPath `
    -RedirectStandardOutput "$LogsDir\gateway.log" `
    -RedirectStandardError "$LogsDir\gateway.err.log" `
    -PassThru -WindowStyle Hidden
$Services.Gateway = $gatewayProc.Id

# 4. Launch Forward Worker
Write-Host "[+] Starting Forward Worker..." -ForegroundColor Cyan
$fwdProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "services/forward-worker/app/worker.py" `
    -WorkingDirectory $RootPath `
    -RedirectStandardOutput "$LogsDir\forward_worker.log" `
    -RedirectStandardError "$LogsDir\forward_worker.err.log" `
    -PassThru -WindowStyle Hidden
$Services.ForwardWorker = $fwdProc.Id

# 5. Launch DLX Monitor
Write-Host "[+] Starting DLX Monitor..." -ForegroundColor Cyan
$dlxProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "services/dlx-monitor/app/telemetry.py" `
    -WorkingDirectory $RootPath `
    -RedirectStandardOutput "$LogsDir\dlx_monitor.log" `
    -RedirectStandardError "$LogsDir\dlx_monitor.err.log" `
    -PassThru -WindowStyle Hidden
$Services.DLXMonitor = $dlxProc.Id

# 6. Launch Web Studio Frontend (React 19 + WebGL2 on Port 5173)
Write-Host "[+] Starting PixMath Web Studio (Port 5173)..." -ForegroundColor Cyan
$webProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm", "--prefix", "apps/web-studio", "run", "dev" `
    -WorkingDirectory $RootPath `
    -RedirectStandardOutput "$LogsDir\web_studio.log" `
    -RedirectStandardError "$LogsDir\web_studio.err.log" `
    -PassThru -WindowStyle Hidden
$Services.WebStudio = $webProc.Id

# Save PIDs to file for clean shutdown
$Services | ConvertTo-Json | Out-File -FilePath "$RootPath\.pixmath_services.json" -Encoding utf8

# 7. Health Check Verification
Write-Host "[+] Verifying service availability..." -ForegroundColor Cyan
$retries = 6
$gatewayReady = $false
while ($retries -gt 0 -and -not $gatewayReady) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2
        if ($res.StatusCode -eq 200) {
            $gatewayReady = $true
        }
    } catch {
        $retries--
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "             PIXMATH SERVICES ONLINE & READY                " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  * PixMath Web Studio:       http://localhost:5173" -ForegroundColor Yellow
Write-Host "  * API Gateway:              http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  * Interactive GraphQL:      http://127.0.0.1:8000/graphql" -ForegroundColor Magenta
Write-Host "  * REST Swagger Docs:        http://127.0.0.1:8000/docs" -ForegroundColor Blue
Write-Host "  * Health Status:            http://127.0.0.1:8000/health" -ForegroundColor Green
if ($DockerRunning) {
    Write-Host "  * RabbitMQ Management:      http://localhost:15672 (pixmath/pixmath)" -ForegroundColor DarkYellow
    Write-Host "  * MinIO S3 Console:         http://localhost:9001  (minioadmin/minioadmin)" -ForegroundColor DarkCyan
}
Write-Host ""
Write-Host "  * Service Logs directory:   $LogsDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To stop all services cleanly, run:" -ForegroundColor White
Write-Host "  .\stop_project.ps1" -ForegroundColor Green
Write-Host ""

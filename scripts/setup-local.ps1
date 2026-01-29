#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "=== GuardSpine Local Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install root dependencies
Write-Host "[1/5] Installing root dependencies..." -ForegroundColor Yellow
Push-Location $RootDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} finally { Pop-Location }

# Step 2: Build n8n nodes
Write-Host "[2/5] Building n8n nodes (tsc compile)..." -ForegroundColor Yellow
Push-Location $RootDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally { Pop-Location }

# Step 3: Install mock-api dependencies
Write-Host "[3/5] Installing mock-api dependencies..." -ForegroundColor Yellow
Push-Location (Join-Path $RootDir "mock-api")
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed in mock-api" }
} finally { Pop-Location }

# Step 4: Start docker-compose
Write-Host "[4/5] Starting docker-compose..." -ForegroundColor Yellow
Push-Location $RootDir
try {
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) { throw "docker-compose up failed" }
} finally { Pop-Location }

# Step 5: Wait for n8n to be ready
Write-Host "[5/5] Waiting for n8n to be ready..." -ForegroundColor Yellow
$MaxAttempts = 30
$Attempt = 0
$Ready = $false

while ($Attempt -lt $MaxAttempts) {
    $Attempt++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5678/healthz" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "  n8n is ready!" -ForegroundColor Green
            $Ready = $true
            break
        }
    } catch {
        # Not ready yet
    }
    if ($Attempt -eq $MaxAttempts) {
        Write-Host "  ERROR: n8n did not become ready after $MaxAttempts attempts." -ForegroundColor Red
        Write-Host "  Check logs with: docker-compose logs n8n"
        exit 1
    }
    Write-Host "  Attempt $Attempt/$MaxAttempts - waiting 5s..."
    Start-Sleep -Seconds 5
}

# Import example workflows
Write-Host ""
Write-Host "Importing example workflows..." -ForegroundColor Yellow
$WorkflowDir = Join-Path $RootDir "examples\workflows"

if (Test-Path $WorkflowDir) {
    $workflows = Get-ChildItem -Path $WorkflowDir -Filter "*.json"
    foreach ($wf in $workflows) {
        Write-Host "  Importing $($wf.Name)..."
        try {
            $body = Get-Content -Path $wf.FullName -Raw
            $response = Invoke-WebRequest -Uri "http://localhost:5678/api/v1/workflows" `
                -Method POST `
                -ContentType "application/json" `
                -Body $body `
                -UseBasicParsing `
                -ErrorAction SilentlyContinue
            Write-Host "    OK ($($response.StatusCode))" -ForegroundColor Green
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            Write-Host "    WARNING: Got HTTP $code for $($wf.Name)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  No workflow directory found at $WorkflowDir - skipping import."
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  n8n UI:    http://localhost:5678"
Write-Host "  Mock API:  http://localhost:8000"
Write-Host ""
Write-Host "  Stop with: docker-compose down"
Write-Host "  Logs with: docker-compose logs -f"

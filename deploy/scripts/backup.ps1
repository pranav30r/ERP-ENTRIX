# ENTRIX ERP - Automated Database Logical Backup Script
# Platform: Windows PowerShell / Docker Compose
# Database: PostgreSQL 16 (Container: entrix-postgres)

[CmdletBinding()]
param (
    [string]$BackupDir = "",
    [string]$ContainerName = "entrix-postgres",
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { "postgres" }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { "entrix_erp" })
)

$ErrorActionPreference = "Stop"

if (-not $BackupDir) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $BackupDir = Join-Path $ScriptDir "..\backups"
}
$BackupDir = [System.IO.Path]::GetFullPath($BackupDir)

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$BackupFile = Join-Path $BackupDir "entrix_erp_backup_$Timestamp.sql"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [ENTRIX] Initiating PostgreSQL Disaster Recovery Backup" -ForegroundColor Cyan
Write-Host " Container: $ContainerName | Target DB: $DbName" -ForegroundColor DarkGray
Write-Host " Output:    $BackupFile" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan

$StartTime = Get-Date
$ErrorLog = [System.IO.Path]::GetTempFileName()

try {
    # 1. Verify Docker container is running
    $containerStatus = (docker inspect --format="{{.State.Running}}" $ContainerName 2>$null)
    if ($LASTEXITCODE -ne 0 -or $containerStatus -ne "true") {
        throw "Container '$ContainerName' is not running or accessible."
    }

    # 2. Execute pg_dump directly via cmd OS streaming to preserve UTF-8 and capture errors
    cmd.exe /c "docker exec $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists --inserts > `"$BackupFile`" 2> `"$ErrorLog`""
    $exitCode = $LASTEXITCODE

    # 3. Check native Docker exit code; never print SUCCESS after failure
    if ($exitCode -ne 0) {
        $errorMsg = ""
        if (Test-Path $ErrorLog) {
            $rawErr = Get-Content $ErrorLog -Raw
            if ($rawErr) { $errorMsg = $rawErr.Trim() }
        }
        if (-not $errorMsg) { $errorMsg = "Docker pg_dump exited with error code $exitCode" }
        throw $errorMsg
    }

    if (-not (Test-Path $BackupFile)) {
        throw "Backup file was not created: $BackupFile"
    }

    $fileLength = (Get-Item $BackupFile).Length
    if ($fileLength -lt 100) {
        throw "Backup file size is abnormally small ($fileLength bytes)."
    }

    $FileHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
    $Duration = ((Get-Date) - $StartTime).TotalSeconds

    Write-Host "[SUCCESS] Backup completed in $([math]::Round($Duration, 2))s" -ForegroundColor Green
    Write-Host " Size:     $([math]::Round($fileLength / 1KB, 2)) KB" -ForegroundColor Green
    Write-Host " SHA-256:  $FileHash" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
}
catch {
    if (Test-Path $BackupFile) {
        Remove-Item -Path $BackupFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "[FAILED] Database backup aborted: $_" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path $ErrorLog) {
        Remove-Item -Path $ErrorLog -Force -ErrorAction SilentlyContinue
    }
}

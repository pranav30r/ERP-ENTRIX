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

try {
    # Execute pg_dump from within Docker container
    docker exec $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists --inserts > $BackupFile

    if ((Get-Item $BackupFile).Length -lt 100) {
        throw "Backup file size is abnormally small ($((Get-Item $BackupFile).Length) bytes)."
    }

    $FileHash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
    $Duration = ((Get-Date) - $StartTime).TotalSeconds

    Write-Host "[SUCCESS] Backup completed in $([math]::Round($Duration, 2))s" -ForegroundColor Green
    Write-Host " Size:     $((Get-Item $BackupFile).Length / 1KB) KB" -ForegroundColor Green
    Write-Host " SHA-256:  $FileHash" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
}
catch {
    Write-Error "[FAILED] Database backup aborted: $_"
    exit 1
}

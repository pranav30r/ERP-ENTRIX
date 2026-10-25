# ENTRIX ERP - Automated Database Disaster Recovery Restore Script
# Platform: Windows PowerShell / Docker Compose
# Database: PostgreSQL 16 (Container: entrix-postgres)

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,

    [string]$ContainerName = "entrix-postgres",
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { "postgres" }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { "entrix_erp" })
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupPath)) {
    Write-Error "Backup file not found at path: $BackupPath"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host " [ENTRIX] Initiating PostgreSQL Disaster Recovery Restore" -ForegroundColor Magenta
Write-Host " Container: $ContainerName | Target DB: $DbName" -ForegroundColor DarkGray
Write-Host " Source:    $BackupPath" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Magenta

$StartTime = Get-Date

try {
    # Pipe SQL file into psql inside container
    Get-Content $BackupPath | docker exec -i $ContainerName psql -U $DbUser -d $DbName

    $Duration = ((Get-Date) - $StartTime).TotalSeconds

    Write-Host "[SUCCESS] Database restored successfully in $([math]::Round($Duration, 2))s" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Magenta
}
catch {
    Write-Error "[FAILED] Database restore aborted: $_"
    exit 1
}

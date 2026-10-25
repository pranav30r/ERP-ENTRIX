# ENTRIX ERP - Automated Database Disaster Recovery Restore Script
# Platform: Windows PowerShell / Docker Compose
# Database: PostgreSQL 16 (Container: entrix-postgres)

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,

    [string]$ContainerName = "entrix-postgres",
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { "postgres" }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { "entrix_erp" }),

    [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

# 1. Validate the backup file exists and is non-empty before restore
if (-not (Test-Path $BackupPath -PathType Leaf)) {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "[FAILED] Backup file not found at path: $BackupPath" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
}

$ResolvedPath = (Resolve-Path $BackupPath).Path
$backupItem = Get-Item $ResolvedPath
if ($backupItem.Length -eq 0) {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "[FAILED] Backup file is empty (0 bytes): $ResolvedPath" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
}

$IsDisposable = $VerifyOnly.IsPresent
$TargetDb = if ($IsDisposable) { "entrix_verify_" + (Get-Date -Format "yyyyMMdd_HHmmss") } else { $DbName }

Write-Host "==========================================================" -ForegroundColor Magenta
if ($IsDisposable) {
    Write-Host " [ENTRIX] Initiating Isolated Recovery Verification" -ForegroundColor Magenta
    Write-Host " Container:     $ContainerName" -ForegroundColor DarkGray
    Write-Host " Disposable DB: $TargetDb" -ForegroundColor DarkGray
} else {
    Write-Host " [ENTRIX] Initiating PostgreSQL Disaster Recovery Restore" -ForegroundColor Magenta
    Write-Host " Container:     $ContainerName" -ForegroundColor DarkGray
    Write-Host " Target DB:     $TargetDb" -ForegroundColor DarkGray
}
Write-Host " Source:        $ResolvedPath ($([math]::Round($backupItem.Length / 1KB, 2)) KB)" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Magenta

$StartTime = Get-Date
$ErrorLog = [System.IO.Path]::GetTempFileName()
$tmpTranscode = $null

try {
    # 2. Check that Docker container is running
    $containerStatus = (docker inspect --format="{{.State.Running}}" $ContainerName 2>$null)
    if ($LASTEXITCODE -ne 0 -or $containerStatus -ne "true") {
        throw "Container '$ContainerName' is not running or accessible."
    }

    # 3. If in verification mode, safely create disposable database
    if ($IsDisposable) {
        Write-Host " [1/4] Provisioning temporary disposable database '$TargetDb'..." -ForegroundColor Cyan
        docker exec $ContainerName psql -U $DbUser -d postgres -c "CREATE DATABASE $TargetDb;" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create temporary disposable database '$TargetDb'."
        }
    }

    # 4. Stream SQL file contents to psql without loading the entire file into PowerShell memory
    # Inspect encoding header for legacy UTF-16 LE BOM (0xFF 0xFE)
    $fs = [System.IO.File]::OpenRead($ResolvedPath)
    $header = New-Object byte[] 2
    $bytesRead = $fs.Read($header, 0, 2)
    $fs.Dispose()
    $isUtf16LE = ($bytesRead -ge 2 -and $header[0] -eq 0xFF -and $header[1] -eq 0xFE)

    $StreamPath = $ResolvedPath
    if ($isUtf16LE) {
        Write-Host " [INFO] Detected UTF-16 LE encoded backup. Streaming transcoding to UTF-8..." -ForegroundColor Yellow
        $tmpTranscode = [System.IO.Path]::GetTempFileName()
        $reader = New-Object System.IO.StreamReader($ResolvedPath, [System.Text.Encoding]::Unicode)
        $writer = New-Object System.IO.StreamWriter($tmpTranscode, $false, (New-Object System.Text.UTF8Encoding($false)))
        $chunkBuffer = New-Object char[] 65536
        while (($charsRead = $reader.Read($chunkBuffer, 0, 65536)) -gt 0) {
            $writer.Write($chunkBuffer, 0, $charsRead)
        }
        $writer.Flush()
        $writer.Dispose()
        $reader.Dispose()
        $StreamPath = $tmpTranscode
    }

    Write-Host " [2/4] Streaming SQL to psql with ON_ERROR_STOP=1..." -ForegroundColor Cyan
    cmd.exe /c "docker exec -i $ContainerName psql -U $DbUser -d $TargetDb -q -v ON_ERROR_STOP=1 < `"$StreamPath`" 2> `"$ErrorLog`""
    $exitCode = $LASTEXITCODE

    # 5. Correctly check native Docker exit code; never print SUCCESS after failure
    if ($exitCode -ne 0) {
        $errorMsg = ""
        if (Test-Path $ErrorLog) {
            $rawErr = Get-Content $ErrorLog -Raw
            if ($rawErr) { $errorMsg = $rawErr.Trim() }
        }
        if (-not $errorMsg) { $errorMsg = "psql process exited with non-zero error code $exitCode" }
        throw $errorMsg
    }

    # 6. If disposable verification, run empirical verification queries
    if ($IsDisposable) {
        Write-Host " [3/4] Verifying database integrity and relational constraints..." -ForegroundColor Cyan

        $tableCountStr = (docker exec $ContainerName psql -U $DbUser -d $TargetDb -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
        $userCountStr = (docker exec $ContainerName psql -U $DbUser -d $TargetDb -t -A -c "SELECT count(*) FROM users;").Trim()
        $ledgerCountStr = (docker exec $ContainerName psql -U $DbUser -d $TargetDb -t -A -c "SELECT count(*) FROM ledger_entries;").Trim()
        $ledgerDeltaStr = (docker exec $ContainerName psql -U $DbUser -d $TargetDb -t -A -c "SELECT COALESCE(SUM(debit_amount) - SUM(credit_amount), 0) FROM ledger_entries;").Trim()

        Write-Host "       Public Tables Restored:    $tableCountStr" -ForegroundColor Green
        Write-Host "       User Accounts Restored:    $userCountStr" -ForegroundColor Green
        Write-Host "       Ledger Entries Restored:   $ledgerCountStr" -ForegroundColor Green
        Write-Host "       Ledger Debit-Credit Delta: $ledgerDeltaStr" -ForegroundColor Green

        if ([int]$tableCountStr -lt 5) {
            throw "Integrity check failed: table count ($tableCountStr) is abnormally low."
        }
        if ([double]$ledgerDeltaStr -ne 0.0) {
            throw "Accounting integrity check failed: General ledger is unbalanced (delta = $ledgerDeltaStr)."
        }
    }

    $Duration = ((Get-Date) - $StartTime).TotalSeconds

    Write-Host "==========================================================" -ForegroundColor Green
    if ($IsDisposable) {
        Write-Host "[SUCCESS] Recovery verification PASSED in $([math]::Round($Duration, 2))s" -ForegroundColor Green
    } else {
        Write-Host "[SUCCESS] Database restored successfully in $([math]::Round($Duration, 2))s" -ForegroundColor Green
    }
    Write-Host "==========================================================" -ForegroundColor Green
}
catch {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "[FAILED] Database restore aborted: $_" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
}
finally {
    if ($IsDisposable) {
        Write-Host " [4/4] Cleaning up disposable database '$TargetDb'..." -ForegroundColor DarkGray
        docker exec $ContainerName psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $TargetDb;" 2>&1 | Out-Null
        Write-Host "       Disposable database '$TargetDb' dropped cleanly." -ForegroundColor DarkGray
    }
    if ($tmpTranscode -and (Test-Path $tmpTranscode)) {
        Remove-Item -Path $tmpTranscode -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $ErrorLog) {
        Remove-Item -Path $ErrorLog -Force -ErrorAction SilentlyContinue
    }
}

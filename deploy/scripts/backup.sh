#!/usr/bin/env bash
# ====================================================================
# ENTRIX ERP - Automated Database Logical Backup Script (POSIX / Linux)
# ====================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
CONTAINER_NAME="${CONTAINER_NAME:-entrix-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-entrix_erp}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/entrix_erp_backup_${TIMESTAMP}.sql"

echo "=========================================================="
echo " [ENTRIX] Initiating PostgreSQL Disaster Recovery Backup"
echo " Container: $CONTAINER_NAME | Target DB: $DB_NAME"
echo " Output:    $BACKUP_FILE"
echo "=========================================================="

START_TIME=$(date +%s)

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --inserts > "$BACKUP_FILE"

FILE_SIZE=$(wc -c < "$BACKUP_FILE")
if [ "$FILE_SIZE" -lt 100 ]; then
    echo "[ERROR] Backup file abnormally small (${FILE_SIZE} bytes). Aborting."
    rm -f "$BACKUP_FILE"
    exit 1
fi

SHA256_HASH=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "[SUCCESS] Backup completed in ${DURATION}s"
echo " Size:     $((FILE_SIZE / 1024)) KB"
echo " SHA-256:  $SHA256_HASH"
echo "=========================================================="

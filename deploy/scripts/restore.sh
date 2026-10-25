#!/usr/bin/env bash
# ====================================================================
# ENTRIX ERP - Automated Database Disaster Recovery Restore Script (POSIX / Linux)
# ====================================================================

set -euo pipefail

BACKUP_PATH="${1:-}"
CONTAINER_NAME="${CONTAINER_NAME:-entrix-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-entrix_erp}"

if [ -z "$BACKUP_PATH" ] || [ ! -f "$BACKUP_PATH" ]; then
    echo "[ERROR] Valid backup file path required as first argument."
    echo "Usage: ./restore.sh /path/to/backup.sql [target_db]"
    exit 1
fi

if [ -n "${2:-}" ]; then
    DB_NAME="$2"
fi

echo "=========================================================="
echo " [ENTRIX] Initiating PostgreSQL Disaster Recovery Restore"
echo " Container: $CONTAINER_NAME | Target DB: $DB_NAME"
echo " Source:    $BACKUP_PATH"
echo "=========================================================="

START_TIME=$(date +%s)

docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_PATH"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "[SUCCESS] Database restored successfully in ${DURATION}s"
echo "=========================================================="

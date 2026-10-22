#!/usr/bin/env bash
set -euo pipefail

# Project Eko — Production Release, Backup & Emergency Rollback Runbook Script
ACTION="${1:-verify}"
DATA_DIR="${PROJECT_EKO_DATA_DIR:-./services/api/data}"
BACKUP_DIR="${PROJECT_EKO_BACKUP_DIR:-./infra/backups}"

mkdir -p "$BACKUP_DIR"

case "$ACTION" in
  backup)
    STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
    ARCHIVE="$BACKUP_DIR/eko_snapshot_${STAMP}.tar.gz"
    tar -czf "$ARCHIVE" -C "$DATA_DIR" .
    echo "[Project Eko Ops] Backup created at $ARCHIVE"
    ;;
  restore)
    ARCHIVE="${2:?Usage: $0 restore <archive-path>}"
    mkdir -p "$DATA_DIR"
    tar -xzf "$ARCHIVE" -C "$DATA_DIR"
    echo "[Project Eko Ops] Restored snapshot from $ARCHIVE into $DATA_DIR"
    ;;
  verify)
    npm run build
    npm run verify:phase1
    npm run verify:phase2
    npm run verify:prod-readiness
    npm test
    ;;
  *)
    echo "Usage: $0 {backup|restore <archive>|verify}"
    exit 1
    ;;
esac

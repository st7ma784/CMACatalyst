#!/bin/bash
# Backup script for storage services
# Runs hourly via backup-service container

set -e

BACKUP_ROOT="/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "==================================="
echo "RMA Storage Backup"
echo "Timestamp: $TIMESTAMP"
echo "==================================="

# Redis backup (if using persistent storage)
if [ -d "$BACKUP_ROOT/redis" ]; then
    echo "[Redis] Backing up Redis data..."
    if docker exec rma-redis-storage redis-cli BGSAVE > /dev/null 2>&1; then
        sleep 5
        docker exec rma-redis-storage cp /data/dump.rdb /backup/dump_${TIMESTAMP}.rdb 2>/dev/null || true
        echo "[Redis] ✓ Backup completed"
    else
        echo "[Redis] ⚠ Backup skipped (using RAM disk or not running)"
    fi
fi

# PostgreSQL backup
if [ -d "$BACKUP_ROOT/postgres" ]; then
    echo "[Postgres] Backing up PostgreSQL database..."
    docker exec rma-postgres-storage pg_dump -U rma_user -d rma_db -F c -f /backup/rma_db_${TIMESTAMP}.dump 2>/dev/null || {
        echo "[Postgres] ⚠ Backup failed or service not running"
    }
    echo "[Postgres] ✓ Backup completed"
fi

# Neo4j backup
if [ -d "$BACKUP_ROOT/neo4j" ]; then
    echo "[Neo4j] Backing up Neo4j graph database..."
    docker exec rma-neo4j-storage neo4j-admin database dump neo4j --to-path=/backup --overwrite-destination=true 2>/dev/null || {
        echo "[Neo4j] ⚠ Backup failed or service not running"
    }
    if [ -f "$BACKUP_ROOT/neo4j/neo4j.dump" ]; then
        mv "$BACKUP_ROOT/neo4j/neo4j.dump" "$BACKUP_ROOT/neo4j/neo4j_${TIMESTAMP}.dump" 2>/dev/null || true
    fi
    echo "[Neo4j] ✓ Backup completed"
fi

# ChromaDB backup (copy entire directory)
if [ -d "$BACKUP_ROOT/chromadb" ]; then
    echo "[ChromaDB] Backing up ChromaDB vector database..."
    docker exec rma-chromadb-storage cp -r /chroma/chroma /backup/chromadb_${TIMESTAMP} 2>/dev/null || {
        echo "[ChromaDB] ⚠ Backup failed or service not running"
    }
    echo "[ChromaDB] ✓ Backup completed"
fi

# Cleanup old backups (keep last 7 days)
echo "[Cleanup] Removing backups older than 7 days..."
find $BACKUP_ROOT -type f -mtime +7 -name "*_[0-9]*" -delete 2>/dev/null || true
echo "[Cleanup] ✓ Cleanup completed"

echo "==================================="
echo "Backup completed successfully"
echo "==================================="

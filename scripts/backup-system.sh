#!/bin/bash

# CMA System Backup Script
# Automated backup solution for database, files, and configurations

set -e

# Configuration
BACKUP_DIR="/var/backups/cma-system"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30
LOG_FILE="/var/log/cma-backup.log"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cma_system}"
DB_USER="${DB_USER:-cma_user}"
DB_PASSWORD="${DB_PASSWORD:-cma_password}"

# S3 configuration (optional)
S3_BUCKET="${S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory
create_backup_dir() {
    local backup_path="$BACKUP_DIR/$TIMESTAMP"
    mkdir -p "$backup_path"
    echo "$backup_path"
}

# Database backup
backup_database() {
    local backup_path="$1"
    local db_backup_file="$backup_path/database_backup.sql"
    
    log "Starting database backup..."
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --create \
        > "$db_backup_file"
    
    # Compress the backup
    gzip "$db_backup_file"
    log "Database backup completed: ${db_backup_file}.gz"
}

# Files backup
backup_files() {
    local backup_path="$1"
    local files_backup="$backup_path/files_backup.tar.gz"
    
    log "Starting files backup..."
    
    # Backup uploaded files, configurations, and logs
    tar -czf "$files_backup" \
        --exclude='node_modules' \
        --exclude='*.log' \
        --exclude='tmp' \
        -C / \
        var/cma-uploads \
        etc/cma-system \
        var/log/cma-system 2>/dev/null || true
    
    log "Files backup completed: $files_backup"
}

# Configuration backup
backup_configurations() {
    local backup_path="$1"
    local config_backup="$backup_path/configurations"
    
    log "Starting configuration backup..."
    
    mkdir -p "$config_backup"
    
    # Backup Docker configurations
    cp -r /opt/cma-system/docker-compose*.yml "$config_backup/" 2>/dev/null || true
    cp -r /opt/cma-system/.env* "$config_backup/" 2>/dev/null || true
    
    # Backup Kubernetes manifests
    cp -r /opt/cma-system/k8s "$config_backup/" 2>/dev/null || true
    
    # Backup monitoring configurations
    cp -r /opt/cma-system/monitoring "$config_backup/" 2>/dev/null || true
    
    log "Configuration backup completed: $config_backup"
}

# Upload to S3 (if configured)
upload_to_s3() {
    local backup_path="$1"
    
    if [ -n "$S3_BUCKET" ]; then
        log "Uploading backup to S3..."
        
        aws s3 sync "$backup_path" "s3://$S3_BUCKET/cma-backups/$TIMESTAMP/" \
            --region "$AWS_REGION" \
            --storage-class STANDARD_IA
        
        log "S3 upload completed"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    # Cleanup S3 backups if configured
    if [ -n "$S3_BUCKET" ]; then
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "cma-backups/" \
            --query "Contents[?LastModified<='$(date -d "$RETENTION_DAYS days ago" --iso-8601)'].Key" \
            --output text | \
        xargs -I {} aws s3 rm "s3://$S3_BUCKET/{}" 2>/dev/null || true
    fi
    
    log "Cleanup completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check database connectivity
    PGPASSWORD="$DB_PASSWORD" pg_isready \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" || {
        log "ERROR: Database health check failed"
        exit 1
    }
    
    # Check disk space
    local available_space=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    local required_space=1048576  # 1GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        log "ERROR: Insufficient disk space for backup"
        exit 1
    fi
    
    log "Health check passed"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Email notification (if configured)
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "CMA System Backup $status" admin@cma-system.local 2>/dev/null || true
    fi
    
    # Slack notification (if webhook configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"CMA System Backup $status: $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main backup function
main() {
    log "Starting CMA System backup process..."
    
    # Perform health check
    health_check
    
    # Create backup directory
    local backup_path
    backup_path=$(create_backup_dir)
    
    # Perform backups
    backup_database "$backup_path"
    backup_files "$backup_path"
    backup_configurations "$backup_path"
    
    # Upload to S3 if configured
    upload_to_s3 "$backup_path"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Create backup summary
    local backup_size=$(du -sh "$backup_path" | cut -f1)
    local summary="Backup completed successfully. Size: $backup_size, Location: $backup_path"
    
    log "$summary"
    send_notification "SUCCESS" "$summary"
}

# Error handling
trap 'log "ERROR: Backup failed at line $LINENO"; send_notification "FAILED" "Backup process failed. Check logs for details."; exit 1' ERR

# Run main function
main "$@"

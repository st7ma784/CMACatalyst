#!/bin/bash

# CMA System Disaster Recovery Script
# Automated recovery solution for database, files, and configurations

set -e

# Configuration
BACKUP_DIR="/var/backups/cma-system"
RESTORE_DIR="/opt/cma-system-restore"
LOG_FILE="/var/log/cma-recovery.log"

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

# List available backups
list_backups() {
    log "Available local backups:"
    ls -la "$BACKUP_DIR" 2>/dev/null || log "No local backups found"
    
    if [ -n "$S3_BUCKET" ]; then
        log "Available S3 backups:"
        aws s3 ls "s3://$S3_BUCKET/cma-backups/" --recursive 2>/dev/null || log "No S3 backups found"
    fi
}

# Download backup from S3
download_from_s3() {
    local backup_timestamp="$1"
    local local_path="$BACKUP_DIR/$backup_timestamp"
    
    if [ -n "$S3_BUCKET" ]; then
        log "Downloading backup from S3: $backup_timestamp"
        
        mkdir -p "$local_path"
        aws s3 sync "s3://$S3_BUCKET/cma-backups/$backup_timestamp/" "$local_path/" \
            --region "$AWS_REGION"
        
        log "S3 download completed"
    fi
}

# Restore database
restore_database() {
    local backup_path="$1"
    local db_backup_file="$backup_path/database_backup.sql.gz"
    
    if [ ! -f "$db_backup_file" ]; then
        log "ERROR: Database backup file not found: $db_backup_file"
        exit 1
    fi
    
    log "Starting database restoration..."
    
    # Stop application services
    log "Stopping application services..."
    docker-compose -f /opt/cma-system/docker-compose.yml stop api frontend chatbot 2>/dev/null || true
    
    # Create database backup before restore
    local pre_restore_backup="/tmp/pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql"
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-password \
        > "$pre_restore_backup" 2>/dev/null || log "Warning: Could not create pre-restore backup"
    
    # Restore database
    gunzip -c "$db_backup_file" | PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d postgres \
        --no-password
    
    log "Database restoration completed"
}

# Restore files
restore_files() {
    local backup_path="$1"
    local files_backup="$backup_path/files_backup.tar.gz"
    
    if [ ! -f "$files_backup" ]; then
        log "WARNING: Files backup not found: $files_backup"
        return 0
    fi
    
    log "Starting files restoration..."
    
    # Create restore directory
    mkdir -p "$RESTORE_DIR"
    
    # Extract files
    tar -xzf "$files_backup" -C "$RESTORE_DIR"
    
    # Move files to correct locations
    if [ -d "$RESTORE_DIR/var/cma-uploads" ]; then
        mkdir -p /var/cma-uploads
        cp -r "$RESTORE_DIR/var/cma-uploads/"* /var/cma-uploads/ 2>/dev/null || true
    fi
    
    if [ -d "$RESTORE_DIR/etc/cma-system" ]; then
        mkdir -p /etc/cma-system
        cp -r "$RESTORE_DIR/etc/cma-system/"* /etc/cma-system/ 2>/dev/null || true
    fi
    
    log "Files restoration completed"
}

# Restore configurations
restore_configurations() {
    local backup_path="$1"
    local config_backup="$backup_path/configurations"
    
    if [ ! -d "$config_backup" ]; then
        log "WARNING: Configuration backup not found: $config_backup"
        return 0
    fi
    
    log "Starting configuration restoration..."
    
    # Restore Docker configurations
    if [ -f "$config_backup/docker-compose.yml" ]; then
        cp "$config_backup/docker-compose.yml" /opt/cma-system/ 2>/dev/null || true
    fi
    
    if [ -f "$config_backup/.env" ]; then
        cp "$config_backup/.env" /opt/cma-system/ 2>/dev/null || true
    fi
    
    # Restore Kubernetes manifests
    if [ -d "$config_backup/k8s" ]; then
        mkdir -p /opt/cma-system/k8s
        cp -r "$config_backup/k8s/"* /opt/cma-system/k8s/ 2>/dev/null || true
    fi
    
    # Restore monitoring configurations
    if [ -d "$config_backup/monitoring" ]; then
        mkdir -p /opt/cma-system/monitoring
        cp -r "$config_backup/monitoring/"* /opt/cma-system/monitoring/ 2>/dev/null || true
    fi
    
    log "Configuration restoration completed"
}

# Verify restoration
verify_restoration() {
    log "Verifying restoration..."
    
    # Check database connectivity
    PGPASSWORD="$DB_PASSWORD" pg_isready \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" || {
        log "ERROR: Database verification failed"
        return 1
    }
    
    # Check database tables
    local table_count=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-password \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    
    if [ "$table_count" -lt 10 ]; then
        log "ERROR: Database verification failed - insufficient tables ($table_count)"
        return 1
    fi
    
    log "Verification completed successfully"
}

# Start services
start_services() {
    log "Starting application services..."
    
    # Start Docker services
    if [ -f "/opt/cma-system/docker-compose.yml" ]; then
        cd /opt/cma-system
        docker-compose up -d
        
        # Wait for services to be ready
        sleep 30
        
        # Check service health
        docker-compose ps
    fi
    
    log "Services started"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Email notification (if configured)
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "CMA System Recovery $status" admin@cma-system.local 2>/dev/null || true
    fi
    
    # Slack notification (if webhook configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"CMA System Recovery $status: $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main recovery function
restore_system() {
    local backup_timestamp="$1"
    
    if [ -z "$backup_timestamp" ]; then
        log "ERROR: Backup timestamp required"
        echo "Usage: $0 restore <backup_timestamp>"
        echo "Available backups:"
        list_backups
        exit 1
    fi
    
    log "Starting CMA System recovery process for backup: $backup_timestamp"
    
    local backup_path="$BACKUP_DIR/$backup_timestamp"
    
    # Download from S3 if not available locally
    if [ ! -d "$backup_path" ] && [ -n "$S3_BUCKET" ]; then
        download_from_s3 "$backup_timestamp"
    fi
    
    if [ ! -d "$backup_path" ]; then
        log "ERROR: Backup not found: $backup_path"
        exit 1
    fi
    
    # Perform restoration
    restore_database "$backup_path"
    restore_files "$backup_path"
    restore_configurations "$backup_path"
    
    # Verify restoration
    verify_restoration
    
    # Start services
    start_services
    
    local summary="System recovery completed successfully from backup: $backup_timestamp"
    log "$summary"
    send_notification "SUCCESS" "$summary"
}

# Error handling
trap 'log "ERROR: Recovery failed at line $LINENO"; send_notification "FAILED" "Recovery process failed. Check logs for details."; exit 1' ERR

# Command handling
case "${1:-}" in
    "restore")
        restore_system "$2"
        ;;
    "list")
        list_backups
        ;;
    *)
        echo "Usage: $0 {restore|list} [backup_timestamp]"
        echo ""
        echo "Commands:"
        echo "  restore <timestamp>  - Restore system from backup"
        echo "  list                 - List available backups"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 restore 20231201_120000"
        exit 1
        ;;
esac

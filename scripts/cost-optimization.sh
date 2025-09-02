#!/bin/bash

# CMA System Cost Optimization Script
# Automated cost optimization for AWS resources

set -e

LOG_FILE="/var/log/cma-cost-optimization.log"
REGION="${AWS_REGION:-us-east-1}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Schedule ECS tasks for off-hours shutdown
optimize_ecs_scheduling() {
    log "Optimizing ECS task scheduling..."
    
    # Scale down non-production services during off-hours (10 PM - 6 AM UTC)
    local current_hour=$(date -u +%H)
    
    if [ "$current_hour" -ge 22 ] || [ "$current_hour" -lt 6 ]; then
        log "Off-hours detected, scaling down development services..."
        
        # Scale down development environment
        aws ecs update-service \
            --cluster cma-dev-cluster \
            --service cma-dev-api \
            --desired-count 0 \
            --region "$REGION" 2>/dev/null || true
            
        aws ecs update-service \
            --cluster cma-dev-cluster \
            --service cma-dev-frontend \
            --desired-count 0 \
            --region "$REGION" 2>/dev/null || true
    else
        log "Business hours detected, ensuring services are running..."
        
        # Scale up for business hours
        aws ecs update-service \
            --cluster cma-dev-cluster \
            --service cma-dev-api \
            --desired-count 1 \
            --region "$REGION" 2>/dev/null || true
            
        aws ecs update-service \
            --cluster cma-dev-cluster \
            --service cma-dev-frontend \
            --desired-count 1 \
            --region "$REGION" 2>/dev/null || true
    fi
}

# Optimize RDS instances
optimize_rds() {
    log "Optimizing RDS instances..."
    
    # Stop non-production RDS instances during off-hours
    local current_hour=$(date -u +%H)
    
    if [ "$current_hour" -ge 22 ] || [ "$current_hour" -lt 6 ]; then
        log "Stopping development RDS instances..."
        
        aws rds stop-db-instance \
            --db-instance-identifier cma-dev-postgres \
            --region "$REGION" 2>/dev/null || true
    else
        log "Starting development RDS instances..."
        
        aws rds start-db-instance \
            --db-instance-identifier cma-dev-postgres \
            --region "$REGION" 2>/dev/null || true
    fi
}

# Optimize EC2 instances
optimize_ec2() {
    log "Optimizing EC2 instances..."
    
    # Get development instances
    local dev_instances=$(aws ec2 describe-instances \
        --filters "Name=tag:Environment,Values=development" "Name=instance-state-name,Values=running" \
        --query "Reservations[].Instances[].InstanceId" \
        --output text \
        --region "$REGION" 2>/dev/null || echo "")
    
    local current_hour=$(date -u +%H)
    
    if [ "$current_hour" -ge 22 ] || [ "$current_hour" -lt 6 ]; then
        if [ -n "$dev_instances" ]; then
            log "Stopping development EC2 instances: $dev_instances"
            aws ec2 stop-instances --instance-ids $dev_instances --region "$REGION" 2>/dev/null || true
        fi
    else
        # Get stopped development instances
        local stopped_instances=$(aws ec2 describe-instances \
            --filters "Name=tag:Environment,Values=development" "Name=instance-state-name,Values=stopped" \
            --query "Reservations[].Instances[].InstanceId" \
            --output text \
            --region "$REGION" 2>/dev/null || echo "")
        
        if [ -n "$stopped_instances" ]; then
            log "Starting development EC2 instances: $stopped_instances"
            aws ec2 start-instances --instance-ids $stopped_instances --region "$REGION" 2>/dev/null || true
        fi
    fi
}

# Clean up old snapshots
cleanup_snapshots() {
    log "Cleaning up old snapshots..."
    
    # Delete EBS snapshots older than 30 days
    local cutoff_date=$(date -d "30 days ago" --iso-8601)
    
    aws ec2 describe-snapshots \
        --owner-ids self \
        --query "Snapshots[?StartTime<='$cutoff_date'].SnapshotId" \
        --output text \
        --region "$REGION" | \
    while read -r snapshot_id; do
        if [ -n "$snapshot_id" ]; then
            log "Deleting old snapshot: $snapshot_id"
            aws ec2 delete-snapshot --snapshot-id "$snapshot_id" --region "$REGION" 2>/dev/null || true
        fi
    done
}

# Clean up unused EBS volumes
cleanup_unused_volumes() {
    log "Cleaning up unused EBS volumes..."
    
    # Find unattached volumes older than 7 days
    local cutoff_date=$(date -d "7 days ago" --iso-8601)
    
    aws ec2 describe-volumes \
        --filters "Name=status,Values=available" \
        --query "Volumes[?CreateTime<='$cutoff_date'].VolumeId" \
        --output text \
        --region "$REGION" | \
    while read -r volume_id; do
        if [ -n "$volume_id" ]; then
            log "Deleting unused volume: $volume_id"
            aws ec2 delete-volume --volume-id "$volume_id" --region "$REGION" 2>/dev/null || true
        fi
    done
}

# Optimize S3 storage
optimize_s3() {
    log "Optimizing S3 storage..."
    
    # Apply lifecycle policies to move old objects to cheaper storage classes
    local buckets=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'cma')].Name" --output text --region "$REGION" 2>/dev/null || echo "")
    
    for bucket in $buckets; do
        if [ -n "$bucket" ]; then
            log "Applying lifecycle policy to bucket: $bucket"
            
            # Create lifecycle configuration
            cat > /tmp/lifecycle-policy.json << EOF
{
    "Rules": [
        {
            "ID": "CMAOptimization",
            "Status": "Enabled",
            "Filter": {},
            "Transitions": [
                {
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 365,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ]
        }
    ]
}
EOF
            
            aws s3api put-bucket-lifecycle-configuration \
                --bucket "$bucket" \
                --lifecycle-configuration file:///tmp/lifecycle-policy.json \
                --region "$REGION" 2>/dev/null || true
        fi
    done
    
    rm -f /tmp/lifecycle-policy.json
}

# Right-size instances based on CloudWatch metrics
rightsize_instances() {
    log "Analyzing instance utilization for right-sizing..."
    
    # Get instances with low CPU utilization (< 20% average over 7 days)
    local instances=$(aws ec2 describe-instances \
        --filters "Name=instance-state-name,Values=running" \
        --query "Reservations[].Instances[].InstanceId" \
        --output text \
        --region "$REGION" 2>/dev/null || echo "")
    
    for instance_id in $instances; do
        if [ -n "$instance_id" ]; then
            # Get average CPU utilization over the last 7 days
            local cpu_avg=$(aws cloudwatch get-metric-statistics \
                --namespace AWS/EC2 \
                --metric-name CPUUtilization \
                --dimensions Name=InstanceId,Value="$instance_id" \
                --start-time "$(date -d '7 days ago' --iso-8601)" \
                --end-time "$(date --iso-8601)" \
                --period 86400 \
                --statistics Average \
                --query "Datapoints[0].Average" \
                --output text \
                --region "$REGION" 2>/dev/null || echo "")
            
            if [ -n "$cpu_avg" ] && [ "$(echo "$cpu_avg < 20" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
                log "Instance $instance_id has low CPU utilization ($cpu_avg%). Consider downsizing."
                
                # Tag instance for review
                aws ec2 create-tags \
                    --resources "$instance_id" \
                    --tags Key=CostOptimization,Value="LowUtilization-$cpu_avg%" \
                    --region "$REGION" 2>/dev/null || true
            fi
        fi
    done
}

# Generate cost report
generate_cost_report() {
    log "Generating cost optimization report..."
    
    local report_file="/tmp/cma-cost-report-$(date +%Y%m%d).json"
    
    # Get cost and usage data for the last 30 days
    aws ce get-cost-and-usage \
        --time-period Start="$(date -d '30 days ago' +%Y-%m-%d)",End="$(date +%Y-%m-%d)" \
        --granularity MONTHLY \
        --metrics BlendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --region "$REGION" > "$report_file" 2>/dev/null || true
    
    log "Cost report generated: $report_file"
}

# Send optimization recommendations
send_recommendations() {
    local recommendations="$1"
    
    # Email notification (if configured)
    if command -v mail >/dev/null 2>&1; then
        echo "$recommendations" | mail -s "CMA System Cost Optimization Report" admin@cma-system.local 2>/dev/null || true
    fi
    
    # Slack notification (if webhook configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"CMA System Cost Optimization Report:\n$recommendations\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

# Main optimization function
main() {
    log "Starting CMA System cost optimization..."
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log "ERROR: AWS CLI not configured properly"
        exit 1
    fi
    
    # Run optimizations
    optimize_ecs_scheduling
    optimize_rds
    optimize_ec2
    cleanup_snapshots
    cleanup_unused_volumes
    optimize_s3
    rightsize_instances
    generate_cost_report
    
    local summary="Cost optimization completed successfully. Check logs for details."
    log "$summary"
    
    # Generate recommendations
    local recommendations=$(cat << EOF
Cost Optimization Summary:
- ECS services scheduled based on business hours
- RDS instances optimized for development environment
- EC2 instances managed for off-hours
- Old snapshots and unused volumes cleaned up
- S3 lifecycle policies applied
- Instance utilization analyzed for right-sizing
- Cost report generated

Next steps:
1. Review tagged instances for potential downsizing
2. Monitor cost trends in the generated report
3. Consider Reserved Instances for production workloads
EOF
)
    
    send_recommendations "$recommendations"
}

# Error handling
trap 'log "ERROR: Cost optimization failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"

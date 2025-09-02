# CMA System - AWS Cost Optimization Guide

## Overview

This guide provides specific strategies to minimize AWS costs while maintaining performance and reliability for the CMA Case Management System.

## Cost Breakdown by Service

### Estimated Monthly Costs (Production)

| Service | Configuration | Monthly Cost | Optimization Potential |
|---------|---------------|--------------|----------------------|
| ECS Fargate | 2 vCPU, 4GB RAM, 24/7 | $35-50 | Use Spot instances (-70%) |
| RDS PostgreSQL | db.t3.small | $25-35 | Reserved instances (-40%) |
| ElastiCache Redis | cache.t3.micro | $15-20 | Right-size based on usage |
| Application Load Balancer | Standard | $20-25 | Minimal optimization |
| EFS Storage | 10GB average | $3-5 | Use S3 for cold storage |
| Data Transfer | Moderate usage | $10-20 | CloudFront CDN |
| **Total** | | **$108-155** | **Optimized: $65-95** |

## Immediate Cost Optimizations

### 1. Use Fargate Spot Instances (Save 70%)

```yaml
# ECS Service with Spot capacity
CapacityProviderStrategy:
  - CapacityProvider: FARGATE_SPOT
    Weight: 4
    Base: 0
  - CapacityProvider: FARGATE
    Weight: 1
    Base: 1
```

**Savings**: $24-35/month on compute costs

### 2. RDS Reserved Instances (Save 40%)

```bash
# Purchase 1-year reserved instance
aws rds purchase-reserved-db-instances-offering \
    --reserved-db-instances-offering-id 12345678-1234-1234-1234-123456789012 \
    --db-instance-count 1
```

**Savings**: $10-14/month on database costs

### 3. Right-Size Resources

#### Database Sizing
```sql
-- Monitor database performance
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### ECS Task Sizing
```bash
# Monitor CPU/Memory utilization
aws cloudwatch get-metric-statistics \
    --namespace AWS/ECS \
    --metric-name CPUUtilization \
    --dimensions Name=ServiceName,Value=cma-service \
    --start-time 2023-01-01T00:00:00Z \
    --end-time 2023-01-31T23:59:59Z \
    --period 3600 \
    --statistics Average
```

### 4. Storage Optimization

#### S3 Lifecycle Policies
```json
{
  "Rules": [
    {
      "Id": "CMADocumentLifecycle",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "case-documents/"
      },
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
```

**Savings**: 50-80% on storage costs for older documents

## Auto-Scaling Configurations

### 1. ECS Service Auto Scaling

```yaml
AutoScalingTarget:
  Type: AWS::ApplicationAutoScaling::ScalableTarget
  Properties:
    ServiceNamespace: ecs
    ResourceId: !Sub service/${ECSCluster}/${ECSService}
    ScalableDimension: ecs:service:DesiredCount
    MinCapacity: 1
    MaxCapacity: 5

CPUScalingPolicy:
  Type: AWS::ApplicationAutoScaling::ScalingPolicy
  Properties:
    PolicyName: CPUTargetTracking
    PolicyType: TargetTrackingScaling
    ScalingTargetId: !Ref AutoScalingTarget
    TargetTrackingScalingPolicyConfiguration:
      TargetValue: 70.0
      PredefinedMetricSpecification:
        PredefinedMetricType: ECSServiceAverageCPUUtilization
      ScaleOutCooldown: 300
      ScaleInCooldown: 300

MemoryScalingPolicy:
  Type: AWS::ApplicationAutoScaling::ScalingPolicy
  Properties:
    PolicyName: MemoryTargetTracking
    PolicyType: TargetTrackingScaling
    ScalingTargetId: !Ref AutoScalingTarget
    TargetTrackingScalingPolicyConfiguration:
      TargetValue: 80.0
      PredefinedMetricSpecification:
        PredefinedMetricType: ECSServiceAverageMemoryUtilization
```

### 2. Database Auto Scaling (Aurora Serverless v2)

```yaml
AuroraCluster:
  Type: AWS::RDS::DBCluster
  Properties:
    Engine: aurora-postgresql
    EngineMode: provisioned
    EngineVersion: '13.7'
    ServerlessV2ScalingConfiguration:
      MinCapacity: 0.5
      MaxCapacity: 4
    DatabaseName: cma_db
    MasterUsername: postgres
    MasterUserPassword: !Ref DBPassword
```

**Savings**: Pay only for actual usage, can reduce costs by 60-90% during low usage periods

## Development Environment Optimization

### 1. Scheduled Start/Stop

```bash
#!/bin/bash
# scripts/aws-schedule.sh

# Stop development resources at night
aws ecs update-service \
    --cluster cma-dev-cluster \
    --service cma-dev-service \
    --desired-count 0

aws rds stop-db-instance \
    --db-instance-identifier cma-dev-postgres

# Start resources in the morning (use cron job)
# 0 8 * * 1-5 /path/to/start-dev-resources.sh
```

**Savings**: 65% reduction in development costs

### 2. Use Smaller Instance Types

```yaml
# Development task definition
TaskDefinition:
  Cpu: 256
  Memory: 512
  ContainerDefinitions:
    - Name: cma-app-dev
      Image: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/cma-app:dev
      Cpu: 256
      Memory: 512
```

## Monitoring and Alerting

### 1. Cost Anomaly Detection

```yaml
CostAnomalyDetector:
  Type: AWS::CE::AnomalyDetector
  Properties:
    AnomalyDetectorName: CMA-Cost-Anomaly-Detector
    MonitorType: DIMENSIONAL
    MonitorSpecification: |
      {
        "Dimension": "SERVICE",
        "Key": "SERVICE",
        "Values": ["Amazon Elastic Container Service", "Amazon Relational Database Service"],
        "MatchOptions": ["EQUALS"]
      }

CostAnomalySubscription:
  Type: AWS::CE::AnomalySubscription
  Properties:
    SubscriptionName: CMA-Cost-Alerts
    AnomalyDetector: !Ref CostAnomalyDetector
    MonitorArnList:
      - !Ref CostAnomalyDetector
    Subscribers:
      - Type: EMAIL
        Address: admin@example.com
    Threshold: 100
```

### 2. Budget Alerts

```bash
# Create monthly budget with alerts
aws budgets create-budget \
    --account-id $(aws sts get-caller-identity --query Account --output text) \
    --budget '{
        "BudgetName": "CMA-Monthly-Budget",
        "BudgetLimit": {
            "Amount": "150",
            "Unit": "USD"
        },
        "TimeUnit": "MONTHLY",
        "BudgetType": "COST",
        "CostFilters": {
            "TagKey": ["Project"],
            "TagValue": ["CMA"]
        }
    }' \
    --notifications-with-subscribers '[
        {
            "Notification": {
                "NotificationType": "FORECASTED",
                "ComparisonOperator": "GREATER_THAN",
                "Threshold": 80
            },
            "Subscribers": [
                {
                    "SubscriptionType": "EMAIL",
                    "Address": "admin@example.com"
                }
            ]
        },
        {
            "Notification": {
                "NotificationType": "ACTUAL",
                "ComparisonOperator": "GREATER_THAN",
                "Threshold": 100
            },
            "Subscribers": [
                {
                    "SubscriptionType": "EMAIL",
                    "Address": "admin@example.com"
                }
            ]
        }
    ]'
```

## Resource Tagging Strategy

### 1. Comprehensive Tagging

```yaml
# CloudFormation template tags
Tags:
  - Key: Project
    Value: CMA
  - Key: Environment
    Value: !Ref Environment
  - Key: CostCenter
    Value: IT-Operations
  - Key: Owner
    Value: DevOps-Team
  - Key: AutoShutdown
    Value: !If [IsDevelopment, "true", "false"]
  - Key: BackupRequired
    Value: !If [IsProduction, "true", "false"]
```

### 2. Tag-Based Cost Allocation

```bash
# Generate cost report by tags
aws ce get-cost-and-usage \
    --time-period Start=2023-01-01,End=2023-01-31 \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE Type=TAG,Key=Environment
```

## Performance vs Cost Trade-offs

### 1. Database Performance Tuning

```sql
-- Optimize queries to reduce RDS costs
CREATE INDEX CONCURRENTLY idx_cases_centre_status 
ON cases(centre_id, status) 
WHERE status IN ('active', 'pending');

-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM cases 
WHERE centre_id = 1 AND status = 'active';
```

### 2. Caching Strategy

```javascript
// Implement Redis caching to reduce database load
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// Cache frequently accessed data
async function getCaseWithCache(caseId) {
    const cacheKey = `case:${caseId}`;
    const cached = await client.get(cacheKey);
    
    if (cached) {
        return JSON.parse(cached);
    }
    
    const caseData = await db.query('SELECT * FROM cases WHERE id = $1', [caseId]);
    await client.setex(cacheKey, 300, JSON.stringify(caseData.rows[0])); // 5 min cache
    
    return caseData.rows[0];
}
```

## Cost Optimization Automation

### 1. Lambda Function for Resource Cleanup

```python
import boto3
import json
from datetime import datetime, timedelta

def lambda_handler(event, context):
    ecs = boto3.client('ecs')
    rds = boto3.client('rds')
    
    # Stop development resources after hours
    if is_after_hours():
        # Stop ECS services
        ecs.update_service(
            cluster='cma-dev-cluster',
            service='cma-dev-service',
            desiredCount=0
        )
        
        # Stop RDS instances
        try:
            rds.stop_db_instance(DBInstanceIdentifier='cma-dev-postgres')
        except rds.exceptions.InvalidDBInstanceStateFault:
            pass  # Already stopped
    
    return {
        'statusCode': 200,
        'body': json.dumps('Resource optimization completed')
    }

def is_after_hours():
    now = datetime.now()
    return now.hour >= 19 or now.hour <= 7 or now.weekday() >= 5
```

### 2. CloudWatch Events for Automation

```yaml
ScheduledRule:
  Type: AWS::Events::Rule
  Properties:
    Description: "Stop development resources after hours"
    ScheduleExpression: "cron(0 19 * * ? *)"  # 7 PM daily
    State: ENABLED
    Targets:
      - Arn: !GetAtt ResourceOptimizationFunction.Arn
        Id: "ResourceOptimizationTarget"
```

## Multi-Environment Cost Strategy

### 1. Environment-Specific Configurations

```yaml
# Parameters for different environments
Mappings:
  EnvironmentMap:
    development:
      ECSCpu: 256
      ECSMemory: 512
      DBInstanceClass: db.t3.micro
      MinCapacity: 0
      MaxCapacity: 2
    staging:
      ECSCpu: 512
      ECSMemory: 1024
      DBInstanceClass: db.t3.small
      MinCapacity: 1
      MaxCapacity: 3
    production:
      ECSCpu: 1024
      ECSMemory: 2048
      DBInstanceClass: db.t3.medium
      MinCapacity: 2
      MaxCapacity: 10
```

### 2. Shared Resources

```yaml
# Shared ALB for multiple environments
SharedALB:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    Name: cma-shared-alb
    Scheme: internet-facing
    Type: application

# Environment-specific target groups
DevTargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Name: cma-dev-targets
    Port: 5000
    Protocol: HTTP
    VpcId: !Ref VPC
    HealthCheckPath: /health
```

## Monitoring Dashboard

### 1. CloudWatch Dashboard

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", "ServiceName", "cma-service"],
          [".", "MemoryUtilization", ".", "."]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ECS Resource Utilization"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "cma-postgres"],
          [".", "DatabaseConnections", ".", "."]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Database Performance"
      }
    }
  ]
}
```

## Cost Optimization Checklist

### Monthly Review
- [ ] Review AWS Cost Explorer for anomalies
- [ ] Check resource utilization metrics
- [ ] Verify auto-scaling policies are working
- [ ] Review and update reserved instance purchases
- [ ] Clean up unused resources (snapshots, volumes, etc.)

### Quarterly Review
- [ ] Analyze traffic patterns for right-sizing
- [ ] Review storage lifecycle policies
- [ ] Evaluate new AWS services for cost savings
- [ ] Update cost allocation tags
- [ ] Review and optimize data transfer costs

### Annual Review
- [ ] Evaluate reserved instance vs on-demand costs
- [ ] Consider migrating to newer instance types
- [ ] Review architecture for cost optimization opportunities
- [ ] Update disaster recovery strategy costs
- [ ] Plan for growth and scaling costs

## Emergency Cost Controls

### 1. Circuit Breaker Pattern

```javascript
// Implement cost-aware circuit breaker
class CostAwareCircuitBreaker {
    constructor(monthlyBudget) {
        this.monthlyBudget = monthlyBudget;
        this.currentSpend = 0;
    }
    
    async checkBudget() {
        const costExplorer = new AWS.CostExplorer();
        const result = await costExplorer.getCostAndUsage({
            TimePeriod: {
                Start: new Date().toISOString().slice(0, 7) + '-01',
                End: new Date().toISOString().slice(0, 10)
            },
            Granularity: 'MONTHLY',
            Metrics: ['BlendedCost']
        }).promise();
        
        this.currentSpend = parseFloat(result.ResultsByTime[0].Total.BlendedCost.Amount);
        
        if (this.currentSpend > this.monthlyBudget * 0.9) {
            throw new Error('Monthly budget threshold exceeded');
        }
    }
}
```

### 2. Automated Resource Shutdown

```bash
#!/bin/bash
# Emergency shutdown script

echo "EMERGENCY: Shutting down non-critical resources"

# Scale down ECS services
aws ecs update-service --cluster cma-cluster --service cma-service --desired-count 1

# Stop development instances
aws rds stop-db-instance --db-instance-identifier cma-dev-postgres

# Delete unused snapshots older than 30 days
aws rds describe-db-snapshots --query 'DBSnapshots[?SnapshotCreateTime<=`2023-01-01`].DBSnapshotIdentifier' --output text | \
xargs -I {} aws rds delete-db-snapshot --db-snapshot-identifier {}

echo "Emergency shutdown completed"
```

This comprehensive cost optimization guide provides actionable strategies to minimize AWS costs while maintaining system performance and reliability.

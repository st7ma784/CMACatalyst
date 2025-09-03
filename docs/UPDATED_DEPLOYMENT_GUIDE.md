# Complete MordecAI Deployment Guide v2.0

This updated guide covers deployment of the enhanced MordecAI system with all microservices including CoA generation and translation services.

## System Architecture Overview

### Microservices Architecture (8 Services)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Main API      │    │   Chatbot       │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (Python)      │
│   Port: 80/443  │    │   Port: 5000    │    │   Port: 8001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲                        ▲
                                │                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Document Inbox │    │  OCR Processor  │    │  Translation    │
│   (Node.js)     │    │   (Node.js)     │    │   (Python)      │
│   Port: 3001    │    │   Port: 3002    │    │   Port: 8003    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲
                                │
┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   MinIO Storage │
│   Port: 5432    │    │   Port: 9000    │
└─────────────────┘    └─────────────────┘
                                ▲
                                │
┌─────────────────┐    ┌─────────────────┐
│     Redis       │    │   RabbitMQ      │
│   Port: 6379    │    │   Port: 5672    │
└─────────────────┘    └─────────────────┘
```

### Service Responsibilities

1. **Frontend (React)**: User interface with enhanced chatbot integration
2. **Main API (Node.js)**: Core business logic, authentication, case management
3. **Chatbot Service (Python)**: Local LLM with MCP endpoints, financial calculations
4. **Document Inbox (Node.js)**: Email processing, file upload handling
5. **OCR Processor (Node.js)**: Document text extraction using Tesseract
6. **Translation Service (Python)**: Multi-language support with Helsinki-NLP models
7. **PostgreSQL**: Primary data storage
8. **MinIO**: S3-compatible object storage
9. **Redis**: Session management and caching
10. **RabbitMQ**: Message queue for document processing

## Hardware Requirements

### Development Environment
```yaml
Minimum:
  CPU: 4 cores
  RAM: 8GB
  Storage: 50GB SSD
  Network: 10Mbps

Recommended:
  CPU: 8 cores
  RAM: 16GB
  Storage: 200GB SSD
  Network: 100Mbps
```

### Production Environment
```yaml
Small Office (10-50 users):
  CPU: 8-12 cores
  RAM: 16-32GB
  Storage: 500GB SSD
  Network: 1Gbps

Large Organization (50+ users):
  CPU: 16-32 cores
  RAM: 32-64GB
  Storage: 1TB+ NVMe SSD
  Network: 10Gbps
  GPU: Optional for faster AI processing
```

## Local Development Setup

### 1. Quick Start
```bash
# Clone repository
git clone <repository-url>
cd windsurf-project

# Start all services (first run takes ~10 minutes for model downloads)
docker-compose up -d

# Monitor startup progress
docker-compose logs -f

# Verify all services are healthy
./scripts/health-check.sh
```

### 2. Service Startup Order
```bash
# Services start in dependency order:
1. PostgreSQL, Redis, MinIO, RabbitMQ (infrastructure)
2. Translation Service (models take time to load)
3. Chatbot Service (LLM models loading)
4. Document Inbox, OCR Processor (depend on storage/queue)
5. Main API (depends on all services)
6. Frontend (served by Nginx)
```

### 3. Development URLs
- **Main Application**: http://localhost
- **API**: http://localhost:5000
- **Chatbot**: http://localhost:8001
- **Translation**: http://localhost:8003
- **MinIO Console**: http://localhost:9001
- **RabbitMQ Management**: http://localhost:15672

## AWS Deployment

### Enhanced ECS Task Definitions

Create separate task definitions for each service:

#### Main API Service
```json
{
  "family": "cma-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "cma-app",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/cma-app:latest",
      "portMappings": [{"containerPort": 5000, "protocol": "tcp"}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "CHATBOT_URL", "value": "http://cma-chatbot:8001"},
        {"name": "TRANSLATION_SERVICE_URL", "value": "http://cma-translation:8003"},
        {"name": "DOCUMENT_INBOX_URL", "value": "http://cma-document-inbox:3001"},
        {"name": "OCR_PROCESSOR_URL", "value": "http://cma-ocr:3002"}
      ],
      "secrets": [
        {"name": "DB_PASSWORD", "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/cma/db-password"},
        {"name": "GOOGLE_TRANSLATE_API_KEY", "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/cma/translate-key"}
      ]
    }
  ]
}
```

#### Chatbot Service  
```json
{
  "family": "cma-chatbot",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "cma-chatbot",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/cma-chatbot:latest",
      "portMappings": [{"containerPort": 8001, "protocol": "tcp"}],
      "environment": [
        {"name": "LLM_MODEL_NAME", "value": "microsoft/DialoGPT-medium"},
        {"name": "TRANSFORMERS_CACHE", "value": "/app/models"}
      ],
      "mountPoints": [
        {
          "sourceVolume": "model-cache",
          "containerPath": "/app/models"
        }
      ]
    }
  ],
  "volumes": [
    {
      "name": "model-cache",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-models",
        "transitEncryption": "ENABLED"
      }
    }
  ]
}
```

#### Translation Service
```json
{
  "family": "cma-translation",
  "networkMode": "awsvpc", 
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "cma-translation",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/cma-translation-service:latest",
      "portMappings": [{"containerPort": 8003, "protocol": "tcp"}],
      "environment": [
        {"name": "TRANSFORMERS_CACHE", "value": "/app/models"},
        {"name": "HF_HOME", "value": "/app/models"}
      ],
      "mountPoints": [
        {
          "sourceVolume": "translation-models",
          "containerPath": "/app/models"
        }
      ]
    }
  ],
  "volumes": [
    {
      "name": "translation-models", 
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-translation-models",
        "transitEncryption": "ENABLED"
      }
    }
  ]
}
```

## Resource Requirements by Service

### CPU and Memory Allocation
```yaml
Service Resource Allocation:
  Main API: 1 vCPU, 2GB RAM
  Chatbot: 2 vCPU, 4GB RAM (for LLM inference)
  Translation: 1 vCPU, 4GB RAM (for translation models)
  Document Inbox: 0.5 vCPU, 1GB RAM
  OCR Processor: 1 vCPU, 2GB RAM (Tesseract is CPU-intensive)
  Infrastructure: 2 vCPU, 4GB RAM (PostgreSQL, Redis, RabbitMQ)

Total Minimum: 7.5 vCPU, 17GB RAM
```

### Storage Requirements
```yaml
Model Storage (EFS):
  - LLM Models: 2-10GB (depending on model size)
  - Translation Models: 1-5GB per language pair
  - Total Models: 15-50GB

Document Storage (S3):
  - Case documents: Variable (1GB-1TB depending on volume)
  - OCR processed text: 10% of document size
  - Backups: 2x primary storage

Database Storage:
  - Application data: 1-10GB
  - Logs and audit: 1-5GB per month
  - Backups: 7-day retention recommended
```

## Environment Configuration

### Enhanced Environment Variables
```env
# Main Application
NODE_ENV=production
DB_HOST=cma-postgres.cluster-xyz.region.rds.amazonaws.com
REDIS_HOST=cma-redis.cache.amazonaws.com
RABBITMQ_URL=amqps://user:pass@mq.region.amazonaws.com:5671

# Service URLs
CHATBOT_URL=http://cma-chatbot:8001
TRANSLATION_SERVICE_URL=http://cma-translation:8003
DOCUMENT_INBOX_URL=http://cma-document-inbox:3001
OCR_PROCESSOR_URL=http://cma-ocr:3002

# AI Configuration
LLM_MODEL_NAME=microsoft/DialoGPT-medium
TRANSFORMERS_CACHE=/app/models
HF_OFFLINE=false

# Translation Service
GOOGLE_TRANSLATE_API_KEY=your-api-key-here
LOCAL_TRANSLATION_ENABLED=true
SUPPORTED_LANGUAGES=es,fr,de,it,pt,pl,ar,ur,hi,zh

# Storage Configuration
S3_BUCKET=cma-documents-prod
S3_REGION=us-east-1
EFS_MOUNT_TARGET=/app/uploads

# Feature Flags
ENABLE_COA_GENERATION=true
ENABLE_TRANSLATION=true
ENABLE_WEB_SEARCH=true
ENABLE_FINANCIAL_CALC=true
```

## Load Balancer Configuration

### Application Load Balancer Rules
```yaml
Target Groups:
  - cma-app-tg: Main API (Port 5000)
  - cma-chatbot-tg: Chatbot WebSocket (Port 8001)
  - cma-translation-tg: Translation API (Port 8003)

Listener Rules:
  - Default: Forward to cma-app-tg
  - /chatbot/*: Forward to cma-chatbot-tg
  - /api/translation/*: Forward to cma-translation-tg
  - WebSocket /ws/*: Forward to cma-chatbot-tg
```

## Security Configuration

### Enhanced Security Groups
```yaml
ALB Security Group:
  Inbound:
    - Port 80 (HTTP): 0.0.0.0/0
    - Port 443 (HTTPS): 0.0.0.0/0

ECS Security Group:
  Inbound:
    - Port 5000: ALB Security Group
    - Port 8001: ALB Security Group  
    - Port 8003: ALB Security Group
    - Port 3001-3002: Internal services only

Database Security Group:
  Inbound:
    - Port 5432: ECS Security Group only

Cache Security Group:
  Inbound:
    - Port 6379: ECS Security Group only

Message Queue Security Group:
  Inbound:
    - Port 5672: ECS Security Group only
```

### IAM Roles and Policies

#### ECS Task Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject", 
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::cma-documents-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "translate:TranslateText",
        "translate:DetectDominantLanguage"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "translate:SourceLanguageCode": "en"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/cma/*"
    }
  ]
}
```

## Deployment Scripts

### 1. Complete Deployment Script
```bash
#!/bin/bash
# deploy-to-aws.sh

set -e

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
ECR_BASE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "Deploying MordecAI to AWS..."
echo "Account: $ACCOUNT_ID"
echo "Region: $REGION"

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_BASE

# Build all services
echo "Building container images..."
docker-compose build

# Tag and push all images
services=("cma-app" "cma-chatbot" "cma-document-inbox" "cma-ocr-processor" "cma-translation-service")

for service in "${services[@]}"; do
    echo "Pushing $service..."
    docker tag $service:latest $ECR_BASE/$service:latest
    docker push $ECR_BASE/$service:latest
done

# Deploy infrastructure
echo "Deploying infrastructure..."
aws cloudformation deploy \
    --template-file cloudformation/infrastructure.yaml \
    --stack-name cma-infrastructure \
    --parameter-overrides \
        Environment=production \
        DBPassword=$DB_PASSWORD \
    --capabilities CAPABILITY_IAM

# Deploy ECS services
echo "Deploying ECS services..."
for service in "${services[@]}"; do
    aws ecs register-task-definition \
        --cli-input-json file://ecs-tasks/$service-task-definition.json
        
    aws ecs update-service \
        --cluster cma-cluster \
        --service $service \
        --task-definition $service:LATEST \
        --desired-count 1
done

echo "Deployment complete!"
echo "Application URL: $(aws cloudformation describe-stacks --stack-name cma-infrastructure --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)"
```

### 2. Health Check Script
```bash
#!/bin/bash
# health-check-all.sh

services=(
    "http://localhost:5000/health:Main API"
    "http://localhost:8001/health:Chatbot"
    "http://localhost:8003/health:Translation"
    "http://localhost:3001/health:Document Inbox"
    "http://localhost:3002/health:OCR Processor"
    "http://localhost:9000/minio/health/live:MinIO"
    "http://localhost:15672/api/aliveness-test/vhost:RabbitMQ"
)

echo "=== MordecAI Health Check ==="
for service in "${services[@]}"; do
    url="${service%%:*}"
    name="${service##*:}"
    
    if curl -sf "$url" >/dev/null; then
        echo "✓ $name: Healthy"
    else
        echo "✗ $name: Unhealthy"
    fi
done

echo ""
echo "=== Docker Container Status ==="
docker-compose ps
```

## Monitoring and Observability

### Enhanced CloudWatch Metrics
```yaml
Custom Metrics:
  - CoA Generation Rate: /minute
  - Translation Request Volume: /minute
  - OCR Processing Time: seconds
  - LLM Response Time: seconds
  - Document Queue Length: count
  - Active Chat Sessions: count
  - Model Memory Usage: GB
  - Translation Accuracy: %

Dashboards:
  - Service Health Overview
  - AI/ML Performance
  - Document Processing Pipeline
  - User Activity
  - Cost Analysis
```

### Log Aggregation
```yaml
Log Groups:
  - /ecs/cma-app: Main application logs
  - /ecs/cma-chatbot: AI chat interactions
  - /ecs/cma-translation: Translation requests
  - /ecs/cma-document-inbox: File processing
  - /ecs/cma-ocr: OCR processing logs

Log Retention:
  - Application logs: 30 days
  - Audit logs: 90 days
  - Error logs: 60 days
```

## Performance Optimization

### AI Model Optimization
```yaml
LLM Configuration:
  Development:
    Model: microsoft/DialoGPT-small (117MB)
    CPU: 1 vCPU
    Memory: 2GB
    
  Production:
    Model: microsoft/DialoGPT-medium (345MB)
    CPU: 2 vCPU
    Memory: 4GB
    
  Enterprise:
    Model: meta-llama/Llama-2-7b-chat-hf (13GB)
    GPU: g4dn.xlarge
    Memory: 16GB
    
Translation Models:
  Per Language Pair: 300MB-1GB
  Recommended: Cache top 5 languages
  Storage: EFS with burst credits
```

### Caching Strategy
```yaml
Redis Caching:
  - Chat sessions: 24 hours TTL
  - Translation cache: 7 days TTL
  - Case contexts: 1 hour TTL
  - API responses: 15 minutes TTL

Model Caching:
  - LLM models: Persistent EFS storage
  - Translation models: Lazy loading
  - OCR preprocessing: Memory cache
```

## Backup and Disaster Recovery

### Enhanced Backup Strategy
```bash
#!/bin/bash
# enhanced-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)

# 1. Database backup
aws rds create-db-snapshot \
    --db-instance-identifier cma-postgres \
    --db-snapshot-identifier cma-db-backup-$DATE

# 2. S3 document backup to different region
aws s3 sync s3://cma-documents-prod s3://cma-documents-backup-us-west-2 \
    --source-region us-east-1 \
    --region us-west-2

# 3. EFS model backup
aws datasync create-task \
    --source-location-arn arn:aws:efs:us-east-1:ACCOUNT:file-system/fs-models \
    --destination-location-arn arn:aws:s3:us-east-1:ACCOUNT:bucket/cma-models-backup

# 4. Configuration backup
aws ssm get-parameters-by-path --path "/cma/" --recursive > config-backup-$DATE.json

echo "Backup completed: $DATE"
```

### Recovery Procedures
```bash
#!/bin/bash
# disaster-recovery.sh

BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    exit 1
fi

echo "Starting disaster recovery from backup: $BACKUP_DATE"

# 1. Restore database
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier cma-postgres-restored \
    --db-snapshot-identifier cma-db-backup-$BACKUP_DATE

# 2. Restore documents
aws s3 sync s3://cma-documents-backup-us-west-2 s3://cma-documents-prod

# 3. Restore models (if needed)
aws datasync start-task-execution \
    --task-arn arn:aws:datasync:us-east-1:ACCOUNT:task/task-restore-models

echo "Recovery initiated. Check AWS console for progress."
```

## Cost Optimization

### Updated Cost Estimates

#### Development Environment
```
Monthly Costs:
- ECS Fargate (6 services): $30-50
- RDS db.t3.micro: $15-20  
- ElastiCache t3.micro: $15
- S3 Storage (100GB): $3
- EFS (50GB): $15
- Amazon MQ: $20
- Data Transfer: $5-10
- CloudWatch Logs: $5

Total: $108-138/month
```

#### Production Environment  
```
Monthly Costs:
- ECS Fargate (scaled): $200-400
- RDS db.t3.small Multi-AZ: $50-70
- ElastiCache cluster: $40-60
- S3 Storage (1TB): $23
- EFS (200GB): $60
- Amazon MQ cluster: $80
- CloudWatch: $20-30
- Load Balancer: $18
- Data Transfer: $50-100

Total: $541-841/month
```

## Scaling Considerations

### Auto Scaling Configuration
```yaml
AI Services Scaling:
  Chatbot:
    Min: 1 instance
    Max: 5 instances
    Target CPU: 70%
    Scale up: +1 instance when CPU > 70% for 2 minutes
    Scale down: -1 instance when CPU < 30% for 5 minutes
    
  Translation:
    Min: 1 instance  
    Max: 3 instances
    Target: Request count > 10/minute
    
  OCR Processor:
    Min: 1 instance
    Max: 10 instances
    Target: Queue depth > 5 documents
```

## Compliance and Security Updates

### Data Privacy Features
- **Local AI Processing**: All AI operations occur within AWS infrastructure
- **Translation Options**: Local models + optional Google Translate
- **Audit Trails**: Complete logging of CoA generation and translations
- **Data Residency**: All data stays within specified AWS region
- **Encryption**: At-rest and in-transit encryption for all services

### FCA Compliance
- **CoA Generation**: Automated compliance with advice confirmation requirements  
- **Audit Logging**: Full trail of advisor actions and AI-generated content
- **Data Retention**: Configurable retention periods for different data types
- **Access Controls**: Role-based access with detailed permissions

This enhanced deployment guide ensures all new features are properly configured and deployed while maintaining security and compliance standards.
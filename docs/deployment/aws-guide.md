# AWS Deployment Guide

This guide provides comprehensive instructions for deploying the CMA Case Management System on Amazon Web Services (AWS) with cost optimization strategies and production-ready configurations.

## Cost-Optimized AWS Architecture

```{mermaid}
graph TB
    subgraph "Edge & CDN"
        CF[CloudFront CDN]
        R53[Route 53 DNS]
    end
    
    subgraph "Load Balancing"
        ALB[Application Load Balancer]
    end
    
    subgraph "Compute - ECS Fargate"
        FRONTEND[Frontend Tasks]
        API[API Tasks]
        WORKER[Background Workers]
    end
    
    subgraph "Database Layer"
        RDS[(RDS PostgreSQL)]
        REDIS[ElastiCache Redis]
    end
    
    subgraph "Storage"
        S3[S3 Document Storage]
        EFS[EFS Shared Storage]
    end
    
    subgraph "Monitoring"
        CW[CloudWatch]
        XRAY[X-Ray Tracing]
    end
    
    CF --> ALB
    R53 --> CF
    ALB --> FRONTEND
    ALB --> API
    API --> WORKER
    API --> RDS
    API --> REDIS
    API --> S3
    WORKER --> S3
    WORKER --> RDS
    
    CW --> FRONTEND
    CW --> API
    CW --> WORKER
    XRAY --> API
```

## Infrastructure as Code (Terraform)

### Provider Configuration
```hcl
# providers.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "cma-terraform-state"
    key    = "production/terraform.tfstate"
    region = "eu-west-2"
    
    dynamodb_table = "cma-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "CMA-Case-Management"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
```

### VPC and Networking
```hcl
# vpc.tf
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "${var.project_name}-${var.environment}"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true
  
  # Cost optimization: Single NAT Gateway for non-production
  single_nat_gateway = var.environment != "production"
  
  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb-"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-ecs-tasks-"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### RDS Database
```hcl
# rds.tf
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}"
  subnet_ids = module.vpc.private_subnets
  
  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}"
  
  # Cost optimization configurations
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.environment == "production" ? "db.t3.medium" : "db.t3.micro"
  
  allocated_storage     = var.environment == "production" ? 100 : 20
  max_allocated_storage = var.environment == "production" ? 1000 : 100
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = "cma_${var.environment}"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  # Backup configuration
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Sun:04:00-Sun:05:00"
  
  # Performance insights for production
  performance_insights_enabled = var.environment == "production"
  monitoring_interval         = var.environment == "production" ? 60 : 0
  
  # Cost optimization: Disable multi-AZ for non-production
  multi_az = var.environment == "production"
  
  # Prevent accidental deletion
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"
  
  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}
```

### ECS Cluster and Services
```hcl
# ecs.tf
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"
  
  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      
      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs.name
      }
    }
  }
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = module.vpc.public_subnets
  
  enable_deletion_protection = var.environment == "production"
  
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "alb"
    enabled = true
  }
}

# Target Groups
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-frontend-${var.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-api-${var.environment}"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

# ECS Task Definitions
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.environment == "production" ? 512 : 256
  memory                   = var.environment == "production" ? 1024 : 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn
  
  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = "${aws_ecr_repository.frontend.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "REACT_APP_API_URL"
          value = "https://${var.domain_name}/api"
        },
        {
          name  = "NODE_ENV"
          value = var.environment
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "frontend"
        }
      }
      
      essential = true
    }
  ])
}

# ECS Services
resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"
  
  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets         = module.vpc.private_subnets
    assign_public_ip = false
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }
  
  depends_on = [aws_lb_listener.frontend]
}
```

## Cost Optimization Strategies

### 1. **Compute Cost Optimization**

#### ECS Fargate Spot Instances
```hcl
# spot-instances.tf
resource "aws_ecs_capacity_provider" "fargate_spot" {
  name = "FARGATE_SPOT"
  
  auto_scaling_group_provider {
    auto_scaling_group_arn = aws_autoscaling_group.ecs_spot.arn
    
    managed_scaling {
      maximum_scaling_step_size = 10
      minimum_scaling_step_size = 1
      status                    = "ENABLED"
      target_capacity          = 80
    }
    
    managed_termination_protection = "DISABLED"
  }
}

# Use Spot instances for non-critical workloads
resource "aws_ecs_service" "background_workers" {
  name            = "${var.project_name}-workers-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.workers.arn
  desired_count   = 1
  
  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight           = 100
  }
  
  # Allow up to 70% spot instances
  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 70
  }
}
```

#### Auto Scaling Configuration
```hcl
# auto-scaling.tf
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.environment == "production" ? 10 : 3
  min_capacity       = var.environment == "production" ? 2 : 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_up" {
  name               = "${var.project_name}-api-scale-up-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

### 2. **Database Cost Optimization**

#### RDS Cost Optimization
```hcl
# rds-optimized.tf
resource "aws_db_instance" "main" {
  # Use cost-effective instance types
  instance_class = var.environment == "production" ? "db.r6g.large" : "db.t4g.micro"
  
  # ARM-based Graviton2 processors for better price/performance
  engine_version = "15.4"
  
  # Storage optimization
  storage_type          = "gp3"
  allocated_storage     = 20
  max_allocated_storage = var.environment == "production" ? 1000 : 100
  
  # Automated scaling and monitoring
  auto_minor_version_upgrade = true
  
  # For non-production: Use burstable instance classes
  # For production: Use reserved instances for predictable workloads
}

# Read Replicas for read-heavy workloads (production only)
resource "aws_db_instance" "read_replica" {
  count = var.environment == "production" ? 1 : 0
  
  identifier = "${var.project_name}-read-replica-${var.environment}"
  
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = "db.t4g.medium"
  
  # Read replicas don't need backup retention
  backup_retention_period = 0
  skip_final_snapshot    = true
}
```

### 3. **Storage Cost Optimization**

#### S3 Intelligent Tiering
```hcl
# s3.tf
resource "aws_s3_bucket" "documents" {
  bucket = "${var.project_name}-documents-${var.environment}-${random_string.bucket_suffix.result}"
}

resource "aws_s3_bucket_intelligent_tiering_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  name   = "EntireBucket"
  
  status = "Enabled"
  
  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
  
  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  
  rule {
    id     = "document_lifecycle"
    status = "Enabled"
    
    # Move to IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    # Move to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    # Move to Deep Archive after 1 year
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    
    # Delete incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
```

## Deployment Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: eu-west-2
  ECR_REPOSITORY_FRONTEND: cma-frontend
  ECR_REPOSITORY_API: cma-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: |
            client/package-lock.json
            server/package-lock.json
      
      - name: Install dependencies
        run: |
          cd client && npm ci
          cd ../server && npm ci
      
      - name: Run tests
        run: |
          cd client && npm test -- --coverage --watchAll=false
          cd ../server && npm test -- --coverage
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build, tag, and push frontend image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:$IMAGE_TAG -f Dockerfile.frontend .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_FRONTEND:latest
      
      - name: Build, tag, and push API image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG -f Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY_API:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:latest
      
      - name: Update ECS service
        run: |
          aws ecs update-service --cluster cma-production --service cma-frontend-production --force-new-deployment
          aws ecs update-service --cluster cma-production --service cma-api-production --force-new-deployment
```

## Monitoring and Alerting

### CloudWatch Configuration
```hcl
# monitoring.tf
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.api.name],
            [".", "MemoryUtilization", ".", "."],
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ECS Service Metrics"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.id],
            [".", "DatabaseConnections", ".", "."],
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Metrics"
        }
      }
    ]
  })
}

# Cost Monitoring
resource "aws_budgets_budget" "cost" {
  name         = "${var.project_name}-${var.environment}-monthly-budget"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  
  cost_filters = {
    Tag = [
      "Project:${var.project_name}",
      "Environment:${var.environment}"
    ]
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
```

## Estimated Monthly Costs

### Development Environment
```
Service                 | Configuration              | Monthly Cost (USD)
------------------------|----------------------------|------------------
ECS Fargate            | 1 task, 0.25 vCPU, 0.5GB | $12
RDS PostgreSQL         | db.t4g.micro               | $16
ElastiCache Redis      | cache.t4g.micro            | $11
Application Load Balancer | Standard                 | $18
S3 Storage             | 10GB with lifecycle       | $2
CloudWatch Logs        | 5GB ingestion              | $3
NAT Gateway            | Single gateway             | $32
Route 53               | Hosted zone + queries      | $2
------------------------|----------------------------|------------------
TOTAL                  |                            | ~$96/month
```

### Production Environment
```
Service                 | Configuration              | Monthly Cost (USD)
------------------------|----------------------------|------------------
ECS Fargate            | 4 tasks, 1 vCPU, 2GB     | $96
RDS PostgreSQL         | db.r6g.large + read replica| $180
ElastiCache Redis      | cache.r6g.large           | $120
Application Load Balancer | Standard                 | $18
S3 Storage             | 100GB with intelligent tier| $15
CloudWatch            | Enhanced monitoring        | $25
NAT Gateway           | Multi-AZ                   | $96
Route 53              | Hosted zone + queries      | $5
CloudFront CDN        | 100GB transfer             | $8
------------------------|----------------------------|------------------
TOTAL                  |                            | ~$563/month
```

### Cost Optimization Tips
1. **Use Reserved Instances**: 40-60% savings for predictable workloads
2. **Implement Auto Scaling**: Automatically scale down during low usage
3. **Use Spot Instances**: Up to 90% savings for fault-tolerant workloads
4. **Monitor and Right-Size**: Regular review of resource utilization
5. **Implement Lifecycle Policies**: Automatic movement to cheaper storage tiers
6. **Use AWS Free Tier**: First 12 months include significant free usage

This deployment guide provides a production-ready, cost-optimized AWS architecture that can scale from small development environments to large production deployments while maintaining security and compliance requirements.

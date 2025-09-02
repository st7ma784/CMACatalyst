# CMA Case Management System - AWS Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the CMA Case Management System to AWS using cost-effective, scalable architecture patterns.

## Architecture Options

### Option 1: Cost-Effective Starter (Est. $50-100/month)
- **Compute**: ECS Fargate (2 vCPU, 4GB RAM)
- **Database**: RDS PostgreSQL (db.t3.micro)
- **Cache**: ElastiCache Redis (cache.t3.micro)
- **Storage**: EFS for file uploads
- **Load Balancer**: Application Load Balancer
- **SSL**: AWS Certificate Manager (free)

### Option 2: Production Scale (Est. $200-500/month)
- **Compute**: EKS cluster with auto-scaling
- **Database**: RDS PostgreSQL (db.t3.small with Multi-AZ)
- **Cache**: ElastiCache Redis cluster
- **Storage**: S3 + CloudFront CDN
- **Monitoring**: CloudWatch + X-Ray
- **Backup**: Automated RDS snapshots

### Option 3: Enterprise (Est. $500+/month)
- **Compute**: EKS with spot instances
- **Database**: Aurora PostgreSQL Serverless v2
- **Cache**: ElastiCache Redis with clustering
- **Storage**: S3 with Intelligent Tiering
- **Security**: WAF, GuardDuty, Security Hub
- **Monitoring**: Full observability stack

## Prerequisites

1. AWS CLI installed and configured
2. Docker installed locally
3. kubectl installed (for EKS deployments)
4. Terraform or AWS CDK (optional but recommended)

## Quick Start: ECS Fargate Deployment

### Step 1: Create ECR Repositories

```bash
# Create repositories for container images
aws ecr create-repository --repository-name cma-app
aws ecr create-repository --repository-name cma-chatbot

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

### Step 2: Build and Push Images

```bash
# Build and tag images
docker build -t cma-app .
docker build -f Dockerfile.chatbot -t cma-chatbot .

# Tag for ECR
docker tag cma-app:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/cma-app:latest
docker tag cma-chatbot:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/cma-chatbot:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/cma-app:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/cma-chatbot:latest
```

### Step 3: Create RDS Database

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
    --db-subnet-group-name cma-db-subnet-group \
    --db-subnet-group-description "CMA Database Subnet Group" \
    --subnet-ids subnet-12345678 subnet-87654321

# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier cma-postgres \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 13.7 \
    --master-username postgres \
    --master-user-password YourSecurePassword123! \
    --allocated-storage 20 \
    --db-subnet-group-name cma-db-subnet-group \
    --vpc-security-group-ids sg-12345678 \
    --backup-retention-period 7 \
    --storage-encrypted
```

### Step 4: Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name cma-cluster --capacity-providers FARGATE

# Create task execution role
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-task-execution-role.json
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### Step 5: Deploy with CloudFormation

Create `aws-infrastructure.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'CMA Case Management System Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 8
    Description: PostgreSQL master password

Resources:
  # VPC and Networking
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-cma-vpc

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      MapPublicIpOnLaunch: true

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.3.0/24

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.4.0/24

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC

  # Route Tables
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  DefaultPublicRoute:
    Type: AWS::EC2::Route
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet1

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet2

  # Security Groups
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Application Load Balancer
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0

  ECSSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for ECS tasks
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5000
          ToPort: 5000
          SourceSecurityGroupId: !Ref ALBSecurityGroup
        - IpProtocol: tcp
          FromPort: 8001
          ToPort: 8001
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for RDS database
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref ECSSecurityGroup

  # RDS Database
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS database
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub ${Environment}-cma-postgres
      DBInstanceClass: db.t3.micro
      Engine: postgres
      EngineVersion: '13.7'
      MasterUsername: postgres
      MasterUserPassword: !Ref DBPassword
      AllocatedStorage: 20
      StorageType: gp2
      StorageEncrypted: true
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      BackupRetentionPeriod: 7
      MultiAZ: false
      PubliclyAccessible: false

  # ElastiCache Redis
  CacheSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for ElastiCache
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2

  RedisCache:
    Type: AWS::ElastiCache::CacheCluster
    Properties:
      CacheNodeType: cache.t3.micro
      Engine: redis
      NumCacheNodes: 1
      CacheSubnetGroupName: !Ref CacheSubnetGroup
      VpcSecurityGroupIds:
        - !Ref ECSSecurityGroup

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub ${Environment}-cma-cluster
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub ${Environment}-cma-alb
      Scheme: internet-facing
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2

  # EFS for File Storage
  FileSystem:
    Type: AWS::EFS::FileSystem
    Properties:
      CreationToken: !Sub ${Environment}-cma-efs
      FileSystemTags:
        - Key: Name
          Value: !Sub ${Environment}-cma-efs

  MountTarget1:
    Type: AWS::EFS::MountTarget
    Properties:
      FileSystemId: !Ref FileSystem
      SubnetId: !Ref PrivateSubnet1
      SecurityGroups:
        - !Ref ECSSecurityGroup

  MountTarget2:
    Type: AWS::EFS::MountTarget
    Properties:
      FileSystemId: !Ref FileSystem
      SubnetId: !Ref PrivateSubnet2
      SecurityGroups:
        - !Ref ECSSecurityGroup

Outputs:
  VPCId:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub ${Environment}-VPC-ID

  DatabaseEndpoint:
    Description: RDS Database Endpoint
    Value: !GetAtt Database.Endpoint.Address
    Export:
      Name: !Sub ${Environment}-DB-ENDPOINT

  RedisEndpoint:
    Description: Redis Cache Endpoint
    Value: !GetAtt RedisCache.RedisEndpoint.Address
    Export:
      Name: !Sub ${Environment}-REDIS-ENDPOINT

  LoadBalancerDNS:
    Description: Load Balancer DNS Name
    Value: !GetAtt ApplicationLoadBalancer.DNSName
    Export:
      Name: !Sub ${Environment}-ALB-DNS
```

Deploy the infrastructure:

```bash
aws cloudformation create-stack \
    --stack-name cma-infrastructure \
    --template-body file://aws-infrastructure.yaml \
    --parameters ParameterKey=Environment,ParameterValue=production \
                 ParameterKey=DBPassword,ParameterValue=YourSecurePassword123! \
    --capabilities CAPABILITY_IAM
```

## ECS Task Definitions

Create `ecs-task-definition.json`:

```json
{
  "family": "cma-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "cma-app",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/cma-app:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DB_HOST",
          "value": "DATABASE_ENDPOINT"
        },
        {
          "name": "REDIS_HOST",
          "value": "REDIS_ENDPOINT"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/cma/db-password"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/cma/jwt-secret"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "efs-storage",
          "containerPath": "/app/uploads"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/cma-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "volumes": [
    {
      "name": "efs-storage",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-12345678",
        "transitEncryption": "ENABLED"
      }
    }
  ]
}
```

## Cost Optimization Strategies

### 1. Use Spot Instances
```bash
# Configure ECS to use Fargate Spot
aws ecs put-cluster-capacity-providers \
    --cluster cma-cluster \
    --capacity-providers FARGATE FARGATE_SPOT \
    --default-capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=4 capacityProvider=FARGATE,weight=1
```

### 2. Auto Scaling Configuration
```yaml
# ECS Service Auto Scaling
AutoScalingTarget:
  Type: AWS::ApplicationAutoScaling::ScalableTarget
  Properties:
    ServiceNamespace: ecs
    ResourceId: !Sub service/${ECSCluster}/${ECSService}
    ScalableDimension: ecs:service:DesiredCount
    MinCapacity: 1
    MaxCapacity: 10

AutoScalingPolicy:
  Type: AWS::ApplicationAutoScaling::ScalingPolicy
  Properties:
    PolicyName: CMAAutoScalingPolicy
    PolicyType: TargetTrackingScaling
    ScalingTargetId: !Ref AutoScalingTarget
    TargetTrackingScalingPolicyConfiguration:
      TargetValue: 70.0
      PredefinedMetricSpecification:
        PredefinedMetricType: ECSServiceAverageCPUUtilization
```

### 3. Database Cost Optimization
- Use RDS Reserved Instances for 1-3 year commitments (up to 60% savings)
- Enable automated backups with appropriate retention
- Use Aurora Serverless v2 for variable workloads
- Implement read replicas for read-heavy workloads

### 4. Storage Optimization
- Use S3 Intelligent Tiering for file storage
- Implement lifecycle policies for old documents
- Use CloudFront CDN for static assets
- Enable S3 Transfer Acceleration for uploads

## Monitoring and Logging

### CloudWatch Configuration
```yaml
LogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: /ecs/cma-app
    RetentionInDays: 30

MetricFilter:
  Type: AWS::Logs::MetricFilter
  Properties:
    LogGroupName: !Ref LogGroup
    FilterPattern: '[timestamp, request_id, level="ERROR", ...]'
    MetricTransformations:
      - MetricNamespace: CMA/Application
        MetricName: ErrorCount
        MetricValue: '1'
```

### X-Ray Tracing
Add to task definition:
```json
{
  "name": "xray-daemon",
  "image": "amazon/aws-xray-daemon:latest",
  "cpu": 32,
  "memoryReservation": 256,
  "portMappings": [
    {
      "containerPort": 2000,
      "protocol": "udp"
    }
  ]
}
```

## Security Best Practices

### 1. Secrets Management
```bash
# Store secrets in Parameter Store
aws ssm put-parameter \
    --name "/cma/db-password" \
    --value "YourSecurePassword123!" \
    --type "SecureString"

aws ssm put-parameter \
    --name "/cma/jwt-secret" \
    --value "your-super-secret-jwt-key" \
    --type "SecureString"
```

### 2. IAM Roles and Policies
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/cma/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::cma-file-storage/*"
    }
  ]
}
```

### 3. Network Security
- Use VPC with private subnets for databases
- Implement WAF for web application firewall
- Enable VPC Flow Logs for network monitoring
- Use Security Groups as virtual firewalls

## Backup and Disaster Recovery

### 1. Database Backups
```bash
# Create manual snapshot
aws rds create-db-snapshot \
    --db-instance-identifier cma-postgres \
    --db-snapshot-identifier cma-postgres-manual-snapshot-$(date +%Y%m%d)
```

### 2. Cross-Region Replication
```yaml
# RDS Cross-Region Read Replica
ReadReplica:
  Type: AWS::RDS::DBInstance
  Properties:
    SourceDBInstanceIdentifier: !Sub 
      - arn:aws:rds:${SourceRegion}:${AWS::AccountId}:db:${SourceDBInstanceIdentifier}
      - SourceRegion: us-east-1
        SourceDBInstanceIdentifier: !Ref Database
    DBInstanceClass: db.t3.micro
```

## Deployment Automation

### GitHub Actions Workflow
```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        run: |
          docker build -t cma-app .
          docker tag cma-app:latest $ECR_REGISTRY/cma-app:latest
          docker push $ECR_REGISTRY/cma-app:latest
      
      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ecs-task-definition.json
          service: cma-service
          cluster: cma-cluster
```

## Cost Monitoring

### 1. Budget Alerts
```bash
aws budgets create-budget \
    --account-id 123456789012 \
    --budget '{
        "BudgetName": "CMA-Monthly-Budget",
        "BudgetLimit": {
            "Amount": "200",
            "Unit": "USD"
        },
        "TimeUnit": "MONTHLY",
        "BudgetType": "COST"
    }' \
    --notifications-with-subscribers '[{
        "Notification": {
            "NotificationType": "ACTUAL",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 80
        },
        "Subscribers": [{
            "SubscriptionType": "EMAIL",
            "Address": "admin@example.com"
        }]
    }]'
```

### 2. Cost Allocation Tags
```yaml
Tags:
  - Key: Project
    Value: CMA
  - Key: Environment
    Value: !Ref Environment
  - Key: CostCenter
    Value: IT-Operations
```

## Troubleshooting

### Common Issues

1. **ECS Tasks Failing to Start**
   - Check CloudWatch logs: `/ecs/cma-app`
   - Verify security groups allow required ports
   - Ensure secrets are accessible

2. **Database Connection Issues**
   - Verify security group rules
   - Check VPC configuration
   - Validate database credentials

3. **High Costs**
   - Review CloudWatch metrics for resource utilization
   - Check for unused resources
   - Optimize instance types based on actual usage

### Useful Commands
```bash
# View ECS service status
aws ecs describe-services --cluster cma-cluster --services cma-service

# Check task logs
aws logs get-log-events --log-group-name /ecs/cma-app --log-stream-name ecs/cma-app/task-id

# Monitor costs
aws ce get-cost-and-usage --time-period Start=2023-01-01,End=2023-01-31 --granularity MONTHLY --metrics BlendedCost
```

This guide provides a comprehensive foundation for deploying the CMA system to AWS with cost optimization and scalability in mind.

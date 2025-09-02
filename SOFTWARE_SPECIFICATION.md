# CMA Case Management System - Software Specification

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [AWS Kubernetes Deployment](#aws-kubernetes-deployment)
4. [Storage Solutions](#storage-solutions)
5. [Scalability & Performance](#scalability--performance)
6. [New Features](#new-features)
7. [Security & Compliance](#security--compliance)
8. [Monitoring & Observability](#monitoring--observability)

## System Overview

### Purpose
The CMA (Community Money Advice) Case Management System is a comprehensive platform designed to support debt advice centres in managing client cases, ensuring FCA compliance, and providing scalable advisory services with AI assistance.

### Key Stakeholders
- **Debt Advisors**: Primary users managing client cases
- **Centre Managers**: Administrative oversight and user management
- **Clients**: End beneficiaries receiving debt advice
- **FCA Compliance Officers**: Regulatory oversight
- **System Administrators**: Technical maintenance and monitoring

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   CloudFront    │  │   Route 53      │  │    WAF       │ │
│  │   (CDN)         │  │   (DNS)         │  │ (Security)   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    EKS Kubernetes Cluster                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Ingress Controller                    │ │
│  │                  (AWS Load Balancer)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Frontend      │  │   API Gateway   │  │   Chatbot    │ │
│  │   (React SPA)   │  │   (Express.js)  │  │   Service    │ │
│  │   Pods          │  │   Pods          │  │   (Python)   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Case Service  │  │ Notification    │  │   Credit     │ │
│  │   (Node.js)     │  │   Service       │  │   Service    │ │
│  │                 │  │   (Node.js)     │  │   (Node.js)  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   RDS PostgreSQL│  │   ElastiCache   │  │     S3       │ │
│  │   (Primary DB)  │  │   (Redis)       │  │ (File Store) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Microservices Architecture

#### Core Services
1. **API Gateway Service** - Central routing and authentication
2. **Case Management Service** - Core business logic
3. **User Management Service** - Authentication and authorization
4. **Notification Service** - Email/SMS communications
5. **Credit Report Service** - Credit data integration
6. **Chatbot Service** - AI-powered assistance
7. **Compliance Service** - FCA regulatory checks
8. **File Management Service** - Document handling

## AWS Kubernetes Deployment

### EKS Cluster Configuration

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: cma-production
  region: eu-west-2
  version: "1.28"
nodeGroups:
  - name: system-nodes
    instanceType: t3.medium
    minSize: 2
    maxSize: 4
    desiredCapacity: 2
  - name: application-nodes
    instanceType: t3.large
    minSize: 3
    maxSize: 20
    desiredCapacity: 5
  - name: ai-nodes
    instanceType: c5.xlarge
    minSize: 1
    maxSize: 5
    desiredCapacity: 2
```

### Deployment Strategy

#### API Gateway Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: cma-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    spec:
      containers:
      - name: api-gateway
        image: cma/api-gateway:latest
        ports:
        - containerPort: 5000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Storage Solutions

### Database Architecture

#### Primary Database - Amazon RDS PostgreSQL
- **Engine**: PostgreSQL 15
- **Instance**: db.r6g.xlarge
- **Storage**: 500GB GP3 SSD
- **Multi-AZ**: Enabled for high availability
- **Backup**: 30-day retention with cross-region replication

#### Caching Layer - ElastiCache Redis
- **Engine**: Redis 7.0
- **Configuration**: Cluster mode with 3 shards, 2 replicas each
- **Use Cases**: Session storage, API caching, real-time notifications

#### File Storage - Amazon S3
- **Documents Bucket**: Client files, letters, reports
- **Backups Bucket**: Database backups, system exports
- **Static Assets**: Frontend assets with CloudFront CDN

## New Features

### 1. Enhanced Case Notes System

#### Database Extensions
```sql
ALTER TABLE notes ADD COLUMN note_category VARCHAR(50);
ALTER TABLE notes ADD COLUMN priority_level VARCHAR(20);
ALTER TABLE notes ADD COLUMN follow_up_date TIMESTAMP;
ALTER TABLE notes ADD COLUMN tags TEXT[];

CREATE TABLE note_attachments (
    id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(id),
    file_id INTEGER REFERENCES files(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. FCA Compliance Checklist System

#### Compliance Framework
```sql
CREATE TABLE compliance_frameworks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    effective_date DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE compliance_checklists (
    id SERIAL PRIMARY KEY,
    framework_id INTEGER REFERENCES compliance_frameworks(id),
    name VARCHAR(255) NOT NULL,
    checklist_items JSONB NOT NULL,
    applies_to VARCHAR(100),
    is_mandatory BOOLEAN DEFAULT true

CREATE TABLE case_compliance (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id),
    checklist_id INTEGER REFERENCES compliance_checklists(id),
    completed_items JSONB DEFAULT '[]',
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    compliance_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_case_compliance_updated_at
BEFORE UPDATE ON case_compliance
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

# Document Scanning and OCR System - Production Deployment Guide

## Overview

This guide covers the deployment of the MordecAI document scanning and OCR system, which provides:

- **Drag-and-drop document upload** with intuitive file tree organization
- **Automatic OCR processing** using Tesseract.js and AWS Textract
- **Document classification** (debts, bank statements, correspondence, etc.)
- **Case-specific email inboxes** for automatic document ingestion
- **Scalable microservices architecture** with Kubernetes support
- **Flexible storage** supporting both AWS S3 and local Minio for development

## Architecture Components

### Core Services

1. **Document Inbox Service** (`services/document-inbox/`)
   - File upload and email processing
   - S3/Minio integration
   - RabbitMQ message queuing
   - RESTful API endpoints

2. **OCR Processor Service** (`services/ocr-processor/`)
   - Tesseract.js and AWS Textract integration
   - Document classification and entity extraction
   - Confidence scoring and validation
   - Asynchronous processing via RabbitMQ

3. **Main MordecAI Application** (`server/`)
   - Case management and user interface
   - Document approval workflow
   - Integration with microservices
   - PostgreSQL database operations

### Frontend Components

1. **DocumentUpload Component** (`client/src/components/DocumentUpload.js`)
   - Drag-and-drop file upload interface
   - Real-time upload progress tracking
   - OCR result display and approval dialogs

2. **FileTreeViewer Component** (`client/src/components/FileTreeViewer.js`)
   - Hierarchical file browser with nested folders
   - Document type organization (debts, bank statements, etc.)
   - File download and management capabilities

## Prerequisites

### Development Environment

- **Node.js** 16+ and npm
- **Docker** and Docker Compose
- **PostgreSQL** 12+
- **RabbitMQ** 3.8+
- **Minio** (for local S3 emulation)

### Production Environment

- **Kubernetes cluster** (EKS, GKE, or AKS)
- **AWS services**: S3, Textract, SES (for email processing)
- **PostgreSQL** database (RDS recommended)
- **RabbitMQ** cluster or managed service
- **Load balancer** and SSL certificates

## Local Development Setup

### 1. Environment Configuration

Create `.env` files in each service directory:

**Main Application (`.env`)**:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mordecai
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mordecai
DB_USER=user
DB_PASSWORD=password

# Services
DOCUMENT_INBOX_URL=http://localhost:3001
OCR_PROCESSOR_URL=http://localhost:3002

# Storage (Minio for local development)
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_BUCKET=mordecai-documents

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Email
EMAIL_DOMAIN=mordecai.local
```

**Document Inbox Service (`services/document-inbox/.env`)**:
```env
PORT=3001
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://minio:9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
S3_BUCKET=mordecai-documents
RABBITMQ_URL=amqp://rabbitmq:5672
EMAIL_DOMAIN=mordecai.local
```

**OCR Processor Service (`services/ocr-processor/.env`)**:
```env
PORT=3002
AWS_REGION=us-east-1
RABBITMQ_URL=amqp://rabbitmq:5672
TESSERACT_CACHE_PATH=/tmp/tesseract
```

### 2. Start Development Environment

```bash
# Start infrastructure services
docker-compose -f docker-compose.dev.yml up -d postgres minio rabbitmq

# Install dependencies
npm install
cd client && npm install
cd ../services/document-inbox && npm install
cd ../ocr-processor && npm install

# Run database migrations
npm run migrate

# Start services
npm run dev:services  # Starts document-inbox and ocr-processor
npm run dev           # Starts main application
cd client && npm start # Starts React frontend
```

### 3. Verify Local Setup

- **Main Application**: http://localhost:5010
- **Frontend**: http://localhost:3000
- **Document Inbox**: http://localhost:3001
- **OCR Processor**: http://localhost:3002
- **Minio Console**: http://localhost:9001 (minioadmin/minioadmin)
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## Production Deployment

### 1. AWS Infrastructure Setup

#### S3 Bucket Configuration
```bash
# Create S3 bucket
aws s3 mb s3://mordecai-documents-prod

# Configure bucket policy for document access
aws s3api put-bucket-policy --bucket mordecai-documents-prod --policy file://s3-bucket-policy.json
```

**s3-bucket-policy.json**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowMordecAIAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/MordecAI-DocumentProcessor"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mordecai-documents-prod",
        "arn:aws:s3:::mordecai-documents-prod/*"
      ]
    }
  ]
}
```

#### IAM Role for Document Processing
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mordecai-documents-prod",
        "arn:aws:s3:::mordecai-documents-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText",
        "textract:AnalyzeDocument"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Kubernetes Deployment

#### Apply Kubernetes Manifests
```bash
# Create namespace
kubectl create namespace mordecai

# Apply configuration
kubectl apply -f k8s/configmap.yaml -n mordecai
kubectl apply -f k8s/secrets.yaml -n mordecai

# Deploy services
kubectl apply -f k8s/document-services.yaml -n mordecai
kubectl apply -f k8s/api-gateway.yaml -n mordecai
kubectl apply -f k8s/frontend.yaml -n mordecai

# Verify deployment
kubectl get pods -n mordecai
kubectl get services -n mordecai
```

#### Production ConfigMap (`k8s/configmap-prod.yaml`)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mordecai-config
  namespace: mordecai
data:
  STORAGE_PROVIDER: "s3"
  AWS_REGION: "us-east-1"
  S3_BUCKET: "mordecai-documents-prod"
  EMAIL_DOMAIN: "documents.yourdomain.com"
  RABBITMQ_URL: "amqp://rabbitmq-service:5672"
  DATABASE_URL: "postgresql://username:password@rds-endpoint:5432/mordecai"
```

#### Production Secrets (`k8s/secrets-prod.yaml`)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mordecai-secrets
  namespace: mordecai
type: Opaque
data:
  AWS_ACCESS_KEY_ID: <base64-encoded-key>
  AWS_SECRET_ACCESS_KEY: <base64-encoded-secret>
  DB_PASSWORD: <base64-encoded-password>
  RABBITMQ_PASSWORD: <base64-encoded-password>
```

### 3. Database Setup

#### Run Production Migrations
```bash
# Connect to production database
export DATABASE_URL="postgresql://username:password@rds-endpoint:5432/mordecai"

# Run migrations
npm run migrate:prod

# Verify tables
psql $DATABASE_URL -c "\dt"
```

#### Required Database Tables
- `documents` - Document metadata and file paths
- `document_classifications` - OCR results and classifications
- `case_email_addresses` - Email-to-case mappings
- `document_processing_queue` - Async processing queue

### 4. Monitoring and Logging

#### Prometheus Metrics
```yaml
# k8s/monitoring.yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus-metrics
spec:
  selector:
    app: document-inbox
  ports:
  - port: 9090
    targetPort: metrics
```

#### Log Aggregation
```bash
# Deploy Fluent Bit for log collection
kubectl apply -f k8s/logging.yaml

# Configure log forwarding to CloudWatch/ELK
```

## Configuration Reference

### Environment Variables

#### Document Inbox Service
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Service port | 3001 | No |
| `STORAGE_PROVIDER` | Storage backend (s3/minio/local) | minio | Yes |
| `S3_BUCKET` | S3 bucket name | mordecai-documents | Yes |
| `AWS_ACCESS_KEY_ID` | AWS access key | - | Yes (for S3) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - | Yes (for S3) |
| `MINIO_ENDPOINT` | Minio endpoint URL | http://localhost:9000 | Yes (for Minio) |
| `RABBITMQ_URL` | RabbitMQ connection string | amqp://localhost | Yes |
| `EMAIL_DOMAIN` | Domain for case emails | mordecai.local | Yes |

#### OCR Processor Service
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Service port | 3002 | No |
| `AWS_REGION` | AWS region | us-east-1 | Yes |
| `RABBITMQ_URL` | RabbitMQ connection string | amqp://localhost | Yes |
| `TESSERACT_CACHE_PATH` | Tesseract cache directory | /tmp/tesseract | No |

### File Organization Structure

Documents are automatically organized using the following hierarchy:

```
cases/
├── case-{caseId}/
│   ├── debts/
│   │   └── {YYYY-MM-DD}/
│   │       └── {uuid}-{filename}
│   ├── bank-statements/
│   │   └── {YYYY-MM-DD}/
│   │       └── {uuid}-{filename}
│   ├── correspondence/
│   ├── legal-documents/
│   ├── income-documents/
│   ├── expense-documents/
│   ├── asset-documents/
│   ├── internal-documents/
│   ├── email-attachments/
│   └── unclassified/
```

### Document Type Mapping

| Document Type | Folder Name | Description |
|---------------|-------------|-------------|
| `debt` | `debts` | Credit cards, loans, debt letters |
| `bank_statement` | `bank-statements` | Bank account statements |
| `correspondence` | `correspondence` | Letters and communications |
| `legal` | `legal-documents` | Legal notices and documents |
| `income` | `income-documents` | Pay slips, benefit statements |
| `expenses` | `expense-documents` | Bills and expense receipts |
| `assets` | `asset-documents` | Property and asset documents |
| `internal` | `internal-documents` | Internal case notes and forms |
| `unknown` | `unclassified` | Documents pending classification |

## API Endpoints

### Document Inbox Service

#### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data

{
  "caseId": "123",
  "documentType": "debt",
  "file": <binary data>
}
```

#### Get Case File Tree
```http
GET /api/cases/{caseId}/files

Response:
{
  "type": "directory",
  "name": "root",
  "children": {
    "debts": {
      "type": "directory",
      "children": {...},
      "files": [...]
    }
  }
}
```

#### Download File
```http
GET /api/files/{filePath}

Response: Binary file data with appropriate headers
```

#### Delete File
```http
DELETE /api/files/{filePath}

Response: { "message": "File deleted successfully" }
```

### OCR Processor Service

#### Process Document
```http
POST /api/ocr/process
Content-Type: application/json

{
  "fileUrl": "s3://bucket/path/to/file",
  "documentType": "debt"
}

Response:
{
  "text": "Extracted text content...",
  "classification": {
    "type": "debt",
    "confidence": 0.95
  },
  "extractedData": {
    "creditorName": "Example Bank",
    "amount": "£1,234.56",
    "dueDate": "2024-01-15"
  }
}
```

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific service tests
cd services/document-inbox && npm test
cd services/ocr-processor && npm test
```

### Integration Tests
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration
```

### Load Testing
```bash
# Install Artillery
npm install -g artillery

# Run load tests
artillery run testing/load-test-config.yml
```

## Security Considerations

### File Upload Security
- File type validation and sanitization
- Virus scanning integration (optional)
- Size limits and rate limiting
- Secure file storage with encryption

### API Security
- JWT authentication for all endpoints
- Role-based access control
- CORS configuration
- Request validation and sanitization

### Infrastructure Security
- VPC with private subnets
- Security groups and NACLs
- IAM roles with least privilege
- Encrypted storage and transit

## Troubleshooting

### Common Issues

#### Document Upload Failures
```bash
# Check storage service connectivity
kubectl logs -f deployment/document-inbox -n mordecai

# Verify S3/Minio permissions
aws s3 ls s3://mordecai-documents-prod/

# Check RabbitMQ queue status
kubectl exec -it rabbitmq-pod -n mordecai -- rabbitmqctl list_queues
```

#### OCR Processing Issues
```bash
# Check OCR processor logs
kubectl logs -f deployment/ocr-processor -n mordecai

# Verify Tesseract installation
kubectl exec -it ocr-processor-pod -n mordecai -- tesseract --version

# Test AWS Textract connectivity
aws textract detect-document-text --document '{"S3Object":{"Bucket":"test","Name":"test.pdf"}}'
```

#### File Tree Display Problems
```bash
# Check file tree API response
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3001/api/cases/123/files

# Verify file permissions
ls -la storage/cases/case-123/
```

### Performance Optimization

#### Storage Performance
- Use S3 Transfer Acceleration for large files
- Implement CloudFront CDN for file downloads
- Configure appropriate S3 storage classes

#### Processing Performance
- Scale OCR processor horizontally
- Use AWS Textract for better performance
- Implement caching for repeated operations

#### Database Performance
- Index frequently queried columns
- Use connection pooling
- Consider read replicas for heavy workloads

## Maintenance

### Regular Tasks
- Monitor disk usage and clean up temporary files
- Review and rotate logs
- Update dependencies and security patches
- Backup database and configuration

### Scaling Considerations
- Horizontal scaling of microservices
- Database sharding for large datasets
- CDN implementation for global users
- Auto-scaling based on queue depth

## Support and Documentation

### Additional Resources
- [AWS Textract Documentation](https://docs.aws.amazon.com/textract/)
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [RabbitMQ Management](https://www.rabbitmq.com/management.html)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

### Getting Help
- Check application logs for error details
- Review monitoring dashboards for performance issues
- Consult API documentation for endpoint specifications
- Contact development team for complex issues

---

**Document Version**: 1.0  
**Last Updated**: September 2025  
**Maintained By**: MordecAI Development Team

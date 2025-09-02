# Document Scanning & OCR Service Architecture

## Overview
MordecAI Document Intelligence System - A microservices architecture for automated document processing, OCR, and intelligent filing for case management.

## Service Architecture

### 1. Document Inbox Service (Node.js/Express)
- **Purpose**: Email inbox management per case
- **Features**:
  - Unique email address per case (e.g., case-12345@mordecai.domain.com)
  - Email attachment processing
  - Drag-and-drop file upload API
  - File validation and security scanning
- **AWS Deployment**: ECS Fargate container
- **Storage**: S3 bucket for raw documents

### 2. OCR Processing Service (Python/FastAPI)
- **Purpose**: Document text extraction and analysis
- **Features**:
  - Tesseract.js + AWS Textract integration
  - Document type classification
  - Entity extraction (amounts, dates, company names)
  - Confidence scoring
- **AWS Deployment**: Separate ECS service for cost optimization
- **Scaling**: Auto-scaling based on queue depth

### 3. Document Classification Service (Python/ML)
- **Purpose**: Intelligent document categorization
- **Features**:
  - Debt document detection
  - Bank statement recognition
  - Internal document classification
  - Company/creditor matching
- **AWS Deployment**: Lambda functions for cost efficiency
- **ML Models**: Pre-trained + custom models

### 4. Workflow Orchestration Service (Node.js)
- **Purpose**: Advisor approval workflow
- **Features**:
  - OCR result validation UI
  - Automatic debt matching
  - File organization suggestions
  - Advisor override capabilities
- **Integration**: WebSocket for real-time updates

## Data Flow

1. **Document Ingestion**
   - Email attachment → S3 → SQS queue
   - Drag-drop upload → Direct S3 upload
   
2. **Processing Pipeline**
   - OCR Service extracts text
   - Classification Service categorizes document
   - Workflow Service presents results to advisor
   
3. **Approval & Filing**
   - Advisor reviews OCR results
   - Confirms/corrects debt information
   - Document filed in appropriate case folder

## AWS Cost Optimization

### Container Strategy
- **Always-on services**: Document Inbox (low-cost ECS)
- **Processing services**: Auto-scaling ECS with spot instances
- **ML services**: Lambda for sporadic workloads

### Storage Strategy
- **S3 Intelligent Tiering**: Automatic cost optimization
- **CloudFront**: CDN for document access
- **Lifecycle policies**: Archive old documents to Glacier

## Security & Compliance
- **Encryption**: At-rest (S3) and in-transit (TLS)
- **Access Control**: IAM roles with least privilege
- **Audit Trail**: CloudTrail for all document operations
- **Data Retention**: Configurable retention policies

## Kubernetes Deployment Alternative
- **Namespace isolation**: Per-environment separation
- **Resource limits**: CPU/memory constraints per service
- **Horizontal Pod Autoscaler**: Based on queue metrics
- **Persistent Volumes**: For temporary processing storage

## Document Types & Processing

### A. Debt Documents
- **Detection**: Keywords (debt, balance, payment, creditor)
- **Extraction**: Amount, creditor name, account number, due date
- **Validation**: Match against existing debts
- **Action**: Create new debt or update existing

### B. Bank Statements
- **Detection**: Bank logos, statement patterns, transaction lists
- **Extraction**: Account details, transactions, balances
- **Filing**: Organized by bank and date
- **Integration**: Link to budget analysis

### C. Internal Documents
- **Detection**: Company letterhead, internal templates
- **Filing**: Standard internal document folders
- **Workflow**: Minimal processing required

## Implementation Phases

### Phase 1: Core Infrastructure
- Document Inbox Service
- Basic OCR integration
- Simple file upload UI

### Phase 2: Intelligence Layer
- Document classification
- Debt detection algorithms
- Advisor approval workflow

### Phase 3: Advanced Features
- Email inbox per case
- Automatic creditor matching
- Advanced ML classification

### Phase 4: Optimization
- Cost optimization
- Performance tuning
- Advanced analytics

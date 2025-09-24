# Data Privacy Architecture

This document details how the MordecAI system ensures that all client data remains within your controlled infrastructure with zero external data transmission.

## Architecture Principles

### 1. Local-Only Processing
- **No Cloud APIs**: All AI, OCR, and processing uses local models
- **Self-Hosted Storage**: MinIO provides S3-compatible storage locally
- **Local Database**: PostgreSQL runs in your infrastructure
- **Local Message Queue**: RabbitMQ handles all async processing

### 2. Open-Source Components

All external dependencies are open-source and run locally:

```yaml
Components:
  AI/LLM: Microsoft DialoGPT (Hugging Face Transformers)
  OCR: Tesseract.js (Google's Tesseract)
  Storage: MinIO (S3-compatible object storage)
  Database: PostgreSQL
  Cache: Redis
  Queue: RabbitMQ
  Web: Nginx, Node.js, React
```

## Data Flow Analysis

### 1. Document Processing Flow
```
Email/Upload → Document-Inbox → MinIO → RabbitMQ → OCR-Processor → PostgreSQL
```
**External Connections**: NONE

### 2. Chatbot Interaction Flow
```
Client → ChatbotWidget → WebSocket → Local LLM → PostgreSQL/Redis
```
**External Connections**: NONE (except optional council web search with privacy-focused DuckDuckGo)

### 3. File Storage Flow
```
Client Upload → MinIO Local Storage → OCR Processing → Structured Data → PostgreSQL
```
**External Connections**: NONE

## Service-by-Service Analysis

### Frontend (React)
- **Purpose**: User interface
- **Data Handling**: Display only, no external requests
- **Security**: All API calls to local backend only

### Backend API (Node.js)
- **Purpose**: Main application logic
- **Data Storage**: PostgreSQL (local)
- **External Calls**: NONE
- **File Storage**: MinIO (local)

### Chatbot Service (Python/FastAPI)
- **LLM**: Local Hugging Face models
- **No API Keys**: No OpenAI, Anthropic, or other cloud AI services
- **Memory**: Redis (local) for session management
- **Database**: PostgreSQL for case context

### Document Inbox Service (Node.js)
- **File Processing**: Local MinIO storage
- **Email Handling**: Local SMTP server
- **No Cloud Services**: No AWS SES, SendGrid, etc.

### OCR Processor (Node.js)
- **Text Extraction**: Tesseract (local open-source OCR)
- **No AWS Textract**: Removed all AWS dependencies
- **Document Classification**: Local NLP processing

## Security Measures

### 1. Container Isolation
Each service runs in isolated Docker containers with:
- Minimal attack surface
- Non-root users
- Resource limits
- Health checks

### 2. Network Security
```yaml
Network Policy:
  - Services communicate via internal Docker network
  - Only necessary ports exposed to host
  - No outbound internet access (except optional council search)
  - Database accessible only to application services
```

### 3. Data Encryption
- **At Rest**: MinIO supports encryption
- **In Transit**: HTTPS/WSS for web traffic
- **Database**: PostgreSQL with encryption support

## Deployment Verification

### 1. Network Monitoring
To verify no external data transmission:

```bash
# Monitor network traffic
sudo tcpdump -i any -n host not localhost

# Check for outbound connections
netstat -tuln | grep ESTABLISHED

# Monitor Docker container network
docker network ls
docker network inspect cma_default
```

### 2. Service Health Checks
```bash
# Verify all services are healthy and local
curl http://localhost:5000/health    # Main API
curl http://localhost:8001/health    # Chatbot
curl http://localhost:3001/health    # Document Inbox
curl http://localhost:3002/health    # OCR Processor
curl http://localhost:9000/minio/health/live  # MinIO
curl http://localhost:15672/api/aliveness-test/vhost  # RabbitMQ
```

### 3. Data Audit Trail
All data operations are logged:
- File uploads and downloads
- OCR processing results
- Chatbot interactions
- Database operations

## Configuration for Maximum Privacy

### 1. Disable External Services

Set these environment variables to ensure local-only operation:

```env
# Disable external OCR services
USE_AWS_TEXTRACT=false
USE_GOOGLE_VISION=false

# Disable external AI services  
USE_OPENAI=false
USE_ANTHROPIC=false

# Local LLM configuration
LLM_MODEL_NAME=microsoft/DialoGPT-medium
TRANSFORMERS_CACHE=/app/models
HF_OFFLINE=true

# Local storage only
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=minio
MINIO_USE_SSL=false

# Local email processing
SMTP_HOST=localhost
EMAIL_PROVIDER=local
```

### 2. Network Isolation

For maximum security, run without internet access:

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  app:
    networks:
      - internal
  chatbot:
    networks:
      - internal
  document-inbox:
    networks:
      - internal
  ocr-processor:
    networks:
      - internal

networks:
  internal:
    driver: bridge
    internal: true  # No internet access
```

## Compliance Notes

### GDPR Compliance
- All data processing occurs locally
- No third-party data processors
- Full data sovereignty maintained
- Clear audit trail of all operations

### FCA Requirements
- Client data never transmitted externally
- Local backup and disaster recovery
- Audit logs for all financial calculations
- Secure document classification and storage

## Emergency Data Recovery

### Backup Strategy
```bash
# Backup all persistent data
docker run --rm -v cma_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
docker run --rm -v cma_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz -C /data .
```

### Restore Procedures
```bash
# Restore from backups
docker run --rm -v cma_postgres_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/postgres-backup.tar.gz"
docker run --rm -v cma_minio_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/minio-backup.tar.gz"
```

## Performance Optimization

### 1. OCR Processing
- Tesseract runs multiple preprocessing attempts for better accuracy
- CPU-intensive: allocate sufficient resources
- Consider GPU acceleration for large volumes

### 2. LLM Performance
- Model caching in local volume
- CPU inference (GPU optional for larger models)
- Session management via Redis

### 3. Storage Performance
- MinIO supports distributed deployment
- SSD recommended for database and model storage
- Regular cleanup of processed documents

## Monitoring and Alerting

### Key Metrics to Monitor
- Document processing queue length
- OCR success/failure rates
- Storage usage (MinIO)
- Database performance
- Service health status

### Alert Conditions
- Service downtime
- Queue backlog > 100 documents
- Storage usage > 80%
- Failed OCR processing > 10%
- Database connection failures
# MordecAI Hosting Guide - Complete Setup

This guide provides a comprehensive overview of hosting the MordecAI advisor tool with all new services including Confirmation of Advice generation and translation capabilities.

## Data Privacy Guarantee

**All AI processing and data handling occurs within your infrastructure. No client data is transmitted to external services unless explicitly configured.**

### Local-First Architecture
- **Chatbot LLM**: Hugging Face models hosted locally (DialoGPT, Llama 2)
- **Translation**: Helsinki-NLP models run on-premise  
- **OCR**: Tesseract processing within your containers
- **Storage**: MinIO provides S3-compatible storage locally
- **Database**: PostgreSQL keeps all data within your infrastructure

### Optional External Services
- **Google Translate**: Disabled by default, opt-in configuration for fallback translation
- **Web Search**: DuckDuckGo for local council searches (no personal data sent)

## Quick Start (All Services)

### 1. Clone and Initialize
```bash
git clone <repository-url>
cd windsurf-project
cp .env.example .env
```

### 2. Configure Environment
Edit `.env` file:
```env
# Core Configuration
NODE_ENV=production
DB_NAME=cma_system
DB_USER=postgres
DB_PASSWORD=secure_password_here
JWT_SECRET=your_jwt_secret_here

# Service Endpoints (Internal)
CHATBOT_URL=http://chatbot:8001
TRANSLATION_SERVICE_URL=http://translation-service:8003
DOCUMENT_INBOX_URL=http://document-inbox:3001
OCR_PROCESSOR_URL=http://ocr-processor:3002

# AI Configuration (Local Models)
LLM_MODEL_NAME=microsoft/DialoGPT-medium
TRANSFORMERS_CACHE=/app/models
HF_OFFLINE=false

# Translation Configuration (Local First)
LOCAL_TRANSLATION_ENABLED=true
SUPPORTED_LANGUAGES=es,fr,de,it,pt,pl,ar,ur,hi,zh
# GOOGLE_TRANSLATE_API_KEY=optional_fallback_key

# Feature Flags
ENABLE_COA_GENERATION=true
ENABLE_TRANSLATION=true
ENABLE_WEB_SEARCH=true
ENABLE_FINANCIAL_CALC=true

# Storage Configuration (Local)
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin_password
S3_BUCKET=cma-documents
```

### 3. Deploy All Services
```bash
# Start infrastructure first (databases, storage, queues)
docker-compose up -d postgres redis minio rabbitmq

# Wait for infrastructure to be ready (30-60 seconds)
docker-compose logs postgres

# Start AI services (models need time to download)
docker-compose up -d translation-service chatbot

# Start application services
docker-compose up -d document-inbox ocr-processor api

# Start frontend
docker-compose up -d nginx

# Verify all services are healthy
./scripts/health-check.sh
```

## Service Architecture Summary

### 8 Core Microservices
1. **Main API** (Port 5000): Core business logic, authentication
2. **Chatbot** (Port 8001): Local LLM with MCP tools, CoA generation
3. **Translation** (Port 8003): Multi-language support using Helsinki-NLP
4. **Document Inbox** (Port 3001): Email/upload processing
5. **OCR Processor** (Port 3002): Local Tesseract text extraction
6. **PostgreSQL** (Port 5432): Primary database
7. **Redis** (Port 6379): Caching and sessions
8. **MinIO** (Port 9000): Local S3-compatible storage

### Service Dependencies
```
Frontend → Main API → {Chatbot, Translation, Database}
                   ↳ Document Inbox → OCR Processor → Storage
```

## Hardware Requirements

### Development (Local Docker)
- **CPU**: 6+ cores
- **RAM**: 12GB minimum, 16GB recommended
- **Storage**: 100GB SSD (50GB for models, 50GB for data)
- **Network**: 100Mbps for model downloads

### Production (Single Server)
- **CPU**: 12+ cores
- **RAM**: 24GB minimum, 32GB recommended
- **Storage**: 500GB NVMe SSD
- **Network**: 1Gbps

### Production (AWS/Cloud)
- **Compute**: 8 vCPU, 20GB RAM total across services
- **Storage**: 200GB EFS for models, S3 for documents
- **Database**: RDS db.t3.small with 100GB storage

## Model Storage Requirements

### AI Model Downloads (First Run)
```
Chatbot Models:
├── DialoGPT-small: 117MB
├── DialoGPT-medium: 345MB (recommended)
└── Llama-2-7b-chat: 13GB (enterprise)

Translation Models (Helsinki-NLP):
├── English-Spanish: 298MB
├── English-French: 298MB  
├── English-German: 298MB
├── English-Italian: 298MB
├── English-Portuguese: 298MB
├── English-Polish: 298MB
├── English-Arabic: 298MB
├── English-Chinese: 298MB
└── Other pairs: ~300MB each

Total Storage Needed: 2-15GB (depending on languages)
```

## Network Configuration

### Internal Service Communication
All services communicate internally within Docker network. No external network access required for core functionality.

### External Access (Optional)
- **Google Translate API**: Only if fallback translation enabled
- **DuckDuckGo Search**: For local council information searches
- **Model Downloads**: Initial setup requires internet for Hugging Face models

## Security Configuration

### Default Security Features
- All services run in isolated Docker containers
- Database passwords and JWT secrets via environment variables
- Internal network communication only
- No external API dependencies for core features

### Production Security Checklist
```bash
# 1. Change all default passwords
sed -i 's/minioadmin_password/$(openssl rand -base64 32)/' .env
sed -i 's/secure_password_here/$(openssl rand -base64 32)/' .env

# 2. Generate secure JWT secret
echo "JWT_SECRET=$(openssl rand -base64 64)" >> .env

# 3. Enable TLS for external access
# Configure SSL certificates in nginx/nginx.conf

# 4. Restrict network access
# Configure firewall rules to allow only necessary ports
```

## Startup and Health Monitoring

### Service Startup Sequence
```bash
# Services start in dependency order:
1. Infrastructure: postgres, redis, minio, rabbitmq (30s)
2. AI Services: translation-service, chatbot (2-5 minutes for model loading)
3. Application: document-inbox, ocr-processor, api (30s)  
4. Frontend: nginx (10s)

Total startup time: 3-6 minutes (first run with model downloads: 10-20 minutes)
```

### Health Check Commands
```bash
# Check all services
docker-compose ps

# Test individual service health
curl http://localhost:5000/health     # Main API
curl http://localhost:8001/health     # Chatbot
curl http://localhost:8003/health     # Translation
curl http://localhost:3001/health     # Document Inbox
curl http://localhost:3002/health     # OCR Processor

# Test AI model loading
curl http://localhost:8001/model-info
curl http://localhost:8003/models
```

## Feature Verification

### Test Confirmation of Advice Generation
```bash
# Test CoA generation endpoint
curl -X POST http://localhost:5000/api/enhanced-notes/generate-coa \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "notes": [{"id": 1, "content": "Client has priority debt of £5000 to council tax"}],
    "include_case_context": true
  }'
```

### Test Local Translation
```bash
# Test local translation service
curl -X POST http://localhost:8003/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your debt advice appointment is confirmed",
    "target_language": "es",
    "source_language": "en"
  }'

# Test supported languages
curl http://localhost:8003/models
```

### Test Financial Calculations
```bash
# Test chatbot financial calculations
curl -X POST http://localhost:8001/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Calculate debt to income ratio for debt £10000 and income £2000",
    "case_id": 1
  }'
```

## Configuration Options

### AI Model Selection
```env
# Development (Fast, Lower Quality)
LLM_MODEL_NAME=microsoft/DialoGPT-small

# Production (Balanced)
LLM_MODEL_NAME=microsoft/DialoGPT-medium  

# Enterprise (High Quality, Requires GPU)
LLM_MODEL_NAME=meta-llama/Llama-2-7b-chat-hf
```

### Translation Configuration
```env
# Local-only translation (no external data)
LOCAL_TRANSLATION_ENABLED=true
GOOGLE_TRANSLATE_API_KEY=

# Local + Google fallback (data may leave system)
LOCAL_TRANSLATION_ENABLED=true
GOOGLE_TRANSLATE_API_KEY=your_api_key

# Google-only (not recommended for sensitive data)
LOCAL_TRANSLATION_ENABLED=false
GOOGLE_TRANSLATE_API_KEY=your_api_key
```

## Maintenance and Updates

### Model Updates
```bash
# Update translation models
docker-compose exec translation-service python -c "
from transformers import pipeline
# This will download latest models
pipeline('translation', model='Helsinki-NLP/opus-mt-en-es')
"

# Update LLM models
docker-compose pull chatbot
docker-compose up -d chatbot
```

### Database Backups
```bash
# Automated backup script
docker-compose exec postgres pg_dump -U postgres cma_system > backup_$(date +%Y%m%d).sql

# Backup MinIO data
docker-compose exec minio mc mirror /data /backup/minio/$(date +%Y%m%d)
```

### Log Management
```bash
# View service logs
docker-compose logs -f chatbot        # AI chat logs
docker-compose logs -f translation-service  # Translation requests
docker-compose logs -f api            # Main application logs

# Monitor resource usage
docker stats
```

## Troubleshooting

### Common Issues

1. **Models not downloading**
   - Check internet connectivity during first run
   - Verify disk space (need 15GB+ for full model set)
   - Check Docker container logs: `docker-compose logs chatbot`

2. **Translation service failing**
   - Models may need 2-5 minutes to load on first run
   - Check memory allocation: translation service needs 4GB RAM
   - Test individual models: `curl http://localhost:8003/health`

3. **CoA generation not working**
   - Verify chatbot service is running: `curl http://localhost:8001/health`
   - Check database connectivity from chatbot container
   - Ensure case ID exists in database

### Performance Optimization
```yaml
# Production Docker resource limits
services:
  chatbot:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
          
  translation-service:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 2G
```

## Cost Analysis

### Infrastructure Costs (Monthly)

#### Self-Hosted (Own Hardware)
- **Server**: £200-500/month (depending on specs)
- **Electricity**: £50-100/month
- **Internet**: £50/month
- **Maintenance**: £100/month
- **Total**: £400-650/month

#### Cloud Hosting (AWS)
- **ECS Services**: £200-400/month
- **RDS Database**: £50-70/month
- **Storage (EFS + S3)**: £60-80/month
- **Data Transfer**: £20-50/month
- **Other Services**: £50/month
- **Total**: £380-650/month

### Cost Comparison vs External APIs
```
Monthly API costs (hypothetical external services):
- GPT-4 API: £300-1000/month
- Google Translate: £50-200/month  
- OCR Services: £100-300/month
- Total External: £450-1500/month

Local Hosting Savings: 15-60% cost reduction
Additional Benefits: Complete data privacy, no API rate limits
```

This hosting guide ensures you can deploy the complete MordecAI system with all enhanced features while maintaining full control over your data and AI processing capabilities.
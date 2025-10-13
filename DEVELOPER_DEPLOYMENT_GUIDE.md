# Developer Deployment Guide - RAG-Enhanced CMA Catalyst

This comprehensive guide is designed for future developers who need to understand, deploy, and extend the RAG-enhanced CMA Catalyst system.

## 🧠 Understanding the RAG Architecture

### Why RAG Matters for Debt Advisory Services

**The Challenge**: Debt advisors need instant access to vast amounts of regulatory guidance, training materials, and case precedents while maintaining consistent, compliant advice quality.

**The Solution**: RAG (Retrieval-Augmented Generation) combines semantic search with AI generation to provide:
- **Contextual accuracy** grounded in actual training materials
- **Real-time knowledge access** during client conversations
- **Institutional memory** that preserves expertise
- **Continuous quality improvement** through AI enhancement

### Technical Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAG-Enhanced CMA Catalyst                    │
├─────────────────────────────────────────────────────────────────┤
│  Web Application (React + Node.js)                             │
│  ├── Case Management                                            │
│  ├── RAG-Enhanced Chat                                          │
│  ├── Training Manual Management                                 │
│  └── Case Notes Enhancement                                     │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (Express.js)                                        │
│  ├── /api/rag/* - RAG functionality                            │
│  ├── /api/case-notes/* - Enhanced case notes                   │
│  ├── /api/clients/* - Client management                        │
│  └── /api/cases/* - Case management                            │
├─────────────────────────────────────────────────────────────────┤
│  RAG Services Layer                                            │
│  ├── RAG Ingestion Service (Python/FastAPI) :8004              │
│  ├── Enhanced Chatbot Service (Python/FastAPI) :8001           │
│  ├── ChromaDB Vector Store :8005                               │
│  └── Ollama LLM Service :11434                                 │
├─────────────────────────────────────────────────────────────────┤
│  Workflow Automation (N8N) :5678                               │
│  ├── Case Note Review & Enhancement                            │
│  ├── Training Manual Ingestion                                 │
│  ├── RAG-Enhanced AI Assistant                                 │
│  └── Document Processing with Context                          │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                    │
│  ├── PostgreSQL - Structured data                              │
│  ├── MinIO S3 - Document storage                               │
│  ├── Redis - Caching & sessions                                │
│  └── ChromaDB - Vector embeddings                              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

#### 1. **Knowledge Ingestion Flow**
```
Training Manual → Text Extraction → Chunking → Embedding → Vector Store
Closed Cases → Case Processing → Chunking → Embedding → Case Precedents
Enhanced Notes → Quality Review → Embedding → Notes Collection
```

#### 2. **Query Enhancement Flow**
```
User Query → Embedding → Vector Search → Context Retrieval →
LLM Enhancement → Response with Sources → Quality Scoring
```

#### 3. **Case Note Enhancement Flow**
```
Note Creation/Update → N8N Trigger → Multi-Collection Search →
AI Enhancement → Training Links → Advisor Review → Knowledge Base Update
```

## 🚀 Complete Deployment Procedure

### Prerequisites

#### System Requirements
- **CPU**: 8+ cores (16+ recommended)
- **RAM**: 16GB minimum (32GB+ for production)
- **Storage**: 500GB+ SSD (for models, documents, and databases)
- **GPU**: Optional but recommended (NVIDIA with 8GB+ VRAM)
- **Network**: High-bandwidth internet for initial model downloads

#### Software Dependencies
```bash
# Core requirements
Docker Engine 20.10+
Docker Compose 2.0+
Git 2.30+

# Development tools (optional)
Node.js 18+
Python 3.11+
PostgreSQL client tools
```

### Step 1: Environment Preparation

#### Clone and Setup Repository
```bash
# Clone the repository
git clone <your-repository-url>
cd windsurf-project

# Create environment configuration
cp .env.example .env

# Configure RAG-specific environment variables
cat >> .env << 'EOF'
# === RAG SYSTEM CONFIGURATION ===

# Service URLs (internal Docker network)
RAG_INGESTION_URL=http://rag-ingestion:8004
CHROMADB_URL=http://chromadb:8000
OLLAMA_URL=http://ollama:11434
CHATBOT_URL=http://chatbot:8001

# External URLs (for web application)
RAG_INGESTION_EXTERNAL_URL=http://localhost:8004
CHROMADB_EXTERNAL_URL=http://localhost:8005
OLLAMA_EXTERNAL_URL=http://localhost:11434

# S3/MinIO Configuration
TRAINING_MANUALS_BUCKET=training-manuals
CASE_PRECEDENTS_BUCKET=case-precedents
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Model Configuration
OLLAMA_MODEL_CHAT=llama3.1:8b
OLLAMA_MODEL_EMBED=nomic-embed-text
OLLAMA_MODEL_BACKUP=llama2:7b

# Vector Store Settings
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_TOP_K_DEFAULT=5
RAG_SCORE_THRESHOLD=0.7

# N8N Configuration
N8N_WEBHOOK_URL=http://n8n:5678
N8N_ENCRYPTION_KEY=your-secure-encryption-key-2024

# Enhanced Features
ENABLE_CASE_ENHANCEMENT=true
ENABLE_PRECEDENT_LOOKUP=true
ENABLE_AUTO_QUALITY_REVIEW=true

# Performance Tuning
CHROMADB_MAX_CONNECTIONS=100
OLLAMA_GPU_ENABLED=false
REDIS_MAX_MEMORY=1gb
EOF
```

#### GPU Configuration (Optional)
```bash
# For NVIDIA GPU acceleration
# Install nvidia-docker2
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Update environment for GPU
echo "OLLAMA_GPU_ENABLED=true" >> .env
```

### Step 2: Service Deployment

#### Deploy Core Infrastructure
```bash
# Start core services first
docker-compose up -d postgres redis minio rabbitmq

# Wait for services to be ready
./scripts/wait-for-services.sh

# Verify core services
docker-compose ps
curl http://localhost:9000/minio/health/live  # MinIO
```

#### Deploy RAG Services
```bash
# Start vector database and LLM services
docker-compose up -d chromadb ollama

# Start RAG-specific services
docker-compose up -d rag-ingestion

# Start enhanced chatbot
docker-compose up -d chatbot

# Verify RAG services
curl http://localhost:8005/api/v1/heartbeat  # ChromaDB
curl http://localhost:11434/api/version      # Ollama
curl http://localhost:8004/health            # RAG Ingestion
curl http://localhost:8001/health            # Enhanced Chatbot
```

#### Deploy Application and Workflows
```bash
# Start main application
docker-compose up -d app

# Start N8N workflow engine
docker-compose up -d n8n

# Start remaining services
docker-compose up -d nginx

# Final verification
docker-compose ps
```

### Step 3: RAG System Initialization

#### Initialize Models and Collections
```bash
# Run comprehensive initialization
./scripts/rag-init.sh

# This script will:
# 1. Pull required Ollama models
# 2. Create vector collections
# 3. Upload sample training materials
# 4. Test all integrations
```

#### Manual Model Management (if needed)
```bash
# Pull models manually if automatic fails
docker exec cma-ollama ollama pull llama3.1:8b
docker exec cma-ollama ollama pull nomic-embed-text

# Verify models
docker exec cma-ollama ollama list

# Test model generation
docker exec cma-ollama ollama run llama3.1:8b "Test generation"
```

#### Initialize Vector Collections
```bash
# Create collections via API
curl -X POST http://localhost:8004/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "sample-training-manual.txt",
    "manual_type": "fca-guidelines",
    "force_reprocess": true
  }'

# Verify collections
curl http://localhost:8004/collections/stats
```

### Step 4: Advanced Feature Configuration

#### Import N8N Workflows
```bash
# N8N should auto-import workflows from n8n/workflows/
# Verify imports at http://localhost:5678

# If manual import needed:
# 1. Access N8N UI at http://localhost:5678
# 2. Import workflow files from n8n/workflows/
# 3. Activate workflows
# 4. Test webhook endpoints
```

#### Configure Case Enhancement
```bash
# Test case note enhancement
curl -X POST http://localhost:5000/api/case-notes/create \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": "test_case_001",
    "note_content": "Client has mortgage arrears of £5,000 and utility debts.",
    "note_type": "assessment",
    "advisor_id": "test_advisor",
    "client_situation": "priority debt situation"
  }'

# Verify N8N workflow trigger
curl http://localhost:5678/webhook/case-note-review \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "note_id": "test_note",
    "note_content": "Test note for enhancement",
    "case_id": "test_case"
  }'
```

#### Setup Historical Case Import
```bash
# Prepare historical case data
# Create cases.json with your historical cases

# Import closed cases for precedent lookup
curl -X POST http://localhost:8004/cases/ingest/closed-case \
  -H "Content-Type: application/json" \
  -d @cases.json

# Verify case precedents
curl http://localhost:8004/cases/precedents/stats
```

### Step 5: Integration Testing

#### Run Comprehensive Tests
```bash
# Test all RAG functionality
./scripts/test-rag-integration.sh

# Test advanced features
./scripts/test-advanced-features.sh

# Load testing (optional)
cd tests/load
npm install
npm test
```

#### Manual Integration Tests
```bash
# 1. Test basic RAG search
curl -X POST http://localhost:5000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "mortgage arrears procedures", "top_k": 3}'

# 2. Test enhanced chat
curl -X POST http://localhost:5000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What should I do about mortgage arrears?",
    "use_rag": true,
    "manual_type": "fca-guidelines"
  }'

# 3. Test case similarity search
curl -X POST http://localhost:8004/cases/search/similar \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mortgage arrears high debt burden",
    "case_type": "debt-management",
    "top_k": 3
  }'

# 4. Test financial profile matching
curl -X POST http://localhost:8004/cases/search/by-financial-profile \
  -H "Content-Type: application/json" \
  -d '{
    "total_debt": 45000,
    "monthly_income": 2500,
    "case_type": "debt-management"
  }'
```

### Step 6: Production Hardening

#### Security Configuration
```bash
# Update default passwords
# Edit .env and change:
POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-secure-password
MINIO_ROOT_PASSWORD=your-secure-password
N8N_ENCRYPTION_KEY=your-unique-encryption-key

# Configure SSL certificates
# Place certificates in nginx/ssl/
# Update nginx.conf for HTTPS

# Set up API authentication
# Configure JWT secrets
JWT_SECRET=your-jwt-secret-key-for-production
```

#### Performance Optimization
```bash
# Optimize for production load
echo "
# Production optimizations
CHROMADB_MAX_CONNECTIONS=200
OLLAMA_PARALLEL_REQUESTS=4
REDIS_MAX_MEMORY=4gb
POSTGRES_MAX_CONNECTIONS=200
" >> .env

# Configure resource limits in docker-compose.yml
# Especially for ollama service memory limits
```

#### Backup Configuration
```bash
# Create backup directories
mkdir -p backups/{postgres,chroma,ollama,minio}

# Setup automated backups
crontab -e
# Add:
# 0 2 * * * /path/to/windsurf-project/scripts/backup-rag-system.sh
```

### Step 7: Monitoring and Maintenance

#### Health Monitoring Setup
```bash
# Monitor service health
curl http://localhost:5000/api/rag/health

# Monitor vector collections
curl http://localhost:8004/collections/stats

# Monitor model performance
curl http://localhost:11434/api/ps

# Monitor N8N workflows
curl http://localhost:5678/healthz
```

#### Log Management
```bash
# View service logs
docker-compose logs -f rag-ingestion
docker-compose logs -f chromadb
docker-compose logs -f ollama
docker-compose logs -f n8n

# Setup log rotation
# Configure in /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

## 🔧 Development Workflow

### Adding New Features

#### Extending RAG Functionality
```python
# services/rag-ingestion/main.py
@app.post("/new-feature")
async def new_rag_feature(request: NewFeatureRequest):
    # Implement new RAG capability
    pass
```

#### Creating Custom N8N Workflows
```json
{
  "name": "Custom Workflow",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "custom-endpoint"
      },
      "name": "Custom Webhook",
      "type": "n8n-nodes-base.webhook"
    }
  ]
}
```

#### Adding New Vector Collections
```python
# Initialize new collection
collection = chroma_client.create_collection(
    name="new_collection",
    metadata={"description": "New knowledge collection"}
)

# Add processing logic
async def process_new_data_type(data):
    # Process and chunk data
    chunks = create_chunks(data)

    # Generate embeddings
    embeddings = await generate_embeddings(chunks)

    # Store in collection
    collection.add(
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadata,
        ids=ids
    )
```

### Testing New Features
```bash
# Unit tests
cd services/rag-ingestion
python -m pytest tests/

# Integration tests
./scripts/test-new-features.sh

# Performance tests
cd tests/performance
python load_test.py
```

### Debugging Common Issues

#### Ollama Model Issues
```bash
# Check model status
docker exec cma-ollama ollama list

# Re-pull corrupted models
docker exec cma-ollama ollama pull llama3.1:8b --force

# Check GPU utilization
nvidia-smi  # if GPU enabled
```

#### ChromaDB Connection Issues
```bash
# Check ChromaDB health
curl http://localhost:8005/api/v1/heartbeat

# Restart ChromaDB
docker-compose restart chromadb

# Check collection status
curl http://localhost:8004/collections/stats
```

#### N8N Workflow Issues
```bash
# Check N8N logs
docker-compose logs n8n

# Test webhook endpoints
curl -X POST http://localhost:5678/webhook/test

# Verify workflow activation
# Access N8N UI at http://localhost:5678
```

## 📚 Knowledge Base Management

### Content Management Best Practices

#### Training Manual Organization
```
training-manuals/
├── fca-guidelines/
│   ├── mortgage-conduct-rules.pdf
│   ├── debt-advice-standards.pdf
│   └── vulnerability-guidance.pdf
├── internal-procedures/
│   ├── case-assessment-guide.pdf
│   └── quality-standards.pdf
└── compliance/
    ├── data-protection.pdf
    └── audit-procedures.pdf
```

#### Case Data Management
```json
{
  "case_data_schema": {
    "case_id": "string",
    "case_type": "debt-management|bankruptcy|iva|dro",
    "client_situation": "string",
    "financial_profile": {
      "total_debt": "number",
      "monthly_income": "number",
      "dependents": "number"
    },
    "advice_provided": "string",
    "outcome": "successful|partial|referred",
    "lessons_learned": "string"
  }
}
```

### Quality Assurance Process

#### Note Enhancement Review
1. **Automatic Analysis**: System identifies improvement opportunities
2. **Training Material Links**: Relevant guidance automatically attached
3. **Precedent Examples**: Similar successful cases highlighted
4. **Compliance Check**: FCA requirements verified
5. **Advisor Review**: Human verification before finalization

#### Continuous Improvement
```bash
# Generate quality reports
curl http://localhost:5000/api/case-notes/quality-report \
  -H "Authorization: Bearer $JWT_TOKEN"

# Analyze enhancement effectiveness
curl http://localhost:5000/api/rag/analytics/enhancement-impact

# Review training material usage
curl http://localhost:5000/api/rag/analytics/manual-usage
```

## 🚀 Scaling and Performance

### Horizontal Scaling Strategy

#### Service Scaling
```yaml
# docker-compose.scale.yml
services:
  rag-ingestion:
    deploy:
      replicas: 3

  chatbot:
    deploy:
      replicas: 2
```

#### Database Scaling
```bash
# ChromaDB clustering (enterprise)
# Setup multiple ChromaDB instances with load balancer

# Redis clustering
# Configure Redis Cluster for high availability
```

### Performance Optimization

#### Caching Strategy
```python
# Implement result caching
@lru_cache(maxsize=1000)
async def cached_embedding(text: str) -> List[float]:
    return await generate_embedding(text)

# Redis caching for frequent queries
async def search_with_cache(query: str) -> Dict:
    cache_key = f"search:{hash(query)}"
    cached = await redis.get(cache_key)

    if cached:
        return json.loads(cached)

    result = await perform_search(query)
    await redis.setex(cache_key, 3600, json.dumps(result))
    return result
```

#### Model Optimization
```bash
# Use quantized models for faster inference
docker exec cma-ollama ollama pull llama3.1:8b-q4_0

# Optimize batch processing
# Configure batch sizes in services/rag-ingestion/main.py
BATCH_SIZE = 10
```

This comprehensive guide ensures future developers can successfully deploy, understand, and extend the RAG-enhanced CMA Catalyst system while maintaining its intelligent capabilities and performance standards.
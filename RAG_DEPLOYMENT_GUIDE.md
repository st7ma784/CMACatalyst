# RAG System Deployment Guide

This guide provides comprehensive instructions for deploying the RAG (Retrieval-Augmented Generation) system that enhances the CMA Catalyst application with training manual lookup capabilities.

## 🚀 Overview

The RAG system integrates multiple components to provide intelligent document retrieval and AI-enhanced responses based on training manuals stored in S3-compatible storage.

### Architecture Components

- **RAG Ingestion Service** (`port 8004`): Document processing and vector storage
- **ChromaDB** (`port 8005`): Vector database for semantic search
- **Ollama** (`port 11434`): Local LLM serving (Llama models)
- **Enhanced Chatbot** (`port 8001`): RAG-enabled conversation service
- **N8N Workflows**: Automated RAG-based document processing
- **Main Application API**: RESTful endpoints for RAG functionality

## 📋 Prerequisites

### System Requirements
- Docker Engine 20.10+ with Docker Compose
- 16GB RAM minimum (32GB recommended for optimal performance)
- 100GB free disk space for models and documents
- GPU support (optional but recommended for faster inference)

### Environment Variables
Create or update `.env` file with RAG-specific configuration:

```bash
# RAG Service URLs
RAG_INGESTION_URL=http://rag-ingestion:8004
CHROMADB_URL=http://chromadb:8000
OLLAMA_URL=http://ollama:11434

# S3/MinIO Configuration for Training Manuals
TRAINING_MANUALS_BUCKET=training-manuals
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Model Configuration
OLLAMA_MODEL_CHAT=llama3.1:8b
OLLAMA_MODEL_EMBED=nomic-embed-text

# RAG Settings
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_TOP_K_DEFAULT=5
RAG_SCORE_THRESHOLD=0.7
```

## 🔧 Installation Steps

### 1. Deploy Core Services

Start all RAG services using the updated docker-compose configuration:

```bash
# Start the enhanced stack with RAG services
docker-compose up -d

# Verify all services are running
docker-compose ps

# Check service logs
docker-compose logs -f rag-ingestion chromadb ollama
```

### 2. Initialize RAG System

Run the initialization script to set up models and sample data:

```bash
# Make script executable (if not already)
chmod +x ./scripts/rag-init.sh

# Run initialization
./scripts/rag-init.sh

# Monitor initialization progress
docker-compose logs -f ollama
```

The initialization script will:
- Pull required Ollama models (LLaMA and embedding models)
- Create sample training manual
- Test RAG functionality
- Verify all service connections

### 3. Verify Installation

Check that all services are healthy:

```bash
# Test RAG API endpoints
curl http://localhost:5000/api/rag/health

# Test RAG ingestion service
curl http://localhost:8004/health

# Test vector database
curl http://localhost:8005/api/v1/heartbeat

# Test Ollama
curl http://localhost:11434/api/version

# Check collection statistics
curl http://localhost:8004/collections/stats
```

## 📚 Training Manual Management

### Upload Training Manuals

#### Via Web Interface
1. Navigate to the admin section in the web application
2. Access "Training Manuals" under RAG Management
3. Upload PDF, TXT, DOCX, or DOC files
4. Select appropriate manual type (general, fca-guidelines, etc.)
5. Click "Upload and Process"

#### Via API
```bash
# Upload single file
curl -X POST http://localhost:5000/api/rag/ingest/upload \
  -F "file=@/path/to/manual.pdf" \
  -F "manual_type=fca-guidelines" \
  -F "force_reprocess=false"

# Ingest from S3 bucket
curl -X POST http://localhost:5000/api/rag/ingest/s3 \
  -H "Content-Type: application/json" \
  -d '{
    "bucket_path": "compliance-guides/",
    "manual_type": "compliance",
    "force_reprocess": false
  }'
```

#### Via N8N Workflow
Use the "Training Manual Ingestion" workflow:
```bash
curl -X POST http://localhost:5678/webhook/ingest-manual \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "manuals/debt-advice-guide.pdf",
    "manual_type": "training",
    "force_reprocess": false
  }'
```

### Supported File Types
- **PDF**: Primary format for training manuals
- **TXT**: Plain text documents
- **DOCX/DOC**: Microsoft Word documents

### Manual Types
- `general`: General training materials
- `fca-guidelines`: FCA regulatory guidelines
- `debt-procedures`: Debt advice procedures
- `compliance`: Compliance documentation
- `training`: Staff training materials

## 🤖 Using RAG-Enhanced Features

### Enhanced Chat API

The RAG-enhanced chatbot provides context-aware responses:

```javascript
// Basic RAG-enhanced chat
const response = await fetch('/api/rag/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What are priority debts?",
    client_id: "client_123",
    use_rag: true,
    manual_type: "fca-guidelines"
  })
});

const result = await response.json();
console.log(result.response); // AI response with training manual context
console.log(result.sources);  // Source documents used
console.log(result.confidence); // Response confidence score
```

### Search Training Manuals

Direct search of training manual content:

```javascript
// Search for specific topics
const searchResponse = await fetch('/api/rag/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "debt management plan eligibility",
    manual_type: "debt-procedures",
    top_k: 5,
    score_threshold: 0.7
  })
});

const searchResults = await searchResponse.json();
searchResults.results.forEach(result => {
  console.log(`Score: ${result.score}`);
  console.log(`Content: ${result.content}`);
  console.log(`Source: ${result.metadata.file_name}`);
});
```

### N8N Workflow Integration

Use the RAG-enhanced workflows for automated processing:

1. **RAG-Enhanced AI Assistant**: Provides context-aware advice
2. **Training Manual Ingestion**: Automated document processing
3. **Enhanced Document Processing**: OCR + RAG integration

```bash
# Trigger RAG-enhanced assistant
curl -X POST http://localhost:5678/webhook/rag-assistant \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_123",
    "question": "How should I handle rent arrears?",
    "manual_type": "debt-procedures"
  }'
```

## 🔍 Monitoring and Maintenance

### Health Checks

Monitor service health using dedicated endpoints:

```bash
# Overall RAG system health
curl http://localhost:5000/api/rag/health

# Individual service health
curl http://localhost:8004/health          # RAG Ingestion
curl http://localhost:8005/api/v1/heartbeat # ChromaDB
curl http://localhost:11434/api/version     # Ollama
```

### Performance Monitoring

```bash
# Check vector collection statistics
curl http://localhost:8004/collections/stats

# Monitor Ollama model usage
curl http://localhost:11434/api/ps

# Check Docker service resources
docker stats cma-rag-ingestion cma-chromadb cma-ollama
```

### Log Analysis

```bash
# RAG service logs
docker-compose logs -f rag-ingestion

# ChromaDB logs
docker-compose logs -f chromadb

# Ollama logs
docker-compose logs -f ollama

# Enhanced chatbot logs
docker-compose logs -f chatbot
```

### Backup and Recovery

#### Vector Database Backup
```bash
# Backup ChromaDB data
docker run --rm \
  -v cma_chroma_data:/source \
  -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/chroma-backup-$(date +%Y%m%d).tar.gz -C /source .
```

#### Model Backup
```bash
# Backup Ollama models
docker run --rm \
  -v cma_ollama_data:/source \
  -v $(pwd)/backups:/backup \
  alpine tar -czf /backup/ollama-models-$(date +%Y%m%d).tar.gz -C /source .
```

#### Training Manuals Backup
```bash
# Backup training manuals from MinIO
mc mirror minio/training-manuals ./backups/training-manuals-$(date +%Y%m%d)/
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Ollama Models Not Loading
```bash
# Check available models
docker exec cma-ollama ollama list

# Pull required models manually
docker exec cma-ollama ollama pull llama3.1:8b
docker exec cma-ollama ollama pull nomic-embed-text

# Test model generation
docker exec cma-ollama ollama run llama3.1:8b "Hello, test"
```

#### 2. ChromaDB Connection Issues
```bash
# Check ChromaDB status
curl http://localhost:8005/api/v1/heartbeat

# Restart ChromaDB if needed
docker-compose restart chromadb

# Check ChromaDB logs
docker-compose logs chromadb
```

#### 3. RAG Search Returns No Results
```bash
# Check collection contents
curl http://localhost:8004/collections/stats

# Reset collection (development only)
curl -X DELETE http://localhost:8004/collections/reset

# Re-ingest sample data
./scripts/rag-init.sh
```

#### 4. Memory Issues
```bash
# Check resource usage
docker stats

# Adjust memory limits in docker-compose.yml
# For Ollama:
deploy:
  resources:
    limits:
      memory: 8G
    reservations:
      memory: 4G
```

#### 5. Slow Response Times
- Ensure sufficient RAM allocation
- Consider using GPU acceleration for Ollama
- Optimize chunk size and overlap settings
- Monitor network latency between services

### Performance Optimization

#### GPU Acceleration (NVIDIA)
```bash
# Install nvidia-docker2
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Update docker-compose.yml for Ollama service
services:
  ollama:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

#### Caching Optimization
```bash
# Configure Redis for RAG result caching
# Add to docker-compose.yml
rag-cache:
  image: redis:7-alpine
  container_name: cma-rag-cache
  command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

## 🔒 Security Considerations

### Access Control
- Ensure proper API authentication for RAG endpoints
- Restrict access to admin functions (collection reset, etc.)
- Use environment variables for sensitive configuration

### Data Privacy
- Training manuals may contain sensitive information
- Ensure proper encryption for data at rest
- Monitor access logs for unauthorized usage

### Network Security
- Run services in isolated Docker network
- Use internal service names for inter-service communication
- Implement proper firewall rules

## 📈 Scaling Considerations

### Horizontal Scaling
- RAG ingestion service can be scaled horizontally
- Use load balancer for multiple chatbot instances
- ChromaDB supports clustering for large datasets

### Model Management
- Consider model versioning for updates
- Implement blue-green deployment for model updates
- Monitor model performance and accuracy

## 🎯 Next Steps

1. **Production Deployment**: Configure for production environment
2. **Custom Models**: Train domain-specific embedding models
3. **Advanced Features**: Implement conversation memory and context
4. **Analytics**: Add detailed usage analytics and performance metrics
5. **Integration**: Extend RAG to other parts of the application

## 📞 Support

For issues with the RAG system:
1. Check service logs first
2. Verify environment configuration
3. Test individual service health endpoints
4. Review this deployment guide
5. Consult the development team

---

**Note**: This RAG system runs entirely locally with no external API dependencies, ensuring maximum security and control over sensitive debt advice data.
# RAG Architecture Guide for CMA Catalyst

## 🧠 What is RAG and Why Do We Need It?

### The Problem We're Solving

In debt advice services, advisors need to:
1. **Access vast amounts of training material** quickly during client conversations
2. **Ensure consistent advice** aligned with FCA regulations and best practices
3. **Learn from previous similar cases** to provide better guidance
4. **Maintain compliance** with ever-changing regulations
5. **Reduce training time** for new advisors

Traditional approaches fall short because:
- **Manual search is slow**: Advisors can't quickly find relevant training material mid-conversation
- **Knowledge gaps exist**: Not every advisor memorizes all procedures and regulations
- **Inconsistent advice**: Different advisors may handle similar cases differently
- **No case precedent lookup**: Previous successful case resolutions aren't easily accessible
- **Training overhead**: New staff need extensive training to be effective

### What is Retrieval-Augmented Generation (RAG)?

RAG combines the power of:
- **Semantic Search**: Finding relevant documents based on meaning, not just keywords
- **Large Language Models**: Generating contextual, natural responses
- **Vector Databases**: Storing and retrieving information as mathematical representations

**How it works:**
1. **Documents are "chunked"** into manageable pieces (training manuals, case notes, etc.)
2. **Embeddings are created** - mathematical representations that capture semantic meaning
3. **Vector database stores** these embeddings for lightning-fast similarity search
4. **When a query comes in**, relevant chunks are retrieved based on semantic similarity
5. **LLM generates response** using both the query and retrieved context

### Why RAG is Perfect for Debt Advice

#### 🎯 **Contextual Accuracy**
- Responses are grounded in actual training materials and regulations
- Reduces hallucination and ensures compliance with FCA guidelines
- Provides source attribution for audit trails

#### ⚡ **Real-time Knowledge Access**
- Instant access to relevant procedures during client conversations
- No need to pause conversations to look up information
- Seamless integration with existing workflows

#### 📚 **Institutional Memory**
- Previous case resolutions become searchable precedents
- Knowledge doesn't leave when experienced advisors move on
- Continuous learning from successful case outcomes

#### 🔄 **Always Up-to-date**
- New training materials automatically enhance the system
- Regulation changes propagate immediately to all advisors
- No lag between policy updates and advisor knowledge

#### 🎓 **Accelerated Training**
- New advisors have expert-level knowledge access from day one
- Consistent quality across all advisor interactions
- Reduces onboarding time significantly

## 🏗️ Architecture Deep Dive

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Web    │    │  Training       │    │  Case Notes     │
│   Application   │    │  Manuals (S3)   │    │  Database       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              ┌───────▼──────────────────────▼──────┐
          │              │      RAG Ingestion Service         │
          │              │   • Document Processing            │
          │              │   • Text Chunking                  │
          │              │   • Embedding Generation           │
          │              └───────┬──────────────────────────────┘
          │                      │
          │              ┌───────▼───────┐
          │              │   ChromaDB    │
          │              │ Vector Store  │
          │              └───────┬───────┘
          │                      │
    ┌─────▼──────┐      ┌────────▼────────┐      ┌─────────────┐
    │    Main    │      │   Enhanced      │      │   Ollama    │
    │ Application│◄────►│   Chatbot       │◄────►│    LLM      │
    │  RAG APIs  │      │   Service       │      │  Service    │
    └─────┬──────┘      └─────────────────┘      └─────────────┘
          │
    ┌─────▼──────┐
    │    N8N     │
    │ Workflows  │
    │ • Case Review │
    │ • Auto-linking │
    │ • Quality Assurance │
    └────────────┘
```

### Data Flow

#### 1. **Document Ingestion Flow**
```
Training Manual Upload → PDF Processing → Text Extraction →
Chunking → Embedding Generation → Vector Storage → Search Index
```

#### 2. **Query Processing Flow**
```
User Query → Embedding Generation → Vector Similarity Search →
Context Retrieval → LLM Prompt Enhancement → Response Generation →
Source Attribution
```

#### 3. **Case Notes Enhancement Flow**
```
Case Note Change → N8N Trigger → RAG Analysis → Training Manual Links →
Suggested Improvements → Advisor Review → Note Enhancement
```

## 🔧 Technical Implementation

### Vector Database Strategy

**ChromaDB Choice Rationale:**
- **Open source** and self-hosted for data privacy
- **Python-native** integration with our processing pipeline
- **Metadata filtering** for manual types and case categories
- **Efficient similarity search** with configurable distance metrics
- **Scalable** for growing document collections

**Embedding Strategy:**
- **Model**: `nomic-embed-text` for high-quality semantic understanding
- **Chunk Size**: 1000 characters with 200 character overlap
- **Metadata**: Document type, source, creation date, manual category
- **Dimensions**: 768-dimensional embeddings for precise similarity matching

### LLM Integration

**Ollama + Llama 3.1 Benefits:**
- **Fully local** - no data leaves your infrastructure
- **Cost-effective** - no per-token charges
- **Customizable** - fine-tuning possible for domain-specific knowledge
- **Fast inference** - local GPU acceleration
- **Privacy compliant** - meets strict financial services requirements

### Multi-Collection Strategy

We implement separate vector collections for different data types:

#### 1. **Training Manuals Collection**
```python
{
  "collection_name": "training_manuals",
  "metadata_schema": {
    "manual_type": ["fca-guidelines", "debt-procedures", "compliance"],
    "file_name": "string",
    "section": "string",
    "last_updated": "datetime"
  }
}
```

#### 2. **Case Precedents Collection**
```python
{
  "collection_name": "case_precedents",
  "metadata_schema": {
    "case_id": "string",
    "case_type": ["debt-management", "bankruptcy", "iva"],
    "outcome": ["successful", "partially-resolved", "referred"],
    "resolution_date": "datetime",
    "advisor_id": "string"
  }
}
```

#### 3. **Case Notes Collection**
```python
{
  "collection_name": "case_notes",
  "metadata_schema": {
    "case_id": "string",
    "note_type": ["assessment", "advice", "follow-up"],
    "client_situation": "string",
    "note_date": "datetime"
  }
}
```

## 🚀 Deployment for Future Developers

### Prerequisites Checklist

- [ ] Docker Engine 20.10+ with Docker Compose
- [ ] 16GB+ RAM (32GB recommended)
- [ ] 100GB+ storage for models and documents
- [ ] GPU support (optional, but recommended)
- [ ] Python 3.11+ for development
- [ ] Node.js 18+ for web application

### Step-by-Step Deployment

#### 1. **Environment Setup**
```bash
# Clone repository
git clone <repository-url>
cd windsurf-project

# Copy environment template
cp .env.example .env

# Configure RAG-specific variables
cat >> .env << EOF
# RAG Configuration
RAG_INGESTION_URL=http://rag-ingestion:8004
CHROMADB_URL=http://chromadb:8000
OLLAMA_URL=http://ollama:11434
TRAINING_MANUALS_BUCKET=training-manuals
CASE_PRECEDENTS_BUCKET=case-precedents

# Model Configuration
OLLAMA_MODEL_CHAT=llama3.1:8b
OLLAMA_MODEL_EMBED=nomic-embed-text

# Vector Store Settings
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_SCORE_THRESHOLD=0.7
EOF
```

#### 2. **Service Deployment**
```bash
# Deploy all services
docker-compose up -d

# Verify services are running
docker-compose ps

# Initialize RAG system
./scripts/rag-init.sh

# Test integration
./scripts/test-rag-integration.sh
```

#### 3. **Data Preparation**
```bash
# Create training manuals directory
mkdir -p uploads/training-manuals

# Upload sample training materials
curl -X POST http://localhost:5000/api/rag/ingest/upload \
  -F "file=@sample-training-manual.pdf" \
  -F "manual_type=fca-guidelines"

# Verify ingestion
curl http://localhost:5000/api/rag/stats
```

### Development Workflow

#### **Adding New Features**

1. **Extend RAG Service** (`services/rag-ingestion/`)
```python
# Add new endpoints in main.py
@app.post("/new-feature")
async def new_feature(request: NewFeatureRequest):
    # Implementation
    pass
```

2. **Update Main Application** (`server/routes/rag.js`)
```javascript
// Add new API routes
router.post('/new-feature', async (req, res) => {
  // Proxy to RAG service
});
```

3. **Create N8N Workflows** (`n8n/workflows/`)
```json
{
  "name": "New RAG Workflow",
  "nodes": [
    // Workflow definition
  ]
}
```

#### **Testing New Features**
```bash
# Unit tests for RAG service
cd services/rag-ingestion
python -m pytest tests/

# Integration tests
./scripts/test-rag-integration.sh

# Load testing
cd tests/load
npm test
```

#### **Monitoring and Debugging**
```bash
# Service logs
docker-compose logs -f rag-ingestion

# Vector database inspection
curl http://localhost:8004/collections/stats

# Model performance
curl http://localhost:11434/api/ps

# ChromaDB queries
curl -X POST http://localhost:8005/api/v1/collections/training_manuals/query \
  -H "Content-Type: application/json" \
  -d '{"query_texts":["debt management"],"n_results":5}'
```

### Scaling Considerations

#### **Horizontal Scaling**
- **RAG Ingestion**: Multiple instances behind load balancer
- **ChromaDB**: Cluster deployment for large datasets
- **Ollama**: GPU-accelerated nodes for faster inference

#### **Performance Optimization**
- **Embedding Cache**: Redis cache for frequent embeddings
- **Result Cache**: Cache common queries for faster response
- **Batch Processing**: Process documents in batches during low-traffic periods

#### **Storage Scaling**
- **S3 Bucket Partitioning**: Organize by date/type for efficient access
- **Vector Index Optimization**: Regular reindexing for optimal performance
- **Backup Strategy**: Automated backups of vector collections

### Security Best Practices

#### **Data Protection**
- All sensitive data remains within your infrastructure
- Encryption at rest for vector databases
- Secure API authentication for all endpoints
- Regular security audits of dependencies

#### **Access Control**
- Role-based access to RAG administration features
- Audit logging for all document access
- Encrypted communication between services
- Regular credential rotation

### Maintenance Tasks

#### **Daily**
- Monitor service health endpoints
- Check vector collection statistics
- Review error logs for issues

#### **Weekly**
- Update training materials as needed
- Review case precedent additions
- Analyze query patterns and performance

#### **Monthly**
- Model performance evaluation
- Vector database optimization
- Security patch updates
- Backup verification

This architecture provides a robust, scalable foundation for intelligent document retrieval and AI-enhanced advisory services while maintaining complete control over sensitive debt advice data.
# RMA-Demo: Distributed AI System

A comprehensive distributed computing platform for AI workloads, featuring a democratized worker pool where anyone can contribute compute capacity.

## 🎉 **NEW: Zero-Cost Serverless Deployment!**

Run a globally distributed system with **$0/month** hosting costs:
- ✅ Cloudflare Workers (free tier) for global edge routing
- ✅ Durable Objects for coordinator registry (1K writes/day free)
- ✅ Volunteer hardware for compute (GPU/CPU workers)
- ✅ Auto-scaling edge coordinators
- ✅ One-command deployment via Docker Compose

**📖 See [ZERO_COST_DEPLOYMENT.md](./ZERO_COST_DEPLOYMENT.md) - Deploy in 5 minutes!**

## 🏗️ System Architecture

The RMA system uses a **distributed edge-federated architecture** that separates routing (Cloudflare edge) from coordination (distributed edge coordinators) from computation (volunteer workers):

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Edge Router (FREE, Global)                     │
│  api.rmatool.org.uk                                         │
│  - Durable Objects (coordinator registry)                  │
│  - Routes workers to nearest coordinator                   │
│  - Zero hosting costs ✅                                    │
└────────────┬───────────────────────────────────────────────┘
             │ Routes to →
             ├──────────────┬──────────────┬──────────────┐
             │              │              │              │
    ┌────────▼────┐  ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼─────┐
    │ Edge Coord  │  │ Edge Coord │ │ Edge Coord │ │   ...    │
    │ (UK)        │  │ (US)       │ │ (EU)       │ │          │
    │ Volunteer   │  │ Volunteer  │ │ Volunteer  │ │ Volunteer│
    │ Hardware    │  │ Hardware   │ │ Hardware   │ │ Hardware │
    └─────┬───────┘  └──────┬─────┘ └─────┬──────┘ └────┬─────┘
          │                 │              │             │
          └─────────────────┴──────────────┴─────────────┘
                            │
           ┌────────────────┴────────────────┐
           │                                  │
    ┌──────▼──────┐  ┌──────────┐  ┌────────▼────┐
    │ GPU Workers │  │ Storage  │  │ CPU Workers │
    │ (Tier 1)    │  │ (Tier 3) │  │ (Tier 2)    │
    │             │  │          │  │             │
    │ LLM, Vision │  │ ChromaDB │  │ RAG, NER    │
    └─────────────┘  └──────────┘  └─────────────┘
```

**📖 For detailed architecture:**
- [EDGE_FEDERATION_GUIDE.md](./EDGE_FEDERATION_GUIDE.md) - How edge federation works
- [TIER_4_ARCHITECTURE.md](./TIER_4_ARCHITECTURE.md) - Edge worker coordination
- [DYNAMIC_SERVICE_ALLOCATION.md](./DYNAMIC_SERVICE_ALLOCATION.md) - Service assignment

## Why Distributed Edge Federation?

### Traditional Centralized
- GPU server: **$730/month**
- Single coordinator bottleneck
- Geographic latency issues
- Limited by single machine capacity

### Our Distributed Model
- Edge router: **$0/month** (Cloudflare free tier)
- Coordinators: **$0** (volunteer hardware + Cloudflare tunnels)
- Workers: **$0** (community donated)
- **Total: $0/month** (100% cost reduction!)
- Infinite scalability (add coordinators + workers anytime)
- Geographic distribution (low latency globally)
- Auto-failover (coordinators share load)

---

# Original RMA-Demo Dashboard Features

A comprehensive Risk Management Advice dashboard prototype for single-centre deployment, featuring AI-powered document processing, client communication tools, and knowledge management.

## Features

### 1. Notes to CoA (Course of Action)
- Convert advisor notes into client-friendly language
- Powered by Ollama LLM (local inference)
- Structured output: Matters Discussed, Our Actions, Your Actions
- Copy-friendly formatted letters

### 2. Client QR Code Generator
- Generate unique QR codes for client document upload portals
- Each client gets a personalized upload URL: `/uploads/<client-id>`
- Secure document management with authentication

### 3. Search Client Documents (with Agentic RAG + Numerical Tools)
- **AI-powered search across client-specific documents**
- **Agentic reasoning**: Analyzes questions, plans searches, provides confidence scores
- **Numerical tools**: Accurate debt calculations, pattern detection, fraud indicators
  - ⭐ **Dynamic thresholds**: No hardcoded limits - extracts from manuals on startup
  - ⭐ **Zero-hallucination math**: Python handles all calculations, not LLM
  - ⭐ **Automatic compliance**: Update manual → restart → current thresholds
- **Pattern detection**: Spots suspicious patterns like debts totaling exactly £10,000
- **Adaptive complexity**: Simple questions get fast answers, complex ones get thorough analysis
- Automatic vector indexing of all uploaded documents
- Natural language queries: "What debts does this client have?"
- Answers with source citations and reasoning transparency
- Each client has their own searchable knowledge base
- Powered by ChromaDB and Ollama embeddings

### 4. Ask the Manuals (with Agentic RAG + Numerical Tools)
- **Intelligent RAG** (Retrieval-Augmented Generation) interface for training manuals
- **Agentic workflow**: Analyzes question complexity, plans searches, synthesizes answers
- **Numerical tools**: LLM can call Python functions for accurate calculations, comparisons, and pattern detection
  - ⭐ **Critical for debt advice**: Ensures accurate eligibility checking (e.g., £60k debt > £30k DRO limit)
  - ⭐ **Dynamic threshold system**: Extracts limits from YOUR manuals, not hardcoded values
  - ⭐ **Three-layer architecture**: Context enrichment → dynamic extraction → tool-based validation
  - ⭐ **Compliance by design**: System always uses current thresholds from manuals
- **Pattern detection**: Automatically spots suspicious number patterns (debts totaling convenient sums, duplicates, etc.)
- **Confidence scoring**: Provides HIGH/MEDIUM/LOW confidence with reasoning
- **Multi-iteration search**: Complex questions trigger multiple targeted searches
- ChromaDB vector storage for efficient document retrieval
- Chat-style interface with source citations and reasoning transparency
- PDF/markdown manual support via LLamaParse

### 5. Document Processing
- Automatic PDF/image to markdown conversion
- **Automatic indexing to client-specific vector stores**
- LLamaParse as primary OCR (with Tesseract fallback)
- Organized client file management
- Authenticated upload and download

## Architecture

### Frontend
- **Next.js 14** with TypeScript
- Tailwind CSS for styling
- Tab-based interface (React components)
- Responsive design

### Backend Services
- **notes-service** (Port 8100): LLM-powered note conversion
- **doc-processor** (Port 8101): Document OCR and conversion
- **rag-service** (Port 8102): RAG for manual queries
- **client-rag-service** (Port 8104): Client-specific document search
- **upload-service** (Port 8103): File upload with auth and auto-indexing

### Infrastructure
- **Ollama**: Local LLM inference (GPU-accelerated)
- **ChromaDB**: Shared vector database for all embeddings (manuals + client docs)
- **Docker Compose**: Local development
- **Kubernetes**: Production deployment on AWS EKS

## Why the Numerical Tools Architecture Matters

This might look like a "minor architectural detail," but it's **fundamental to providing accurate debt advice**:

### The Problem
LLMs are terrible at math. They're pattern-matching engines, not calculators. When you ask "Is £60,000 too much debt for a DRO?", a pure LLM might:
- Get the calculation wrong: "£60k - £30k = £20k" ❌
- Hallucinate thresholds: "I believe the DRO limit is around £50k" ❌
- Miss the comparison: "£60k is quite high..." (ignoring the £30k limit) ❌

**The stakes:** Wrong eligibility assessment → wrong advice → client harm → regulatory risk.

### The Solution: Three-Layer Architecture

1. **Context Enrichment**: Automatically annotates retrieved text with "📊 NUMERIC RULE" hints
2. **Dynamic Threshold Extraction**: On startup, system queries manuals: "What are all the limits?" Extracts and caches actual values (DRO: £30k, bankruptcy: £680, etc.)
3. **Tool-Based Validation**: When LLM needs to check eligibility, it calls `check_threshold()`. Python performs exact comparison. No guessing.

**Result:** LLM handles language and reasoning. Python handles math. Best of both worlds.

### Why Dynamic Thresholds?

**Hardcoded (BAD):**
```python
THRESHOLDS = {"dro_max": 30000}  # What if this changes to £35k?
```
- Requires code changes to update limits
- Goes stale as regulations change
- Creates compliance risk

**Dynamic (GOOD):**
```python
# Extracts from manuals on startup
extract_thresholds_from_manuals()  
# Update manual PDF → restart → current thresholds
```
- Single source of truth: YOUR manuals
- No hardcoded values anywhere
- Automatic compliance with current limits
- Regional variations supported (different deployments, different manuals)

**Real Impact:** System using outdated £30k limit when regulation increases to £35k = wrongly rejecting eligible clients. Dynamic extraction prevents this.

📖 **See [docs/features/agentic-rag.md](docs/features/agentic-rag.md) for detailed explanation**

## Quick Start - Local Development

### Prerequisites
- Docker and Docker Compose
- NVIDIA GPU (optional, for GPU acceleration)
- 16GB+ RAM recommended

### 1. Clone and Navigate
```bash
cd RMA-Demo
```

### 2. Set Environment Variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `LLAMA_PARSE_API_KEY`: Get from LlamaParse
- `JWT_SECRET`: Random secret for authentication

### 3. Start Services
```bash
docker-compose up -d
```

This will start:
- Ollama (GPU-accelerated if available)
- ChromaDB
- All backend services
- Frontend application

### 4. Initialize Ollama Models
```bash
# Pull required models
docker exec -it rma-ollama ollama pull llama3.2
docker exec -it rma-ollama ollama pull nomic-embed-text
```

### 5. Add Training Manuals
Place PDF manuals in the `./manuals` directory, then ingest:
```bash
curl -X POST http://localhost:8102/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": ["<markdown_content>"],
    "filenames": ["manual.pdf"]
  }'
```

### 6. Access the Dashboard
Open http://localhost:3000

Default credentials:
- Username: `admin`
- Password: `admin123`

## AWS Deployment

### Prerequisites
- AWS CLI configured
- eksctl installed
- kubectl installed
- Docker installed

### 1. Deploy EKS Cluster
```bash
cd aws-scripts
./deploy-eks.sh
```

This script will:
- Create EKS cluster with CPU and GPU nodes
- Install NVIDIA device plugin
- Create ECR repositories
- Build and push Docker images
- Deploy all services to Kubernetes
- Set up Load Balancer

### 2. Register Domain
```bash
./register-domain.sh your-domain.com
```

This configures:
- Route53 hosted zone
- A record pointing to Load Balancer
- www subdomain

### 3. Monitor Deployment
```bash
kubectl get pods -n rma-demo
kubectl logs -f deployment/frontend -n rma-demo
```

## Service Endpoints

### Local Development
- Frontend: http://localhost:3000
- Notes Service: http://localhost:8100
- Doc Processor: http://localhost:8101
- RAG Service: http://localhost:8102
- Upload Service: http://localhost:8103
- Client RAG Service: http://localhost:8104
- Ollama: http://localhost:11434
- ChromaDB: http://localhost:8005

### Production (K8s)
All services are accessed through the frontend Load Balancer.
Internal services communicate via Kubernetes DNS.

## API Documentation

### Agentic RAG Features

Both the RAG Service (training manuals) and Client RAG Service (client documents) support **Agentic RAG**, an intelligent query processing approach that:

1. **Analyzes Question Complexity**: Classifies questions as simple, moderate, or complex
2. **Plans Search Strategy**: Generates targeted search queries instead of using the raw question
3. **Iteratively Searches**: Performs multiple vector searches to gather comprehensive context
4. **Synthesizes Answers**: Combines information from multiple sources with clear citations
5. **Provides Confidence**: Explicitly rates answer confidence (HIGH/MEDIUM/LOW) with reasoning
6. **Uses Numerical Tools**: LLM can call Python functions for accurate math, comparisons, and pattern detection

**Numerical Tools Available:**
- `calculate`: Accurate arithmetic (addition, subtraction, multiplication, division)
- `compare_numbers`: Precise number comparisons (greater, less, equal)
- `sum_numbers`: Sum lists of numbers with statistics (total, average, min, max)
- `find_convenient_sums`: **Pattern Detection** - Find groups summing to round amounts (£1000, £5000, etc.)
- `detect_patterns`: Find duplicates, similar values, and multiples
- `extract_numbers_from_text`: Extract all numbers from narrative text

**Example Use Cases:**
- ✅ "What is the total debt?" → Uses `sum_numbers` for accuracy
- ✅ "Are there any suspicious patterns?" → Uses `find_convenient_sums` to spot red flags
- ✅ "Which creditor should be prioritized?" → Uses `compare_numbers` for ranking
- ✅ "Do any debts seem related?" → Uses `detect_patterns` to find connections

**When to Use Agentic RAG:**
- ✅ Complex questions requiring synthesis across multiple sources
- ✅ Questions involving calculations or number comparisons
- ✅ When you need confidence metrics for decision support
- ✅ When transparency and reasoning are important
- ✅ Pattern detection and fraud indicators

**Agentic vs Standard RAG:**
- **Standard `/query`**: Fast, single-pass retrieval (1-2 seconds)
- **Agentic `/agentic-query`**: Intelligent multi-stage processing with tool calling (3-8 seconds)

**Performance:**
- Simple questions: ~2-3 seconds, 1 iteration, HIGH confidence
- Moderate questions: ~4-6 seconds, 2 iterations
- Complex questions with tools: ~8-12 seconds, 3 iterations, accurate calculations

For detailed information, see [Agentic RAG Architecture](./docs/features/agentic-rag.md).

### Notes Service
```bash
# Convert notes to client letter
POST /convert
{
  "notes": "Client meeting notes...",
  "client_name": "John Smith"
}
```

### Document Processor
```bash
# Process document to markdown
POST /process
Content-Type: multipart/form-data
file: <document.pdf>
```

### RAG Service (Training Manuals)
```bash
# Query manuals (standard RAG)
POST /query
{
  "question": "How do I handle debt advice?",
  "top_k": 4
}

# Query manuals (agentic RAG - recommended)
POST /agentic-query
{
  "question": "What are the pros and cons of bankruptcy vs DRO?",
  "show_reasoning": true,
  "model": "llama3.2",
  "max_iterations": 3,
  "top_k": 4
}

Response:
{
  "answer": "Detailed answer with source citations...",
  "sources": ["CPAG 5.pdf", "CPAG 3.pdf"],
  "confidence": "HIGH - Answer based on comprehensive manual coverage",
  "iterations_used": 2,
  "reasoning_steps": [
    {
      "step": "analysis",
      "description": "Question complexity analysis",
      "result": {
        "complexity": "complex",
        "reasoning": "Requires comparing multiple debt solutions",
        "suggested_searches": [
          "bankruptcy advantages disadvantages",
          "DRO eligibility consequences",
          "debt relief comparison"
        ]
      }
    },
    {
      "step": "planning",
      "description": "Search strategy",
      "result": {
        "complexity": "complex",
        "iterations": 3,
        "searches": ["bankruptcy advantages...", "DRO eligibility..."]
      }
    },
    {
      "step": "retrieval",
      "description": "Context gathering",
      "result": {
        "chunks_found": 12,
        "sources": ["CPAG 5.pdf", "CPAG 3.pdf"]
      }
    }
  ]
}
```

### Upload Service
```bash
# Generate QR code
POST /generate-qr
Authorization: Bearer <token>
{
  "client_id": "CLIENT001",
  "client_name": "John Smith"
}

# Upload document (automatically indexes to vector store)
POST /uploads/{client_id}
Authorization: Bearer <token>
Content-Type: multipart/form-data
file: <document>

# Query client documents
POST /query-client-documents
Authorization: Bearer <token>
{
  "client_id": "CLIENT001",
  "question": "What debts does this client have?",
  "model": "llama3.2"
}

# Get client document statistics
GET /client-stats/{client_id}
Authorization: Bearer <token>
```

### Client RAG Service
```bash
# Query client-specific documents (standard RAG)
POST /query
{
  "client_id": "CLIENT001",
  "question": "What is the total debt amount?",
  "top_k": 4
}

# Query client documents (agentic RAG - recommended)
POST /agentic-query
{
  "client_id": "CLIENT001",
  "question": "What are all the client's debts and which should be prioritized?",
  "show_reasoning": true,
  "model": "llama3.2",
  "max_iterations": 2,
  "top_k": 4
}

Response:
{
  "answer": "Based on the client's documents, they have...",
  "sources": ["bank-statement.pdf", "creditor-letter.pdf"],
  "confidence": "HIGH - All debt information clearly stated in documents",
  "iterations_used": 2,
  "reasoning_steps": [...]
}

# Ingest document for client (called automatically by upload-service)
POST /ingest
{
  "client_id": "CLIENT001",
  "document_text": "markdown content...",
  "filename": "bank-statement.pdf",
  "metadata": {}
}

# Get client stats
GET /stats/{client_id}

# List all clients with documents
GET /clients
```

## Configuration

### Environment Variables

**Frontend:**
- `NEXT_PUBLIC_NOTES_SERVICE_URL`
- `NEXT_PUBLIC_DOC_PROCESSOR_URL`
- `NEXT_PUBLIC_RAG_SERVICE_URL`
- `NEXT_PUBLIC_UPLOAD_SERVICE_URL`

**Backend Services:**
- `OLLAMA_URL`: Ollama API endpoint
- `LLAMA_PARSE_API_KEY`: LlamaParse API key
- `JWT_SECRET`: Secret for JWT tokens
- `VECTORSTORE_PATH`: Path to ChromaDB storage
- `UPLOAD_DIR`: Path for uploaded files

## GPU Acceleration

### Local (Docker)
Ensure NVIDIA Docker runtime is installed:
```bash
# Test GPU access
docker run --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

### AWS EKS
GPU nodes use `g5.xlarge` instances with NVIDIA A10G GPUs.
The deployment script automatically:
- Creates GPU node group
- Installs NVIDIA device plugin
- Configures Ollama to use GPU

## Troubleshooting

### Ollama Not Responding
```bash
# Check Ollama logs
docker logs rma-ollama

# Restart Ollama
docker restart rma-ollama

# Check models
docker exec rma-ollama ollama list
```

### ChromaDB Connection Issues
```bash
# Check ChromaDB logs
docker logs rma-chromadb

# Verify vector store
curl http://localhost:8005/api/v1/heartbeat
```

### Document Processing Fails
- Verify LLAMA_PARSE_API_KEY is set
- Check Tesseract fallback is working
- Ensure sufficient memory (1GB+ per document)

### Frontend Can't Connect to Services
- Verify all services are running: `docker-compose ps`
- Check service URLs in environment variables
- Ensure no port conflicts

## Development

### Project Structure
```
RMA-Demo/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   │   ├── ClientDocumentSearch.tsx  # NEW: Client doc search
│   │   │   └── ...
│   │   └── lib/             # Utilities
│   └── Dockerfile
├── services/
│   ├── notes-service/       # LLM note conversion
│   ├── doc-processor/       # OCR processing
│   ├── rag-service/         # RAG for manuals
│   ├── client-rag-service/  # NEW: Client-specific document search
│   └── upload-service/      # File upload & auth (now with auto-indexing)
├── k8s/                     # Kubernetes manifests
├── aws-scripts/             # AWS deployment scripts
├── manuals/                 # Training manual PDFs
└── docker-compose.yml
```

### Adding New Features
1. Add backend logic to appropriate service
2. Create/update frontend component
3. Update Docker Compose and K8s manifests
4. Rebuild and redeploy

## Security Considerations

### Production Checklist
- [ ] Change default passwords
- [ ] Set strong JWT_SECRET
- [ ] Enable HTTPS/TLS
- [ ] Configure AWS Security Groups
- [ ] Set up AWS Secrets Manager
- [ ] Enable audit logging
- [ ] Configure backup strategy
- [ ] Set up monitoring/alerting

### Authentication
Current implementation uses simple JWT tokens.
For production:
- Integrate with OAuth2/OIDC
- Add role-based access control
- Implement session management
- Add rate limiting

## Monitoring

### Logs
```bash
# View all logs
docker-compose logs -f

# Specific service
docker-compose logs -f notes-service

# Kubernetes
kubectl logs -f deployment/notes-service -n rma-demo
```

### Metrics
Consider adding:
- Prometheus for metrics
- Grafana for visualization
- CloudWatch for AWS monitoring

## Backup and Recovery

### Local
```bash
# Backup volumes
docker run --rm -v rma-demo_ollama_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/ollama-backup.tar.gz /data
```

### AWS
- EBS snapshots for persistent volumes
- S3 for manual backups
- Velero for Kubernetes backups

## Cost Optimization

### AWS
- Use Spot Instances for non-critical workloads
- Scale GPU nodes to 0 when not in use
- Use S3 Intelligent-Tiering for uploads
- Enable EKS cost allocation tags

## License

Proprietary - RMA Centre Prototype

## Support

For issues or questions, contact your system administrator.

## Changelog

### v1.2.0 (2025-01-XX)
- **OPTIMIZATION:** Consolidated to single shared ChromaDB instance
- **IMPROVEMENT:** Simplified architecture (3 volumes → 1 volume)
- **IMPROVEMENT:** Better resource efficiency and scalability
- All vector storage now in shared ChromaDB with collection-based isolation
- Created automated isolation testing script
- Updated documentation for consolidated architecture

### v1.1.0 (2025-01-XX)
- **NEW:** Client-specific document search with AI
- **NEW:** Automatic vector indexing of uploaded documents
- **NEW:** Natural language queries across client documents
- **NEW:** client-rag-service for per-client knowledge bases
- Enhanced upload-service with automatic RAG integration
- Updated frontend with "Search Client Docs" tab

### v1.0.0 (2025-01-15)
- Initial release
- Notes to CoA feature
- QR code generation
- Ask the Manuals RAG
- Document upload with LLamaParse
- Docker Compose deployment
- AWS EKS deployment scripts

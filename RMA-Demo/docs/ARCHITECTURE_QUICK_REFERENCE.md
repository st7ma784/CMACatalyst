# RMA System - Quick Reference Architecture

## Service Ports Quick Reference

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | React web application |
| Backend Server | 8000 | Main API server |
| Doc Processor | 8101 | PDF/OCR processing |
| RAG Service | 8102 | Manual RAG (deprecated) |
| Upload Service | 8103 | Document upload & management |
| Client RAG | 8104 | Client document search |
| Notes Service | 8100 | Case notes search |
| PostgreSQL | 5432 | Relational database |
| ChromaDB | 8005 | Vector database |
| Ollama | 11434 | LLM service (GPU) |
| Nginx | 80/443 | Reverse proxy |

## Service Communication Matrix

| From → To | Protocol | Purpose |
|-----------|----------|---------|
| Frontend → Backend | HTTP/REST | API calls, auth |
| Frontend → Upload Service | HTTP/REST | File upload |
| Backend → PostgreSQL | TCP/SQL | Data persistence |
| Upload Service → Doc Processor | HTTP/REST | Text extraction |
| Upload Service → Client RAG | HTTP/REST | Document indexing |
| Upload Service → Ollama | HTTP/REST | Smart naming, boundary detection |
| Client RAG → ChromaDB | HTTP/REST | Vector operations |
| Client RAG → Ollama | HTTP/REST | Embeddings, answers |
| Doc Processor → Ollama | HTTP/REST | Vision analysis |
| Notes Service → ChromaDB | HTTP/REST | Vector operations |
| Notes Service → Ollama | HTTP/REST | Embeddings, answers |

## Service Dependency Graph

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Backend   │────►│ PostgreSQL  │
└──────┬──────┘     └─────────────┘
       │
       │
┌──────┴──────┐
│             │
▼             ▼
┌─────────────┐     ┌─────────────┐
│   Upload    │     │    Notes    │
│   Service   │     │   Service   │
└──────┬──────┘     └──────┬──────┘
       │                   │
   ┌───┴───┐           ┌───┴───┐
   ▼       ▼           ▼       ▼
┌──────┐┌──────┐    ┌──────┐┌──────┐
│ Doc  ││Client│    │Client││Ollama│
│Proc. ││ RAG  │    │ RAG  ││      │
└──┬───┘└───┬──┘    └───┬──┘└──────┘
   │        │           │
   ▼        ▼           ▼
┌──────────────────────────┐
│        Ollama            │
│  • llama3.2 (text)      │
│  • llava:7b (vision)    │
│  • nomic-embed-text     │
└──────────────────────────┘
           ▲
           │
           ▼
┌──────────────────────────┐
│       ChromaDB           │
│  • Vector storage        │
│  • Similarity search     │
└──────────────────────────┘
```

## Critical Paths

### 1. Document Upload → Search (Happy Path)

**Time: ~30-60 seconds**

```
Client uploads PDF
    ↓ (1s) File save
Upload Service
    ↓ (5-10s) Boundary detection
Ollama (llama3.2)
    ↓ (2s) Split PDF
Upload Service
    ↓ (5-15s) Text extraction per doc
Doc Processor + Ollama (llava:7b)
    ↓ (3-5s) Name analysis per doc
Ollama (llama3.2)
    ↓ (1s) Rename file
Upload Service
    ↓ (3-10s) Generate embeddings per doc
Client RAG + Ollama (nomic-embed-text)
    ↓ (1s) Store vectors
ChromaDB
    ↓ Ready for search!
```

### 2. Search Query → Answer

**Time: ~2-5 seconds**

```
User enters query
    ↓ (500ms) Generate query embedding
Ollama (nomic-embed-text)
    ↓ (500ms) Similarity search
ChromaDB (vector search)
    ↓ (2-3s) Generate answer with context
Ollama (llama3.2)
    ↓ Display to user
```

### 3. User Login → Dashboard

**Time: <500ms**

```
User credentials
    ↓ (100ms) Verify + generate JWT
Backend + PostgreSQL
    ↓ (200ms) Fetch user data
Backend + PostgreSQL
    ↓ Display dashboard
```

## Data Storage Locations

```
File System Volumes:
├── uploads/                    # Client documents (PDFs)
│   └── {CLIENT_ID}/
│       ├── metadata.json       # Document metadata
│       └── CLIENTID_Type_Date.pdf
│
├── ollama_data/                # LLM models
│   └── models/
│       ├── llama3.2/          (2.0 GB)
│       ├── llava:7b/          (4.7 GB)
│       └── nomic-embed-text/  (274 MB)
│
├── chroma_data/                # Vector embeddings
│   ├── client_RMAXX01/
│   ├── client_RMAXX02/
│   └── notes/
│
└── postgres_data/              # Relational data
    └── (PostgreSQL internals)
```

## Service Startup Dependencies

**Correct Startup Order:**

1. **Independent Services:**
   - PostgreSQL
   - ChromaDB
   - Ollama (with model loading)

2. **Dependent Services (wait for Ollama healthy):**
   - Doc Processor
   - Client RAG Service
   - Notes Service
   - Upload Service

3. **Application Layer:**
   - Backend Server (needs PostgreSQL)
   - Frontend (needs Backend)

**Docker Compose Handles This With:**
```yaml
depends_on:
  ollama:
    condition: service_healthy
  postgres:
    condition: service_started
```

## Resource Allocation

### Development Setup (Minimum)

```
CPU:  8 cores
RAM:  16 GB
GPU:  NVIDIA 8 GB VRAM
Disk: 50 GB SSD
```

### Production Setup (Recommended)

```
CPU:  16+ cores
RAM:  32+ GB
GPU:  NVIDIA 16+ GB VRAM
Disk: 200+ GB SSD
```

## Monitoring Commands

```bash
# Check all service health
docker ps

# View logs for specific service
docker logs rma-backend
docker logs rma-upload-service
docker logs rma-client-rag-service

# Check Ollama models
docker exec rma-ollama ollama list

# Check database
docker exec rma-postgres psql -U postgres -c "\l"

# Check ChromaDB collections
curl http://localhost:8005/api/v1/collections

# Check GPU usage
nvidia-smi
# or
docker exec rma-ollama nvidia-smi
```

## Common Issues & Solutions

| Issue | Check | Solution |
|-------|-------|----------|
| Documents not searchable | ChromaDB connection | Restart client-rag-service |
| Search returns errors | Ollama models | `ollama list`, verify llama3.2 |
| Upload fails | Doc processor logs | Check OCR/Vision processing |
| Slow responses | GPU memory | Check nvidia-smi, restart Ollama |
| Auth fails | Backend + PostgreSQL | Check DB connection |
| Files not saving | Volume mounts | Verify Docker volumes |

## API Testing Examples

```bash
# Test backend health
curl http://localhost:8000/health

# Login
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Upload document (with QR code)
curl -X POST http://localhost:8103/uploads/TESTCLIENT \
  -F "file=@document.pdf"

# Search client documents
curl -X POST http://localhost:8104/query \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "TESTCLIENT",
    "question": "What documents do I have?",
    "model": "llama3.2"
  }'

# Get client stats
curl http://localhost:8104/stats/TESTCLIENT
```

## Service URLs (External Access)

```
Production (via Nginx):
  http://your-domain.com          → Frontend
  http://your-domain.com/api      → Backend
  http://your-domain.com/uploads  → Upload Service

Development (direct):
  http://localhost:3000           → Frontend
  http://localhost:8000           → Backend
  http://localhost:8103           → Upload Service
  http://192.168.5.70:8103        → Upload (LAN access for QR)
```

## Configuration Files

```
/RMA-Demo/
├── docker-compose.yml              # Standard deployment
├── docker-compose.local-parsing.yml # Local-only (no cloud)
├── .env                            # Environment variables
├── nginx.conf                      # Reverse proxy config
│
├── server/
│   ├── config/database.js          # PostgreSQL config
│   └── index.js                    # Backend server
│
├── services/
│   ├── upload-service/
│   │   ├── app.py                  # Upload service
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── doc-processor/
│   │   ├── app_local.py            # Local parser
│   │   ├── local_parser.py         # OCR/Vision
│   │   └── Dockerfile.local
│   │
│   └── client-rag-service/
│       ├── app.py                  # RAG service
│       ├── requirements.txt
│       └── Dockerfile
│
└── database/
    └── init.sql                    # Database schema
```

## Key Environment Variables

```bash
# Backend
DATABASE_URL=postgresql://postgres:password@postgres:5432/rma_db
JWT_SECRET=your-secret-key
SERVER_HOST=192.168.5.70  # For external QR access

# Upload Service
DOC_PROCESSOR_URL=http://doc-processor:8101
CLIENT_RAG_URL=http://client-rag-service:8104
OLLAMA_URL=http://ollama:11434

# Doc Processor (Local)
USE_LOCAL_PARSER=true
VISION_MODEL=llava:7b
TEXT_MODEL=llama3.2

# RAG Services
CHROMADB_HOST=chromadb
CHROMADB_PORT=8000
OLLAMA_URL=http://ollama:11434
```

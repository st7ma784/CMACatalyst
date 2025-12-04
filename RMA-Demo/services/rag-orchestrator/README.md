# RAG System Orchestrator

Monitors the coordinator for required workers and automatically triggers training manual ingestion when the system is ready.

## Purpose

The orchestrator solves the chicken-and-egg problem of RAG system initialization:
- **Without workers**: Can't ingest manuals
- **Without manuals**: RAG queries return empty results
- **Manual coordination**: Tedious and error-prone

## Solution

The orchestrator automatically:
1. Monitors coordinator for worker registration
2. Checks for required components (GPU, ChromaDB, RAG service)
3. Triggers manual ingestion when system is ready
4. Tracks ingestion status to avoid duplicates

## Required Workers

### Minimum Configuration
- **1x GPU Worker**: Provides LLM inference and embedding generation
- **1x ChromaDB Worker**: Provides vector database for document storage
- **Optional CPU Worker**: Can help with processing load

### How It Works

```
Orchestrator Loop (every 60s):
  ├─ Query coordinator /api/admin/workers
  ├─ Check for:
  │   ├─ Tier 1 GPU worker (online)
  │   ├─ Tier 3 ChromaDB (online)
  │   └─ RAG service endpoint
  ├─ If all present and not triggered:
  │   ├─ Call RAG service /ingest-all-manuals
  │   ├─ Wait for completion (up to 5 min)
  │   └─ Mark as complete
  └─ Continue monitoring
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COORDINATOR_URL` | `https://api.rmatool.org.uk` | Coordinator endpoint |
| `MANUALS_PATH` | `/manuals` | Directory containing PDF manuals |
| `CHECK_INTERVAL` | `60` | Seconds between readiness checks |

## Deployment

### Docker Compose

```yaml
services:
  rag-orchestrator:
    build: ./services/rag-orchestrator
    environment:
      - COORDINATOR_URL=https://api.rmatool.org.uk
      - CHECK_INTERVAL=60
    restart: unless-stopped
```

### Standalone Docker

```bash
docker build -t rag-orchestrator ./services/rag-orchestrator

docker run -d \
  --name rag-orchestrator \
  --restart unless-stopped \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e CHECK_INTERVAL=60 \
  rag-orchestrator
```

## Logs

Monitor orchestrator status:

```bash
docker logs -f rag-orchestrator
```

Example output:

```
2025-12-04 10:30:15 - INFO - RAG System Orchestrator initialized
2025-12-04 10:30:15 - INFO - 🎯 Starting RAG System Orchestrator...
2025-12-04 10:30:15 - INFO - Waiting for required workers: GPU, ChromaDB, RAG
2025-12-04 10:30:15 - INFO - System Status:
2025-12-04 10:30:15 - INFO -   GPU Worker: ❌
2025-12-04 10:30:15 - INFO -   ChromaDB: ❌
2025-12-04 10:30:15 - INFO -   RAG Service: ❌
2025-12-04 10:30:15 - INFO - ⏳ Waiting for: GPU worker, ChromaDB, RAG service
...
2025-12-04 10:35:20 - INFO - System Status:
2025-12-04 10:35:20 - INFO -   GPU Worker: ✅
2025-12-04 10:35:20 - INFO -   ChromaDB: ✅
2025-12-04 10:35:20 - INFO -   RAG Service: ✅
2025-12-04 10:35:20 - INFO - 🎉 All required workers are online!
2025-12-04 10:35:20 - INFO - Starting manual ingestion process...
2025-12-04 10:35:20 - INFO - 🚀 Triggering training manual ingestion...
2025-12-04 10:38:45 - INFO - ✅ Manual ingestion completed!
2025-12-04 10:38:45 - INFO - Total files: 12
2025-12-04 10:38:45 - INFO - Successful: 12
2025-12-04 10:38:45 - INFO - Failed: 0
2025-12-04 10:38:45 - INFO - ✅ System initialization complete!
2025-12-04 10:38:45 - INFO - RAG system is ready for queries
```

## Manual Trigger

If you want to manually trigger ingestion:

```bash
# Find RAG service URL from coordinator
COORDINATOR_URL="https://api.rmatool.org.uk"
RAG_URL=$(curl -s $COORDINATOR_URL/api/admin/workers | \
  jq -r '.workers[] | .containers[] | select(.name=="rag-service" or .name=="gpu-worker") | .service_url' | head -1)

# Trigger ingestion
curl -X POST $RAG_URL/ingest-all-manuals
```

## Troubleshooting

### Orchestrator keeps waiting

**Check coordinator has workers:**
```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq '.workers'
```

**Ensure workers are online:**
- GPU worker: Check `docker logs rma-gpu-worker`
- ChromaDB: Check `docker logs rma-chromadb-worker`

### Ingestion fails

**Check RAG service logs:**
```bash
# Find RAG service container
docker ps | grep gpu-worker

# Check logs
docker logs <container-id>
```

**Common issues:**
- No PDF files in `/manuals` directory
- Ollama not running (embedding generation fails)
- ChromaDB not accessible (storage fails)

### Duplicate ingestion

The orchestrator tracks state with `ingestion_triggered` flag. If workers go offline and come back, it will trigger again (desired behavior for reliability).

To prevent duplicate ingestion, the RAG service checks if collection already exists and has content.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Orchestrator                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  1. Poll coordinator every 60s               │  │
│  │  2. Check for required workers                │  │
│  │  3. If ready → Trigger ingestion              │  │
│  │  4. Track completion status                   │  │
│  └───────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────────────────┘
                │
                ├─── Query ───────┐
                │                 ▼
                │         ┌───────────────┐
                │         │  Coordinator  │
                │         │  /api/admin   │
                │         │  /workers     │
                │         └───────────────┘
                │                 │
                │                 ├─ GPU Worker (Tier 1)
                │                 ├─ ChromaDB (Tier 3)
                │                 └─ RAG Service
                │
                └─── Trigger ─────┐
                                  ▼
                          ┌───────────────┐
                          │  RAG Service  │
                          │  /ingest-all  │
                          │  -manuals     │
                          └───────────────┘
                                  │
                                  ├─ Read PDFs from /manuals
                                  ├─ Generate embeddings (via Ollama)
                                  └─ Store in ChromaDB
```

## Integration with Worker Deployment

When you deploy workers:

```bash
# 1. Deploy GPU worker (provides RAG service)
docker run -d --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/gpu-worker:latest

# 2. Deploy ChromaDB worker (provides storage)
docker run -d \
  -v chromadb_data:/chroma/chroma \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/chromadb-worker:latest

# 3. Orchestrator detects both → triggers ingestion automatically!
```

No manual intervention needed! 🎉

## Future Enhancements

- **Health checks**: Monitor ingestion progress in real-time
- **Retry logic**: Automatic retry with exponential backoff
- **Notifications**: Webhook/email when system is ready
- **Web UI**: Dashboard showing worker status and ingestion progress
- **Incremental ingestion**: Detect new manuals and ingest only those

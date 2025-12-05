# Dynamic Service Allocation Architecture

## Overview

Workers declare their capability (GPU/CPU/Storage/Edge), and the coordinator dynamically assigns specific services based on current system gaps. This enables:

- **Automatic gap filling**: Services with no workers get assigned first
- **Multi-tasking**: Workers can run multiple services if there aren't enough workers
- **Specialization**: When there are enough workers, each specializes in one service
- **Flexibility**: Same worker can adapt to different roles as needs change
- **Edge hosting**: Machines with good network can host coordinators and proxies

## 4-Tier Architecture

- **Tier 1 (GPU)**: AI model inference - LLM, Vision OCR, RAG embeddings
- **Tier 2 (CPU)**: Processing tasks - NER, document processing, notes generation
- **Tier 3 (Storage)**: Databases - ChromaDB, Redis, PostgreSQL, MinIO, Neo4j
- **Tier 4 (Edge/Coordination)**: Load balancing, routing, coordination - Reduces reliance on Cloudflare KV

**Why Tier 4 matters:** Machines in server rooms with public IPs can host coordinators, eliminating the need for expensive Cloudflare KV storage. Contributors with good network access become infrastructure providers.

## How It Works

### 1. Worker Registration

```bash
# Worker declares what TYPE of compute it offers
docker run -d --gpus all \
  -e WORKER_TYPE=gpu \  # or cpu, storage, edge, auto
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**What happens:**
1. Worker auto-detects hardware (GPU/CPU/RAM/Storage)
2. Creates Cloudflare Tunnel to expose services
3. Registers with coordinator: "I have GPU capability"
4. Coordinator analyzes service gaps
5. Coordinator responds: "Run these 2 services: llm-inference, vision-ocr"
6. Worker launches assigned services dynamically
7. Worker sends heartbeats every 30s

### 2. Dynamic Service Assignment Algorithm

```python
def assign_services(worker_type, current_coverage):
    # Find all services this worker CAN run
    eligible_services = filter_by_type(worker_type)
    
    # Sort by coverage (fewest workers first) + priority
    sorted_services = sort_by(
        coverage_ascending,  # Biggest gaps first
        priority_ascending   # Critical services first
    )
    
    # Decide how many services to assign
    if enough_workers:
        assign(1)  # Specialize
    elif some_workers:
        assign(2)  # Light multi-tasking
    else:
        assign(3)  # Heavy multi-tasking (we need coverage!)
    
    return assigned_services
```

### 3. Service Catalog

```python
SERVICE_CATALOG = {
    # GPU Services (Tier 1)
    "llm-inference": {
        "tier": 1,
        "requires": "gpu",
        "priority": 1,  # Critical
        "port": 8105
    },
    "vision-ocr": {
        "tier": 1,
        "requires": "gpu",
        "priority": 1,
        "port": 8104
    },
    "rag-embeddings": {
        "tier": 1,
        "requires": "gpu",
        "priority": 2,
        "port": 8102
    },
    
    # CPU Services (Tier 2)
    "ner-extraction": {
        "tier": 2,
        "requires": "cpu",
        "priority": 2,
        "port": 8108
    },
    "document-processing": {
        "tier": 2,
        "requires": "cpu",
        "priority": 2,
        "port": 8103
    },
    "notes-coa": {
        "tier": 2,
        "requires": "cpu",
        "priority": 3,
        "port": 8100
    },
    
    # Storage Services (Tier 3)
    "chromadb": {
        "tier": 3,
        "requires": "storage",
        "priority": 1,  # Critical
        "port": 8000
    },
    "redis": {
        "tier": 3,
        "requires": "storage",
        "priority": 2,
        "port": 6379
    },
    # ... more storage services
    
    # Edge/Coordination Services (Tier 4)
    "coordinator": {
        "tier": 4,
        "requires": "edge",
        "priority": 1,  # Critical - worker registry
        "port": 8080
    },
    "edge-proxy": {
        "tier": 4,
        "requires": "edge",
        "priority": 1,  # Critical - routing layer
        "port": 8787
    },
    "load-balancer": {
        "tier": 4,
        "requires": "edge",
        "priority": 2,
        "port": 8090
    },
}
```

## Example Scenarios

### Scenario 1: First Worker (GPU)

**State before:**
- No workers registered
- All services: 0 coverage

**GPU worker registers:**
```
Coordinator thinks:
  - This is the FIRST GPU worker
  - GPU services have 0 coverage (big gap!)
  - Priority 1 services: llm-inference, vision-ocr
  - Assign both (multi-task since we have no workers)

Assigned: ["llm-inference", "vision-ocr"]
```

**Worker launches:**
- Port 8105: LLM inference (Llama)
- Port 8104: Vision OCR (LLaVA)

### Scenario 2: Second GPU Worker

**State before:**
- 1 GPU worker running: llm-inference, vision-ocr
- RAG service: 0 coverage (gap!)

**Second GPU worker registers:**
```
Coordinator thinks:
  - We have 1 GPU worker already
  - llm-inference: 1 worker ✓
  - vision-ocr: 1 worker ✓
  - rag-embeddings: 0 workers ✗ (GAP!)
  - Assign rag-embeddings (specialized, only 1 service)

Assigned: ["rag-embeddings"]
```

**Worker launches:**
- Port 8102: RAG embeddings

### Scenario 3: Third GPU Worker

**State before:**
- All 3 GPU services covered (1 worker each)

**Third GPU worker registers:**
```
Coordinator thinks:
  - All GPU services have 1 worker
  - llm-inference has most load/traffic (priority 1)
  - Assign llm-inference for redundancy

Assigned: ["llm-inference"]
```

**Result:** Now we have 2 workers doing LLM inference (load balanced!)

### Scenario 4: First CPU Worker

**State before:**
- 3 GPU workers
- 0 CPU workers
- All CPU services: 0 coverage (big gaps!)

**CPU worker registers:**
```
Coordinator thinks:
  - First CPU worker
  - All CPU services need coverage
  - Priority order: ner-extraction, document-processing, notes-coa
  - Assign top 2 services (multi-task)

Assigned: ["ner-extraction", "document-processing"]
```

### Scenario 5: First Storage Worker

**State before:**
- GPU + CPU workers exist
- Storage services: 0 coverage

**Storage worker registers:**
```
Coordinator thinks:
  - First storage worker
  - ChromaDB is critical (priority 1) - needed for RAG!
  - Redis is important (priority 2) - caching
  - Assign both

Assigned: ["chromadb", "redis"]
```

### Scenario 6: First Edge Worker (Server Room Machine)

**State before:**
- No edge workers
- Running on Cloudflare KV (limited quota)
- All other services covered

**Edge worker with public IP registers:**
```
Coordinator detects:
  - Public IP: 203.0.113.45
  - Low latency: 12ms to coordinator
  - High bandwidth available
  - Edge capability confirmed!

Coordinator thinks:
  - This machine can host coordinator service!
  - No edge workers exist yet
  - Coordinator service (priority 1) - worker registry
  - Edge-proxy service (priority 1) - routing layer
  - Assign both

Assigned: ["coordinator", "edge-proxy"]
```

**Result:** 
- Worker launches local coordinator on port 8080
- Worker launches edge proxy on port 8787
- Main coordinator can now delegate to this worker's coordinator
- Cloudflare KV usage drops to zero! ✅

### Scenario 7: Second Edge Worker (Geographic Distribution)

**State before:**
- 1 edge worker in US (hosting coordinator)
- New edge worker in EU with public IP

**Second edge worker registers:**
```
Coordinator thinks:
  - Already have 1 coordinator (redundancy is good!)
  - Edge-proxy needs geographic distribution
  - Assign another coordinator for redundancy + load-balancer

Assigned: ["coordinator", "load-balancer"]
```

**Result:**
- EU users get routed to EU edge worker (lower latency)
- Coordinator has geographic redundancy
- Load balancer distributes traffic across regions

## Deployment Commands

### Universal Worker (Auto-detect)

```bash
# Automatically detects GPU/CPU/Storage and registers accordingly
docker run -d --name rma-worker \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Explicit GPU Worker

```bash
docker run -d --name rma-gpu-worker \
  --gpus all \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=gpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Explicit CPU Worker

```bash
docker run -d --name rma-cpu-worker \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=cpu \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Explicit Storage Worker

```bash
docker run -d --name rma-storage-worker \
  -v ./chroma-data:/chroma/chroma \
  -v ./redis-data:/data \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=storage \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

### Explicit Edge Worker (Server Room)

```bash
# For machines with public IP or low-latency network access
docker run -d --name rma-edge-worker \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=edge \
  -p 8080:8080 \
  -p 8787:8787 \
  -p 8090:8090 \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**Note:** Edge workers should expose ports so they can serve as public endpoints!

## Monitoring Service Gaps

```bash
# Check which services need more workers
curl https://api.rmatool.org.uk/api/admin/gaps

# Response:
{
  "gaps": [
    {
      "service": "chromadb",
      "required_type": "storage",
      "priority": 1,
      "current_workers": 0,
      "status": "critical",  # No workers!
      "port": 8000
    },
    {
      "service": "llm-inference",
      "required_type": "gpu",
      "priority": 1,
      "current_workers": 1,
      "status": "warning",  # Only 1 worker (no redundancy)
      "port": 8105
    },
    {
      "service": "vision-ocr",
      "required_type": "gpu",
      "priority": 1,
      "current_workers": 2,
      "status": "ok",  # Good coverage
      "port": 8104
    }
  ],
  "critical_gaps": [
    { "service": "chromadb", ... }
  ],
  "summary": {
    "total_services": 11,
    "covered": 8,
    "needs_attention": 3
  }
}
```

## Benefits

### 1. Self-Healing
- If a worker crashes, gaps appear
- Next worker to register fills those gaps automatically
- No manual intervention needed

### 2. Efficient Resource Use
- Workers multi-task when there are few workers
- Workers specialize when there are enough workers
- Automatically balances between efficiency and coverage

### 3. Easy Contribution
Contributors just run:
```bash
docker run -d ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

No need to know which services are needed - the coordinator figures it out!

### 4. Transparent
- `/api/admin/gaps` shows exactly what's needed
- Frontend can display "We need 2 more GPU workers" messages
- Contributors can see their impact immediately

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Coordinator (FastAPI)                      │
│  - Service catalog (11 services)                            │
│  - Worker registry (in-memory)                              │
│  - Gap analysis algorithm                                   │
│  - Service assignment logic                                 │
└─────────────────────────────────────────────────────────────┘
                            ↕
              Registration & Heartbeats
                            ↕
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ GPU Worker 1 │ GPU Worker 2 │ CPU Worker 1 │Storage Worker│
├──────────────┼──────────────┼──────────────┼──────────────┤
│ llm-inference│rag-embeddings│ ner-extract  │  chromadb    │
│ vision-ocr   │              │ doc-process  │  redis       │
└──────────────┴──────────────┴──────────────┴──────────────┘
     ↓              ↓              ↓               ↓
  Services      Services        Services       Services
 (dynamic)     (dynamic)       (dynamic)      (dynamic)
```

## Next Steps

1. **Test coordinator service assignment:**
   ```bash
   curl -X POST https://api.rmatool.org.uk/api/worker/register \
     -H "Content-Type: application/json" \
     -d '{
       "worker_id": "test-gpu-1",
       "tunnel_url": "https://test.trycloudflare.com",
       "capabilities": {"worker_type": "gpu", "has_gpu": true}
     }'
   ```

2. **Build universal worker container:**
   ```bash
   cd RMA-Demo/worker-containers/universal-worker
   docker build -t ghcr.io/st7ma784/cmacatalyst/universal-worker:latest .
   ```

3. **Deploy and watch automatic service allocation:**
   ```bash
   docker run -d --gpus all universal-worker
   # Check logs to see which services were assigned
   docker logs -f <container>
   ```

4. **Monitor gaps:**
   ```bash
   watch -n 5 'curl -s https://api.rmatool.org.uk/api/admin/gaps | jq .summary'
   ```

This architecture enables true distributed compute with automatic service placement! 🎉

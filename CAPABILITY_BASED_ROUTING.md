# Capability-Based Worker Architecture

## Overview

The RMA distributed system now uses a **capability-based routing model** instead of rigid tier assignments. This allows workers to be more flexible and efficient in handling requests.

## Core Principles

### 1. **Tier Hierarchy with Downward Flexibility**

```
Tier 1 (GPU Workers)
  ↓ Can handle: GPU tasks + CPU tasks + Processing tasks
  
Tier 2 (CPU Workers)
  ↓ Can handle: CPU tasks + Processing tasks
  
Tier 3 (Storage Workers)
  ↓ Can handle: Storage + Persistence + Caching
```

**Key Rule**: Higher-tier workers can accept lower-tier tasks, but NOT vice versa.

### 2. **Service Manifest Registration**

Workers register with a list of services they can provide:

**GPU Worker Services:**
- `rag` - RAG query processing
- `vllm` - LLM inference
- `embeddings` - Vector embedding generation
- `ocr` - Optical character recognition
- `vision` - Image understanding
- `gpu-worker` - Generic GPU compute

**CPU Worker Services:**
- `processing` - General computation
- `cpu-worker` - Generic CPU compute

**Storage Worker Services:**
- `chromadb` - Vector database
- `redis` - Cache & sessions
- `postgres` - Relational database
- `minio` - Object storage (S3-compatible)
- `neo4j` - Graph database

### 3. **Smart Routing**

The coordinator routes requests based on:
1. **Service availability** - Find workers providing the requested service
2. **Tier preference** - Prefer higher-tier workers (GPU > CPU > Storage)
3. **Health status** - Only route to healthy workers
4. **Load balancing** - Distribute across available workers

## Example Scenarios

### Scenario 1: RAG Query with Multiple Workers

**System State:**
- 2x GPU workers (online)
- 3x CPU workers (online)
- 1x Storage worker with ChromaDB (online)

**Request:** `POST /api/rag/query`

**Routing Decision:**
1. Look for workers with `rag` service → Found 2x GPU workers
2. Sort by tier (both are Tier 1) → Pick first
3. Route to GPU worker's tunnel URL

**Result:** ✅ Request handled by GPU worker

---

### Scenario 2: RAG Query with No GPU Workers

**System State:**
- 0x GPU workers (offline)
- 3x CPU workers (online)
- 1x Storage worker with ChromaDB (online)

**Request:** `POST /api/rag/query`

**Routing Decision:**
1. Look for workers with `rag` service → None found
2. Return 503 error with available services list

**Result:** ❌ Service unavailable (RAG requires GPU)

---

### Scenario 3: ChromaDB Access

**System State:**
- 1x GPU worker (online, also has ChromaDB running)
- 1x Storage worker with ChromaDB (online)

**Request:** `POST /api/chromadb/add`

**Routing Decision:**
1. Look for workers with `chromadb` service → Found 2 workers
2. Sort by tier: GPU (1) < Storage (3)
3. Route to GPU worker (preferred)

**Result:** ✅ Request handled by GPU worker's ChromaDB instance

**Why?** GPU workers have faster hardware and can handle storage tasks efficiently.

---

### Scenario 4: Multiple Storage Services

**System State:**
- 1x Storage worker with: ChromaDB + Redis + PostgreSQL

**Requests:**
- `GET /api/chromadb/stats` → Routes to storage worker (ChromaDB service)
- `GET /api/redis/get/key` → Routes to storage worker (Redis service)
- `POST /api/postgres/query` → Routes to storage worker (PostgreSQL service)

**Result:** ✅ Single worker handles all storage requests

**Why?** Storage workers can provide multiple storage services simultaneously.

## Worker Registration Format

### GPU Worker Registration

```json
{
  "capabilities": {
    "cpu_cores": 16,
    "ram": "64.0GB",
    "has_gpu": true,
    "gpu_type": "NVIDIA RTX 4090",
    "gpu_memory": "24GB",
    "worker_type": "gpu"
  },
  "containers": [
    {
      "name": "rag",
      "service_url": "https://tunnel-url.trycloudflare.com",
      "port": 8102,
      "capabilities": ["llm", "embeddings", "rag"],
      "health_endpoint": "/health"
    },
    {
      "name": "vllm",
      "service_url": "https://tunnel-url.trycloudflare.com",
      "port": 8102,
      "capabilities": ["inference", "llm"]
    },
    {
      "name": "embeddings",
      "service_url": "https://tunnel-url.trycloudflare.com",
      "port": 8102
    }
  ],
  "tunnel_url": "https://tunnel-url.trycloudflare.com"
}
```

### Storage Worker Registration

```json
{
  "capabilities": {
    "cpu_cores": 4,
    "ram_gb": 8,
    "has_gpu": false,
    "has_storage": true,
    "storage_type": "multi_service",
    "storage_services": ["chromadb", "redis", "postgres"],
    "worker_type": "storage"
  },
  "containers": [
    {
      "name": "chromadb",
      "service_url": "https://storage-tunnel.trycloudflare.com",
      "port": 8000,
      "capabilities": ["vector_database", "embeddings_storage"],
      "health_endpoint": "/api/v1/heartbeat"
    },
    {
      "name": "redis",
      "service_url": "http://10.0.0.5:6379",
      "port": 6379,
      "capabilities": ["cache", "session_storage", "task_queue"]
    },
    {
      "name": "postgres",
      "service_url": "postgresql://10.0.0.5:5432",
      "port": 5432,
      "capabilities": ["relational_database", "sql"]
    }
  ]
}
```

## Coordinator Routing Logic

```javascript
// 1. Extract service name from request path
const serviceName = extractServiceName(request.url);
// Example: /api/rag/query → "rag"

// 2. Find workers providing this service
const workers = await getWorkersForService(serviceName);
// Returns all workers with matching service in their manifest

// 3. Filter for healthy workers
const healthyWorkers = workers.filter(w => 
  w.status === 'online' && 
  (Date.now() - w.last_heartbeat) < 90000
);

// 4. Sort by tier (ascending: GPU=1, CPU=2, Storage=3)
healthyWorkers.sort((a, b) => a.tier - b.tier);

// 5. Select best worker (lowest tier number = highest capability)
const targetWorker = healthyWorkers[0];

// 6. Extract service-specific URL
const serviceUrl = targetWorker.services
  .find(s => s.name === serviceName)
  ?.service_url || targetWorker.tunnel_url;

// 7. Proxy request
return fetch(`${serviceUrl}${request.path}`);
```

## Benefits

### 1. **Resource Efficiency**
- GPU workers can handle CPU tasks when idle
- No need for separate workers for each service
- Better hardware utilization

### 2. **Fault Tolerance**
- If GPU worker fails, system degrades gracefully
- Storage workers can run multiple databases
- Automatic failover to available workers

### 3. **Scalability**
- Add more GPU workers for compute capacity
- Add more storage workers for persistence capacity
- Mix and match based on workload

### 4. **Flexibility**
- Workers can provide multiple services
- Easy to add new service types
- No rigid tier constraints

### 5. **Cost Optimization**
- High-end GPU workers handle multiple roles
- Don't need dedicated workers for each service
- Pay for hardware, get multiple capabilities

## Migration from Old System

### Old System (Rigid)
```
Request → Check tier → Route to tier-specific worker
Problem: GPU worker sits idle when only CPU work available
```

### New System (Flexible)
```
Request → Check service → Find capable workers → Prefer higher-tier → Route
Benefit: GPU worker handles CPU work when available
```

### Breaking Changes

**None!** The new system is backward compatible:
- Workers without service manifest still work (uses tunnel_url)
- Old-style tier checks still function
- Graceful degradation for legacy workers

## Configuration

### Enable Multiple Storage Services

```bash
docker run -d \
  --name storage-worker \
  -v chromadb_data:/chroma/chroma \
  -v redis_data:/data/redis \
  -v postgres_data:/var/lib/postgresql/data \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e ENABLE_CHROMADB=true \
  -e REDIS_PORT=6379 \
  -e POSTGRES_PORT=5432 \
  ghcr.io/st7ma784/cmacatalyst/storage-worker:latest
```

### GPU Worker with Full Service Manifest

GPU workers automatically register all their capabilities:
- RAG queries
- LLM inference (vLLM)
- Embedding generation
- OCR processing
- Vision understanding

No configuration needed - it's all automatic!

## Monitoring

### Check Worker Services

```bash
curl https://api.rmatool.org.uk/api/admin/workers | jq '.workers[] | {
  id: .worker_id,
  tier: .tier,
  services: [.services[].name]
}'
```

### Check Service Availability

```bash
curl https://api.rmatool.org.uk/api/admin/services
```

Returns list of all available services across all workers.

### Test Service Routing

```bash
# Test RAG service
curl -X POST https://api.rmatool.org.uk/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question": "test", "include_sources": true}'

# Test ChromaDB service
curl https://api.rmatool.org.uk/api/chromadb/api/v1/heartbeat
```

## Future Enhancements

1. **Load-based routing**: Route to least-loaded worker instead of first available
2. **Affinity routing**: Sticky sessions for stateful services
3. **Geographic routing**: Route to nearest worker based on latency
4. **Cost-based routing**: Prefer cheaper workers when performance doesn't matter
5. **A/B testing**: Route percentage of traffic to new worker versions

## Summary

The new capability-based system makes RMA more efficient and flexible:
- ✅ GPU workers can handle CPU tasks (no wasted resources)
- ✅ Storage workers can run multiple databases (simplified deployment)
- ✅ Smart routing prefers more capable workers
- ✅ Graceful degradation when workers fail
- ✅ Easy to scale by adding more workers
- ✅ Backward compatible with existing deployments

**Result:** Better resource utilization, simpler architecture, more reliable service.

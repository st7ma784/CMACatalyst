# Hybrid Coordinator Architecture

## Problem Analysis

Even with optimizations, Cloudflare KV free tier limits remain a constraint:

**Current bottleneck:**
- Registration: 2 writes per worker (manifest + service index) = Still using KV
- Heartbeats: Even with 5-min writes, 2 workers × 288 writes/day = 576 writes
- Service discovery: Cached reads, but cold starts trigger KV reads
- **Issue:** At idle with just heartbeats, we're using 576/1,000 daily write limit (58%)

**Root cause:** Workers are ephemeral but need persistent state. KV is the only persistent storage in Cloudflare Workers free tier.

## Proposed Solution: Hybrid Architecture

Split responsibilities between two coordinators:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Internet Traffic                              │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ├─────────────────┬────────────────────────────────────┐
               │                 │                                    │
      ┌────────▼────────┐  ┌─────▼──────┐                  ┌────────▼────────┐
      │  Cloudflare     │  │            │                  │  Self-Hosted    │
      │  Edge Worker    │  │   Users    │                  │  Coordinator    │
      │  (FREE TIER)    │  │            │                  │  (Docker)       │
      │                 │  └────────────┘                  │                 │
      │  • Proxy only   │                                  │  • Worker state │
      │  • NO KV writes │                                  │  • Heartbeats   │
      │  • Routes to    │◄─────────Worker List─────────────│  • In-memory    │
      │    self-hosted  │                                  │  • SQLite/Redis │
      └─────────────────┘                                  └─────────────────┘
                                                                    │
                                                          ┌─────────┴──────────┐
                                                          │                    │
                                                   ┌──────▼──────┐      ┌─────▼──────┐
                                                   │ GPU Worker  │      │ CPU Worker │
                                                   │ • Heartbeat │      │ • Heartbeat│
                                                   │   to local  │      │   to local │
                                                   │ • Service   │      │ • Service  │
                                                   └─────────────┘      └────────────┘
```

## Architecture Components

### 1. Cloudflare Edge Worker (Stateless Proxy)

**Role:** High-performance global routing proxy  
**Cost:** FREE (within 100k requests/day)  
**KV Usage:** ZERO ❌

**Responsibilities:**
- Accept incoming service requests
- Forward to self-hosted coordinator
- Cache worker list in memory (5-min TTL)
- Provide CDN-level DDoS protection
- Handle CORS and authentication

**Why it works:**
- No persistent state = No KV writes
- Pure proxy function
- Cloudflare's edge network for global performance
- Authentication/rate limiting can use Cloudflare Workers features

```javascript
// Simplified edge worker (NO KV!)
const COORDINATOR_URL = "https://your-domain.com:8080"; // Self-hosted
let cachedWorkerList = null;
let cacheTimestamp = 0;

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    
    // Admin/dashboard requests - proxy to coordinator
    if (path.startsWith('/api/admin') || path.startsWith('/api/worker')) {
      return fetch(`${COORDINATOR_URL}${path}`, request);
    }
    
    // Service requests - smart routing with cached list
    if (path.startsWith('/api/service/')) {
      // Refresh cache every 5 minutes
      if (!cachedWorkerList || Date.now() - cacheTimestamp > 300000) {
        const response = await fetch(`${COORDINATOR_URL}/api/coordinator/workers`);
        cachedWorkerList = await response.json();
        cacheTimestamp = Date.now();
      }
      
      // Select best worker from cached list
      const worker = selectBestWorker(cachedWorkerList, path);
      return fetch(worker.service_url + path, request);
    }
    
    return new Response('Not found', { status: 404 });
  }
};
```

### 2. Self-Hosted Coordinator (Stateful Service)

**Role:** Worker registry and state management  
**Cost:** $0 (runs on same infrastructure as workers)  
**Storage:** In-memory + SQLite/Redis backup

**Responsibilities:**
- Worker registration and heartbeat tracking
- Real-time worker state (in-memory)
- Service discovery API
- Health monitoring
- Job broadcasting
- Optional SQLite persistence (for restarts)

**Why it works:**
- No KV limits - unlimited reads/writes
- Co-located with workers (low latency)
- Can use WebSockets for real-time updates
- Scales with your infrastructure

```python
# Self-hosted coordinator (Python FastAPI example)
from fastapi import FastAPI
from datetime import datetime, timedelta
import asyncio

app = FastAPI()

# In-memory worker registry (survives across requests)
workers = {}  # worker_id -> worker_data
services = {}  # service_name -> [worker_ids]

@app.post("/api/worker/register")
async def register_worker(data: dict):
    worker_id = data['worker_id']
    workers[worker_id] = {
        **data,
        'last_heartbeat': datetime.now(),
        'status': 'online'
    }
    
    # Index by services
    for service in data.get('services', []):
        service_name = service['name']
        if service_name not in services:
            services[service_name] = []
        if worker_id not in services[service_name]:
            services[service_name].append(worker_id)
    
    return {"status": "registered", "worker_id": worker_id}

@app.post("/api/worker/heartbeat")
async def heartbeat(data: dict):
    worker_id = data['worker_id']
    if worker_id in workers:
        workers[worker_id].update({
            'last_heartbeat': datetime.now(),
            'current_load': data.get('current_load'),
            'loaded_models': data.get('loaded_models', []),
            'active_requests': data.get('active_requests', 0),
            'gpu_utilization': data.get('gpu_utilization', 0)
        })
    return {"status": "ok"}

@app.get("/api/coordinator/workers")
async def get_workers():
    # Return list for edge worker to cache
    now = datetime.now()
    healthy = [
        w for w in workers.values()
        if (now - w['last_heartbeat']).seconds < 90
    ]
    return {"workers": healthy, "count": len(healthy)}

# Background task to cleanup stale workers
@app.on_event("startup")
async def cleanup_stale_workers():
    while True:
        await asyncio.sleep(60)  # Every minute
        now = datetime.now()
        stale = [
            wid for wid, w in workers.items()
            if (now - w['last_heartbeat']).seconds > 120
        ]
        for wid in stale:
            workers.pop(wid, None)
            # Remove from service index
            for service_list in services.values():
                if wid in service_list:
                    service_list.remove(wid)
```

### 3. Workers (GPU/CPU/Storage)

**Change:** Point to self-hosted coordinator instead of Cloudflare

```bash
# Before
docker run -e COORDINATOR_URL="https://api.rmatool.org.uk" ...

# After
docker run -e COORDINATOR_URL="https://your-domain.com:8080" ...
```

## Detailed Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          User's Browser                               │
│                    https://rmatool.org.uk                            │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         │ POST /api/service/rag/query
                         │
        ┌────────────────▼─────────────────────────────────────┐
        │       Cloudflare Worker (Edge Proxy)                 │
        │       Deployed: api.rmatool.org.uk                   │
        │                                                       │
        │  ┌─────────────────────────────────────────────┐    │
        │  │  NO KV STORAGE - STATELESS PROXY ONLY       │    │
        │  │                                              │    │
        │  │  const COORDINATOR = "home.rmatool.org.uk"  │    │
        │  │                                              │    │
        │  │  1. Cache worker list (5-min TTL)           │    │
        │  │  2. Select best worker                      │    │
        │  │  3. Proxy request                           │    │
        │  │  4. Return response                         │    │
        │  └─────────────────────────────────────────────┘    │
        │                                                       │
        │  KV Operations: ZERO ✅                              │
        │  Cost: FREE (within 100k req/day)                   │
        └───────────────┬───────────────────────────────────┬─┘
                        │                                   │
                        │ (Every 5 min)                     │ (Service request)
                        │ GET /api/coordinator/workers      │ Direct proxy
                        │                                   │
         ┌──────────────▼──────────────────────────┐        │
         │  Self-Hosted Coordinator                │        │
         │  Docker Container on your server        │        │
         │  Port: 8080 (Cloudflare Tunnel)        │        │
         │                                          │        │
         │  ┌────────────────────────────────────┐ │        │
         │  │   In-Memory Worker Registry        │ │        │
         │  │                                    │ │        │
         │  │   workers = {                      │ │        │
         │  │     "gpu-1": { ... },             │ │        │
         │  │     "gpu-2": { ... }              │ │        │
         │  │   }                                │ │        │
         │  │                                    │ │        │
         │  │   services = {                     │ │        │
         │  │     "rag": ["gpu-1", "gpu-2"],    │ │        │
         │  │     "ocr": ["gpu-1"]              │ │        │
         │  │   }                                │ │        │
         │  └────────────────────────────────────┘ │        │
         │                                          │        │
         │  Optional: SQLite backup for restarts   │        │
         │  Storage: Unlimited (local disk)        │        │
         │  Cost: $0 (same server as workers)      │        │
         └─────────┬────────────────────────────────┘        │
                   │                                          │
                   │ Heartbeat every 30s                      │
                   │ (No storage limits!)                     │
                   │                                          │
     ┌─────────────┴─────────────┬──────────────┐            │
     │                           │              │            │
┌────▼─────┐              ┌─────▼──────┐  ┌────▼─────┐      │
│ GPU      │              │ GPU        │  │ CPU      │      │
│ Worker 1 │              │ Worker 2   │  │ Worker   │      │
│          │              │            │  │          │      │
│ OCR      │              │ vLLM       │  │ Backup   │      │
│ Specialist│◄────────────┼────────────┼──┼──────────┼──────┘
└──────────┘              └────────────┘  └──────────┘
                               │
                               │ (Direct service access)
                               │ No coordinator in path
                               │
                        ┌──────▼────────┐
                        │ Storage       │
                        │ Worker        │
                        │ (ChromaDB)    │
                        └───────────────┘
```

## Traffic Flow Examples

### Example 1: Service Request (RAG Query)

```
User → Cloudflare Edge Worker → GPU Worker
  1. User: POST https://api.rmatool.org.uk/api/service/rag/query
  2. Edge Worker: Check cache for worker list (cache hit - no coordinator call)
  3. Edge Worker: selectBestWorker() from cached list
  4. Edge Worker: Proxy to https://gpu-worker-1-tunnel.trycloudflare.com/api/rag/query
  5. GPU Worker: Process and return result
  6. Edge Worker: Return to user

KV Operations: 0
Coordinator Calls: 0 (cache hit)
Latency: ~100ms (edge + worker)
```

### Example 2: Cache Miss (First Request or Cache Expired)

```
User → Cloudflare Edge Worker → Self-Hosted Coordinator → GPU Worker
  1. User: POST https://api.rmatool.org.uk/api/service/rag/query
  2. Edge Worker: Cache expired (>5 min old)
  3. Edge Worker: GET https://home.rmatool.org.uk:8080/api/coordinator/workers
  4. Coordinator: Return in-memory worker list (instant)
  5. Edge Worker: Cache workers, select best
  6. Edge Worker: Proxy to GPU worker
  7. GPU Worker: Process and return

KV Operations: 0
Coordinator Calls: 1 (per 5 minutes, not per request)
Latency: ~110ms (edge + coordinator lookup + worker)
```

### Example 3: Worker Heartbeat

```
GPU Worker → Self-Hosted Coordinator
  1. Worker: POST https://home.rmatool.org.uk:8080/api/worker/heartbeat
  2. Coordinator: Update in-memory state (workers[id].last_heartbeat = now)
  3. Coordinator: Return ok

KV Operations: 0 ✅
Storage: In-memory dict update (instant)
Optional: Periodic SQLite backup (every 5 min)
```

### Example 4: Worker Registration

```
GPU Worker → Self-Hosted Coordinator
  1. Worker: POST https://home.rmatool.org.uk:8080/api/worker/register
  2. Coordinator: workers[worker_id] = {...}
  3. Coordinator: services['rag'].append(worker_id)
  4. Coordinator: Optional SQLite backup
  5. Coordinator: Return registered

KV Operations: 0 ✅
Storage: In-memory + optional disk backup
```

## Cost Analysis

### Current Architecture (Cloudflare KV)

| Component | Cost | Limits |
|-----------|------|--------|
| Cloudflare Worker | FREE | 100k requests/day |
| Cloudflare KV | FREE | 1,000 writes/day, 100k reads/day |
| **Bottleneck** | **KV writes** | **576/1,000 at idle (58%)** |
| Scaling limit | Can't add >15 workers without hitting limit |

### Hybrid Architecture (Proposed)

| Component | Cost | Limits |
|-----------|------|--------|
| Cloudflare Worker (proxy only) | FREE | 100k requests/day ✅ |
| Cloudflare KV | REMOVED | N/A |
| Self-Hosted Coordinator | $0 | Same server as workers |
| **Bottleneck** | **None** | **Unlimited workers** |
| Scaling limit | Only limited by server resources |

### Detailed Cost Comparison

**Scenario: 5 GPU Workers, 1,000 requests/day**

| Metric | Current (KV) | Hybrid |
|--------|--------------|---------|
| Cloudflare KV Writes | 1,440/day (over limit!) | 0 ✅ |
| Cloudflare KV Reads | ~2,000/day | 0 ✅ |
| Edge Worker Requests | 1,000/day | 1,000/day |
| Coordinator Memory | N/A | ~10MB |
| Additional Servers | 0 | 0 (reuse existing) |
| **Total Cost** | $5/month (paid KV) | $0 ✅ |

## Implementation Plan

### Phase 1: Deploy Self-Hosted Coordinator

```bash
# 1. Create coordinator container
cd RMA-Demo/services
mkdir local-coordinator
cd local-coordinator

# 2. Deploy with Docker Compose
docker-compose up -d coordinator

# 3. Expose via Cloudflare Tunnel
cloudflared tunnel route dns <tunnel-id> home.rmatool.org.uk
```

**File: `RMA-Demo/services/local-coordinator/docker-compose.yml`**
```yaml
version: '3.8'

services:
  coordinator:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data  # SQLite persistence
    environment:
      - ENVIRONMENT=production
      - ENABLE_CORS=true
      - ALLOWED_ORIGINS=https://rmatool.org.uk,https://api.rmatool.org.uk
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Phase 2: Update Edge Worker to Proxy Mode

```javascript
// RMA-Demo/cloudflare-worker-coordinator/worker.js
const COORDINATOR_URL = "https://home.rmatool.org.uk:8080";

export default {
  async fetch(request, env, ctx) {
    // Remove all KV operations
    // Cache worker list in memory
    // Forward all admin/worker operations to coordinator
    // Smart routing for service requests
  }
};
```

### Phase 3: Update Workers to Use Local Coordinator

```bash
# Update docker-compose for all workers
docker-compose down
# Edit docker-compose.yml
# COORDINATOR_URL=https://home.rmatool.org.uk:8080
docker-compose up -d
```

### Phase 4: Migrate Existing Data (if any)

```bash
# Export from KV
curl https://api.rmatool.org.uk/api/admin/workers > workers-backup.json

# Import to local coordinator
curl -X POST https://home.rmatool.org.uk:8080/api/admin/import \
  -H "Content-Type: application/json" \
  -d @workers-backup.json
```

## Self-Hosted Coordinator Options

### Option A: Python FastAPI (Recommended)

**Pros:**
- Simple, fast, well-documented
- Async/await for real-time updates
- SQLAlchemy for optional persistence
- Built-in OpenAPI docs

**Resources:**
- Memory: ~50MB
- CPU: <5% (mostly idle)
- Disk: <100MB

```python
# app.py
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="RMA Coordinator")

# In-memory registry
workers = {}

@app.post("/api/worker/register")
async def register(data: dict):
    workers[data['worker_id']] = data
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

### Option B: Node.js Express

**Pros:**
- Same language as edge worker
- Easy to maintain
- Good performance

**Resources:**
- Memory: ~80MB
- CPU: <10%
- Disk: <150MB

```javascript
// server.js
const express = require('express');
const app = express();

const workers = new Map();

app.post('/api/worker/register', (req, res) => {
  workers.set(req.body.worker_id, req.body);
  res.json({ status: 'ok' });
});

app.listen(8080);
```

### Option C: Go (Best Performance)

**Pros:**
- Minimal resource usage
- Extremely fast
- Single binary deployment

**Resources:**
- Memory: ~20MB
- CPU: <2%
- Disk: ~10MB binary

```go
// main.go
package main

import (
    "github.com/gin-gonic/gin"
    "sync"
)

var (
    workers = make(map[string]interface{})
    mu      sync.RWMutex
)

func main() {
    r := gin.Default()
    
    r.POST("/api/worker/register", func(c *gin.Context) {
        var data map[string]interface{}
        c.BindJSON(&data)
        mu.Lock()
        workers[data["worker_id"].(string)] = data
        mu.Unlock()
        c.JSON(200, gin.H{"status": "ok"})
    })
    
    r.Run(":8080")
}
```

## Benefits of Hybrid Architecture

### ✅ Unlimited Scaling

- **No KV limits** - In-memory storage has no write/read limits
- **Add unlimited workers** - Only limited by server resources
- **High-frequency updates** - Heartbeats every second if needed
- **Real-time monitoring** - WebSocket support for live dashboards

### ✅ Zero Additional Cost

- **Reuse existing infrastructure** - Runs on same server as workers
- **No paid Cloudflare plans** - Stay on free tier forever
- **Minimal resources** - Coordinator uses <50MB RAM
- **Optional persistence** - SQLite backup uses <100MB disk

### ✅ Better Performance

- **Local latency** - Workers talk to local coordinator (<1ms)
- **Edge still fast** - Cloudflare edge for user-facing requests
- **Reduced bottlenecks** - No KV rate limits
- **WebSocket support** - Real-time worker updates

### ✅ Enhanced Features

- **Rich queries** - SQL queries on worker state
- **Historical data** - Track worker metrics over time
- **Custom logic** - Python/Node/Go for complex routing
- **Background jobs** - Cleanup, monitoring, alerts

### ✅ Operational Improvements

- **Direct access** - SSH to coordinator for debugging
- **Easy monitoring** - Standard tools (Prometheus, Grafana)
- **Logs to disk** - Not limited by Cloudflare logs
- **Database backups** - Standard SQLite/Redis backups

## Migration Risk Assessment

### Low Risk ✅

- **Edge worker stays** - Same domain, same routes
- **Gradual migration** - Can run both coordinators simultaneously
- **Rollback easy** - Just point workers back to Cloudflare
- **No user impact** - Users still hit api.rmatool.org.uk

### Potential Issues

1. **Single point of failure**
   - **Solution:** Run coordinator container with restart policy
   - **Mitigation:** Cloudflare edge caches worker list for 5 min
   - **Impact:** If coordinator down, edge serves cached workers

2. **Network latency**
   - **Solution:** Co-locate coordinator with workers (same network)
   - **Impact:** <1ms latency for heartbeats
   - **Edge impact:** None (users still hit Cloudflare edge)

3. **Persistence needed**
   - **Solution:** Optional SQLite backup every 5 minutes
   - **Impact:** Worker re-registration takes <5 seconds after restart

## Monitoring & Observability

### Coordinator Metrics

```python
# Add to FastAPI coordinator
from prometheus_client import Counter, Gauge, generate_latest

heartbeat_counter = Counter('coordinator_heartbeats_total', 'Total heartbeats')
worker_gauge = Gauge('coordinator_workers_active', 'Active workers')

@app.get("/metrics")
async def metrics():
    worker_gauge.set(len([w for w in workers.values() if is_healthy(w)]))
    return Response(generate_latest(), media_type="text/plain")
```

### Dashboard

```bash
# Grafana + Prometheus
docker-compose up -d grafana prometheus

# View at http://home.rmatool.org.uk:3000
# Metrics:
# - Active workers
# - Heartbeats per second  
# - Service request rate
# - Worker load distribution
```

## Recommendation

**Implement the hybrid architecture:**

1. ✅ **Zero KV usage** - Eliminates all Cloudflare limits
2. ✅ **Zero additional cost** - Uses existing infrastructure
3. ✅ **Better performance** - Local coordinator, edge proxy
4. ✅ **Unlimited scaling** - Add as many workers as needed
5. ✅ **Easy rollback** - Can revert to KV if needed

**Implementation effort:** ~4 hours
- 1 hour: Build coordinator container
- 1 hour: Update edge worker to proxy mode
- 1 hour: Update worker configurations
- 1 hour: Testing and validation

**Ongoing maintenance:** Minimal
- Coordinator restarts automatically
- No KV billing to monitor
- Standard Docker operations

## Next Steps

1. **Review architecture** - Confirm this approach fits your needs
2. **Choose coordinator language** - Python FastAPI (recommended)
3. **Deploy coordinator** - Docker container on existing server
4. **Update edge worker** - Remove KV, add proxy logic
5. **Migrate workers** - Point to local coordinator
6. **Monitor** - Verify zero KV usage

Would you like me to:
- [ ] Implement the Python FastAPI coordinator
- [ ] Update edge worker to proxy mode
- [ ] Create deployment scripts
- [ ] Set up monitoring dashboard

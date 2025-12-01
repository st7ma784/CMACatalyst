# RMA Distributed Compute Architecture
## Democratized Worker Pool Model

---

## Overview

Transform RMA from a centralized microservices architecture to a **distributed worker pool** where:
- Minimal coordinator runs on free-tier hosting (Railway, Fly.io, Render)
- Workers dynamically register/unregister, donating compute resources
- Intelligent workload routing based on worker capabilities
- Admin dashboard shows real-time worker availability and system demand

---

## Architecture Comparison

### Before (Centralized)
```
┌─────────────────────────────────────────┐
│        Single Large Server (GPU)        │
├─────────────────────────────────────────┤
│  vLLM + Ollama Vision (GPU intensive)   │
│  RAG + Notes + NER + OCR (services)     │
│  PostgreSQL + Neo4j + ChromaDB + Redis  │
│  Frontend (Next.js)                     │
└─────────────────────────────────────────┘
```

### After (Distributed)
```
┌──────────────────────────────────────────────┐
│     Coordinator (Free Tier Hosting)          │
│  - API Gateway                               │
│  - Worker Registry                           │
│  - Task Queue (Redis/SQLite)                 │
│  - Load Balancer                             │
│  - Admin Dashboard                           │
└────────────┬─────────────────────────────────┘
             │
   ┌─────────┴──────────────────┬───────────────┬──────────────┐
   │                            │               │              │
┌──▼────────────┐      ┌────────▼──────┐  ┌────▼──────────┐  │
│ GPU Worker 1  │      │ GPU Worker 2  │  │ GPU Worker N  │  │
│ (vLLM)        │      │ (Vision/OCR)  │  │ (vLLM/Vision) │  │
└───────────────┘      └───────────────┘  └───────────────┘  │
                                                              │
┌───────────────┐      ┌────────────────┐ ┌────────────────┐ │
│Service Worker │      │Service Worker  │ │Service Worker  │ │
│(RAG + Notes)  │      │(NER + OCR)     │ │(Doc Processor) │ │
└───────────────┘      └────────────────┘ └────────────────┘ │
                                                              │
┌───────────────┐      ┌────────────────┐ ┌────────────────┐ │
│ Data Worker 1 │      │ Data Worker 2  │ │ Data Worker 3  │ │
│ (PostgreSQL)  │      │ (Neo4j)        │ │ (ChromaDB)     │ │
└───────────────┘      └────────────────┘ └────────────────┘ │
                                                              │
                       ┌────────────────┐                     │
                       │  Data Worker 4 │ ◄───────────────────┘
                       │  (Redis)       │
                       └────────────────┘
```

---

## Worker Tiers & Capabilities

### Tier 1: GPU Compute Workers (High Power Required)
**Requirements**: 16GB+ VRAM, GPU (NVIDIA/AMD)
**Workloads**:
- vLLM inference (LLM inference at 2-3x Ollama speed)
- Ollama Vision (VLM, OCR models like llava:7b)

**Container Options Given to Worker**:
- `rma-vllm-worker` (vLLM OpenAI-compatible server)
- `rma-ollama-vision-worker` (Vision model server)

### Tier 2: Application Service Workers (Medium Power)
**Requirements**: 4GB+ RAM, 2+ CPU cores
**Workloads**:
- RAG Service (document retrieval + generation)
- Notes Service (note processing)
- NER/Graph Service (entity extraction, Neo4j integration)
- Doc Processor (document parsing)
- OCR Service (OCR coordination)
- Client RAG Service (client-specific RAG)
- Upload Service (file handling)

**Container Options Given to Worker**:
- `rma-rag-worker`
- `rma-notes-worker`
- `rma-ner-worker`
- `rma-doc-processor-worker`
- `rma-ocr-worker`
- `rma-client-rag-worker`
- `rma-upload-worker`

### Tier 3: Data Store Workers (Light to Medium)
**Requirements**: 2GB+ RAM, persistent storage
**Workloads**:
- PostgreSQL (relational data)
- Neo4j (graph database)
- ChromaDB (vector database)
- Redis (cache + task queue)

**Container Options Given to Worker**:
- `rma-postgres-worker`
- `rma-neo4j-worker`
- `rma-chromadb-worker`
- `rma-redis-worker`

---

## Worker Registration Flow

```
1. Worker Node Starts
   ├─> GET /register?capabilities=<spec>
   │   spec = {
   │     "gpu_memory": "16GB",
   │     "gpu_type": "NVIDIA RTX 4090",
   │     "cpu_cores": 16,
   │     "ram": "64GB",
   │     "storage": "1TB",
   │     "network_bandwidth": "1Gbps"
   │   }
   │
2. Coordinator Analyzes Capabilities
   ├─> Determines worker tier (T1/T2/T3)
   ├─> Assigns workload type(s)
   │
3. Coordinator Returns Assignment
   ├─> POST /register response:
   │   {
   │     "worker_id": "worker-abc123",
   │     "tier": 1,
   │     "assigned_containers": [
   │       {
   │         "name": "rma-vllm-worker",
   │         "image": "registry.rma.ai/vllm-worker:latest",
   │         "port": 8000,
   │         "env": {
   │           "COORDINATOR_URL": "https://rma-coordinator.fly.dev",
   │           "WORKER_ID": "worker-abc123",
   │           "HEARTBEAT_INTERVAL": 30
   │         }
   │       }
   │     ],
   │     "heartbeat_url": "/worker/heartbeat",
   │     "task_pull_url": "/worker/tasks"
   │   }
   │
4. Worker Pulls Container & Starts
   ├─> docker pull registry.rma.ai/vllm-worker:latest
   ├─> docker run -d --gpus all \
   │       -e COORDINATOR_URL=https://rma-coordinator.fly.dev \
   │       -e WORKER_ID=worker-abc123 \
   │       registry.rma.ai/vllm-worker:latest
   │
5. Worker Sends Heartbeats
   ├─> POST /worker/heartbeat every 30s
   │   {
   │     "worker_id": "worker-abc123",
   │     "status": "healthy",
   │     "current_load": 0.3,
   │     "available_memory": "12GB"
   │   }
   │
6. Worker Pulls Tasks (or receives pushed tasks)
   ├─> GET /worker/tasks?worker_id=worker-abc123
   ├─> Receives task assignment
   ├─> Executes task
   ├─> POST /worker/task-complete with results
```

---

## Orchestration Options Evaluation

### Option 1: Kubernetes (❌ Too Complex)
**Pros**: Industry standard, auto-scaling, service discovery
**Cons**:
- Requires cluster setup (not "free tier" friendly)
- Steep learning curve
- Overkill for dynamic worker registration
- Requires cloud provider support

**Verdict**: ❌ Too heavy for minimal-cost democratized model

---

### Option 2: Docker Swarm (⚠️ Moderate Complexity)
**Pros**: Simpler than K8s, built into Docker
**Cons**:
- Still requires swarm cluster initialization
- Workers must join swarm (security concerns for public workers)
- Less flexible for heterogeneous worker pools

**Verdict**: ⚠️ Simpler than K8s but still not minimal enough

---

### Option 3: HashiCorp Nomad (⚠️ Moderate)
**Pros**: Simpler than K8s, good for mixed workloads
**Cons**:
- Requires Nomad cluster setup
- Additional infrastructure dependencies

**Verdict**: ⚠️ Better than K8s but still infrastructure overhead

---

### Option 4: ✅ Custom Service Registry + Task Queue (RECOMMENDED)
**Pros**:
- Minimal infrastructure (just HTTP API + Redis/SQLite)
- Works with free-tier hosting (Fly.io, Railway, Render)
- Simple worker registration via HTTP endpoints
- No special cluster setup
- Full control over worker assignment logic
- Can run on serverless platforms

**Cons**:
- Build custom orchestration logic
- Handle worker health/failure manually

**Architecture**:
```
Coordinator Service (Minimal, runs on free tier):
├─> API Gateway (FastAPI/Flask)
├─> Worker Registry (SQLite/PostgreSQL)
├─> Task Queue (Redis or in-memory queue)
├─> Load Balancer (round-robin or least-connections)
└─> Admin Dashboard (simple React/Vue app)

Communication:
├─> Workers register via HTTP POST /register
├─> Workers send heartbeats via POST /heartbeat
├─> Tasks routed via HTTP (push model) or polling (pull model)
└─> Service discovery via registry lookups
```

**Verdict**: ✅ **BEST CHOICE** - Minimal, flexible, free-tier compatible

---

## Recommended Architecture: Custom Service Registry

### Core Components

#### 1. Coordinator Service (Free Tier Hosting)
**Technology**: FastAPI (Python) or Express (Node.js)
**Hosting**: Fly.io free tier, Railway, Render, or Vercel serverless
**Database**:
- SQLite (for single-instance) OR
- PostgreSQL (Fly.io free tier) for multi-instance
**Cache/Queue**:
- Redis (Upstash free tier) OR
- In-memory queue for minimal setup

**Endpoints**:
```
POST   /api/worker/register      - Register new worker
POST   /api/worker/heartbeat     - Worker health check
GET    /api/worker/tasks         - Pull tasks (pull model)
POST   /api/worker/task-complete - Report task completion
DELETE /api/worker/unregister    - Remove worker

POST   /api/inference/llm        - LLM inference request
POST   /api/inference/vision     - Vision model request
POST   /api/rag/query            - RAG query
POST   /api/graph/extract        - NER extraction
... (all existing service endpoints)

GET    /api/admin/workers        - List all workers
GET    /api/admin/stats          - System statistics
GET    /api/admin/health         - Overall health
```

#### 2. Worker Agent (Runs on Donated Hardware)
**Technology**: Python script or lightweight Go binary
**Responsibilities**:
- Register with coordinator
- Pull assigned container
- Send heartbeats
- Execute tasks
- Report results

**Worker Script** (`worker-agent.py`):
```python
import requests
import docker
import psutil
import GPUtil  # for GPU detection

COORDINATOR_URL = "https://rma-coordinator.fly.dev"

def get_capabilities():
    """Detect hardware capabilities"""
    gpus = GPUtil.getGPUs()
    return {
        "gpu_memory": f"{gpus[0].memoryTotal}MB" if gpus else None,
        "gpu_type": gpus[0].name if gpus else None,
        "cpu_cores": psutil.cpu_count(),
        "ram": f"{psutil.virtual_memory().total / 1e9:.1f}GB",
        "storage": f"{psutil.disk_usage('/').total / 1e9:.1f}GB"
    }

def register_worker():
    """Register with coordinator"""
    caps = get_capabilities()
    response = requests.post(
        f"{COORDINATOR_URL}/api/worker/register",
        json={"capabilities": caps}
    )
    return response.json()

def start_containers(assignment):
    """Start assigned containers"""
    client = docker.from_env()
    for container_spec in assignment["assigned_containers"]:
        client.containers.run(
            container_spec["image"],
            name=container_spec["name"],
            environment=container_spec["env"],
            ports={f"{container_spec['port']}/tcp": container_spec['port']},
            detach=True
        )

def send_heartbeat(worker_id):
    """Send periodic heartbeat"""
    requests.post(
        f"{COORDINATOR_URL}/api/worker/heartbeat",
        json={
            "worker_id": worker_id,
            "status": "healthy",
            "current_load": psutil.cpu_percent() / 100
        }
    )

# Main loop
assignment = register_worker()
start_containers(assignment)
while True:
    send_heartbeat(assignment["worker_id"])
    time.sleep(30)
```

#### 3. Workload Router (Part of Coordinator)
**Routing Logic**:
```python
def route_request(request_type, payload):
    """Route incoming request to appropriate worker"""

    # Determine required worker tier
    worker_tier_map = {
        "llm_inference": 1,      # GPU worker
        "vision_inference": 1,   # GPU worker
        "rag_query": 2,          # Service worker
        "ner_extract": 2,        # Service worker
        "db_query": 3            # Data worker
    }

    required_tier = worker_tier_map.get(request_type)

    # Find available worker
    workers = get_available_workers(tier=required_tier)

    if not workers:
        # No workers available - queue task
        queue_task(request_type, payload)
        return {"status": "queued", "message": "No workers available"}

    # Load balancing (round-robin or least-connections)
    selected_worker = select_worker_least_loaded(workers)

    # Forward request to worker
    response = requests.post(
        f"http://{selected_worker.ip}:{selected_worker.port}/execute",
        json=payload,
        timeout=30
    )

    return response.json()
```

#### 4. Admin Dashboard
**Technology**: React/Vue.js + Chart.js
**Features**:
- Real-time worker count by tier
- Worker health status (green/yellow/red)
- Current system load
- Task queue depth
- Historical performance metrics

**Dashboard Layout**:
```
┌─────────────────────────────────────────────────┐
│  RMA Distributed System Dashboard              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Active Workers: 12                             │
│  ├─ GPU Workers (T1): 3    [████░░░░░░] 30%    │
│  ├─ Service Workers (T2): 6 [███████░░░] 60%   │
│  └─ Data Workers (T3): 3   [█████░░░░░] 50%    │
│                                                 │
│  Task Queue: 5 pending                          │
│  Total Requests Today: 1,247                    │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Worker List                             │   │
│  ├─────────────────────────────────────────┤   │
│  │ ID        | Tier | Type    | Status    │   │
│  │ worker-01 |  1   | vLLM    | Healthy ● │   │
│  │ worker-02 |  1   | Vision  | Healthy ● │   │
│  │ worker-03 |  2   | RAG     | Healthy ● │   │
│  │ worker-04 |  3   | Redis   | Warning ⚠ │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Migration Plan: From Centralized to Distributed

### Phase 1: Build Coordinator Service
**Goal**: Create minimal coordinator with worker registry

**Tasks**:
1. ✅ Create FastAPI coordinator service
   - Worker registration endpoint
   - Heartbeat endpoint
   - Worker registry (SQLite)
   - Basic admin dashboard

2. ✅ Deploy to free tier hosting
   - Choose: Fly.io, Railway, or Render
   - Set up domain (e.g., rma-coordinator.yourdomain.com)

3. ✅ Create worker agent script
   - Hardware capability detection
   - Auto-registration
   - Container management

### Phase 2: Containerize Existing Services
**Goal**: Package each service as a standalone container that can run on workers

**Tasks**:
1. ✅ Create worker-compatible containers
   - `rma-vllm-worker` (includes coordinator communication)
   - `rma-ollama-vision-worker`
   - `rma-rag-worker`, `rma-notes-worker`, etc.
   - Add coordinator URL as environment variable
   - Add worker registration on startup

2. ✅ Set up container registry
   - Use Docker Hub, GitHub Container Registry (free)
   - Push all worker containers

### Phase 3: Implement Routing & Load Balancing
**Goal**: Route incoming requests to appropriate workers

**Tasks**:
1. ✅ Build API Gateway in coordinator
   - Implement routing logic
   - Add load balancing (least-connections)
   - Add request queuing for no-worker scenarios

2. ✅ Update frontend to point to coordinator
   - Change API URLs from `http://localhost:8100` to `https://rma-coordinator.yourdomain.com/api`

### Phase 4: Testing & Validation
**Goal**: Validate distributed system works correctly

**Tasks**:
1. ✅ Test with single worker
2. ✅ Test with multiple workers (same tier)
3. ✅ Test worker failure scenarios
4. ✅ Test auto-scaling (add/remove workers)

### Phase 5: Production Rollout
**Goal**: Launch democratized worker pool

**Tasks**:
1. ✅ Register domain
2. ✅ Deploy coordinator to free tier
3. ✅ Create worker onboarding docs
4. ✅ Launch admin dashboard
5. ✅ Monitor and optimize

---

## Example: Worker Registration Decision Tree

```
Worker connects with capabilities:
{
  "gpu_memory": "24GB",
  "gpu_type": "NVIDIA RTX 4090",
  "cpu_cores": 16,
  "ram": "64GB"
}

Coordinator analyzes:
├─> Has GPU? Yes (24GB VRAM)
│   ├─> Assign Tier 1 (GPU Worker)
│   ├─> Check existing workers
│   │   ├─> 2 vLLM workers, 1 Vision worker
│   │   └─> Need more balance
│   ├─> Assign: Vision model (llava:7b)
│   └─> Return container: rma-ollama-vision-worker

Worker with limited resources:
{
  "gpu_memory": null,
  "cpu_cores": 4,
  "ram": "8GB"
}

Coordinator analyzes:
├─> No GPU?
│   ├─> RAM >= 8GB? Yes
│   ├─> Assign Tier 2 (Service Worker)
│   ├─> Check service distribution
│   │   └─> Need more RAG workers
│   ├─> Assign: RAG Service
│   └─> Return container: rma-rag-worker

Worker with minimal resources:
{
  "cpu_cores": 2,
  "ram": "4GB",
  "storage": "100GB"
}

Coordinator analyzes:
├─> Limited resources
│   ├─> Assign Tier 3 (Data Worker)
│   ├─> Check data worker needs
│   │   └─> Need Redis cache
│   ├─> Assign: Redis
│   └─> Return container: rma-redis-worker
```

---

## Cost Comparison

### Current Centralized Model
- **Server**: $500-1000/month (GPU instance on AWS/GCP)
- **Total**: $500-1000/month

### Distributed Model
- **Coordinator**: $0/month (free tier: Fly.io/Railway)
- **Domain**: $12/year (~$1/month)
- **Workers**: $0 (donated by community/users)
- **Total**: ~$1/month

**Savings**: 99.8% cost reduction!

---

## Worker Incentive Model (Future Enhancement)

To encourage worker participation:
1. **Credit System**: Workers earn credits for compute time
2. **Priority Access**: Workers get priority when system is at capacity
3. **Usage Tracking**: Dashboard shows contribution stats
4. **Community Recognition**: Leaderboard for top contributors

---

## Security Considerations

1. **Worker Authentication**:
   - API keys for worker registration
   - JWT tokens for ongoing communication

2. **Network Isolation**:
   - Workers communicate only with coordinator
   - No direct worker-to-worker communication

3. **Data Privacy**:
   - Sensitive data encrypted in transit (HTTPS)
   - Optional: Workers can run in "trusted" mode for sensitive data

4. **DDoS Protection**:
   - Rate limiting on coordinator endpoints
   - Worker validation before task assignment

---

## Summary

**Recommendation**:
✅ **Custom Service Registry + Task Queue** (not Kubernetes)

**Why?**
- Minimal infrastructure (FastAPI + SQLite + Redis)
- Runs on free tier hosting
- Simple worker registration via HTTP
- Full control over workload distribution
- No cluster management overhead
- Perfect for democratized compute model

**Next Steps**:
1. Build coordinator service (FastAPI)
2. Create worker agent script
3. Containerize existing services with coordinator integration
4. Deploy coordinator to free tier (Fly.io/Railway)
5. Test with local workers
6. Launch with admin dashboard

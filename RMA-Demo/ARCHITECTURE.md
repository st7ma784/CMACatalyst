# RMA Distributed System Architecture

## Overview

The RMA (Return Merchandise Authorization) Distributed System is a democratized compute pool that enables distributed AI workloads across volunteer worker nodes with minimal central infrastructure cost.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS / USERS                         │
│                    (Web Browsers, API Calls)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN DASHBOARD                            │
│           https://rma-dashboard.fly.dev                         │
│                                                                 │
│  • Real-time worker monitoring                                 │
│  • System health metrics                                       │
│  • Worker statistics & distribution                            │
│  • Auto-refresh every 5 seconds                               │
│                                                                 │
│  Stack: React + Vite + Recharts                               │
│  Hosted: Fly.io (Free Tier - 256MB RAM)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  COORDINATOR SERVICE                            │
│          https://rma-coordinator.fly.dev                        │
│                                                                 │
│  Core Responsibilities:                                         │
│  ├─ Worker Registration & Discovery                            │
│  ├─ Tier Assignment (GPU/Service/Data)                        │
│  ├─ Health Monitoring (30s heartbeats)                        │
│  ├─ Request Routing & Load Balancing                          │
│  ├─ Container Assignment Logic                                │
│  └─ Admin API (stats, workers, health)                        │
│                                                                 │
│  Stack: Python FastAPI + Uvicorn                              │
│  Hosted: Fly.io (Free Tier - 256MB RAM)                      │
│  Auto-scaling: Scale to zero when idle                        │
└────────────┬────────────────────────────────┬─────────────────┘
             │                                │
    ┌────────┴────────┐              ┌────────┴──────────┐
    │                 │              │                   │
    ▼                 ▼              ▼                   ▼
┌─────────┐    ┌─────────┐    ┌─────────┐      ┌─────────┐
│ TIER 1  │    │ TIER 1  │    │ TIER 2  │      │ TIER 3  │
│  GPU    │    │  GPU    │    │ SERVICE │      │  DATA   │
│ Worker  │    │ Worker  │    │ Worker  │      │ Worker  │
└─────────┘    └─────────┘    └─────────┘      └─────────┘
```

---

## Worker Tier System

### Tier 1: GPU Workers (High Compute)
**Hardware Requirements:**
- NVIDIA GPU (8GB+ VRAM recommended)
- 8+ CPU cores
- 16GB+ RAM

**Assigned Containers:**
- `vllm-worker` - LLM inference (Llama, Mistral, etc.)
- `ollama-vision-worker` - Vision models & OCR
- `gpu-compute-worker` - General GPU workloads

**Use Cases:**
- Large language model inference
- Image generation & processing
- OCR with AI enhancement
- Computer vision tasks

### Tier 2: Service Workers (CPU Intensive)
**Hardware Requirements:**
- 4+ CPU cores
- 8GB+ RAM
- No GPU required

**Assigned Containers:**
- `rag-worker` - Retrieval Augmented Generation
- `ner-worker` - Named Entity Recognition
- `notes-worker` - Document processing
- `chromadb-worker` - Vector database

**Use Cases:**
- Document embedding & search
- Text analysis & NER
- API services
- RAG pipeline processing

### Tier 3: Data Workers (Storage/Cache)
**Hardware Requirements:**
- 2+ CPU cores
- 4GB+ RAM
- Storage space

**Assigned Containers:**
- `postgres-worker` - PostgreSQL database
- `redis-worker` - Cache & session storage
- `neo4j-worker` - Graph database

**Use Cases:**
- Data persistence
- Caching layer
- Session management
- Graph relationships

---

## Deployment Models

### Model 1: Local Development

```
┌──────────────────────────────────────────────────────────┐
│  Developer Machine                                       │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │  Coordinator Service                        │        │
│  │  http://localhost:8080                      │        │
│  │  (Python FastAPI)                           │        │
│  └──────────────┬─────────────────────────────┘        │
│                 │                                        │
│  ┌──────────────┴─────────────────────────────┐        │
│  │                                              │        │
│  ▼                                              ▼        │
│  ┌──────────────────┐              ┌─────────────────┐ │
│  │  Worker Agent     │              │ Admin Dashboard │ │
│  │  (Python Script)  │              │ http://3001     │ │
│  │                   │              │ (React Dev)     │ │
│  │  Detects:         │              └─────────────────┘ │
│  │  • Hardware caps  │                                  │
│  │  • Registers      │                                  │
│  │  • Runs containers│                                  │
│  └──────────────────┘                                  │
│                                                          │
│  Docker Containers:                                     │
│  ├─ vllm-worker (if GPU)                               │
│  ├─ rag-worker                                         │
│  └─ chromadb-worker                                    │
└──────────────────────────────────────────────────────────┘
```

**Setup Commands:**
```bash
# Terminal 1: Start Coordinator
cd coordinator-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080

# Terminal 2: Start Worker Agent
cd worker-agent
python worker_agent.py --coordinator http://localhost:8080

# Terminal 3: Start Dashboard
cd admin-dashboard
npm run dev
```

---

### Model 2: Fly.io Production Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLY.IO CLOUD                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  rma-coordinator.fly.dev (Coordinator)                     │ │
│  │  • Auto-scales to zero when idle                           │ │
│  │  • Wakes on API request                                    │ │
│  │  • 256MB RAM, shared CPU                                   │ │
│  │  • Free tier eligible                                      │ │
│  └────────────────────┬───────────────────────────────────────┘ │
│                       │                                          │
│  ┌────────────────────┴───────────────────────────────────────┐ │
│  │  rma-dashboard.fly.dev (Admin Dashboard)                   │ │
│  │  • Static site (React build + Nginx)                       │ │
│  │  • 256MB RAM                                                │ │
│  │  • Free tier eligible                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTPS
                        │ (Public Internet)
                        │
        ┌───────────────┴───────────────┬──────────────────┐
        │                               │                  │
        ▼                               ▼                  ▼
┌───────────────┐            ┌────────────────┐   ┌────────────────┐
│  Home PC      │            │  Office Server │   │  Cloud VM      │
│  (GPU Worker) │            │  (CPU Worker)  │   │  (CPU Worker)  │
│               │            │                │   │                │
│  Docker:      │            │  Docker:       │   │  Docker:       │
│  • GPU worker │            │  • CPU worker  │   │  • CPU worker  │
│  container    │            │    container   │   │    container   │
│               │            │                │   │                │
│  Connects to: │            │  Connects to:  │   │  Connects to:  │
│  coordinator  │            │  coordinator   │   │  coordinator   │
│  via HTTPS    │            │  via HTTPS     │   │  via HTTPS     │
└───────────────┘            └────────────────┘   └────────────────┘
```

**Worker Deployment Commands:**
```bash
# On any machine with Docker
docker run -d \
  --name rma-cpu-worker \
  -e COORDINATOR_URL=https://rma-coordinator.fly.dev \
  --restart unless-stopped \
  rma-cpu-worker:latest

# On GPU machine
docker run -d \
  --name rma-gpu-worker \
  --gpus all \
  -e COORDINATOR_URL=https://rma-coordinator.fly.dev \
  --restart unless-stopped \
  rma-gpu-worker:latest
```

---

### Model 3: Hybrid Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                     CENTRAL INFRASTRUCTURE                       │
│                     (Fly.io Free Tier - $0/mo)                  │
│                                                                  │
│  Coordinator + Dashboard                                        │
└────────────────────────┬─────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬────────────────┐
        │                │                │                │
        ▼                ▼                ▼                ▼
   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
   │Community│     │University│     │ Small   │     │Individual│
   │ Member  │     │ Lab      │     │Business │     │Developer │
   │         │     │          │     │         │     │          │
   │GPU: RTX │     │GPU: A100 │     │CPU: 32  │     │CPU: Rpi │
   │3060     │     │(4x)      │     │cores    │     │4GB      │
   │Tier 1   │     │Tier 1    │     │Tier 2   │     │Tier 3   │
   └─────────┘     └─────────┘     └─────────┘     └─────────┘

   Each contributes compute capacity to the distributed pool
   All workers auto-register and receive workloads based on tier
```

---

## Communication Flow

### 1. Worker Registration Flow
```
Worker                 Coordinator
  │                         │
  ├─ Detect Hardware ───────┤
  │  (GPU, CPU, RAM)        │
  │                         │
  ├─ POST /api/worker/      │
  │  register               │
  │  {capabilities: {...}}  │
  │                         │
  │                         ├─ Assign Tier
  │                         ├─ Select Containers
  │                         ├─ Create Worker Record
  │                         │
  │ ◄─ Return Assignment ───┤
  │  {worker_id,            │
  │   tier,                 │
  │   containers: [...]}    │
  │                         │
  ├─ Pull Container Images  │
  ├─ Start Containers       │
  │                         │
  └─ Begin Heartbeats ──────┤
     (every 30s)            │
```

### 2. Heartbeat Flow
```
Worker                 Coordinator
  │                         │
  ├─ POST /api/worker/      │
  │  heartbeat              │
  │  {worker_id,            │
  │   status: "healthy",    │
  │   current_load: 0.45}   │
  │                         │
  │                         ├─ Update Last Heartbeat
  │                         ├─ Update Status
  │                         ├─ Check Health
  │                         │
  │ ◄─ 200 OK ──────────────┤
  │                         │
  │                         │
  │ (after 90s no heartbeat)│
  │                         ├─ Mark as Offline
  │                         ├─ Remove from Pool
  │                         │
```

### 3. Dashboard Monitoring Flow
```
Dashboard              Coordinator
  │                         │
  ├─ GET /api/admin/stats ──┤
  │                         ├─ Calculate Stats
  │                         │
  │ ◄─ Return Stats ────────┤
  │  {total_workers,        │
  │   healthy_workers,      │
  │   by_tier: {...}}       │
  │                         │
  ├─ GET /api/admin/workers─┤
  │                         ├─ List All Workers
  │                         │
  │ ◄─ Return Workers ──────┤
  │  [{worker_id,           │
  │    tier, status, ...}]  │
  │                         │
  └─ Refresh (every 5s) ────┤
```

---

## Data Models

### Worker
```python
{
  "worker_id": "worker-abc12345",
  "tier": 2,
  "status": "healthy",  # healthy | degraded | offline
  "ip_address": "192.168.1.100",
  "registered_at": "2025-12-01T10:00:00Z",
  "last_heartbeat": "2025-12-01T10:05:30Z",
  "current_load": 0.45,  # 0.0 - 1.0
  "tasks_completed": 127,
  "capabilities": {
    "cpu_cores": 16,
    "ram": "64.0GB",
    "storage": "1TB",
    "gpu_memory": "24GB",
    "gpu_type": "NVIDIA RTX 4090"
  },
  "assigned_containers": [
    {
      "name": "rma-vllm-worker",
      "image": "ghcr.io/rma/vllm-worker:latest",
      "port": 8000,
      "env": {"MODEL": "llama2:7b"}
    }
  ]
}
```

### Container Assignment
```python
{
  "name": "rma-vllm-worker",
  "image": "ghcr.io/rma/vllm-worker:latest",
  "port": 8000,
  "requires_gpu": True,
  "env": {
    "MODEL": "llama2:7b",
    "COORDINATOR_URL": "https://rma-coordinator.fly.dev"
  }
}
```

---

## API Endpoints

### Worker API (`/api/worker`)
- `POST /register` - Register new worker
- `POST /heartbeat` - Send heartbeat update
- `DELETE /unregister/{id}` - Graceful shutdown
- `GET /tasks` - Pull tasks (future)
- `POST /task-complete` - Report completion (future)

### Admin API (`/api/admin`)
- `GET /workers` - List all workers
- `GET /stats` - System statistics
- `GET /health` - Detailed health check

### Inference API (`/api/inference`) - Future
- `POST /llm` - LLM inference request
- `POST /rag/query` - RAG query
- `POST /ocr` - OCR processing
- `POST /vision` - Vision model inference

---

## Security Considerations

### Current (MVP)
- ✅ HTTPS for all communication
- ✅ Fly.io managed SSL certificates
- ✅ No sensitive data in transit
- ✅ Workers connect outbound only

### Future Enhancements
- 🔄 JWT authentication for workers
- 🔄 API keys for admin endpoints
- 🔄 Rate limiting per worker
- 🔄 Encrypted worker credentials
- 🔄 Network isolation (VPN/Tailscale)

---

## Scaling Strategy

### Horizontal Scaling
```
1 Worker  ──► 10 Workers  ──► 100 Workers  ──► 1000 Workers
   │              │                │                  │
   └──────────────┴────────────────┴──────────────────┘
                         │
                         ▼
              Same coordinator cost: $0/month
              (Fly.io free tier handles 1000+ workers)
```

### Performance Characteristics
- **Worker Registration**: < 1 second
- **Heartbeat Processing**: < 50ms
- **Admin Dashboard Queries**: < 200ms
- **Coordinator Memory**: ~1-2MB per 100 workers

### Bottlenecks & Solutions
1. **Coordinator CPU**: Minimal (heartbeats are async)
2. **Coordinator Memory**: Workers stored in-memory (add Redis for 1000+)
3. **Network**: Fly.io free tier handles 100GB/month (sufficient for 1000 workers)

---

## Cost Comparison

### Before (Centralized)
```
GPU Server (AWS g5.xlarge):     $1.006/hour = $~730/month
Load Balancer:                  $20/month
Database:                       $15/month
Monitoring:                     $10/month
────────────────────────────────────────────────────
TOTAL:                          $775/month
```

### After (Distributed)
```
Coordinator (Fly.io free):      $0/month
Dashboard (Fly.io free):        $0/month
Workers (Community donated):    $0/month
Domain (optional):              $1/month
────────────────────────────────────────────────────
TOTAL:                          $1/month

SAVINGS:                        $774/month (99.9%)
```

---

## Monitoring & Observability

### Real-time Metrics
- Total workers by tier
- Healthy vs degraded workers
- Average load per tier
- Tasks completed
- Worker uptime

### Health Checks
- Coordinator: `/health`
- Workers: Heartbeat status
- Containers: Health check endpoints
- Dashboard: Uptime monitoring

### Alerting (Future)
- Worker offline > 5 minutes
- No GPU workers available
- Coordinator unhealthy
- High system load (>80%)

---

## Future Enhancements

### Phase 1 (Current)
- ✅ Worker registration & discovery
- ✅ Tier-based assignment
- ✅ Health monitoring
- ✅ Admin dashboard

### Phase 2 (Next)
- 🔄 Task queue system
- 🔄 Request routing to workers
- 🔄 Load balancing algorithm
- 🔄 Worker authentication

### Phase 3 (Future)
- 📋 Credit system for contributors
- 📋 Priority queue for donors
- 📋 Reputation scoring
- 📋 Automatic failover
- 📋 Multi-region support

---

## Technical Stack

### Coordinator
- **Language**: Python 3.11+
- **Framework**: FastAPI 0.115+
- **Server**: Uvicorn (ASGI)
- **Deployment**: Fly.io Docker

### Dashboard
- **Language**: JavaScript (ES6+)
- **Framework**: React 18
- **Build Tool**: Vite 5
- **Charts**: Recharts
- **Hosting**: Fly.io (Nginx)

### Workers
- **Language**: Python 3.11+
- **Container**: Docker
- **GPU**: NVIDIA Container Toolkit
- **Orchestration**: Docker Compose

---

## Getting Started

See [DISTRIBUTED_QUICK_START.md](./DISTRIBUTED_QUICK_START.md) for step-by-step deployment guide.

For detailed deployment instructions, see [DEPLOYMENT_COMPLETE.md](./DEPLOYMENT_COMPLETE.md).

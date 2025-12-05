# Distributed Architecture Specification
**RMA Tool - Zero-Cost Federated Worker System**

Version: 2.0  
Date: December 5, 2025  
Status: Production

---

## Executive Summary

A completely free-tier, distributed worker system leveraging Cloudflare's edge infrastructure to coordinate federated workers across VPNs and firewalls. The system uses named Cloudflare Tunnels for secure connectivity and Durable Objects for coordination state, achieving **$0/month** operational cost.

---

## 1. System Components

### 1.1 Frontend (`rmatool.org.uk`)
**Technology**: Static site (Cloudflare Pages - Free)  
**Purpose**: User interface for document processing requests  
**Cost**: $0/month

**Responsibilities**:
- Accept user document uploads (PDF, images)
- Display processing status and results
- Visualize distributed worker topology
- Send requests to API Gateway

**Flow**:
```
User Upload → Frontend → api.rmatool.org.uk/api/service/{type}
```

---

### 1.2 API Gateway / Edge Router (`api.rmatool.org.uk`)
**Technology**: Cloudflare Worker with Durable Objects  
**Repository**: `RMA-Demo/services/cloudflare-edge-router/`  
**Cost**: $0/month (100K requests/day on free tier)

**Purpose**: Route incoming requests to appropriate edge coordinators

**Endpoints**:
- `POST /api/edge/register` - Edge coordinator registration
- `POST /api/worker/register` - Worker registration (proxied to coordinator)
- `POST /api/service/{type}` - Service execution requests
- `GET /api/admin/coordinators` - List registered coordinators
- `GET /health` - Health check

**State Storage**: Durable Object `CoordinatorRegistry`
- Stores list of active edge coordinators
- Tracks tunnel URLs and last-seen timestamps
- Auto-expires stale coordinators (5 min timeout)
- Free tier: 1M reads/day, 1K writes/day

**Request Flow**:
```
Frontend Request
    ↓
Edge Router (api.rmatool.org.uk)
    ↓
[Durable Object] Get available coordinators
    ↓
Select coordinator (round-robin/random)
    ↓
Forward to coordinator via tunnel URL
    ↓
Coordinator routes to appropriate worker
    ↓
Return response to frontend
```

**Selection Algorithm** (Current):
- Round-robin or random selection from healthy coordinators
- Future: Latency-based, load-based routing

---

### 1.3 Edge Coordinators
**Technology**: FastAPI (Python) in Docker  
**Repository**: `RMA-Demo/services/local-coordinator/`  
**Deployment**: `edge-coordinator.yml` Docker Compose stack  
**Cost**: $0/month (self-hosted on volunteer hardware)

**Purpose**: Maintain registry of workers and their assigned services, route service requests to appropriate workers

**Components**:
1. **Coordinator Service** (FastAPI on port 8080)
   - Worker registration and heartbeat tracking
   - Service assignment and routing
   - Health monitoring

2. **Cloudflare Tunnel** (Named tunnel)
   - Exposes coordinator publicly via HTTPS
   - Bypasses NAT/firewall restrictions
   - Free, unlimited bandwidth

3. **Registrar Service** (Universal Worker in edge mode)
   - Automatically registers coordinator at edge router
   - Maintains registration via heartbeats
   - Provides tunnel URL to edge router

**Endpoints**:
- `POST /api/worker/register` - Register worker, assign services
- `POST /api/worker/heartbeat` - Keep worker alive
- `POST /api/service/{type}` - Execute service on assigned worker
- `GET /health` - Coordinator health

**State**:
- In-memory worker registry
- Worker capabilities and assigned services
- Last-seen timestamps

**Bootstrap Requirement**:
- **At least ONE edge coordinator must always be running** for system to function
- First coordinator becomes bootstrap node
- Additional coordinators can join dynamically

---

### 1.4 Universal Workers
**Technology**: Python container with auto-detection  
**Repository**: `RMA-Demo/worker-containers/universal-worker/`  
**Cost**: $0/month (self-hosted)

**Purpose**: Execute services based on hardware capabilities

**Worker Types** (Auto-detected):
1. **GPU Worker**: Has CUDA GPU
   - Services: OCR enhancement, AI processing
   
2. **Edge Worker**: Has public IP or edge role
   - Services: Coordinator, edge-proxy
   - Can run coordinator service
   
3. **Storage Worker**: Has large disk space (>100GB free)
   - Services: Document storage, caching
   
4. **CPU Worker**: Fallback
   - Services: Basic document processing

**Configuration**:
```bash
# Required
COORDINATOR_URL=https://api.rmatool.org.uk  # Edge router URL

# Optional
WORKER_TYPE=auto              # auto/gpu/edge/storage/cpu
WORKER_ID=worker-{hostname}   # Unique identifier
TUNNEL_URL=https://...        # Pre-configured named tunnel
USE_TUNNEL=true               # Auto-create tunnel if needed
```

**Registration Flow**:
```
Worker starts
    ↓
Detect capabilities (GPU, disk, IP, etc.)
    ↓
POST to COORDINATOR_URL/api/worker/register
    ↓
Edge Router routes to available coordinator
    ↓
Coordinator assigns services based on capabilities
    ↓
Worker starts assigned service containers
    ↓
Send heartbeats every 30 seconds
```

**Cloudflare Tunnel Options**:
1. **Named Tunnel** (Production): Pre-created, persistent URL
2. **Quick Tunnel** (Dev): Auto-created, temporary URL from trycloudflare.com

---

## 2. Request Flow Diagrams

### 2.1 Service Execution Request

```
┌─────────────────┐
│   User Browser  │
│ rmatool.org.uk  │
└────────┬────────┘
         │ POST /api/service/ocr
         │ {document, options}
         ↓
┌─────────────────────────────────┐
│      Edge Router                │
│   api.rmatool.org.uk            │
│   (Cloudflare Worker)           │
└────────┬────────────────────────┘
         │ Query Durable Object
         │ Get coordinator list
         ↓
┌─────────────────────────────────┐
│   Durable Object Registry       │
│   [Coordinator 1: edge-1.rma... │
│    Coordinator 2: edge-2.rma... │
│    Coordinator 3: edge-3.rma...]│
└────────┬────────────────────────┘
         │ Select coordinator
         │ (round-robin)
         ↓
┌─────────────────────────────────┐
│   Edge Coordinator              │
│   https://edge-1.rmatool.org.uk │
│   (FastAPI + Named Tunnel)      │
└────────┬────────────────────────┘
         │ Lookup worker with
         │ OCR service capability
         ↓
┌─────────────────────────────────┐
│   Worker Registry (in-memory)   │
│   {worker-123: {services: [ocr],│
│                tunnel: https://}│
└────────┬────────────────────────┘
         │ Forward to worker
         ↓
┌─────────────────────────────────┐
│   Universal Worker              │
│   GPU Worker with OCR service   │
│   (via Cloudflare Tunnel)       │
└────────┬────────────────────────┘
         │ Process document
         │ Return result
         ↓
         Return to user
```

### 2.2 Worker Registration Flow

```
┌─────────────────────────────────┐
│   Universal Worker Startup      │
│   docker run universal-worker   │
└────────┬────────────────────────┘
         │ 1. Detect capabilities
         │    (GPU? Disk? IP?)
         ↓
┌─────────────────────────────────┐
│   POST /api/worker/register     │
│   to api.rmatool.org.uk         │
│   {capabilities, worker_id}     │
└────────┬────────────────────────┘
         │ 2. Edge router receives
         ↓
┌─────────────────────────────────┐
│   Edge Router                   │
│   Query available coordinators  │
└────────┬────────────────────────┘
         │ 3. Select coordinator
         │    Forward registration
         ↓
┌─────────────────────────────────┐
│   Edge Coordinator              │
│   Assign services based on caps │
└────────┬────────────────────────┘
         │ 4. Return assignment
         │    {role: "gpu_worker",
         │     services: ["ocr"]}
         ↓
┌─────────────────────────────────┐
│   Worker starts services        │
│   Begin sending heartbeats      │
└─────────────────────────────────┘
```

### 2.3 Edge Coordinator Registration

```
┌─────────────────────────────────┐
│   Edge Coordinator Stack        │
│   docker-compose -f             │
│   edge-coordinator.yml up       │
└────────┬────────────────────────┘
         │ 1. Start coordinator (port 8080)
         │ 2. Start named tunnel
         │ 3. Start registrar
         ↓
┌─────────────────────────────────┐
│   Cloudflare Named Tunnel       │
│   edge-1.rmatool.org.uk →       │
│   http://coordinator:8080       │
└────────┬────────────────────────┘
         │ Tunnel connects to
         │ Cloudflare edge
         ↓
┌─────────────────────────────────┐
│   Registrar (Universal Worker)  │
│   WORKER_TYPE=edge              │
│   TUNNEL_URL=https://edge-1...  │
└────────┬────────────────────────┘
         │ POST /api/edge/register
         │ {url, location}
         ↓
┌─────────────────────────────────┐
│   Edge Router                   │
│   Store in Durable Object       │
└────────┬────────────────────────┘
         │ Coordinator now
         │ available for routing
         ↓
         Ready to receive requests
```

---

## 3. Data Flow & State Management

### 3.1 State Distribution

**Level 1: Edge Router (Durable Object)**
- **What**: List of edge coordinators
- **Storage**: Cloudflare Durable Objects (SQLite-backed)
- **Persistence**: Permanent until coordinator deregisters
- **Replication**: Cloudflare handles replication
- **Size**: ~1KB per coordinator × 5-20 coordinators = 5-20KB total

**Level 2: Edge Coordinators (In-Memory)**
- **What**: Worker registrations, service assignments
- **Storage**: In-memory Python dict
- **Persistence**: Lost on coordinator restart (workers re-register)
- **Replication**: None (each coordinator independent)
- **Size**: ~2KB per worker × 10-50 workers = 20-100KB total

**Level 3: Workers (Stateless)**
- **What**: Assigned services, current tasks
- **Storage**: In-memory during execution
- **Persistence**: Task results only
- **Replication**: None

### 3.2 Failure Recovery

**Edge Router Failure**: 
- N/A - Cloudflare Workers have 100% uptime SLA
- If somehow fails: DNS automatically routes to Cloudflare edge

**Coordinator Failure**:
- Edge router detects via stale timestamp (5 min)
- Automatically removes from routing pool
- Workers registered to failed coordinator are orphaned
- Workers re-register on heartbeat failure

**Worker Failure**:
- Coordinator detects via missing heartbeat (90 sec timeout)
- Removes worker from registry
- Pending requests to failed worker return 503
- Client retries request → routes to different worker

**Bootstrap Coordinator Failure**:
- **CRITICAL**: System requires at least one coordinator
- Manual intervention required to start new coordinator
- Workers will fail to register until coordinator available

---

## 4. Free Tier Usage & Limits

### 4.1 Cloudflare Free Tier

| Service | Free Tier Limit | Expected Usage | Safety Margin |
|---------|-----------------|----------------|---------------|
| Workers Requests | 100K/day | ~5-10K/day | 10-20x |
| Durable Objects Reads | 1M/day | ~50K/day | 20x |
| Durable Objects Writes | 1K/day | ~100/day | 10x |
| Named Tunnels | Unlimited | 5-20 tunnels | ∞ |
| Tunnel Bandwidth | Unlimited | 100GB+/month | ∞ |
| Pages Hosting | Unlimited | 1 site | ∞ |

**Cost**: **$0/month**

### 4.2 Self-Hosted Infrastructure

| Component | Cost | Hardware Requirements |
|-----------|------|----------------------|
| Edge Coordinator | $0 | 1GB RAM, minimal CPU |
| Universal Worker | $0 | Varies by service type |
| Total System | **$0/month** | Volunteer hardware |

---

## 5. Current Limitations & Future Improvements

### 5.1 Current Limitations

**Single Point of Failure**:
- Edge router Durable Object is single instance
- Bootstrap coordinator required

**No Load Balancing**:
- Random/round-robin coordinator selection
- No consideration of load, latency, or capacity

**No Direct P2P**:
- All traffic flows through Cloudflare
- Workers can't communicate directly

**No Service Discovery**:
- Workers must be pre-assigned services
- No dynamic service migration

**No Data Replication**:
- Coordinator state lost on restart
- No backup/restore mechanism

### 5.2 Planned Improvements

#### 5.2.1 Distributed Hash Table (DHT) Integration

**Goal**: Minimize Cloudflare traffic, enable P2P communication, improve redundancy

**Implementation Plan**:

**Phase 1: DHT Bootstrap**
```
┌─────────────────────────────────┐
│   Edge Router (Bootstrap Node)  │
│   Maintains DHT seed list       │
└─────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│   Coordinators join DHT         │
│   Each gets DHT node ID         │
│   Form Kademlia-style network   │
└─────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│   Workers query DHT directly    │
│   Find coordinators via DHT     │
│   Bypass edge router after init │
└─────────────────────────────────┘
```

**DHT Key Scheme**:
- `coordinator:{location}` → List of coordinator tunnel URLs
- `worker:{service_type}` → List of workers offering service
- `service:{worker_id}` → Worker capabilities and endpoint

**Benefits**:
- Reduced Cloudflare Worker requests (90% reduction)
- Direct P2P worker-to-worker communication possible
- Automatic coordinator discovery
- Better fault tolerance

**Technology**: libp2p (Go/Rust) or Kademlia Python implementation

**Challenges**:
- NAT traversal (partially solved by tunnels)
- DHT bootstrap chicken-egg problem
- Consistency during network partitions

**Timeline**: Q1 2026

#### 5.2.2 Smart Load Balancing

**Metrics to Track**:
- Coordinator CPU/memory usage
- Request queue depth
- Response latency (P50, P95, P99)
- Geographic location (for latency optimization)

**Algorithm**:
```python
def select_coordinator(coordinators, request):
    # Weight by inverse of current load
    weights = []
    for coord in coordinators:
        latency_score = 1.0 / (coord.avg_latency + 1)
        load_score = 1.0 / (coord.queue_depth + 1)
        health_score = 1.0 if coord.healthy else 0.0
        
        weight = latency_score * load_score * health_score
        weights.append(weight)
    
    return weighted_random(coordinators, weights)
```

**Timeline**: Q2 2026

#### 5.2.3 Enhanced Redundancy

**Coordinator State Replication**:
- Replicate worker registry to 3+ coordinators
- Use Raft consensus for consistency
- Automatic failover on coordinator failure

**Worker Service Migration**:
- Detect underutilized workers
- Dynamically assign additional services
- Hot-swap services between workers

**Timeline**: Q2 2026

#### 5.2.4 Frontend Topology Visualization

**Requirements** (from user):
- Graph view of distributed system
- Show coordinators, workers, and connections
- Real-time updates
- Service assignments per worker

**Implementation**:
```javascript
// New endpoint: GET /api/topology
{
  "coordinators": [
    {
      "id": "edge-1",
      "url": "https://edge-1.rmatool.org.uk",
      "workers": 12,
      "load": 0.45,
      "status": "healthy"
    }
  ],
  "workers": [
    {
      "id": "worker-gpu-001",
      "type": "gpu",
      "coordinator": "edge-1",
      "services": ["ocr", "enhancement"],
      "status": "active"
    }
  ]
}
```

**UI Components**:
- D3.js force-directed graph
- Node colors by type (coordinator=blue, gpu=green, etc.)
- Edge thickness by traffic volume
- Real-time WebSocket updates

**Timeline**: Q1 2026

---

## 6. Security Considerations

### 6.1 Current Security

**Transport Security**:
- All traffic over HTTPS (Cloudflare managed)
- Tunnels use TLS
- No plaintext credentials

**Authentication**:
- None (currently open system)
- **Risk**: Anyone can register workers

**Authorization**:
- None
- **Risk**: Any worker can access any service

### 6.2 Recommended Improvements

**Worker Authentication**:
- Shared secret or API key per worker
- JWT tokens for requests
- Coordinator validates tokens

**Request Rate Limiting**:
- Per-IP limits at edge router
- Per-worker limits at coordinator

**Service ACLs**:
- Define which workers can execute which services
- Prevent unauthorized service access

---

## 7. Deployment Recipes

### 7.1 Deploy Edge Router

```bash
cd RMA-Demo/services/cloudflare-edge-router
npx wrangler login
npx wrangler deploy
```

### 7.2 Deploy Bootstrap Coordinator

```bash
# 1. Create named tunnel
cloudflared tunnel login
cloudflared tunnel create edge-coordinator-1

# 2. Configure DNS
cloudflared tunnel route dns edge-coordinator-1 edge-1.rmatool.org.uk

# 3. Update edge-coordinator.yml with tunnel ID and credentials

# 4. Start stack
cd RMA-Demo
docker compose -f edge-coordinator.yml up -d

# 5. Verify registration
curl https://api.rmatool.org.uk/api/admin/coordinators
```

### 7.3 Deploy Additional Workers

```bash
docker run -d \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=auto \
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

---

## 8. Monitoring & Observability

### 8.1 Key Metrics

**Edge Router**:
- Request rate (requests/sec)
- Error rate (5xx responses)
- Coordinator selection time
- Durable Object read/write latency

**Coordinators**:
- Registered workers count
- Active workers count
- Stale workers count
- Request routing time

**Workers**:
- Service execution time
- Task queue depth
- Heartbeat success rate

### 8.2 Health Checks

**Edge Router**: `GET https://api.rmatool.org.uk/health`
```json
{
  "status": "healthy",
  "coordinators": 3,
  "message": "Edge router operational"
}
```

**Coordinator**: `GET https://edge-1.rmatool.org.uk/health`
```json
{
  "status": "healthy",
  "coordinator": "local-fastapi",
  "workers": {
    "total": 12,
    "active": 10,
    "stale": 2
  }
}
```

---

## 9. Glossary

- **Edge Router**: Cloudflare Worker at api.rmatool.org.uk that routes requests
- **Edge Coordinator**: FastAPI service that manages worker registry
- **Universal Worker**: Auto-detecting worker container that executes services
- **Named Tunnel**: Persistent Cloudflare Tunnel with fixed DNS name
- **Quick Tunnel**: Temporary trycloudflare.com tunnel for testing
- **Durable Object**: Cloudflare's distributed, strongly-consistent storage
- **Bootstrap Coordinator**: First coordinator required for system operation
- **Service Assignment**: Process of allocating services to workers based on capabilities

---

## 10. References

- Cloudflare Workers: https://workers.cloudflare.com
- Cloudflare Tunnels: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- Edge Coordinator Deployment: `ZERO_COST_DEPLOYMENT.md`
- API Documentation: `docs/api/`

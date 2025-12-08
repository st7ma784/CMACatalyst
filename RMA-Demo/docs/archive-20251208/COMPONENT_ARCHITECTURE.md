# Component Architecture - Visual Reference

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Browser: rmatool.org.uk (Cloudflare Pages - Free)                   │  │
│  │  - Upload documents                                                   │  │
│  │  - View topology graph                                                │  │
│  │  - Monitor processing status                                          │  │
│  └────────────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS Request
                                     │ POST /api/service/ocr
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE ROUTING LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  api.rmatool.org.uk (Cloudflare Worker - Free)                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  index.js                                                       │  │  │
│  │  │  - Route /api/edge/register                                     │  │  │
│  │  │  - Route /api/worker/register → coordinator                     │  │  │
│  │  │  - Route /api/service/* → coordinator                           │  │  │
│  │  └────────────────┬───────────────────────────────────────────────┘  │  │
│  │                   │                                                   │  │
│  │                   │ Query/Update                                      │  │
│  │                   ↓                                                   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Durable Object: CoordinatorRegistry                           │  │  │
│  │  │  (SQLite-backed, strongly consistent)                          │  │  │
│  │  │  ┌──────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │  Coordinators Table:                                      │  │  │  │
│  │  │  │  - worker_id, tunnel_url, location, last_seen            │  │  │  │
│  │  │  │  - Auto-expire stale (5 min timeout)                      │  │  │  │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Forward to coordinator
                                       │ (round-robin selection)
                                       ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COORDINATION LAYER                                      │
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │  Edge Coordinator 1 │  │  Edge Coordinator 2 │  │  Edge Coordinator N │ │
│  │  edge-1.rma...uk    │  │  edge-2.rma...uk    │  │  edge-N.rma...uk    │ │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │ │
│  │ │ FastAPI Service │ │  │ │ FastAPI Service │ │  │ │ FastAPI Service │ │ │
│  │ │ (port 8080)     │ │  │ │ (port 8080)     │ │  │ │ (port 8080)     │ │ │
│  │ │                 │ │  │ │                 │ │  │ │                 │ │ │
│  │ │ Worker Registry:│ │  │ │ Worker Registry:│ │  │ │ Worker Registry:│ │ │
│  │ │ {worker_id:     │ │  │ │ {worker_id:     │ │  │ │ {worker_id:     │ │ │
│  │ │   services:[],  │ │  │ │   services:[],  │ │  │ │   services:[],  │ │ │
│  │ │   tunnel_url,   │ │  │ │   tunnel_url,   │ │  │ │   tunnel_url,   │ │ │
│  │ │   last_seen}    │ │  │ │   last_seen}    │ │  │ │   last_seen}    │ │ │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │ │
│  │         ↑           │  │         ↑           │  │         ↑           │ │
│  │         │ Exposed   │  │         │ Exposed   │  │         │ Exposed   │ │
│  │         │ via       │  │         │ via       │  │         │ via       │ │
│  │         ↓           │  │         ↓           │  │         ↓           │ │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │ │
│  │ │ CF Named Tunnel │ │  │ │ CF Named Tunnel │ │  │ │ CF Named Tunnel │ │ │
│  │ │ (cloudflared)   │ │  │ │ (cloudflared)   │ │  │ │ (cloudflared)   │ │ │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│           │                         │                         │             │
└─────────────────────────────────────────────────────────────────────────────┘
            │                         │                         │
            │ Route to worker         │                         │
            │ with service            │                         │
            ↓                         ↓                         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKER LAYER                                       │
│                                                                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │  GPU Worker   │  │  GPU Worker   │  │ Storage Worker│  │  CPU Worker  │ │
│  │               │  │               │  │               │  │              │ │
│  │  Services:    │  │  Services:    │  │  Services:    │  │  Services:   │ │
│  │  - OCR        │  │  - OCR        │  │  - Storage    │  │  - Basic     │ │
│  │  - AI Enhance │  │  - AI Enhance │  │  - Caching    │  │  - Convert   │ │
│  │               │  │               │  │               │  │              │ │
│  │  NVIDIA GPU   │  │  AMD GPU      │  │  1TB Disk     │  │  8-core CPU  │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬───────┘ │
│          │                  │                  │                  │         │
│          │ Exposed via      │                  │                  │         │
│          │ CF Tunnel        │                  │                  │         │
│          ↓                  ↓                  ↓                  ↓         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Cloudflare Tunnels (Named or Quick)                                 │  │
│  │  - Bypass NAT/Firewall                                               │  │
│  │  - Secure HTTPS                                                      │  │
│  │  - Unlimited bandwidth (free)                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Request Flow - Step by Step

### 1. Document Upload & Processing

```
┌────────┐   1. Upload PDF                    ┌──────────────┐
│        ├──────────────────────────────────► │              │
│  User  │                                     │   Frontend   │
│        │   5. Display result                 │  (Browser)   │
│        │◄────────────────────────────────────┤              │
└────────┘                                     └──────┬───────┘
                                                      │
                                                      │ 2. POST /api/service/ocr
                                                      │    {document: base64}
                                                      ↓
                                               ┌──────────────┐
                                               │     Edge     │
                                               │    Router    │
                                               │              │
                                               │ Query DO for │
                                               │ coordinators │
                                               └──────┬───────┘
                                                      │
                                                      │ 3. Forward to
                                                      │    selected coordinator
                                                      ↓
                                               ┌──────────────┐
                                               │    Edge      │
                                               │ Coordinator  │
                                               │              │
                                               │ Find worker  │
                                               │ with OCR     │
                                               └──────┬───────┘
                                                      │
                                                      │ 4. Execute on
                                                      │    GPU worker
                                                      ↓
                                               ┌──────────────┐
                                               │ GPU Worker   │
                                               │              │
                                               │ Run OCR      │
                                               │ model        │
                                               └──────────────┘
```

### 2. Worker Registration & Service Assignment

```
┌──────────────┐   1. Start container        ┌──────────────┐
│              │                              │              │
│   Docker     ├────────────────────────────► │  Universal   │
│   Host       │                              │   Worker     │
│              │                              │              │
└──────────────┘                              └──────┬───────┘
                                                     │
                                                     │ 2. Detect hardware
                                                     │    GPU? Disk? IP?
                                                     │
                                                     │ 3. POST /api/worker/register
                                                     │    {capabilities, worker_id}
                                                     ↓
                                              ┌──────────────┐
                                              │     Edge     │
                                              │    Router    │
                                              │              │
                                              │ Forward to   │
                                              │ coordinator  │
                                              └──────┬───────┘
                                                     │
                                                     │ 4. Assign services
                                                     │    based on caps
                                                     ↓
                                              ┌──────────────┐
                                              │    Edge      │
                                              │ Coordinator  │
                                              │              │
                                              │ Store worker │
                                              │ in registry  │
                                              └──────┬───────┘
                                                     │
                                                     │ 5. Return assignment
                                                     │    {services: ["ocr"]}
                                                     ↓
                                              ┌──────────────┐
                                              │  Universal   │
                                              │   Worker     │
                                              │              │
                                              │ Start OCR    │
                                              │ service      │
                                              └──────────────┘
```

## Component Interaction Matrix

| Component | Talks To | Protocol | Purpose |
|-----------|----------|----------|---------|
| Frontend | Edge Router | HTTPS | Service requests, topology queries |
| Edge Router | Durable Object | Internal | Get/update coordinator list |
| Edge Router | Coordinators | HTTPS (via tunnel) | Forward worker registration, service requests |
| Coordinator | Workers | HTTPS (via tunnel) | Forward service execution, receive heartbeats |
| Workers | Coordinator | HTTPS | Registration, heartbeats |
| Registrar | Edge Router | HTTPS | Register coordinator at bootstrap |
| Tunnel | Cloudflare Edge | QUIC/HTTP2 | Expose local services publicly |

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  PERSISTENT STATE (Durable Object - SQLite)                     │
│                                                                  │
│  coordinators = [                                               │
│    {id: "edge-1", url: "https://edge-1...", last_seen: ...},   │
│    {id: "edge-2", url: "https://edge-2...", last_seen: ...}    │
│  ]                                                              │
│                                                                  │
│  Survives: Worker restarts, deployments                         │
│  Lost on: Never (unless manually deleted)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Read on every request
                                │ Write on coordinator register
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  EPHEMERAL STATE (Coordinator - In-Memory Dict)                 │
│                                                                  │
│  workers = {                                                    │
│    "worker-gpu-001": {                                          │
│      services: ["ocr", "enhance"],                              │
│      tunnel_url: "https://...",                                 │
│      last_heartbeat: timestamp,                                 │
│      capabilities: {...}                                        │
│    }                                                            │
│  }                                                              │
│                                                                  │
│  Survives: Nothing                                              │
│  Lost on: Coordinator restart, crash, redeploy                  │
│  Recovery: Workers re-register on heartbeat failure             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Query on service request
                                │ Update on heartbeat
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  TASK STATE (Worker - In-Memory)                                │
│                                                                  │
│  current_tasks = [                                              │
│    {id: "task-123", status: "processing", ...}                 │
│  ]                                                              │
│                                                                  │
│  Survives: Nothing                                              │
│  Lost on: Worker restart, crash                                 │
│  Recovery: Client timeout, retry to different worker            │
└─────────────────────────────────────────────────────────────────┘
```

## Failure Modes & Recovery

```
┌─────────────────────────────────────────────────────────────────┐
│  FAILURE: Worker Crash                                          │
├─────────────────────────────────────────────────────────────────┤
│  Detection:                                                      │
│  - Coordinator: Missing heartbeat (90 sec timeout)              │
│  - Client: Request timeout (30 sec)                             │
│                                                                  │
│  Recovery:                                                       │
│  1. Coordinator removes worker from registry                    │
│  2. Client retries request → routes to different worker         │
│  3. Failed worker restarts → re-registers → back in pool        │
│                                                                  │
│  Data Loss: In-flight tasks lost                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FAILURE: Coordinator Crash                                     │
├─────────────────────────────────────────────────────────────────┤
│  Detection:                                                      │
│  - Edge Router: Stale timestamp (5 min)                         │
│  - Worker: Heartbeat failure                                    │
│                                                                  │
│  Recovery:                                                       │
│  1. Edge Router removes coordinator from routing                │
│  2. Workers detect heartbeat failure                            │
│  3. Workers re-register → routes to different coordinator       │
│  4. Failed coordinator restarts → re-registers                  │
│                                                                  │
│  Data Loss: All worker registrations for that coordinator       │
│  Impact: Workers must re-register (30-60 sec outage per worker) │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FAILURE: All Coordinators Down                                 │
├─────────────────────────────────────────────────────────────────┤
│  Detection:                                                      │
│  - Edge Router: Empty coordinator list                          │
│                                                                  │
│  Recovery:                                                       │
│  1. Edge Router returns 503 Service Unavailable                 │
│  2. Manual intervention: Start bootstrap coordinator            │
│  3. Workers re-register automatically once coordinator up       │
│                                                                  │
│  Data Loss: None (Durable Object persists)                      │
│  Impact: System offline until coordinator started               │
│  Prevention: Always keep at least one coordinator running       │
└─────────────────────────────────────────────────────────────────┘
```

## Scaling Characteristics

| Component | Scaling Strategy | Bottleneck | Max Capacity |
|-----------|------------------|------------|--------------|
| Frontend | N/A (Static) | Cloudflare CDN | Unlimited |
| Edge Router | Auto (Cloudflare) | 100K req/day free | ~1 req/sec avg |
| Durable Object | Single instance | 1K writes/day free | ~1 write/min |
| Coordinators | Horizontal (add more) | Memory (worker registry) | ~1000 workers/coordinator |
| Workers | Horizontal (add more) | Hardware availability | Unlimited |

**Current Free Tier Capacity**:
- Edge Router: ~100K requests/day = 1.15 requests/sec sustained
- Coordinators: 5-20 coordinators (limited by DO writes)
- Workers: 50-200 workers per coordinator = 250-4000 total workers

**To Scale Beyond Free Tier**:
- Edge Router: Paid plan ($5/month) = 10M requests/month
- Coordinators: Add more (no cost, just hardware)
- Workers: Add more (no cost, just hardware)

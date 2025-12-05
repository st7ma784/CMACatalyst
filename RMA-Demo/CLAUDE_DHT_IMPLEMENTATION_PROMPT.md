# Claude Prompt: DHT Implementation for RMA Distributed System

## Context

You are implementing a **Distributed Hash Table (DHT) for peer-to-peer service discovery** in a zero-cost distributed AI document processing platform. The system currently routes all traffic through a Cloudflare edge router (approaching free tier limits), and needs P2P discovery to scale to 2000+ volunteer workers.

---

## 🎯 Project Goals

### Primary Objectives
1. **Minimize Cloudflare costs** - Reduce from 51,990 req/day to <25 req/day (99.95% reduction)
2. **Enable P2P worker communication** - Direct worker-to-worker requests via Cloudflare tunnels
3. **Scale on donated compute** - Support 2000+ heterogeneous volunteer workers
4. **Maintain zero-cost architecture** - Stay within all free tier limits
5. **Keep application logic separate** - DHT is infrastructure only, AI/docstore unchanged

### Non-Goals
- Don't break local Docker Compose development
- Don't remove coordinator fallback (DHT should be optional)
- Don't add complexity to application services (OCR, enhance, etc.)

---

## 📚 Essential Reading (In Order)

### System Architecture (30 minutes)
1. **[SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)** - Start here for quick context
2. **[DISTRIBUTED_ARCHITECTURE_SPEC.md](./DISTRIBUTED_ARCHITECTURE_SPEC.md)** - Complete technical specification
3. **[COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md)** - Visual diagrams and request flows

### DHT Specific (45 minutes)
4. **[DHT_INTEGRATION_PLAN.md](./DHT_INTEGRATION_PLAN.md)** - 8-week implementation plan, technical design
5. **[DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md)** - ⭐ **THIS IS YOUR TASK LIST** ⭐

### Deployment & Testing
6. **[DEVELOPER_DEPLOYMENT_GUIDE.md](./DEVELOPER_DEPLOYMENT_GUIDE.md)** - Dev environment setup
7. **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Testing strategy

---

## 📋 Your Task List

**See [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md) for complete checklist**

### Phase 1: DHT Foundation (Weeks 1-2) - START HERE

#### Task 1.1: DHT Library Selection
- [ ] Evaluate `kademlia` vs `py-libp2p` libraries
- [ ] Create 2-node proof-of-concept
- [ ] Document decision in `docs/dht-library-selection.md`
- **Files**: `worker-containers/universal-worker/requirements.txt`

#### Task 1.2: DHT Node Module
- [ ] Create `worker-containers/universal-worker/dht/dht_node.py` (see roadmap for code)
- [ ] Create `worker-containers/universal-worker/dht/dht_client.py`
- [ ] Create `worker-containers/universal-worker/dht/dht_config.py`
- **Code**: See "Code Implementation Guide" section in DHT_IMPLEMENTATION_ROADMAP.md

#### Task 1.3: Coordinator DHT Integration
- [ ] Create `services/local-coordinator/dht_coordinator.py`
- [ ] Modify `services/local-coordinator/app.py` to start DHT node
- [ ] Add DHT bootstrap endpoint
- **Code**: See DHT_IMPLEMENTATION_ROADMAP.md section 5

#### Task 1.4: Testing
- [ ] Create `tests/dht/test_dht_basic.py`
- [ ] Test 2-node DHT communication
- [ ] Verify get/set operations
- **Code**: See "Testing Strategy" section in DHT_IMPLEMENTATION_ROADMAP.md

### Phase 2-4: See Full Roadmap
Continue with tasks in DHT_IMPLEMENTATION_ROADMAP.md

---

## 🏗️ Current System Architecture

### Three-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                    User / Frontend                           │
│              (React app at rmatool.org.uk)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Layer 1: Edge Routing Layer                    │
│           (api.rmatool.org.uk - Cloudflare Worker)          │
│                                                              │
│  - Receives all requests (currently 51,990/day)             │
│  - Routes to coordinators via Durable Object registry       │
│  - BOTTLENECK: Approaching 100K/day free tier limit         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            Layer 2: Edge Coordination Layer                  │
│        (edge-1.rmatool.org.uk - FastAPI coordinator)        │
│                                                              │
│  - Runs on volunteer hardware                               │
│  - Tracks workers via SQLite                                │
│  - Cloudflare named tunnel for public access                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│             Layer 3: Worker Execution Layer                  │
│           (Universal workers on donated compute)             │
│                                                              │
│  - Auto-detect capabilities (GPU, CPU, storage)             │
│  - Create Cloudflare tunnels on startup                     │
│  - Execute AI services (OCR, enhance, chat, etc.)           │
└─────────────────────────────────────────────────────────────┘
```

### With DHT (After Implementation)

```
┌─────────────────────────────────────────────────────────────┐
│                    User / Frontend                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Edge Router (BOOTSTRAP ONLY - 25 req/day)         │
│  - Returns DHT seed nodes                                   │
│  - No longer routes requests                                │
└─────────────────────────────────────────────────────────────┘
                      
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
   ┌─────────┐              ┌─────────┐
   │ Coord 1 │◄────DHT─────►│ Coord 2 │
   │DHT Node │              │DHT Node │
   └────┬────┘              └────┬────┘
        │                        │
   ┌────┴────┐              ┌────┴────┐
   │ Worker  │◄────P2P─────►│ Worker  │
   │DHT Node │              │DHT Node │
   └─────────┘              └─────────┘
   
   All service discovery via DHT
   Direct P2P communication via tunnels
   Zero Cloudflare traffic for requests
```

---

## 🔑 Key Files to Work With

### New Files You'll Create

```
RMA-Demo/
├── worker-containers/universal-worker/
│   ├── dht/
│   │   ├── __init__.py                 ⭐ Task 1.2
│   │   ├── dht_node.py                 ⭐ Task 1.2 (Core DHT logic)
│   │   ├── dht_client.py               ⭐ Task 1.2 (Worker interface)
│   │   ├── dht_config.py               ⭐ Task 1.2
│   │   ├── dht_bootstrap.py            ⭐ Task 3.2
│   │   └── dht_router.py               ⭐ Task 2.3
│   ├── p2p/
│   │   ├── tunnel_manager.py           ⭐ Task 4.1
│   │   └── peer_discovery.py           ⭐ Task 4.1
│
├── services/local-coordinator/
│   ├── dht_coordinator.py              ⭐ Task 1.3
│
└── tests/
    ├── dht/
    │   ├── test_dht_basic.py           ⭐ Task 1.4
    │   ├── test_worker_discovery.py    ⭐ Task 2.4
    │   └── test_p2p_routing.py         ⭐ Task 4.4
    ├── integration/
    │   ├── test_dht_bootstrap.py       ⭐ Task 3.4
    │   └── test_end_to_end_dht.py      ⭐ Task 4.4
    └── load/
        └── test_dht_scale.py           ⭐ Task 4.4
```

### Existing Files You'll Modify

```
✏️  worker-containers/universal-worker/worker_agent.py
    - Add DHT client initialization
    - Add find_service_worker_dht() method
    - Modify service discovery to try DHT first, fallback to coordinator

✏️  services/local-coordinator/app.py
    - Start DHT node on coordinator startup
    - Add /api/dht/topology endpoint

✏️  services/cloudflare-edge-router/index.js
    - Add /api/dht/bootstrap endpoint (returns DHT seeds)

✏️  services/cloudflare-edge-router/coordinator-registry.js
    - Track dht_port for coordinators

✏️  worker-containers/universal-worker/requirements.txt
    - Add: kademlia==2.2.2 (or py-libp2p)

✏️  docker-compose.yml
    - Expose port 8468/udp for DHT

✏️  edge-coordinator.yml
    - Add DHT_PORT environment variable
```

---

## 💻 Code Snippets to Use

### See [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md) for:

1. **Complete DHT Node Implementation** (~200 lines)
   - Section: "1. DHT Node Core (`dht/dht_node.py`)"
   - Kademlia-based DHT with get/set/publish/find operations

2. **DHT Client for Workers** (~150 lines)
   - Section: "2. DHT Client for Workers (`dht/dht_client.py`)"
   - High-level interface for worker registration and service discovery

3. **Worker Integration** (~60 lines)
   - Section: "3. Worker Integration (`worker_agent.py` modifications)"
   - How to integrate DHT into existing worker_agent.py

4. **Edge Router Bootstrap Endpoint** (~30 lines)
   - Section: "4. Edge Router Bootstrap (`cloudflare-edge-router/index.js`)"
   - Returns list of DHT seed nodes

5. **Coordinator DHT Integration** (~100 lines)
   - Section: "5. Coordinator DHT Integration"
   - How coordinators participate in DHT

6. **Docker Configuration**
   - Section: "6. Docker Compose Configuration"
   - How to expose DHT ports

---

## ⚠️ Critical Requirements & Reminders

### **1. Use Cloudflare Tunnels for P2P**
```python
# Workers store tunnel URLs in DHT
await dht_client.register_worker(
    tunnel_url="https://worker-001.tunnel...",  # ← Use tunnel URL!
    services=["ocr", "enhance"],
    capabilities={"gpu": "RTX 3090"}
)

# Other workers connect via tunnel (not internal IP)
worker_info = await dht_client.find_worker_for_service("ocr")
requests.post(worker_info["tunnel_url"] + "/api/ocr", ...)  # ← Direct P2P
```

**Why?** Tunnels bypass NAT/firewalls, work everywhere, and are free.

### **2. Minimize Cloudflare Costs**
```python
# ❌ BAD: Every service request hits edge router
user → edge router → coordinator → worker
      (51,990 req/day with 20 workers)

# ✅ GOOD: Edge router only for bootstrap
user → edge router → get DHT seeds → done (once)
user → DHT → find worker → P2P request to worker
      (25 req/day total!)
```

**Target**: Stay under 100 req/day (0.1% of free tier)

### **3. DHT Must Be Optional (Fallback to Coordinator)**
```python
# worker_agent.py
def find_service_worker(self, service_type: str) -> str:
    # Try DHT first
    if self.dht_enabled:
        worker_url = await self.find_service_worker_dht(service_type)
        if worker_url:
            return worker_url
    
    # Fallback to coordinator (existing code)
    return self.find_service_worker_coordinator(service_type)
```

**Why?** Local dev, testing, and fallback when DHT has issues.

### **4. Keep Application Logic Separate**
```
✅ DHT handles: Worker discovery, service registry, P2P routing
❌ DHT does NOT touch: OCR logic, chat logic, document storage

Application services remain unchanged!
```

**Docker Compose local dev must still work**:
```bash
# No DHT, no tunnels, just local containers
docker-compose up
```

### **5. Scale on Donated Compute**
```python
# DHT designed for heterogeneous workers
- Workers join/leave frequently → DHT self-heals
- No central bottleneck → fully distributed
- Works on commodity hardware → RPi to RTX 4090
```

### **6. Add Comprehensive Tests**

**Must test**:
- ✅ DHT bootstrap via edge router
- ✅ Worker registration in DHT
- ✅ Service discovery (find GPU worker)
- ✅ Direct P2P request routing
- ✅ Fallback to coordinator when DHT fails
- ✅ Frontend topology shows DHT ring
- ✅ Load test with 100+ workers
- ✅ Chaos test (random node failures)

See [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md) section "🧪 Testing Strategy"

### **7. Frontend Transparency**

**Users must see DHT topology**:
```python
# Coordinator endpoint
@app.get("/api/dht/topology")
async def get_dht_topology():
    return {
        "nodes": [
            {"id": "worker-1", "type": "worker", "services": ["ocr"]},
            {"id": "coord-1", "type": "coordinator", "location": "eu-west"}
        ],
        "edges": [
            {"from": "worker-1", "to": "coord-1", "type": "dht_link"}
        ],
        "dht_enabled": True,
        "node_count": 42
    }
```

Frontend graph shows P2P connections in real-time!

See [FRONTEND_TOPOLOGY_PLAN.md](./FRONTEND_TOPOLOGY_PLAN.md)

---

## 🎯 Success Criteria

### Traffic Reduction
```
✅ <100 Cloudflare requests/day (target: 25)
✅ 99% reduction from current 51,990/day
✅ Can scale to 2000+ workers on free tier
```

### Performance
```
✅ Service request latency: <100ms (P2P)
✅ DHT lookup latency: <50ms
✅ DHT bootstrap: <2s
```

### Reliability
```
✅ System survives coordinator failures
✅ DHT self-heals on node churn
✅ Fallback to coordinator works
```

### Testing
```
✅ 100% unit test coverage for DHT modules
✅ Integration tests pass (E2E request routing)
✅ Load test: 100+ workers, 1000 req/min
✅ Chaos test: Random failures don't break system
```

---

## 📊 Metrics to Track

### Before DHT
```
Cloudflare Requests/Day: 51,990
├─ Service requests: 100
├─ Worker heartbeats: 51,840 (20 workers × 36/hr × 72 hr)
└─ Topology queries: 50

Capacity: 50-200 workers
Cost: $0/month (but near limit)
```

### After DHT (Target)
```
Cloudflare Requests/Day: 25
├─ DHT bootstrap: 20
├─ Initial coordinator registration: 5
└─ Monitoring/health: 0 (DHT self-reports)

Capacity: 2000+ workers
Cost: $0/month (0.025% of free tier)
```

---

## 🚀 Getting Started

### Step 1: Read Documentation (60 minutes)
1. [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) - 10 min
2. [DHT_INTEGRATION_PLAN.md](./DHT_INTEGRATION_PLAN.md) - 30 min
3. [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md) - 20 min

### Step 2: Set Up Dev Environment (30 minutes)
```bash
# Clone repo
git clone https://github.com/st7ma784/CMACatalyst.git
cd CMACatalyst/RMA-Demo

# Start local coordinator (no DHT yet)
docker-compose -f edge-coordinator.yml up -d

# Verify working
curl http://localhost:8080/health
```

See [DEVELOPER_DEPLOYMENT_GUIDE.md](./DEVELOPER_DEPLOYMENT_GUIDE.md)

### Step 3: Start Phase 1, Task 1.1 (1 hour)
```bash
# Install DHT library
cd worker-containers/universal-worker
pip install kademlia==2.2.2

# Test library
python -c "from kademlia.network import Server; print('✅ Kademlia installed')"

# Create proof-of-concept
# See DHT_IMPLEMENTATION_ROADMAP.md section 1 for code
```

### Step 4: Follow Task List
Work through [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md) systematically.

**Mark tasks complete as you go!**

---

## 🔍 Debugging Tips

### DHT Node Won't Start
```bash
# Check port not in use
sudo lsof -i :8468

# Check firewall allows UDP
sudo ufw allow 8468/udp

# Check logs
docker logs edge-coordinator 2>&1 | grep DHT
```

### Worker Can't Join DHT
```python
# Add verbose logging
import logging
logging.getLogger("kademlia").setLevel(logging.DEBUG)

# Check bootstrap seeds
seeds = requests.get("https://api.rmatool.org.uk/api/dht/bootstrap").json()
print(f"DHT seeds: {seeds}")
```

### Service Discovery Fails
```python
# Check DHT has data
result = await dht_node.get("service:ocr")
print(f"OCR workers in DHT: {result}")

# Check worker heartbeat
worker_info = await dht_node.get("worker:gpu-001")
print(f"Worker last seen: {worker_info.get('last_seen')}")
```

### High Cloudflare Traffic
```bash
# Check what's hitting edge router
curl https://api.rmatool.org.uk/api/admin/metrics

# Should see:
# - bootstrap_requests: ~20/day ✅
# - service_requests: <5/day ✅
# - heartbeats: 0/day ✅ (now via DHT)
```

---

## 📞 Need Help?

### Documentation
- **Architecture questions**: See [DISTRIBUTED_ARCHITECTURE_SPEC.md](./DISTRIBUTED_ARCHITECTURE_SPEC.md)
- **DHT design**: See [DHT_INTEGRATION_PLAN.md](./DHT_INTEGRATION_PLAN.md)
- **Task checklist**: See [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md)
- **Deployment**: See [DEVELOPER_DEPLOYMENT_GUIDE.md](./DEVELOPER_DEPLOYMENT_GUIDE.md)

### Code Examples
All code snippets are in [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md):
- Section 1: DHT Node Core
- Section 2: DHT Client
- Section 3: Worker Integration
- Section 4: Edge Router Bootstrap
- Section 5: Coordinator Integration

### Testing
- **Unit tests**: [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md) → "Testing Strategy"
- **Integration tests**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

## ✅ Final Checklist Before Starting

- [ ] Read SYSTEM_OVERVIEW.md (understand current architecture)
- [ ] Read DHT_INTEGRATION_PLAN.md (understand DHT design)
- [ ] Read DHT_IMPLEMENTATION_ROADMAP.md (your task list)
- [ ] Set up local dev environment
- [ ] Verify current system works (docker-compose up)
- [ ] Understand testing strategy
- [ ] Understand success metrics

**Ready?** Start with Phase 1, Task 1.1 in [DHT_IMPLEMENTATION_ROADMAP.md](./DHT_IMPLEMENTATION_ROADMAP.md)!

---

## 🎯 Remember

1. **Use tunnels** - All P2P via Cloudflare tunnels
2. **Minimize Cloudflare** - Target <100 req/day
3. **Scale on donated compute** - DHT works on heterogeneous hardware
4. **Keep app logic separate** - DHT is infrastructure only
5. **Test thoroughly** - Unit, integration, load, and chaos tests
6. **Make it transparent** - Frontend shows DHT topology

**You've got comprehensive documentation, code examples, and a clear task list. Let's build this! 🚀**

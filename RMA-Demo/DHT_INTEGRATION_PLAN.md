# DHT Integration Plan - Distributed Hash Table for P2P Discovery

**Goal**: Minimize Cloudflare traffic, enable direct P2P communication, improve system redundancy and fault tolerance.

**Status**: Planning Phase  
**Timeline**: Q1 2026  
**Priority**: High (reduces free-tier pressure)

---

## 1. Problem Statement

### Current Limitations

**All Traffic Through Cloudflare**:
- Every service request: Frontend → Edge Router → Coordinator → Worker
- Every heartbeat: Worker → Edge Router → Coordinator (every 30 sec)
- Every topology query: Frontend → Edge Router → Coordinator
- **Result**: 100K request/day free tier limit can be hit with just ~20 active workers

**Single Points of Failure**:
- Durable Object is single instance (Cloudflare managed, but still single)
- Bootstrap coordinator required for system to function
- No automatic coordinator discovery after initial bootstrap

**No Direct P2P**:
- Workers can't communicate directly
- Coordinators can't replicate state between themselves
- All coordination happens through centralized components

---

## 2. DHT Overview

### What is a DHT?

A **Distributed Hash Table** is a decentralized key-value store spread across multiple nodes. Each node:
- Stores a subset of the total data
- Knows how to route queries to the right node
- Can join/leave without central coordination

**Popular Implementations**:
- **Kademlia**: Used by BitTorrent, IPFS, Ethereum
- **Chord**: Academic, clean design
- **libp2p**: Modern, supports NAT traversal

**Key Properties**:
- **Decentralized**: No single point of failure
- **Self-healing**: Automatically repairs when nodes fail
- **Scalable**: O(log n) lookup time for n nodes
- **Content-addressable**: Data stored by hash of its content

---

## 3. Architecture Design

### 3.1 Hybrid DHT + Edge Router Model

**Why Not Pure DHT?**
- DHT bootstrap problem: How do new nodes find existing network?
- NAT traversal: Workers behind firewalls can't accept incoming connections
- Cloudflare Tunnels solve NAT but don't support DHT protocols

**Solution**: Hybrid approach
1. **Edge Router** remains as bootstrap and fallback
2. **DHT** handles service discovery and worker communication
3. **Cloudflare Tunnels** provide HTTPS endpoints for DHT nodes

```
┌─────────────────────────────────────────────────────────────────┐
│  BOOTSTRAP LAYER (Cloudflare - Always Available)                │
│                                                                  │
│  Edge Router (api.rmatool.org.uk)                               │
│  - Maintains list of DHT seed nodes                             │
│  - Provides initial connection list for new nodes               │
│  - Fallback if DHT lookup fails                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. New node queries for seeds
                              │ 2. Receives list of DHT nodes
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  DHT LAYER (P2P - Distributed Across Coordinators)              │
│                                                                  │
│  Kademlia DHT Network                                           │
│  - Each coordinator runs DHT node                               │
│  - Workers query DHT for service locations                      │
│  - Direct P2P queries after bootstrap                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Query DHT for service
                              │ Get worker tunnel URL
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  WORKER LAYER (P2P - Direct Communication)                      │
│                                                                  │
│  Workers communicate directly via tunnel URLs                   │
│  - Bypass edge router for data transfer                         │
│  - Still use HTTPS (via Cloudflare tunnels)                     │
│  - Reduced latency, unlimited bandwidth                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 DHT Key Scheme

**Key Format**: `{type}:{identifier}`

```
# Coordinator discovery
dht://coordinator:{location_hash} → [tunnel_url1, tunnel_url2, ...]
dht://coordinator:list → [all_coordinator_ids]

# Service discovery
dht://service:ocr → [worker_id1, worker_id2, ...]
dht://service:storage → [worker_id1, worker_id2, ...]
dht://service:gpu → [worker_id1, worker_id2, ...]

# Worker metadata
dht://worker:{worker_id} → {
  tunnel_url: "https://...",
  services: ["ocr", "enhance"],
  capabilities: {...},
  last_seen: timestamp
}

# Coordinator metadata
dht://coordinator:{coordinator_id} → {
  tunnel_url: "https://edge-1.rmatool.org.uk",
  location: "eu-west",
  workers_count: 15,
  load: 0.45,
  last_seen: timestamp
}
```

### 3.3 DHT Operations

**PUT** (Store data):
```python
# Coordinator registers itself
dht.put("coordinator:edge-1", {
    "tunnel_url": "https://edge-1.rmatool.org.uk",
    "location": "eu-west",
    "last_seen": time.time()
})

# Worker registers service capability
dht.put("service:ocr", append("worker-gpu-001"))
dht.put("worker:worker-gpu-001", {
    "tunnel_url": "https://worker-001.tunnel...",
    "services": ["ocr"],
    "last_seen": time.time()
})
```

**GET** (Retrieve data):
```python
# Find coordinators in a region
coordinators = dht.get("coordinator:eu-west")

# Find workers offering OCR service
ocr_workers = dht.get("service:ocr")  # ["worker-gpu-001", "worker-gpu-002"]

# Get specific worker details
worker_info = dht.get("worker:worker-gpu-001")
# → {tunnel_url: "https://...", services: [...]}
```

**DELETE** (Remove data):
```python
# Worker going offline
dht.delete("service:ocr", "worker-gpu-001")
dht.delete("worker:worker-gpu-001")
```

---

## 4. Implementation Plan

### Phase 1: DHT Prototype (Weeks 1-2)

**Goal**: Prove DHT works with Cloudflare Tunnels

**Tasks**:
1. Add DHT library to coordinator
   - Option A: py-libp2p (Python)
   - Option B: kademlia (Python, simpler)
   - Option C: go-libp2p (Go, more mature)

2. Implement DHT node in coordinator
   ```python
   # RMA-Demo/services/local-coordinator/dht.py
   
   from kademlia.network import Server
   import asyncio
   
   class CoordinatorDHT:
       def __init__(self, port=8468):
           self.node = Server()
           self.port = port
           
       async def start(self, bootstrap_nodes):
           await self.node.listen(self.port)
           if bootstrap_nodes:
               await self.node.bootstrap(bootstrap_nodes)
               
       async def register_coordinator(self, coord_id, tunnel_url):
           await self.node.set(f"coordinator:{coord_id}", {
               "tunnel_url": tunnel_url,
               "timestamp": time.time()
           })
           
       async def find_service_workers(self, service_type):
           workers = await self.node.get(f"service:{service_type}")
           return workers or []
   ```

3. Test DHT communication between two coordinators
   ```bash
   # Start coordinator 1 (bootstrap)
   python coordinator.py --dht-port 8468
   
   # Start coordinator 2 (joins DHT)
   python coordinator.py --dht-port 8469 \
     --dht-bootstrap http://coord1:8468
   
   # Verify they can find each other
   curl http://coord2:8080/dht/test
   ```

**Success Criteria**:
- Two coordinators can join DHT
- Can store and retrieve coordinator info
- DHT queries work over Cloudflare tunnels

### Phase 2: Service Discovery via DHT (Weeks 3-4)

**Goal**: Workers query DHT instead of coordinator for service locations

**Tasks**:
1. Add DHT client to universal worker
   ```python
   # worker_agent.py
   
   from dht_client import DHTClient
   
   class WorkerAgent:
       def __init__(self):
           self.dht = DHTClient()
           # ...
           
       async def find_service_endpoint(self, service_type):
           # Try DHT first
           workers = await self.dht.get(f"service:{service_type}")
           if workers:
               return random.choice(workers)
           
           # Fallback to coordinator
           return self.query_coordinator(service_type)
   ```

2. Update worker registration to publish to DHT
   ```python
   async def register_with_dht(self):
       # Publish worker info
       await self.dht.set(f"worker:{self.worker_id}", {
           "tunnel_url": self.tunnel_url,
           "services": self.assigned_services,
           "capabilities": self.capabilities
       })
       
       # Publish service mappings
       for service in self.assigned_services:
           await self.dht.append(f"service:{service}", self.worker_id)
   ```

3. Implement DHT-based service routing
   ```python
   # coordinator/app.py
   
   @app.post("/api/service/{service_type}")
   async def route_service(service_type: str, request: Request):
       # Try DHT lookup first
       workers = await dht.get(f"service:{service_type}")
       
       if workers:
           worker_id = select_best_worker(workers)
           worker_info = await dht.get(f"worker:{worker_id}")
           
           # Forward directly to worker
           return await forward_to_worker(worker_info["tunnel_url"], request)
       
       # Fallback to local registry
       return route_via_coordinator(service_type, request)
   ```

**Success Criteria**:
- Workers can find other workers via DHT
- Service requests bypass coordinator
- Edge router request count drops by 80%

### Phase 3: Edge Router Integration (Weeks 5-6)

**Goal**: Edge router provides DHT bootstrap, tracks DHT seed nodes

**Tasks**:
1. Add DHT seed list to Durable Object
   ```javascript
   // coordinator-registry.js
   
   class CoordinatorRegistry {
       async getDHTSeeds() {
           const coordinators = await this.getHealthyCoordinators();
           return coordinators.map(c => ({
               node_id: c.worker_id,
               tunnel_url: c.tunnel_url,
               dht_port: 8468
           }));
       }
   }
   ```

2. Add DHT bootstrap endpoint
   ```javascript
   // index.js
   
   if (path === '/api/dht/bootstrap') {
       const seeds = await registry.getDHTSeeds();
       return new Response(JSON.stringify({
           seeds: seeds,
           ttl: 300  // Cache for 5 minutes
       }));
   }
   ```

3. Update worker startup to bootstrap DHT
   ```python
   async def bootstrap_dht(self):
       # Query edge router for seeds
       response = requests.get(f"{self.coordinator_url}/api/dht/bootstrap")
       seeds = response.json()["seeds"]
       
       # Connect to DHT
       await self.dht.bootstrap([
           (seed["tunnel_url"], seed["dht_port"]) 
           for seed in seeds
       ])
   ```

**Success Criteria**:
- New nodes can bootstrap DHT via edge router
- Edge router tracks DHT-capable coordinators
- System survives coordinator restarts

### Phase 4: Direct P2P Communication (Weeks 7-8)

**Goal**: Workers communicate directly without any intermediary

**Tasks**:
1. Implement worker-to-worker protocol
   ```python
   # Worker A wants to send task to Worker B
   
   # 1. Query DHT for Worker B
   worker_b_info = await dht.get(f"worker:{worker_b_id}")
   
   # 2. Connect directly via tunnel URL
   response = requests.post(
       f"{worker_b_info['tunnel_url']}/api/task/execute",
       json={"task": task_data}
   )
   ```

2. Add task delegation API to workers
   ```python
   @app.post("/api/task/execute")
   async def execute_task(task: Task):
       result = await run_service(task.service_type, task.data)
       return {"status": "completed", "result": result}
   ```

3. Implement DHT-based load balancing
   ```python
   async def delegate_task(service_type, task_data):
       # Get all workers offering service
       workers = await dht.get(f"service:{service_type}")
       
       # Query load from each
       loads = await asyncio.gather(*[
           get_worker_load(worker_id) 
           for worker_id in workers
       ])
       
       # Select least loaded
       best_worker = min(zip(workers, loads), key=lambda x: x[1])[0]
       
       # Delegate directly
       return await execute_on_worker(best_worker, task_data)
   ```

**Success Criteria**:
- Workers can communicate P2P
- No edge router involvement in task execution
- Reduced latency (no extra hops)

---

## 5. Traffic Reduction Analysis

### Current Traffic (20 workers, 100 requests/day)

| Operation | Route | Count/Day | Cloudflare Requests |
|-----------|-------|-----------|---------------------|
| Service Request | Frontend → Edge Router → Coord → Worker | 100 | 100 |
| Worker Heartbeat | Worker → Edge Router → Coord | 20 × 30/sec × 86400sec = 51,840 | 51,840 |
| Topology Query | Frontend → Edge Router → Coord | 50 | 50 |
| **TOTAL** | | | **51,990/day** |

**Problem**: Close to 100K free tier limit with just 20 workers!

### After DHT Integration (20 workers, 100 requests/day)

| Operation | Route | Count/Day | Cloudflare Requests |
|-----------|-------|-----------|---------------------|
| Service Request | Frontend → Worker (direct via DHT) | 100 | 0 |
| Worker Heartbeat | Worker → DHT (P2P) | 51,840 | 0 |
| Topology Query | Frontend → DHT | 50 | 0 |
| DHT Bootstrap | Worker → Edge Router | 20/day | 20 |
| Coord Registration | Coord → Edge Router | 5/day | 5 |
| **TOTAL** | | | **25/day** |

**Savings**: 99.95% reduction! Can now support **2000+ workers** on free tier.

---

## 6. Technology Selection

### Option A: Kademlia (Python)
**Pros**:
- Pure Python, easy integration
- Simple API
- Proven protocol (BitTorrent uses it)

**Cons**:
- Less active development
- No built-in NAT traversal
- Performance not optimized

**Verdict**: Good for MVP

### Option B: libp2p (Go)
**Pros**:
- Production-grade (IPFS, Filecoin use it)
- Built-in NAT traversal (hole punching)
- Active development
- Supports multiple transports

**Cons**:
- Requires Go runtime
- More complex setup
- Cross-language communication needed

**Verdict**: Best for production

### Option C: Custom DHT
**Pros**:
- Full control
- Minimal dependencies
- Optimized for our use case

**Cons**:
- Significant development effort
- Hard to get right
- Security concerns

**Verdict**: Not recommended

**Recommendation**: Start with Kademlia for MVP, migrate to libp2p for production

---

## 7. Security Considerations

### DHT Attacks

**Sybil Attack**: Attacker creates many fake nodes
- **Mitigation**: Require proof-of-work or registration fee
- **Status**: Low priority (private network initially)

**Eclipse Attack**: Attacker isolates a node by controlling its routing table
- **Mitigation**: Connect to multiple bootstrap nodes
- **Status**: Medium priority

**Data Poisoning**: Attacker stores fake service locations
- **Mitigation**: Sign DHT data with worker private keys
- **Status**: High priority

### Implementation

```python
# Sign DHT data
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

class SecureDHT:
    def __init__(self):
        self.private_key = rsa.generate_private_key(65537, 2048)
        self.public_key = self.private_key.public_key()
        
    def sign_data(self, data):
        signature = self.private_key.sign(
            json.dumps(data).encode(),
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), 
                       salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256()
        )
        return {
            "data": data,
            "signature": signature.hex(),
            "public_key": self.public_key_pem()
        }
        
    def verify_data(self, signed_data):
        # Verify signature before using data
        ...
```

---

## 8. Testing Plan

### Unit Tests
- DHT node join/leave
- Key storage/retrieval
- Node failure recovery

### Integration Tests
- Multi-coordinator DHT network
- Worker registration via DHT
- Service discovery via DHT
- Direct P2P communication

### Load Tests
- 1000 workers joining simultaneously
- 10K requests/sec service discovery
- Network partition recovery

### Chaos Tests
- Random node failures
- Network delays
- Coordinator crashes

---

## 9. Rollout Strategy

### Week 1-2: Alpha (Internal Testing)
- Deploy DHT on 2 test coordinators
- Register 5 test workers
- Verify basic functionality

### Week 3-4: Beta (Limited Production)
- Deploy DHT on all coordinators
- Hybrid mode: Try DHT first, fallback to edge router
- Monitor error rates, latency

### Week 5-6: Production (Full Rollout)
- Make DHT primary discovery method
- Edge router becomes bootstrap only
- Monitor Cloudflare request counts

### Week 7-8: Optimization
- Tune DHT parameters (k-bucket size, timeouts)
- Implement load-based routing
- Add advanced features (caching, replication)

---

## 10. Success Metrics

**Primary Metrics**:
- Cloudflare request count: Target <100/day (99%+ reduction)
- Service lookup latency: Target <100ms (currently ~200-300ms)
- System availability: Target 99.9%

**Secondary Metrics**:
- DHT query success rate: Target >99%
- P2P connection success rate: Target >95%
- Worker registration time: Target <5 seconds

**Monitoring**:
```python
# Add to coordinator
@app.get("/metrics")
async def metrics():
    return {
        "dht_nodes": dht.node_count(),
        "dht_queries_success": dht_success_count,
        "dht_queries_failed": dht_failure_count,
        "p2p_connections": active_p2p_connections,
        "edge_router_fallbacks": fallback_count
    }
```

---

## 11. Future Enhancements

**Content-Addressed Storage**:
- Store document chunks in DHT
- Distributed caching of results
- Reduce storage costs

**Gossip Protocol**:
- Faster state propagation
- Real-time topology updates
- Better failure detection

**DHT Replication**:
- Store data on k nearest nodes
- Improve availability
- Faster lookups (query multiple nodes)

**Smart Routing**:
- Latency-aware routing
- Geographic proximity
- Load-based selection

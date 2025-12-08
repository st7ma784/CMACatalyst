# Tier 4: Edge/Coordination Architecture

## The Problem We're Solving

**Before Tier 4:**
- Cloudflare KV free tier: 1,000 writes/day limit
- 2 workers × 2,880 heartbeats/day = 5,760 writes (5.7x over limit!)
- Would cost $5/month once we exceed free tier
- Centralized bottleneck: Single coordinator

**With Tier 4:**
- Distributed coordinators hosted on contributor machines
- Zero Cloudflare KV usage ✅
- Geographic distribution for lower latency
- Self-healing: If one coordinator fails, others take over

## What is Tier 4?

**Tier 4 = Edge/Coordination workers**

These are machines that:
- Have **public IP addresses** (in server rooms, data centers, cloud VMs)
- Have **low latency** to the internet (<50ms to coordinator)
- Have **good uptime** (always-on servers)
- Can **host services** that route traffic to other workers

## Tier 4 Services

### 1. Coordinator Service (Port 8080)
**What it does:** Worker registry and service assignment
- Maintains list of all workers (in-memory)
- Assigns services to new workers based on gaps
- Tracks worker health via heartbeats
- Provides `/api/admin/*` endpoints for monitoring

**Why distribute it:**
- Primary coordinator can be overloaded
- Geographic distribution reduces latency for workers
- Redundancy: If one coordinator fails, workers can failover

### 2. Edge Proxy Service (Port 8787)
**What it does:** Lightweight routing layer
- Caches worker list (5-minute TTL)
- Routes user requests to appropriate workers
- Handles CORS and authentication
- DDoS protection

**Why distribute it:**
- Users get routed to nearest edge proxy (lower latency)
- Load distribution across multiple endpoints
- Eliminates single point of failure

### 3. Load Balancer Service (Port 8090)
**What it does:** Traffic distribution
- Round-robin across multiple workers
- Health check before routing
- Failover if worker is down

## Detection: How Does a Worker Become Tier 4?

The worker agent auto-detects edge capability:

```python
def detect_edge_capability():
    # Check 1: Do we have a public IP?
    local_ip = get_outbound_ip()
    is_public = not local_ip.startswith(("10.", "192.168.", "172.16.", "127."))
    
    # Check 2: Low latency to coordinator?
    latency_ms = ping(coordinator_url)
    is_low_latency = latency_ms < 50
    
    # If EITHER is true, we're edge-capable
    if is_public or is_low_latency:
        return "edge"
    else:
        return "cpu"  # fallback
```

**Examples:**
- Cloud VM (AWS, GCP, Azure): ✅ Public IP → Tier 4
- University server: ✅ Public IP → Tier 4
- Corporate data center: ✅ Low latency → Tier 4
- Home PC behind NAT: ❌ Private IP + variable latency → Tier 2 (CPU)

## Service Assignment for Edge Workers

**Key principle: Workers are flexible, assignment is strategic**

Every worker CAN run any service within its capability tier, but the coordinator assigns services strategically to optimize for:
- **GPU (Tier 1)**: Prefer 1 service per worker - model loading is expensive (5-10GB VRAM, 30-60s swap time)
- **CPU (Tier 2)**: Can multi-task 2-3 services - minimal overhead switching between them
- **Storage (Tier 3)**: Can run multiple databases simultaneously - no model loading concerns
- **Edge (Tier 4)**: Can run coordinator + proxy together - stateless routing services

When an edge worker registers:

```
Coordinator analyzes:
  - coordinator: 0 workers (CRITICAL GAP!)
  - edge-proxy: 0 workers (CRITICAL GAP!)
  - load-balancer: 0 workers (nice to have)

Assigns: ["coordinator", "edge-proxy"]  # Top 2 priority

Note: This worker COULD also run the load-balancer, but we'll
assign that to the next edge worker to distribute load evenly.
```

## Example Deployment: Server Room

```bash
# On a server with public IP
docker run -d --name rma-edge-worker \
  -e COORDINATOR_URL=https://api.rmatool.org.uk \
  -e WORKER_TYPE=edge \
  -p 8080:8080 \  # Coordinator
  -p 8787:8787 \  # Edge Proxy
  -p 8090:8090 \  # Load Balancer
  ghcr.io/st7ma784/cmacatalyst/universal-worker:latest
```

**What happens:**
1. Worker detects public IP: `203.0.113.45`
2. Registers as Tier 4 (edge) worker
3. Coordinator assigns: `["coordinator", "edge-proxy"]`
4. Worker launches:
   - Local coordinator on `:8080`
   - Edge proxy on `:8787`
5. Worker creates Cloudflare Tunnel exposing both services
6. Coordinator at `https://203-0-113-45.trycloudflare.com`

## Multi-Coordinator Architecture

With multiple edge workers, we get **coordinator federation**:

```
                    ┌─────────────────────┐
                    │  Primary Coordinator │
                    │  (Always running)    │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼─────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│ Edge Worker 1 (US) │ │ Edge Worker 2 (EU)│ │ Edge Worker 3 (APAC)│
│ Coordinator:8080   │ │ Coordinator:8080  │ │ Coordinator:8080 │
│ Edge Proxy:8787    │ │ Edge Proxy:8787   │ │ Edge Proxy:8787  │
└────────────────────┘ └───────────────────┘ └──────────────────┘
         │                      │                       │
    US Workers              EU Workers             APAC Workers
   (low latency)           (low latency)          (low latency)
```

**Benefits:**
- Workers register with **geographically closest** coordinator
- Heartbeat traffic stays regional (lower costs)
- Primary coordinator aggregates from regional coordinators
- If US coordinator fails, workers failover to EU coordinator

## Cost Analysis

### Before Tier 4 (Cloudflare KV):
```
10 workers × 2,880 heartbeats/day = 28,800 KV writes/day
Free tier: 1,000 writes/day
Overage: 27,800 writes/day
Cost: ~$5-10/month (depends on Cloudflare pricing)
```

### With Tier 4 (Distributed Coordinators):
```
1 edge worker hosts coordinator
10 workers → local coordinator (FastAPI in-memory)
Cloudflare KV writes: 0
Cost: $0/month ✅
```

## Monitoring Tier 4

```bash
# Check edge workers
curl https://api.rmatool.org.uk/api/admin/workers | jq '.workers[] | select(.tier == 4)'

# Check coordinator coverage
curl https://api.rmatool.org.uk/api/admin/gaps | jq '.gaps[] | select(.service == "coordinator")'

# Response:
{
  "service": "coordinator",
  "required_type": "edge",
  "priority": 1,
  "current_workers": 3,  # 3 edge workers hosting coordinators
  "status": "ok"
}
```

## Requirements for Tier 4 Worker

**Minimum:**
- Public IP address **OR** low latency (<50ms)
- 2GB RAM (to run coordinator + proxy)
- 2+ CPU cores
- Reliable uptime (>99%)

**Recommended:**
- Public IP (static preferred)
- 4GB RAM
- 4+ CPU cores
- Gigabit network connection
- UPS backup power

**Ideal Hosts:**
- Cloud VMs (AWS EC2, GCP Compute, Azure VM)
- University research servers
- Corporate data centers
- Co-location facilities
- Home servers with static IP

## Security Considerations

### Edge workers are public-facing!

**Protections needed:**
1. **Authentication:** API keys for coordinator endpoints
2. **Rate limiting:** Prevent abuse
3. **DDoS protection:** Cloudflare Tunnel provides this
4. **Firewall rules:** Only expose necessary ports
5. **TLS:** All traffic over HTTPS (Cloudflare Tunnel handles this)

### Implementation:
```python
# In coordinator service
@app.post("/api/worker/register")
async def register_worker(registration: WorkerRegistration, api_key: str = Header(None)):
    if api_key != os.getenv("API_KEY"):
        raise HTTPException(status_code=403, detail="Invalid API key")
    # ... rest of registration
```

## Fallback Strategy

What if no Tier 4 workers exist?

**Fallback chain:**
1. Try Tier 4 coordinator (if available)
2. Fall back to primary coordinator (api.rmatool.org.uk)
3. Fall back to Cloudflare KV (emergency backup)

```javascript
// Edge worker code
async function getCoordinator() {
  // Try Tier 4 coordinators
  const tier4Workers = await cache.get('tier4-coordinators');
  if (tier4Workers && tier4Workers.length > 0) {
    return tier4Workers[0].url;  // Use first available
  }
  
  // Fall back to primary
  return 'https://api.rmatool.org.uk';
}
```

## Deployment Priority

**Bootstrap order:**
1. Deploy primary coordinator (FastAPI, always running)
2. Deploy 1+ storage workers (ChromaDB for RAG)
3. Deploy 1+ GPU workers (LLM inference)
4. Deploy 1+ **edge workers** (host coordinators) ← **Tier 4!**
5. Deploy more GPU/CPU/storage workers as needed

**Why Tier 4 comes 4th:**
- Need primary coordinator first (bootstrap)
- Need services to route to (GPU/CPU/storage)
- Then add edge workers for distribution and cost savings

## Success Metrics

**Tier 4 is successful when:**
- ✅ Zero Cloudflare KV writes (down from 28,800/day)
- ✅ <100ms latency for 95% of worker registrations
- ✅ 3+ geographic regions covered
- ✅ Primary coordinator CPU usage <20% (offloaded to Tier 4)
- ✅ $0/month infrastructure costs

## Future Enhancements

### Tier 4.5: CDN Workers
Edge workers that also cache responses:
- LLM responses for common queries
- OCR results for duplicate documents
- RAG embeddings for frequently accessed manuals

### Tier 4.6: Edge AI
Edge workers with GPUs that can run inference:
- Reduce round-trip time for users
- Process data closer to the source
- Privacy: Data never leaves region

---

**TL;DR:** Tier 4 workers are machines with good network access that host coordinators and proxies. They eliminate Cloudflare KV costs, reduce latency through geographic distribution, and create a self-healing infrastructure. Contributors with servers can donate coordination capacity, not just compute! 🚀
